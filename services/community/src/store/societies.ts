import { rateLimit, uuidv7 } from "@skilient/platform";
import { nameKey, slugBase, slugVariant } from "../domain/names";
import { refused, refusedWith } from "../refusals";
import {
  canSeeSociety,
  isOfficer,
  isPresident,
  requireOfficer,
  requireUser,
  society,
  societyBySlug,
  societyLimits,
  universityOf,
  type Db,
  type Filler,
  type Row,
  type StaffCheck,
  type Tx,
} from "./db";
import { fileReleased, inviteChanged, joinChanged, memberChanged, publish, termChanged } from "./publish";

/**
 * Societies (PRD 5.31): request and review, the directory and page, membership, officers and terms. Ported from
 * 20261111000001_societies.sql; each function keeps its SQL name in its comment. Documents are built as the stack
 * built them (jsonb_build_object), with people and university names as placeholders (src/domain/people.ts).
 */

/** Whether an uploaded file exists in media (W9; until then the path rule only). */
export interface Files {
  exists(bucket: "society-documents" | "society-media" | "event-receipts", path: string): Promise<boolean>;
}
export const pathRuleOnly: Files = { exists: async () => true };

/** `society_card(id)`: what directories, the feed byline and pages share. */
export const CARD = (db: Db, alias = "s") => db.unsafe(`jsonb_build_object(
  'id', ${alias}.id, 'slug', ${alias}.slug, 'name', ${alias}.name, 'category', ${alias}.category, 'about', ${alias}.about,
  'logo_path', ${alias}.logo_path, 'cover_path', ${alias}.cover_path, 'status', ${alias}.status, 'membership_mode', ${alias}.membership_mode,
  'university', '$university:' || ${alias}.university_id, 'university_id', ${alias}.university_id,
  'members', (select count(*) from community.society_members m where m.society_id = ${alias}.id),
  'followers', (select count(*) from community.society_follows f where f.society_id = ${alias}.id),
  'open_rounds', (select count(*) from community.induction_rounds r where r.society_id = ${alias}.id and r.status = 'open'),
  'updated_at', ${alias}.updated_at)`);

export async function card(db: Db, id: string): Promise<Row> {
  const [r] = await db<{ c: Row }[]>`select ${CARD(db)} as c from community.societies s where s.id = ${id}`;
  return r!.c;
}

// ---------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------
/** `society_name_check(name)`: is a society with this name already listed at the reader's university? */
export async function nameCheck(db: Db, me: string | null, name: string): Promise<Row> {
  const uni = await universityOf(db, me);
  const [r] = await db<{ v: Row }[]>`
    select jsonb_build_object('available', x.id is null, 'name', x.name, 'university', case when ${uni}::uuid is not null then '$university:' || ${uni} end) as v
      from (select 1) one
      left join lateral (select s.id, s.name from community.societies s
                          where s.university_id = ${uni} and s.status <> 'rejected' and s.name_key = ${nameKey(name)} limit 1) x on true`;
  return r!.v;
}

export interface NewSociety {
  name: string;
  category: string;
  about: string;
  proof_path: string | null;
  proof_url: string | null;
  office_bearer: boolean;
}

async function uniqueSlug(tx: Tx, name: string): Promise<string> {
  const base = slugBase(name);
  let slug = base;
  for (;;) {
    const [r] = await tx<{ x: boolean }[]>`select exists (select 1 from community.societies where slug = ${slug}) as x`;
    if (!r!.x) return slug;
    slug = slugVariant(base);
  }
}

