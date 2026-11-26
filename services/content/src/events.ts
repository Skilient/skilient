import { COPY_EVENTS } from "./store/copies";

/**
 * What content publishes and handles. Every type is listed in packages/contracts/events.json, and
 * tools/lint/test/events.test.ts keeps the two in step with the code.
 */
export const events = {
  publishes: ["comment.created", "post.created", "post.removed", "survey.answered", "user.deletion_confirmed"],
  handles: [...COPY_EVENTS],
} as const;
