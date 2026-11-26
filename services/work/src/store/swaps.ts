import type { NewEvent } from "@skilient/platform";
import { refused, refusedWith } from "../refusals";
import { blockedBetween, canViewProfile, requireUser, type Db, type Tx } from "./db";
import { conversationAllowed, publish } from "./publish";

/**
 * Skill swaps (PRD 5.31), ported from _skill_swap.sql: students at one university teach skills they hold at L2+
 * to each other, session by session; a mutual swap teaches back. A closed swap with confirmed sessions is a
 * "Taught" Record entry for the teacher (`swap.closed`, credentials W8). Every change that tells someone is a
 * `swap.changed` event for notify (W9); the ring and repeat checks go to ranking as `swap.flagged` (W6).
 */
async function limit(db: Db, field: string, fallback: number): Promise<number> {
  const [r] = await db<{ n: number | null }[]>`select (value ->> ${field})::int as n from work.config where key = 'swaps.limits'`;
  return r?.n ?? fallback;
}
const L = {
  request_days: (db: Db) => limit(db, "request_days", 7),
  inactive_days: (db: Db) => limit(db, "inactive_days", 30),
  pair_week_minutes: (db: Db) => limit(db, "pair_week_minutes", 600),
  open_requests: (db: Db) => limit(db, "open_requests", 5),
  upcoming_sessions: (db: Db) => limit(db, "upcoming_sessions", 3),
  rapid_confirms: (db: Db) => limit(db, "rapid_confirms", 3),
  rapid_hours: (db: Db) => limit(db, "rapid_hours", 24),
  ring_days: (db: Db) => limit(db, "ring_days", 30),
};

/** `swap.changed` {swap_id, teacher_id, learner_id, skill_id, status, actor_id, session_id?}: notify's swap notices. */
const swapChanged = (s: { id: string; teacher_id: string; learner_id: string; skill_id: string }, status: string, actor: string | null, extra: Record<string, unknown> = {}): NewEvent => ({
  type: "swap.changed",
  subjects: [s.id, s.teacher_id, s.learner_id],
  payload: { swap_id: s.id, teacher_id: s.teacher_id, learner_id: s.learner_id, skill_id: s.skill_id, status, actor_id: actor, ...extra },
});

async function requireStudent(tx: Tx, me: string): Promise<void> {
  const [m] = await tx`select 1 from work.members where user_id = ${me} and role = 'student'`;
  if (!m) throw refused("swap_students");
}

/** `save_swap_offer(skill, note, on)`: a skill the student teaches (L2+). */
export async function saveSwapOffer(tx: Tx, meId: string | null, skill: string, note: string | null, on: boolean): Promise<void> {
  const me = await requireUser(tx, meId);
  const text = note?.trim() || null;
  if (!on) {
    await tx`delete from work.swap_offers where user_id = ${me.id} and skill_id = ${skill}`;
    return;
  }
  await requireStudent(tx, me.id);
  const [l2] = await tx`select 1 from work.user_skills u join work.skills k on k.id = u.skill_id and k.retired_at is null where u.user_id = ${me.id} and u.skill_id = ${skill} and u.level >= 2`;
  if (!l2) throw refused("swap_teach_l2");
  if (text !== null && text.length > 280) throw refused("swap_note_280");
  await tx`insert into work.swap_offers (user_id, skill_id, note) values (${me.id}, ${skill}, ${text}) on conflict (user_id, skill_id) do update set note = excluded.note`;
}

/** `save_swap_want(skill, note, on)`: a skill the student wants to learn (up to 20). */
export async function saveSwapWant(tx: Tx, meId: string | null, skill: string, note: string | null, on: boolean): Promise<void> {
  const me = await requireUser(tx, meId);
  const text = note?.trim() || null;
  if (!on) {
    await tx`delete from work.swap_wants where user_id = ${me.id} and skill_id = ${skill}`;
    return;
  }
  await requireStudent(tx, me.id);
  const [k] = await tx`select 1 from work.skills where id = ${skill} and retired_at is null`;
  if (!k) throw refused("skill_not_found");
  if (text !== null && text.length > 280) throw refused("swap_note_280");
  const [n] = await tx<{ n: number }[]>`select count(*)::int as n from work.swap_wants where user_id = ${me.id}`;
  if (n!.n >= 20) throw refused("swap_wants_max");
  await tx`insert into work.swap_wants (user_id, skill_id, note) values (${me.id}, ${skill}, ${text}) on conflict (user_id, skill_id) do update set note = excluded.note`;
}

