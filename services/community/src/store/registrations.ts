import { uuidv7 } from "@skilient/platform";
import { teamCode, ticketCode } from "../domain/names";
import { refused, refusedWith } from "../refusals";
import { event as eventRow, eventLimits, requireEventOfficer, requireUser, type Db, type Filler, type Row, type Tx } from "./db";
import { blockReason, cards } from "./events";
import { openPayment, registrationCancelled } from "./payments";
import { publish, registered, type RegistrationReason } from "./publish";
import type { Tickets } from "./tickets";

/**
 * Registrations and tickets. Seats are given out under a row lock on the ticket type (`for update`): every
 * registration, cancellation, approval and promotion for a ticket type queues on that row, so seats can't
 * oversell and the waitlist moves in order (the done-when: test/journeys/seats.journey.test.ts). Ported from
 * 20261111000002_society_events.sql and the paid-ticket parts of 20261111000003_paid_tickets.sql.
 */

interface Ticket {
  id: string;
  event_id: string;
  capacity: number;
  price_pkr: number | null;
}

/** The ticket type, locked. */
async function lockTicket(tx: Tx, ticketId: string, eventId?: string): Promise<Ticket | undefined> {
  const [t] = eventId
    ? await tx<Ticket[]>`select id::text, event_id::text, capacity, price_pkr from community.event_ticket_types where id = ${ticketId} and event_id = ${eventId} for update`
    : await tx<Ticket[]>`select id::text, event_id::text, capacity, price_pkr from community.event_ticket_types where id = ${ticketId} for update`;
  return t;
}

/** `ticket_seats_taken(ticket)`: confirmed and held seats; called under the ticket type's lock. */
export async function seatsTaken(db: Db, ticketId: string): Promise<number> {
  const [r] = await db<{ n: number }[]>`select count(*)::int as n from community.event_registrations where ticket_type_id = ${ticketId} and status in ('confirmed', 'held')`;
  return r!.n;
}

async function nextWaitlistPosition(db: Db, ticketId: string): Promise<number> {
  const [r] = await db<{ n: number }[]>`
    select (coalesce(max(waitlist_position), 0) + 1)::int as n from community.event_registrations where ticket_type_id = ${ticketId} and status = 'waitlisted'`;
  return r!.n;
}

const regEvent = (r: { id: string; event_id: string; user_id: string; status: string; waitlist_position: number | null }, societyId: string, previous: string | null, reason: RegistrationReason, paid: boolean, actor: string | null) =>
  registered({ ...r, society_id: societyId }, previous, reason, paid, actor);

/** `promote_waitlist(ticket)`: called with the ticket type locked; hands free seats to the waitlist in order. */
export async function promoteWaitlist(tx: Tx, ticketId: string): Promise<number> {
  const t = (await lockTicket(tx, ticketId))!;
  const e = (await eventRow(tx, t.event_id))!;
  if (!["published", "live"].includes(e.status)) return 0;
  const L = await eventLimits(tx);
  let free = t.capacity - (await seatsTaken(tx, ticketId));
  let n = 0;
  const events = [];
  while (free > 0) {
    const [r] = await tx<{ id: string; user_id: string }[]>`
      select id::text, user_id::text from community.event_registrations
       where ticket_type_id = ${ticketId} and status = 'waitlisted' order by waitlist_position, registered_at limit 1 for update`;
    if (!r) break;
    const status = t.price_pkr === null ? "confirmed" : "held";
    await tx`
      update community.event_registrations
         set status = ${status}, waitlist_position = null, decided_at = now(),
             hold_expires_at = case when ${status} = 'held' then now() + make_interval(hours => ${L.hold_hours}) end
       where id = ${r.id}`;
    if (status === "held") await openPayment(tx, r.id);
    events.push(regEvent({ id: r.id, event_id: e.id, user_id: r.user_id, status, waitlist_position: null }, e.society_id, "waitlisted", "promoted", t.price_pkr !== null, null));
    free -= 1;
    n += 1;
  }
  await publish(tx, events);
  return n;
}

export interface RegisterInput {
  ticket_type_id: string | null;
  answers: unknown[];
  team: { create?: string; code?: string } | null;
}

