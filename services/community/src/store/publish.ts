import { appendEvents, publishRealtime, uuidv7, type NewEvent } from "@skilient/platform";
import type { Tx } from "./db";

/**
 * Community's events, built in one place (packages/contracts/events.json is the obligation list; payloads carry
 * ids, enums, flags, counts and hashes only). Each write appends its events in its own transaction (withWrite),
 * so an event is published exactly when its change commits. Notices the stack sent with private.notify() are
 * these events; notify (W9) words them and reads any text back from community.
 */
export const publish = (tx: Tx, events: NewEvent[]) => (events.length ? appendEvents(tx, events) : Promise.resolve());

export const societyStatusChanged = (s: { id: string; university_id: string; status: string; verified_at: Date | null; created_by: string | null }, previous: string | null, requester: string | null, actor: string | null): NewEvent => ({
  type: "society.status_changed",
  subjects: [s.id, ...(requester ? [requester] : [])],
  payload: {
    society_id: s.id,
    university_id: s.university_id,
    status: s.status,
    previous_status: previous,
    verified_at: s.verified_at ? new Date(s.verified_at).toISOString() : null,
    requester_id: requester,
    actor_id: actor,
  },
});

export const societyVerified = (s: { id: string; university_id: string; category: string; verified_at: Date | null }, requester: string | null): NewEvent => ({
  type: "society.verified",
  subjects: [s.id],
  payload: { society_id: s.id, university_id: s.university_id, category: s.category, verified_at: s.verified_at ? new Date(s.verified_at).toISOString() : null, requester_id: requester },
});

/** group.member_changed {kind society}: people's labels, content's "post as", messaging, notify, trust. */
export const memberChanged = (societyId: string, userId: string, role: "member" | "officer" | "president" | null, actor: string | null): NewEvent => ({
  type: "group.member_changed",
  subjects: [societyId, userId],
  payload: { kind: "society", group_id: societyId, user_id: userId, member: role !== null, ...(role ? { role } : {}), actor_id: actor },
});

export const inviteChanged = (i: { id: string; society_id: string; kind: string; invitee_id: string; invited_by: string | null; status: string }): NewEvent => ({
  type: "society.invite_changed",
  subjects: [i.id, i.invitee_id, ...(i.invited_by ? [i.invited_by] : [])],
  payload: { invite_id: i.id, society_id: i.society_id, kind: i.kind, invitee_id: i.invitee_id, invited_by: i.invited_by, status: i.status },
});

export const joinChanged = (societyId: string, userId: string, status: "requested" | "accepted", actor: string | null): NewEvent => ({
  type: "society.join_changed",
  subjects: [societyId, userId],
  payload: { society_id: societyId, user_id: userId, status, actor_id: actor },
});

export const termChanged = (
  t: { id: string; society_id: string; user_id: string; role: string; term_start: string; term_end: string; confirmed_by: string | null },
  status: "ended" | "confirmed",
): NewEvent => ({
  type: "society.term_changed",
  subjects: [t.id, t.user_id],
  payload: {
    term_id: t.id,
    society_id: t.society_id,
    user_id: t.user_id,
    role: t.role,
    status,
    term_start: t.term_start,
    term_end: t.term_end,
    confirmed_by: t.confirmed_by,
    self_confirmed: t.confirmed_by === t.user_id,
  },
});

export const inductionChanged = (r: { id: string; society_id: string; university_id: string; status: string; deadline: Date }, actor: string | null): NewEvent => ({
  type: "induction.changed",
  subjects: [r.id, r.society_id],
  payload: { round_id: r.id, society_id: r.society_id, university_id: r.university_id, status: r.status, deadline: new Date(r.deadline).toISOString(), actor_id: actor },
});

export const applicationChanged = (a: { id: string; round_id: string; society_id: string; applicant_id: string; status: string }, actor: string | null, expired = false): NewEvent => ({
  type: "induction_application.changed",
  subjects: [a.id, a.applicant_id],
  payload: { application_id: a.id, round_id: a.round_id, society_id: a.society_id, applicant_id: a.applicant_id, status: a.status, expired, actor_id: actor },
});

export const eventUpdated = (
  e: { id: string; society_id: string; university_id: string; status: string; starts_at: Date },
  previous: string | null,
  change: "published" | "details" | "cancelled" | "status",
  paid: boolean,
  actor: string | null,
): NewEvent => ({
  type: "event.updated",
  subjects: [e.id, e.society_id],
  payload: { event_id: e.id, society_id: e.society_id, university_id: e.university_id, status: e.status, previous_status: previous, change, starts_at: new Date(e.starts_at).toISOString(), paid, actor_id: actor },
});

export type RegistrationReason = "registered" | "promoted" | "decided" | "cancelled" | "hold_expired" | "walk_in";
export const registered = (
  r: { id: string; event_id: string; society_id: string; user_id: string; status: string; waitlist_position: number | null },
  previous: string | null,
  reason: RegistrationReason,
  paid: boolean,
  actor: string | null,
): NewEvent => ({
  type: "event.registered",
  subjects: [r.id, r.user_id, r.event_id],
  payload: {
    registration_id: r.id,
    event_id: r.event_id,
    society_id: r.society_id,
    user_id: r.user_id,
    status: r.status,
    previous_status: previous,
    waitlist_position: r.waitlist_position,
    reason,
    paid,
    actor_id: actor,
  },
});