/** `request_swap(teacher, skill, note, times, offer)`: the teacher's id comes from people (resolved before). */
export async function requestSwap(tx: Tx, meId: string | null, teacher: string | null, skill: string, note: string | null, times: string | null, offer: string | null): Promise<string> {
  const me = await requireUser(tx, meId);
  const text = note?.trim() || null;
  const when = times?.trim() || null;
  const back = offer?.trim() || null;
  if (!teacher || teacher === me.id || (await blockedBetween(tx, me.id, teacher))) throw refused("teacher_not_found");
  const [same] = await tx`
    select 1 from work.members a join work.members b on b.user_id = ${teacher}
     where a.user_id = ${me.id} and a.role = 'student' and b.role = 'student' and coalesce(b.status, '') <> 'deleting'
       and a.university_id is not null and a.university_id = b.university_id`;
  if (!same) throw refused("swap_own_university");
  const [taught] = await tx`select 1 from work.swap_offers o join work.user_skills u on u.user_id = o.user_id and u.skill_id = o.skill_id where o.user_id = ${teacher} and o.skill_id = ${skill} and u.level >= 2`;
  if (!taught) throw refused("swap_not_taught");
  if (back !== null) {
    const [l2] = await tx`select 1 from work.user_skills u where u.user_id = ${me.id} and u.skill_id = ${back} and u.level >= 2`;
    if (!l2) throw refused("swap_offer_l2");
  }
  if (back === skill) throw refused("swap_offer_other");
  if ((text !== null && text.length > 500) || (when !== null && when.length > 200)) throw refused("swap_note_times");
  await tx`select pg_advisory_xact_lock(hashtextextended(${"swap_requests:" + me.id}, 0))`;
  const open = await L.open_requests(tx);
  const [n] = await tx<{ n: number }[]>`select count(*)::int as n from work.swaps where learner_id = ${me.id} and status = 'requested' and expires_at > now()`;
  if (n!.n >= open) throw refusedWith("swap_requests_max", open);
  const days = await L.request_days(tx);
  const rows = await tx<{ id: string }[]>`
    insert into work.swaps (id, teacher_id, learner_id, skill_id, offered_skill_id, note, preferred_times, expires_at)
    values (gen_random_uuid(), ${teacher}, ${me.id}, ${skill}, ${back}, ${text}, ${when}, now() + make_interval(days => ${days}))
    on conflict do nothing returning id::text`;
  if (!rows.length) throw refused("swap_open_already");
  const id = rows[0]!.id;
  await publish(tx, [swapChanged({ id, teacher_id: teacher, learner_id: me.id, skill_id: skill }, "requested", me.id, { offered_skill_id: back })]);
  return id;
}

/** `respond_swap(swap, accept)`: accepting opens the swap (and the swap back) and lets the two message. */
export async function respondSwap(tx: Tx, meId: string | null, swapId: string, accept: boolean): Promise<void> {
  const me = await requireUser(tx, meId);
  const [s] = await tx<{ id: string; status: string; expired: boolean; learner_id: string; teacher_id: string; skill_id: string; offered_skill_id: string | null; requested_at: Date }[]>`
    select id::text, status, expires_at <= now() as expired, learner_id::text, teacher_id::text, skill_id, offered_skill_id, requested_at
      from work.swaps where id = ${swapId} and teacher_id = ${me.id} for update`;
  if (!s) throw refused("swap_not_found");
  if (s.status !== "requested") throw refused("swap_request_closed");
  if (s.expired) {
    await tx`update work.swaps set status = 'expired', decided_at = now() where id = ${s.id}`;
    return;
  }
  if (!accept) {
    await tx`update work.swaps set status = 'declined', decided_at = now() where id = ${s.id}`;
    await publish(tx, [swapChanged(s, "declined", me.id)]);
    return;
  }
  if (await blockedBetween(tx, me.id, s.learner_id)) throw refused("swap_not_found");
  await tx`update work.swaps set status = 'accepted', decided_at = now() where id = ${s.id}`;
  let back: string | null = null;
  if (s.offered_skill_id) {
    const r = await tx<{ id: string }[]>`
      insert into work.swaps (id, teacher_id, learner_id, skill_id, mutual_of, status, requested_at, expires_at, decided_at)
      values (gen_random_uuid(), ${s.learner_id}, ${me.id}, ${s.offered_skill_id}, ${s.id}, 'accepted', ${s.requested_at}, now(), now())
      on conflict do nothing returning id::text`;
    back = r[0]?.id ?? null;
    if (back) await tx`update work.swaps set mutual_of = ${back} where id = ${s.id}`;
  }
  // The DM: messaging opens it on demand once it knows the two may talk (thread ids stay messaging's).
  await publish(tx, [swapChanged(s, "accepted", me.id, { mutual: back !== null }), conversationAllowed(me.id, s.learner_id, "swap", true)]);
}

