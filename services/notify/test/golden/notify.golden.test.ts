/**
 * Replaying the notify goldens (packages/testing/test/notify.golden.test.ts) against the port. The rules, as the
 * earlier services' replays:
 *
 * 1. The same world (packages/testing/test/fixtures/notify-world.ts). What the recorder did through other services'
 *    functions (a friend request and its answer, a comment) is that service's event here, applied by notify's own
 *    consumer code; titles and excerpts come from the fixture as the owners' batch reads would return them. Actor
 *    names, usernames and photos come from the fixture as people's ProfileCards and Relations return them, with the
 *    handler's visibility rule.
 * 2. Notices made in one transaction are moved apart with the recorder's own `apartSql`.
 * 3. Refusals through src/refusals.ts (SQLSTATE and wording). A signed-out caller's grant refusal on the stack is the
 *    port's not_signed_in (compared by code).
 * 4. The stack's functions returned rows; the replay shapes the port's answers as those rows.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { normalise } from "@skilient/testing";
import { startPostgres, type TestDatabase } from "@skilient/testing/postgres";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as F from "../../../../packages/testing/test/fixtures/notify-world";
import type { Facts } from "../../src/domain/notices";
import { emptyCommunity, emptyCredentials, emptyWork } from "../../src/ports";
import { REFUSALS, type RefusalReason } from "../../src/refusals";
import * as B from "../../src/store/bell";
import { applyNoticeEvent } from "../../src/store/consumers";

const MIGRATIONS = join(import.meta.dirname, "../../migrations");
const DIR = join(import.meta.dirname, "../../../../packages/testing/test/golden/notify");
const load = (file: string) => JSON.parse(readFileSync(join(DIR, file), "utf8")) as Record<string, unknown>;
type Tx = postgres.TransactionSql;
type Out = { ok: true; value: unknown } | { ok: false; code: string; message: string };

const REQ_BILAL = "99e10000-0000-4000-8000-000000000001";
const REQ_DUA = "99e10000-0000-4000-8000-000000000002";
const COMMENT = "99e10000-0000-4000-8000-000000000003";

const facts = (): Facts => ({
  comments: new Map([[COMMENT, F.COMMENT_BODY.slice(0, 120)]]),
  messages: new Map(),
  work: emptyWork(),
  community: emptyCommunity(),
  credentials: emptyCredentials(),
  names: new Map(),
});
const ev = (type: string, producer: string, payload: Record<string, unknown>) => ({ type, producer, payload, version: 1, subjects: [] });

/** The recorder's makeNotices, as the owners' events. */
async function makeNotices(tx: Tx): Promise<void> {
  const f = facts();
  for (const e of [
    ev("friend_request.changed", "svc_people", { request_id: REQ_BILAL, sender_id: F.BILAL, receiver_id: F.AMNA, status: "pending" }),
    ev("friend_request.changed", "svc_people", { request_id: REQ_BILAL, sender_id: F.BILAL, receiver_id: F.AMNA, status: "accepted" }),
    ev("comment.created", "svc_content", { comment_id: COMMENT, post_id: F.POST, author_id: F.CHEN, post_author_id: F.AMNA, parent_author_id: null, mentioned_ids: [F.BILAL] }),
    ev("friend_request.changed", "svc_people", { request_id: REQ_DUA, sender_id: F.DUA, receiver_id: F.AMNA, status: "pending" }),
  ])
    expect(await applyNoticeEvent(tx, e, f)).toBe("applied");
  await tx.unsafe(F.apartSql("notify.notifications"));
}

/** MyNotifications' answer as the stack's rows: names always, username and photo where the reader may see them. */
function asRows(reader: string, rows: B.Row[]) {
  const sees = (a: string) => F.VISIBILITY[a] === "global" || F.UNI_OF[a] === F.UNI_OF[reader];
  return rows.map((r) => ({
    actor_avatar_path: r.actor_id && sees(r.actor_id) ? F.AVATAR[r.actor_id] : null,
    actor_name: r.actor_id ? F.NAME[r.actor_id] : null,
    actor_username: r.actor_id && sees(r.actor_id) ? F.USERNAME[r.actor_id] : null,
    category: r.category,
    created_at: new Date(r.created_at).toISOString(),
    data: r.data,
    entity_id: r.entity_id,
    entity_type: r.entity_type,
    id: r.id,
    read_at: r.read_at ? new Date(r.read_at).toISOString() : null,
    type: r.type,
  }));
}

async function attempt(tx: Tx, body: (sp: Tx) => Promise<unknown>): Promise<Out> {
  try {
    return { ok: true, value: await tx.savepoint((sp) => body(sp)) };
  } catch (e) {
    const reason = (e as { rawMessage?: string; message?: string }).rawMessage ?? (e as Error).message;
    const r = REFUSALS[reason as RefusalReason];
    if (!r) throw e;
    return { ok: false, code: r.sqlstate, message: r.text };
  }
}
const one = (name: string, value: unknown = null) => [{ [name]: value }];

let pg: TestDatabase;
let sql: postgres.Sql;
beforeAll(async () => {
  pg = await startPostgres();
  sql = await pg.service("notify", MIGRATIONS);
});
afterAll(async () => {
  await pg?.stop();
});

