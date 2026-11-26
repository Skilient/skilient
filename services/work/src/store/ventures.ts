import { rateLimit, uuidv7 } from "@skilient/platform";
import { refused, type RefusalReason } from "../refusals";
import { blockedBetween, requireUser, validSkillIds, type Me, type Tx } from "./db";
import { memberChanged, publish, ventureCompleted, ventureRow, ventureUpdated, type VentureRow } from "./publish";
import { refreshVentureShell, teamOf } from "./shell";
import { syncVentureCommits } from "./contributions";

/**
 * Venture commands, ported from _ventures.sql, _contributions.sql (completion checks), _ranking.sql (the frozen
 * completion) and _student_portal.sql (the graduate guard). Each runs inside the caller's write transaction.
 */
export const MAX_MEMBERS = 6;

export interface VentureFull extends VentureRow {
  title: string;
  type: string;
  skill_ids: string[];
  repo_id: string | null;
  created_at: string;
  completed_at: string | null;
}

/** `lock_owned_venture(venture)`: the row, locked; refuses anyone but the owner. */
export async function lockOwnedVenture(tx: Tx, me: string | null, ventureId: string): Promise<VentureFull> {
  const [v] = await tx<VentureFull[]>`
    select id::text, owner_id::text, university_id::text, status, visibility, title, type, skill_ids, repo_id::text,
           created_at::text, completed_at::text
      from work.ventures where id = ${ventureId} for update`;
  if (!v) throw refused("venture_not_found");
  if (v.owner_id !== me) throw refused("owner_only");
  return v;
}

/** `require_open(v)`. */
export function requireOpen(v: { status: string }): void {
  if (v.status === "completed") throw refused("venture_completed");
  if (v.status === "abandoned") throw refused("venture_abandoned");
}

/**
 * The guards on venture_members (venture_members_guard, graduate_venture_guard): the venture row is locked and
 * the count re-read, so a 7th member can't join under parallel accepts; a completed venture's team is locked;
 * a graduate can't join a university-only venture.
 */
export async function guardTeamChange(tx: Tx, ventureId: string, adding: string | null): Promise<void> {
  const [v] = await tx<{ status: string; visibility: string }[]>`select status, visibility from work.ventures where id = ${ventureId} for update`;
  if (!v) return;
  // Trigger order today: venture_members_graduate_guard, then venture_members_guard.
  if (adding) await graduateGuard(tx, v.visibility, adding);
  if (v.status === "completed") throw refused("team_locked");
  if (adding) {
    const [n] = await tx<{ n: number }[]>`select count(*)::int as n from work.venture_members where venture_id = ${ventureId}`;
    if (n!.n >= MAX_MEMBERS) throw refused("team_max");
  }
}

/** `graduate_venture_guard`: graduates can't join university-only ventures (people's status, by copy). */
export async function graduateGuard(tx: Tx, visibility: string, userId: string): Promise<void> {
  if (visibility !== "university") return;
  const [g] = await tx`select 1 from work.members where user_id = ${userId} and status = 'graduate'`;
  if (g) throw refused("graduate_university_only");
}

/** `add_venture_member(venture, user, role)`: fills the role's slot when one is named. */
export async function addVentureMember(tx: Tx, ventureId: string, userId: string, roleId: string | null, actorId: string | null): Promise<void> {
  const [already] = await tx`select 1 from work.venture_members where venture_id = ${ventureId} and user_id = ${userId}`;
  if (already) throw refused("already_member");
  if (roleId) {
    const [role] = await tx<{ filled: number; slots: number }[]>`
      select filled, slots from work.venture_roles where id = ${roleId} and venture_id = ${ventureId} for update`;
    if (role) {
      if (role.filled >= role.slots) throw refused("role_filled");
      await tx`update work.venture_roles set filled = filled + 1 where id = ${roleId}`;
    }
  }
  await guardTeamChange(tx, ventureId, userId);
  await tx`insert into work.venture_members (venture_id, user_id, team_role) values (${ventureId}, ${userId}, 'other')`;
  await publish(tx, [memberChanged(ventureId, userId, true, actorId)]);
  // venture_member_commits: the new member's counted commits to the linked repository.
  await syncVentureCommits(tx, ventureId, userId);
  await refreshVentureShell(tx, await teamOf(tx, ventureId));
}