/** `cancel_swap_request(swap)`: the learner's open request. */
export async function cancelSwapRequest(tx: Tx, meId: string | null, swapId: string): Promise<void> {
  const me = await requireUser(tx, meId);
  const r = await tx`update work.swaps set status = 'cancelled', decided_at = now() where id = ${swapId} and learner_id = ${me.id} and status = 'requested' returning 1`;
  if (!r.length) throw refused("swap_request_closed");
}

interface SwapRow {
  id: string;
  status: string;
  teacher_id: string;
  learner_id: string;
  skill_id: string;
  mutual_of: string | null;
}

/** `require_swap_member(swap, lock)`. */
async function swapOf(tx: Tx, me: string, swapId: string): Promise<SwapRow> {
  const [s] = await tx<SwapRow[]>`
    select id::text, status, teacher_id::text, learner_id::text, skill_id, mutual_of::text from work.swaps
     where id = ${swapId} and (teacher_id = ${me} or learner_id = ${me}) for update`;
  if (!s) throw refused("swap_not_found");
  return s;
}

/** `end_swap(swap)`: either side ends it (and its swap back). */
export async function endSwap(tx: Tx, meId: string | null, swapId: string): Promise<void> {
  const me = await requireUser(tx, meId);
  const s = await swapOf(tx, me.id, swapId);
  if (s.status !== "accepted") throw refused("swap_not_open");
  await closeSwap(tx, s.id, "ended", me.id);
  if (s.mutual_of) await closeSwap(tx, s.mutual_of, "ended", me.id);
}

/**
 * `close_swap(swap, reason, by)`: proposed sessions are cancelled; with confirmed sessions the teacher earns a
 * "Taught" entry (credentials issues it from `swap.closed`: sessions, minutes, the last session's date).
 */
export async function closeSwap(tx: Tx, swapId: string, reason: "ended" | "inactive" | "blocked", by: string | null): Promise<void> {
  const [s] = await tx<SwapRow[]>`
    update work.swaps set status = 'closed', closed_at = now(), close_reason = ${reason}, closed_by = ${by}
     where id = ${swapId} and status = 'accepted' returning id::text, status, teacher_id::text, learner_id::text, skill_id, mutual_of::text`;
  if (!s) return;
  await tx`update work.swap_sessions set status = 'cancelled', responded_at = coalesce(responded_at, now()) where swap_id = ${s.id} and status = 'proposed'`;
  const [c] = await tx<{ sessions: number; minutes: number; last: string | null }[]>`
    select count(*)::int as sessions, coalesce(sum(confirmed_minutes), 0)::int as minutes, max((starts_at at time zone 'Asia/Karachi')::date)::text as last
      from work.swap_sessions where swap_id = ${s.id} and status = 'confirmed'`;
  const events: NewEvent[] = [swapChanged(s, "closed", by, { reason, sessions: c!.sessions })];
  if (c!.sessions > 0)
    events.push({
      type: "swap.closed",
      subjects: [s.id, s.teacher_id, s.learner_id],
      payload: { swap_id: s.id, teacher_id: s.teacher_id, learner_id: s.learner_id, skill_id: s.skill_id, sessions: c!.sessions, minutes: c!.minutes, last_session_on: c!.last },
    });
  await publish(tx, events);
}

