/**
 * Paths, proof tasks and the skill swap (PRD 5.32): client-safe states and wording. The SQL in
 * supabase/migrations/20261113000001_paths_tasks.sql and ..02_skill_swap.sql owns the rules.
 */

export type PathStepState = "proved" | "in_progress" | "next" | "later";
export type TaskStatus = "started" | "verifying" | "awaiting_peer" | "in_review" | "code_check" | "needs_changes" | "done" | "abandoned";
export type SwapStatus = "requested" | "accepted" | "declined" | "expired" | "cancelled" | "closed";
export type SessionStatus = "proposed" | "accepted" | "declined" | "cancelled" | "confirmed" | "no_show";

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  started: "Started",
  verifying: "Verifying with GitHub",
  awaiting_peer: "Awaiting a peer",
  in_review: "A peer is reviewing",
  code_check: "Code check",
  needs_changes: "Needs changes",
  done: "Done",
  abandoned: "Dropped",
};

/** Submitted → Verifying → Awaiting peer → Done (the status steps on the task page). */
export const TASK_STEPS = ["Started", "Submitted", "Verifying", "Awaiting peer", "Done"] as const;

export function taskStep(status: TaskStatus): number {
  switch (status) {
    case "started":
    case "needs_changes":
      return 0;
    case "verifying":
    case "code_check":
      return 2;
    case "awaiting_peer":
    case "in_review":
      return 3;
    case "done":
      return 4;
    default:
      return 0;
  }
}

export const DIFFICULTY_LABELS: Record<"starter" | "core" | "stretch", string> = {
  starter: "Starter",
  core: "Core",
  stretch: "Stretch",
};

export const VERIFIED_BY_LABELS: Record<"github" | "peer" | "code_check", string> = {
  github: "GitHub",
  peer: "a peer review",
  code_check: "a code check",
};

export const SWAP_STATUS_LABELS: Record<SwapStatus, string> = {
  requested: "Requested",
  accepted: "Active",
  declined: "Declined",
  expired: "Expired",
  cancelled: "Cancelled",
  closed: "Closed",
};

export const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
  proposed: "Proposed",
  accepted: "Booked",
  declined: "Declined",
  cancelled: "Cancelled",
  confirmed: "Happened",
  no_show: "Didn't happen",
};

export const NO_SHOW_REASONS = [
  { value: "teacher_absent", label: "The teacher couldn't make it" },
  { value: "learner_absent", label: "I couldn't make it" },
  { value: "rescheduled", label: "We moved it to another time" },
  { value: "other", label: "Something else" },
] as const;

export const CLOSE_REASON_LABELS: Record<"ended" | "inactive" | "blocked", string> = {
  ended: "Ended",
  inactive: "Closed after 30 days without a session",
  blocked: "Closed",
};

/** "4.5 h", "1 h", "45 min". */
export function hoursLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.round((minutes / 60) * 10) / 10;
  return `${Number.isInteger(h) ? h.toFixed(0) : h.toFixed(1)} h`;
}

/** "Seniors proved it after React, median 3 months later". */
export function afterLabel(prev: string | null, days: number | null): string | null {
  if (!prev) return null;
  if (days === null) return `Seniors proved it after ${prev}`;
  if (days < 14) return `Seniors proved it after ${prev}, about the same time`;
  if (days < 60) return `Seniors proved it after ${prev}, median ${Math.round(days / 7)} weeks later`;
  return `Seniors proved it after ${prev}, median ${Math.round(days / 30)} months later`;
}

export const PICTOGRAMS = ["browser", "database", "device-mobile", "chart-line", "brain", "cloud", "pen-nib", "compass"] as const;