/** `request_society(p)`. */
export async function requestSociety(tx: Tx, me: string | null, p: NewSociety, files: Files): Promise<string> {
  const m = await requireUser(tx, me);
  const name = p.name.trim();
  const key = nameKey(p.name);
  const path = p.proof_path?.trim() || null;
  const url = p.proof_url?.trim() || null;
  const [student] = await tx<{ u: string | null }[]>`
    select university_id::text as u from community.members where user_id = ${m.id} and role = 'student' and onboarding_complete and status = 'active'`;
  const uni = student?.u ?? null;
  if (!uni) throw refused("request_students_only");
  if (!p.office_bearer) throw refused("confirm_office_bearer");
  if (!path && !url) throw refused("add_proof");
  if (path && (path.split("/")[0] !== m.id || !(await files.exists("society-documents", path)))) throw refused("upload_proof_again");
  const [open] = await tx<{ x: boolean }[]>`
    select exists (select 1 from community.society_requests where requester_id = ${m.id} and status in ('pending', 'more_info')) as x`;
  if (open!.x) throw refused("request_waiting");
  const [taken] = await tx<{ x: boolean }[]>`
    select exists (select 1 from community.societies where university_id = ${uni} and name_key = ${key} and status <> 'rejected') as x`;
  if (taken!.x) throw refused("society_name_taken");
  if (!(await rateLimit(tx, `society_request:${m.id}`, 3, 86_400))) throw refused("too_many_requests_today");
  const id = uuidv7();
  await tx`
    insert into community.societies (id, university_id, slug, name, name_key, category, about, created_by)
    values (${id}, ${uni}, ${await uniqueSlug(tx, name)}, ${name}, ${key}, ${p.category}, ${p.about.trim()}, ${m.id})`;
  await tx`
    insert into community.society_requests (id, society_id, requester_id, proof_path, proof_url, office_bearer)
    values (${uuidv7()}, ${id}, ${m.id}, ${path}, ${url}, true)`;
  return id;
}

/** `resubmit_society(society, p)`: after "more info". */
export async function resubmitSociety(tx: Tx, me: string | null, societyId: string, p: { about?: string; category?: string; proof_path?: string; proof_url?: string }, files: Files): Promise<void> {
  const m = await requireUser(tx, me);
  const [r] = await tx<{ id: string; proof_path: string | null }[]>`
    select id::text, proof_path from community.society_requests where society_id = ${societyId} and requester_id = ${m.id} and status = 'more_info' for update`;
  if (!r) throw refused("nothing_to_resubmit");
  const path = p.proof_path?.trim() || null;
  if (path && (path.split("/")[0] !== m.id || !(await files.exists("society-documents", path)))) throw refused("upload_proof_again");
  await tx`
    update community.societies
       set about = coalesce(nullif(${(p.about ?? "").trim()}, ''), about), category = coalesce(nullif(${p.category ?? ""}, ''), category),
           status = 'pending', status_reason = null, updated_at = now()
     where id = ${societyId}`;
  await tx`
    update community.society_requests
       set status = 'pending', proof_path = coalesce(${path}, proof_path), proof_url = coalesce(nullif(${(p.proof_url ?? "").trim()}, ''), proof_url),
           claimed_by = null, claimed_at = null, updated_at = now()
     where id = ${r.id}`;
  if (path && r.proof_path && r.proof_path !== path) await publish(tx, fileReleased("society-documents", r.proof_path, m.id));
}

/** `my_society_requests()`. */
export async function mySocietyRequests(db: Db, me: string | null): Promise<Row[]> {
  const limits = await societyLimits(db);
  const [r] = await db<{ v: Row[] }[]>`
    select coalesce(jsonb_agg(jsonb_build_object(
             'society_id', s.id, 'slug', s.slug, 'name', s.name, 'status', r.status, 'reason', s.status_reason,
             'created_at', r.created_at, 'updated_at', r.updated_at, 'review_days', ${limits.review_days}::int)
             order by r.created_at desc), '[]'::jsonb) as v
      from community.society_requests r join community.societies s on s.id = r.society_id
     where r.requester_id = ${me}`;
  return r!.v;
}

/** `set_society_images(society, logo, cover)`. */
export async function setSocietyImages(tx: Tx, me: string | null, societyId: string, logo: string | null, cover: string | null, files: Files): Promise<void> {
  const m = await requireUser(tx, me);
  const s = await society(tx, societyId, true);
  if (!s || !((await isOfficer(tx, societyId, m.id)) || (s.created_by === m.id && ["pending", "more_info"].includes(s.status)))) throw refused("society_not_found");
  const bad = async (p: string | null) => p !== null && (p.split("/")[0] !== societyId || !(await files.exists("society-media", p)));
  if ((await bad(logo)) || (await bad(cover))) throw refused("upload_image_again");
  await tx`update community.societies set logo_path = coalesce(${logo}, logo_path), cover_path = coalesce(${cover}, cover_path), updated_at = now() where id = ${societyId}`;
  await publish(tx, [
    ...(logo && s.logo_path && s.logo_path !== logo ? fileReleased("society-media", s.logo_path, m.id) : []),
    ...(cover && s.cover_path && s.cover_path !== cover ? fileReleased("society-media", s.cover_path, m.id) : []),
  ]);
}

