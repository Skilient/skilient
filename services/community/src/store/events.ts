import { createHash } from "node:crypto";
import { uuidv7 } from "@skilient/platform";
import { pktShort } from "../domain/names";
import { refused, refusedWith, type RefusalReason } from "../refusals";
import {
  canSeeSociety,
  event as eventRow,
  eventLimits,
  isEventOfficer,
  isEventStaff,
  isOfficer,
  requireEventOfficer,
  requireOfficer,
  requireUser,
  society,
  universityOf,
  type Db,
  type Event,
  type Filler,
  type Row,
  type StaffCheck,
  type Tx,
} from "./db";
import { cohostChanged, eventUpdated, fileReleased, publish } from "./publish";
import type { Files } from "./societies";

/**
 * Society events: create and edit (officers only; students can't create events), publish, cancel, co-hosts, the
 * lists and the event page. Ported from 20261111000002_society_events.sql.
 */

/** Seals a new event's ticket secret (src/domain/ticket.ts) under community-ticket-key. */
export type SealNewSecret = (eventId: string) => Buffer;

/** Cards for a list of events, in the order given (one query). */
export async function cards(db: Db, me: string | null, ids: readonly string[], extra: (id: string) => Row = () => ({})): Promise<Row[]> {
  if (ids.length === 0) return [];
  const myUni = await universityOf(db, me);
  const rows = await db.unsafe<{ id: string; c: Row }[]>(
    `select e.id::text as id, ${cardSql("e")} as c from community.events e where e.id = any($3::uuid[])`,
    [me, myUni, ids] as never[],
  );
  const byId = new Map(rows.map((r) => [r.id, r.c]));
  return ids.filter((id) => byId.has(id)).map((id) => ({ ...byId.get(id)!, ...extra(id) }));
}

/** `event_card_v2(id)` as SQL text over $1 (the reader) and $2 (the reader's university): what lists, tickets and pages share. */
export function cardSql(alias: string): string {
  return `jsonb_build_object(
      'id', ${alias}.id, 'title', ${alias}.title, 'type', ${alias}.type, 'status', ${alias}.status, 'starts_at', ${alias}.starts_at, 'ends_at', ${alias}.ends_at,
      'location', ${alias}.location, 'link', ${alias}.link, 'cover_path', ${alias}.cover_path,
      'society', (select jsonb_build_object('id', so.id, 'name', so.name, 'slug', so.slug, 'logo_path', so.logo_path) from community.societies so where so.id = ${alias}.society_id),
      'university', '$university:' || ${alias}.university_id, 'own_university', ${alias}.university_id = $2::uuid,
      'seats_left', (select coalesce(sum(greatest(t.capacity - (select count(*) from community.event_registrations r
                                                                   where r.ticket_type_id = t.id and r.status in ('confirmed', 'held')), 0)), 0)
                       from community.event_ticket_types t where t.event_id = ${alias}.id),
      'paid', exists (select 1 from community.event_ticket_types t where t.event_id = ${alias}.id and t.price_pkr is not null),
      'friends_going', (select count(*) from community.event_registrations r
                         where r.event_id = ${alias}.id and r.status = 'confirmed'
                           and exists (select 1 from community.friendships f where f.user_id_a = least(r.user_id, $1::uuid) and f.user_id_b = greatest(r.user_id, $1::uuid))),
      'my_status', (select r.status from community.event_registrations r where r.event_id = ${alias}.id and r.user_id = $1::uuid))`;
}

export async function card(db: Db, me: string | null, id: string): Promise<Row> {
  return (await cards(db, me, [id]))[0]!;
}

// ---------------------------------------------------------------------------
// Who may register
// ---------------------------------------------------------------------------
export interface Block {
  reason: RefusalReason;
  values: (string | number)[];
  /** The page's wording, with the university as a placeholder. */
  text: string;
}

const sha = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

