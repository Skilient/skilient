/**
 * Notify golden recordings (W9). Records what the current stack (local Supabase) returns for the ported notification
 * functions, so the notify service can be held to the same results. The sheet is docs/azure/notify-function-bins.md;
 * the world is test/fixtures/notify-world.ts.
 *
 *   GOLDEN_STACK_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres GOLDEN_RECORD=1 pnpm exec vitest run test/notify.golden.test.ts
 *
 * Without GOLDEN_RECORD it compares the stack with the files. Without GOLDEN_STACK_DB_URL the file is skipped. Every
 * case runs in its own transaction that is rolled back. The stack's triggers make the notices (a friend request and
 * its acceptance, a comment with a mention, a request from another university); notices made in one transaction are
 * moved apart as the owner (`apartSql`). Every step that depends on an earlier one checks it worked (`ok`), so no
 * step is recorded without reaching the stack. Generated ids are recorded as their type (normalised uuids).
 */
import { join } from "node:path";
import type postgres from "postgres";
import { describe, expect, it } from "vitest";
import { actAs, assertLocalStack, attempt, callCurrentStackSql, golden, type SqlOutcome, type StackActor } from "../src/golden";
import * as F from "./fixtures/notify-world";

const DB = process.env["GOLDEN_STACK_DB_URL"];
if (DB !== undefined) assertLocalStack(DB);
const DIR = join(import.meta.dirname, "golden", "notify");

type Tx = postgres.TransactionSql;
const OWNER: StackActor = { role: "postgres" };
const as = (user: string): StackActor => ({ role: "authenticated", claims: { sub: user, role: "authenticated", aal: "aal1", email: F.EMAIL[user] } });

async function seed(tx: Tx): Promise<void> {
  for (const u of F.UNIVERSITIES) await tx.unsafe(`insert into public.universities (id, name, slug, live_at) values ($1, $2, $3, now() - interval '1 day')`, [u.id, u.name, u.slug]);
  for (const u of F.UNIVERSITIES) await tx.unsafe(`insert into public.university_domains (university_id, domain, kind, source) values ($1, $2, 'both', 'ops')`, [u.id, u.domain]);
  for (const id of F.USERS) {
    await tx.unsafe(
      `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
       values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2, '', now() - interval '30 days',
               '{"provider":"email","providers":["email"]}'::jsonb, $3::text::jsonb, now() - interval '30 days', now())`,
      [id, F.EMAIL[id]!, JSON.stringify({ full_name: F.NAME[id] })],
    );
    await tx.unsafe(
      `update public.profiles set username = $2, department = 'Computer Science', graduation_year = 2027, onboarding_complete = true, visibility = $3, avatar_path = $4 where user_id = $1`,
      [id, F.USERNAME[id]!, F.VISIBILITY[id]!, F.AVATAR[id]!],
    );
    await tx.unsafe(`update public.onboarding_state set step = 6, completed_at = now() where user_id = $1`, [id]);
  }
  await tx.unsafe(`insert into public.posts (id, author_id, university_id, audience, type, body) values ($1, $2, $3, 'university', 'general', $4)`, [F.POST, F.AMNA, F.UNI_A, F.POST_BODY]);
}

/** One step as an actor, in a savepoint: its value, or the SQLSTATE and message it was refused with. */
async function step<T>(tx: Tx, actor: StackActor, sql: string, args: unknown[] = []): Promise<SqlOutcome<T>> {
  return attempt(tx, async (sp) => {
    await actAs(sp, actor);
    const rows = await sp.unsafe(sql, args as never[]);
    await actAs(sp, OWNER);
    return rows as unknown as T;
  });
}
function ok<T>(o: SqlOutcome<T>): T {
  if (!o.ok) throw new Error(`a step the case depends on was refused: ${o.code} ${o.message}`);
  return o.value;
}

/** The bell's notices, as the stack's triggers make them. */
async function makeNotices(tx: Tx): Promise<void> {
  ok(await step(tx, as(F.BILAL), `select public.send_friend_request($1)`, [F.USERNAME[F.AMNA]]));
  const [req] = ok(await step<{ id: string }[]>(tx, OWNER, `select id::text from public.friend_requests where sender_id = $1 and receiver_id = $2`, [F.BILAL, F.AMNA]));
  ok(await step(tx, as(F.AMNA), `select public.respond_friend_request($1, true)`, [req!.id]));
  ok(await step(tx, as(F.CHEN), `select public.add_comment($1, null, $2)`, [F.POST, F.COMMENT_BODY]));
  ok(await step(tx, as(F.DUA), `select public.send_friend_request($1)`, [F.USERNAME[F.AMNA]]));
  await tx.unsafe(F.apartSql("public.notifications"));
}

async function run(name: string, file: string, body: (tx: Tx) => Promise<unknown>): Promise<void> {
  const out = await callCurrentStackSql(DB!, async (tx) => {
    await seed(tx);
    return body(tx);
  });
  if (!out.ok) throw new Error(`case ${name} failed on the stack: ${out.code} ${out.message}`);
  const r = golden(join(DIR, file), name, out.value);
  if (r.status === "differs") expect(r.actual).toEqual(r.expected);
}

