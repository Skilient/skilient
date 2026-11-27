import { refuse, type Refusal, type RefusalKind } from "@skilient/platform";

/**
 * Every refusal community gives: a short reason (sent in x-refusal), its kind (the Connect code), today's wording
 * (for web, which shows the user the message; W13), and the SQLSTATE the current stack raised for it (for the
 * golden replays). No user content in any reason. Wording with a value in it ("up to % questions") carries the
 * values in x-refusal-values: limits, statuses, catalogue names, the host university's id (web shows its name)
 * and the opening time in Pakistan time.
 */
export const REFUSALS = {
  // Shared
  not_signed_in: { kind: "not_signed_in", text: "not signed in", sqlstate: "42501" },
  finish_onboarding: { kind: "not_allowed", text: "finish onboarding first", sqlstate: "42501" },
  invalid_input: { kind: "invalid_input", text: "invalid input", sqlstate: "22023" },
  rate_limited: { kind: "too_many", text: "rate limited", sqlstate: "54000" },
  trust_only: { kind: "not_allowed", text: "trust reviewers only, with two-factor on", sqlstate: "42501" },
  unknown_action: { kind: "invalid_input", text: "unknown action", sqlstate: "22023" },

  // Societies
  society_not_found: { kind: "not_found", text: "society not found", sqlstate: "P0002" },
  president_only: { kind: "not_allowed", text: "only the president can do that", sqlstate: "42501" },
  society_suspended: { kind: "precondition", text: "this society is suspended", sqlstate: "55000" },
  request_students_only: { kind: "not_allowed", text: "only students at a university on Skilient can request a society", sqlstate: "42501" },
  confirm_office_bearer: { kind: "invalid_input", text: "confirm that you are an office bearer of this society", sqlstate: "22023" },
  add_proof: { kind: "invalid_input", text: "add a proof document or an official link", sqlstate: "22023" },
  upload_proof_again: { kind: "invalid_input", text: "upload the proof again", sqlstate: "22023" },
  request_waiting: { kind: "conflict", text: "you already have a society request waiting for review", sqlstate: "23505" },
  society_name_taken: { kind: "conflict", text: "A society with this name is already on Skilient at your university", sqlstate: "23505" },
  too_many_requests_today: { kind: "too_many", text: "too many requests today; try again tomorrow", sqlstate: "54000" },
  nothing_to_resubmit: { kind: "not_found", text: "nothing to resubmit", sqlstate: "P0002" },
  upload_image_again: { kind: "invalid_input", text: "upload the image again", sqlstate: "22023" },
  unknown_membership_mode: { kind: "invalid_input", text: "unknown membership mode", sqlstate: "22023" },
  join_students_only: { kind: "not_allowed", text: "only students at this university can join", sqlstate: "42501" },
  join_by_inductions: { kind: "precondition", text: "this society takes members through induction rounds; apply to an open round", sqlstate: "55000" },
  request_gone: { kind: "not_found", text: "that request is gone", sqlstate: "P0002" },
  handover_before_leaving: { kind: "precondition", text: "hand the presidency over before you leave", sqlstate: "55000" },
  not_a_member: { kind: "not_found", text: "you aren't a member", sqlstate: "P0002" },
  officers_once_verified: { kind: "precondition", text: "officers join once the society is verified", sqlstate: "55000" },
  no_student_here: { kind: "not_found", text: "no student with that username at this university", sqlstate: "P0002" },
  already_officer: { kind: "conflict", text: "they are already an officer", sqlstate: "23505" },
  term_length: { kind: "invalid_input", text: "a term runs from a start month to an end month, up to 2 years", sqlstate: "22023" },
  max_officers: { kind: "precondition", text: "a society has at most % officers", sqlstate: "23514" },
  pick_member: { kind: "not_found", text: "pick an officer or member of this society", sqlstate: "P0002" },
  invitation_not_found: { kind: "not_found", text: "invitation not found", sqlstate: "P0002" },
  society_not_active: { kind: "precondition", text: "this society isn't active", sqlstate: "55000" },
  handover_instead: { kind: "precondition", text: "hand the presidency over instead", sqlstate: "55000" },
  not_an_officer: { kind: "not_found", text: "they aren't an officer", sqlstate: "P0002" },
  term_not_found: { kind: "not_found", text: "term not found", sqlstate: "P0002" },
  confirm_own_term: { kind: "not_allowed", text: "another officer confirms your own term", sqlstate: "42501" },
  president_confirms: { kind: "not_allowed", text: "the president confirms officers' terms", sqlstate: "42501" },
  term_not_ended: { kind: "precondition", text: "confirm a term once it has ended", sqlstate: "55000" },

  // Induction rounds
  rounds_once_verified: { kind: "precondition", text: "induction rounds open once the society is verified", sqlstate: "55000" },
  pick_deadline: { kind: "invalid_input", text: "pick a deadline", sqlstate: "22023" },
  deadline_window: { kind: "invalid_input", text: "the deadline is within the next % days", sqlstate: "22023" },
  round_roles: { kind: "invalid_input", text: "a round has 1 to 10 roles", sqlstate: "22023" },
  up_to_questions: { kind: "invalid_input", text: "up to % questions", sqlstate: "22023" },
  draft_only: { kind: "precondition", text: "only a draft round can change", sqlstate: "55000" },
  round_not_found: { kind: "not_found", text: "round not found", sqlstate: "P0002" },
  round_published: { kind: "precondition", text: "this round is already published", sqlstate: "55000" },
  deadline_past: { kind: "precondition", text: "move the deadline into the future first", sqlstate: "55000" },
  round_closed: { kind: "precondition", text: "this round has closed", sqlstate: "55000" },
  apply_students_only: { kind: "not_allowed", text: "only students at this university can apply", sqlstate: "42501" },
  pick_role: { kind: "invalid_input", text: "pick a role", sqlstate: "22023" },
  answer_every_question: { kind: "invalid_input", text: "answer every question (up to 1,000 characters each)", sqlstate: "22023" },
  already_applied: { kind: "conflict", text: "you've already applied to this round", sqlstate: "23505" },
  application_not_found: { kind: "not_found", text: "application not found", sqlstate: "P0002" },
  already_decided: { kind: "precondition", text: "already decided", sqlstate: "55000" },
  role_full: { kind: "precondition", text: "this role is full", sqlstate: "23514" },

  // Staff review
  nothing_to_claim: { kind: "not_found", text: "nothing to claim", sqlstate: "P0002" },
  someone_reviewing: { kind: "precondition", text: "someone else is reviewing this", sqlstate: "55000" },
  society_reason: { kind: "invalid_input", text: "give a reason the society can read", sqlstate: "22023" },
  verified_sells: { kind: "precondition", text: "only a verified society sells tickets", sqlstate: "55000" },
  society_cant: { kind: "precondition", text: "this society is % and can't do that", sqlstate: "55000" },

  // Events
  events_once_verified: { kind: "precondition", text: "events open once the society is verified", sqlstate: "55000" },
  event_sessions: { kind: "invalid_input", text: "an event has 1 to % sessions", sqlstate: "22023" },
  event_ticket_types: { kind: "invalid_input", text: "an event has 1 to % ticket types", sqlstate: "22023" },
  session_times: { kind: "invalid_input", text: "give every session a start and an end", sqlstate: "22023" },
  ticket_prices: { kind: "invalid_input", text: "ticket prices are PKR % to %", sqlstate: "22023" },
  unknown_eligibility: { kind: "invalid_input", text: "unknown eligibility", sqlstate: "22023" },
  upload_cover_again: { kind: "invalid_input", text: "upload the cover again", sqlstate: "22023" },
  event_not_found: { kind: "not_found", text: "event not found", sqlstate: "P0002" },
  event_frozen: { kind: "precondition", text: "this event can't change any more", sqlstate: "55000" },
  eligibility_narrow: { kind: "precondition", text: "eligibility can't narrow after the first registration", sqlstate: "55000" },
  capacity_below_seats: { kind: "precondition", text: "capacity can't go below the seats already given out", sqlstate: "23514" },
  host_publishes: { kind: "not_allowed", text: "the host society publishes its events", sqlstate: "42501" },
  event_published: { kind: "precondition", text: "this event is already published", sqlstate: "55000" },
  first_session_future: { kind: "precondition", text: "move the first session into the future first", sqlstate: "55000" },
  paid_paused: { kind: "precondition", text: "Skilient has paused paid tickets for this society", sqlstate: "55000" },
  payment_details_first: { kind: "precondition", text: "add and confirm the society's payment details before publishing a paid ticket", sqlstate: "55000" },
  event_already: { kind: "precondition", text: "this event is already %", sqlstate: "55000" },
  unknown_list: { kind: "invalid_input", text: "unknown list", sqlstate: "22023" },

  // Registration: event_block_reason's wording, raised as is
  block_cancelled: { kind: "precondition", text: "This event was cancelled.", sqlstate: "55000" },
  block_ended: { kind: "precondition", text: "This event has ended.", sqlstate: "55000" },
  block_draft: { kind: "precondition", text: "This event isn't published yet.", sqlstate: "55000" },
  block_students_only: { kind: "precondition", text: "Only students register for society events.", sqlstate: "55000" },
  block_opens: { kind: "precondition", text: "Registration opens %.", sqlstate: "55000" },
  block_closed: { kind: "precondition", text: "Registration has closed.", sqlstate: "55000" },
  block_university: { kind: "precondition", text: "For students at % only.", sqlstate: "55000" },
  block_groups: { kind: "precondition", text: "For % only.", sqlstate: "55000" },
  pick_ticket_type: { kind: "invalid_input", text: "pick a ticket type", sqlstate: "22023" },
  already_registered: { kind: "conflict", text: "you're already registered", sqlstate: "23505" },
  answer_the_form: { kind: "invalid_input", text: "answer the form", sqlstate: "22023" },
  answer_question: { kind: "invalid_input", text: 'answer "%"', sqlstate: "22023" },
  answers_length: { kind: "invalid_input", text: "answers are up to 2,000 characters", sqlstate: "22023" },
  no_team_code: { kind: "not_found", text: "no team with that code", sqlstate: "P0002" },
  team_full: { kind: "precondition", text: "that team is full", sqlstate: "23514" },
  create_or_join_team: { kind: "invalid_input", text: "create a team or join one with its code", sqlstate: "22023" },
  not_registered: { kind: "not_found", text: "you aren't registered", sqlstate: "P0002" },
  already_checked_in: { kind: "precondition", text: "you've already checked in", sqlstate: "55000" },
  nothing_to_decide: { kind: "not_found", text: "nothing to decide", sqlstate: "P0002" },
  ticket_not_found: { kind: "not_found", text: "ticket not found", sqlstate: "P0002" },

  // Manage and check-in
  no_student_username: { kind: "not_found", text: "no student with that username", sqlstate: "P0002" },
  max_staff: { kind: "precondition", text: "an event has at most 30 staff", sqlstate: "23514" },
  message_length: { kind: "invalid_input", text: "messages are 3 to 1,000 characters", sqlstate: "22023" },
  messages_per_day: { kind: "too_many", text: "up to 5 messages a day per event", sqlstate: "54000" },
  feedback_window: { kind: "precondition", text: "feedback is open for 7 days after the event", sqlstate: "55000" },
  feedback_given: { kind: "conflict", text: 'duplicate key value violates unique constraint "event_feedback_pkey"', sqlstate: "23505" },
  checkin_opens: { kind: "precondition", text: "check-in opens 2 hours before the first session", sqlstate: "55000" },
  valid_email: { kind: "invalid_input", text: "enter a valid email address", sqlstate: "22023" },
  host_email: { kind: "invalid_input", text: "use a university email address of the host university", sqlstate: "22023" },
  checkin_window: { kind: "precondition", text: "check-in opens 2 hours before the event and closes 2 hours after it", sqlstate: "55000" },
  not_registered_event: { kind: "not_found", text: "you aren't registered for this event", sqlstate: "P0002" },
  code_changed: { kind: "invalid_input", text: "that code has changed; scan the screen again", sqlstate: "22023" },
  checkin_closed: { kind: "precondition", text: "check-in is closed", sqlstate: "55000" },

  // Close-out
  closeout_window: { kind: "precondition", text: "close-out is open for 72 hours after the last session", sqlstate: "55000" },
  change_reason: { kind: "invalid_input", text: "give a reason for the change", sqlstate: "22023" },
  they_not_registered: { kind: "not_found", text: "they aren't registered", sqlstate: "P0002" },
  not_checked_in: { kind: "not_found", text: "they weren't checked in to that session", sqlstate: "P0002" },
  no_results: { kind: "precondition", text: "this event doesn't give results", sqlstate: "55000" },
  team_not_found: { kind: "not_found", text: "team not found", sqlstate: "P0002" },
  no_volunteer_hours: { kind: "precondition", text: "this event doesn't log volunteer hours", sqlstate: "55000" },
  hours_capped: { kind: "invalid_input", text: "hours are capped at the event's length (% h)", sqlstate: "22023" },
  already_issued: { kind: "conflict", text: "entries for this event are already issued", sqlstate: "23505" },

  // Paid tickets
  payment_details_once_verified: { kind: "precondition", text: "payment details open once the society is verified", sqlstate: "55000" },
  unknown_change: { kind: "invalid_input", text: "unknown change", sqlstate: "22023" },
  pick_method: { kind: "not_found", text: "pick a method to change", sqlstate: "P0002" },
  max_methods: { kind: "precondition", text: "a society has up to 3 payment methods", sqlstate: "23514" },
  change_not_found: { kind: "not_found", text: "change not found", sqlstate: "P0002" },
  second_officer: { kind: "not_allowed", text: "a second officer confirms this change", sqlstate: "42501" },
  no_payment: { kind: "not_found", text: "no payment for this ticket", sqlstate: "P0002" },
  not_waiting_receipt: { kind: "precondition", text: "this ticket isn't waiting for a receipt", sqlstate: "55000" },
  hold_expired: { kind: "precondition", text: "the hold on your seat has expired", sqlstate: "55000" },
  upload_receipt_again: { kind: "invalid_input", text: "upload the receipt again", sqlstate: "22023" },
  payment_not_found: { kind: "not_found", text: "payment not found", sqlstate: "P0002" },
  not_waiting_review: { kind: "precondition", text: "this payment isn't waiting for review", sqlstate: "55000" },
  say_why: { kind: "invalid_input", text: 'say why ("Amount doesn\'t match")', sqlstate: "22023" },
  nothing_to_raise: { kind: "not_found", text: "nothing to raise", sqlstate: "P0002" },
  no_refund_waiting: { kind: "precondition", text: "no refund is waiting", sqlstate: "55000" },
  no_refund_to_confirm: { kind: "not_found", text: "no refund to confirm", sqlstate: "P0002" },
} as const satisfies Record<string, { kind: RefusalKind; text: string; sqlstate: string }>;

export type RefusalReason = keyof typeof REFUSALS;

/** A typed refusal with community's reason code. */
export function refused(reason: RefusalReason): Refusal {
  return refuse(REFUSALS[reason].kind, reason);
}

/** A refusal whose wording carries values (limits, statuses, catalogue names, the host university's id, a time). */
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
