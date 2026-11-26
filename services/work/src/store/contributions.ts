import { rateLimit, uuidv7 } from "@skilient/platform";
import { refused } from "../refusals";
import { canViewVenture, requireUser, type Db, type Tx } from "./db";
import { refreshVentureShell, teamOf } from "./shell";

/**
 * The contribution log, ported from _contributions.sql and _skill_levels.sql (entry skills, the recompute on
 * confirmation and correction). Insert-only: corrections are new rows. `recompute` is skills' (the L3 rule),
 * passed in so this module doesn't reach into the skills store.
 */
export type Recompute = (tx: Tx, userIds: readonly string[]) => Promise<void>;

/** `require_contributor(venture)`: a member of a venture whose log is open. */
async function requireContributor(tx: Tx, meId: string | null, ventureId: string): Promise<string> {
  const me = await requireUser(tx, meId);
  const [v] = await tx<{ status: string; member: boolean }[]>`
    select status, exists (select 1 from work.venture_members m where m.venture_id = ${ventureId} and m.user_id = ${me.id}) as member
      from work.ventures where id = ${ventureId}`;
  if (!v || !v.member) throw refused("members_only");
  if (v.status === "completed") throw refused("log_locked_completed");
  if (v.status === "abandoned") throw refused("log_locked_abandoned");
  return me.id;
}

/** `entry_skills(venture, skills)`: up to 3 of the venture's own tags, distinct and sorted. */
async function entrySkills(tx: Tx, ventureId: string, skills: readonly string[]): Promise<string[]> {
  const distinct = [...new Set(skills)].sort();
  if (distinct.length > 3) throw refused("tag_max");
  if (distinct.length === 0) return [];
  const [v] = await tx<{ skill_ids: string[] }[]>`select skill_ids from work.ventures where id = ${ventureId}`;
  if (distinct.some((s) => !(v?.skill_ids ?? []).includes(s))) throw refused("tag_venture_skills");
  return distinct;
}

export interface Entry {
  kind: string;
  description: string;
  evidence_url: string | null;
  hours: number | null;
  skill_ids: string[];
}

/** `log_contribution(venture, …)`: 20 a day. */
export async function logContribution(tx: Tx, me: string | null, ventureId: string, e: Entry): Promise<string> {
  const user = await requireContributor(tx, me, ventureId);
  if (!(await rateLimit(tx, `contribution:${user}`, 20, 86_400))) throw refused("rate_limited");
  const id = uuidv7();
  await tx`
    insert into work.contributions (id, venture_id, user_id, kind, description, evidence_url, hours, skill_ids)
    values (${id}, ${ventureId}, ${user}, ${e.kind}, ${e.description.trim()}, ${e.evidence_url?.trim() || null}, ${e.hours}, ${await entrySkills(tx, ventureId, e.skill_ids)})`;
  await refreshVentureShell(tx, await teamOf(tx, ventureId));
  return id;
}

/** `correct_contribution(original, …)`: the author's own manual entry, within 24 hours. */
export async function correctContribution(tx: Tx, meId: string | null, originalId: string, e: Entry, recompute: Recompute): Promise<string> {
  const me = await requireUser(tx, meId);
  const [o] = await tx<{ venture_id: string; user_id: string; source: string; corrects_id: string | null; late: boolean; visible: boolean }[]>`
    select o.venture_id::text, o.user_id::text, o.source, o.corrects_id::text, o.created_at < now() - interval '24 hours' as late,
           ${canViewVenture(tx, me.id)} as visible
      from work.contributions o join work.ventures v on v.id = o.venture_id where o.id = ${originalId}`;
  if (!o || !o.visible) throw refused("contribution_not_found");
  if (o.corrects_id) throw refused("correct_original");
  if (o.user_id !== me.id || o.source !== "manual") throw refused("author_only_correct");
  await requireContributor(tx, me.id, o.venture_id);
  if (o.late) throw refused("correct_window");
  if (!(await rateLimit(tx, `contribution:${me.id}`, 20, 86_400))) throw refused("rate_limited");
  const id = uuidv7();
  await tx`
    insert into work.contributions (id, venture_id, user_id, kind, description, evidence_url, hours, corrects_id, skill_ids)
    values (${id}, ${o.venture_id}, ${me.id}, ${e.kind}, ${e.description.trim()}, ${e.evidence_url?.trim() || null}, ${e.hours}, ${originalId},
            ${await entrySkills(tx, o.venture_id, e.skill_ids)})`;
  // contributions_recompute_corrections: a correction can drop a confirmed skill.
  await recompute(tx, [me.id]);
  await refreshVentureShell(tx, await teamOf(tx, o.venture_id));
  return id;
}

/** `confirm_contribution(entry)`: a teammate confirms the entry's current text. */
export async function confirmContribution(tx: Tx, meId: string | null, entryId: string, recompute: Recompute): Promise<boolean> {
  const me = await requireUser(tx, meId);
  const [o] = await tx<{ venture_id: string; user_id: string; source: string; corrects_id: string | null; before_venture: boolean; visible: boolean }[]>`
    select o.venture_id::text, o.user_id::text, o.source, o.corrects_id::text, o.before_venture, ${canViewVenture(tx, me.id)} as visible
      from work.contributions o join work.ventures v on v.id = o.venture_id where o.id = ${entryId}`;
  if (!o || !o.visible) throw refused("contribution_not_found");
  if (o.corrects_id) throw refused("confirm_original");
  if (o.source === "github" && !o.before_venture) throw refused("github_verified");
  if (o.user_id === me.id) throw refused("confirm_own");
  await requireContributor(tx, me.id, o.venture_id);
  const [cur] = await tx<{ id: string }[]>`
    select c.id::text from work.contributions c where c.id = ${entryId} or c.corrects_id = ${entryId} order by c.created_at desc, (c.id = ${entryId}) limit 1`;
  const r = await tx`insert into work.contribution_confirmations (contribution_id, confirmer_id) values (${cur!.id}, ${me.id}) on conflict do nothing returning 1`;
  // contribution_confirmations_recompute: the author's skills (L3).
  if (r.length) {
    await recompute(tx, [o.user_id]);
    await refreshVentureShell(tx, [me.id]);
  }
  return true;
}