/** `event_block_reason(event, user)`: why someone can't register, or null when they can. */
export async function blockReason(db: Db, e: Event, user: string): Promise<Block | null> {
  const [m] = await db<{ role: string; status: string | null; university_id: string | null; department_hash: string | null; graduation_year: number | null; now: Date }[]>`
    select m.role, m.status, m.university_id::text, m.department_hash, m.graduation_year, now() as now
      from (select 1) one left join community.members m on m.user_id = ${user}`;
  const now = m!.now;
  const block = (reason: RefusalReason, text: string, ...values: (string | number)[]): Block => ({ reason, values, text });
  if (e.status === "cancelled") return block("block_cancelled", "This event was cancelled.");
  if (e.status === "ended" || e.ends_at < now) return block("block_ended", "This event has ended.");
  if (e.status === "draft") return block("block_draft", "This event isn't published yet.");
  if (m!.role !== null && (m!.role !== "student" || m!.status !== "active")) return block("block_students_only", "Only students register for society events.");
  if (e.registration_opens_at && now < e.registration_opens_at) {
    const at = pktShort(e.registration_opens_at);
    return block("block_opens", `Registration opens ${at}.`, at);
  }
  if (e.registration_closes_at && now > e.registration_closes_at) return block("block_closed", "Registration has closed.");
  const scope = e.eligibility.scope;
  if ((scope === "university" || scope === "groups") && m!.university_id !== e.university_id)
    return block("block_university", `For students at $university:${e.university_id} only.`, e.university_id);
  if (scope === "groups") {
    const batches = e.eligibility.batches ?? [];
    const departments = e.eligibility.departments ?? [];
    const batchOk = batches.length === 0 || batches.includes(m!.graduation_year ?? 0);
    const deptOk = departments.length === 0 || departments.some((d) => sha(d) === (m!.department_hash ?? sha("")));
    if (!batchOk || !deptOk) {
      const what = [departments.join(", ") || null, batches.length ? batches.join(", ") : null].filter((x) => x !== null).join(" ");
      return block("block_groups", `For ${what} only.`, what);
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Create, edit, publish, cancel
// ---------------------------------------------------------------------------
export interface EventInput {
  id: string | null;
  type: string;
  title: string;
  description: string;
  cover_path: string | null;
  location: string;
  link: string;
  sessions: { title: string; starts_at: string; ends_at: string }[];
  ticket_types: { name: string; capacity: number; price_pkr: number | null }[];
  eligibility: { scope: string; departments: string[]; batches: number[] };
  team: { min: number; max: number } | null;
  approval_mode: string;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  questions: { label: string; kind: string; options: string[]; required: boolean }[];
  record_kinds: string[] | null;
  completed_min: number | null;
  volunteer_hours: boolean;
  refund_policy: string;
  refund_days: number | null;
  cohosts: string[];
}

const nul = (s: string | null | undefined) => (s ?? "").trim() || null;

/** `save_society_event(society, p)`. */
export async function saveEvent(tx: Tx, me: string | null, societyId: string, p: EventInput, files: Files, seal: SealNewSecret): Promise<string> {
  const s = await requireOfficer(tx, societyId, me);
  if (s.status !== "verified") throw refused("events_once_verified");
  const L = await eventLimits(tx);
  if (p.sessions.length < 1 || p.sessions.length > L.max_sessions) throw refusedWith("event_sessions", L.max_sessions);
  if (p.ticket_types.length < 1 || p.ticket_types.length > L.max_ticket_types) throw refusedWith("event_ticket_types", L.max_ticket_types);
  if (p.questions.length > L.max_questions) throw refusedWith("up_to_questions", L.max_questions);
  const times = p.sessions.map((x) => [new Date(x.starts_at), new Date(x.ends_at)] as const);
  if (times.some(([a, b]) => Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()))) throw refused("session_times");
  const start = new Date(Math.min(...times.map(([a]) => a.getTime())));
  const end = new Date(Math.max(...times.map(([, b]) => b.getTime())));
  if (end <= start) throw refused("session_times");
  for (const t of p.ticket_types) if (t.price_pkr !== null && (t.price_pkr < L.min_pkr || t.price_pkr > L.max_pkr)) throw refusedWith("ticket_prices", L.min_pkr, L.max_pkr);
  const scope = p.eligibility.scope || "university";
  if (!["university", "all", "groups"].includes(scope)) throw refused("unknown_eligibility");
  const cover = nul(p.cover_path);
  if (cover && (cover.split("/")[0] !== societyId || !(await files.exists("society-media", cover)))) throw refused("upload_cover_again");

  let id = p.id;
  let registered_ = false;
  let changed = false;
  let old: Event | undefined;
  if (id) {
    old = await eventRow(tx, id, true);
    if (!old || old.society_id !== societyId) throw refused("event_not_found");
    if (old.status === "ended" || old.status === "cancelled") throw refused("event_frozen");
    const [r] = await tx<{ x: boolean }[]>`select exists (select 1 from community.event_registrations where event_id = ${id} and status <> 'cancelled') as x`;
    registered_ = r!.x;
  }
  const eligibility = { scope, departments: p.eligibility.departments, batches: p.eligibility.batches };
  const recordKinds = p.record_kinds?.length ? p.record_kinds : ["attended"];
  const location = nul(p.location);
  const link = nul(p.link);
  if (!id) {
    id = uuidv7();
    await tx`
      insert into community.events (id, university_id, society_id, created_by, type, scope, title, description, starts_at, ends_at, location, link,
                                    status, record_kinds, completed_min, volunteer_hours, team_min, team_max, approval_mode,
                                    registration_opens_at, registration_closes_at, eligibility, cover_path, refund_policy, refund_days)
      values (${id}, ${s.university_id}, ${societyId}, ${me}, ${p.type}, ${scope === "all" ? "global" : "university"}, ${p.title.trim()}, ${nul(p.description)},
              ${start}, ${end}, ${location}, ${link}, 'draft', ${recordKinds}::text[], ${p.completed_min}, ${p.volunteer_hours},
              ${p.team?.min ?? null}, ${p.team?.max ?? null}, ${p.approval_mode || "automatic"},
              ${p.registration_opens_at}, ${p.registration_closes_at}, ${JSON.stringify(eligibility)}::text::jsonb,
              ${cover}, ${p.refund_policy || "none"}, ${p.refund_days})`;
    await tx`insert into community.event_secrets (event_id, sealed) values (${id}, ${seal(id)})`;
  } else {
    const was = old!.eligibility.scope;
    // After the first registration eligibility can't narrow; capacity never drops below given-out seats.
    if (registered_ && ((was === "all" && scope !== "all") || (was === "university" && scope === "groups"))) throw refused("eligibility_narrow");
    changed =
      ["published", "live"].includes(old!.status) &&
      (old!.starts_at.getTime() !== start.getTime() || old!.ends_at.getTime() !== end.getTime() || old!.location !== location || old!.link !== link);
    await tx`
      update community.events
         set type = ${p.type}, scope = ${scope === "all" ? "global" : "university"}, title = ${p.title.trim()}, description = ${nul(p.description)},
             starts_at = ${start}, ends_at = ${end}, location = ${location}, link = ${link},
             record_kinds = ${recordKinds}::text[], completed_min = ${p.completed_min}, volunteer_hours = ${p.volunteer_hours},
             team_min = case when ${registered_}::boolean then team_min else ${p.team?.min ?? null}::smallint end,
             team_max = case when ${registered_}::boolean then team_max else ${p.team?.max ?? null}::smallint end,
             approval_mode = ${p.approval_mode || "automatic"},
             registration_opens_at = ${p.registration_opens_at}, registration_closes_at = ${p.registration_closes_at},
             eligibility = ${JSON.stringify(eligibility)}::text::jsonb, cover_path = coalesce(${cover}, cover_path),
             refund_policy = ${p.refund_policy || "none"}, refund_days = ${p.refund_days}, updated_at = now()
       where id = ${id}`;
    await tx`delete from community.event_questions where event_id = ${id}`;
  }

  // Sessions are replaced only while nobody has checked in.
  const [checked] = await tx<{ x: boolean }[]>`select exists (select 1 from community.event_checkins where event_id = ${id}) as x`;
  if (!checked!.x) {
    await tx`delete from community.event_sessions where event_id = ${id}`;
    const sorted = [...p.sessions].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
    let i = 0;
    for (const x of sorted) {
      i += 1;
      await tx`
        insert into community.event_sessions (id, event_id, position, title, starts_at, ends_at)
        values (${uuidv7()}, ${id}, ${i}, ${nul(x.title)}, ${new Date(x.starts_at)}, ${new Date(x.ends_at)})`;
    }
  }

  // Ticket types by position: existing ones keep their id (registrations point at them).
  let i = 0;
  for (const t of p.ticket_types) {
    i += 1;
    const [cur] = await tx<{ id: string; taken: number }[]>`
      select t.id::text, (select count(*)::int from community.event_registrations r where r.ticket_type_id = t.id and r.status in ('confirmed', 'held')) as taken
        from community.event_ticket_types t where t.event_id = ${id} and t.position = ${i}`;
    if (cur) {
      if (t.capacity < cur.taken) throw refused("capacity_below_seats");
      await tx`
        update community.event_ticket_types
           set name = ${t.name.trim()}, capacity = ${t.capacity}, price_pkr = case when ${registered_}::boolean then price_pkr else ${t.price_pkr}::int end
         where id = ${cur.id}`;
    } else {
      await tx`
        insert into community.event_ticket_types (id, event_id, position, name, capacity, price_pkr)
        values (${uuidv7()}, ${id}, ${i}, ${t.name.trim()}, ${t.capacity}, ${t.price_pkr})`;
    }
  }
  await tx`
    delete from community.event_ticket_types t where t.event_id = ${id} and t.position > ${i}
       and not exists (select 1 from community.event_registrations r where r.ticket_type_id = t.id)`;

  i = 0;
  for (const q of p.questions) {
    i += 1;
    await tx`
      insert into community.event_questions (event_id, position, label, kind, options, required)
      values (${id}, ${i}, ${q.label.trim()}, ${q.kind || "short"}, ${q.options.map((o) => o.trim()).filter((o) => o !== "")}::text[], ${q.required})`;
  }

  // Co-hosts: verified societies, invited by slug; they accept.
  const events = [];
  for (const slug of p.cohosts) {
    const [co] = await tx<{ id: string }[]>`
      select so.id::text from community.societies so
       where so.slug = ${slug} and so.status = 'verified' and so.id <> ${societyId}
         and not exists (select 1 from community.event_cohosts c where c.event_id = ${id} and c.society_id = so.id)`;
    if (co) {
      await tx`insert into community.event_cohosts (event_id, society_id) values (${id}, ${co.id})`;
      events.push(cohostChanged(id, co.id, societyId, "pending", me));
    }
  }
  if (changed) {
    const e = (await eventRow(tx, id))!;
    events.push(eventUpdated(e, e.status, "details", await isPaid(tx, id), me));
  }
  if (old && cover && old.cover_path && old.cover_path !== cover) events.push(...fileReleased("society-media", old.cover_path, me));
  await publish(tx, events);
  return id;
}

export async function isPaid(db: Db, eventId: string): Promise<boolean> {
  const [r] = await db<{ x: boolean }[]>`select exists (select 1 from community.event_ticket_types where event_id = ${eventId} and price_pkr is not null) as x`;
  return r!.x;
}

/** `publish_event(event)`'s checks, before the event post is made (content). Returns what the post needs. */
export async function publishChecks(db: Db, me: string | null, eventId: string): Promise<{ event: Event; body: string }> {
  const e = await requireEventOfficer(db, eventId, me);
  if (!(await isOfficer(db, e.society_id, me))) throw refused("host_publishes");
  if (e.status !== "draft") throw refused("event_published");
  const [n] = await db<{ past: boolean }[]>`select ${e.starts_at}::timestamptz <= now() as past`;
  if (n!.past) throw refused("first_session_future");
  if (await isPaid(db, eventId)) {
    const s = (await society(db, e.society_id))!;
    if (s.paid_paused) throw refused("paid_paused");
    const [d] = await db<{ x: boolean }[]>`select exists (select 1 from community.society_payment_methods where society_id = ${s.id} and status = 'active') as x`;
    if (!d!.x) throw refused("payment_details_first");
  }
  return { event: e, body: `${e.title}${e.description !== null ? `\n\n${e.description}` : ""}`.slice(0, 2000) };
}

/** `publish_event(event)`: the draft is published with its post (made by content as the officer). */
export async function markPublished(tx: Tx, me: string | null, eventId: string, postId: string | null): Promise<void> {
  const e = await requireEventOfficer(tx, eventId, me, true);
  if (e.status !== "draft") throw refused("event_published");
  await tx`update community.events set status = 'published', published_at = now(), post_id = ${postId}, updated_at = now() where id = ${eventId}`;
  await publish(tx, [eventUpdated({ ...e, status: "published" }, "draft", "published", await isPaid(tx, eventId), me)]);
}

/** `cancel_society_event(event, reason)`; paid registrants are owed refunds (payments.ts). */
export async function cancelEvent(tx: Tx, me: string | null, eventId: string, reason: string | null, refunds: (tx: Tx, eventId: string, actor: string | null) => Promise<void>): Promise<void> {
  const e = await requireEventOfficer(tx, eventId, me, true);
  if (e.status === "ended" || e.status === "cancelled") throw refusedWith("event_already", e.status);
  await tx`update community.events set status = 'cancelled', cancelled_at = now(), cancel_reason = ${nul(reason)}, updated_at = now() where id = ${eventId}`;
  await publish(tx, [eventUpdated({ ...e, status: "cancelled" }, e.status, "cancelled", await isPaid(tx, eventId), me)]);
  await refunds(tx, eventId, me);
}

/** `event_edit_payload(event)`: the full form, to edit or to duplicate. */
export async function editPayload(db: Db, me: string | null, eventId: string): Promise<Row> {
  await requireEventOfficer(db, eventId, me);
  const [r] = await db<{ v: Row }[]>`
    select jsonb_build_object(
      'id', e.id, 'society_id', e.society_id, 'status', e.status, 'type', e.type, 'title', e.title, 'description', e.description,
      'cover_path', e.cover_path, 'location', e.location, 'link', e.link,
      'sessions', coalesce((select jsonb_agg(jsonb_build_object('title', x.title, 'starts_at', x.starts_at, 'ends_at', x.ends_at) order by x.position)
                              from community.event_sessions x where x.event_id = e.id), '[]'::jsonb),
      'ticket_types', coalesce((select jsonb_agg(jsonb_build_object('name', t.name, 'capacity', t.capacity, 'price_pkr', t.price_pkr) order by t.position)
                                  from community.event_ticket_types t where t.event_id = e.id), '[]'::jsonb),
      'eligibility', e.eligibility, 'team', case when e.team_min is not null then jsonb_build_object('min', e.team_min, 'max', e.team_max) end,
      'approval_mode', e.approval_mode, 'registration_opens_at', e.registration_opens_at, 'registration_closes_at', e.registration_closes_at,
      'questions', coalesce((select jsonb_agg(jsonb_build_object('label', q.label, 'kind', q.kind, 'options', q.options, 'required', q.required) order by q.position)
                               from community.event_questions q where q.event_id = e.id), '[]'::jsonb),
      'record_kinds', e.record_kinds, 'completed_min', e.completed_min, 'volunteer_hours', e.volunteer_hours,
      'refund_policy', e.refund_policy, 'refund_days', e.refund_days,
      'cohosts', coalesce((select jsonb_agg(s.slug) from community.event_cohosts c join community.societies s on s.id = c.society_id where c.event_id = e.id), '[]'::jsonb)) as v
      from community.events e where e.id = ${eventId}`;
  return r!.v;
}

/** `answer_cohost(event, society, accept)`. */
export async function answerCohost(tx: Tx, me: string | null, eventId: string, societyId: string, accept: boolean): Promise<void> {
  if (!(await isOfficer(tx, societyId, me))) throw refused("invitation_not_found");
  const status = accept ? "accepted" : "declined";
  const [c] = await tx<{ host: string }[]>`
    update community.event_cohosts c set status = ${status} from community.events e
     where e.id = c.event_id and c.event_id = ${eventId} and c.society_id = ${societyId} and c.status = 'pending' returning e.society_id::text as host`;
  if (!c) throw refused("invitation_not_found");
  await publish(tx, [cohostChanged(eventId, societyId, c.host, status, me)]);
}

// ---------------------------------------------------------------------------
// Lists and the page
// ---------------------------------------------------------------------------
/** `society_events(when, type)`: upcoming | past | mine, own university first. */
export async function societyEvents(db: Db, me: string | null, when: string, type: string | null): Promise<Row[]> {
  const m = await requireUser(db, me);
  if (!["upcoming", "past", "mine"].includes(when)) throw refused("unknown_list");
  const ids = await db<{ id: string }[]>`
    select x.id::text from (
      select e.id, e.starts_at, e.university_id = ${m.university_id} as own
        from community.events e join community.societies s on s.id = e.society_id and s.status = 'verified'
       where e.status <> 'draft' and (e.university_id = ${m.university_id} or e.eligibility ->> 'scope' = 'all')
         and (${type ?? ""} = '' or e.type = ${type ?? ""})
         and case ${when}
               when 'upcoming' then e.ends_at >= now() and e.status <> 'cancelled'
               when 'past' then e.ends_at < now()
               else exists (select 1 from community.event_registrations r where r.event_id = e.id and r.user_id = ${m.id} and r.status <> 'cancelled')
             end
       order by (e.university_id = ${m.university_id}) desc, e.starts_at
       limit 200) x
     order by x.own desc, case when ${when} = 'past' then -extract(epoch from x.starts_at) else extract(epoch from x.starts_at) end`;
  return cards(db, m.id, ids.map((r) => r.id));
}

/** `society_event_list(society)`: the society's events (and those it co-hosts), drafts for its officers. */
export async function societyEventList(db: Db, me: string | null, societyId: string, staff: StaffCheck): Promise<Row[]> {
  if (!(await canSeeSociety(db, await society(db, societyId), me, staff))) throw refused("society_not_found");
  const officer = await isOfficer(db, societyId, me);
  const ids = await db<{ id: string }[]>`
    select e.id::text from community.events e
     where (e.society_id = ${societyId} or exists (select 1 from community.event_cohosts c where c.event_id = e.id and c.society_id = ${societyId} and c.status = 'accepted'))
       and (e.status <> 'draft' or ${officer}::boolean)
     order by e.starts_at desc limit 100`;
  return cards(db, me, ids.map((r) => r.id));
}

/** `event_page(event)`. */
export async function eventPage(db: Db, me: string | null, eventId: string, fill: Filler): Promise<Row> {
  const m = await requireUser(db, me);
  const e = await eventRow(db, eventId);
  if (!e) throw refused("event_not_found");
  const officer = await isEventOfficer(db, eventId, m.id);
  const staff = officer || (await isEventStaff(db, eventId, m.id));
  const [reg] = await db<{ x: boolean }[]>`select exists (select 1 from community.event_registrations where event_id = ${eventId} and user_id = ${m.id}) as x`;
  if ((e.status === "draft" && !officer) || !(e.university_id === m.university_id || e.eligibility.scope === "all" || staff || reg!.x)) throw refused("event_not_found");
  const block = await blockReason(db, e, m.id);
  const L = await eventLimits(db);
  const [r] = await db<{ v: Row }[]>`
    select jsonb_build_object(
      'description', e.description, 'eligibility', e.eligibility, 'approval_mode', e.approval_mode,
      'registration_opens_at', e.registration_opens_at, 'registration_closes_at', e.registration_closes_at,
      'record_kinds', e.record_kinds, 'completed_min', e.completed_min, 'volunteer_hours', e.volunteer_hours,
      'team', case when e.team_min is not null then jsonb_build_object('min', e.team_min, 'max', e.team_max) end,
      'refund_policy', e.refund_policy, 'refund_days', e.refund_days, 'cancel_reason', e.cancel_reason, 'cancelled_at', e.cancelled_at,
      'officer', ${officer}::boolean, 'staff', ${staff}::boolean, 'block_reason', ${block?.text ?? null}::text,
      'cohosts', coalesce((select jsonb_agg(jsonb_build_object('name', s.name, 'slug', s.slug)) from community.event_cohosts c
                             join community.societies s on s.id = c.society_id where c.event_id = e.id and c.status = 'accepted'), '[]'::jsonb),
      'sessions', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'title', x.title, 'starts_at', x.starts_at, 'ends_at', x.ends_at) order by x.position)
                              from community.event_sessions x where x.event_id = e.id), '[]'::jsonb),
      'ticket_types', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'capacity', t.capacity, 'price_pkr', t.price_pkr,
                                                                    'left', greatest(t.capacity - (select count(*) from community.event_registrations r
                                                                                                    where r.ticket_type_id = t.id and r.status in ('confirmed', 'held')), 0)) order by t.position)
                                  from community.event_ticket_types t where t.event_id = e.id), '[]'::jsonb),
      'questions', coalesce((select jsonb_agg(jsonb_build_object('position', q.position, 'label', q.label, 'kind', q.kind, 'options', q.options, 'required', q.required) order by q.position)
                               from community.event_questions q where q.event_id = e.id), '[]'::jsonb),
      'registration', (select jsonb_build_object(
          'id', r.id, 'status', r.status, 'waitlist_position', r.waitlist_position, 'ticket_type_id', r.ticket_type_id,
          'hold_expires_at', r.hold_expires_at,
          'team', (select jsonb_build_object('name', t.name, 'code', t.code,
                                             'members', (select count(*) from community.event_registrations y where y.team_id = t.id and y.status <> 'cancelled'))
                     from community.event_teams t where t.id = r.team_id))
          from community.event_registrations r where r.event_id = e.id and r.user_id = ${m.id}),
      'feedback_open', (select r.status from community.event_registrations r where r.event_id = e.id and r.user_id = ${m.id}) = 'confirmed'
                       and e.ends_at < now() and e.ends_at > now() - make_interval(days => ${L.feedback_days})
                       and not exists (select 1 from community.event_feedback f where f.event_id = e.id and f.user_id = ${m.id})) as v
      from community.events e where e.id = ${eventId}`;
  return fill({ ...(await card(db, m.id, eventId)), ...r!.v });
}