/** Removes a member (leave or removal), with the team guard and the event. */
export async function deleteMember(tx: Tx, ventureId: string, userId: string, actorId: string | null): Promise<boolean> {
  await guardTeamChange(tx, ventureId, null);
  const gone = await tx`delete from work.venture_members where venture_id = ${ventureId} and user_id = ${userId} returning 1`;
  if (gone.length) {
    await publish(tx, [memberChanged(ventureId, userId, false, actorId)]);
    await refreshVentureShell(tx, [userId, ...(await teamOf(tx, ventureId))]);
  }
  return gone.length > 0;
}

export interface NewVenture {
  type: string;
  title: string;
  description: string;
  visibility: string;
  stage: string | null;
  pitch_url: string | null;
  affiliation: string | null;
  skill_ids: string[];
  team_size: number;
  roles: { title: string; skill_ids: string[]; slots: number }[];
  questions: string[];
}

/** `create_venture(p)`. The creator is the owner and lead. */
export async function createVenture(tx: Tx, meId: string | null, p: NewVenture): Promise<string> {
  const me = await requireUser(tx, meId);
  if (!(await rateLimit(tx, `venture_create:${me.id}`, 5, 86_400))) throw refused("rate_limited");
  if (!me.university_id) throw refused("finish_onboarding");
  if (p.roles.length > 6 || p.questions.length > 3) throw refused("too_many_roles_or_questions");
  const id = uuidv7();
  await tx`
    insert into work.ventures (id, type, owner_id, university_id, title, description, visibility, stage, pitch_url, affiliation, skill_ids, team_size)
    values (${id}, ${p.type}, ${me.id}, ${me.university_id}, ${p.title.trim()}, ${p.description}, ${p.visibility}, ${p.stage}, ${p.pitch_url},
            ${p.affiliation}, ${await validSkillIds(tx, p.skill_ids)}, ${p.team_size})`;
  await tx`insert into work.venture_members (venture_id, user_id, team_role) values (${id}, ${me.id}, 'lead')`;
  for (const r of p.roles)
    await tx`insert into work.venture_roles (id, venture_id, title, skill_ids, slots) values (${uuidv7()}, ${id}, ${r.title.trim()}, ${await validSkillIds(tx, r.skill_ids)}, ${r.slots})`;
  for (const [i, q] of p.questions.entries()) await tx`insert into work.venture_questions (venture_id, position, body) values (${id}, ${i + 1}, ${q.trim()})`;
  await publish(tx, [ventureUpdated((await ventureRow(tx, id))!, { actor_id: me.id }), memberChanged(id, me.id, true, me.id)]);
  await refreshVentureShell(tx, [me.id]);
  return id;
}

export interface VentureEdit {
  title?: string;
  description?: string;
  visibility?: string;
  stage?: string | null;
  pitch_url?: string | null;
  affiliation?: string | null;
  skill_ids?: string[];
  team_size?: number;
}

/** `update_venture(venture, p)`: only the fields present change. */
export async function updateVenture(tx: Tx, me: string | null, ventureId: string, p: VentureEdit): Promise<void> {
  const v = await lockOwnedVenture(tx, me, ventureId);
  requireOpen(v);
  const skills = p.skill_ids === undefined ? null : await validSkillIds(tx, p.skill_ids);
  await tx`
    update work.ventures
       set title = coalesce(${p.title?.trim() ?? null}, title),
           description = coalesce(${p.description ?? null}, description),
           visibility = coalesce(${p.visibility ?? null}, visibility),
           stage = case when ${p.stage !== undefined} then ${p.stage ?? null} else stage end,
           pitch_url = case when ${p.pitch_url !== undefined} then ${p.pitch_url ?? null} else pitch_url end,
           affiliation = case when ${p.affiliation !== undefined} then ${p.affiliation ?? null} else affiliation end,
           skill_ids = case when ${skills !== null} then ${skills ?? []}::text[] else skill_ids end,
           team_size = coalesce(${p.team_size ?? null}::smallint, team_size),
           updated_at = now()
     where id = ${ventureId}`;
  await publish(tx, [ventureUpdated((await ventureRow(tx, ventureId))!, { actor_id: me })]);
}

