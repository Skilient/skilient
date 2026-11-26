import type postgres from "postgres";

export type Tx = postgres.TransactionSql;
export type Db = postgres.Sql | Tx;
export type Fragment = postgres.PendingQuery<postgres.Row[]>;

/** `is_thread_member(thread)` for the reader, on a thread id column ("alias.column"). */
export function isMember(db: Db, me: string | null, column: string): Fragment {
  return db`exists (select 1 from messaging.members mm where mm.thread_id = ${db(column)} and mm.user_id = ${me}::uuid)`;
}

/**
 * `dm_blocked(thread)` for the reader: a DM whose other member is blocked with the reader either way, or a
 * closed contact DM. Ported from _recruiter_talent.sql (the latest version).
 */
export function dmBlocked(db: Db, me: string | null, column: string): Fragment {
  return db`exists (
    select 1 from messaging.threads bt join messaging.members bm on bm.thread_id = bt.id
     where bt.id = ${db(column)} and bt.type = 'dm' and bm.user_id <> ${me}::uuid
       and (bt.closed_at is not null
            or exists (select 1 from messaging.blocks b where (b.blocker_id = ${me}::uuid and b.blocked_id = bm.user_id)
                                                     or (b.blocker_id = bm.user_id and b.blocked_id = ${me}::uuid))))`;
}

/** `is_blocked_with(other)` for the reader, on a user id column. */
export function blockedWith(db: Db, me: string | null, column: string): Fragment {
  const other = db(column);
  return db`exists (select 1 from messaging.blocks b where (b.blocker_id = ${me}::uuid and b.blocked_id = ${other})
                                                 or (b.blocker_id = ${other} and b.blocked_id = ${me}::uuid))`;
}

/** `can_view_profile(user)` for the reader, on a user id column (people's rule, over messaging's copies). */
export function canViewProfile(db: Db, me: string | null, column: string): Fragment {
  const user = db(column);
  return db`(${user} = ${me}::uuid or (not ${blockedWith(db, me, column)} and exists (
      select 1 from messaging.profiles t where t.user_id = ${user}
         and (t.visibility = 'global'
              or (t.visibility = 'university' and t.university_id = (select m.university_id from messaging.profiles m where m.user_id = ${me}::uuid))
              or exists (select 1 from messaging.friendships f where f.user_id_a = least(${user}, ${me}::uuid) and f.user_id_b = greatest(${user}, ${me}::uuid))))))`;
}

/** The last message's line in the chat list and in reply previews. */
export const excerptSql = (alias: string, chars = 140) =>
  `case when ${alias}.deleted_at is not null then 'Message deleted'
        when ${alias}.body = '' and ${alias}.shared then 'Shared a post'
        when ${alias}.body = '' then 'Image'
        else left(${alias}.body, ${chars}) end`;