/** `register_event(event, p)`: {status, waitlist_position, registration_id}. */
export async function register(tx: Tx, me: string | null, eventId: string, p: RegisterInput): Promise<{ status: string; waitlist_position: number | null; registration_id: string }> {
  const m = await requireUser(tx, me);
  const e = await eventRow(tx, eventId);
  if (!e) throw refused("event_not_found");
  const block = await blockReason(tx, e, m.id);
  if (block) throw refusedWith(block.reason, ...block.values);
  // Read before the lock, to keep the queue short: the form and the limits.
  const questions = await tx<{ position: number; label: string; required: boolean }[]>`
    select position, label, required from community.event_questions where event_id = ${eventId} order by position`;
  const L = await eventLimits(tx);
  // The seat lock: every registration for this ticket type queues here, so seats can't oversell.
  const t = p.ticket_type_id ? await lockTicket(tx, p.ticket_type_id, eventId) : undefined;
  if (!t) throw refused("pick_ticket_type");
  const [prev] = await tx<{ id: string; status: string }[]>`select id::text, status from community.event_registrations where event_id = ${eventId} and user_id = ${m.id}`;
  if (prev && prev.status !== "cancelled") throw refused("already_registered");
  // The form: required questions answered, answers at most 2,000 characters.
  const text = (i: number) => {
    const a = p.answers[i];
    return a === undefined || a === null ? null : typeof a === "string" ? a : JSON.stringify(a);
  };
  for (const q of questions) {
    const a = text(q.position - 1);
    if (q.required && ["", "[]"].includes((a ?? "").trim())) throw refusedWith("answer_question", q.label);
    if ((a ?? "").length > 2000) throw refused("answers_length");
  }
  // Teams: create one (you're the captain) or join with its code.
  let team: string | null = null;
  if (e.team_max !== null) {
    const code = (p.team?.code ?? "").trim();
    const name = (p.team?.create ?? "").trim();
    if (code) {
      const [tm] = await tx<{ id: string }[]>`select id::text from community.event_teams where event_id = ${eventId} and code = ${code.toUpperCase()} for update`;
      if (!tm) throw refused("no_team_code");
      const [n] = await tx<{ n: number }[]>`select count(*)::int as n from community.event_registrations where team_id = ${tm.id} and status not in ('cancelled', 'declined')`;
      if (n!.n >= e.team_max) throw refused("team_full");
      team = tm.id;
    } else if (name) {
      team = uuidv7();
      await tx`insert into community.event_teams (id, event_id, name, code, captain_id) values (${team}, ${eventId}, ${name}, ${teamCode()}, ${m.id})`;
    } else throw refused("create_or_join_team");
  }
  let status: string;
  let position: number | null = null;
  if (e.approval_mode === "manual") status = "pending";
  else if ((await seatsTaken(tx, t.id)) < t.capacity) status = t.price_pkr === null ? "confirmed" : "held";
  else {
    status = "waitlisted";
    position = await nextWaitlistPosition(tx, t.id);
  }
  const [r] = await tx<{ id: string }[]>`
    insert into community.event_registrations (id, event_id, user_id, ticket_type_id, status, waitlist_position, answers, team_id, hold_expires_at, registered_at)
    values (${uuidv7()}, ${eventId}, ${m.id}, ${t.id}, ${status}, ${position}, ${JSON.stringify(p.answers)}::text::jsonb, ${team},
            case when ${status} = 'held' then now() + make_interval(hours => ${L.hold_hours}) end, now())
    on conflict (event_id, user_id) do update
      set ticket_type_id = excluded.ticket_type_id, status = excluded.status, waitlist_position = excluded.waitlist_position,
          answers = excluded.answers, team_id = excluded.team_id, hold_expires_at = excluded.hold_expires_at,
          registered_at = now(), cancelled_at = null, checked_in_at = null, reminded_at = null, reminded_1h_at = null, decided_at = null
    returning id::text`;
  if (status === "held") await openPayment(tx, r!.id);
  await publish(tx, [regEvent({ id: r!.id, event_id: eventId, user_id: m.id, status, waitlist_position: position }, e.society_id, prev?.status ?? null, "registered", t.price_pkr !== null, m.id)]);
  return { status, waitlist_position: position, registration_id: r!.id };
}

/** `cancel_registration(event)`: frees the seat and promotes the waitlist, under the same lock. */
export async function cancelRegistration(tx: Tx, me: string | null, eventId: string): Promise<void> {
  const m = await requireUser(tx, me);
  const [r] = await tx<{ id: string; status: string; ticket_type_id: string | null }[]>`
    select id::text, status, ticket_type_id::text from community.event_registrations where event_id = ${eventId} and user_id = ${m.id} and status <> 'cancelled'`;
  if (!r) throw refused("not_registered");
  const [c] = await tx<{ x: boolean }[]>`select exists (select 1 from community.event_checkins where event_id = ${eventId} and user_id = ${m.id} and removed_at is null) as x`;
  if (c!.x) throw refused("already_checked_in");
  const t = r.ticket_type_id ? await lockTicket(tx, r.ticket_type_id) : undefined;
  await tx`
    update community.event_registrations set status = 'cancelled', cancelled_at = now(), waitlist_position = null, hold_expires_at = null
     where event_id = ${eventId} and user_id = ${m.id}`;
  const e = (await eventRow(tx, eventId))!;
  await publish(tx, [regEvent({ id: r.id, event_id: eventId, user_id: m.id, status: "cancelled", waitlist_position: null }, e.society_id, r.status, "cancelled", t?.price_pkr != null, m.id)]);
  await registrationCancelled(tx, r.id);
  if (t) await promoteWaitlist(tx, t.id);
}