/** `update_society(society, p)`. */
export async function updateSociety(tx: Tx, me: string | null, societyId: string, p: { about?: string; category?: string }): Promise<void> {
  await requireOfficer(tx, societyId, me);
  await tx`
    update community.societies
       set about = coalesce(nullif(${(p.about ?? "").trim()}, ''), about), category = coalesce(nullif(${p.category ?? ""}, ''), category), updated_at = now()
     where id = ${societyId}`;
}

/** `set_membership_mode(society, mode)`. */
export async function setMembershipMode(tx: Tx, me: string | null, societyId: string, mode: string): Promise<void> {
  await requireOfficer(tx, societyId, me);
  if (!["open", "request", "inductions"].includes(mode)) throw refused("unknown_membership_mode");
  await tx`update community.societies set membership_mode = ${mode}, updated_at = now() where id = ${societyId}`;
}

// ---------------------------------------------------------------------------
// Directory and pages
// ---------------------------------------------------------------------------
/** `societies_directory(query, category)`. */
export async function directory(db: Db, me: string | null, query: string | null, category: string | null, fill: Filler): Promise<Row> {
  const m = await requireUser(db, me);
  const q = (query ?? "").trim() || null;
  const pattern = q ? `%${q.replace(/[%_]/g, "")}%` : null;
  const cat = category || null;
  const [r] = await db<{ v: Row[] }[]>`
    select coalesce(jsonb_agg(${CARD(db)} || jsonb_build_object(
             'following', exists (select 1 from community.society_follows f where f.society_id = s.id and f.user_id = ${m.id}),
             'member', exists (select 1 from community.society_members x where x.society_id = s.id and x.user_id = ${m.id}))
           order by (s.university_id = ${m.university_id}) desc, s.name), '[]'::jsonb) as v
      from (select x.* from community.societies x
             where x.status = 'verified' and (${pattern}::text is null or x.name ilike ${pattern})
               and (${cat}::text is null or x.category = ${cat})
             order by (x.university_id = ${m.university_id}) desc, x.name limit 200) s`;
  return fill({
    university: m.university_id ? `$university:${m.university_id}` : null,
    items: r!.v,
    mine: await mySocietyRequests(db, m.id),
  });
}

/** `society_page(slug)`. */
export async function societyPage(db: Db, me: string | null, slug: string, staff: StaffCheck, fill: Filler): Promise<Row> {
  const m = await requireUser(db, me);
  const s = await societyBySlug(db, slug);
  if (!s || !(await canSeeSociety(db, s, m.id, staff))) throw refused("society_not_found");
  const officer = await isOfficer(db, s.id, m.id);
  const president = await isPresident(db, s.id, m.id);
  const [r] = await db<{ v: Row }[]>`
    select ${CARD(db)} || jsonb_build_object(
      'status_reason', case when ${officer}::boolean or s.created_by = ${m.id} then s.status_reason end,
      'officer', ${officer}::boolean, 'president', ${president}::boolean,
      'my_role', (select x.role from community.society_members x where x.society_id = s.id and x.user_id = ${m.id}),
      'my_team', (select x.team_title from community.society_members x where x.society_id = s.id and x.user_id = ${m.id}),
      'following', exists (select 1 from community.society_follows f where f.society_id = s.id and f.user_id = ${m.id}),
      'join_requested', exists (select 1 from community.society_join_requests j where j.society_id = s.id and j.user_id = ${m.id}),
      'roll_call', coalesce((
        select jsonb_agg(jsonb_build_object('user_id', x.user_id, 'name', '$name:' || x.user_id, 'username', '$username:' || x.user_id,
                                            'avatar_path', '$avatar:' || x.user_id, 'role', x.role, 'title', coalesce(x.title, initcap(x.role)))
                         order by (x.role = 'president') desc, x.joined_at)
          from community.society_members x where x.society_id = s.id and x.role in ('president', 'officer')), '[]'::jsonb),
      'former', coalesce((
        select jsonb_agg(jsonb_build_object('name', '$name:' || t.user_id, 'username', '$username:' || t.user_id,
                                            'title', 'Former ' || t.title, 'term_start', t.term_start, 'term_end', t.term_end)
                         order by t.term_end desc)
          from community.society_terms t where t.society_id = s.id and t.ended_at is not null), '[]'::jsonb),
      'rounds', coalesce((
        select jsonb_agg(jsonb_build_object('id', r.id, 'title', r.title, 'deadline', r.deadline, 'status', r.status,
                                            'seats', (select coalesce(sum(ro.seats - ro.filled), 0) from community.induction_roles ro where ro.round_id = r.id))
                         order by r.deadline)
          from community.induction_rounds r where r.society_id = s.id and (r.status = 'open' or (${officer}::boolean and r.status = 'draft'))), '[]'::jsonb),
      'checklist', case when ${officer}::boolean then jsonb_build_object(
          'logo', s.logo_path is not null,
          'officers', (select count(*) from community.society_members x where x.society_id = s.id and x.role in ('president', 'officer')) > 1
                      or exists (select 1 from community.society_invites i where i.society_id = s.id and i.kind = 'officer' and i.status = 'pending'),
          'mode', s.membership_mode <> 'request' or s.updated_at > s.verified_at,
          'event', false) end) as v
      from community.societies s where s.id = ${s.id}`;
  return fill(r!.v);
}

