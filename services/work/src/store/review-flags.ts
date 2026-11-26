import { refused } from "../refusals";
import { audit } from "./audit";
import { syncCommitToVentures } from "./contributions";
import type { Db, Tx } from "./db";
import { recomputeUserSkills } from "./skills";

/**
 * Review flags on GitHub evidence (PRD 5.5 anti-gaming), the staff half, ported from _credentials.sql and
 * _github_evidence.sql: the queue, a case, claim/release and the decision. Upholding excludes the held commits;
 * clearing counts them again (unless another open flag still holds them). Every write is audited.
 */
export const reviewFlagQueue = (db: Db, staff: string) =>
  db<{ id: string; user_id: string; kind: string; commits: number; claimed_by: string | null; claimed_by_me: boolean; created_at: Date }[]>`
    select f.id::text, f.user_id::text, f.kind, (select count(*)::int from work.review_flag_commits l where l.flag_id = f.id) as commits,
           f.claimed_by::text, f.claimed_by = ${staff}::uuid as claimed_by_me, f.created_at
      from work.review_flags f where f.status = 'open' order by f.created_at, f.id limit 200`;

export async function reviewFlagCase(db: Db, staff: string, id: number) {
  const [f] = await db<{
    id: string; user_id: string; kind: string; key: string; refs: unknown; status: string; claimed_by: string | null; claimed_by_me: boolean; created_at: Date;
    commits: { repo: string; sha: string; lines: number; occurred_at: string; status: string }[];
  }[]>`
    select f.id::text, f.user_id::text, f.kind, f.key, f.refs, f.status, f.claimed_by::text, f.claimed_by = ${staff}::uuid as claimed_by_me, f.created_at,
           coalesce((select json_agg(json_build_object('repo', g.full_name, 'sha', l.sha, 'lines', c.meaningful_lines, 'occurred_at', c.occurred_at, 'status', c.status)
                              order by c.occurred_at)
                       from work.review_flag_commits l
                       join work.github_commits c on c.user_id = l.user_id and c.repo_id = l.repo_id and c.sha = l.sha
                       join work.github_repos g on g.repo_id = l.repo_id
                      where l.flag_id = f.id), '[]'::json) as commits
      from work.review_flags f where f.id = ${id}`;
  return f ?? null;
}

export async function claimReviewFlag(tx: Tx, staff: string, id: number, claim: boolean): Promise<void> {
  const [f] = await tx<{ status: string; user_id: string; claimed_by: string | null }[]>`
    select status, user_id::text, claimed_by::text from work.review_flags where id = ${id} for update`;
  if (!f || f.status !== "open") throw refused("flag_resolved");
  if (f.user_id === staff) throw refused("flag_own");
  if (claim) {
    if (f.claimed_by !== null && f.claimed_by !== staff) throw refused("flag_claimed_other");
    await tx`update work.review_flags set claimed_by = ${staff}, claimed_at = now() where id = ${id}`;
  } else {
    if (f.claimed_by !== staff) throw refused("flag_not_claimed");
    await tx`update work.review_flags set claimed_by = null, claimed_at = null where id = ${id}`;
  }
  await audit(tx, {
    staffId: staff,
    action: claim ? "review_flag.claim" : "review_flag.release",
    targetType: "review_flag",
    targetId: String(id),
    reason: claim ? "claimed to review" : "released",
    before: { claimed_by: f.claimed_by },
    after: { claimed_by: claim ? staff : null },
  });
}

/** `resolve_review_flag(flag, upheld, note)`: false when the flag is already resolved. */
export async function resolveReviewFlag(tx: Tx, staff: string, id: number, upheld: boolean, note: string): Promise<boolean> {
  if (note.trim().length < 3) throw refused("note_required");
  const [f] = await tx<{ status: string; user_id: string; claimed_by: string | null }[]>`
    select status, user_id::text, claimed_by::text from work.review_flags where id = ${id} for update`;
  if (!f || f.status !== "open") return false;
  if (f.claimed_by !== staff) throw refused("flag_claim_first");
  await tx`
    update work.review_flags set status = ${upheld ? "upheld" : "cleared"}, reviewer_id = ${staff}, note = left(${note}, 2000), resolved_at = now(),
           claimed_by = null, claimed_at = null
     where id = ${id}`;
  if (upheld) {
    await tx`
      update work.github_commits g set status = 'excluded', exclusion = 'review'
        from work.review_flag_commits l
       where l.flag_id = ${id} and g.user_id = l.user_id and g.repo_id = l.repo_id and g.sha = l.sha and g.status in ('held', 'counted')`;
  } else {
    const counted = await tx<{ repo_id: string }[]>`
      update work.github_commits g set status = 'counted'
        from work.review_flag_commits l
       where l.flag_id = ${id} and g.user_id = l.user_id and g.repo_id = l.repo_id and g.sha = l.sha and g.status = 'held'
         and not exists (select 1 from work.review_flag_commits l2 join work.review_flags f2 on f2.id = l2.flag_id and f2.status = 'open'
                          where l2.user_id = g.user_id and l2.repo_id = g.repo_id and l2.sha = g.sha)
      returning g.repo_id::text`;
    // github_commit_contributions: counted again, so the commits reach the linked ventures.
    for (const repo of [...new Set(counted.map((c) => Number(c.repo_id)))].sort((a, b) => a - b)) await syncCommitToVentures(tx, f.user_id, repo);
  }
  await recomputeUserSkills(tx, [f.user_id]);
  await audit(tx, {
    staffId: staff,
    action: upheld ? "review_flag.uphold" : "review_flag.clear",
    targetType: "review_flag",
    targetId: String(id),
    reason: note.trim().slice(0, 2000),
    before: { status: "open" },
    after: { status: upheld ? "upheld" : "cleared" },
  });
  return true;
}
