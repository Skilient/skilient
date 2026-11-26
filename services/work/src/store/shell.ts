import type { NewEvent } from "@skilient/platform";
import type { Tx } from "./db";
import { publish } from "./publish";

/**
 * The shell facts work owns (people's copies, services/people/src/domain/shell.ts): badge counts and milestones
 * published as absolute values whenever a write may change them for a user, so people's nav badges, to-do counts
 * and getting-started checklist need no call to work. As `todo_counts`, `nav_badges` and `getting_started` read:
 *
 * - `ventures.applications`: pending applications to ventures the user owns;
 * - `ventures.invites`: pending venture invites to the user;
 * - `todo.confirm`: teammates' manual entries in the user's open ventures the user hasn't confirmed, by authors
 *   still on the team;
 * - `venture.member` (milestone): a member of any venture;
 * - `contribution.logged` (milestone): has logged a contribution;
 * - `todo.endorse`: completed ventures with teammates where the user has endorsed no one yet;
 * - `endorsement.received` (milestone): an endorsement that is not hidden.
 */
export async function ventureShell(tx: Tx, userIds: readonly (string | null | undefined)[]): Promise<NewEvent[]> {
  const ids = [...new Set(userIds.filter((u): u is string => !!u))];
  if (ids.length === 0) return [];
  const rows = await tx<{ user_id: string; applications: number; invites: number; confirm: number; endorse: number; member: boolean; logged: boolean; endorsed: boolean }[]>`
    select u.user_id::text,
           (select count(*)::int from work.applications t where t.owner_id = u.user_id and t.status = 'pending') as applications,
           (select count(*)::int from work.venture_invites i where i.invitee_id = u.user_id and i.status = 'pending') as invites,
           (select count(*)::int
              from work.contributions o
              join work.ventures v on v.id = o.venture_id and v.status in ('recruiting', 'in_progress')
              cross join lateral (select c.id from work.contributions c where c.id = o.id or c.corrects_id = o.id
                                   order by c.created_at desc, (c.id = o.id) limit 1) cur
             where o.corrects_id is null and o.source = 'manual' and o.user_id <> u.user_id
               and exists (select 1 from work.venture_members m where m.venture_id = o.venture_id and m.user_id = u.user_id)
               and exists (select 1 from work.venture_members a where a.venture_id = o.venture_id and a.user_id = o.user_id)
               and not exists (select 1 from work.contribution_confirmations k where k.contribution_id = cur.id and k.confirmer_id = u.user_id)) as confirm,
           (select count(*)::int from work.ventures v join work.venture_members me on me.venture_id = v.id and me.user_id = u.user_id
             where v.status = 'completed'
               and exists (select 1 from work.venture_members o where o.venture_id = v.id and o.user_id <> u.user_id)
               and not exists (select 1 from work.endorsements e where e.venture_id = v.id and e.endorser_id = u.user_id)) as endorse,
           exists (select 1 from work.endorsements e where e.endorsee_id = u.user_id and not e.hidden) as endorsed,
           exists (select 1 from work.venture_members m where m.user_id = u.user_id) as member,
           exists (select 1 from work.contributions c where c.user_id = u.user_id and c.corrects_id is null) as logged
      from unnest(${ids}::uuid[]) as u(user_id)`;
  return rows.flatMap((r) => [
    count(r.user_id, "ventures.applications", r.applications),
    count(r.user_id, "ventures.invites", r.invites),
    count(r.user_id, "todo.confirm", r.confirm),
    count(r.user_id, "todo.endorse", r.endorse),
    milestone(r.user_id, "endorsement.received", r.endorsed),
    milestone(r.user_id, "venture.member", r.member),
    milestone(r.user_id, "contribution.logged", r.logged),
  ]);
}

export const count = (userId: string, key: string, n: number): NewEvent => ({
  type: "badge.count_changed",
  subjects: [userId],
  payload: { user_id: userId, key, count: n },
});

export const milestone = (userId: string, key: string, reached: boolean): NewEvent => ({
  type: reached ? "milestone.reached" : "milestone.cleared",
  subjects: [userId],
  payload: { user_id: userId, key },
});

/** Publishes the venture shell facts for the given users. */
export async function refreshVentureShell(tx: Tx, userIds: readonly (string | null | undefined)[]): Promise<void> {
  await publish(tx, await ventureShell(tx, userIds));
}

/** Everyone on a venture's team (the users whose to-do count a venture change can move). */
export async function teamOf(tx: Tx, ventureId: string): Promise<string[]> {
  return (await tx<{ user_id: string }[]>`select user_id::text from work.venture_members where venture_id = ${ventureId}`).map((r) => r.user_id);
}