/** `verified_contributors(venture)`: members with a verified entry (an in-venture commit or a confirmed current text). */
export async function verifiedContributors(tx: Tx, ventureId: string): Promise<number> {
  const [r] = await tx<{ n: number }[]>`
    select count(distinct o.user_id)::int as n
      from work.contributions o
      join work.venture_members m on m.venture_id = o.venture_id and m.user_id = o.user_id
     where o.venture_id = ${ventureId} and o.corrects_id is null
       and ((o.source = 'github' and not o.before_venture)
            or exists (select 1 from work.contribution_confirmations k
                        where k.contribution_id = (select c.id from work.contributions c where c.id = o.id or c.corrects_id = o.id
                                                    order by c.created_at desc, (c.id = o.id) limit 1)))`;
  return r!.n;
}

const TRANSITIONS: Record<string, string[]> = { recruiting: ["in_progress", "abandoned"], in_progress: ["completed", "abandoned"] };

/** Today's wording names both statuses ("a completed venture can't become abandoned"): one reason per pair. */
const transitionRefusal = (from: string, to: string) => `transition_${from}_${to}` as RefusalReason;

/** `transition_venture(venture, to)`, with the completion record (`record_venture_completion`) on completing. */
export async function transitionVenture(tx: Tx, me: string | null, ventureId: string, to: string): Promise<void> {
  const v = await lockOwnedVenture(tx, me, ventureId);
  if (!(TRANSITIONS[v.status] ?? []).includes(to)) throw refused(transitionRefusal(v.status, to));
  if (to === "completed") {
    const [n] = await tx<{ members: number; deliverables: number }[]>`
      select (select count(*)::int from work.venture_members where venture_id = ${ventureId}) as members,
             (select count(*)::int from work.venture_deliverables where venture_id = ${ventureId}) as deliverables`;
    if (n!.members < 2) throw refused("complete_needs_members");
    if (n!.deliverables === 0) throw refused("complete_needs_deliverable");
    if ((await verifiedContributors(tx, ventureId)) < 2) throw refused("complete_needs_verified");
  }
  await tx`
    update work.ventures
       set status = ${to},
           completed_at = case when ${to} = 'completed' then now() else completed_at end,
           abandoned_at = case when ${to} = 'abandoned' then now() else abandoned_at end,
           updated_at = now()
     where id = ${ventureId}`;
  const closing: { id: string; candidate_id: string; owner_id: string }[] = [];
  const invitees: string[] = [];
  if (to === "completed" || to === "abandoned") {
    closing.push(
      ...(await tx<{ id: string; candidate_id: string; owner_id: string }[]>`
        update work.applications set status = 'closed', decided_at = now()
         where venture_id = ${ventureId} and status = 'pending' returning id::text, candidate_id::text, owner_id::text`),
    );
    invitees.push(
      ...(await tx<{ invitee_id: string }[]>`
        update work.venture_invites set status = 'revoked', responded_at = now() where venture_id = ${ventureId} and status = 'pending'
        returning invitee_id::text`).map((i) => i.invitee_id),
    );
  }
  const after = (await ventureRow(tx, ventureId))!;
  const events = [
    ventureUpdated(after, { previous_status: v.status, actor_id: me }),
    ...closing.map((a) => ({
      type: "application.changed",
      subjects: [a.id, a.candidate_id, a.owner_id],
      payload: { application_id: a.id, venture_id: ventureId, candidate_id: a.candidate_id, owner_id: a.owner_id, status: "closed", previous_status: "pending" },
    })),
  ];
  if (to === "completed") {
    await recordCompletion(tx, ventureId);
    const members = await tx<{ user_id: string }[]>`select user_id::text from work.venture_members where venture_id = ${ventureId} order by joined_at`;
    events.push(ventureCompleted(after, members.map((m) => m.user_id)));
  }
  await publish(tx, events);
  await refreshVentureShell(tx, [after.owner_id, ...invitees, ...(await teamOf(tx, ventureId))]);
}

