import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { create } from "@bufbuild/protobuf";
import { createContextValues, createHandlerContext, type HandlerContext } from "@connectrpc/connect";
import { EchoRequestSchema, EchoResponseSchema, SampleService } from "@skilient/contracts/sample/v1/sample_pb";
import { callKey, refuse, refusalReason, withWrite } from "@skilient/platform";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startPostgres, type TestDatabase } from "../src/postgres";

/** Client idempotency keys on writes (prd.md call rules) against a real Postgres 17. */
describe("withWrite: a repeat returns the first result", () => {
  let pg: TestDatabase;
  let sql: postgres.Sql;
  const schemas = { input: EchoRequestSchema, output: EchoResponseSchema };

  beforeAll(async () => {
    pg = await startPostgres();
    sql = await pg.service("alpha", mkdtempSync(join(tmpdir(), "mig-")));
    await pg.admin`create table alpha.effects (n serial primary key, message text)`;
    await pg.admin`grant select, insert on alpha.effects to svc_alpha`;
    await pg.admin`grant usage on sequence alpha.effects_n_seq to svc_alpha`;
  }, 120_000);
  afterAll(async () => {
    await pg?.stop();
  });

  function ctx(key: string | null, user = "u-1"): HandlerContext {
    const values = createContextValues();
    values.set(callKey, { requestId: "r", caller: "web", user: { id: user, aal: "aal1" }, userToken: null, depth: 1, startedAt: 0 });
    return createHandlerContext({
      service: SampleService,
      method: SampleService.method.echo,
      protocolName: "connect",
      requestMethod: "POST",
      url: "http://local/x",
      requestHeader: key ? { "idempotency-key": key } : {},
      contextValues: values,
    });
  }
  const effects = async () => Number((await sql`select count(*)::int as n from alpha.effects`)[0]?.["n"]);
  const write = (key: string | null, message: string, opts: { fail?: boolean; storeReply?: boolean; user?: string } = {}) =>
    withWrite(
      ctx(key, opts.user),
      sql,
      schemas,
      create(EchoRequestSchema, { message }),
      async (tx) => {
        const [row] = await tx<{ n: number }[]>`insert into alpha.effects (message) values (${message}) returning n`;
        if (opts.fail) throw refuse("precondition", "body_refused");
        return create(EchoResponseSchema, { message: `stored ${row!.n}`, servedBy: "alpha", depth: 1 });
      },
      { storeReply: opts.storeReply },
    );

  it("runs once and returns the first reply to a repeat", async () => {
    const before = await effects();
    const first = await write("key-repeat-0001", "hello");
    const again = await write("key-repeat-0001", "hello");
    expect(again).toEqual(first);
    expect((await effects()) - before).toBe(1);
  });

  it("refuses the same key with a different request", async () => {
    await write("key-reused-0001", "one");
    await expect(write("key-reused-0001", "two")).rejects.toSatisfy((e) => refusalReason(e) === "idempotency_key_reused");
  });

  it("keys are per actor: another user's identical key is a separate write", async () => {
    const before = await effects();
    await write("key-actor-0001", "same", { user: "u-1" });
    await write("key-actor-0001", "same", { user: "u-2" });
    expect((await effects()) - before).toBe(2);
  });

  it("refuses a write with no key or a malformed key", async () => {
    await expect(write(null, "x")).rejects.toSatisfy((e) => refusalReason(e) === "idempotency_key_missing");
    await expect(write("bad key!", "x")).rejects.toSatisfy((e) => refusalReason(e) === "idempotency_key_invalid");
  });

  it("a refused body stores nothing, so the same key can be retried", async () => {
    const before = await effects();
    await expect(write("key-refused-01", "r", { fail: true })).rejects.toSatisfy((e) => refusalReason(e) === "body_refused");
    expect(await effects()).toBe(before);
    await write("key-refused-01", "r");
    expect((await effects()) - before).toBe(1);
  });

  it("concurrent duplicates have one effect and the same reply", async () => {
    const before = await effects();
    const replies = await Promise.all([write("key-concurrent-1", "c"), write("key-concurrent-1", "c")]);
    expect(replies[0]).toEqual(replies[1]);
    expect((await effects()) - before).toBe(1);
  });

  it("a method that returns a secret stores no reply and refuses a repeat", async () => {
    await write("key-secret-0001", "s", { storeReply: false });
    const [row] = await sql`select response from platform.idempotency where key = 'key-secret-0001'`;
    expect(row?.["response"]).toBeNull();
    await expect(write("key-secret-0001", "s", { storeReply: false })).rejects.toSatisfy((e) => refusalReason(e) === "already_applied");
  });
});
