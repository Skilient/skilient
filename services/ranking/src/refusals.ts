import { refuse, type Refusal, type RefusalKind } from "@skilient/platform";

/**
 * Every refusal ranking gives: a short reason (sent in x-refusal), its kind (the Connect code), today's wording
 * (for web; W13), and the SQLSTATE the current stack raised for it (for the golden replays). No user content.
 */
export const REFUSALS = {
  not_signed_in: { kind: "not_signed_in", text: "not signed in", sqlstate: "42501" },
  finish_onboarding: { kind: "not_allowed", text: "finish onboarding first", sqlstate: "42501" },
  invalid_input: { kind: "invalid_input", text: "invalid input", sqlstate: "22023" },
  trust_only: { kind: "not_allowed", text: "trust reviewers only, with two-factor on", sqlstate: "42501" },
  accounts_only: { kind: "not_allowed", text: "accounts staff only, with two-factor on", sqlstate: "42501" },

  // Boards
  choose_scope: { kind: "invalid_input", text: "choose university or global", sqlstate: "22023" },
  too_many_people: { kind: "invalid_input", text: "at most 200 people at a time", sqlstate: "22023" },

  // Flags
  flag_not_waiting: { kind: "precondition", text: "this flag isn't waiting for review", sqlstate: "55000" },
  own_flag: { kind: "not_allowed", text: "you can't review a flag about yourself", sqlstate: "42501" },
  flag_claimed_by_other: { kind: "precondition", text: "someone else is reviewing this flag", sqlstate: "55000" },
  flag_not_claimed: { kind: "precondition", text: "you haven't claimed this flag", sqlstate: "55000" },
  claim_flag_first: { kind: "precondition", text: "claim the flag before deciding", sqlstate: "55000" },
  give_reason: { kind: "invalid_input", text: "give a reason", sqlstate: "22023" },

  // Exam periods
  exam_end_before_start: { kind: "invalid_input", text: "the end date must be on or after the start date", sqlstate: "22023" },
  exam_too_long: { kind: "invalid_input", text: "an exam period can be at most 45 days", sqlstate: "22023" },
  university_not_found: { kind: "not_found", text: "university not found", sqlstate: "P0002" },
  exam_overlap: { kind: "precondition", text: "this overlaps an exam period already entered for that university", sqlstate: "23514" },
  exam_overlap_own: { kind: "precondition", text: "this overlaps an exam period already entered", sqlstate: "23514" },
  exam_year_cap: { kind: "precondition", text: "exam periods can cover at most 90 days in % (this would make %)", sqlstate: "23514" },
  exam_not_found: { kind: "not_found", text: "exam period not found", sqlstate: "P0002" },
} as const satisfies Record<string, { kind: RefusalKind; text: string; sqlstate: string }>;

export type RefusalReason = keyof typeof REFUSALS;

/** A typed refusal with ranking's reason code. */
export function refused(reason: RefusalReason): Refusal {
  return refuse(REFUSALS[reason].kind, reason);
}

/** A refusal whose wording carries values (limits and years, never anything a user wrote), in `x-refusal-values`. */
export function refusedWith(reason: RefusalReason, ...values: (string | number)[]): Refusal {
  const r = refused(reason);
  r.metadata.set("x-refusal-values", JSON.stringify(values));
  return r;
}

/** Today's wording with the values filled in (web, and the golden replays). */
export function refusalText(reason: RefusalReason, values: readonly (string | number)[] = []): string {
  let i = 0;
  return REFUSALS[reason].text.replace(/%/g, () => String(values[i++] ?? "%"));
}