/** `record_venture_completion(venture)`: the inputs ranking and the Record read, frozen at completion. */
export async function recordCompletion(tx: Tx, ventureId: string, backfilled = false): Promise<void> {
  const inserted = await tx`
    insert into work.venture_completions (venture_id, owner_id, completed_at, team_size, weeks, skill_tags, deliverables, verified_members, backfilled)
    select v.id, v.owner_id, v.completed_at,
           (select count(*) from work.venture_members m where m.venture_id = v.id),
           round(greatest(extract(epoch from (v.completed_at - v.created_at)), 0) / 604800.0, 2),
           cardinality(v.skill_ids),
           (select count(*) from work.venture_deliverables d where d.venture_id = v.id),
           ${await verifiedContributors(tx, ventureId)},
           ${backfilled}
      from work.ventures v where v.id = ${ventureId} and v.status = 'completed'
    on conflict (venture_id) do nothing returning 1`;
  if (!inserted.length) return;
  await tx`
    insert into work.venture_completion_members (venture_id, user_id, github_days, verified_entries, unconfirmed_entries)
    select ${ventureId}, m.user_id,
           count(distinct (o.created_at at time zone 'Asia/Karachi')::date) filter (where o.source = 'github' and o.verified),
           count(*) filter (where o.source = 'manual' and o.verified),
           count(*) filter (where o.id is not null and not o.verified)
      from work.venture_members m
      left join lateral (
        select x.id, x.source, x.created_at,
               ((x.source = 'github' and not x.before_venture)
                 or exists (select 1 from work.contribution_confirmations k where k.contribution_id = cur.id)) as verified
          from work.contributions x
          cross join lateral (select c.id from work.contributions c where c.id = x.id or c.corrects_id = x.id
                               order by c.created_at desc, (c.id = x.id) limit 1) cur
         where x.venture_id = ${ventureId} and x.user_id = m.user_id and x.corrects_id is null
      ) o on true
     where m.venture_id = ${ventureId}
     group by m.user_id`;
}

/** `leave_venture(venture)`. */
export async function leaveVenture(tx: Tx, me: string | null, ventureId: string): Promise<void> {
  const [v] = await tx<{ owner_id: string }[]>`select owner_id::text from work.ventures where id = ${ventureId} for update`;
  const [mine] = me ? await tx`select 1 from work.venture_members where venture_id = ${ventureId} and user_id = ${me}` : [];
  if (!v || !mine) throw refused("not_a_member");
  if (v.owner_id === me) throw refused("transfer_first");
  await deleteMember(tx, ventureId, me!, me);
}

/** `remove_venture_member(venture, member)`. */
export async function removeVentureMember(tx: Tx, me: string | null, ventureId: string, memberId: string): Promise<void> {
  const v = await lockOwnedVenture(tx, me, ventureId);
  requireOpen(v);
  if (memberId === v.owner_id) throw refused("owner_not_removable");
  if (!(await deleteMember(tx, ventureId, memberId, me))) throw refused("not_a_member");
}

/** `set_member_role(venture, member, role)`. */
export async function setMemberRole(tx: Tx, me: string | null, ventureId: string, memberId: string, role: string): Promise<void> {
  requireOpen(await lockOwnedVenture(tx, me, ventureId));
  const r = await tx`update work.venture_members set team_role = ${role} where venture_id = ${ventureId} and user_id = ${memberId} returning 1`;
  if (!r.length) throw refused("not_a_member");
}

/** `transfer_venture_ownership(venture, member)`: pending applications follow the new owner. */
export async function transferOwnership(tx: Tx, me: string | null, ventureId: string, memberId: string): Promise<void> {
  const v = await lockOwnedVenture(tx, me, ventureId);
  requireOpen(v);
  const [m] = await tx`select 1 from work.venture_members where venture_id = ${ventureId} and user_id = ${memberId}`;
  if (memberId === v.owner_id || !m) throw refused("new_owner_member");
  await tx`update work.ventures set owner_id = ${memberId}, updated_at = now() where id = ${ventureId}`;
  await tx`update work.applications set owner_id = ${memberId} where venture_id = ${ventureId} and status = 'pending'`;
  await publish(tx, [ventureUpdated((await ventureRow(tx, ventureId))!, { previous_owner_id: v.owner_id, actor_id: me })]);
  await refreshVentureShell(tx, [v.owner_id, memberId]);
}

