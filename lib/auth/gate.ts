/**
 * Route gates (PRD 5.2, 5.27, 10): who may see which path, and where everyone else goes.
 * Pure so proxy.ts, /auth/callback and the tests share one decision table.
 */

/** Shape of public.my_gate_state(). */
export interface GateState {
  has_profile: boolean;
  role: string | null;
  university_id: string | null;
  username: string | null;
  onboarding_complete: boolean;
  onboarding_step: number;
  agreement_version: number | null;
  agreement_accepted: boolean;
  email_allowed: boolean;
  /** Absent on a database from before phase 6. */
  status?: "active" | "graduate" | "deleting";
  /** platform_config `portals.enabled` (phase 14). Absent on a database from before it. */
  portals?: Portals;
}

/** Which portals are open (platform_config `portals.enabled`, decisions 2026-11-02). */
export interface Portals {
  recruiter: boolean;
  university: boolean;
  faculty: boolean;
}

/** The student-first default: recruiter and university portals off, faculty on. */
export const DEFAULT_PORTALS: Portals = { recruiter: false, university: false, faculty: true };

/**
 * Where a closed portal's own sign-up and claim pages send people: the marketing page's
 * "Talk to us" form (decisions 2026-11-02, "Marketing routes").
 */
const PORTAL_TALK: { prefix: string; portal: keyof Portals; to: string }[] = [
  { prefix: "/signup/recruiter", portal: "recruiter", to: "/recruiters#talk" },
  { prefix: "/org/join", portal: "recruiter", to: "/recruiters#talk" },
  { prefix: "/uni/claim", portal: "university", to: "/universities#talk" },
  { prefix: "/uni/join", portal: "university", to: "/universities#talk" },
];

/** The rest of each portal's routes answer 404 while it is closed. Job fairs need both portals. */
const PORTAL_ROUTES: { prefix: string; needs: (keyof Portals)[] }[] = [
  { prefix: "/recruit", needs: ["recruiter"] },
  { prefix: "/org", needs: ["recruiter"] },
  { prefix: "/companies", needs: ["recruiter"] },
  { prefix: "/uni", needs: ["university"] },
  { prefix: "/fairs", needs: ["university", "recruiter"] },
  { prefix: "/teach", needs: ["faculty"] },
  // The student side of the recruiter portal (Opportunities tabs and their detail pages).
  { prefix: "/opportunities/jobs", needs: ["recruiter"] },
  { prefix: "/opportunities/applications", needs: ["recruiter"] },
  { prefix: "/opportunities/contact_requests", needs: ["recruiter"] },
  { prefix: "/opportunities/contact-requests", needs: ["recruiter"] },
  { prefix: "/opportunities/job_fairs", needs: ["university", "recruiter"] },
];

/** True when the path belongs to a portal, so the gate needs the flag even for a signed-out visitor. */
export function isPortalPath(pathname: string): boolean {
  return PORTAL_TALK.some((r) => matches(pathname, r.prefix)) || PORTAL_ROUTES.some((r) => matches(pathname, r.prefix));
}

/** What a closed portal's path does: a redirect to "Talk to us", a 404, or nothing (open). */
export function closedPortalDecision(pathname: string, portals: Portals): GateDecision | null {
  const talk = PORTAL_TALK.find((r) => matches(pathname, r.prefix));
  if (talk && !portals[talk.portal]) return { type: "redirect", to: talk.to };
  const route = PORTAL_ROUTES.find((r) => matches(pathname, r.prefix));
  if (route && route.needs.some((p) => !portals[p])) return { type: "not-found" };
  return null;
}

/** The portal a role works in, if it has one of its own. */
function portalOfRole(role: string | null): keyof Portals | null {
  if (role === "recruiter") return "recruiter";
  if (role === "university_admin") return "university";
  if (role === "faculty") return "faculty";
  return null;
}

