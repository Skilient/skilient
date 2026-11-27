import { rateLimit } from "@skilient/platform";
import { containsPattern, prefixQuery, trimmed } from "../domain/search";
import { refused } from "../refusals";
import { canViewSql, requireOnboarded } from "./profiles";
import type { Db, Tx } from "./publish";

/**
 * People search and suggestions (ported from private.search_people, 20260929060000_chat_extras_explore.sql,
 * and private.people_you_may_know, 20261114000003_share_reach_push.sql). Skills come from the `skill.changed`
 * copy and shared ventures and societies from the `group.member_changed` copy (decision Q8, advisor); both
 * are empty until work (W5) and community (W7) publish them.
 */

export interface SearchInput {
  q: string | null;
  department: string | null;
  skill: string | null;
  university: string | null;
  offset: number;
  batch: number | null;
}

export interface SearchRow {
  user_id: string;
  username: string;
  full_name: string;
  department: string | null;
  graduation_year: number | null;
  university: string | null;
  avatar_path: string | null;
  skills: string[];
  friendship: string;
}

/** `search_people`: names and usernames anywhere, department words only within the viewer's scope. 60 a minute. */
export async function searchPeople(tx: Tx, me: string | null, input: SearchInput): Promise<SearchRow[]> {
  if (!me) throw refused("not_signed_in");
  const q = trimmed(input.q);
  if ([...q].length < 2) return [];
  if (!(await rateLimit(tx, `search:${me}`, 60, 60))) throw refused("search_rate_limited");
  const query = prefixQuery(input.q);
  const like = containsPattern(input.q);
  const department = trimmed(input.department);
  const cohort = department !== "" || input.batch != null;
  const offset = Math.min(Math.max(input.offset || 0, 0), 200);
  return tx<SearchRow[]>`
    with mine as (select university_id from people.profiles where user_id = ${me}),
         tsq as (select case when ${query}::text is null then null else to_tsquery('simple', ${query}::text) end as q)
    select p.user_id::text, p.username, p.full_name, p.department, p.graduation_year, u.name as university,
           case when ${canViewSql(tx, me)} then p.avatar_path end as avatar_path,
           case when ${canViewSql(tx, me)} then
             array(select s.skill_label from people.skill_levels s where s.user_id = p.user_id and s.level >= 1
                    order by s.level desc, s.skill_label limit 5)
           else '{}'::text[] end as skills,
           case when exists (select 1 from people.friendships f where f.user_id_a = least(${me}::uuid, p.user_id) and f.user_id_b = greatest(${me}::uuid, p.user_id)) then 'friends'
                when exists (select 1 from people.friend_requests fr where fr.sender_id = ${me} and fr.receiver_id = p.user_id and fr.status = 'pending') then 'request_sent'
                when exists (select 1 from people.friend_requests fr where fr.sender_id = p.user_id and fr.receiver_id = ${me} and fr.status = 'pending') then 'request_received'
                else 'none' end as friendship
      from people.profiles p
      left join people.universities u on u.id = p.university_id
      cross join mine cross join tsq
      cross join lateral (select p.university_id = mine.university_id or p.visibility = 'global' as in_scope) scope
     where p.username is not null and p.onboarding_complete
       and p.user_id <> ${me}
       and not exists (select 1 from people.blocks b where (b.blocker_id = ${me} and b.blocked_id = p.user_id) or (b.blocker_id = p.user_id and b.blocked_id = ${me}))
       and (p.full_name ilike ${like} or p.username ilike ${like}
            or (tsq.q is not null and to_tsvector('simple', coalesce(p.full_name, '') || ' ' || coalesce(p.username, '')) @@ tsq.q)
            or (scope.in_scope and (p.department ilike ${like} or (tsq.q is not null and p.search @@ tsq.q))))
       and (not ${cohort} or scope.in_scope)
       and (${department} = '' or p.department ilike ${containsPattern(input.department)})
       and (${input.batch}::int is null or p.graduation_year = ${input.batch}::int)
       and (${input.university}::text is null or u.slug = ${input.university}::text)
       and (${input.skill}::text is null or (${canViewSql(tx, me)} and exists (
             select 1 from people.skill_levels s where s.user_id = p.user_id and s.skill_id = ${input.skill}::text and s.level >= 1)))
     order by lower(p.username) = lower(${q}) desc, extensions.similarity(p.full_name, ${q}) desc, p.full_name, p.user_id
     limit 20 offset ${offset}`;
}

/** Labels for shared groups, from their owners' batch reads (work: venture titles; community: society names). */
export interface GroupLabels {
  labels(kind: "venture" | "society", ids: readonly string[]): Promise<Map<string, string>>;
}
/** No labels (tests without community): a suggestion simply has no "In X with you" line. */
export const noGroupLabels: GroupLabels = {
  async labels() {
    return new Map();
  },
};

export interface Suggestion {
  username: string;
  name: string;
  avatar_path: string | null;
  department: string | null;
  graduation_year: number | null;
  reason: string;
}

/**
 * `people_you_may_know`: same batch (3), same department (1), mutual friends at the same university (2 each),
 * shared ventures (4) and societies (3); never friends, dismissed, blocked, muted or with a pending request;
 * only people the viewer may see, unless they share a venture or society. The SQL ranks; the shared-group
 * lines are filled from the owners' labels afterwards (one call per owner, never per suggestion).
 */
