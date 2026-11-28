import { refuse, type Refusal, type RefusalKind } from "@skilient/platform";

/**
 * Every refusal credentials gives: a short reason (sent in x-refusal), its kind (the Connect code), today's wording
 * (for web, which shows the user the message; W13), and the SQLSTATE the current stack raised for it (for the
 * golden replays). No user content in any reason. Wording with a value in it ("up to % pinned entries") carries the
 * values in x-refusal-values.
 */
export const REFUSALS = {
  // Shared
  not_signed_in: { kind: "not_signed_in", text: "not signed in", sqlstate: "42501" },
  invalid_input: { kind: "invalid_input", text: "invalid input", sqlstate: "22023" },
  trust_only: { kind: "not_allowed", text: "trust reviewers only, with two-factor on", sqlstate: "42501" },
  staff_only: { kind: "not_allowed", text: "trust reviewers and moderators only, with two-factor on", sqlstate: "42501" },

  // CVs
  cv_students_only: { kind: "not_allowed", text: "CVs are for students who finished onboarding", sqlstate: "42501" },
  sections: { kind: "invalid_input", text: "choose at least one section, each once", sqlstate: "22023" },
  not_eligible: { kind: "not_allowed", text: "not eligible", sqlstate: "42501" },
  nothing_to_reissue: { kind: "precondition", text: "not now", sqlstate: "55000" },
  reissue_newest_only: { kind: "precondition", text: "only the newest version, after you revoked it, can be re-issued", sqlstate: "55000" },
  reissue_limit: { kind: "too_many", text: "up to 5 re-issues a day", sqlstate: "54000" },
  refresh_pro: { kind: "not_allowed", text: "refreshing any time is a Student Pro feature", sqlstate: "42501" },
  refresh_limit: { kind: "too_many", text: "up to 10 refreshes a day", sqlstate: "54000" },
  cv_not_found: { kind: "not_found", text: "CV version not found", sqlstate: "P0002" },
  share_spark: { kind: "not_allowed", text: "share links open at Spark tier", sqlstate: "42501" },
  invalid_share_link: { kind: "invalid_input", text: "invalid share link", sqlstate: "22023" },
  cv_links_max: { kind: "precondition", text: "up to 10 active share links: revoke one first", sqlstate: "23514" },
  share_link_not_found: { kind: "not_found", text: "share link not found", sqlstate: "P0002" },
  pdf_pro: { kind: "not_allowed", text: "PDF export is a Student Pro feature", sqlstate: "42501" },
  template_pro: { kind: "not_allowed", text: "that template is a Student Pro feature", sqlstate: "42501" },
  export_not_ours: { kind: "not_allowed", text: "this export wasn't made by Skilient", sqlstate: "42501" },
  pdf_missing: { kind: "not_found", text: "the PDF file is missing", sqlstate: "P0002" },
  cv_export_limit: { kind: "too_many", text: "up to 20 PDF exports a day", sqlstate: "54000" },
  staff_reason: { kind: "invalid_input", text: "give a reason (3 to 2,000 characters)", sqlstate: "22023" },
  already_revoked: { kind: "precondition", text: "already revoked", sqlstate: "55000" },
  pdf_not_found: { kind: "not_found", text: "PDF not found", sqlstate: "P0002" },

  // The Record
  entry_not_found: { kind: "not_found", text: "entry not found", sqlstate: "P0002" },
  society_not_found: { kind: "not_found", text: "society not found", sqlstate: "P0002" },
  second_officer: { kind: "not_allowed", text: "a second officer confirms this entry", sqlstate: "42501" },
  not_awaiting: { kind: "precondition", text: "this entry isn't waiting for a confirmation", sqlstate: "55000" },
  live_only: { kind: "precondition", text: "only a live entry can be corrected", sqlstate: "55000" },
  wait_sealed: { kind: "precondition", text: "wait until the entry is sealed, then correct it", sqlstate: "55000" },
  correction_waiting: { kind: "conflict", text: "a correction of this entry is already waiting", sqlstate: "23505" },
  title_length: { kind: "invalid_input", text: "the title is 2 to 120 characters", sqlstate: "22023" },
  place_range: { kind: "invalid_input", text: "a place is 1 to 50", sqlstate: "22023" },
  hours_range: { kind: "invalid_input", text: "hours are more than 0 and at most 336", sqlstate: "22023" },
  line_length: { kind: "invalid_input", text: "the evidence line is at most 140 characters", sqlstate: "22023" },
  nothing_changed: { kind: "invalid_input", text: "nothing changed", sqlstate: "22023" },
  report_not_found: { kind: "not_found", text: "report not found", sqlstate: "P0002" },
  decline_reason: { kind: "invalid_input", text: "say why the entry stays as it is", sqlstate: "22023" },
  entry_already: { kind: "precondition", text: "this entry is already %", sqlstate: "55000" },
  choose_category: { kind: "invalid_input", text: "choose why it is revoked", sqlstate: "22023" },
  student_reason: { kind: "invalid_input", text: "give the reason the student will see", sqlstate: "22023" },
  pin_rule: { kind: "invalid_input", text: "only a sealed entry you show can be pinned", sqlstate: "22023" },
  pins_max: { kind: "precondition", text: "up to % pinned entries: unpin one first", sqlstate: "23514" },
  skilient_mistake: { kind: "precondition", text: "Skilient entries come from your work itself: report it through Feedback", sqlstate: "55000" },
  mistake_note: { kind: "invalid_input", text: "say what is wrong in 10 to 1,000 characters", sqlstate: "22023" },
  mistake_limit: { kind: "too_many", text: "up to 10 reports a day", sqlstate: "54000" },
  mistake_again: { kind: "conflict", text: "you already reported a mistake on this entry", sqlstate: "23505" },
  record_links_max: { kind: "precondition", text: "up to % active share links: revoke one first", sqlstate: "23514" },
  verify_email: { kind: "not_allowed", text: "verify your email first", sqlstate: "42501" },
  cv_entries_max: { kind: "precondition", text: "up to % entries on your CV", sqlstate: "23514" },
  invalid_export: { kind: "invalid_input", text: "invalid export", sqlstate: "22023" },
  record_pdf_limit: { kind: "too_many", text: "up to 30 PDFs a day", sqlstate: "54000" },
} as const satisfies Record<string, { kind: RefusalKind; text: string; sqlstate: string }>;

export type RefusalReason = keyof typeof REFUSALS;

/** A typed refusal with credentials' reason code. */
export function refused(reason: RefusalReason): Refusal {
  return refuse(REFUSALS[reason].kind, reason);
}

/** A refusal whose wording carries values (limits, a status). */
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
