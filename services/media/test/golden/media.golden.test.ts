/**
 * Replaying the media goldens (packages/testing/test/media.golden.test.ts) against the port. The rules:
 *
 * 1. The same world (packages/testing/test/fixtures/notify-world.ts) and the same file names. An upload is
 *    `createUpload` as the student (the uploader's folder is the token's user; a path in another's folder is the
 *    caller asking for that folder); the Storage API's insert is the store's PUT, which media confirms later.
 * 2. Refusals: the stack's policies refused with 42501 (row-level security); every media refusal of an upload is
 *    compared as that code.
 * 3. Reads: the stack's select on storage.objects as each reader. In media a reader gets a signed link
 *    (`downloadLinks` as web for that user). Public buckets (avatars, post-media) were served to everyone by their
 *    public address, not through that select, so only the owner's read is compared for them.
 * 4. Cleanup: what the stack's triggers queued is the owners' events here (profile.image_replaced, post.removed,
 *    credential.changed), applied by media's own consumer code; the queue is media.deletions.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { normalise } from "@skilient/testing";
import { startPostgres, type TestDatabase } from "@skilient/testing/postgres";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as F from "../../../../packages/testing/test/fixtures/notify-world";
import { applyMediaEvent } from "../../src/consumers";
import { memoryStore } from "../../src/storage/memory";
import * as Files from "../../src/store/files";

const MIGRATIONS = join(import.meta.dirname, "../../migrations");
const DIR = join(import.meta.dirname, "../../../../packages/testing/test/golden/media");
const load = (file: string) => JSON.parse(readFileSync(join(DIR, file), "utf8")) as Record<string, unknown>;
type Tx = postgres.TransactionSql;
const pad = (i: number) => String(i).padStart(2, "0");
const FILE = (i: number) => `99f00000-0000-4000-8000-0000000000${pad(i)}`;

let pg: TestDatabase;
let sql: postgres.Sql;
const store = memoryStore();
beforeAll(async () => {
  pg = await startPostgres();
  sql = await pg.service("media", MIGRATIONS);
});
afterAll(async () => {
  await pg?.stop();
});

async function inTx<T>(body: (tx: Tx) => Promise<T>): Promise<T> {
  let value: T | undefined;
  await sql
    .begin(async (tx) => {
      value = await body(tx);
      throw new Error("rollback");
    })
    .catch((e: Error) => {
      if (e.message !== "rollback") throw e;
    });
  return value as T;
}

/** An upload: the uploader asks for a link into `folder` (rule 1); a refusal is the policies' 42501 (rule 2). */
async function upload(tx: Tx, user: string, bucket: string, path: string) {
  const [folder, file] = path.split("/") as [string, string];
  const mime = file.endsWith(".pdf") ? "application/pdf" : "image/webp";
  try {
    await tx.savepoint((sp) => Files.createUpload(sp, store, user, { bucket, mime, bytes: 1000, folder }));
    return { ok: true };
  } catch {
    return { ok: false, code: "42501" };
  }
}

const OWN_FOLDER = ["avatars", "covers", "post-media", "credentials", "feedback", "society-documents"] as const;

describe("media goldens replayed: uploads", () => {
  it("own_folder", async () => {
    const actual = await inTx(async (tx) => {
      const out: Record<string, unknown> = {};
      let i = 1;
      for (const b of OWN_FOLDER) out[b] = { own: await upload(tx, F.AMNA, b, `${F.AMNA}/${FILE(i++)}.webp`), others: await upload(tx, F.AMNA, b, `${F.BILAL}/${FILE(i++)}.webp`) };
      out["credentials_pdf"] = await upload(tx, F.AMNA, "credentials", `${F.AMNA}/${FILE(i++)}.pdf`);
      out["feedback_pdf"] = await upload(tx, F.AMNA, "feedback", `${F.AMNA}/${FILE(i++)}.pdf`);
      return out;
    });
    expect(normalise(actual)).toEqual(load("uploads.json")["own_folder"]);
  });

  it("caps", async () => {
    const actual = await inTx(async (tx) => {
      const docs = [];
      for (let i = 1; i <= 6; i++) docs.push(await upload(tx, F.CHEN, "society-documents", `${F.CHEN}/${FILE(40 + i)}.pdf`));
      const feedback = [];
      for (let i = 1; i <= 31; i++) feedback.push(await upload(tx, F.CHEN, "feedback", `${F.CHEN}/x.webp`));
      return { society_documents: docs, feedback_last_two: feedback.slice(29) };
    });
    expect(normalise(actual)).toEqual(load("uploads.json")["caps"]);
  });
});

describe("media goldens replayed: reads", () => {
  it("reads", async () => {
    const recorded = load("reads.json")["reads"] as Record<string, { owner: number; other: number }>;
    const actual = await inTx(async (tx) => {
      const out: Record<string, { owner: number; other?: number }> = {};
      let i = 60;
      for (const b of ["credentials", "feedback", "cv-exports", "chat-media", "post-media", "avatars"]) {
        const path = `${F.AMNA}/${FILE(i++)}.${b === "cv-exports" ? "pdf" : "webp"}`;
        await Files.putFile(tx, store, { bucket: b, path, owner: F.AMNA, mime: b === "cv-exports" ? "application/pdf" : "image/webp", data: new Uint8Array([1, 2, 3]) });
        const seen = async (u: string) => (await Files.downloadLinks(tx, store, b, [path], { user: u }, 600)).length;
        out[b] = b === "post-media" || b === "avatars" ? { owner: await seen(F.AMNA) } : { owner: await seen(F.AMNA), other: await seen(F.BILAL) };
      }
      return out;
    });
    const expected = Object.fromEntries(Object.entries(recorded).map(([b, v]) => [b, b === "post-media" || b === "avatars" ? { owner: v.owner } : v]));
    expect(actual).toEqual(expected);
  });
});

describe("media goldens replayed: cleanup", () => {
  it("triggers", async () => {
    const ev = (type: string, producer: string, payload: Record<string, unknown>) => ({ type, producer, payload, version: 1, subjects: [] });
    const queued = async (tx: Tx) => (await tx<{ bucket: string; path: string }[]>`select bucket, path from media.deletions order by id`).map((r) => ({ message: r }));
    const actual = await inTx(async (tx) => {
      await applyMediaEvent(tx, ev("profile.image_replaced", "svc_people", { user_id: F.AMNA, kind: "avatar", old_path: `${F.AMNA}/${FILE(80)}.webp` }));
      const afterAvatar = await queued(tx);
      await applyMediaEvent(tx, ev("post.removed", "svc_content", { post_id: F.POST, author_id: F.AMNA, reason: "deleted", media_paths: [`${F.AMNA}/${FILE(82)}.webp`] }));
      const afterPost = await queued(tx);
      await applyMediaEvent(tx, ev("credential.changed", "svc_work", { credential_id: F.POST, user_id: F.AMNA, status: "deleted", file_path: `${F.AMNA}/${FILE(83)}.pdf` }));
      return { afterAvatar, afterPost, afterCredential: await queued(tx) };
    });
    expect(normalise(actual)).toEqual(load("cleanup.json")["triggers"]);
  });
});
