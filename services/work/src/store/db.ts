import type postgres from "postgres";
import { refused } from "../refusals";

export type Tx = postgres.TransactionSql;
export type Db = postgres.Sql | Tx;
export type Fragment = postgres.PendingQuery<postgres.Row[]>;

/** `is_blocked_with(other)` for the reader, on a user id column ("alias.column"). */
export function blockedWith(db: Db, me: string | null, column: string): Fragment {
  const other = db(column);
  return db`exists (select 1 from work.blocks b where (b.blocker_id = ${me}::uuid and b.blocked_id = ${other})
                                            or (b.blocker_id = ${other} and b.blocked_id = ${me}::uuid))`;
}

/** `is_blocked_with` between two given users. */
export async function blockedBetween(db: Db, a: string, b: string): Promise<boolean> {
  const [r] = await db<{ x: boolean }[]>`
    select exists (select 1 from work.blocks where (blocker_id = ${a} and blocked_id = ${b}) or (blocker_id = ${b} and blocked_id = ${a})) as x`;
  return r!.x;
}

/** `current_university_id()` for the reader, as a scalar subquery. */
export const myUniversity = (db: Db, me: string | null): Fragment => db`(select m.university_id from work.members m where m.user_id = ${me}::uuid)`;

/** `is_venture_member(venture)` for the reader, on a venture id column. */
export function isVentureMember(db: Db, me: string | null, column: string): Fragment {
  return db`exists (select 1 from work.venture_members vm where vm.venture_id = ${db(column)} and vm.user_id = ${me}::uuid)`;
}

/** `has_venture_invite(venture)`: a pending invite for the reader. */
export function hasVentureInvite(db: Db, me: string | null, column: string): Fragment {
  return db`exists (select 1 from work.venture_invites vi where vi.venture_id = ${db(column)} and vi.invitee_id = ${me}::uuid and vi.status = 'pending')`;
}

/**
 * `can_view_venture(venture)` for the reader, on the venture alias ("v"): not blocked with the owner, and public,
 * or university-only at the reader's university, or the reader is a member or holds a pending invite. The
 * faculty branch (`is_venture_teacher`) waits with the faculty portal (docs/decisions.md 2026-11-26).
 */
export function canViewVenture(db: Db, me: string | null, alias = "v"): Fragment {
  return db`(not ${blockedWith(db, me, `${alias}.owner_id`)} and (
      ${db(`${alias}.visibility`)} = 'public'
      or (${db(`${alias}.visibility`)} = 'university' and ${db(`${alias}.university_id`)} = ${myUniversity(db, me)})
      or ${isVentureMember(db, me, `${alias}.id`)}
      or ${hasVentureInvite(db, me, `${alias}.id`)}))`;
}

/** `can_view_profile(user)` for the reader, on a user id column (people's rule, over work's copies). */
export function canViewProfile(db: Db, me: string | null, column: string): Fragment {
  const user = db(column);
  return db`(${user} = ${me}::uuid or (not ${blockedWith(db, me, column)} and exists (
      select 1 from work.members t where t.user_id = ${user}
         and (t.visibility = 'global'
              or (t.visibility = 'university' and t.university_id = ${myUniversity(db, me)})
              or exists (select 1 from work.friendships f where f.user_id_a = least(${user}, ${me}::uuid) and f.user_id_b = greatest(${user}, ${me}::uuid))))))`;
}

export interface Me {
  id: string;
  university_id: string | null;
  status: string | null;
}

/** `require_user()`: signed in and onboarded (from people's copy). */
export async function requireUser(db: Db, me: string | null): Promise<Me> {
  if (!me) throw refused("not_signed_in");
  const [m] = await db<{ university_id: string | null; status: string | null }[]>`
    select university_id::text, status from work.members where user_id = ${me} and onboarding_complete`;
  if (!m) throw refused("finish_onboarding");
  return { id: me, university_id: m.university_id, status: m.status };
}

/** `valid_skill_ids(ids)`: distinct, every one a live skill. */
export async function validSkillIds(db: Db, ids: readonly string[]): Promise<string[]> {
  const distinct = [...new Set(ids)].sort();
  if (distinct.length === 0) return [];
  const [r] = await db<{ n: number }[]>`select count(*)::int as n from work.skills where id = any(${distinct}::text[]) and retired_at is null`;
  if (r!.n !== distinct.length) throw refused("unknown_skill");
  return distinct;
}
