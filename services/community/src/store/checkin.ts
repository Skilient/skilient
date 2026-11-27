import { rateLimit, uuidv7 } from "@skilient/platform";
import { PAYLOAD } from "../domain/ticket";
import { refused } from "../refusals";
import { event as eventRow, requireEventStaff, requireUser, type Db, type Event, type Filler, type Row, type Tx } from "./db";
import { blockReason } from "./events";
import { checkedIn, headcount, publish, registered } from "./publish";
import { seatsTaken } from "./registrations";
import type { Tickets } from "./tickets";

/**
 * Check-in (officers and event staff): a signed ticket checks in once per session and a second scan answers with
 * the first time; search, walk-ins on a free seat, walk-ins by university email, the live headcount on
 * event:{id} (realtime), and the rotating self check-in code. Ported from 20261111000002_society_events.sql.
 */

/** `event_session_for(event, session)`: the given session, or the one nearest now. */
export async function sessionFor(db: Db, eventId: string, sessionId: string | null): Promise<string> {
  const [r] = await db<{ id: string }[]>`
    select coalesce(
      (select s.id from community.event_sessions s where s.event_id = ${eventId} and s.id = ${sessionId}),
      (select s.id from community.event_sessions s where s.event_id = ${eventId} order by abs(extract(epoch from s.starts_at - now())) limit 1))::text as id`;
  return r!.id;
}

type Result = Row & { result: "green" | "amber" | "red" };

/** `record_checkin(event, session, user, method, reason)`: green, or amber with the first time. */
export async function recordCheckin(tx: Tx, me: string | null, eventId: string, sessionId: string, user: string, method: string, reason: string | null = null): Promise<Result> {
  const [c] = await tx<{ id: string; removed: boolean; checked_in_at: Date }[]>`
    select id::text, removed_at is not null as removed, checked_in_at from community.event_checkins where session_id = ${sessionId} and user_id = ${user} for update`;
  if (c && !c.removed) return { result: "amber", name: `$name:${user}`, first_at: c.checked_in_at.toISOString() };
  let id: string;
  if (c) {
    id = c.id;
    await tx`
      update community.event_checkins set removed_at = null, removed_by = null, removed_reason = null, checked_in_at = now(),
             checked_in_by = ${me}, method = ${method}, reason = ${reason} where id = ${id}`;
  } else {
    id = uuidv7();
    await tx`
      insert into community.event_checkins (id, event_id, session_id, user_id, method, checked_in_by, reason)
      values (${id}, ${eventId}, ${sessionId}, ${user}, ${method}, ${me}, ${reason})`;
  }
  await tx`update community.event_registrations set checked_in_at = coalesce(checked_in_at, now()) where event_id = ${eventId} and user_id = ${user}`;
  await publish(tx, [checkedIn({ id, event_id: eventId, session_id: sessionId, user_id: user, method }, true)]);
  await headcount(tx, eventId, sessionId);
  const [n] = await tx<{ now: Date }[]>`select now()`;
  return { result: "green", name: `$name:${user}`, at: n!.now.toISOString() };
}

/** `check_in_scan(event, session, payload)`. */
export async function scan(tx: Tx, me: string | null, eventId: string, sessionIn: string | null, payload: string, signer: Tickets, fill: Filler): Promise<Row> {
  const e = await requireEventStaff(tx, eventId, me);
  const [open] = await tx<{ ok: boolean }[]>`select now() >= ${e.starts_at}::timestamptz - interval '2 hours' as ok`;
  if (!["published", "live", "ended"].includes(e.status) || !open!.ok) throw refused("checkin_opens");
  const session = await sessionFor(tx, eventId, sessionIn);
  const m = PAYLOAD.exec(payload ?? "");
  if (!m) return { result: "red", message: "That isn't a Skilient ticket." };
  const [r] = await tx<{ id: string; user_id: string; status: string }[]>`
    select id::text, user_id::text, status from community.event_registrations where id = ${m[1]!} and event_id = ${eventId}`;
  if (!r || !(await signer.matches(tx, eventId, r.id, r.user_id, payload))) return { result: "red", message: "Not registered for this event." };
  if (r.status !== "confirmed") return fill({ result: "red", message: `This ticket isn't confirmed (${r.status}).`, name: `$name:${r.user_id}` });
  return fill(await recordCheckin(tx, me, eventId, session, r.user_id, "scan"));
}

