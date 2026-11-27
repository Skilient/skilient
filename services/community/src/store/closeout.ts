import { createHash } from "node:crypto";
import { rateLimit, uuidv7 } from "@skilient/platform";
import { refused, refusedWith } from "../refusals";
import { event as eventRow, eventLimits, requireEventOfficer, requireUser, society, type Db, type Event, type Filler, type Row, type Tx } from "./db";
import { cards } from "./events";
import { closeoutPayments, expireHolds } from "./payments";
import { checkedIn, eventClosed, eventUpdated, headcount, messageSent, publish, reminderDue, staffChanged } from "./publish";
import { promoteWaitlist } from "./registrations";
import { recordCheckin, sessionFor } from "./checkin";

/**
 * Manage (stat tiles, registrations, staff, messages, feedback), close-out (72 hours after the last session:
 * fixes, results, volunteer hours, issuing) and the jobs event-tick (every minute) and event-closeout (hourly).
 * Issuing stores the close-out and hands it to credentials as event.closed in the same transaction (W8 makes the
 * Record entries). Ported from 20261111000002_society_events.sql.
 */

const byName = (rows: Row[]) => rows.sort((a, b) => String(a["name"] ?? "").localeCompare(String(b["name"] ?? ""), "en"));

/** `event_closeout_open(e)`. */
async function closeoutOpen(db: Db, e: Event): Promise<boolean> {
  const L = await eventLimits(db);
  const [r] = await db<{ ok: boolean }[]>`
    select now() >= ${e.ends_at}::timestamptz and now() <= ${e.ends_at}::timestamptz + make_interval(hours => ${L.closeout_hours}) as ok`;
  return e.status !== "cancelled" && r!.ok;
}

/** `event_issue_preview(event)`: who earns what, from attendance, results and hours. */
export async function issuePreview(db: Db, eventId: string): Promise<Row & { attended: string[]; completed: string[]; results: Row[]; volunteer: Row[]; emails: string[] }> {
  const [r] = await db<{ v: never }[]>`
    with e as (select * from community.events where id = ${eventId}),
    sessions as (select count(*)::integer as n from community.event_sessions where event_id = ${eventId}),
    att as (select c.user_id, count(distinct c.session_id)::integer as sessions
              from community.event_checkins c where c.event_id = ${eventId} and c.user_id is not null and c.removed_at is null group by c.user_id),
    emails as (select distinct a.email from community.event_checkins c join community.event_email_attendees a on a.id = c.email_attendee_id
                where c.event_id = ${eventId} and c.removed_at is null)
    select jsonb_build_object(
      'attended', case when (select 'attended' = any (record_kinds) from e) then coalesce((select jsonb_agg(att.user_id) from att), '[]'::jsonb) else '[]'::jsonb end,
      'completed', case when (select 'completed' = any (record_kinds) from e) then coalesce((
          select jsonb_agg(att.user_id) from att where att.sessions >= coalesce((select completed_min from e), (select n from sessions))), '[]'::jsonb) else '[]'::jsonb end,
      'results', coalesce((select jsonb_agg(jsonb_build_object('user_id', r.user_id, 'team_id', r.team_id, 'place', r.place, 'label', r.label) order by r.place)
                             from community.event_results r where r.event_id = ${eventId}), '[]'::jsonb),
      'volunteer', coalesce((select jsonb_agg(jsonb_build_object('user_id', v.user_id, 'hours', v.hours)) from community.volunteer_logs v where v.event_id = ${eventId}), '[]'::jsonb),
      'emails', coalesce((select jsonb_agg(emails.email) from emails), '[]'::jsonb)) as v`;
  return r!.v;
}