/** `propose_swap_session(swap, starts_at, minutes, place)`. */
export async function proposeSwapSession(tx: Tx, meId: string | null, swapId: string, startsAt: string, minutes: number, place: string): Promise<string> {
  const me = await requireUser(tx, meId);
  const s = await swapOf(tx, me.id, swapId);
  const where = place.trim();
  if (s.status !== "accepted") throw refused("swap_not_open");
  const [ok] = await tx<{ ok: boolean }[]>`select ${startsAt}::timestamptz > now() and ${startsAt}::timestamptz <= now() + interval '60 days' as ok`;
  if (!ok!.ok) throw refused("swap_time_window");
  if (!Number.isInteger(minutes) || minutes < 15 || minutes > 240) throw refused("swap_minutes");
  if (where.length < 2 || where.length > 200) throw refused("swap_place");
  const max = await L.upcoming_sessions(tx);
  const [n] = await tx<{ n: number }[]>`select count(*)::int as n from work.swap_sessions where swap_id = ${s.id} and status in ('proposed', 'accepted') and starts_at > now()`;
  if (n!.n >= max) throw refusedWith("swap_upcoming_max", max);
  const [row] = await tx<{ id: string }[]>`
    insert into work.swap_sessions (id, swap_id, proposed_by, starts_at, minutes, place) values (gen_random_uuid(), ${s.id}, ${me.id}, ${startsAt}::timestamptz, ${minutes}, ${where})
    returning id::text`;
  await publish(tx, [swapChanged(s, "session_proposed", me.id, { session_id: row!.id })]);
  return row!.id;
}

async function sessionOf(tx: Tx, me: string, sessionId: string) {
  const [x0] = await tx<{ swap_id: string }[]>`select swap_id::text from work.swap_sessions where id = ${sessionId}`;
  if (!x0) throw refused("session_not_found");
  const s = await swapOf(tx, me, x0.swap_id);
  const [x] = await tx<{ id: string; status: string; proposed_by: string; future: boolean; starts_at: Date }[]>`
    select id::text, status, proposed_by::text, starts_at > now() as future, starts_at from work.swap_sessions where id = ${sessionId} for update`;
  return { s, x: x! };
}

/** `respond_swap_session(session, accept)`: the other side answers. */
export async function respondSwapSession(tx: Tx, meId: string | null, sessionId: string, accept: boolean): Promise<void> {
  const me = await requireUser(tx, meId);
  const { s, x } = await sessionOf(tx, me.id, sessionId);
  if (x.proposed_by === me.id) throw refused("session_other_side");
  if (x.status !== "proposed" || s.status !== "accepted") throw refused("session_not_open");
  if (accept && !x.future) throw refused("session_passed");
  await tx`update work.swap_sessions set status = ${accept ? "accepted" : "declined"}, responded_at = now() where id = ${x.id}`;
  if (accept) await publish(tx, [swapChanged(s, "session_accepted", me.id, { session_id: x.id })]);
}

/** `cancel_swap_session(session)`: an upcoming one. */
export async function cancelSwapSession(tx: Tx, meId: string | null, sessionId: string): Promise<void> {
  const me = await requireUser(tx, meId);
  const { x } = await sessionOf(tx, me.id, sessionId);
  const r = await tx`update work.swap_sessions set status = 'cancelled', responded_at = now() where id = ${x.id} and status in ('proposed', 'accepted') and starts_at > now() returning 1`;
  if (!r.length) throw refused("session_cancel_upcoming");
}

