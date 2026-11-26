import { COPY_EVENTS } from "./store/copies";

/**
 * What ranking publishes and handles. Every type is listed in packages/contracts/events.json, and
 * tools/lint/test/events.test.ts keeps the two in step with the code.
 */
export const events = {
  publishes: ["tier.changed", "ranking.published", "fact.value_changed", "ranking_flag.changed", "audit.recorded", "user.deletion_confirmed"],
  handles: [...COPY_EVENTS],
} as const;
