import { appendEvents, createConsumer, type Consumer, type LoggedEvent, type Logger, type NewEvent } from "@skilient/platform";
import type postgres from "postgres";
import { z } from "zod";
import type { Tx } from "./db";
import { fileReleased, memberChanged, termChanged } from "./publish";

/**
 * Community's event-fed copies (one consumer, `community.copies`). Each event type has one owning producer role;
 * anything else is logged and dropped. Idempotent throughout.
 *
 * | Event (v1)         | From     | Effect                                                                          |
 * | ------------------ | -------- | ------------------------------------------------------------------------------- |
 * | profile.updated    | people   | a members row: role, university, status, department hash, batch, onboarding     |
 * | friendship.changed | people   | "friends going" on event cards                                                  |
 * | user.deleted       | identity | the user's rows, as the stack's cascades did; user.deletion_confirmed           |
 */
export const COPIES_CONSUMER = "community.copies";
export const COPY_EVENTS = ["profile.updated", "friendship.changed", "user.deleted"] as const;

const OWNER: Record<(typeof COPY_EVENTS)[number], readonly string[]> = {
  "profile.updated": ["svc_people"],
  "friendship.changed": ["svc_people"],
  "user.deleted": ["svc_identity"],
};

const id = z.uuid();
const S = {
  profile: z.object({
    user_id: id,
    role: z.string().max(40),
    university_id: id.nullable(),
    department_hash: z.string().max(80).nullable().optional(),
    graduation_year: z.number().int().nullable().optional(),
    status: z.string().max(40),
    onboarding_complete: z.boolean(),
  }),
  friendship: z.object({ user_a: id, user_b: id, friends: z.boolean() }),
};

export type CopyOutcome = "applied" | "ignored" | "wrong_producer" | "invalid_payload" | "unknown_type";

/** Applies one event (the consumer's handler; exported for tests and replays). */
export async function applyCopyEvent(tx: Tx, event: Pick<LoggedEvent, "type" | "producer" | "payload" | "version" | "subjects">): Promise<CopyOutcome> {
  if (event.version !== 1) return "invalid_payload";
  const type = event.type as (typeof COPY_EVENTS)[number];
  if (!(type in OWNER)) return "unknown_type";
  if (!OWNER[type].includes(event.producer)) return "wrong_producer";
  switch (type) {
    case "profile.updated": {
      const r = S.profile.safeParse(event.payload);
      if (!r.success) return "invalid_payload";
      const p = r.data;
      await tx`
        insert into community.members (user_id, role, university_id, department_hash, graduation_year, status, onboarding_complete)
        values (${p.user_id}, ${p.role}, ${p.university_id}, ${p.department_hash ?? null}, ${p.graduation_year ?? null}, ${p.status}, ${p.onboarding_complete})
        on conflict (user_id) do update set role = excluded.role, university_id = excluded.university_id, department_hash = excluded.department_hash,
          graduation_year = excluded.graduation_year, status = excluded.status, onboarding_complete = excluded.onboarding_complete, updated_at = now()`;
      return "applied";
    }
    case "friendship.changed": {
      const r = S.friendship.safeParse(event.payload);
      if (!r.success) return "invalid_payload";
      const [a, b] = r.data.user_a < r.data.user_b ? [r.data.user_a, r.data.user_b] : [r.data.user_b, r.data.user_a];
      if (r.data.friends) await tx`insert into community.friendships (user_id_a, user_id_b) values (${a}, ${b}) on conflict do nothing`;
      else await tx`delete from community.friendships where user_id_a = ${a} and user_id_b = ${b}`;
      return "applied";
    }
    case "user.deleted": {
      const user = event.subjects[0] ?? (typeof event.payload["user_id"] === "string" ? event.payload["user_id"] : null);
      if (!user || !id.safeParse(user).success) return "invalid_payload";
      await deleteUser(tx, user);
      return "applied";
    }
  }
}

/**
 * user.deleted, as the stack's cascades from auth.users did: the user's memberships (a president's society keeps
 * its other members; its president seat is empty until staff act, as on the stack), terms, invites, requests,
 * follows, applications, registrations, check-ins, results, hours, feedback, staff seats and payments (their
 * receipts released to media). Societies the user created stay (created_by on the stack was set null) and their
 * requests go (they cascaded from the account).
 */
