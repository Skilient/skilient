import { refuse, type Refusal, type RefusalKind } from "@skilient/platform";

/**
 * Every refusal notify gives: a short reason (sent in x-refusal), its kind (the Connect code), today's wording (for
 * web, which shows it; W13) and the SQLSTATE the stack raised (for the golden replays). No user content in any
 * reason.
 */
export const REFUSALS = {
  not_signed_in: { kind: "not_signed_in", text: "sign in first", sqlstate: "42501" },
  invalid_input: { kind: "invalid_input", text: "invalid input", sqlstate: "22023" },
  notification_not_found: { kind: "not_found", text: "that notification doesn't exist", sqlstate: "P0002" },
  unknown_category: { kind: "not_found", text: "unknown notification category", sqlstate: "P0002" },
  not_instant: { kind: "invalid_input", text: "this kind of notification can't be emailed instantly; choose the daily digest", sqlstate: "22023" },
  not_pushed: { kind: "not_found", text: "this kind of notification isn't pushed", sqlstate: "P0002" },
  push_service: { kind: "invalid_input", text: "this browser's push service isn't supported", sqlstate: "22023" },
  bad_subscription: { kind: "invalid_input", text: "that subscription isn't valid", sqlstate: "22023" },
  push_devices: { kind: "precondition", text: "up to 10 devices get push; turn it off on one first", sqlstate: "23514" },
} as const satisfies Record<string, { kind: RefusalKind; text: string; sqlstate: string }>;

export type RefusalReason = keyof typeof REFUSALS;

/** A typed refusal with notify's reason code. */
export function refused(reason: RefusalReason): Refusal {
  return refuse(REFUSALS[reason].kind, reason);
}
