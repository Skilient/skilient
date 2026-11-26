import { rateLimit } from "@skilient/platform";
import { containsPattern, prefixQuery } from "../domain/text";
import { refused } from "../refusals";
import { blockedWith, canViewProfile, canViewVenture, isVentureMember, myUniversity, type Db, type Tx } from "./db";

/**
 * Venture reads: the page (the tables the app read through row-level security, venture_by_link, venture_team,
 * venture_counts), browse_ventures, search_ventures (_chat_extras_explore), profile_ventures, the updates and
 * followed_venture_updates (_feed_ranking), deliverables, invites, the requests page, and the batch reads other
 * services make. Each applies the same visibility rule the policies did (`canViewVenture`).
 */
export interface VentureRecord {
  id: string;
  type: string;
  title: string;
  description: string;
  status: string;
  visibility: string;
  stage: string | null;
  pitch_url: string | null;
  affiliation: string | null;
  skill_ids: string[];
  team_size: number;
  owner_id: string;
  university_id: string;
  repo_id: string | null;
  repo_full_name: string | null;
  created_at: Date;
  completed_at: Date | null;
  abandoned_at: Date | null;
  visible: boolean;
}

export async function ventureForPage(db: Db, me: string, ventureId: string) {
  const [v] = await db<VentureRecord[]>`
    select v.id::text, v.type, v.title, v.description, v.status, v.visibility, v.stage, v.pitch_url, v.affiliation, v.skill_ids, v.team_size,
           v.owner_id::text, v.university_id::text, v.repo_id::text, v.repo_full_name, v.created_at, v.completed_at, v.abandoned_at,
           ${canViewVenture(db, me)} as visible
      from work.ventures v
     where v.id = ${ventureId} and (${canViewVenture(db, me)} or (v.visibility = 'unlisted' and not ${blockedWith(db, me, "v.owner_id")}))`;
  if (!v) return null;
  const [team, roles, questions, counts, state] = await Promise.all([
    db<{ user_id: string; team_role: string; joined_at: Date; is_owner: boolean; profile_visible: boolean }[]>`
      select m.user_id::text, m.team_role, m.joined_at, v.owner_id = m.user_id as is_owner, ${canViewProfile(db, me, "m.user_id")} as profile_visible
        from work.venture_members m join work.ventures v on v.id = m.venture_id
       where m.venture_id = ${ventureId} and (m.user_id = ${me}::uuid or not ${blockedWith(db, me, "m.user_id")})
       order by (v.owner_id = m.user_id) desc, m.joined_at`,
    v.visible
      ? db<{ id: string; title: string; skill_ids: string[]; slots: number; filled: number }[]>`
          select id::text, title, skill_ids, slots, filled from work.venture_roles where venture_id = ${ventureId} order by created_at, id`
      : Promise.resolve([]),
    v.visible ? db<{ position: number; body: string }[]>`select position, body from work.venture_questions where venture_id = ${ventureId} order by position` : Promise.resolve([]),
    db<{ members: number; followers: number; deliverables: number; updates: number }[]>`
      select (select count(*)::int from work.venture_members where venture_id = ${ventureId}) as members,
             (select count(*)::int from work.venture_follows where venture_id = ${ventureId}) as followers,
             (select count(*)::int from work.venture_deliverables where venture_id = ${ventureId}) as deliverables,
             (select count(*)::int from work.venture_updates where venture_id = ${ventureId}) as updates`,
    db<{ following: boolean; application_id: string | null; invite_id: string | null; university_id: string | null }[]>`
      select exists (select 1 from work.venture_follows where venture_id = ${ventureId} and user_id = ${me}) as following,
             (select id::text from work.applications where venture_id = ${ventureId} and candidate_id = ${me} and status = 'pending') as application_id,
             (select id::text from work.venture_invites where venture_id = ${ventureId} and invitee_id = ${me} and status = 'pending') as invite_id,
             ${myUniversity(db, me)}::text as university_id`,
  ]);
  return { venture: v, byLinkOnly: !v.visible, team, roles, questions, counts: counts[0]!, state: state[0]! };
}

export interface SummaryRow {
  id: string;
  type: string;
  title: string;
  summary: string;
  status: string;
  visibility: string;
  stage: string | null;
  skill_ids: string[];
  university_id: string;
  owner_id: string;
  members: number;
  team_size: number;
  open_slots: number;
  created_at: Date;
}

const summaryColumns = (db: Db) => db`
  v.id::text, v.type, v.title, left(v.description, 220) as summary, v.status, v.visibility, v.stage, v.skill_ids, v.university_id::text,
  v.owner_id::text, (select count(*)::int from work.venture_members m where m.venture_id = v.id) as members, v.team_size,
  coalesce((select sum(r.slots - r.filled)::int from work.venture_roles r where r.venture_id = v.id), 0) as open_slots, v.created_at`;