export const ONBOARDING_STEPS = ["university", "profile", "github", "skills", "looking-for", "people"] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export function onboardingPath(step: number): string {
  const index = Math.min(Math.max(Math.trunc(step) || 1, 1), ONBOARDING_STEPS.length) - 1;
  return `/onboarding/${ONBOARDING_STEPS[index]}`;
}

/** 1-based step number for an onboarding slug, or null. */
export function onboardingStepNumber(slug: string): number | null {
  const i = (ONBOARDING_STEPS as readonly string[]).indexOf(slug);
  return i === -1 ? null : i + 1;
}

/** Where a signed-in user belongs right now (PRD 5.2: onboarding if incomplete, else /feed). */
export const DELETE_PATH = "/settings/account/delete";

export function homeFor(state: GateState): string {
  if (state.status === "deleting") return DELETE_PATH;
  if (!state.agreement_accepted) return "/agreement";
  if (!state.onboarding_complete) return onboardingPath(state.onboarding_step);
  // Faculty have no student onboarding: their home is the teacher portal (PRD 5.21); recruiters'
  // is the recruiter portal (PRD 5.20), where /recruit sends them on to /org/join until they
  // belong to an organisation.
  if (state.role === "recruiter") return "/recruit";
  // University officials' home is their portal; without a seat it sends them on to /uni/claim.
  if (state.role === "university_admin") return "/uni";
  return state.role === "faculty" ? "/teach" : "/feed";
}

const AUTH_PAGES = ["/signin", "/signup", "/forgot-password"];

/**
 * A validated same-origin path for `next` (PRD 5.2: /auth/callback honours it).
 * Refuses absolute and protocol-relative URLs, backslashes, control characters and
 * auth pages (which would loop).
 */
export function safeNext(value: string | null | undefined): string | null {
  if (!value || value.length > 512) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;
  let url: URL;
  try {
    url = new URL(value, "https://skilient.invalid");
  } catch {
    return null;
  }
  if (url.origin !== "https://skilient.invalid") return null;
  if (url.pathname.startsWith("/auth/") || AUTH_PAGES.some((p) => url.pathname === p || url.pathname.startsWith(`${p}/`))) {
    return null;
  }
  return `${url.pathname}${url.search}`;
}

function matches(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** The public marketing site (PRD 5.1). */
export const MARKETING_PATHS = [
  "/recruiters",
  "/universities",
  "/faculty",
  "/about",
  "/pricing",
  "/features",
  "/request-university",
  "/join",
  "/terms",
  "/privacy",
] as const;

/** Open to everyone, signed in or not. */
export function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    // The landing page's Open Graph card (the others sit under their pages' paths); built with a hash suffix.
    pathname.startsWith("/opengraph-image") ||
    // PRD 5.1: there is no /demo, and it answers 404 rather than a sign-in redirect.
    matches(pathname, "/demo") ||
    ["/auth", "/api", "/ui", "/verify", "/cv", "/.well-known", ...MARKETING_PATHS].some((p) => matches(pathname, p))
  );
}

/** Signed-in users are sent home from these (PRD 5.2). */
export function isAuthPage(pathname: string): boolean {
  return AUTH_PAGES.some((p) => matches(pathname, p)) && pathname !== "/signin/mfa";
}

/** Portals whose roles must use two-factor (PRD 10): refused on an aal1 session. */
export function requiresTwoFactor(pathname: string): boolean {
  return ["/ops", "/uni", "/recruit", "/org"].some((p) => matches(pathname, p));
}

/** The only areas a recruiter account uses (PRD 5.20): everything else is for students. */
const RECRUITER_PREFIXES = ["/recruit", "/org", "/companies", "/chat", "/notifications", "/settings", "/feedback", "/fairs", "/billing", "/appeals"];

/** The areas a university-official account uses (PRD 5.23): its portal, ecospheres and events. */
const UNI_ADMIN_PREFIXES = ["/uni", "/u", "/events", "/notifications", "/settings", "/feedback", "/competitions", "/billing"];

/** Who may open the recruiter portal: recruiter accounts only. */
function isRecruiterArea(pathname: string): boolean {
  return matches(pathname, "/recruit") || matches(pathname, "/org");
}

