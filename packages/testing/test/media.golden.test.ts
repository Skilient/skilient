/**
 * Media golden recordings (W9). Records what the current stack (local Supabase Storage's policies, buckets and
 * cleanup triggers) does with files, so the media service can be held to the same rules. The sheet is
 * docs/azure/media-function-bins.md; the world is test/fixtures/notify-world.ts (its students).
 *
 *   GOLDEN_STACK_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres GOLDEN_RECORD=1 pnpm exec vitest run test/media.golden.test.ts
 *
 * Without GOLDEN_RECORD it compares the stack with the files. Without GOLDEN_STACK_DB_URL the file is skipped. Every
 * case runs in its own transaction that is rolled back. Uploads are inserts into storage.objects as the signed-in
 * student (what the Storage API does after its own checks); reads are selects as each reader; the cleanup queue is
 * read back from pgmq inside the transaction. Every step that depends on an earlier one checks it worked (`ok`).
 */
import { join } from "node:path";
import type postgres from "postgres";
import { describe, expect, it } from "vitest";
import { actAs, assertLocalStack, attempt, callCurrentStackSql, golden, type SqlOutcome, type StackActor } from "../src/golden";
import * as F from "./fixtures/notify-world";

const DB = process.env["GOLDEN_STACK_DB_URL"];
if (DB !== undefined) assertLocalStack(DB);
const DIR = join(import.meta.dirname, "golden", "media");

type Tx = postgres.TransactionSql;
const OWNER: StackActor = { role: "postgres" };
const as = (user: string): StackActor => ({ role: "authenticated", claims: { sub: user, role: "authenticated", aal: "aal1", email: F.EMAIL[user] } });
const pad = (i: number) => String(i).padStart(2, "0");
const FILE = (i: number) => `99f00000-0000-4000-8000-0000000000${pad(i)}`;

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
    await tx.unsafe(`update public.profiles set username = $2, onboarding_complete = true where user_id = $1`, [id, F.USERNAME[id]!]);
  }
}

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
/** An upload as the Storage API makes it once its own checks pass: a row in storage.objects as the uploader. */
const upload = (tx: Tx, user: string, bucket: string, name: string) =>
  step(tx, as(user), `insert into storage.objects (bucket_id, name, owner, owner_id) values ($1, $2, $3::uuid, $3) returning bucket_id`, [bucket, name, user]);
/** Only whether it was allowed (and the SQLSTATE when not): the row itself is the store's. */
const outcome = (o: SqlOutcome<unknown>) => (o.ok ? { ok: true } : { ok: false, code: o.code });
const queued = (tx: Tx) => tx.unsafe(`select message from pgmq.q_storage_cleanup order by msg_id`) as unknown as Promise<{ message: unknown }[]>;

async function run(name: string, file: string, body: (tx: Tx) => Promise<unknown>): Promise<void> {
  const out = await callCurrentStackSql(DB!, async (tx) => {
    await seed(tx);
    // Only this case's cleanup messages: whatever the local queue already held stays out of the recording.
    await tx.unsafe(`delete from pgmq.q_storage_cleanup`);
    return body(tx);
  });
  if (!out.ok) throw new Error(`case ${name} failed on the stack: ${out.code} ${out.message}`);
  const r = golden(join(DIR, file), name, out.value);
  if (r.status === "differs") expect(r.actual).toEqual(r.expected);
}

/** The buckets whose upload rule is the uploader's own folder (and nothing that needs another service's rows). */
const OWN_FOLDER = ["avatars", "covers", "post-media", "credentials", "feedback", "society-documents"] as const;