/** `closeout_page(event)`. */
export async function closeoutPage(db: Db, me: string | null, eventId: string, fill: Filler): Promise<Row> {
  const e = await requireEventOfficer(db, eventId, me);
  const L = await eventLimits(db);
  const preview = await issuePreview(db, eventId);
  const [r] = await db<{ v: Row & { attendees: Row[] } }[]>`
    select jsonb_build_object(
      'open', ${await closeoutOpen(db, e)}::boolean,
      'closes_at', e.ends_at + make_interval(hours => ${L.closeout_hours}),
      'record_kinds', e.record_kinds, 'volunteer_hours', e.volunteer_hours,
      'activity_hours', (select round(sum(extract(epoch from s.ends_at - s.starts_at)) / 3600.0, 2) from community.event_sessions s where s.event_id = e.id),
      'issued', (select jsonb_build_object('at', i.issued_at, 'auto', i.auto, 'status', i.status) from community.event_issuances i where i.event_id = e.id),
      'counts', jsonb_build_object('attended', ${preview.attended.length}::int, 'completed', ${preview.completed.length}::int, 'results', ${preview.results.length}::int,
                                   'volunteer', ${preview.volunteer.length}::int, 'emails', ${preview.emails.length}::int),
      'attendees', coalesce((
        select jsonb_agg(jsonb_build_object('user_id', r.user_id, 'name', '$name:' || r.user_id, 'username', '$username:' || r.user_id,
                                            'sessions', (select count(distinct c.session_id) from community.event_checkins c where c.event_id = e.id and c.user_id = r.user_id and c.removed_at is null),
                                            'team_id', r.team_id,
                                            'place', (select x.place from community.event_results x where x.event_id = e.id and x.user_id = r.user_id),
                                            'hours', (select v.hours from community.volunteer_logs v where v.event_id = e.id and v.user_id = r.user_id)))
          from community.event_registrations r where r.event_id = e.id and r.status = 'confirmed'), '[]'::jsonb),
      'teams', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name,
                                                             'place', (select x.place from community.event_results x where x.event_id = e.id and x.team_id = t.id)) order by t.name)
                           from community.event_teams t where t.event_id = e.id), '[]'::jsonb),
      'sessions', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'title', s.title, 'starts_at', s.starts_at) order by s.position)
                              from community.event_sessions s where s.event_id = e.id), '[]'::jsonb),
      'fixes', coalesce((select jsonb_agg(jsonb_build_object('name', coalesce('$name:' || c.user_id, a.email), 'added', c.removed_at is null,
                                                             'reason', coalesce(c.removed_reason, c.reason), 'at', coalesce(c.removed_at, c.checked_in_at))
                                          order by coalesce(c.removed_at, c.checked_in_at) desc)
                           from community.event_checkins c left join community.event_email_attendees a on a.id = c.email_attendee_id
                          where c.event_id = e.id and (c.method = 'manual' or c.removed_at is not null)), '[]'::jsonb)) as v
      from community.events e where e.id = ${eventId}`;
  const doc = await fill({ ...(await cards(db, me, [eventId]))[0], ...r!.v });
  byName(doc.attendees as Row[]);
  return doc;
}

async function requireCloseout(db: Db, me: string | null, eventId: string): Promise<Event> {
  const e = await requireEventOfficer(db, eventId, me);
  if (!(await closeoutOpen(db, e))) throw refused("closeout_window");
  return e;
}

async function confirmedReg(db: Db, eventId: string, user: string | null): Promise<boolean> {
  if (!user) return false;
  const [r] = await db<{ x: boolean }[]>`select exists (select 1 from community.event_registrations where event_id = ${eventId} and user_id = ${user} and status = 'confirmed') as x`;
  return r!.x;
}

/** `fix_attendance(event, session, user, present, reason)`: a manual add or removal keeps who, when and why. */
export async function fixAttendance(tx: Tx, me: string | null, eventId: string, sessionIn: string | null, user: string, present: boolean, reasonIn: string | null): Promise<void> {
  await requireCloseout(tx, me, eventId);
  const reason = (reasonIn ?? "").trim() || null;
  if ((reason ?? "").length < 3) throw refused("change_reason");
  if (!(await confirmedReg(tx, eventId, user))) throw refused("they_not_registered");
  const session = await sessionFor(tx, eventId, sessionIn);
  if (present) {
    await recordCheckin(tx, me, eventId, session, user, "manual", reason);
    return;
  }
  const [c] = await tx<{ id: string }[]>`
    update community.event_checkins set removed_at = now(), removed_by = ${me}, removed_reason = ${reason}
     where session_id = ${session} and user_id = ${user} and removed_at is null returning id::text`;
  if (!c) throw refused("not_checked_in");
  await publish(tx, [checkedIn({ id: c.id, event_id: eventId, session_id: session, user_id: user, method: "manual" }, false)]);
  await headcount(tx, eventId, session);
}

