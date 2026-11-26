import type postgres from "postgres";

export type Tx = postgres.TransactionSql;
export type Db = postgres.Sql | Tx;
export type Fragment = postgres.PendingQuery<postgres.Row[]>;

/**
 * `can_view_post(p.id)` for `viewer`, as a condition on a post row aliased `p` (one query, no per-row call).
 * Ported from 20261019000000_uni_comms.sql: not removed; the author always; a university official sees a post
 * their university hid; anyone else signed in when it is not held or hidden, nobody is blocked either way,
 * it is global or from their university, and a university announcement reaches them. Every input is content's
 * own: the post, the reader's member row and seats, and the block copy.
 */
export function canViewPost(db: Db, viewer: string | null): Fragment {
  return db`(
    p.removed_at is null and (
      p.author_id = ${viewer}::uuid
      or (${viewer}::uuid is not null and p.hidden_by_university_at is not null
          and exists (select 1 from content.uni_seats s where s.user_id = ${viewer}::uuid and s.university_id = p.university_id and s.role in ('owner', 'admin')))
      or (${viewer}::uuid is not null and p.stage <> 'held' and p.hidden_by_university_at is null
          and not exists (select 1 from content.blocks b where (b.blocker_id = ${viewer}::uuid and b.blocked_id = p.author_id)
                                                      or (b.blocker_id = p.author_id and b.blocked_id = ${viewer}::uuid))
          and (p.audience = 'global' or p.university_id = (select m.university_id from content.members m where m.user_id = ${viewer}::uuid))
          and (p.type <> 'announcement' or p.audience = 'global' or ${announcementReaches(db, viewer)}))
    ))`;
}

/** `announcement_reaches(p.id)`: a university announcement's targets against the reader (market writes them, W11). */
function announcementReaches(db: Db, viewer: string | null): Fragment {
  return db`exists (
    select 1 from content.announcement_meta am
      join content.members v on v.user_id = ${viewer}::uuid and v.university_id = am.university_id
     where am.post_id = p.id
       and (exists (select 1 from content.uni_seats s where s.user_id = ${viewer}::uuid and s.university_id = am.university_id)
            or (am.expires_at > now() and v.role in ('student', 'faculty')
                and (not exists (select 1 from content.announcement_targets t where t.post_id = am.post_id and t.department_id is not null)
                     or exists (select 1 from content.announcement_targets t where t.post_id = am.post_id and t.department_id = v.department_id))
                and (not exists (select 1 from content.announcement_targets t where t.post_id = am.post_id and t.batch_year is not null)
                     or v.role = 'faculty'
                     or exists (select 1 from content.announcement_targets t where t.post_id = am.post_id and t.batch_year = v.graduation_year)))))`;
}

/** `is_blocked_with(other)` for the reader, on a user id column ("alias.column"). */
export function notBlocked(db: Db, viewer: string | null, column: string): Fragment {
  const other = db(column);
  return db`not exists (select 1 from content.blocks b where (b.blocker_id = ${viewer}::uuid and b.blocked_id = ${other})
                                                     or (b.blocker_id = ${other} and b.blocked_id = ${viewer}::uuid))`;
}

/**
 * `can_view_profile(user)` for the reader, on a user id column ("alias.column"): self; else not blocked either way and the
 * profile is global, or university-visible to the same university, or the two are friends.
 */
export function canViewProfile(db: Db, viewer: string | null, column: string): Fragment {
  const user = db(column);
  return db`(${user} = ${viewer}::uuid or (${notBlocked(db, viewer, column)} and exists (
      select 1 from content.members t where t.user_id = ${user}
         and (t.visibility = 'global'
              or (t.visibility = 'university' and t.university_id = (select m.university_id from content.members m where m.user_id = ${viewer}::uuid))
              or exists (select 1 from content.friendships f where f.user_id_a = least(${user}, ${viewer}::uuid) and f.user_id_b = greatest(${user}, ${viewer}::uuid))))))`;
}