export const reminderDue = (eventId: string, userIds: string[], when: "24h" | "1h", startsAt: Date): NewEvent => ({
  type: "event.reminder_due",
  subjects: [eventId, ...userIds],
  payload: { event_id: eventId, user_ids: userIds, when, starts_at: new Date(startsAt).toISOString() },
});

export const checkedIn = (c: { id: string; event_id: string; session_id: string; user_id: string | null; method: string }, present: boolean): NewEvent => ({
  type: "ticket.checked_in",
  subjects: [c.id, c.event_id, ...(c.user_id ? [c.user_id] : [])],
  payload: { checkin_id: c.id, event_id: c.event_id, session_id: c.session_id, user_id: c.user_id, method: c.method, present },
});

export const eventClosed = (eventId: string, payload: Record<string, unknown>, users: string[]): NewEvent => ({
  type: "event.closed",
  subjects: [eventId, ...users],
  payload: { event_id: eventId, ...payload },
});

export const cohostChanged = (eventId: string, societyId: string, hostId: string, status: string, actor: string | null): NewEvent => ({
  type: "event.cohost_changed",
  subjects: [eventId, societyId],
  payload: { event_id: eventId, society_id: societyId, host_society_id: hostId, status, actor_id: actor },
});

export const staffChanged = (eventId: string, userId: string, staff: boolean, actor: string | null): NewEvent => ({
  type: "event.staff_changed",
  subjects: [eventId, userId],
  payload: { event_id: eventId, user_id: userId, staff, actor_id: actor },
});

export const messageSent = (messageId: string, eventId: string, sender: string, recipients: number): NewEvent => ({
  type: "event.message_sent",
  subjects: [messageId, eventId],
  payload: { message_id: messageId, event_id: eventId, sender_id: sender, recipients },
});

export type PaymentChange =
  | "opened"
  | "submitted"
  | "issue"
  | "approved"
  | "rejected"
  | "refund_requested"
  | "refund_sent"
  | "refund_received"
  | "refund_disputed"
  | "released";
export const paymentChanged = (
  p: { id: string; registration_id: string; event_id: string; society_id: string; user_id: string; status: string; refund_status: string | null },
  change: PaymentChange,
  actor: string | null,
): NewEvent => ({
  type: "payment.changed",
  subjects: [p.id, p.user_id, p.event_id],
  payload: {
    payment_id: p.id,
    registration_id: p.registration_id,
    event_id: p.event_id,
    society_id: p.society_id,
    user_id: p.user_id,
    status: p.status,
    refund_status: p.refund_status,
    change,
    actor_id: actor,
  },
});

export const methodChanged = (m: { id: string; society_id: string; action: string; status: string }, actor: string | null): NewEvent => ({
  type: "payment_method.changed",
  subjects: [m.id, m.society_id],
  payload: { method_id: m.id, society_id: m.society_id, action: m.action, status: m.status, actor_id: actor },
});

export const paymentDisputed = (
  p: { id: string; registration_id: string; event_id: string; society_id: string; user_id: string },
  presidentId: string | null,
  reason: "unconfirmed_payment" | "refund_disputed" | "refund_unmarked",
): NewEvent => ({
  type: "payment.disputed",
  subjects: [p.id, p.user_id, p.event_id],
  payload: { payment_id: p.id, registration_id: p.registration_id, event_id: p.event_id, society_id: p.society_id, user_id: p.user_id, president_id: presidentId, reason },
});

export type Bucket = "society-documents" | "society-media" | "event-receipts";
/** A replaced or expired file: media deletes it (storage_cleanup on the stack). */
export const fileReleased = (bucket: Bucket, path: string | null, owner: string | null): NewEvent[] =>
  path ? [{ type: "community_file.released", subjects: [owner ?? path.slice(0, 36)], payload: { bucket, path, owner_id: owner } }] : [];

/** One staff action's audit row and its `audit.recorded` event (ids only), in the action's transaction. */
export async function audit(
  tx: Tx,
  row: { staffId: string; action: string; targetType: string; targetId: string; reason: string; before: unknown; after: unknown },
): Promise<void> {
  const id = uuidv7();
  await tx`
    insert into community.audit_log (id, staff_id, action, target_type, target_id, reason, before, after)
    values (${id}, ${row.staffId}, ${row.action}, ${row.targetType}, ${row.targetId}, ${row.reason},
            ${JSON.stringify(row.before ?? {})}::text::jsonb, ${JSON.stringify(row.after ?? {})}::text::jsonb)`;
  await appendEvents(tx, [{ type: "audit.recorded", subjects: [row.staffId], payload: { audit_id: id, action: row.action, target_type: row.targetType, target_id: row.targetId } }]);
}

/** The live headcount on event:{id} (realtime), sent when the check-in commits. */
export async function headcount(tx: Tx, eventId: string, sessionId: string): Promise<void> {
  const [r] = await tx<{ n: number }[]>`select count(*)::int as n from community.event_checkins where session_id = ${sessionId} and removed_at is null`;
  await publishRealtime(tx, { topic: `event:${eventId}`, event: "headcount", payload: { session_id: sessionId, checked_in: r!.n } });
}