/** `set_event_result(event, user, team, place, label)`: a place clears with null. */
export async function setResult(tx: Tx, me: string | null, eventId: string, user: string | null, team: string | null, place: number | null, labelIn: string | null): Promise<void> {
  const e = await requireCloseout(tx, me, eventId);
  if (!e.record_kinds.includes("result")) throw refused("no_results");
  if (place === null) {
    await tx`delete from community.event_results where event_id = ${eventId} and (user_id = ${user} or team_id = ${team})`;
    return;
  }
  const label = (labelIn ?? "").trim() || null;
  if (team) {
    const [t] = await tx<{ x: boolean }[]>`select exists (select 1 from community.event_teams where id = ${team} and event_id = ${eventId}) as x`;
    if (!t!.x) throw refused("team_not_found");
    await tx`
      insert into community.event_results (id, event_id, team_id, place, label, set_by) values (${uuidv7()}, ${eventId}, ${team}, ${place}, ${label}, ${me})
      on conflict (event_id, team_id) where team_id is not null do update set place = excluded.place, label = excluded.label, set_by = excluded.set_by`;
  } else {
    if (!(await confirmedReg(tx, eventId, user))) throw refused("they_not_registered");
    await tx`
      insert into community.event_results (id, event_id, user_id, place, label, set_by) values (${uuidv7()}, ${eventId}, ${user}, ${place}, ${label}, ${me})
      on conflict (event_id, user_id) where user_id is not null do update set place = excluded.place, label = excluded.label, set_by = excluded.set_by`;
  }
}

/** `log_volunteer_hours(event, user, hours)`: capped at the activity's length; 0 or less clears. */
export async function logHours(tx: Tx, me: string | null, eventId: string, user: string, hours: number | null): Promise<void> {
  const e = await requireCloseout(tx, me, eventId);
  if (!e.volunteer_hours) throw refused("no_volunteer_hours");
  const [mx] = await tx<{ max: string }[]>`select (sum(extract(epoch from s.ends_at - s.starts_at)) / 3600.0)::text as max from community.event_sessions s where s.event_id = ${eventId}`;
  const max = Number(mx!.max);
  if (hours === null || hours <= 0) {
    await tx`delete from community.volunteer_logs where event_id = ${eventId} and user_id = ${user}`;
    return;
  }
  if (hours > max) throw refusedWith("hours_capped", (Math.round(max * 10) / 10).toFixed(1));
  if (!(await confirmedReg(tx, eventId, user))) throw refused("they_not_registered");
  await tx`
    insert into community.volunteer_logs (event_id, user_id, hours, logged_by) values (${eventId}, ${user}, round(${hours}::numeric, 2), ${me})
    on conflict (event_id, user_id) do update set hours = excluded.hours, logged_by = excluded.logged_by`;
}

const sha = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

/**
 * event.closed's payload: the close-out with the evidence credentials needs for each Record entry (W8; the
 * stack's issue_event_record). Results carry the place and entrants (ranking reads them from record.sealed);
 * volunteer hours carry minutes. Walk-ins by email go as the address's hash (W8 matches accounts and sends the
 * claim); labels and addresses are read back from community when W8 is built.
 */
