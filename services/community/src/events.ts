import { COPY_EVENTS } from "./store/copies";

/**
 * What community publishes and handles. Every type is listed in packages/contracts/events.json, and
 * tools/lint/test/events.test.ts keeps the two in step with the code.
 */
export const events = {
  publishes: [
    "society.status_changed",
    "society.verified",
    "group.member_changed",
    "society.invite_changed",
    "society.join_changed",
    "society.term_changed",
    "induction.changed",
    "induction_application.changed",
    "event.updated",
    "event.registered",
    "event.reminder_due",
    "ticket.checked_in",
    "event.closed",
    "event.cohost_changed",
    "event.staff_changed",
    "event.message_sent",
    "payment.changed",
    "payment_method.changed",
    "payment.disputed",
    "community_file.released",
    "audit.recorded",
    "user.deletion_confirmed",
  ],
  handles: [...COPY_EVENTS],
} as const;