/** `society_manage(society)`: the officers' view. */
export async function societyManage(db: Db, me: string | null, societyId: string, fill: Filler): Promise<Row> {
  const s = await requireOfficer(db, societyId, me);
  const president = await isPresident(db, s.id, me);
  const [r] = await db<{ v: Row }[]>`
    select ${CARD(db)} || jsonb_build_object(
      'president', ${president}::boolean, 'paid_paused', s.paid_paused,
      'members', coalesce((
        select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'name', '$name:' || m.user_id, 'username', '$username:' || m.user_id,
                                            'role', m.role, 'title', m.title, 'team_title', m.team_title, 'joined_at', m.joined_at)
                         order by array_position(array['president', 'officer', 'member'], m.role), m.joined_at)
          from community.society_members m where m.society_id = s.id), '[]'::jsonb),
      'join_requests', coalesce((
        select jsonb_agg(jsonb_build_object('user_id', j.user_id, 'name', '$name:' || j.user_id, 'username', '$username:' || j.user_id, 'created_at', j.created_at)
                         order by j.created_at)
          from community.society_join_requests j where j.society_id = s.id), '[]'::jsonb),
      'invites', coalesce((
        select jsonb_agg(jsonb_build_object('id', i.id, 'kind', i.kind, 'name', '$name:' || i.invitee_id, 'username', '$username:' || i.invitee_id,
                                            'title', i.title, 'term_start', i.term_start, 'term_end', i.term_end, 'created_at', i.created_at)
                         order by i.created_at)
          from community.society_invites i where i.society_id = s.id and i.status = 'pending'), '[]'::jsonb),
      'terms', coalesce((
        select jsonb_agg(jsonb_build_object('id', t.id, 'user_id', t.user_id, 'name', '$name:' || t.user_id, 'role', t.role, 'title', t.title,
                                            'term_start', t.term_start, 'term_end', t.term_end, 'ended_at', t.ended_at,
                                            'confirmed_at', t.confirmed_at, 'due', t.term_end < current_date and t.confirmed_at is null,
                                            'can_confirm', t.confirmed_at is null and t.term_end <= current_date and t.user_id <> ${me}
                                                           and (${president}::boolean or t.role = 'president'))
                         order by t.term_end)
          from community.society_terms t where t.society_id = s.id), '[]'::jsonb)) as v
      from community.societies s where s.id = ${s.id}`;
  return fill(r!.v);
}

/** `my_officer_societies()`: the composer's "Post as" picker. */
export async function myOfficerSocieties(db: Db, me: string | null): Promise<Row[]> {
  const [r] = await db<{ v: Row[] }[]>`
    select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'slug', s.slug, 'logo_path', s.logo_path) order by s.name), '[]'::jsonb) as v
      from community.society_members m join community.societies s on s.id = m.society_id
     where m.user_id = ${me} and m.role in ('president', 'officer') and s.status = 'verified'`;
  return r!.v;
}