/** Runs a case in a rolled-back transaction and compares it with the recording. */
async function replay(file: string, name: string, body: (tx: Tx) => Promise<unknown>, compareByCode: string[] = []) {
  let value: unknown;
  await sql
    .begin(async (tx) => {
      value = await body(tx);
      throw new Error("rollback");
    })
    .catch((e: Error) => {
      if (e.message !== "rollback") throw e;
    });
  const expected = load(file)[name] as Record<string, unknown>;
  const actual = normalise(value) as Record<string, unknown>;
  for (const k of compareByCode) {
    expect((actual[k] as { code: string }).code, k).toBe((expected[k] as { code: string }).code);
    delete actual[k];
  }
  expect(actual).toEqual(Object.fromEntries(Object.entries(expected).filter(([k]) => !compareByCode.includes(k))));
}

describe("notify goldens replayed: the bell", () => {
  it("notices", () =>
    replay("bell.json", "notices", async (tx) => {
      await makeNotices(tx);
      const read = async (u: string): Promise<Out> => ({ ok: true, value: asRows(u, await B.myNotifications(tx, u, null, 50)) });
      const count = async (u: string): Promise<Out> => ({ ok: true, value: [{ n: await B.unreadCount(tx, u) }] });
      const [before] = await tx<{ t: string }[]>`select (now() - interval '150 seconds')::text as t`;
      return {
        amna: await read(F.AMNA),
        bilal: await read(F.BILAL),
        chen: await read(F.CHEN),
        counts: { amna: await count(F.AMNA), bilal: await count(F.BILAL), chen: await count(F.CHEN) },
        page: { ok: true, value: (await B.myNotifications(tx, F.AMNA, before!.t, 2)).map((r) => ({ type: r.type })) },
      };
    }));

  it("marking", () =>
    replay(
      "bell.json",
      "marking",
      async (tx) => {
        await makeNotices(tx);
        const [first] = await tx<{ id: string }[]>`select id::text from notify.notifications where user_id = ${F.AMNA} and type = 'comment_received'`;
        const id = first!.id;
        return {
          others: await attempt(tx, (sp) => B.markRead(sp, F.BILAL, id).then(() => one("mark_notification_read"))),
          unknown: await attempt(tx, (sp) => B.markRead(sp, F.AMNA, "99e00000-0000-4000-8000-000000000001").then(() => one("mark_notification_read"))),
          signedOut: { ok: false, code: REFUSALS.not_signed_in.sqlstate, message: REFUSALS.not_signed_in.text },
          mine: await attempt(tx, (sp) => B.markRead(sp, F.AMNA, id).then(() => one("mark_notification_read"))),
          again: await attempt(tx, (sp) => B.markRead(sp, F.AMNA, id).then(() => one("mark_notification_read"))),
          countAfterOne: { ok: true, value: [{ n: await B.unreadCount(tx, F.AMNA) }] },
          all: { ok: true, value: [{ n: await B.markAllRead(tx, F.AMNA) }] },
          allAgain: { ok: true, value: [{ n: await B.markAllRead(tx, F.AMNA) }] },
          countAfterAll: { ok: true, value: [{ n: await B.unreadCount(tx, F.AMNA) }] },
        };
      },
      ["signedOut"],
    ));
});

describe("notify goldens replayed: preferences", () => {
  it("prefs", () =>
    replay("prefs.json", "prefs", async (tx) => {
      const settings = async (u: string): Promise<Out> => ({ ok: true, value: await B.mySettings(tx, u) });
      const set = (u: string, c: string, ch: "instant_email" | "digest" | "off") => attempt(tx, (sp) => B.setPref(sp, u, c, ch).then(() => one("set_notification_pref")));
      return {
        before: await settings(F.AMNA),
        instantRefused: await set(F.AMNA, "comments", "instant_email"),
        unknown: await set(F.AMNA, "no_such_thing", "digest"),
        off: await set(F.AMNA, "comments", "off"),
        instant: await set(F.AMNA, "friend_requests", "digest"),
        after: await settings(F.AMNA),
        other: await settings(F.BILAL),
      };
    }));
});

describe("notify goldens replayed: push", () => {
  it("push", () =>
    replay("push.json", "push", async (tx) => {
      const settings = async (u: string): Promise<Out> => ({ ok: true, value: [{ s: await B.myPushSettings(tx, u) }] });
      const save = (u: string, endpoint: string, p256dh: string) =>
        attempt(tx, (sp) => B.savePushSubscription(sp, u, { endpoint, p256dh, auth: F.AUTH, userAgent: F.USER_AGENT }).then(() => one("save_push_subscription")));
      return {
        before: await settings(F.AMNA),
        badEndpoint: await save(F.AMNA, F.ENDPOINT_BAD, F.P256DH),
        badKeys: await save(F.AMNA, F.ENDPOINT, "short"),
        saved: await save(F.AMNA, F.ENDPOINT, F.P256DH),
        again: await save(F.AMNA, F.ENDPOINT, F.P256DH),
        notPushed: await attempt(tx, (sp) => B.setPushPref(sp, F.AMNA, "comments", true).then(() => one("set_push_pref"))),
        off: await attempt(tx, (sp) => B.setPushPref(sp, F.AMNA, "messages", false).then(() => one("set_push_pref"))),
        after: await settings(F.AMNA),
        movedToBilal: await save(F.BILAL, F.ENDPOINT, F.P256DH),
        amnaAfterMove: await settings(F.AMNA),
        deleteAll: await attempt(tx, (sp) => B.deletePushSubscription(sp, F.BILAL, null).then(() => one("delete_push_subscription"))),
        bilalAfter: await settings(F.BILAL),
      };
    }));
});