async function closedPayload(tx: Tx, e: Event, preview: Awaited<ReturnType<typeof issuePreview>>, issuedBy: string | null, auto: boolean) {
  const s = await society(tx, e.society_id);
  const [facts] = await tx<{ sessions: number; hours: string | null; ends_on: string }[]>`
    select (select count(*)::int from community.event_sessions where event_id = ${e.id}) as sessions,
           (select round(sum(extract(epoch from x.ends_at - x.starts_at)) / 3600.0, 2)::text from community.event_sessions x where x.event_id = ${e.id}) as hours,
           (${e.ends_at}::timestamptz at time zone 'Asia/Karachi')::date::text as ends_on`;
  const attendance = await tx<{ user_id: string; first_at: Date; sessions: number; self_added: boolean }[]>`
    select c.user_id::text, min(c.checked_in_at) as first_at, count(distinct c.session_id)::int as sessions,
           bool_or(c.checked_in_by = c.user_id and c.method in ('manual', 'search', 'email', 'walk_in')) as self_added
      from community.event_checkins c where c.event_id = ${e.id} and c.user_id is not null and c.removed_at is null group by c.user_id`;
  const att = new Map(attendance.map((a) => [a.user_id, a]));
  let results: Row[] = [];
  if (preview.results.length) {
    const team = e.team_min !== null;
    const [n] = team
      ? await tx<{ n: number }[]>`
          select count(distinct t.id)::int as n from community.event_teams t
           where t.event_id = ${e.id}
             and (exists (select 1 from community.event_registrations g join community.event_checkins c on c.event_id = ${e.id} and c.user_id = g.user_id and c.removed_at is null
                           where g.event_id = ${e.id} and g.team_id = t.id and g.status = 'confirmed')
                  or exists (select 1 from community.event_results x where x.event_id = ${e.id} and x.team_id = t.id))`
      : await tx<{ n: number }[]>`
          select count(*)::int as n from (select c.user_id from community.event_checkins c where c.event_id = ${e.id} and c.user_id is not null and c.removed_at is null
                                          union select x.user_id from community.event_results x where x.event_id = ${e.id} and x.user_id is not null) q`;
    const rows = await tx<{ user_id: string; place: number; labelled: boolean; set_by: string | null }[]>`
      select coalesce(g.user_id, x.user_id)::text as user_id, x.place, x.label is not null as labelled, x.set_by::text
        from community.event_results x
        left join community.event_registrations g on x.team_id is not null and g.event_id = ${e.id} and g.team_id = x.team_id and g.status = 'confirmed'
       where x.event_id = ${e.id} and coalesce(g.user_id, x.user_id) is not null`;
    results = rows.map((r) => ({ user_id: r.user_id, place: r.place, entrants: n!.n, set_by_self: r.user_id === issuedBy || r.user_id === r.set_by, labelled: r.labelled }));
  }
  const volunteerIds = new Set(preview.volunteer.map((v) => String(v["user_id"])));
  const volunteer = (
    await tx<{ user_id: string; minutes: number; logged_by: string | null }[]>`
      select user_id::text, round(hours * 60)::int as minutes, logged_by::text from community.volunteer_logs where event_id = ${e.id}`
  )
    .filter((v) => volunteerIds.has(v.user_id))
    .map((v) => ({ user_id: v.user_id, minutes: v.minutes, self_logged: v.user_id === issuedBy || v.user_id === v.logged_by }));
  const walkIns = e.record_kinds.includes("attended")
    ? (
        await tx<{ id: string; email: string; first_at: Date }[]>`
          select a.id::text, a.email, min(c.checked_in_at) as first_at from community.event_email_attendees a
            join community.event_checkins c on c.email_attendee_id = a.id and c.removed_at is null
           where a.event_id = ${e.id} and a.email = any(${preview.emails}::text[]) group by a.id, a.email`
      ).map((w) => ({ attendee_id: w.id, email_hash: sha(w.email), first_at: w.first_at.toISOString() }))
    : [];
  const pick = (ids: string[], f: (a: (typeof attendance)[number]) => Row) => ids.filter((u) => att.has(u)).map((u) => f(att.get(u)!));
  return {
    society_id: e.society_id,
    university_id: e.university_id,
    society_verified: s?.status === "verified",
    auto,
    issued_by: issuedBy,
    ends_on: facts!.ends_on,
    sessions: facts!.sessions,
    hours: facts!.hours === null ? 0 : Number(facts!.hours),
    team_event: e.team_min !== null,
    record_kinds: e.record_kinds,
    attended: pick(preview.attended, (a) => ({ user_id: a.user_id, first_at: a.first_at.toISOString(), self_added: a.user_id === issuedBy || a.self_added })),
    completed: pick(preview.completed, (a) => ({ user_id: a.user_id, sessions: a.sessions, self_added: a.user_id === issuedBy || a.self_added })),
    results,
    volunteer,
    walk_ins: walkIns,
  };
}