/** `save_venture_role(venture, role, …)`: adds (role empty) or edits a role; at most 6. */
export async function saveVentureRole(tx: Tx, me: string | null, ventureId: string, roleId: string | null, title: string, skills: string[], slots: number): Promise<string> {
  requireOpen(await lockOwnedVenture(tx, me, ventureId));
  if (!roleId) {
    const [n] = await tx<{ n: number }[]>`select count(*)::int as n from work.venture_roles where venture_id = ${ventureId}`;
    if (n!.n >= 6) throw refused("max_roles");
    const id = uuidv7();
    await tx`insert into work.venture_roles (id, venture_id, title, skill_ids, slots) values (${id}, ${ventureId}, ${title.trim()}, ${await validSkillIds(tx, skills)}, ${slots})`;
    return id;
  }
  const r = await tx<{ id: string }[]>`
    update work.venture_roles set title = ${title.trim()}, skill_ids = ${await validSkillIds(tx, skills)}, slots = ${slots}
     where id = ${roleId} and venture_id = ${ventureId} returning id::text`;
  if (!r.length) throw refused("role_not_found");
  return r[0]!.id;
}

/** `delete_venture_role(venture, role)`. */
export async function deleteVentureRole(tx: Tx, me: string | null, ventureId: string, roleId: string): Promise<void> {
  requireOpen(await lockOwnedVenture(tx, me, ventureId));
  await tx`delete from work.venture_roles where id = ${roleId} and venture_id = ${ventureId}`;
}

/** `set_venture_questions(venture, questions)`: replaces them; at most 3. */
export async function setVentureQuestions(tx: Tx, me: string | null, ventureId: string, questions: string[]): Promise<void> {
  requireOpen(await lockOwnedVenture(tx, me, ventureId));
  if (questions.length > 3) throw refused("max_questions");
  await tx`delete from work.venture_questions where venture_id = ${ventureId}`;
  for (const [i, q] of questions.entries()) await tx`insert into work.venture_questions (venture_id, position, body) values (${ventureId}, ${i + 1}, ${q.trim()})`;
}

/**
 * `link_venture_repo(venture, repo)`: one of the owner's shared repositories (0 unlinks); the members' counted
 * commits to it join the log (venture_repo_commits).
 */
export async function linkVentureRepo(tx: Tx, me: string | null, ventureId: string, repoId: number): Promise<void> {
  const v = await lockOwnedVenture(tx, me, ventureId);
  requireOpen(v);
  if (!repoId) {
    await tx`update work.ventures set repo_id = null, repo_full_name = null, updated_at = now() where id = ${ventureId}`;
    return;
  }
  const [r] = await tx<{ full_name: string }[]>`
    select g.full_name from work.github_user_repos ur join work.github_repos g on g.repo_id = ur.repo_id
     where ur.user_id = ${v.owner_id} and ur.repo_id = ${repoId} and not ur.excluded`;
  if (!r) throw refused("share_repo_first");
  const changed = await tx`
    update work.ventures set repo_id = ${repoId}, repo_full_name = ${r.full_name}, updated_at = now()
     where id = ${ventureId} and repo_id is distinct from ${repoId} returning 1`;
  if (changed.length) await syncVentureCommits(tx, ventureId);
}

/** `add_venture_deliverable(venture, label, url)`: members only; at most 20. */
export async function addDeliverable(tx: Tx, me: string | null, ventureId: string, label: string, url: string): Promise<string> {
  const [v] = await tx<{ status: string }[]>`select status from work.ventures where id = ${ventureId}`;
  const [m] = me ? await tx`select 1 from work.venture_members where venture_id = ${ventureId} and user_id = ${me}` : [];
  if (!v || !m) throw refused("members_only");
  requireOpen(v);
  const [n] = await tx<{ n: number }[]>`select count(*)::int as n from work.venture_deliverables where venture_id = ${ventureId}`;
  if (n!.n >= 20) throw refused("max_deliverables");
  const id = uuidv7();
  await tx`insert into work.venture_deliverables (id, venture_id, label, url, added_by) values (${id}, ${ventureId}, ${label.trim()}, ${url.trim()}, ${me})`;
  return id;
}

/** `remove_venture_deliverable(deliverable)`: the owner or who added it. */
export async function removeDeliverable(tx: Tx, me: string | null, deliverableId: string): Promise<boolean> {
  const [d] = await tx<{ added_by: string | null; owner_id: string; status: string }[]>`
    select d.added_by::text, v.owner_id::text, v.status from work.venture_deliverables d join work.ventures v on v.id = d.venture_id where d.id = ${deliverableId}`;
  if (!d) return false;
  if (!(d.owner_id === me || (d.added_by !== null && d.added_by === me))) throw refused("deliverable_owner");
  requireOpen(d);
  await tx`delete from work.venture_deliverables where id = ${deliverableId}`;
  return true;
}

export { blockedBetween, type Me };
