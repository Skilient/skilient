import { refuse, type RefusalKind, type Refusal } from "@skilient/platform";

/**
 * Every refusal people gives: a short reason (sent in x-refusal), its kind (the Connect code), today's
 * wording (for web, which shows the user the message; W13), and the SQLSTATE the current stack raised for it
 * (for the golden replays, which compare with the recorded Postgres errors). No user content in any reason.
 */
export const REFUSALS = {
  not_signed_in: { kind: "not_signed_in", text: "sign in first", sqlstate: "42501" },
  not_signed_in_plain: { kind: "not_signed_in", text: "not signed in", sqlstate: "42501" },
  finish_onboarding: { kind: "not_allowed", text: "finish onboarding first", sqlstate: "42501" },
  no_such_user: { kind: "not_found", text: "no one has that username", sqlstate: "P0002" },
  self_request: { kind: "invalid_input", text: "you can't send a friend request to yourself", sqlstate: "22023" },
  already_friends: { kind: "conflict", text: "you're already friends", sqlstate: "23505" },
  request_exists: { kind: "conflict", text: "there's already a request between you", sqlstate: "23505" },
  request_rate_limited: { kind: "too_many", text: "wait a few seconds before sending another request", sqlstate: "54000" },
  request_not_pending: { kind: "not_found", text: "that request is no longer pending", sqlstate: "P0002" },
  not_friends: { kind: "not_found", text: "you're not friends with that person", sqlstate: "P0002" },
  self_block: { kind: "invalid_input", text: "you can't block yourself", sqlstate: "22023" },
  not_blocked: { kind: "not_found", text: "you haven't blocked that person", sqlstate: "P0002" },
  self_mute: { kind: "invalid_input", text: "you can't mute yourself", sqlstate: "22023" },
  username_rate_limited: { kind: "too_many", text: "too many username checks", sqlstate: "54000" },
  search_rate_limited: { kind: "too_many", text: "you're searching too fast", sqlstate: "54000" },
  profile_views_limited: { kind: "too_many", text: "you've opened too many profiles today", sqlstate: "54000" },
  username_taken: { kind: "conflict", text: 'duplicate key value violates unique constraint "profiles_username_key"', sqlstate: "23505" },
  username_invalid: { kind: "invalid_input", text: 'new row for relation "profiles" violates check constraint "profiles_username_check"', sqlstate: "23514" },
  full_name_invalid: { kind: "invalid_input", text: 'new row for relation "profiles" violates check constraint "profiles_full_name_check"', sqlstate: "23514" },
  bio_too_long: { kind: "invalid_input", text: 'new row for relation "profiles" violates check constraint "profiles_bio_check"', sqlstate: "23514" },
  field_invalid: { kind: "invalid_input", text: 'new row for relation "profiles" violates a check constraint', sqlstate: "23514" },
  step_invalid: { kind: "invalid_input", text: 'new row for relation "onboarding_state" violates check constraint "onboarding_state_step_check"', sqlstate: "23514" },
  department_not_listed: { kind: "invalid_input", text: "choose one of your university's departments", sqlstate: "22023" },
  // The column grants refused these on the current stack; the contract has no field for them.
  field_not_editable: { kind: "not_allowed", text: "permission denied for table profiles", sqlstate: "42501" },
  onboarding_field_not_editable: { kind: "not_allowed", text: "permission denied for table onboarding_state", sqlstate: "42501" },
  already_onboarded: { kind: "precondition", text: "onboarding is already finished", sqlstate: "55000" },
  university_refused: { kind: "invalid_input", text: "Choose one of the universities listed.", sqlstate: "22023" },
  university_missing: { kind: "invalid_input", text: "Choose your university.", sqlstate: "22023" },
  profile_not_found: { kind: "not_found", text: "profile not found", sqlstate: "P0002" },
  unknown_setting: { kind: "invalid_input", text: "unknown setting", sqlstate: "22023" },
  value_too_long: { kind: "invalid_input", text: "that value is too long", sqlstate: "22023" },
  unknown_tour: { kind: "invalid_input", text: "unknown tour", sqlstate: "22023" },
  unknown_outcome: { kind: "invalid_input", text: "unknown outcome", sqlstate: "22023" },
  unknown_step: { kind: "invalid_input", text: "unknown step", sqlstate: "22023" },
  unknown_tip: { kind: "invalid_input", text: "unknown tip", sqlstate: "22023" },
  // Universities and requests
  invalid_email: { kind: "invalid_input", text: "Enter a valid email address.", sqlstate: "22023" },
  consent_needed: { kind: "invalid_input", text: "Tick the box so we can email you when your university joins.", sqlstate: "22023" },
  missing_token: { kind: "invalid_input", text: "missing token", sqlstate: "22023" },
  use_university_email: { kind: "invalid_input", text: "Use your university email.", sqlstate: "22023" },
  university_already_live: { kind: "precondition", text: "Your university is already on Skilient. Join now.", sqlstate: "55000" },
  university_name_needed: { kind: "invalid_input", text: "Enter your university's name.", sqlstate: "22023" },
  request_link_expired: { kind: "not_found", text: "That link has expired or was already used to unsubscribe.", sqlstate: "P0002" },
  requests_rate_limited: { kind: "too_many", text: "too many requests from this network", sqlstate: "54000" },
  accounts_only: { kind: "not_allowed", text: "accounts staff only, with two-factor on", sqlstate: "42501" },
  reason_needed: { kind: "invalid_input", text: "give a reason", sqlstate: "22023" },
  reason_length: { kind: "invalid_input", text: "give a reason of 3 to 500 characters", sqlstate: "22023" },
  university_not_found: { kind: "not_found", text: "university not found", sqlstate: "P0002" },
  domain_kind: { kind: "invalid_input", text: "choose who the domain is for", sqlstate: "22023" },
  domain_invalid: { kind: "invalid_input", text: "that isn't a domain", sqlstate: "22023" },
  domain_personal: { kind: "invalid_input", text: "public email domains can never be university domains", sqlstate: "22023" },
  domain_personal_row: { kind: "invalid_input", text: "a public email domain can't be a university domain", sqlstate: "23514" },
  domain_taken: { kind: "conflict", text: "that domain already belongs to a university", sqlstate: "23505" },
  year_invalid: { kind: "invalid_input", text: "enter a graduating year", sqlstate: "22023" },
  // Departments and programmes (market only)
  department_name_length: { kind: "invalid_input", text: "department names are 2 to 80 characters", sqlstate: "22023" },
  department_duplicate: { kind: "conflict", text: "you already have a department with that name", sqlstate: "23505" },
  department_limit: { kind: "invalid_input", text: "up to 100 departments", sqlstate: "23514" },
  department_not_found: { kind: "not_found", text: "department not found", sqlstate: "P0002" },
  programme_name_length: { kind: "invalid_input", text: "programme names are 2 to 80 characters", sqlstate: "22023" },
  programme_limit: { kind: "invalid_input", text: "up to 30 programmes a department", sqlstate: "23514" },
  programme_duplicate: { kind: "conflict", text: "that programme is already listed", sqlstate: "23505" },
  programme_not_found: { kind: "not_found", text: "programme not found", sqlstate: "P0002" },
  hec_not_array: { kind: "invalid_input", text: "sync_hec_universities expects a JSON array", sqlstate: "22023" },
  invalid_input: { kind: "invalid_input", text: "invalid input", sqlstate: "22023" },
  not_allowed: { kind: "not_allowed", text: "not allowed", sqlstate: "42501" },
} as const satisfies Record<string, { kind: RefusalKind; text: string; sqlstate: string }>;

export type RefusalReason = keyof typeof REFUSALS;

/** A typed refusal with people's reason code. */
export function refused(reason: RefusalReason): Refusal {
  return refuse(REFUSALS[reason].kind, reason);
}
