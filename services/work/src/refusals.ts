import { refuse, type RefusalKind, type Refusal } from "@skilient/platform";

/**
 * Every refusal work gives: a short reason (sent in x-refusal), its kind (the Connect code), today's wording
 * (for web, which shows the user the message; W13), and the SQLSTATE the current stack raised for it (for the
 * golden replays). No user content in any reason. Wording with a value in it today ("this venture is %") is
 * one reason per value.
 */
export const REFUSALS = {
  // Shared
  not_signed_in: { kind: "not_signed_in", text: "not signed in", sqlstate: "42501" },
  sign_in_first: { kind: "not_signed_in", text: "sign in first", sqlstate: "42501" },
  finish_onboarding: { kind: "not_allowed", text: "finish onboarding first", sqlstate: "42501" },
  invalid_input: { kind: "invalid_input", text: "invalid input", sqlstate: "22023" },
  rate_limited: { kind: "too_many", text: "rate limited", sqlstate: "54000" },
  searching_too_fast: { kind: "too_many", text: "you're searching too fast", sqlstate: "54000" },
  unknown_skill: { kind: "invalid_input", text: "unknown skill", sqlstate: "22023" },

  // Ventures
  too_many_roles_or_questions: { kind: "invalid_input", text: "too many roles or questions", sqlstate: "22023" },
  venture_not_found: { kind: "not_found", text: "venture not found", sqlstate: "P0002" },
  owner_only: { kind: "not_allowed", text: "only the owner can do this", sqlstate: "42501" },
  venture_completed: { kind: "precondition", text: "this venture is completed", sqlstate: "55000" },
  venture_abandoned: { kind: "precondition", text: "this venture is abandoned", sqlstate: "55000" },
  transition_recruiting_recruiting: { kind: "precondition", text: "a recruiting venture can't become recruiting", sqlstate: "55000" },
  transition_recruiting_completed: { kind: "precondition", text: "a recruiting venture can't become completed", sqlstate: "55000" },
  transition_in_progress_recruiting: { kind: "precondition", text: "a in_progress venture can't become recruiting", sqlstate: "55000" },
  transition_in_progress_in_progress: { kind: "precondition", text: "a in_progress venture can't become in_progress", sqlstate: "55000" },
  transition_completed_recruiting: { kind: "precondition", text: "a completed venture can't become recruiting", sqlstate: "55000" },
  transition_completed_in_progress: { kind: "precondition", text: "a completed venture can't become in_progress", sqlstate: "55000" },
  transition_completed_completed: { kind: "precondition", text: "a completed venture can't become completed", sqlstate: "55000" },
  transition_completed_abandoned: { kind: "precondition", text: "a completed venture can't become abandoned", sqlstate: "55000" },
  transition_abandoned_recruiting: { kind: "precondition", text: "a abandoned venture can't become recruiting", sqlstate: "55000" },
  transition_abandoned_in_progress: { kind: "precondition", text: "a abandoned venture can't become in_progress", sqlstate: "55000" },
  transition_abandoned_completed: { kind: "precondition", text: "a abandoned venture can't become completed", sqlstate: "55000" },
  transition_abandoned_abandoned: { kind: "precondition", text: "a abandoned venture can't become abandoned", sqlstate: "55000" },
  complete_needs_members: { kind: "precondition", text: "a venture needs at least 2 members to complete", sqlstate: "23514" },
  complete_needs_deliverable: { kind: "precondition", text: "add at least one deliverable link before completing", sqlstate: "23514" },
  complete_needs_verified: { kind: "precondition", text: "at least 2 members need a peer-verified contribution before completing", sqlstate: "23514" },
  invite_only: { kind: "not_allowed", text: "this venture takes members by invite only", sqlstate: "42501" },
  university_only: { kind: "not_allowed", text: "this venture is for its university only", sqlstate: "42501" },
  graduate_university_only: { kind: "not_allowed", text: "graduates can't join university-only ventures", sqlstate: "42501" },
  already_member: { kind: "conflict", text: "already a member", sqlstate: "23505" },
  team_full: { kind: "precondition", text: "this team is full", sqlstate: "23514" },
  team_max: { kind: "precondition", text: "this venture already has 6 members", sqlstate: "23514" },
  team_locked: { kind: "precondition", text: "a completed venture's team is locked", sqlstate: "55000" },
  role_not_found: { kind: "not_found", text: "role not found", sqlstate: "P0002" },
  role_filled: { kind: "precondition", text: "that role is already filled", sqlstate: "23514" },
  answer_questions: { kind: "invalid_input", text: "answer every question (up to 500 characters each)", sqlstate: "22023" },
  already_applied: { kind: "conflict", text: "you already have a pending application to this venture", sqlstate: "23505" },
  application_not_found: { kind: "not_found", text: "application not found", sqlstate: "P0002" },
  application_accepted: { kind: "precondition", text: "this application was already accepted", sqlstate: "55000" },
  application_declined: { kind: "precondition", text: "this application was already declined", sqlstate: "55000" },
  application_withdrawn: { kind: "precondition", text: "this application was already withdrawn", sqlstate: "55000" },
  application_closed: { kind: "precondition", text: "this application was already closed", sqlstate: "55000" },
  cant_add_person: { kind: "not_allowed", text: "you can't add this person", sqlstate: "42501" },
  no_such_student: { kind: "not_found", text: "no student with that username", sqlstate: "P0002" },
  already_invited: { kind: "conflict", text: "already invited", sqlstate: "23505" },
  invite_not_found: { kind: "not_found", text: "invite not found", sqlstate: "P0002" },
  invite_accepted: { kind: "precondition", text: "this invite was already accepted", sqlstate: "55000" },
  invite_declined: { kind: "precondition", text: "this invite was already declined", sqlstate: "55000" },
  invite_revoked: { kind: "precondition", text: "this invite was already revoked", sqlstate: "55000" },
  not_a_member: { kind: "not_found", text: "not a member", sqlstate: "P0002" },
  transfer_first: { kind: "precondition", text: "transfer ownership before leaving", sqlstate: "55000" },
  owner_not_removable: { kind: "precondition", text: "the owner can't be removed", sqlstate: "55000" },
  new_owner_member: { kind: "invalid_input", text: "the new owner must be a member", sqlstate: "22023" },
  max_roles: { kind: "invalid_input", text: "at most 6 roles", sqlstate: "22023" },
  max_questions: { kind: "invalid_input", text: "at most 3 questions", sqlstate: "22023" },
  members_only: { kind: "not_allowed", text: "members only", sqlstate: "42501" },
  max_deliverables: { kind: "invalid_input", text: "at most 20 deliverables", sqlstate: "22023" },
  deliverable_owner: { kind: "not_allowed", text: "only the owner or who added it", sqlstate: "42501" },
  follow_public_only: { kind: "not_allowed", text: "only public ventures can be followed", sqlstate: "42501" },
  media_not_list: { kind: "invalid_input", text: "media must be a list", sqlstate: "22023" },
  too_many_images: { kind: "invalid_input", text: "up to 4 images per post", sqlstate: "23514" },
  image_missing: { kind: "invalid_input", text: "an image is missing; upload it again", sqlstate: "22023" },
  share_repo_first: { kind: "not_allowed", text: "share that repository with Skilient first", sqlstate: "42501" },

  // Staff
  trust_only: { kind: "not_allowed", text: "trust reviewers only, with two-factor on", sqlstate: "42501" },
  give_reason: { kind: "invalid_input", text: "give a reason", sqlstate: "22023" },

  // Review flags
  flag_resolved: { kind: "precondition", text: "this flag is resolved", sqlstate: "55000" },
  flag_own: { kind: "not_allowed", text: "you can't review your own flag", sqlstate: "42501" },
  flag_claimed_other: { kind: "precondition", text: "someone else is reviewing this flag", sqlstate: "55000" },
  flag_not_claimed: { kind: "precondition", text: "you haven't claimed this flag", sqlstate: "55000" },
  flag_claim_first: { kind: "precondition", text: "claim the flag before deciding", sqlstate: "55000" },
  note_required: { kind: "invalid_input", text: "a note is required", sqlstate: "22023" },

  // Code checks
  skill_not_found: { kind: "not_found", text: "skill not found", sqlstate: "P0002" },
  check_connect_github: { kind: "precondition", text: "connect GitHub first", sqlstate: "55000" },
  check_needs_l2: { kind: "precondition", text: "a code check needs the skill at L2 from your own commits", sqlstate: "55000" },
  check_passed: { kind: "precondition", text: "you already passed a code check for this skill", sqlstate: "55000" },
  check_open: { kind: "precondition", text: "you already have a code check open for this skill", sqlstate: "55000" },
  check_retry: { kind: "precondition", text: "one attempt per skill every 30 days", sqlstate: "55000" },
  check_not_found: { kind: "not_found", text: "code check not found", sqlstate: "P0002" },
  check_not_ready: { kind: "precondition", text: "this code check isn't ready to start", sqlstate: "55000" },
  check_not_open: { kind: "precondition", text: "this code check isn't open for answers", sqlstate: "55000" },
  check_time_up: { kind: "precondition", text: "time is up", sqlstate: "55000" },
  check_answers: { kind: "invalid_input", text: "answer the three questions", sqlstate: "22023" },
  check_answer_length: { kind: "invalid_input", text: "keep each answer under % characters", sqlstate: "23514" },
  check_not_waiting: { kind: "precondition", text: "this code check isn't waiting for a grade", sqlstate: "55000" },
  check_conflict: { kind: "not_allowed", text: "you know this student (friend or teammate), so someone else grades it", sqlstate: "42501" },
  check_claimed_other: { kind: "precondition", text: "someone else is grading this code check", sqlstate: "55000" },
  check_not_claimed: { kind: "precondition", text: "you haven't claimed this code check", sqlstate: "55000" },
  check_claim_first: { kind: "precondition", text: "claim the code check before grading", sqlstate: "55000" },
  check_feedback: { kind: "invalid_input", text: "give the student some feedback", sqlstate: "22023" },
  check_rubric: { kind: "invalid_input", text: "mark each of the four rubric parts", sqlstate: "22023" },
  snippet_unavailable: { kind: "not_found", text: "not available", sqlstate: "P0002" },
  snippet_gone: { kind: "precondition", text: "gone", sqlstate: "55000" },

  // Paths and proof tasks
  path_not_found: { kind: "not_found", text: "path not found", sqlstate: "P0002" },
  paths_max: { kind: "too_many", text: "you can follow up to % paths; unfollow one first", sqlstate: "23514" },
  task_not_found: { kind: "not_found", text: "task not found", sqlstate: "P0002" },
  tasks_students: { kind: "not_allowed", text: "proof tasks are for students", sqlstate: "42501" },
  task_done: { kind: "precondition", text: "you already completed this task", sqlstate: "55000" },
  tasks_max: { kind: "too_many", text: "you can have % tasks open at a time; finish or drop one first", sqlstate: "23514" },
  task_repo_locked: { kind: "precondition", text: "the repository can be changed only before you submit", sqlstate: "55000" },
  task_pick_repo: { kind: "invalid_input", text: "pick one of your connected repositories", sqlstate: "22023" },
  task_submitted: { kind: "precondition", text: "this task is already submitted", sqlstate: "55000" },
  task_link_repo: { kind: "precondition", text: "link a repository first", sqlstate: "55000" },
  task_not_open: { kind: "precondition", text: "this task isn't open", sqlstate: "55000" },
  task_check_now: { kind: "precondition", text: "a code check can't be chosen now", sqlstate: "55000" },
  task_no_checks: { kind: "precondition", text: "this skill has no code checks", sqlstate: "55000" },
  review_not_found: { kind: "not_found", text: "review not found", sqlstate: "P0002" },
  review_closed: { kind: "precondition", text: "this review is no longer open", sqlstate: "55000" },
  review_taken: { kind: "precondition", text: "someone else is already reviewing this task", sqlstate: "55000" },
  review_not_allowed: { kind: "not_allowed", text: "you can't review this task", sqlstate: "42501" },
  review_accept_first: { kind: "precondition", text: "accept the review before you decide", sqlstate: "55000" },
  review_friend: { kind: "not_allowed", text: "you can't review a friend's task", sqlstate: "42501" },
  review_ticks: { kind: "invalid_input", text: "tick the checklist", sqlstate: "22023" },
  review_all_met: { kind: "invalid_input", text: "confirm only when every item is met", sqlstate: "22023" },
  review_note_length: { kind: "invalid_input", text: "keep the note between 3 and 1,000 characters", sqlstate: "22023" },
  review_say_what: { kind: "invalid_input", text: "say what needs to change (3 to 1,000 characters)", sqlstate: "22023" },

  // Skill swaps
  swap_students: { kind: "not_allowed", text: "the skill swap is for students", sqlstate: "42501" },
  swap_teach_l2: { kind: "not_allowed", text: "you can teach skills you hold at L2 or higher", sqlstate: "42501" },
  swap_note_280: { kind: "invalid_input", text: "keep the note under 280 characters", sqlstate: "22023" },
  swap_wants_max: { kind: "too_many", text: "you can list up to 20 skills to learn", sqlstate: "23514" },
  teacher_not_found: { kind: "not_found", text: "teacher not found", sqlstate: "P0002" },
  swap_own_university: { kind: "not_allowed", text: "you can ask teachers at your own university", sqlstate: "42501" },
  swap_not_taught: { kind: "not_found", text: "they don't teach that skill in swaps", sqlstate: "P0002" },
  swap_offer_l2: { kind: "invalid_input", text: "you can offer back a skill you hold at L2 or higher", sqlstate: "22023" },
  swap_offer_other: { kind: "invalid_input", text: "offer back a different skill", sqlstate: "22023" },
  swap_note_times: { kind: "invalid_input", text: "keep the note under 500 characters and the times under 200", sqlstate: "22023" },
  swap_requests_max: { kind: "too_many", text: "you have % requests waiting; wait for answers first", sqlstate: "23514" },
  swap_open_already: { kind: "conflict", text: "you already have an open swap with them for this skill", sqlstate: "23505" },
  swap_not_found: { kind: "not_found", text: "swap not found", sqlstate: "P0002" },
  swap_request_closed: { kind: "precondition", text: "this request is no longer open", sqlstate: "55000" },
  swap_not_open: { kind: "precondition", text: "this swap isn't open", sqlstate: "55000" },
  swap_time_window: { kind: "invalid_input", text: "pick a time in the next 60 days", sqlstate: "22023" },
  swap_minutes: { kind: "invalid_input", text: "a session is 15 minutes to 4 hours", sqlstate: "22023" },
  swap_place: { kind: "invalid_input", text: "say where, or paste a link (up to 200 characters)", sqlstate: "22023" },
  swap_upcoming_max: { kind: "too_many", text: "you have % sessions coming up; hold those first", sqlstate: "23514" },
  session_not_found: { kind: "not_found", text: "session not found", sqlstate: "P0002" },
  session_other_side: { kind: "not_allowed", text: "the other side accepts a session you proposed", sqlstate: "42501" },
  session_not_open: { kind: "precondition", text: "this session is no longer open", sqlstate: "55000" },
  session_passed: { kind: "precondition", text: "that time has passed; propose another", sqlstate: "55000" },
  session_cancel_upcoming: { kind: "precondition", text: "only an upcoming session can be cancelled", sqlstate: "55000" },
  session_learner_confirms: { kind: "not_allowed", text: "the learner confirms a session", sqlstate: "42501" },
  session_cant_confirm: { kind: "precondition", text: "this session can't be confirmed now", sqlstate: "55000" },
  session_not_started: { kind: "precondition", text: "confirm a session once it has started", sqlstate: "55000" },
  session_why: { kind: "invalid_input", text: "say why it didn't happen", sqlstate: "22023" },
  swap_week_hours: { kind: "too_many", text: "at most % confirmed hours a week between the two of you", sqlstate: "23514" },
  swap_note_not_waiting: { kind: "precondition", text: "this note isn't waiting for you", sqlstate: "55000" },

  // Credentials
  upload_first: { kind: "invalid_input", text: "upload the file first", sqlstate: "22023" },
  file_attached: { kind: "conflict", text: "that file is already attached to a credential", sqlstate: "23505" },
  pdf_or_image: { kind: "invalid_input", text: "upload a PDF or an image", sqlstate: "22023" },
  file_5mb: { kind: "invalid_input", text: "files can be up to 5 MB", sqlstate: "23514" },
  check_dates: { kind: "invalid_input", text: "check the dates", sqlstate: "22023" },
  issued_future: { kind: "invalid_input", text: "the issue date can't be in the future", sqlstate: "22023" },
  expiry_after_issue: { kind: "invalid_input", text: "the expiry date must be after the issue date", sqlstate: "22023" },
  credentials_max: { kind: "too_many", text: "you can keep up to % credentials; delete one first", sqlstate: "23514" },
  credentials_pending: { kind: "too_many", text: "wait for your pending credentials to be reviewed first", sqlstate: "23514" },
  credential_not_found: { kind: "not_found", text: "credential not found", sqlstate: "P0002" },
  credential_not_pending: { kind: "precondition", text: "this credential isn't waiting for review", sqlstate: "55000" },
  credential_own: { kind: "not_allowed", text: "you can't review your own credential", sqlstate: "42501" },
  credential_claimed_other: { kind: "precondition", text: "someone else is reviewing this credential", sqlstate: "55000" },
  credential_not_claimed: { kind: "precondition", text: "you haven't claimed this credential", sqlstate: "55000" },
  credential_claim_first: { kind: "precondition", text: "claim the credential before deciding", sqlstate: "55000" },
  unknown_issuer: { kind: "invalid_input", text: "unknown issuer", sqlstate: "22023" },

  // Endorsements
  endorse_self: { kind: "not_allowed", text: "you can't endorse yourself", sqlstate: "42501" },
  teammate_not_found: { kind: "not_found", text: "teammate not found", sqlstate: "P0002" },
  endorse_not_yet: { kind: "precondition", text: "endorsements open once the venture is in progress", sqlstate: "55000" },
  choose_skill: { kind: "invalid_input", text: "choose at least one skill", sqlstate: "22023" },
  each_skill_once: { kind: "invalid_input", text: "each skill once", sqlstate: "22023" },
  note_280: { kind: "invalid_input", text: "keep the note under 280 characters", sqlstate: "23514" },
  endorse_per_teammate: { kind: "too_many", text: "you can endorse up to % skills per teammate per venture", sqlstate: "23514" },
  endorse_per_month: { kind: "too_many", text: "you can give up to % endorsements a month", sqlstate: "23514" },
  endorse_skill: { kind: "invalid_input", text: "that skill isn't one of the venture's skills or theirs", sqlstate: "22023" },
  already_endorsed: { kind: "conflict", text: "you already endorsed them for %", sqlstate: "23505" },
  evidence_not_theirs: { kind: "invalid_input", text: "that evidence isn't one of their entries in this venture", sqlstate: "22023" },
  evidence_skill: { kind: "invalid_input", text: "that entry doesn't show %", sqlstate: "22023" },
  endorsement_not_found: { kind: "not_found", text: "endorsement not found", sqlstate: "P0002" },

  // GitHub
  github_unavailable: { kind: "unavailable", text: "GitHub connections are unavailable right now", sqlstate: "55000" },
  repo_not_found: { kind: "not_found", text: "that repository isn't shared with Skilient", sqlstate: "P0002" },

  // Contributions
  log_locked_completed: { kind: "precondition", text: "this venture is completed, so its log is locked", sqlstate: "55000" },
  log_locked_abandoned: { kind: "precondition", text: "this venture is abandoned, so its log is locked", sqlstate: "55000" },
  contribution_not_found: { kind: "not_found", text: "contribution not found", sqlstate: "P0002" },
  correct_original: { kind: "invalid_input", text: "correct the original entry", sqlstate: "22023" },
  author_only_correct: { kind: "not_allowed", text: "only its author can correct an entry", sqlstate: "42501" },
  correct_window: { kind: "precondition", text: "entries can be corrected for 24 hours", sqlstate: "55000" },
  confirm_original: { kind: "invalid_input", text: "confirm the entry, not a correction", sqlstate: "22023" },
  github_verified: { kind: "invalid_input", text: "GitHub entries are already verified", sqlstate: "22023" },
  confirm_own: { kind: "not_allowed", text: "you can't confirm your own entry", sqlstate: "42501" },
  tag_max: { kind: "invalid_input", text: "tag up to 3 skills", sqlstate: "23514" },
  tag_venture_skills: { kind: "invalid_input", text: "tag only the venture's own skills", sqlstate: "22023" },
} as const satisfies Record<string, { kind: RefusalKind; text: string; sqlstate: string }>;

export type RefusalReason = keyof typeof REFUSALS;

/** A typed refusal with work's reason code. */
export function refused(reason: RefusalReason): Refusal {
  return refuse(REFUSALS[reason].kind, reason);
}

/**
 * A refusal whose wording carries values ("you already endorsed them for %"): the values travel in the
 * `x-refusal-values` metadata (a JSON array) for web to fill the `%`s. Values are catalogue names or limits,
 * never anything a user wrote.
 */
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
