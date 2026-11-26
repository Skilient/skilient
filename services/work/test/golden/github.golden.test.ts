/**
 * Golden replay of github.json (packages/testing/test/work.golden.test.ts, "github"): the connect binding, the
 * discovery, classification, harvest and extraction the harvest job runs, the levels, resync and disconnect.
 * Tokens are sealed with a test key here (Supabase Vault held them before; the snapshots never show them).
 */
import { randomBytes } from "node:crypto";
import type { TestDatabase } from "@skilient/testing/postgres";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, it } from "vitest";
import * as G from "../../src/store/github";
import { recomputeUserSkills } from "../../src/store/skills";
import { ASAD, call, changes, MINA, OMAR, replay, startWorld, type Tx } from "./replay";

let pg: TestDatabase;
let sql: postgres.Sql;
beforeAll(async () => ({ pg, sql } = await startWorld()));
afterAll(async () => pg?.stop());

const USERS = [OMAR, MINA, ASAD, "9b000000-0000-4000-8000-000000000004", "9b000000-0000-4000-8000-000000000005", "9b000000-0000-4000-8000-000000000006"];
const RENAMED_3: Record<string, string> = {
  "public.github_accounts": `select user_id, github_id, login, revoked_at is not null as revoked from work.github_accounts where user_id = any($1) order by 1`,
  "public.github_link_clashes": `select user_id, github_id, github_login, linked_user_id from work.github_link_clashes where user_id = any($1) order by 1`,
  "public.github_user_repos": `select ur.user_id, g.full_name, ur.installation_id, ur.kind, ur.excluded from work.github_user_repos ur join work.github_repos g on g.repo_id = ur.repo_id
      where ur.user_id = any($1) order by 1, 2`,
  "public.github_commits": `select user_id, repo_id, sha, seen_via, files, meaningful_lines, status, exclusion, extracted_at is not null as extracted
       from work.github_commits where user_id = any($1) order by 1, 2, 3`,
  "public.skill_evidence": `select user_id, skill_id, repo_id, sha, detectors, paths, lines from work.skill_evidence where user_id = any($1) order by 1, 2, 4`,
  "public.user_skills": `select user_id, skill_id, level, active_days, lines, hits, repos from work.user_skills where user_id = any($1) order by 1, 2`,
  "public.review_flags": `select user_id, kind, key, status from work.review_flags where user_id = any($1) order by 1, 2, 3`,
  "public.sync_jobs": `select user_id, trigger, status, stage from work.github_sync_jobs where user_id = any($1) order by 1, 2`,
};
async function snapshot3(tx: Tx) {
  const out: Record<string, string[]> = {};
  for (const [table, text] of Object.entries(RENAMED_3)) out[table] = (await tx.unsafe(text, [USERS] as never[])).map((r) => JSON.stringify(r));
  return out;
}
async function step(tx: Tx, run: (sp: Tx) => unknown) {
  const before = await snapshot3(tx);
  const result = await call(tx, run);
  return { result, changes: changes(before, await snapshot3(tx)) };
}

const KEY = randomBytes(32);
const SHA = (n: number) => n.toString(16).padStart(40, "a");
const TOKENS: G.Tokens = { accessToken: "gho_x", accessExpiresAt: new Date(Date.now() + 8 * 3600_000).toISOString(), refreshToken: "ghr_x", refreshExpiresAt: null };
const INSTALL: G.InstallationInput[] = [{ id: 777, account_id: 9001, account_login: "omar-gh", account_type: "User", repository_selection: "selected" }];
const noRecompute = async () => {};

describe("github.json", () => {
  it("pipeline", () =>
    replay(sql, "github", "pipeline", async (tx) => {
      const out: Record<string, unknown> = {};
      out["link"] = await step(tx, (sp) => G.completeLink(sp, KEY, OMAR, { github_id: 9001, login: "omar-gh" }, TOKENS, INSTALL));
      out["clash"] = await step(tx, (sp) => G.completeLink(sp, KEY, MINA, { github_id: 9001, login: "omar-gh" }, TOKENS, []));
      out["other_account"] = await step(tx, (sp) => G.completeLink(sp, KEY, OMAR, { github_id: 9002, login: "omar-two" }, TOKENS, INSTALL));
      await tx`update work.github_sync_jobs set status = 'done' where user_id = ${OMAR}`;
      out["discover"] = await step(tx, async (sp) =>
        (await G.upsertDiscoveredRepos(sp, OMAR, 777, [{ id: 8101, full_name: "omar-gh/app", owner_id: 9001, private: false, fork: false, default_branch: "main", pushed_at: "2026-11-01T00:00:00Z" }])).map(String),
      );
      out["classify"] = await step(tx, (sp) => G.classifyRepo(sp, OMAR, 8101, { owner_id: 9001, fork: false, parent_full_name: null, template_full_name: null }));
      const listed = [0, 1, 2]
        .map((i) => ({ sha: SHA(i), authored_at: `2026-11-0${1 + 2 * i}T10:00:00Z`, committed_at: `2026-11-0${1 + 2 * i}T10:00:00Z`, parents: 1, signed: false }))
        .concat([{ sha: SHA(9), authored_at: "2026-11-02T10:00:00Z", committed_at: "2026-11-02T10:00:00Z", parents: 2, signed: false }]);
      out["harvest"] = await step(tx, (sp) => G.harvestCommits(sp, OMAR, 8101, listed, true));
      const commit = (o: Partial<G.CommitRecord> & { sha: string }): G.CommitRecord => ({
        authored_at: null,
        committed_at: null,
        pushed_at: null,
        seen_via: "harvest",
        signed: false,
        ai_agent: null,
        via_pr: null,
        files: 0,
        meaningful_lines: 0,
        excluded: null,
        detections: [],
        blobs: [],
        ...o,
      });
      for (const i of [0, 1, 2])
        out[`extract_${i}`] = await step(tx, (sp) =>
          G.recordCommit(
            sp,
            OMAR,
            8101,
            commit({
              sha: SHA(i),
              authored_at: `2026-11-0${1 + 2 * i}T10:00:00Z`,
              committed_at: `2026-11-0${1 + 2 * i}T10:00:00Z`,
              files: 1,
              meaningful_lines: 60,
              detections: [{ skill: "python", kind: "lines", path: `m${i}.py`, lines: 60 }],
            }),
          ),
        );
      out["extract_again"] = await call(tx, (sp) => G.recordCommit(sp, OMAR, 8101, commit({ sha: SHA(0) })));
      out["backdated_push"] = await step(tx, (sp) =>
        G.recordCommit(sp, OMAR, 8101, commit({ sha: SHA(5), authored_at: "2026-01-01T00:00:00Z", pushed_at: "2026-11-10T00:00:00Z", seen_via: "push", files: 1, meaningful_lines: 5 })),
      );
      // recompute_user_skills returned the skills found (L1+).
      out["recompute"] = await step(tx, async (sp) => {
        await recomputeUserSkills(sp, [OMAR]);
        return (await sp<{ n: number }[]>`select count(*)::int as n from work.user_skills where user_id = ${OMAR} and level >= 1`)[0]!.n;
      });
      out["resync"] = await step(tx, (sp) => G.requestResync(sp, OMAR));
      out["resync_not_connected"] = await call(tx, (sp) => G.requestResync(sp, ASAD));
      out["disconnect"] = await step(tx, (sp) => G.disconnectGithub(sp, OMAR, recomputeUserSkills));
      out["disconnect_again"] = await call(tx, (sp) => G.disconnectGithub(sp, OMAR, noRecompute));
      return out;
    }));
});