// ---------------------------------------------------------------------------
// Follow, join, leave
// ---------------------------------------------------------------------------
async function follow(tx: Tx, societyId: string, user: string): Promise<void> {
  await tx`insert into community.society_follows (society_id, user_id) values (${societyId}, ${user}) on conflict do nothing`;
}

/** `follow_society(society, on)`. */
export async function followSociety(tx: Tx, me: string | null, societyId: string, on: boolean): Promise<void> {
  const m = await requireUser(tx, me);
  const s = await society(tx, societyId);
  if (!s || s.status !== "verified") throw refused("society_not_found");
  if (on) await follow(tx, societyId, m.id);
  else await tx`delete from community.society_follows where society_id = ${societyId} and user_id = ${m.id}`;
}

/** `join_society(society)`: member | requested. */
export async function joinSociety(tx: Tx, me: string | null, societyId: string): Promise<"member" | "requested"> {
  const m = await requireUser(tx, me);
  const s = await society(tx, societyId);
  if (!s || s.status !== "verified") throw refused("society_not_found");
  if (m.role !== "student" || m.university_id !== s.university_id) throw refused("join_students_only");
  const [mem] = await tx<{ x: boolean }[]>`select exists (select 1 from community.society_members where society_id = ${societyId} and user_id = ${m.id}) as x`;
  if (mem!.x) return "member";
  if (s.membership_mode === "inductions") throw refused("join_by_inductions");
  if (s.membership_mode === "open") {
    await tx`insert into community.society_members (society_id, user_id) values (${societyId}, ${m.id})`;
    await follow(tx, societyId, m.id);
    await publish(tx, [memberChanged(societyId, m.id, "member", m.id)]);
    return "member";
  }
  const ins = await tx`insert into community.society_join_requests (society_id, user_id) values (${societyId}, ${m.id}) on conflict do nothing`;
  if (ins.count) await publish(tx, [joinChanged(societyId, m.id, "requested", m.id)]);
  return "requested";
}

/** `decide_join_request(society, user, accept)`. */
export async function decideJoinRequest(tx: Tx, me: string | null, societyId: string, user: string, accept: boolean): Promise<void> {
  await requireOfficer(tx, societyId, me);
  const del = await tx`delete from community.society_join_requests where society_id = ${societyId} and user_id = ${user}`;
  if (!del.count) throw refused("request_gone");
  if (accept) {
    const ins = await tx`insert into community.society_members (society_id, user_id) values (${societyId}, ${user}) on conflict do nothing`;
    await follow(tx, societyId, user);
    await publish(tx, [joinChanged(societyId, user, "accepted", me), ...(ins.count ? [memberChanged(societyId, user, "member", me)] : [])]);
  }
}

interface TermRow {
  id: string;
  society_id: string;
  user_id: string;
  role: string;
  term_start: string;
  term_end: string;
  confirmed_by: string | null;
}
/** Ends a person's open term (today at the latest); returns it for society.term_changed. */
async function endTerms(tx: Tx, societyId: string, user: string): Promise<TermRow[]> {
  return [
    ...(await tx<TermRow[]>`
      update community.society_terms set ended_at = now(), term_end = least(term_end, current_date)
       where society_id = ${societyId} and user_id = ${user} and ended_at is null
      returning id::text, society_id::text, user_id::text, role, term_start::text, term_end::text, confirmed_by::text`),
  ];
}

/** `leave_society(society)`. */
export async function leaveSociety(tx: Tx, me: string | null, societyId: string): Promise<void> {
  const m = await requireUser(tx, me);
  if (await isPresident(tx, societyId, m.id)) throw refused("handover_before_leaving");
  const ended = await endTerms(tx, societyId, m.id);
  const del = await tx`delete from community.society_members where society_id = ${societyId} and user_id = ${m.id}`;
  if (!del.count) throw refused("not_a_member");
  await publish(tx, [...ended.map((t) => termChanged(t, "ended")), memberChanged(societyId, m.id, null, m.id)]);
}