/** `browse_ventures(type, status, open_roles, my_university, before, limit)`. */
export async function browseVentures(
  db: Db,
  me: string,
  f: { type: string; status: string | null; open_roles: boolean; my_university: boolean; before: string | null; limit: number },
): Promise<SummaryRow[]> {
  return db<SummaryRow[]>`
    select ${summaryColumns(db)}
      from work.ventures v
     where v.type = ${f.type} and v.visibility <> 'unlisted' and ${canViewVenture(db, me)}
       and (${f.status}::text is null or v.status = ${f.status})
       and (not ${f.open_roles} or exists (select 1 from work.venture_roles r where r.venture_id = v.id and r.filled < r.slots))
       and (not ${f.my_university} or v.university_id = ${myUniversity(db, me)})
       and (${f.before}::timestamptz is null or v.created_at < ${f.before}::text::timestamptz)
     order by v.created_at desc
     limit ${Math.min(Math.max(f.limit || 20, 1), 50)}`;
}

/** `search_ventures(q, type, skill, university, offset)`: 60 searches a minute (`prefix_tsquery`, `contains_pattern`). */
export async function searchVentures(
  tx: Tx,
  me: string | null,
  f: { q: string; type: string; skill: string | null; university_id: string | null; offset: number },
): Promise<SummaryRow[]> {
  if (!me) throw refused("sign_in_first");
  if (!(await rateLimit(tx, `search:${me}`, 60, 60))) throw refused("searching_too_fast");
  const q = f.q.trim();
  const tsq = prefixQuery(f.q);
  const like = containsPattern(f.q);
  return tx<SummaryRow[]>`
    select ${summaryColumns(tx)}
      from work.ventures v
     where v.type = ${f.type} and v.visibility <> 'unlisted' and v.status <> 'abandoned' and ${canViewVenture(tx, me)}
       and (${q} = '' or v.title ilike ${like} or (${tsq}::text is not null and v.search @@ to_tsquery('simple', ${tsq})))
       and (${f.skill}::text is null or ${f.skill} = any (v.skill_ids))
       and (${f.university_id}::uuid is null or v.university_id = ${f.university_id}::uuid)
     order by case when ${q} = '' then 0
                   else coalesce(case when ${tsq}::text is not null then ts_rank(v.search, to_tsquery('simple', ${tsq})) end, 0)
                        + extensions.similarity(v.title, ${q}) end desc,
              v.created_at desc, v.id
     limit 20 offset ${Math.min(Math.max(f.offset, 0), 200)}`;
}

/** `profile_ventures(user)`. */
export async function profileVentures(db: Db, me: string, userId: string) {
  return db<{ id: string; type: string; title: string; status: string; team_role: string; is_owner: boolean; joined_at: Date }[]>`
    select v.id::text, v.type, v.title, v.status, m.team_role, v.owner_id = ${userId}::uuid as is_owner, m.joined_at
      from work.venture_members m join work.ventures v on v.id = m.venture_id
     where m.user_id = ${userId}
       and (v.visibility <> 'unlisted' or ${userId}::uuid = ${me}::uuid or ${isVentureMember(db, me, "v.id")})
       and ${canViewVenture(db, me)}
     order by (v.status in ('recruiting', 'in_progress')) desc, m.joined_at desc`;
}

export interface UpdateRow {
  id: string;
  venture_id: string;
  venture_title: string;
  author_id: string;
  body: string;
  media: { path: string; width: number; height: number }[];
  created_at: Date;
  can_delete: boolean;
}

const updateColumns = (db: Db, me: string) => db`
  u.id::text, v.id::text as venture_id, v.title as venture_title, u.author_id::text, u.body, u.created_at,
  coalesce((select json_agg(json_build_object('path', m.path, 'width', m.width, 'height', m.height) order by m.position)
              from work.venture_update_media m where m.update_id = u.id), '[]'::json) as media,
  (u.author_id = ${me}::uuid or v.owner_id = ${me}::uuid) as can_delete`;

/** A venture's updates (the app's venture_updates read): newest 50. */
export async function ventureUpdates(db: Db, me: string, ventureId: string): Promise<UpdateRow[]> {
  return db<UpdateRow[]>`
    select ${updateColumns(db, me)}
      from work.venture_updates u join work.ventures v on v.id = u.venture_id
     where u.venture_id = ${ventureId} and ${canViewVenture(db, me)}
     order by u.created_at desc, u.id desc limit 50`;
}

/** `followed_venture_updates(limit)`: the last 7 days from ventures the reader follows. */
export async function followedVentureUpdates(db: Db, me: string, limit = 10): Promise<UpdateRow[]> {
  return db<UpdateRow[]>`
    select ${updateColumns(db, me)}
      from work.venture_follows f
      join work.ventures v on v.id = f.venture_id
      join work.venture_updates u on u.venture_id = v.id
     where f.user_id = ${me} and u.created_at > now() - interval '7 days' and ${canViewVenture(db, me)} and not ${blockedWith(db, me, "u.author_id")}
     order by u.created_at desc limit ${Math.min(Math.max(limit, 1), 30)}`;
}