/** `decide_registration(event, user, accept)`: manual approval takes a seat (or the waitlist); a paid ticket starts its hold. */
export async function decideRegistration(tx: Tx, me: string | null, eventId: string, user: string, accept: boolean): Promise<string> {
  const e = await requireEventOfficer(tx, eventId, me);
  const [r] = await tx<{ id: string; ticket_type_id: string }[]>`
    select id::text, ticket_type_id::text from community.event_registrations where event_id = ${eventId} and user_id = ${user} and status = 'pending'`;
  if (!r) throw refused("nothing_to_decide");
  const t = (await lockTicket(tx, r.ticket_type_id))!;
  const L = await eventLimits(tx);
  let status: string;
  let position: number | null = null;
  if (!accept) status = "declined";
  else if ((await seatsTaken(tx, t.id)) < t.capacity) status = t.price_pkr === null ? "confirmed" : "held";
  else {
    status = "waitlisted";
    position = await nextWaitlistPosition(tx, t.id);
  }
  await tx`
    update community.event_registrations
       set status = ${status}, waitlist_position = ${position}, decided_at = now(),
           hold_expires_at = case when ${status} = 'held' then now() + make_interval(hours => ${L.hold_hours}) end
     where id = ${r.id}`;
  if (status === "held") await openPayment(tx, r.id);
  await publish(tx, [regEvent({ id: r.id, event_id: eventId, user_id: user, status, waitlist_position: position }, e.society_id, "pending", "decided", t.price_pkr !== null, me)]);
  return status;
}

/** `my_tickets()`: upcoming and past society events the reader registered for. */
export async function myTickets(db: Db, me: string | null, fill: Filler): Promise<Row> {
  const up = await db<{ id: string; status: string; waitlist_position: number | null }[]>`
    select e.id::text, r.status, r.waitlist_position from community.event_registrations r join community.events e on e.id = r.event_id
     where r.user_id = ${me} and r.status not in ('cancelled', 'declined') and e.ends_at >= now() and e.status <> 'cancelled' order by e.starts_at`;
  const past = await db<{ id: string; status: string }[]>`
    select e.id::text, r.status from community.event_registrations r join community.events e on e.id = r.event_id
     where r.user_id = ${me} and (e.ends_at < now() or e.status = 'cancelled' or r.status in ('cancelled', 'declined')) order by e.starts_at desc`;
  const upBy = new Map(up.map((x) => [x.id, x]));
  const pastBy = new Map(past.map((x) => [x.id, x]));
  return fill({
    upcoming: await cards(db, me, up.map((x) => x.id), (id) => ({ registration_status: upBy.get(id)!.status, waitlist_position: upBy.get(id)!.waitlist_position })),
    past: await cards(db, me, past.map((x) => x.id), (id) => ({ registration_status: pastBy.get(id)!.status })),
  });
}

/** `event_ticket(event)`: the reader's ticket, with its signed payload once confirmed. */
export async function eventTicket(db: Db, me: string | null, eventId: string, signer: Tickets, fill: Filler): Promise<Row> {
  const m = await requireUser(db, me);
  const [r] = await db<{ id: string; status: string }[]>`select id::text, status from community.event_registrations where event_id = ${eventId} and user_id = ${m.id}`;
  const e = await eventRow(db, eventId);
  if (!r || !e) throw refused("ticket_not_found");
  const [doc] = await db<{ v: Row }[]>`
    select jsonb_build_object(
      'registration_id', r.id, 'status', r.status, 'waitlist_position', r.waitlist_position, 'hold_expires_at', r.hold_expires_at,
      'ticket_type', (select jsonb_build_object('name', t.name, 'price_pkr', t.price_pkr) from community.event_ticket_types t where t.id = r.ticket_type_id),
      'refund_policy', e.refund_policy, 'refund_days', e.refund_days,
      'can_cancel', r.status not in ('cancelled', 'declined') and e.status in ('published', 'live')
                    and not exists (select 1 from community.event_checkins c where c.event_id = e.id and c.user_id = r.user_id and c.removed_at is null),
      'checked_in', coalesce((select jsonb_agg(jsonb_build_object('session_id', c.session_id, 'at', c.checked_in_at)) from community.event_checkins c
                                where c.event_id = e.id and c.user_id = r.user_id and c.removed_at is null), '[]'::jsonb),
      'sessions', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'title', x.title, 'starts_at', x.starts_at, 'ends_at', x.ends_at) order by x.position)
                              from community.event_sessions x where x.event_id = e.id), '[]'::jsonb)) as v
      from community.event_registrations r join community.events e on e.id = r.event_id where r.id = ${r.id}`;
  return fill({
    ...(await cards(db, m.id, [eventId]))[0],
    ...doc!.v,
    payload: r.status === "confirmed" ? await signer.payload(db, eventId, r.id, m.id) : null,
    code: ticketCode(r.id),
    name: `$name:${m.id}`,
  });
}