/** People's FilterByName over a set of user ids: those whose name contains the query or username starts with it, by name. */
export type NameFilter = (userIds: string[], query: string, limit: number) => Promise<string[]>;

/** `check_in_search(event, query)`. */
export async function search(db: Db, me: string | null, eventId: string, query: string, byName: NameFilter, fill: Filler): Promise<Row[]> {
  await requireEventStaff(db, eventId, me);
  const q = query.trim();
  if (q.length < 2) return [];
  const regs = await db<{ user_id: string; status: string; checked_in: boolean }[]>`
    select r.user_id::text, r.status,
           exists (select 1 from community.event_checkins c where c.event_id = r.event_id and c.user_id = r.user_id and c.removed_at is null) as checked_in
      from community.event_registrations r where r.event_id = ${eventId} and r.status <> 'cancelled'`;
  const by = new Map(regs.map((r) => [r.user_id, r]));
  const hits = await byName([...by.keys()], q.replace(/[%_]/g, ""), 20);
  return fill(
    hits.filter((u) => by.has(u)).map((u) => ({ user_id: u, name: `$name:${u}`, username: `$username:${u}`, status: by.get(u)!.status, checked_in: by.get(u)!.checked_in })),
  );
}

/** `check_in_person(event, session, user)`: a registered person, or a walk-in (eligible, seats left) registered on the spot. */
export async function person(tx: Tx, me: string | null, eventId: string, sessionIn: string | null, user: string, fill: Filler): Promise<Row> {
  const e = await requireEventStaff(tx, eventId, me);
  const session = await sessionFor(tx, eventId, sessionIn);
  return fill(await personAt(tx, me, e, session, user));
}

async function personAt(tx: Tx, me: string | null, e: Event, session: string, user: string): Promise<Result> {
  const [r] = await tx<{ id: string; status: string }[]>`select id::text, status from community.event_registrations where event_id = ${e.id} and user_id = ${user}`;
  if (r?.status === "confirmed") return recordCheckin(tx, me, e.id, session, user, "search");
  // Walk in: the first free ticket that has a seat.
  const block = await blockReason(tx, e, user);
  if (block && !block.text.startsWith("Registration")) return { result: "red", message: block.text };
  const [t] = await tx<{ id: string; capacity: number }[]>`
    select id::text, capacity from community.event_ticket_types where event_id = ${e.id} and price_pkr is null order by position limit 1 for update`;
  if (!t || (await seatsTaken(tx, t.id)) >= t.capacity) return { result: "red", message: "No free seats left for a walk-in." };
  const [reg] = await tx<{ id: string }[]>`
    insert into community.event_registrations (id, event_id, user_id, ticket_type_id, status, added_by)
    values (${uuidv7()}, ${e.id}, ${user}, ${t.id}, 'confirmed', ${me})
    on conflict (event_id, user_id) do update set status = 'confirmed', ticket_type_id = excluded.ticket_type_id, cancelled_at = null,
          waitlist_position = null, hold_expires_at = null, added_by = excluded.added_by
    returning id::text`;
  await publish(tx, [registered({ id: reg!.id, event_id: e.id, society_id: e.society_id, user_id: user, status: "confirmed", waitlist_position: null }, r?.status ?? null, "walk_in", false, me)]);
  return recordCheckin(tx, me, e.id, session, user, "walk_in");
}

/** What identity knows of an address: the confirmed account holding it, and the universities owning its domain. */
export interface ResolvedEmail {
  user_id: string | null;
  university_ids: string[];
}

/**
 * `check_in_email(event, session, email)`: a student on Skilient is checked in as a walk-in; anyone else is kept
 * for the claim credentials (W8) sends from event.closed.
 */