/** `confirm_swap_session(session, happened, minutes, reason, note)`: the learner confirms (10 hours a week a pair). */
export async function confirmSwapSession(tx: Tx, meId: string | null, sessionId: string, happened: boolean, minutes: number | null, reason: string | null, note: string | null): Promise<void> {
  const me = await requireUser(tx, meId);
  const { s, x } = await sessionOf(tx, me.id, sessionId);
  const text = note?.trim() || null;
  if (s.learner_id !== me.id) throw refused("session_learner_confirms");
  if (x.status !== "accepted" || s.status !== "accepted") throw refused("session_cant_confirm");
  if (x.future) throw refused("session_not_started");
  if (!happened) {
    if (!reason || !["teacher_absent", "learner_absent", "rescheduled", "other"].includes(reason)) throw refused("session_why");
    await tx`update work.swap_sessions set status = 'no_show', no_show_reason = ${reason}, responded_at = now() where id = ${x.id}`;
    return;
  }
  if (minutes === null || !Number.isInteger(minutes) || minutes < 15 || minutes > 240) throw refused("swap_minutes");
  if (text !== null && text.length > 280) throw refused("swap_note_280");
  const [a, b] = [s.teacher_id, s.learner_id].sort() as [string, string];
  await tx`select pg_advisory_xact_lock(hashtextextended(${"swap_pair:" + a + b}, 0))`;
  const [w] = await tx<{ n: number }[]>`
    select coalesce(sum(y.confirmed_minutes), 0)::int as n from work.swap_sessions y join work.swaps v on v.id = y.swap_id
     where y.status = 'confirmed' and y.starts_at > ${x.starts_at.toISOString()}::timestamptz - interval '7 days' and y.starts_at <= ${x.starts_at.toISOString()}::timestamptz + interval '7 days'
       and least(v.teacher_id, v.learner_id) = ${a}::uuid and greatest(v.teacher_id, v.learner_id) = ${b}::uuid`;
  const weekMax = await L.pair_week_minutes(tx);
  if (w!.n + minutes > weekMax) throw refusedWith("swap_week_hours", weekMax / 60);
  await tx`update work.swap_sessions set status = 'confirmed', confirmed_minutes = ${minutes}, confirmed_at = now(), responded_at = now() where id = ${x.id}`;
  const events: NewEvent[] = [];
  if (text !== null) {
    const [n] = await tx<{ id: string }[]>`
      insert into work.swap_notes (id, swap_id, session_id, author_id, teacher_id, body) values (gen_random_uuid(), ${s.id}, ${x.id}, ${me.id}, ${s.teacher_id}, ${text}) returning id::text`;
    events.push(swapChanged(s, "note_written", me.id, { session_id: x.id, note_id: n!.id }));
  }
  await publish(tx, events);
  await swapFlags(tx, s);
}

/** `swap_flags(swap)`: repeated rapid confirmations by a pair, and three-person rings, for ranking (W6). */
async function swapFlags(tx: Tx, s: SwapRow): Promise<void> {
  const pair = [s.teacher_id, s.learner_id].sort();
  const hours = await L.rapid_hours(tx);
  const [rep] = await tx<{ n: number; ids: string[] }[]>`
    select count(*)::int as n, coalesce(array_agg(distinct w.id::text), '{}') as ids from work.swap_sessions x join work.swaps w on w.id = x.swap_id
     where x.status = 'confirmed' and x.confirmed_at > now() - make_interval(hours => ${hours})
       and least(w.teacher_id, w.learner_id) = ${pair[0]!}::uuid and greatest(w.teacher_id, w.learner_id) = ${pair[1]!}::uuid`;
  const events: NewEvent[] = [];
  if (rep!.n >= (await L.rapid_confirms(tx)))
    events.push({ type: "swap.flagged", subjects: pair, payload: { kind: "swap_repeat", members: pair, swap_ids: rep!.ids, confirmations: rep!.n, hours } });
  const days = await L.ring_days(tx);
  const thirds = await tx<{ third: string }[]>`
    select distinct b.learner_id::text as third from work.swaps b join work.swaps d on d.teacher_id = b.learner_id and d.learner_id = ${s.teacher_id}
     where b.teacher_id = ${s.learner_id} and b.learner_id not in (${s.teacher_id}, ${s.learner_id})
       and exists (select 1 from work.swap_sessions x where x.swap_id = b.id and x.status = 'confirmed' and x.confirmed_at > now() - make_interval(days => ${days}))
       and exists (select 1 from work.swap_sessions x where x.swap_id = d.id and x.status = 'confirmed' and x.confirmed_at > now() - make_interval(days => ${days}))
     order by 1`;
  for (const t of thirds) {
    const members = [s.teacher_id, s.learner_id, t.third].sort();
    events.push({ type: "swap.flagged", subjects: members, payload: { kind: "swap_ring", members, window_days: days } });
  }
  await publish(tx, events);
}