export async function deleteUser(tx: Tx, userId: string): Promise<void> {
  const events: NewEvent[] = [];
  const memberships = await tx<{ society_id: string }[]>`delete from community.society_members where user_id = ${userId} returning society_id::text`;
  events.push(...memberships.map((m) => memberChanged(m.society_id, userId, null, null)));
  const terms = await tx<{ id: string; society_id: string; user_id: string; role: string; term_start: string; term_end: string; confirmed_by: string | null }[]>`
    delete from community.society_terms where user_id = ${userId} and ended_at is null
    returning id::text, society_id::text, user_id::text, role, term_start::text, term_end::text, confirmed_by::text`;
  events.push(...terms.map((t) => termChanged(t, "ended")));
  await tx`delete from community.society_terms where user_id = ${userId}`;
  await tx`update community.society_terms set confirmed_by = null, confirmed_at = null where confirmed_by = ${userId}`;
  await tx`delete from community.society_invites where invitee_id = ${userId}`;
  await tx`update community.society_invites set invited_by = null where invited_by = ${userId}`;
  await tx`delete from community.society_join_requests where user_id = ${userId}`;
  await tx`delete from community.society_follows where user_id = ${userId}`;
  const proofs = await tx<{ proof_path: string | null }[]>`delete from community.society_requests where requester_id = ${userId} returning proof_path`;
  for (const p of proofs) events.push(...fileReleased("society-documents", p.proof_path, userId));
  await tx`update community.societies set created_by = null where created_by = ${userId}`;
  await tx`update community.societies set verified_by = null where verified_by = ${userId}`;
  await tx`update community.society_requests set claimed_by = null where claimed_by = ${userId}`;
  await tx`delete from community.induction_applications where applicant_id = ${userId}`;
  await tx`update community.induction_applications set decided_by = null where decided_by = ${userId}`;
  await tx`update community.induction_rounds set created_by = null where created_by = ${userId}`;
  const receipts = await tx<{ receipt_path: string | null }[]>`delete from community.event_payments where user_id = ${userId} returning receipt_path`;
  for (const r of receipts) events.push(...fileReleased("event-receipts", r.receipt_path, userId));
  await tx`update community.event_payments set decided_by = null where decided_by = ${userId}`;
  await tx`delete from community.event_checkins where user_id = ${userId}`;
  await tx`update community.event_checkins set checked_in_by = null where checked_in_by = ${userId}`;
  await tx`update community.event_checkins set removed_by = null where removed_by = ${userId}`;
  await tx`delete from community.event_registrations where user_id = ${userId}`;
  await tx`update community.event_registrations set added_by = null where added_by = ${userId}`;
  await tx`delete from community.event_results where user_id = ${userId}`;
  await tx`delete from community.volunteer_logs where user_id = ${userId}`;
  await tx`delete from community.event_feedback where user_id = ${userId}`;
  await tx`delete from community.event_staff where user_id = ${userId}`;
  await tx`update community.event_teams set captain_id = null where captain_id = ${userId}`;
  await tx`update community.event_email_attendees set claimed_by = null where claimed_by = ${userId}`;
  await tx`update community.event_messages set sender_id = null where sender_id = ${userId}`;
  await tx`update community.events set created_by = null where created_by = ${userId}`;
  await tx`update community.society_payment_methods set proposed_by = null where proposed_by = ${userId}`;
  await tx`update community.society_payment_methods set confirmed_by = null where confirmed_by = ${userId}`;
  await tx`update community.society_audit_log set actor_id = null where actor_id = ${userId}`;
  await tx`delete from community.members where user_id = ${userId}`;
  await tx`delete from community.friendships where user_id_a = ${userId} or user_id_b = ${userId}`;
  events.push({ type: "user.deletion_confirmed", subjects: [userId], payload: { user_id: userId } });
  await appendEvents(tx, events);
}

export function copiesConsumer(options: { sql: postgres.Sql; logger?: Logger; pollMs?: number }): Consumer {
  return createConsumer({
    sql: options.sql,
    name: COPIES_CONSUMER,
    types: COPY_EVENTS,
    pollMs: options.pollMs,
    logger: options.logger,
    handle: async (tx, event) => {
      const outcome = await applyCopyEvent(tx, event);
      if (outcome !== "applied" && outcome !== "ignored") options.logger?.warn("copies.skipped", { action: `consume.${event.type}`, outcome: "skipped", error_code: outcome });
    },
  });
}
