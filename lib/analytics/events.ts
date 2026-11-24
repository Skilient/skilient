/**
 * Every analytics event Skilient sends (PRD 10 "Product analytics"; docs/analytics.md). Client-safe.
 *
 * Browser events are the landing events (PRD 5.1), the welcome screen's three and page views; their properties are typed here so
 * an unknown event or property fails typecheck. Server events are written by database triggers into
 * the outbox (supabase/migrations/*_analytics.sql) and sent by the analytics-worker; the list below
 * must match the migration (a unit test checks both ways). Properties are ids, enums, counts and
 * booleans only: never names, emails, usernames or content.
 */

export interface ClientEventProps {
  /** A live university email was submitted on the landing page; the visitor goes to /signup. */
  signup_start: { source: "hero" | "final" };
  /** The email field recognised a live university. */
  uni_detected: { source: "hero" | "final"; university_id: string | null };
  /** The email field recognised a university that isn't live yet (or an unknown one). */
  uni_not_live: { source: "hero" | "final"; known: boolean };
  /** "Request your university" was sent. */
  uni_requested: { known: boolean };
  /** A call to action on an organisation page (/recruiters, /universities, /faculty, /features, /about). */
  org_cta_click: { cta: string; page: string };
  /** The welcome screen after onboarding was shown (`replay`: opened again from Settings). */
  welcome_viewed: { replay: boolean };
  /** "Start the tour" on the welcome screen. */
  welcome_tour_started: { replay: boolean };
  /** "Skip to Home" on the welcome screen: the tour is recorded as skipped. */
  welcome_skipped: Record<string, never>;
}

export type ClientEvent = keyof ClientEventProps;

export const CLIENT_EVENTS = [
  "signup_start",
  "uni_detected",
  "uni_not_live",
  "uni_requested",
  "org_cta_click",
  "welcome_viewed",
  "welcome_tour_started",
  "welcome_skipped",
] as const satisfies readonly ClientEvent[];

/** Events the database writes (the outbox). `$set` updates person properties (plan, tier, university). */
export const SERVER_EVENTS = [
  "$set",
  "account_created",
  "email_verified",
  "agreement_accepted",
  "onboarding_step",
  "onboarding_completed",
  "tour_completed",
  "tour_skipped",
  "github_connected",
  "first_l2_skill",
  "contribution_logged",
  "cv_exported",
  "post_created",
  "survey_answered",
  "comment_added",
  "chat_message_sent",
  "feedback_sent",
  "venture_created",
  "venture_joined",
  "venture_completed",
  "contact_request_sent",
  "contact_request_accepted",
  "application_stage_changed",
  "hire_confirmed",
  "subscription_started",
  "subscription_cancelled",
  "society_requested",
  "society_verified",
  "event_published",
  "event_registered",
  "event_checked_in",
  "record_entry_sealed",
  "record_entries_claimed",
  "path_followed",
  "proof_task_started",
  "proof_task_done",
  "proof_task_reviewed",
  "swap_requested",
  "swap_accepted",
  "swap_session_confirmed",
  "swap_closed",
  "post_shared",
  "push_enabled",
] as const;

export type ServerEvent = (typeof SERVER_EVENTS)[number];

/** Person properties the browser sets on identify (plan, tier and signup week come from the server). */
export interface IdentifyTraits {
  role: string;
  university_id: string | null;
}