/** `decide_swap_note(note, approve)`: the teacher approves a thank-you note for their profile. */
export async function decideSwapNote(tx: Tx, meId: string | null, noteId: string, approve: boolean): Promise<void> {
  const me = await requireUser(tx, meId);
  const r = await tx`update work.swap_notes set status = ${approve ? "approved" : "declined"}, decided_at = now() where id = ${noteId} and teacher_id = ${me.id} and status = 'pending' returning 1`;
  if (!r.length) throw refused("swap_note_not_waiting");
}

/** `swaps_on_block`: a block cancels open requests between the two and closes their swaps. */
export async function swapsOnBlock(tx: Tx, a: string, b: string): Promise<void> {
  await tx`
    update work.swaps set status = 'cancelled', decided_at = now()
     where status = 'requested' and ((teacher_id = ${a} and learner_id = ${b}) or (teacher_id = ${b} and learner_id = ${a}))`;
  const open = await tx<{ id: string }[]>`
    select id::text from work.swaps where status = 'accepted' and ((teacher_id = ${a} and learner_id = ${b}) or (teacher_id = ${b} and learner_id = ${a})) order by id`;
  for (const s of open) await closeSwap(tx, s.id, "blocked", null);
}

/** `swap_tick()` (every 15 minutes): expiries, day-before reminders, "did it happen?", inactive swaps. */
export async function swapTick(tx: Tx): Promise<number> {
  const expired = await tx<SwapRow[]>`
    update work.swaps set status = 'expired', decided_at = now() where status = 'requested' and expires_at <= now()
    returning id::text, status, teacher_id::text, learner_id::text, skill_id, mutual_of::text`;
  const reminded = await tx<(SwapRow & { session_id: string })[]>`
    update work.swap_sessions x set reminded_at = now() from work.swaps s
     where s.id = x.swap_id and s.status = 'accepted' and x.status = 'accepted' and x.reminded_at is null and x.starts_at > now() and x.starts_at <= now() + interval '24 hours'
    returning s.id::text, s.status, s.teacher_id::text, s.learner_id::text, s.skill_id, s.mutual_of::text, x.id::text as session_id`;
  const asked = await tx<(SwapRow & { session_id: string })[]>`
    update work.swap_sessions x set asked_at = now() from work.swaps s
     where s.id = x.swap_id and s.status = 'accepted' and x.status = 'accepted' and x.asked_at is null and x.starts_at + make_interval(mins => x.minutes) <= now()
    returning s.id::text, s.status, s.teacher_id::text, s.learner_id::text, s.skill_id, s.mutual_of::text, x.id::text as session_id`;
  await publish(tx, [
    ...expired.map((s) => swapChanged(s, "expired", null)),
    ...reminded.map((s) => swapChanged(s, "session_reminder", null, { session_id: s.session_id })),
    ...asked.map((s) => swapChanged(s, "session_ask", null, { session_id: s.session_id })),
  ]);
  const days = await L.inactive_days(tx);
  const inactive = await tx<{ id: string }[]>`
    select s.id::text from work.swaps s
     where s.status = 'accepted'
       and greatest(s.decided_at, (select max(x.starts_at) from work.swap_sessions x where x.swap_id = s.id and x.status in ('accepted', 'confirmed', 'proposed')))
           < now() - make_interval(days => ${days})
     order by s.id`;
  for (const s of inactive) await closeSwap(tx, s.id, "inactive", null);
  return expired.length + reminded.length + asked.length + inactive.length;
}

// ---- Reads (names, usernames and avatars from people) ----

const minutesTaught = (db: Db, column: string) => db`(
  select coalesce(sum(x.confirmed_minutes), 0)::int from work.swap_sessions x join work.swaps s on s.id = x.swap_id where s.teacher_id = ${db(column)} and x.status = 'confirmed')`;