describe.skipIf(!DB)("notify goldens on the current stack: the bell", () => {
  it("my_notifications for each reader: friend request and acceptance, a comment and a mention, another university's request (no username or photo)", () =>
    run("notices", "bell.json", async (tx) => {
      await makeNotices(tx);
      const read = (u: string) => step(tx, as(u), `select * from public.my_notifications(null, 50)`);
      const count = (u: string) => step(tx, as(u), `select public.unread_notification_count() as n`);
      return {
        amna: await read(F.AMNA),
        bilal: await read(F.BILAL),
        chen: await read(F.CHEN),
        counts: { amna: await count(F.AMNA), bilal: await count(F.BILAL), chen: await count(F.CHEN) },
        page: await step(tx, as(F.AMNA), `select type from public.my_notifications(now() - interval '150 seconds', 2)`),
      };
    }));

  it("mark_notification_read (own only, unknown refused) and mark_all_notifications_read (how many)", () =>
    run("marking", "bell.json", async (tx) => {
      await makeNotices(tx);
      const [first] = ok(await step<{ id: string }[]>(tx, OWNER, `select id::text from public.notifications where user_id = $1 and type = 'comment_received'`, [F.AMNA]));
      return {
        others: await step(tx, as(F.BILAL), `select public.mark_notification_read($1)`, [first!.id]),
        unknown: await step(tx, as(F.AMNA), `select public.mark_notification_read('99e00000-0000-4000-8000-000000000001')`),
        signedOut: await step(tx, { role: "anon", claims: { role: "anon" } }, `select public.mark_all_notifications_read()`),
        mine: await step(tx, as(F.AMNA), `select public.mark_notification_read($1)`, [first!.id]),
        again: await step(tx, as(F.AMNA), `select public.mark_notification_read($1)`, [first!.id]),
        countAfterOne: await step(tx, as(F.AMNA), `select public.unread_notification_count() as n`),
        all: await step(tx, as(F.AMNA), `select public.mark_all_notifications_read() as n`),
        allAgain: await step(tx, as(F.AMNA), `select public.mark_all_notifications_read() as n`),
        countAfterAll: await step(tx, as(F.AMNA), `select public.unread_notification_count() as n`),
      };
    }));
});

describe.skipIf(!DB)("notify goldens on the current stack: preferences", () => {
  it("my_notification_settings and set_notification_pref: instant only where allowed; unknown categories refused", () =>
    run("prefs", "prefs.json", async (tx) => ({
      before: await step(tx, as(F.AMNA), `select * from public.my_notification_settings()`),
      instantRefused: await step(tx, as(F.AMNA), `select public.set_notification_pref('comments', 'instant_email')`),
      unknown: await step(tx, as(F.AMNA), `select public.set_notification_pref('no_such_thing', 'digest')`),
      off: await step(tx, as(F.AMNA), `select public.set_notification_pref('comments', 'off')`),
      instant: await step(tx, as(F.AMNA), `select public.set_notification_pref('friend_requests', 'digest')`),
      after: await step(tx, as(F.AMNA), `select * from public.my_notification_settings()`),
      other: await step(tx, as(F.BILAL), `select * from public.my_notification_settings()`),
    })));
});

describe.skipIf(!DB)("notify goldens on the current stack: push", () => {
  it("push settings, subscriptions (allowlist, key shapes, re-subscribe) and choices per pushed category", () =>
    run("push", "push.json", async (tx) => ({
      before: await step(tx, as(F.AMNA), `select public.my_push_settings() as s`),
      badEndpoint: await step(tx, as(F.AMNA), `select public.save_push_subscription($1, $2, $3, $4)`, [F.ENDPOINT_BAD, F.P256DH, F.AUTH, F.USER_AGENT]),
      badKeys: await step(tx, as(F.AMNA), `select public.save_push_subscription($1, 'short', $2, $3)`, [F.ENDPOINT, F.AUTH, F.USER_AGENT]),
      saved: await step(tx, as(F.AMNA), `select public.save_push_subscription($1, $2, $3, $4)`, [F.ENDPOINT, F.P256DH, F.AUTH, F.USER_AGENT]),
      again: await step(tx, as(F.AMNA), `select public.save_push_subscription($1, $2, $3, $4)`, [F.ENDPOINT, F.P256DH, F.AUTH, F.USER_AGENT]),
      notPushed: await step(tx, as(F.AMNA), `select public.set_push_pref('comments', true)`),
      off: await step(tx, as(F.AMNA), `select public.set_push_pref('messages', false)`),
      after: await step(tx, as(F.AMNA), `select public.my_push_settings() as s`),
      movedToBilal: await step(tx, as(F.BILAL), `select public.save_push_subscription($1, $2, $3, $4)`, [F.ENDPOINT, F.P256DH, F.AUTH, F.USER_AGENT]),
      amnaAfterMove: await step(tx, as(F.AMNA), `select public.my_push_settings() as s`),
      deleteAll: await step(tx, as(F.BILAL), `select public.delete_push_subscription(null)`),
      bilalAfter: await step(tx, as(F.BILAL), `select public.my_push_settings() as s`),
    })));
});
