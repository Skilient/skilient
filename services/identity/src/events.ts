import { TOKENS_REVOKED } from "@skilient/platform";
import { DELETION_CONFIRMED } from "./store/deletion";
import { GATE_EVENTS } from "./store/gate-copies";

/**
 * What identity publishes and handles. Every type is listed in packages/contracts/events.json, and
 * tools/lint/test/events.test.ts keeps the two in step with the code.
 */
export const events = {
  publishes: [
    "user.created",
    "user.deleted",
    "user.deletion_requested",
    "user.deletion_cancelled",
    TOKENS_REVOKED,
    "session.revoked",
    "audit.recorded",
    "user.two_factor_changed",
    "user.mfa_reset",
    "user.email_domain_changed",
    "user.banned",
  ],
  handles: [...(Object.keys(GATE_EVENTS) as string[]), DELETION_CONFIRMED],
} as const;
