import { COPY_EVENTS, ISSUING_EVENTS } from "./store/consumers";

/**
 * What credentials publishes and handles. Every type is listed in packages/contracts/events.json, and
 * tools/lint/test/events.test.ts keeps the two in step with the code.
 */
export const events = {
  publishes: [
    "record.sealed",
    "record.revoked",
    "record.awaiting",
    "record.mistake_reported",
    "record.mistake_declined",
    "record.claim_held",
    "cv.issued",
    "cv.revoked",
    "cv_export.released",
    "milestone.reached",
    "audit.recorded",
    "user.deletion_confirmed",
  ],
  handles: [...COPY_EVENTS, ...ISSUING_EVENTS],
} as const;
