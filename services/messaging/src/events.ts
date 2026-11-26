import { COPY_EVENTS } from "./store/copies";

/**
 * What messaging publishes and handles. Every type is listed in packages/contracts/events.json, and
 * tools/lint/test/events.test.ts keeps the two in step with the code. Live delivery is a NOTIFY to realtime,
 * not an event.
 */
export const events = {
  publishes: ["badge.count_changed", "message.deleted", "message.sent", "thread.read", "user.deletion_confirmed"],
  handles: [...COPY_EVENTS],
} as const;
