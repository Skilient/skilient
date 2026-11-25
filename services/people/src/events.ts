import { COPY_EVENTS } from "./store/copies";
import { LIFECYCLE_EVENTS } from "./store/lifecycle";

/**
 * What people publishes and handles. Every type is listed in packages/contracts/events.json, and
 * tools/lint/test/events.test.ts keeps the two in step with the code.
 */
export const events = {
  publishes: [
    "audit.recorded",
    "block.changed",
    "friend_request.changed",
    "friendship.changed",
    "mute.changed",
    "onboarding.advanced",
    "onboarding.completed",
    "profile.gate_changed",
    "profile.image_replaced",
    "profile.updated",
    "tour.ended",
    "university.domains_changed",
    "user.deletion_confirmed",
  ],
  handles: [...LIFECYCLE_EVENTS, ...COPY_EVENTS],
} as const;