// ---------------------------------------------------------------------------
// Officers, handover, terms
// ---------------------------------------------------------------------------
/** `invite_officer(society, username, title, start, end)`; `user` is the username resolved by people (or null). */
export async function inviteOfficer(tx: Tx, me: string | null, societyId: string, user: string | null, title: string, start: string, end: string): Promise<string> {
  const s = await requireOfficer(tx, societyId, me, true);
  if (s.status !== "verified") throw refused("officers_once_verified");
  const [ok] = user ? await tx<{ x: boolean }[]>`select exists (select 1 from community.members where user_id = ${user} and role = 'student' and university_id = ${s.university_id}) as x` : [{ x: false }];
  if (!user || !ok!.x) throw refused("no_student_here");
  if (await isOfficer(tx, societyId, user)) throw refused("already_officer");
  const [span] = await tx<{ ok: boolean }[]>`select (${end}::date >= ${start}::date and ${end}::date <= ${start}::date + interval '2 years') as ok`;
  if (!span!.ok) throw refused("term_length");
  const limits = await societyLimits(tx);
  const [n] = await tx<{ n: number }[]>`
    select ((select count(*) from community.society_members where society_id = ${societyId} and role in ('president', 'officer'))
          + (select count(*) from community.society_invites where society_id = ${societyId} and kind = 'officer' and status = 'pending'))::int as n`;
  if (n!.n >= limits.max_officers) throw refusedWith("max_officers", limits.max_officers);
  const id = uuidv7();
  await tx`
    insert into community.society_invites (id, society_id, kind, invitee_id, invited_by, title, term_start, term_end)
    values (${id}, ${societyId}, 'officer', ${user}, ${me}, ${title.trim()}, ${start}, ${end})`;
  await publish(tx, [inviteChanged({ id, society_id: societyId, kind: "officer", invitee_id: user, invited_by: me, status: "pending" })]);
  return id;
}

/** `offer_handover(society, username)`: the president offers the presidency to an officer or member. */
export async function offerHandover(tx: Tx, me: string | null, societyId: string, user: string | null): Promise<string> {
  await requireOfficer(tx, societyId, me, true);
  const [m] = user ? await tx<{ x: boolean }[]>`select exists (select 1 from community.society_members where society_id = ${societyId} and user_id = ${user} and role <> 'president') as x` : [{ x: false }];
  if (!user || !m!.x) throw refused("pick_member");
  const withdrawn = await tx<{ id: string; invitee_id: string }[]>`
    update community.society_invites set status = 'withdrawn', answered_at = now()
     where society_id = ${societyId} and kind = 'handover' and status = 'pending' returning id::text, invitee_id::text`;
  const id = uuidv7();
  await tx`insert into community.society_invites (id, society_id, kind, invitee_id, invited_by) values (${id}, ${societyId}, 'handover', ${user}, ${me})`;
  await publish(tx, [
    ...withdrawn.map((w) => inviteChanged({ id: w.id, society_id: societyId, kind: "handover", invitee_id: w.invitee_id, invited_by: me, status: "withdrawn" })),
    inviteChanged({ id, society_id: societyId, kind: "handover", invitee_id: user, invited_by: me, status: "pending" }),
  ]);
  return id;
}

