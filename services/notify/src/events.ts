import { COPY_EVENTS, NOTICE_TYPES } from "./store/consumers";

/**
 * What notify publishes and handles. Every type is listed in packages/contracts/events.json, and
 * tools/lint/test/events.test.ts keeps the two in step with the code.
 */
export const events = {
  publishes: ["badge.count_changed", "user.deletion_confirmed"],
  handles: [...COPY_EVENTS, ...NOTICE_TYPES],
} as const;
