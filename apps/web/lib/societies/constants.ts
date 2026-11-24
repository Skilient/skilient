/**
 * Societies and events (PRD 5.31): wording and option lists shared by server pages and client
 * forms. Every rule behind them is enforced again in SQL (supabase/migrations/20261111*).
 */

export const SOCIETY_CATEGORIES = [
  { value: "technology", label: "Technology" },
  { value: "business", label: "Business" },
  { value: "debating", label: "Debating" },
  { value: "arts", label: "Arts" },
  { value: "sports", label: "Sports" },
  { value: "community", label: "Community" },
  { value: "religious", label: "Religious" },
  { value: "other", label: "Other" },
] as const;
export type SocietyCategory = (typeof SOCIETY_CATEGORIES)[number]["value"];
export const categoryLabel = (c: string) => SOCIETY_CATEGORIES.find((x) => x.value === c)?.label ?? c;

export const MEMBERSHIP_MODES = [
  { value: "open", label: "Open", hint: "Anyone at your university joins with one tap." },
  { value: "request", label: "By request", hint: "Students ask to join; an officer accepts." },
  { value: "inductions", label: "Inductions only", hint: "Members join through an induction round." },
] as const;
export type MembershipMode = (typeof MEMBERSHIP_MODES)[number]["value"];

export const SOCIETY_STATUS: Record<string, { label: string; tone: "neutral" | "info" | "success" | "warning" | "error" }> = {
  pending: { label: "Under review", tone: "info" },
  more_info: { label: "More information needed", tone: "warning" },
  verified: { label: "Verified", tone: "success" },
  rejected: { label: "Not approved", tone: "error" },
  suspended: { label: "Suspended", tone: "error" },
};

export const REQUEST_STATUS: Record<string, string> = {
  pending: "Under review",
  more_info: "More information needed",
  approved: "Approved",
  rejected: "Not approved",
};

export const EVENT_TYPES = [
  { value: "talk", label: "Talk" },
  { value: "workshop", label: "Workshop" },
  { value: "hackathon", label: "Hackathon" },
  { value: "competition", label: "Competition" },
  { value: "social", label: "Social" },
  { value: "volunteering", label: "Volunteering" },
  { value: "other", label: "Other" },
] as const;
export type EventType = (typeof EVENT_TYPES)[number]["value"];
export const eventTypeLabel = (t: string) => EVENT_TYPES.find((x) => x.value === t)?.label ?? t;

export const RECORD_KINDS = [
  { value: "attended", label: "Attended", hint: "Checked in to at least one session." },
  { value: "completed", label: "Completed", hint: "Checked in to enough sessions (you set how many)." },
  { value: "result", label: "Result", hint: "A place or award you record at close-out." },
] as const;

export const QUESTION_KINDS = [
  { value: "short", label: "Short answer" },
  { value: "long", label: "Long answer" },
  { value: "single", label: "One choice" },
  { value: "multi", label: "Several choices" },
] as const;
export type QuestionKind = (typeof QUESTION_KINDS)[number]["value"];

export const REGISTRATION_STATUS: Record<string, { label: string; tone: "neutral" | "info" | "success" | "warning" | "error" }> = {
  confirmed: { label: "Confirmed", tone: "success" },
  pending: { label: "Waiting for approval", tone: "info" },
  waitlisted: { label: "Waitlisted", tone: "warning" },
  held: { label: "Seat held: pay to confirm", tone: "warning" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  declined: { label: "Not accepted", tone: "error" },
};

export const EVENT_STATUS: Record<string, { label: string; tone: "neutral" | "info" | "success" | "warning" | "error" }> = {
  draft: { label: "Draft", tone: "neutral" },
  published: { label: "Published", tone: "info" },
  live: { label: "Live", tone: "success" },
  ended: { label: "Ended", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "error" },
};

export const PAYMENT_STATUS: Record<string, { label: string; tone: "neutral" | "info" | "success" | "warning" | "error" }> = {
  awaiting: { label: "Awaiting payment", tone: "warning" },
  under_review: { label: "Receipt under review", tone: "info" },
  approved: { label: "Paid", tone: "success" },
  rejected: { label: "Receipt not accepted", tone: "error" },
  released: { label: "Hold released", tone: "neutral" },
};

export const REFUND_STATUS: Record<string, string> = {
  requested: "Refund requested",
  sent: "Refund sent",
  received: "Refund received",
  disputed: "Refund disputed",
};

export const PAYMENT_KINDS = [
  { value: "bank", label: "Bank account" },
  { value: "jazzcash", label: "JazzCash" },
  { value: "easypaisa", label: "Easypaisa" },
] as const;
export const paymentKindLabel = (k: string) => PAYMENT_KINDS.find((x) => x.value === k)?.label ?? k;

export const INDUCTION_STATUS: Record<string, { label: string; tone: "neutral" | "info" | "success" | "warning" | "error" }> = {
  pending: { label: "Applied", tone: "info" },
  shortlisted: { label: "Shortlisted", tone: "warning" },
  accepted: { label: "Accepted", tone: "success" },
  declined: { label: "Not this time", tone: "neutral" },
};

/** "PKR 1,500" in the same digits everywhere (no locale differences between server and browser). */
export function pkr(n: number): string {
  return `PKR ${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

/** Default officer term for the invite form: today to a year from today (YYYY-MM-DD). */
export function defaultTerm(now: Date = new Date()): { start: string; end: string } {
  const end = new Date(now.getTime());
  end.setFullYear(end.getFullYear() + 1);
  return { start: now.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}