/** `swap_teachers(skill)`: teachers of a skill at the reader's university, most minutes taught first. */
export async function swapTeachers(db: Db, me: string, universityId: string | null, skill: string) {
  return db<{ user_id: string; level: number; note: string | null; minutes: number; notes: string[]; open: boolean }[]>`
    select o.user_id::text, u.level, o.note, ${minutesTaught(db, "o.user_id")} as minutes,
           coalesce((select array_agg(n.body order by n.decided_at desc) from (select n.body, n.decided_at from work.swap_notes n
                      where n.teacher_id = o.user_id and n.status = 'approved' order by n.decided_at desc limit 3) n), '{}') as notes,
           exists (select 1 from work.swaps s where s.status in ('requested', 'accepted') and s.skill_id = ${skill}
                    and least(s.teacher_id, s.learner_id) = least(o.user_id, ${me}::uuid) and greatest(s.teacher_id, s.learner_id) = greatest(o.user_id, ${me}::uuid)) as open
      from work.swap_offers o
      join work.user_skills u on u.user_id = o.user_id and u.skill_id = o.skill_id and u.level >= 2
      join work.members p on p.user_id = o.user_id and p.university_id = ${universityId}::uuid and coalesce(p.status, '') <> 'deleting' and p.role = 'student'
     where o.skill_id = ${skill} and o.user_id <> ${me}
       and not exists (select 1 from work.blocks b where (b.blocker_id = ${me} and b.blocked_id = o.user_id) or (b.blocker_id = o.user_id and b.blocked_id = ${me}))
     order by 4 desc, o.user_id limit 50`;
}

/** `swaps_page()`: what the reader can teach, wants, the requests waiting for them, their swaps. */
export async function swapsPage(tx: Tx, meId: string | null) {
  const me = await requireUser(tx, meId);
  const teachable = await tx<{ skill_id: string; name: string; level: number; offered: boolean; note: string | null; wanted_by: number }[]>`
    select u.skill_id, k.name, u.level, o.user_id is not null as offered, o.note,
           (select count(*)::int from work.swap_wants w join work.members p on p.user_id = w.user_id
             where w.skill_id = u.skill_id and w.user_id <> ${me.id} and p.university_id = ${me.university_id}::uuid) as wanted_by
      from work.user_skills u join work.skills k on k.id = u.skill_id and k.retired_at is null
      left join work.swap_offers o on o.user_id = ${me.id} and o.skill_id = u.skill_id
     where u.user_id = ${me.id} and u.level >= 2 order by u.level desc, k.name`;
  const wantRows = await tx<{ skill_id: string; name: string; note: string | null }[]>`
    select w.skill_id, k.name, w.note from work.swap_wants w join work.skills k on k.id = w.skill_id where w.user_id = ${me.id} order by w.created_at`;
  const wants = [];
  for (const w of wantRows) wants.push({ ...w, teachers: await swapTeachers(tx, me.id, me.university_id, w.skill_id) });
  const requests = await tx<{ id: string; skill: string; learner_id: string; note: string | null; preferred_times: string | null; offered_skill: string | null; expires_at: Date }[]>`
    select s.id::text, k.name as skill, s.learner_id::text, s.note, s.preferred_times, (select name from work.skills where id = s.offered_skill_id) as offered_skill, s.expires_at
      from work.swaps s join work.skills k on k.id = s.skill_id
     where s.teacher_id = ${me.id} and s.status = 'requested' and s.expires_at > now() order by s.requested_at`;
  const swaps = await tx<{ id: string; role: string; status: string; skill: string; other_id: string; requested_at: Date; closed_at: Date | null; sessions: number; next_session: Date | null }[]>`
    select s.id::text, case when s.teacher_id = ${me.id} then 'teacher' else 'learner' end as role, s.status, k.name as skill,
           (case when s.teacher_id = ${me.id} then s.learner_id else s.teacher_id end)::text as other_id, s.requested_at, s.closed_at,
           (select count(*)::int from work.swap_sessions x where x.swap_id = s.id and x.status = 'confirmed') as sessions,
           (select min(x.starts_at) from work.swap_sessions x where x.swap_id = s.id and x.status = 'accepted' and x.starts_at > now()) as next_session
      from work.swaps s join work.skills k on k.id = s.skill_id
     where (s.teacher_id = ${me.id} or s.learner_id = ${me.id})
       and (s.status in ('requested', 'accepted') or coalesce(s.closed_at, s.decided_at, s.expires_at) > now() - interval '90 days')
     order by case s.status when 'accepted' then 0 when 'requested' then 1 else 2 end, s.requested_at desc`;
  const [m] = await tx<{ minutes: number; pending: number }[]>`
    select ${minutesTaught(tx, "u.id")} as minutes, (select count(*)::int from work.swap_notes n where n.teacher_id = u.id and n.status = 'pending') as pending
      from (select ${me.id}::uuid as id) u`;
  return { teachable, wants, requests, swaps, minutesTaught: m!.minutes, notesPending: m!.pending };
}

