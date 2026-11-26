/**
 * content's share.json (recorded in W3, replayed here because share_post is messaging's): the refusals a
 * sharer meets before any chat is touched. Whether the post is visible is content's VisiblePosts answer
 * (false for every post in the recording's refusals; rule 4), so these cases exercise messaging's own checks
 * in their recorded order.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { TestDatabase } from "@skilient/testing/postgres";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sharePost } from "../../src/store/share";
import { AMNA, call, startWorld, UNKNOWN, type Tx } from "./replay";

let pg: TestDatabase;
let sql: postgres.Sql;
beforeAll(async () => ({ pg, sql } = await startWorld()));
afterAll(async () => pg?.stop());

const FILE = join(import.meta.dirname, "../../../../packages/testing/test/golden/content/share.json");

describe("content share.json", () => {
  it("visibility", async () => {
    const out: Record<string, unknown> = {};
    await sql
      .begin(async (tx) => {
        const post = crypto.randomUUID();
        const one = [UNKNOWN];
        const share = (me: string | null, p: string | null, threads: string[] | null, note: string | null, visible: boolean) => (sp: Tx) =>
          sharePost(sp, me, p, threads, note, visible, () => {});
        for (const k of ["other_university_post", "held_post_of_someone_else", "removed_post", "blocked_author", "unknown_post"])
          out[k] = await call(tx, share(AMNA, post, one, null, false));
        out["null_post"] = await call(tx, share(AMNA, null, one, null, false));
        out["no_threads"] = await call(tx, share(AMNA, post, [], null, true));
        out["null_threads"] = await call(tx, share(AMNA, post, null, null, true));
        out["six_threads"] = await call(tx, share(AMNA, post, Array.from({ length: 6 }, () => crypto.randomUUID()), null, true));
        out["note_1001_characters"] = await call(tx, share(AMNA, post, one, "n".repeat(1001), true));
        out["signed_out"] = await call(tx, share(null, post, one, null, true), "share_post");
        throw new Error("rollback");
      })
      .catch((e: unknown) => {
        if (!(e instanceof Error) || e.message !== "rollback") throw e;
      });
    const recorded = (JSON.parse(readFileSync(FILE, "utf8")) as Record<string, unknown>)["visibility"];
    expect(out).toEqual(recorded);
  });
});