export interface ContributionRow {
  id: string;
  venture_id: string;
  user_id: string;
  current_id: string;
  kind: string;
  description: string;
  evidence_url: string | null;
  hours: string | null;
  source: string;
  commit_sha: string | null;
  created_at: Date;
  corrected_at: Date | null;
  confirmations: number;
  verified: boolean;
  before_venture: boolean;
  skill_ids: string[];
  ai_agent: string | null;
  confirmed_by_me: boolean;
  by_member: boolean;
}

/** `contributions_with_status` for one venture the reader can see: each original with its current text. */
export async function contributions(db: Db, me: string | null, ventureId: string): Promise<ContributionRow[]> {
  return db<ContributionRow[]>`
    select o.id::text, o.venture_id::text, o.user_id::text, e.id::text as current_id, e.kind, e.description, e.evidence_url, e.hours::text,
           o.source, o.commit_sha, o.created_at, case when e.id <> o.id then e.created_at end as corrected_at,
           (select count(*)::int from work.contribution_confirmations k where k.contribution_id = e.id) as confirmations,
           ((o.source = 'github' and not o.before_venture) or exists (select 1 from work.contribution_confirmations k where k.contribution_id = e.id)) as verified,
           o.before_venture, e.skill_ids, o.ai_agent,
           exists (select 1 from work.contribution_confirmations k where k.contribution_id = e.id and k.confirmer_id = ${me}::uuid) as confirmed_by_me,
           exists (select 1 from work.venture_members m where m.venture_id = o.venture_id and m.user_id = o.user_id) as by_member
      from work.contributions o
      join work.ventures v on v.id = o.venture_id
      cross join lateral (select c.* from work.contributions c where c.id = o.id or c.corrects_id = o.id order by c.created_at desc, (c.id = o.id) limit 1) e
     where o.venture_id = ${ventureId} and o.corrects_id is null and ${canViewVenture(db, me)}
     order by o.created_at desc, o.id`;
}

/** The per-venture counts behind the profile's contribution line (getContributionSummary). */
export async function contributionSummary(db: Db, me: string | null, userId: string) {
  return db<{ venture_id: string; entries: number; verified: number }[]>`
    select o.venture_id::text, count(*)::int as entries,
           count(*) filter (where (o.source = 'github' and not o.before_venture)
                              or exists (select 1 from work.contribution_confirmations k
                                          where k.contribution_id = (select c.id from work.contributions c where c.id = o.id or c.corrects_id = o.id
                                                                      order by c.created_at desc, (c.id = o.id) limit 1)))::int as verified
      from work.contributions o join work.ventures v on v.id = o.venture_id
     where o.user_id = ${userId} and o.corrects_id is null and ${canViewVenture(db, me)}
     group by o.venture_id order by o.venture_id`;
}

/**
 * `sync_venture_commits(venture, user)`: a member's counted commits to the venture's linked repository become
 * GitHub entries in its log (up to 6 months before the venture; older ones marked "before Skilient"). Run when a
 * repository is linked, a member joins, and a commit is counted (the three triggers today).
 */
export async function syncVentureCommits(tx: Tx, ventureId: string, userId: string | null = null): Promise<number> {
  const r = await tx`
    insert into work.contributions (id, venture_id, user_id, kind, description, evidence_url, source, commit_sha, before_venture, created_at, ai_agent)
    select gen_random_uuid(), v.id, c.user_id, 'code',
           format('Commit %s to %s (%s meaningful %s)', left(c.sha, 7), v.repo_full_name, c.meaningful_lines, case when c.meaningful_lines = 1 then 'line' else 'lines' end),
           format('https://github.com/%s/commit/%s', v.repo_full_name, c.sha), 'github', c.sha, c.occurred_at < v.created_at, c.occurred_at, c.ai_agent
      from work.ventures v
      join work.github_commits c on c.repo_id = v.repo_id and c.status = 'counted'
      join work.venture_members m on m.venture_id = v.id and m.user_id = c.user_id
     where v.id = ${ventureId} and v.repo_id is not null and v.status in ('recruiting', 'in_progress')
       and c.occurred_at >= v.created_at - interval '6 months'
       and (${userId}::uuid is null or c.user_id = ${userId}::uuid)
    on conflict (venture_id, user_id, commit_sha) where commit_sha is not null do nothing
    returning 1`;
  return r.length;
}

/** `github_commit_contributions`: a newly counted commit reaches every open venture linked to its repository. */
export async function syncCommitToVentures(tx: Tx, userId: string, repoId: number): Promise<void> {
  const ventures = await tx<{ id: string }[]>`
    select v.id::text from work.ventures v join work.venture_members m on m.venture_id = v.id and m.user_id = ${userId}
     where v.repo_id = ${repoId} and v.status in ('recruiting', 'in_progress') order by v.id`;
  for (const v of ventures) await syncVentureCommits(tx, v.id, userId);
}

export { uuidv7 };