describe.skipIf(!DB)("media goldens on the current stack: uploads", () => {
  it("each people-owned bucket: the uploader's own folder is accepted, another's refused; a wrong type refused where the policy checks it", () =>
    run("own_folder", "uploads.json", async (tx) => {
      const out: Record<string, unknown> = {};
      let i = 1;
      for (const b of OWN_FOLDER) {
        out[b] = {
          own: outcome(await upload(tx, F.AMNA, b, `${F.AMNA}/${FILE(i++)}.webp`)),
          others: outcome(await upload(tx, F.AMNA, b, `${F.BILAL}/${FILE(i++)}.webp`)),
        };
      }
      out["credentials_pdf"] = outcome(await upload(tx, F.AMNA, "credentials", `${F.AMNA}/${FILE(i++)}.pdf`));
      out["feedback_pdf"] = outcome(await upload(tx, F.AMNA, "feedback", `${F.AMNA}/${FILE(i++)}.pdf`));
      return out;
    }));

  it("per-folder caps: society documents stop at 5 per uploader, feedback at 30", () =>
    run("caps", "uploads.json", async (tx) => {
      const docs = [];
      for (let i = 1; i <= 6; i++) docs.push(outcome(await upload(tx, F.CHEN, "society-documents", `${F.CHEN}/${FILE(40 + i)}.pdf`)));
      const feedback = [];
      for (let i = 1; i <= 31; i++) feedback.push(outcome(await upload(tx, F.CHEN, "feedback", `${F.CHEN}/99f10000-0000-4000-8000-0000000000${pad(i)}.webp`)));
      return { society_documents: docs, feedback_last_two: feedback.slice(29) };
    }));
});

describe.skipIf(!DB)("media goldens on the current stack: reads", () => {
  it("private buckets: the owner reads their file, another student doesn't; public buckets' own-folder reads", () =>
    run("reads", "reads.json", async (tx) => {
      const out: Record<string, unknown> = {};
      let i = 60;
      for (const b of ["credentials", "feedback", "cv-exports", "chat-media", "post-media", "avatars"]) {
        const name = `${F.AMNA}/${FILE(i++)}.${b === "cv-exports" ? "pdf" : "webp"}`;
        await tx.unsafe(`insert into storage.objects (bucket_id, name, owner, owner_id) values ($1, $2, $3::uuid, $3)`, [b, name, F.AMNA]);
        const seen = async (u: string) => ok(await step<{ n: number }[]>(tx, as(u), `select count(*)::int as n from storage.objects where bucket_id = $1 and name = $2`, [b, name]))[0]!.n;
        out[b] = { owner: await seen(F.AMNA), other: await seen(F.BILAL) };
      }
      return out;
    }));
});

describe.skipIf(!DB)("media goldens on the current stack: cleanup", () => {
  it("the cleanup triggers queue the files their rows stop using: a replaced photo, a deleted post's images, a deleted credential", () =>
    run("triggers", "cleanup.json", async (tx) => {
      const avatar1 = `${F.AMNA}/${FILE(80)}.webp`;
      const avatar2 = `${F.AMNA}/${FILE(81)}.webp`;
      await tx.unsafe(`update public.profiles set avatar_path = $2 where user_id = $1`, [F.AMNA, avatar1]);
      await tx.unsafe(`update public.profiles set avatar_path = $2 where user_id = $1`, [F.AMNA, avatar2]);
      const afterAvatar = await queued(tx);
      const image = `${F.AMNA}/${FILE(82)}.webp`;
      await tx.unsafe(`insert into public.posts (id, author_id, university_id, audience, type, body) values ($1, $2, $3, 'university', 'general', $4)`, [F.POST, F.AMNA, F.UNI_A, F.POST_BODY]);
      await tx.unsafe(`insert into public.post_media (post_id, position, path, width, height) values ($1, 1, $2, 800, 600)`, [F.POST, image]);
      await tx.unsafe(`delete from public.posts where id = $1`, [F.POST]);
      const afterPost = await queued(tx);
      const cred = `${F.AMNA}/${FILE(83)}.pdf`;
      await tx.unsafe(
        `insert into public.credentials (id, user_id, title, issuer, issued_on, file_path, file_type, file_bytes) values ('99f20000-0000-4000-8000-000000000001', $1, 'Plover Survey Certificate', 'Golden Board', current_date - 30, $2, 'pdf', 1000)`,
        [F.AMNA, cred],
      );
      await tx.unsafe(`delete from public.credentials where id = '99f20000-0000-4000-8000-000000000001'`);
      return { afterAvatar, afterPost, afterCredential: await queued(tx) };
    }));
});