export async function byEmail(tx: Tx, me: string | null, eventId: string, sessionIn: string | null, emailIn: string, resolve: (email: string) => Promise<ResolvedEmail>, fill: Filler): Promise<Row> {
  const e = await requireEventStaff(tx, eventId, me);
  const session = await sessionFor(tx, eventId, sessionIn);
  const email = emailIn.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+$/.test(email) || email.length > 254) throw refused("valid_email");
  const found = await resolve(email);
  if (!found.university_ids.includes(e.university_id) && e.eligibility.scope !== "all") throw refused("host_email");
  if (found.user_id) {
    const [m] = await tx<{ x: boolean }[]>`select exists (select 1 from community.members where user_id = ${found.user_id} and role = 'student') as x`;
    if (m!.x) return fill(await personAt(tx, me, e, session, found.user_id));
  }
  const [a] = await tx<{ id: string }[]>`
    insert into community.event_email_attendees (id, event_id, email, added_by) values (${uuidv7()}, ${eventId}, ${email}, ${me})
    on conflict (event_id, email) do update set email = excluded.email returning id::text`;
  const [c] = await tx<{ checked_in_at: Date }[]>`
    select checked_in_at from community.event_checkins where session_id = ${session} and email_attendee_id = ${a!.id} and removed_at is null`;
  if (c) return { result: "amber", name: email, first_at: c.checked_in_at.toISOString() };
  const [row] = await tx<{ id: string }[]>`
    insert into community.event_checkins (id, event_id, session_id, email_attendee_id, method, checked_in_by)
    values (${uuidv7()}, ${eventId}, ${session}, ${a!.id}, 'email', ${me})
    on conflict (session_id, email_attendee_id) where email_attendee_id is not null do update set removed_at = null, removed_reason = null, removed_by = null
    returning id::text`;
  await publish(tx, [checkedIn({ id: row!.id, event_id: eventId, session_id: session, user_id: null, method: "email" }, true)]);
  await headcount(tx, eventId, session);
  const [n] = await tx<{ now: Date }[]>`select now()`;
  return { result: "green", name: email, at: n!.now.toISOString(), claim: true };
}

/** `event_headcount(event, session)`. */
export async function headcountPage(db: Db, me: string | null, eventId: string, sessionIn: string | null): Promise<Row> {
  await requireEventStaff(db, eventId, me);
  const session = await sessionFor(db, eventId, sessionIn);
  const [r] = await db<{ v: Row }[]>`
    select jsonb_build_object(
      'session_id', ${session}::uuid,
      'checked_in', (select count(*) from community.event_checkins c where c.session_id = ${session} and c.removed_at is null),
      'expected', (select count(*) from community.event_registrations r where r.event_id = ${eventId} and r.status = 'confirmed'),
      'sessions', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'title', s.title, 'starts_at', s.starts_at) order by s.position)
                              from community.event_sessions s where s.event_id = ${eventId}), '[]'::jsonb)) as v`;
  return r!.v;
}

/** `society_event_code(event)`: the rotating self check-in code. */
export async function eventCode(db: Db, me: string | null, eventId: string, signer: Tickets): Promise<{ token: string; changes_at: string }> {
  const e = await requireEventStaff(db, eventId, me);
  const [w] = await db<{ ok: boolean }[]>`select now() between ${e.starts_at}::timestamptz - interval '2 hours' and ${e.ends_at}::timestamptz + interval '2 hours' as ok`;
  if (e.status === "cancelled" || !w!.ok) throw refused("checkin_window");
  const c = await signer.codes(db, eventId);
  return { token: c.current, changes_at: c.changesAt.toISOString() };
}

/** `self_check_in(event, token)`. */
export async function selfCheckIn(tx: Tx, me: string | null, eventId: string, token: string, signer: Tickets, fill: Filler): Promise<Row> {
  const m = await requireUser(tx, me);
  if (!(await rateLimit(tx, `event_checkin:${m.id}`, 20, 600))) throw refused("rate_limited");
  const e = await eventRow(tx, eventId);
  const [r] = e ? await tx<{ x: boolean }[]>`select exists (select 1 from community.event_registrations where event_id = ${eventId} and user_id = ${m.id} and status = 'confirmed') as x` : [{ x: false }];
  if (!e || !r!.x) throw refused("not_registered_event");
  const c = await signer.codes(tx, eventId);
  if (token !== c.current && token !== c.previous) throw refused("code_changed");
  const [w] = await tx<{ ok: boolean }[]>`select now() between ${e.starts_at}::timestamptz - interval '2 hours' and ${e.ends_at}::timestamptz + interval '2 hours' as ok`;
  if (!w!.ok) throw refused("checkin_closed");
  return fill(await recordCheckin(tx, m.id, eventId, await sessionFor(tx, eventId, null), m.id, "self"));
}