/** `answer_society_invite(invite, accept)`. */
export async function answerInvite(tx: Tx, me: string | null, inviteId: string, accept: boolean): Promise<void> {
  const m = await requireUser(tx, me);
  const [i] = await tx<{ id: string; society_id: string; kind: string; invited_by: string | null; title: string | null; term_start: string | null; term_end: string | null }[]>`
    select id::text, society_id::text, kind, invited_by::text, title, term_start::text, term_end::text
      from community.society_invites where id = ${inviteId} and invitee_id = ${m.id} and status = 'pending' for update`;
  if (!i) throw refused("invitation_not_found");
  const s = await society(tx, i.society_id, true);
  if (s!.status !== "verified") throw refused("society_not_active");
  const status = accept ? "accepted" : "declined";
  await tx`update community.society_invites set status = ${status}, answered_at = now() where id = ${i.id}`;
  const events = [inviteChanged({ id: i.id, society_id: i.society_id, kind: i.kind, invitee_id: m.id, invited_by: i.invited_by, status })];
  if (accept && i.kind === "officer") {
    await tx`
      insert into community.society_members (society_id, user_id, role, title) values (${i.society_id}, ${m.id}, 'officer', ${i.title})
      on conflict (society_id, user_id) do update set role = 'officer', title = excluded.title`;
    await follow(tx, i.society_id, m.id);
    await tx`
      insert into community.society_terms (id, society_id, user_id, role, title, term_start, term_end)
      values (${uuidv7()}, ${i.society_id}, ${m.id}, 'officer', ${i.title}, ${i.term_start}, ${i.term_end})`;
    events.push(memberChanged(i.society_id, m.id, "officer", m.id));
  } else if (accept && i.kind === "handover") {
    const [old] = await tx<{ user_id: string }[]>`
      select user_id::text from community.society_members where society_id = ${i.society_id} and role = 'president' for update`;
    // The old president's term ends and they stay on as a member ("Former President, <term>").
    const ended = old ? await endTerms(tx, i.society_id, old.user_id) : [];
    if (old) await tx`update community.society_members set role = 'member', title = null where society_id = ${i.society_id} and user_id = ${old.user_id}`;
    ended.push(...(await endTerms(tx, i.society_id, m.id)));
    await tx`
      insert into community.society_members (society_id, user_id, role, title) values (${i.society_id}, ${m.id}, 'president', 'President')
      on conflict (society_id, user_id) do update set role = 'president', title = 'President'`;
    await tx`
      insert into community.society_terms (id, society_id, user_id, role, title, term_start, term_end)
      values (${uuidv7()}, ${i.society_id}, ${m.id}, 'president', 'President', current_date, (current_date + interval '1 year')::date)`;
    events.push(...ended.map((t) => termChanged(t, "ended")));
    if (old) events.push(memberChanged(i.society_id, old.user_id, "member", m.id));
    events.push(memberChanged(i.society_id, m.id, "president", m.id));
  }
  await publish(tx, events);
}

/** `my_society_invites()`. */
export async function mySocietyInvites(db: Db, me: string | null): Promise<Row[]> {
  const [r] = await db<{ v: Row[] }[]>`
    select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'kind', i.kind, 'title', i.title, 'society', s.name, 'slug', s.slug,
                                                 'term_start', i.term_start, 'term_end', i.term_end, 'created_at', i.created_at)
                              order by i.created_at desc), '[]'::jsonb) as v
      from community.society_invites i join community.societies s on s.id = i.society_id
     where i.invitee_id = ${me} and i.status = 'pending'`;
  return r!.v;
}

/** `remove_officer(society, user)`. */
export async function removeOfficer(tx: Tx, me: string | null, societyId: string, user: string): Promise<void> {
  await requireOfficer(tx, societyId, me, true);
  if (await isPresident(tx, societyId, user)) throw refused("handover_instead");
  const upd = await tx`update community.society_members set role = 'member', title = null where society_id = ${societyId} and user_id = ${user} and role = 'officer'`;
  if (!upd.count) throw refused("not_an_officer");
  const ended = await endTerms(tx, societyId, user);
  await publish(tx, [...ended.map((t) => termChanged(t, "ended")), memberChanged(societyId, user, "member", me)]);
}

/**
 * `confirm_term(term)`: the president confirms an officer's ended term; another officer the president's. The
 * confirmation is what credentials (W8) issues the Office bearer entry from (society.term_changed confirmed).
 */
export async function confirmTerm(tx: Tx, me: string | null, termId: string): Promise<void> {
  const m = await requireUser(tx, me);
  const [t] = await tx<(TermRow & { not_ended: boolean; confirmed_at: Date | null })[]>`
    select id::text, society_id::text, user_id::text, role, term_start::text, term_end::text, confirmed_by::text, confirmed_at, term_end > current_date as not_ended
      from community.society_terms where id = ${termId} for update`;
  if (!t || !(await isOfficer(tx, t.society_id, m.id))) throw refused("term_not_found");
  if (t.user_id === m.id) throw refused("confirm_own_term");
  if (t.role !== "president" && !(await isPresident(tx, t.society_id, m.id))) throw refused("president_confirms");
  if (t.not_ended) throw refused("term_not_ended");
  if (t.confirmed_at) return;
  await tx`update community.society_terms set confirmed_by = ${m.id}, confirmed_at = now() where id = ${termId}`;
  const s = await society(tx, t.society_id);
  // Only a verified society's terms become Record entries (the stack's term_record trigger).
  if (s!.status === "verified") await publish(tx, [termChanged({ ...t, confirmed_by: m.id }, "confirmed")]);
}