async function storeIssuance(tx: Tx, e: Event, preview: Awaited<ReturnType<typeof issuePreview>>, issuedBy: string | null, auto: boolean): Promise<void> {
  // 'signed' = handed to credentials: event.closed is published in this transaction (the stack's trigger set it so).
  await tx`
    insert into community.event_issuances (event_id, preview, status, auto, issued_by)
    values (${e.id}, ${JSON.stringify(preview)}::text::jsonb, 'signed', ${auto}, ${issuedBy})`;
  const payload = await closedPayload(tx, e, preview, issuedBy, auto);
  const users = [...new Set([...(payload.attended as Row[]), ...(payload.completed as Row[]), ...payload.results, ...payload.volunteer].map((x) => String(x["user_id"])))];
  await publish(tx, [eventClosed(e.id, payload, users)]);
}

/** `issue_event_entries(event)`: stores the close-out and hands it to credentials. */
export async function issueEntries(tx: Tx, me: string | null, eventId: string): Promise<Row> {
  const e = await requireCloseout(tx, me, eventId);
  const [x] = await tx<{ x: boolean }[]>`select exists (select 1 from community.event_issuances where event_id = ${eventId}) as x`;
  if (x!.x) throw refused("already_issued");
  const preview = await issuePreview(tx, eventId);
  await storeIssuance(tx, e, preview, me, false);
  return preview;
}

/** `event_attendees_rows(event)`: the CSV (formula-escaped by web). */
export async function attendeesRows(db: Db, me: string | null, eventId: string, fill: Filler): Promise<Row[]> {
  await requireEventOfficer(db, eventId, me);
  const [r] = await db<{ v: Row[] }[]>`
    select coalesce(jsonb_agg(jsonb_build_object('name', '$name:' || r.user_id, 'username', '$username:' || r.user_id, 'department', '$department:' || r.user_id,
                                                 'batch', '$batch:' || r.user_id, 'status', r.status, 'ticket', t.name, 'team', tm.name, 'registered_at', r.registered_at,
                                                 'checked_in_sessions', (select count(distinct c.session_id) from community.event_checkins c where c.event_id = r.event_id and c.user_id = r.user_id and c.removed_at is null),
                                                 'answers', r.answers)), '[]'::jsonb) as v
      from community.event_registrations r
      left join community.event_ticket_types t on t.id = r.ticket_type_id left join community.event_teams tm on tm.id = r.team_id
     where r.event_id = ${eventId} and r.status <> 'cancelled'`;
  return byName(await fill(r!.v));
}

/** `submit_event_feedback(event, rating, comment)`: for 7 days after the event. */
export async function submitFeedback(tx: Tx, me: string | null, eventId: string, rating: number, comment: string | null): Promise<void> {
  const m = await requireUser(tx, me);
  const e = await eventRow(tx, eventId);
  if (!e || !(await confirmedReg(tx, eventId, m.id))) throw refused("event_not_found");
  const L = await eventLimits(tx);
  const [w] = await tx<{ ok: boolean }[]>`select ${e.ends_at}::timestamptz <= now() and ${e.ends_at}::timestamptz >= now() - make_interval(days => ${L.feedback_days}) as ok`;
  if (!w!.ok) throw refused("feedback_window");
  const ins = await tx`
    insert into community.event_feedback (event_id, user_id, rating, comment) values (${eventId}, ${m.id}, ${rating}, ${(comment ?? "").trim() || null})
    on conflict (event_id, user_id) do nothing`;
  if (!ins.count) throw refused("feedback_given");
}

