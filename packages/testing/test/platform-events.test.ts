import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendEvents, createConsumer, type LoggedEvent } from "@skilient/platform";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startPostgres, type TestDatabase } from "../src/postgres";

/** The shared event log (docs/azure/prd.md, "Events") against a real Postgres 17. */
describe("platform event log", () => {
  let pg: TestDatabase;
  let alpha: postgres.Sql;
  let beta: postgres.Sql;
  const empty = () => mkdtempSync(join(tmpdir(), "mig-"));

  beforeAll(async () => {
    pg = await startPostgres();
    alpha = await pg.service("alpha", empty());
    beta = await pg.service("beta", empty());
  }, 120_000);
  afterAll(async () => {
    await pg?.stop();
  });

  function collector(name: string, types: string[], sql = beta) {
    const seen: LoggedEvent[] = [];
    const consumer = createConsumer({ sql, name, types, handle: async (_tx, e) => void seen.push(e) });
    return { seen, consumer };
  }

  it("writes events in the caller's transaction: a rollback emits nothing", async () => {
    await expect(
      alpha.begin(async (tx) => {
        await appendEvents(tx, [{ type: "thing.rolled_back", subjects: [], payload: { n: 1 } }]);
        throw new Error("abort");
      }),
    ).rejects.toThrow("abort");
    const { seen, consumer } = collector("beta.rollback", ["thing.rolled_back"]);
    expect(await consumer.runOnce()).toBe(0);
    expect(seen).toEqual([]);
  });

  it("records the producer as the writing role and refuses another producer name", async () => {
    await alpha.begin((tx) => appendEvents(tx, [{ type: "thing.made", payload: { n: 1 } }]));
    const [row] = await beta`select producer from platform.events where type = 'thing.made'`;
    expect(row?.["producer"]).toBe("svc_alpha");
    await expect(alpha`insert into platform.events (id, type, producer) values (gen_random_uuid(), 'thing.forged', 'svc_beta')`).rejects.toThrow(
      /row-level security/,
    );
    await expect(alpha`update platform.events set payload = '{}' where type = 'thing.made'`).rejects.toThrow(/permission denied/);
    await expect(alpha`delete from platform.events where type = 'thing.made'`).rejects.toThrow(/permission denied/);
  });

  it("never skips an event whose smaller seq commits after a larger one", async () => {
    const { seen, consumer } = collector("beta.order", ["race.step"]);
    let releaseSlow!: () => void;
    const slowDone = alpha.begin(async (tx) => {
      await appendEvents(tx, [{ type: "race.step", payload: { step: "slow" } }]); // smaller seq, older txid
      await new Promise<void>((resolve) => (releaseSlow = resolve));
    });
    await new Promise((r) => setTimeout(r, 200));
    await alpha.begin((tx) => appendEvents(tx, [{ type: "race.step", payload: { step: "fast" } }])); // larger seq, commits first
    expect(await consumer.runOnce()).toBe(0); // the slow transaction is still open: wait, don't skip past it
    releaseSlow();
    await slowDone;
    expect(await consumer.runOnce()).toBe(2);
    expect(seen.map((e) => e.payload["step"])).toEqual(["slow", "fast"]);
  });

  it("applies a replayed event once (applied event ids are recorded)", async () => {
    const applied: string[] = [];
    const consumer = createConsumer({
      sql: beta,
      name: "beta.replay",
      types: ["replay.done"],
      handle: async (tx, e) => {
        applied.push(e.id);
        await tx`select 1`;
      },
    });
    await alpha.begin((tx) => appendEvents(tx, [{ type: "replay.done", payload: {} }]));
    expect(await consumer.runOnce()).toBe(1);
    await beta`update platform.cursors set last_txid = '0'::xid8, last_seq = 0 where consumer = 'beta.replay'`; // as after a crash
    expect(await consumer.runOnce()).toBe(1);
    expect(applied).toHaveLength(1);
  });

  it("a failing handler rolls back its batch and the event is delivered again", async () => {
    let fail = true;
    const seen: string[] = [];
    const consumer = createConsumer({
      sql: beta,
      name: "beta.retry",
      types: ["retry.once"],
      handle: async (_tx, e) => {
        if (fail) throw new Error("handler down");
        seen.push(e.id);
      },
    });
    await alpha.begin((tx) => appendEvents(tx, [{ type: "retry.once", payload: {} }]));
    await expect(consumer.runOnce()).rejects.toThrow("handler down");
    fail = false;
    expect(await consumer.runOnce()).toBe(1);
    expect(seen).toHaveLength(1);
  });

  it("NOTIFY wakes a started consumer within a second", async () => {
    const { seen, consumer } = collector("beta.notify", ["wake.now"]);
    await consumer.start();
    const t0 = Date.now();
    await alpha.begin((tx) => appendEvents(tx, [{ type: "wake.now", payload: {} }]));
    while (seen.length === 0 && Date.now() - t0 < 2_000) await new Promise((r) => setTimeout(r, 10));
    await consumer.stop();
    expect(seen).toHaveLength(1);
    expect(Date.now() - t0).toBeLessThan(1_000);
  });

  it("keeps each role's cursors and applied ids to itself", async () => {
    await alpha`insert into platform.cursors (consumer) values ('alpha.private')`;
    expect(await beta`select * from platform.cursors where consumer = 'alpha.private'`).toHaveLength(0);
    await expect(beta`update platform.cursors set last_seq = 99 where consumer = 'alpha.private'`).resolves.toHaveProperty("count", 0);
    expect(await alpha`select * from platform.applied_events`).toHaveLength(0);
  });

  it("refuses payloads that carry personal data, at any depth", async () => {
    for (const payload of [{ email: "a@b.test" }, { user: { fullName: "A" } }, { items: [{ user_email: "x" }] }, { code: "123456" }, { refresh_token: "t" }]) {
      await expect(alpha.begin((tx) => appendEvents(tx, [{ type: "pii.check", payload }]))).rejects.toThrow(/personal data/);
    }
    await alpha.begin((tx) => appendEvents(tx, [{ type: "pii.check", payload: { user_id: "u", email_hash: "h0", tv: 2, reason: "sign_out" } }]));
  });

  it("prepare runs once per batch and hands its result to every event (W2 Q2)", async () => {
    await alpha.begin((tx) => appendEvents(tx, [1, 2, 3].map((n) => ({ type: "prep.batch", payload: { n } }))));
    const calls: number[] = [];
    const seen: string[] = [];
    const consumer = createConsumer({
      sql: beta,
      name: "beta.prepare",
      types: ["prep.batch"],
      prepare: async (events) => {
        calls.push(events.length);
        return new Map(events.map((e) => [e.id, `p${String(e.payload["n"])}`]));
      },
      handle: async (_tx, e, prepared) => void seen.push(prepared.get(e.id)!),
    });
    expect(await consumer.runOnce()).toBe(3);
    expect(calls).toEqual([3]);
    expect(seen).toEqual(["p1", "p2", "p3"]);
    expect(await consumer.runOnce()).toBe(0);
    expect(calls).toEqual([3]); // an empty batch never calls prepare
  });

  it("a prepare failure leaves the cursor where it was and applies nothing", async () => {
    await alpha.begin((tx) => appendEvents(tx, [{ type: "prep.fail", payload: { n: 1 } }]));
    let fail = true;
    const seen: unknown[] = [];
    const consumer = createConsumer({
      sql: beta,
      name: "beta.prepare-fail",
      types: ["prep.fail"],
      prepare: async () => {
        if (fail) throw new Error("owner down");
        return "ok";
      },
      handle: async (_tx, e, prepared) => void seen.push([e.payload["n"], prepared]),
    });
    await expect(consumer.runOnce()).rejects.toThrow("owner down");
    const [cursor] = await beta`select last_seq::text from platform.cursors where consumer = 'beta.prepare-fail'`;
    expect(cursor).toBeUndefined();
    expect(await beta`select * from platform.applied_events where consumer = 'beta.prepare-fail'`).toHaveLength(0);
    fail = false;
    expect(await consumer.runOnce()).toBe(1);
    expect(seen).toEqual([[1, "ok"]]);
  });

  it("the shared extensions schema works for a service role (W2 Q6)", async () => {
    const [row] = await alpha<{ s: number; u: string }[]>`select extensions.similarity('Zyxwar', 'zyxwr') > 0.3 as s, extensions.unaccent('Ãli') as u`;
    expect(row).toEqual({ s: true, u: "Ali" });
    const [h] = await alpha<{ h: string }[]>`select encode(extensions.digest('x', 'sha256'), 'hex') as h`;
    expect(h!.h).toHaveLength(64);
  });
});