/** `swap_page(swap)`: one swap for either side (the other person's face from people). */
export async function swapPage(tx: Tx, meId: string | null, swapId: string) {
  const me = await requireUser(tx, meId);
  const [s] = await tx<{
    id: string; role: string; status: string; skill_id: string; skill_name: string; teacher_level: number | null; other_id: string; note: string | null; preferred_times: string | null;
    offered_skill: string | null; mutual_id: string | null; mutual_skill: string | null; requested_at: Date; expires_at: Date; decided_at: Date | null; closed_at: Date | null; close_reason: string | null;
    sessions_confirmed: number; minutes_confirmed: number;
  }[]>`
    select s.id::text, case when s.teacher_id = ${me.id} then 'teacher' else 'learner' end as role, s.status, s.skill_id, k.name as skill_name,
           (select u.level from work.user_skills u where u.user_id = s.teacher_id and u.skill_id = s.skill_id) as teacher_level,
           (case when s.teacher_id = ${me.id} then s.learner_id else s.teacher_id end)::text as other_id, s.note, s.preferred_times,
           (select name from work.skills where id = s.offered_skill_id) as offered_skill, s.mutual_of::text as mutual_id,
           (select k2.name from work.swaps m join work.skills k2 on k2.id = m.skill_id where m.id = s.mutual_of) as mutual_skill,
           s.requested_at, s.expires_at, s.decided_at, s.closed_at, s.close_reason,
           (select count(*)::int from work.swap_sessions x where x.swap_id = s.id and x.status = 'confirmed') as sessions_confirmed,
           (select coalesce(sum(x.confirmed_minutes), 0)::int from work.swap_sessions x where x.swap_id = s.id and x.status = 'confirmed') as minutes_confirmed
      from work.swaps s join work.skills k on k.id = s.skill_id where s.id = ${swapId} and (s.teacher_id = ${me.id} or s.learner_id = ${me.id})`;
  if (!s) throw refused("swap_not_found");
  const sessions = await tx<{ id: string; starts_at: Date; minutes: number; place: string; status: string; proposed_by_me: boolean; confirmed_minutes: number | null; no_show_reason: string | null; note_id: string | null; note_body: string | null; note_status: string | null }[]>`
    select x.id::text, x.starts_at, x.minutes, x.place, x.status, x.proposed_by = ${me.id}::uuid as proposed_by_me, x.confirmed_minutes, x.no_show_reason,
           n.id::text as note_id, n.body as note_body, n.status as note_status
      from work.swap_sessions x left join work.swap_notes n on n.session_id = x.id where x.swap_id = ${s.id} order by x.starts_at desc`;
  return { ...s, blocked: await blockedBetween(tx, me.id, s.other_id), sessions };
}

/** `swap_notes_for(user)`: approved thank-you notes on a profile the reader may see (authors from people). */
export async function swapNotesFor(tx: Tx, meId: string | null, userId: string) {
  const me = await requireUser(tx, meId);
  const [ok] = await tx<{ ok: boolean }[]>`select ${canViewProfile(tx, me.id, "p.uid")} as ok from (select ${userId}::uuid as uid) p`;
  if (!ok!.ok || (await blockedBetween(tx, me.id, userId))) return { minutes: 0, notes: [] };
  const [m] = await tx<{ minutes: number }[]>`select ${minutesTaught(tx, "p.uid")} as minutes from (select ${userId}::uuid as uid) p`;
  const notes = await tx<{ body: string; author_id: string; skill: string; decided_at: Date }[]>`
    select n.body, n.author_id::text, k.name as skill, n.decided_at
      from (select * from work.swap_notes where teacher_id = ${userId} and status = 'approved' order by decided_at desc limit 10) n
      join work.swaps s on s.id = n.swap_id join work.skills k on k.id = s.skill_id
     where not exists (select 1 from work.blocks b where (b.blocker_id = ${me.id} and b.blocked_id = n.author_id) or (b.blocker_id = n.author_id and b.blocked_id = ${me.id}))
     order by n.decided_at desc`;
  return { minutes: m!.minutes, notes };
}
