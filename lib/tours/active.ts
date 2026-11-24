/**
 * What this tab knows about the guided tour (client only). Every flag stores the account it is
 * about, never just "yes": on a shared computer the next student to sign in must get their own
 * welcome and their own tour, and must not resume someone else's.
 *
 * Running: the tour walks through real pages, so two things on them stand down while it does:
 * first-visit tips (hidden by `html[data-tour]` in neu.css) and "mark Openings as seen" (a tour
 * visit shouldn't clear the student's new dots). Kept in sessionStorage with the step it is on,
 * so a reload in the middle of the tour resumes it where it was.
 */
const ACTIVE = "skilient:tour-active";
const ENDED = "skilient:tour-ended";

function read(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, value);
  } catch {
    // Blocked storage: the tour still runs, it just can't resume after a reload away from Home.
  }
}

/** Whether a tour is running in this tab for this account. */
export function tourActive(userId: string): boolean {
  return tourStep(userId) !== null;
}

/**
 * The step the running tour is on, as this tab last showed it, or null when none is running for
 * this account. The step is also saved to the account, but that save is a request that can still
 * be on its way when the page is reloaded; the tab's own note is written at once, so a reload
 * resumes on exactly the step the person was looking at.
 */
export function tourStep(userId: string): number | null {
  if (typeof window === "undefined") return null;
  const [owner, step] = (read(ACTIVE) ?? "").split(":");
  if (!userId || owner !== userId) return null;
  const n = Number(step);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

/** Marks the tour as running on `step` for this account, or as not running (`null`). */
export function setTourActive(userId: string, step: number | null) {
  if (step === null) delete document.documentElement.dataset.tour;
  else document.documentElement.dataset.tour = "";
  write(ACTIVE, step === null ? null : `${userId}:${step}`);
}

/**
 * The tour ended in this tab for this account (finished, skipped, or "Skip to Home" on the welcome
 * screen). The shell's copy of the saved state was read when the tab loaded, so the tab remembers
 * by itself and the tour doesn't start again on Home. A forced start (/feed?tour=1) ignores it.
 */
export function markTourEnded(userId: string) {
  write(ENDED, userId);
}

export function tourEnded(userId: string): boolean {
  return read(ENDED) === userId;
}