/** `event_manage(event)`: stat tiles, registrations, staff, messages, feedback (groups under the minimum suppressed). */
export async function eventManage(db: Db, me: string | null, eventId: string, fill: Filler): Promise<Row> {
  await requireEventOfficer(db, eventId, me);
  const L = await eventLimits(db);
  const [r] = await db<{ v: Row }[]>`
    with fb as (select count(*)::int as n from community.event_feedback where event_id = ${eventId})
    select jsonb_build_object(
      'approval_mode', e.approval_mode, 'team', case when e.team_min is not null then jsonb_build_object('min', e.team_min, 'max', e.team_max) end,
      'stats', jsonb_build_object(
        'registered', (select count(*) from community.event_registrations r where r.event_id = e.id and r.status = 'confirmed'),
        'pending', (select count(*) from community.event_registrations r where r.event_id = e.id and r.status in ('pending', 'held')),
        'waitlist', (select count(*) from community.event_registrations r where r.event_id = e.id and r.status = 'waitlisted'),
        'capacity', (select coalesce(sum(t.capacity), 0) from community.event_ticket_types t where t.event_id = e.id),
        'checked_in', (select count(distinct c.user_id) from community.event_checkins c where c.event_id = e.id and c.removed_at is null)),
      'questions', coalesce((select jsonb_agg(q.label order by q.position) from community.event_questions q where q.event_id = e.id), '[]'::jsonb),
      'registrations', coalesce((
        select jsonb_agg(jsonb_build_object('user_id', r.user_id, 'name', '$name:' || r.user_id, 'username', '$username:' || r.user_id,
                                            'department', '$department:' || r.user_id, 'batch', '$batch:' || r.user_id, 'status', r.status, 'ticket', t.name,
                                            'answers', r.answers, 'waitlist_position', r.waitlist_position, 'team', tm.name, 'registered_at', r.registered_at)
                         order by r.status, r.waitlist_position nulls last, r.registered_at)
          from community.event_registrations r
          left join community.event_ticket_types t on t.id = r.ticket_type_id left join community.event_teams tm on tm.id = r.team_id
         where r.event_id = e.id), '[]'::jsonb),
      'staff', coalesce((select jsonb_agg(jsonb_build_object('user_id', s.user_id, 'name', '$name:' || s.user_id, 'username', '$username:' || s.user_id))
                           from community.event_staff s where s.event_id = e.id), '[]'::jsonb),
      'messages', coalesce((select jsonb_agg(jsonb_build_object('body', m.body, 'created_at', m.created_at) order by m.created_at desc)
                              from community.event_messages m where m.event_id = e.id), '[]'::jsonb),
      'feedback', case when (select n from fb) >= ${L.feedback_min_group} then jsonb_build_object(
          'count', (select n from fb), 'average', (select round(avg(f.rating), 1) from community.event_feedback f where f.event_id = e.id),
          'ratings', (select jsonb_object_agg(g.rating, g.n) from (select f.rating, count(*) as n from community.event_feedback f where f.event_id = e.id
                                                                     group by f.rating having count(*) >= ${L.feedback_min_group}) g))
        else jsonb_build_object('count', (select n from fb), 'suppressed', true) end) as v
      from community.events e where e.id = ${eventId}`;
  return fill({ ...(await cards(db, me, [eventId]))[0], ...r!.v });
}

/** `add_event_staff(event, username)`; `user` is the username resolved by people (or null). */
export async function addStaff(tx: Tx, me: string | null, eventId: string, user: string | null): Promise<void> {
  await requireEventOfficer(tx, eventId, me);
  const [ok] = user ? await tx<{ x: boolean }[]>`select exists (select 1 from community.members where user_id = ${user} and role = 'student') as x` : [{ x: false }];
  if (!user || !ok!.x) throw refused("no_student_username");
  const [n] = await tx<{ n: number }[]>`select count(*)::int as n from community.event_staff where event_id = ${eventId}`;
  if (n!.n >= 30) throw refused("max_staff");
  const ins = await tx`insert into community.event_staff (event_id, user_id, added_by) values (${eventId}, ${user}, ${me}) on conflict do nothing`;
  // The stack sent the notice even on a repeat; it is sent once here.
  if (ins.count) await publish(tx, [staffChanged(eventId, user, true, me)]);
}

/** `remove_event_staff(event, user)`. */
export async function removeStaff(tx: Tx, me: string | null, eventId: string, user: string): Promise<void> {
  await requireEventOfficer(tx, eventId, me);
  const del = await tx`delete from community.event_staff where event_id = ${eventId} and user_id = ${user}`;
  if (del.count) await publish(tx, [staffChanged(eventId, user, false, me)]);
}