/** Deliverables: members only (an outsider gets none and sees the count). */
export async function deliverables(db: Db, me: string, ventureId: string) {
  return db<{ id: string; label: string; url: string; added_by: string | null; created_at: Date }[]>`
    select d.id::text, d.label, d.url, d.added_by::text, d.created_at from work.venture_deliverables d
     where d.venture_id = ${ventureId} and exists (select 1 from work.venture_members m where m.venture_id = d.venture_id and m.user_id = ${me})
     order by d.created_at, d.id`;
}

/** The owner's pending invites for a venture. */
export async function ownerInvites(db: Db, me: string, ventureId: string) {
  return db<{ id: string; invitee_id: string; created_at: Date }[]>`
    select i.id::text, i.invitee_id::text, i.created_at from work.venture_invites i join work.ventures v on v.id = i.venture_id
     where i.venture_id = ${ventureId} and i.status = 'pending' and (v.owner_id = ${me} or i.inviter_id = ${me})
     order by i.created_at, i.id`;
}

/** The requests page: the reader's newest 100 applications (either side) with messages, and pending invites. */
export async function myRequests(db: Db, me: string) {
  const [applications, invites] = await Promise.all([
    db<{
      id: string;
      venture_id: string;
      venture_title: string | null;
      venture_type: string | null;
      role_id: string | null;
      role_title: string | null;
      candidate_id: string;
      owner_id: string;
      status: string;
      message: string;
      answers: unknown;
      created_at: Date;
      decided_at: Date | null;
    }[]>`
      select a.id::text, a.venture_id::text, case when ${canViewVenture(db, me)} then v.title end as venture_title,
             case when ${canViewVenture(db, me)} then v.type end as venture_type, a.role_id::text,
             (select r.title from work.venture_roles r where r.id = a.role_id and ${canViewVenture(db, me)}) as role_title,
             a.candidate_id::text, a.owner_id::text, a.status, a.message, a.answers, a.created_at, a.decided_at
        from work.applications a join work.ventures v on v.id = a.venture_id
       where a.candidate_id = ${me} or a.owner_id = ${me}
       order by a.created_at desc, a.id desc limit 100`,
    db<{ id: string; venture_id: string; venture_title: string | null; venture_type: string | null; inviter_id: string; status: string; created_at: Date }[]>`
      select i.id::text, i.venture_id::text, v.title as venture_title, v.type as venture_type, i.inviter_id::text, i.status, i.created_at
        from work.venture_invites i join work.ventures v on v.id = i.venture_id
       where i.invitee_id = ${me} and i.status = 'pending'
       order by i.created_at desc, i.id desc`,
  ]);
  const messages = applications.length
    ? await db<{ id: string; application_id: string; sender_id: string; body: string; created_at: Date }[]>`
        select id::text, application_id::text, sender_id::text, body, created_at from work.application_messages
         where application_id = any(${applications.map((a) => a.id)}::uuid[]) order by created_at, id`
    : [];
  return { applications, invites, messages };
}

/** The venture block on content's cards (post_cards), as the viewer sees it. */
export async function ventureCards(db: Db, viewer: string | null, ids: readonly string[]) {
  if (ids.length === 0) return [];
  return db<{
    id: string;
    title: string;
    type: string;
    status: string;
    visibility: string;
    members: number;
    team_size: number;
    is_member: boolean;
    my_application: string | null;
    roles: { title: string; open: number }[];
    team: { user_id: string; profile_visible: boolean }[];
  }[]>`
    select v.id::text, v.title, v.type, v.status, v.visibility,
           (select count(*)::int from work.venture_members vm where vm.venture_id = v.id) as members, v.team_size,
           ${isVentureMember(db, viewer, "v.id")} as is_member,
           (select a.status from work.applications a where a.venture_id = v.id and a.candidate_id = ${viewer}::uuid order by a.created_at desc limit 1) as my_application,
           coalesce((select json_agg(json_build_object('title', r.title, 'open', r.slots - r.filled) order by r.created_at, r.id)
                       from work.venture_roles r where r.venture_id = v.id and r.filled < r.slots), '[]'::json) as roles,
           coalesce((select json_agg(json_build_object('user_id', vm.user_id, 'profile_visible', ${canViewProfile(db, viewer, "vm.user_id")})
                              order by (vm.user_id = v.owner_id) desc, vm.joined_at)
                       from work.venture_members vm where vm.venture_id = v.id and not ${blockedWith(db, viewer, "vm.user_id")}), '[]'::json) as team
      from work.ventures v
     where v.id = any(${[...ids]}::uuid[]) and ${canViewVenture(db, viewer)}`;
}

/** Titles for team chats (messaging). */
export async function ventureTitles(db: Db, ids: readonly string[]) {
  if (ids.length === 0) return [];
  return db<{ venture_id: string; title: string }[]>`select id::text as venture_id, title from work.ventures where id = any(${[...ids]}::uuid[])`;
}
