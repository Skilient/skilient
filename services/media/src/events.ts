import { MEDIA_EVENTS } from "./consumers";

/**
 * What media publishes and handles. Every type is listed in packages/contracts/events.json, and
 * tools/lint/test/events.test.ts keeps the two in step with the code.
 */
export const events = {
  publishes: ["user.deletion_confirmed"],
  handles: [...MEDIA_EVENTS],
} as const;
