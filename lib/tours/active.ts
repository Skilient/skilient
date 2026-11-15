/**
 * Whether a guided tour is running in this tab (client only). The tour walks through real pages,
 * so two things on them stand down while it does: first-visit tips (hidden by `html[data-tour]`
 * in neu.css) and "mark Openings as seen" (a tour visit shouldn't clear the student's new dots).
 * Kept in sessionStorage as well, so a reload in the middle of the tour resumes it.
 */
const KEY = "skilient:tour-active";

export function tourActive(): boolean {
  if (typeof window === "undefined") return false;
  if (document.documentElement.dataset.tour !== undefined) return true;
  try {
    return window.sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setTourActive(on: boolean) {
  if (on) document.documentElement.dataset.tour = "";
  else delete document.documentElement.dataset.tour;
  try {
    if (on) window.sessionStorage.setItem(KEY, "1");
    else window.sessionStorage.removeItem(KEY);
  } catch {
    // Blocked storage: the tour still runs, it just can't resume after a reload away from Home.
  }
}

const DECLINED = "skilient:tour-declined";

/**
 * The tour ended in this tab (finished, skipped, or "Skip to Home" on the welcome screen). The
 * shell's copy of the saved state was read when the tab loaded, so the tab remembers by itself and
 * the tour doesn't start again on Home. A forced start (/feed?tour=1) ignores it.
 */
export function declineTour() {
  try {
    window.sessionStorage.setItem(DECLINED, "1");
  } catch {
    // Blocked storage: the saved "skipped" still holds from the next page load on.
  }
}

export function tourDeclined(): boolean {
  try {
    return window.sessionStorage.getItem(DECLINED) === "1";
  } catch {
    return false;
  }
}