/** `message_registrants(event, body)`: up to 5 a day per event; returns how many were told. */
export async function messageRegistrants(tx: Tx, me: string | null, eventId: string, bodyIn: string): Promise<number> {
  await requireEventOfficer(tx, eventId, me);
  const body = bodyIn.trim();
  if (body.length < 3 || body.length > 1000) throw refused("message_length");
  if (!(await rateLimit(tx, `event_message:${eventId}`, 5, 86_400))) throw refused("messages_per_day");
  const id = uuidv7();
  await tx`insert into community.event_messages (id, event_id, sender_id, body) values (${id}, ${eventId}, ${me}, ${body})`;
  const [n] = await tx<{ n: number }[]>`
    select count(*)::int as n from community.event_registrations
     where event_id = ${eventId} and status in ('confirmed', 'held', 'pending', 'waitlisted') and user_id is distinct from ${me}`;
  const [all] = await tx<{ n: number }[]>`
    select count(*)::int as n from community.event_registrations where event_id = ${eventId} and status in ('confirmed', 'held', 'pending', 'waitlisted')`;
  await publish(tx, [messageSent(id, eventId, me!, n!.n)]);
  return all!.n;
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------
/** event-tick (every minute): live and ended, reminders 24 hours and 1 hour before, expired holds. */
export async function eventTick(tx: Tx): Promise<number> {
  const live = await tx<{ id: string; society_id: string; university_id: string; status: string; starts_at: Date }[]>`
    update community.events set status = 'live', updated_at = now() where status = 'published' and starts_at <= now()
    returning id::text, society_id::text, university_id::text, status, starts_at`;
  const ended = await tx<{ id: string; society_id: string; university_id: string; status: string; starts_at: Date; was: string }[]>`
    with x as (select id, status as was from community.events where status in ('published', 'live') and ends_at <= now() for update)
    update community.events e set status = 'ended', updated_at = now() from x where e.id = x.id
    returning e.id::text, e.society_id::text, e.university_id::text, e.status, e.starts_at, x.was`;
  const due = await tx<{ event_id: string; user_id: string; starts_at: Date; which: "24h" | "1h" }[]>`
    select x.event_id::text, x.user_id::text, e.starts_at, case when e.starts_at <= now() + interval '1 hour' then '1h' else '24h' end as which
      from community.event_registrations x join community.events e on e.id = x.event_id
     where e.status = 'published' and x.status = 'confirmed'
       and ((e.starts_at <= now() + interval '24 hours' and e.starts_at > now() + interval '1 hour' and x.reminded_at is null)
            or (e.starts_at <= now() + interval '1 hour' and e.starts_at > now() and x.reminded_1h_at is null))
     limit 2000`;
  for (const which of ["1h", "24h"] as const) {
    const pairs = due.filter((d) => d.which === which);
    if (!pairs.length) continue;
    const events = [...new Set(pairs.map((p) => p.event_id))];
    for (const ev of events) {
      const users = pairs.filter((p) => p.event_id === ev).map((p) => p.user_id);
      if (which === "1h")
        await tx`update community.event_registrations set reminded_1h_at = now(), reminded_at = coalesce(reminded_at, now()) where event_id = ${ev} and user_id = any(${users}::uuid[])`;
      else await tx`update community.event_registrations set reminded_at = now() where event_id = ${ev} and user_id = any(${users}::uuid[])`;
      await publish(tx, [reminderDue(ev, users, which, pairs[0]!.starts_at)]);
    }
  }
  await publish(tx, [
    ...live.map((e) => eventUpdated(e, "published", "status", false, null)),
    ...ended.map((e) => eventUpdated(e, e.was, "status", false, null)),
  ]);
  const holds = await expireHolds(tx, promoteWaitlist);
  return live.length + ended.length + due.length + holds;
}

/** event-closeout (hourly): an event 72 hours past its end that the host didn't issue gets Attended and Completed stored. */
export async function closeoutTick(tx: Tx): Promise<number> {
  const L = await eventLimits(tx);
  const due = await tx<{ id: string }[]>`
    select x.id::text from community.events x
     where x.status = 'ended' and x.ends_at + make_interval(hours => ${L.closeout_hours}) <= now()
       and not exists (select 1 from community.event_issuances i where i.event_id = x.id)
     limit 200`;
  for (const { id } of due) {
    const e = (await eventRow(tx, id))!;
    const p = await issuePreview(tx, id);
    // Results and hours always need the host.
    await storeIssuance(tx, e, { ...p, results: [], volunteer: [] }, null, true);
  }
  return due.length + (await closeoutPayments(tx));
}