export interface GateInput {
  pathname: string;
  /** pathname + search, for ?next= */
  path: string;
  signedIn: boolean;
  aal: string | null;
  hasVerifiedFactor: boolean;
  state: GateState | null;
  /** The flag for a signed-out visitor on a portal path (proxy.ts reads portals_state()); signed in, state.portals wins. */
  portals?: Portals | null;
}

export type GateDecision = { type: "next" } | { type: "redirect"; to: string } | { type: "sign-out"; to: string } | { type: "not-found" };

const next = { type: "next" } as const;
const redirect = (to: string): GateDecision => ({ type: "redirect", to });
const withNext = (base: string, path: string) => {
  const n = safeNext(path);
  return n && n !== "/" ? `${base}?next=${encodeURIComponent(n)}` : base;
};

export function decideRoute({ pathname, path, signedIn, aal, hasVerifiedFactor, state, portals }: GateInput): GateDecision {
  if (isPublicPath(pathname)) return next;

  // Closed portals (phase 14): their routes are gone for everyone, signed in or not.
  const flag = state?.portals ?? portals ?? null;
  if (flag) {
    const closed = closedPortalDecision(pathname, flag);
    if (closed) return closed;
  }

  if (!signedIn) {
    if (isAuthPage(pathname) || pathname === "/reset-password") return next;
    return redirect(withNext("/signin", path));
  }

  // Two-factor enrolled but this session hasn't passed it yet.
  const mfaPending = hasVerifiedFactor && aal !== "aal2";
  if (pathname === "/signin/mfa") return mfaPending ? next : redirect(state ? homeFor(state) : "/feed");
  if (mfaPending) return redirect(withNext("/signin/mfa", path));

  if (!state || !state.has_profile || !state.email_allowed) {
    return { type: "sign-out", to: "/signin?error=domain" };
  }

  // An account whose portal is closed has nothing to open (phase 14 deleted them; this is the guard).
  const ownPortal = portalOfRole(state.role);
  if (ownPortal && flag && !flag[ownPortal]) return { type: "sign-out", to: "/signin?error=portal_closed" };

  // Cooling-off (PRD 5.25): a deleting account can only reach the page that cancels it.
  if (state.status === "deleting") return pathname === DELETE_PATH ? next : redirect(DELETE_PATH);

  if (isAuthPage(pathname)) return redirect(homeFor(state));
  if (pathname === "/reset-password") return next;
  if (requiresTwoFactor(pathname) && aal !== "aal2") return redirect("/settings/security?required=1");

  if (!state.agreement_accepted) {
    return pathname === "/agreement" ? next : redirect(withNext("/agreement", path));
  }
  if (pathname === "/agreement") return redirect(homeFor(state));

  if (!state.onboarding_complete) {
    if (matches(pathname, "/onboarding")) {
      const slug = pathname.split("/")[2];
      const step = slug ? onboardingStepNumber(slug) : null;
      // Back always works; skipping ahead of the saved step does not.
      if (step !== null && step <= state.onboarding_step) return next;
      return redirect(onboardingPath(state.onboarding_step));
    }
    return redirect(onboardingPath(state.onboarding_step));
  }
  if (matches(pathname, "/onboarding") && pathname !== "/onboarding/done") return redirect(homeFor(state));

  // Recruiter accounts stay in their own area; nobody else opens it.
  if (state.role === "recruiter" && !RECRUITER_PREFIXES.some((p) => matches(pathname, p))) return redirect("/recruit");
  if (isRecruiterArea(pathname) && state.role !== "recruiter") return redirect(homeFor(state));
  if (state.role === "university_admin" && !UNI_ADMIN_PREFIXES.some((p) => matches(pathname, p))) return redirect("/uni");
  // Students and recruiters never hold a portal seat (faculty may).
  if (matches(pathname, "/uni") && (state.role === "student" || state.role === "recruiter")) return redirect(homeFor(state));

  return next;
}
