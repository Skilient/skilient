import { refuse, type RefusalKind, type Refusal } from "@skilient/platform";

/**
 * Every refusal content gives: a short reason (sent in x-refusal), its kind (the Connect code), today's
 * wording (for web, which shows the user the message; W13), and the SQLSTATE the current stack raised for it
 * (for the golden replays, which compare with the recorded Postgres errors). No user content in any reason.
 */
export const REFUSALS = {
  not_signed_in: { kind: "not_signed_in", text: "sign in first", sqlstate: "42501" },
  finish_onboarding: { kind: "not_allowed", text: "finish setting up your account first", sqlstate: "42501" },
  invalid_input: { kind: "invalid_input", text: "invalid input", sqlstate: "22023" },
  unknown_type: { kind: "invalid_input", text: "unknown post type or audience", sqlstate: "22023" },
  shipped_refused: { kind: "not_allowed", text: "Shipped posts are created when a venture completes", sqlstate: "42501" },
  post_length: { kind: "invalid_input", text: "posts are 1 to 2,000 characters", sqlstate: "23514" },
  media_not_list: { kind: "invalid_input", text: "media must be a list", sqlstate: "22023" },
  too_many_images: { kind: "invalid_input", text: "up to 4 images per post", sqlstate: "23514" },
  image_missing: { kind: "invalid_input", text: "an image is missing; upload it again", sqlstate: "22023" },
  images_wrong_type: { kind: "invalid_input", text: "images go on general, invite and event posts", sqlstate: "22023" },
  officers_only: { kind: "not_allowed", text: "only officers post as a society", sqlstate: "42501" },
  society_post_type: { kind: "invalid_input", text: "a society posts general, event or poll posts", sqlstate: "22023" },
  events_by_societies: { kind: "not_allowed", text: "only society officers post events", sqlstate: "42501" },
  staff_announcements: { kind: "not_allowed", text: "only Skilient staff post announcements for now", sqlstate: "42501" },
  invite_owner_only: { kind: "not_allowed", text: "only the owner of a venture can post an invite for it", sqlstate: "42501" },
  venture_not_recruiting: { kind: "precondition", text: "this venture isn't taking applications", sqlstate: "55000" },
  venture_unlisted: { kind: "invalid_input", text: "unlisted ventures take members by invite only", sqlstate: "22023" },
  venture_university_only: { kind: "invalid_input", text: "a university-only venture can only be posted to your University Feed", sqlstate: "22023" },
  event_needs_time: { kind: "invalid_input", text: "give the event a date and time", sqlstate: "22023" },
  event_within_year: { kind: "invalid_input", text: "events start within the next year", sqlstate: "22023" },
  poll_options: { kind: "invalid_input", text: "polls have 2 to 4 options", sqlstate: "23514" },
  poll_days: { kind: "invalid_input", text: "polls close after 1 to 7 days", sqlstate: "23514" },
  post_rate_limited: { kind: "too_many", text: "wait 30 seconds between posts", sqlstate: "54000" },
  graduates_global_only: { kind: "not_allowed", text: "graduates post to the Global Feed only", sqlstate: "42501" },
  edit_own_only: { kind: "not_allowed", text: "you can only edit your own posts", sqlstate: "42501" },
  edit_window: { kind: "precondition", text: "posts can be edited for 15 minutes after posting", sqlstate: "55000" },
  delete_own_only: { kind: "not_allowed", text: "you can only delete your own posts", sqlstate: "42501" },
  no_such_poll: { kind: "not_found", text: "that poll doesn't exist", sqlstate: "P0002" },
  poll_closed: { kind: "precondition", text: "this poll has closed", sqlstate: "55000" },
  poll_option: { kind: "invalid_input", text: "pick one of the options", sqlstate: "22023" },
  already_voted: { kind: "conflict", text: "you've already voted", sqlstate: "23505" },
  no_such_event: { kind: "not_found", text: "that event doesn't exist", sqlstate: "P0002" },
  event_over: { kind: "precondition", text: "this event has already happened", sqlstate: "55000" },
  no_such_post: { kind: "not_found", text: "that post doesn't exist", sqlstate: "P0002" },
  comment_gone: { kind: "not_found", text: "that comment isn't there any more", sqlstate: "P0002" },
  comment_length: { kind: "invalid_input", text: "comments are 1 to 1,000 characters", sqlstate: "23514" },
  reply_depth: { kind: "invalid_input", text: "replies go one level deep", sqlstate: "23514" },
  comment_rate_limited: { kind: "too_many", text: "wait 10 seconds between comments", sqlstate: "54000" },
  comment_delete_refused: { kind: "not_allowed", text: "you can only delete your own comments, or comments on your post", sqlstate: "42501" },
  pin_author_only: { kind: "not_allowed", text: "only the post's author pins comments", sqlstate: "42501" },
  pin_top_level: { kind: "invalid_input", text: "only top-level comments can be pinned", sqlstate: "22023" },
  answer_yes_no: { kind: "invalid_input", text: "answer yes or no", sqlstate: "22023" },
  no_question: { kind: "not_found", text: "there's no question for you on this post", sqlstate: "P0002" },
  read_first: { kind: "precondition", text: "take a moment to read the post first", sqlstate: "55000" },
  answer_final: { kind: "conflict", text: "your answer is final", sqlstate: "23505" },
  insights_author_only: { kind: "not_allowed", text: "insights are for the post's author", sqlstate: "42501" },
  insights_paid: { kind: "not_allowed", text: "post insights come with Student Pro", sqlstate: "42501" },
  unknown_filter: { kind: "invalid_input", text: "unknown filter", sqlstate: "22023" },
  bad_cursor: { kind: "invalid_input", text: "bad cursor", sqlstate: "22023" },
} as const satisfies Record<string, { kind: RefusalKind; text: string; sqlstate: string }>;

export type RefusalReason = keyof typeof REFUSALS;

/** A typed refusal with content's reason code. */
export function refused(reason: RefusalReason): Refusal {
  return refuse(REFUSALS[reason].kind, reason);
}