export async function peopleYouMayKnow(db: Db, me: string | null, limit: number | null, labels: GroupLabels = noGroupLabels): Promise<Suggestion[]> {
  const user = await requireOnboarded(db, me);
  const n = Math.min(Math.max(limit ?? 8, 1), 30);
  const rows = await db<(Omit<Suggestion, "reason"> & { reasons: string[]; groups: { kind: "venture" | "society"; id: string }[] | null })[]>`
    with me as (select * from people.profiles where user_id = ${user}),
    friends as (
      select case when f.user_id_a = ${user} then f.user_id_b else f.user_id_a end as id
        from people.friendships f where ${user} in (f.user_id_a, f.user_id_b)
    ), signals as (
      select p.user_id as id, 3 as score, 'Same batch' as reason, 1 as kind, null::json as grp
        from people.profiles p, me
       where me.university_id is not null and p.university_id = me.university_id
         and nullif(lower(btrim(coalesce(p.department, ''))), '') = nullif(lower(btrim(coalesce(me.department, ''))), '')
         and p.graduation_year = me.graduation_year and p.user_id <> ${user}
      union all
      select p.user_id, 1, 'Same department', 2, null
        from people.profiles p, me
       where me.university_id is not null and p.university_id = me.university_id
         and nullif(lower(btrim(coalesce(p.department, ''))), '') = nullif(lower(btrim(coalesce(me.department, ''))), '')
         and p.graduation_year is distinct from me.graduation_year and p.user_id <> ${user}
      union all
      select x.id, 2 * count(*)::int, count(*)::text || case when count(*) = 1 then ' mutual friend' else ' mutual friends' end, 3, null
        from (select case when f.user_id_a = fr.id then f.user_id_b else f.user_id_a end as id
                from friends fr join people.friendships f on fr.id in (f.user_id_a, f.user_id_b)) x
        join people.profiles p on p.user_id = x.id
        join me on p.university_id = me.university_id
       where x.id <> ${user}
       group by x.id
      union all
      select b.user_id, case when a.kind = 'venture' then 4 else 3 end, chr(1) || a.kind, case when a.kind = 'venture' then 4 else 5 end,
             json_agg(json_build_object('kind', a.kind, 'id', a.group_id))
        from people.group_members a
        join people.group_members b on b.kind = a.kind and b.group_id = a.group_id and b.user_id <> ${user}
       where a.user_id = ${user}
       group by b.user_id, a.kind
    ), ranked as (
      select s.id, sum(s.score) as score,
             (array_agg(s.reason order by s.score desc, s.kind))[1:2] as reasons,
             bool_or(s.kind in (4, 5)) as shared,
             json_agg(s.grp) filter (where s.grp is not null) as grps
        from signals s
       where s.id <> all (select id from friends)
       group by s.id
    )
    select p.username, p.full_name as name, p.avatar_path, p.department, p.graduation_year, r.reasons,
           (select json_agg(g.v) from json_array_elements(r.grps) a(v), json_array_elements(a.v) g(v)) as groups
      from (select * from ranked order by score desc limit 200) r
      join people.profiles p on p.user_id = r.id and p.role = 'student' and p.status = 'active'
                            and p.username is not null and p.onboarding_complete
     where not exists (select 1 from people.pymk_dismissals d where d.user_id = ${user} and d.dismissed_id = r.id)
       and not exists (select 1 from people.blocks b where (b.blocker_id = ${user} and b.blocked_id = r.id) or (b.blocker_id = r.id and b.blocked_id = ${user}))
       and not exists (select 1 from people.user_mutes m where m.user_id = ${user} and m.muted_id = r.id)
       and not exists (select 1 from people.friend_requests fr
                        where fr.status = 'pending' and ((fr.sender_id = ${user} and fr.receiver_id = r.id) or (fr.sender_id = r.id and fr.receiver_id = ${user})))
       and (r.shared or ${canViewSql(db, user)})
     order by r.score desc, p.full_name
     limit ${n}`;
  // The limit applies (Ahmed, 2026-11-25): today's SQL meant it but placed it on the one-row jsonb_agg query,
  // so it never cut the list. The golden case was re-recorded with the intended limit applied.
  const wanted = { venture: new Set<string>(), society: new Set<string>() };
  for (const r of rows) for (const g of r.groups ?? []) wanted[g.kind].add(g.id);
  const [ventures, societies] = await Promise.all([
    wanted.venture.size ? labels.labels("venture", [...wanted.venture]) : new Map<string, string>(),
    wanted.society.size ? labels.labels("society", [...wanted.society]) : new Map<string, string>(),
  ]);
  return rows.map(({ reasons, groups, ...r }) => {
    const text = reasons.flatMap((reason) => {
      if (!reason.startsWith("\u0001")) return [reason];
      const kind = reason.slice(1) as "venture" | "society";
      const names = (groups ?? [])
        .filter((g) => g.kind === kind)
        .map((g) => (kind === "venture" ? ventures : societies).get(g.id))
        .filter((x): x is string => Boolean(x))
        .sort();
      return names.length ? [`In ${names[0]} with you`] : [];
    });
    const shown = text.includes("Same batch") && text.includes("Same department") ? text.filter((x) => x !== "Same department") : text;
    return { ...r, reason: shown.join(" · ") };
  });
}
