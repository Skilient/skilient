/**
 * Every page in app/ for the CSP sweep (tests/e2e/csp-sweep.spec.ts; phase 13 slice 3). The unit test
 * tests/unit/csp-sweep.test.ts fails when a page.tsx exists that isn't listed here, so new screens join the sweep.
 *
 * `params` fill dynamic segments from the sweep's own fixtures (a key of SweepFixtures) or a literal ("=jobs").
 * A segment without a value gets a made-up id: the page then renders its not-found state inside its real
 * layout, and its full content is covered by the feature spec that creates the data (each watches the console
 * for CSP errors too).
 */
export type SweepRole = "visitor" | "student" | "faculty" | "recruiter" | "official" | "staff";

export interface SweepFixtures {
  username: string;
  studentId: string;
  venture: string;
  post: string;
  orgId: string;
  orgSlug: string;
  uniId: string;
  uniSlug: string;
}

export interface SweepRoute {
  route: string;
  role: SweepRole;
  params?: Record<string, keyof SweepFixtures | `=${string}`>;
}

const r = (role: SweepRole, routes: string[]): SweepRoute[] => routes.map((route) => ({ route, role }));

export const SWEEP: SweepRoute[] = [
  ...r("visitor", [
    "/", "/about", "/faculty", "/pricing", "/privacy", "/recruiters", "/terms", "/universities", "/verify", "/verify/[code]",
    "/request-university", "/request-university/confirm", "/request-university/unsubscribe", "/signin", "/signin/code",
    "/signin/mfa", "/signup", "/signup/recruiter", "/signup/verify", "/forgot-password", "/reset-password", "/auth/confirmed",
    "/auth/link", "/auth/not-me", "/ui", "/cv/[username]",
  ]),
  ...r("student", [
    "/feed", "/explore", "/friends", "/chat", "/chat/[threadId]", "/notifications", "/leaderboard", "/me", "/me/credentials",
    "/me/cv", "/me/score", "/me/skills", "/me/work", "/me/code-checks/[id]", "/opportunities", "/opportunities/applications/[id]",
    "/opportunities/contact-requests/[id]", "/opportunities/jobs/[id]", "/ventures", "/ventures/new", "/requests", "/feedback",
    "/appeals", "/events", "/events/[id]", "/events/[id]/attend", "/events/[id]/check-in", "/fairs/invite", "/fairs/[id]",
    "/competitions/[id]", "/ideas/[id]", "/moderation/[id]", "/billing/checkout/[session]", "/billing/return/[session]",
    "/settings", "/settings/account/delete", "/settings/billing", "/settings/chat", "/settings/github",
    "/settings/notifications", "/settings/privacy", "/settings/profile", "/settings/security", "/agreement", "/onboarding",
    "/onboarding/[step]", "/onboarding/done",
  ]),
  ...["jobs", "applications", "competitions", "ideas"].map((tab): SweepRoute => ({ route: "/opportunities/[tab]", role: "student", params: { tab: `=${tab}` } })),
  ...["/profile/[username]", "/profile/[username]/activity", "/profile/[username]/skills", "/profile/[username]/ventures"].map(
    (route): SweepRoute => ({ route, role: "student", params: { username: "username" } }),
  ),
  ...["", "/team", "/updates", "/contributions", "/deliverables", "/chat", "/reviews", "/manage"].map(
    (tail): SweepRoute => ({ route: `/ventures/[id]${tail}`, role: "student", params: { id: "venture" } }),
  ),
  { route: "/post/[id]", role: "student", params: { id: "post" } },
  { route: "/u/[slug]/[[...page]]", role: "student", params: { slug: "uniSlug" } },
  ...r("faculty", [
    "/teach", "/teach/apply", "/teach/code-checks", "/teach/code-checks/[id]", "/teach/ideas", "/teach/ideas/new",
    "/teach/ideas/[id]", "/teach/judging", "/teach/judging/[id]", "/teach/reviews", "/teach/reviews/[requestId]",
    "/teach/settings", "/teach/ventures/[id]",
  ]),
  ...r("recruiter", [
    "/recruit", "/recruit/analytics", "/recruit/candidates/[id]", "/recruit/competitions", "/recruit/competitions/new",
    "/recruit/competitions/[id]", "/recruit/contacts", "/recruit/jobs", "/recruit/jobs/new", "/recruit/jobs/[id]",
    "/recruit/jobs/[id]/applicants", "/recruit/search", "/recruit/shortlists", "/recruit/shortlists/[id]", "/org/billing",
    "/org/join", "/org/members", "/org/plan", "/org/settings", "/org/settings/api",
  ]),
  { route: "/companies/[slug]", role: "recruiter", params: { slug: "orgSlug" } },
  ...r("official", [
    "/uni", "/uni/announcements", "/uni/billing", "/uni/claim", "/uni/events", "/uni/fairs", "/uni/fairs/[id]", "/uni/hackathons",
    "/uni/join", "/uni/moderation", "/uni/people", "/uni/people/awards", "/uni/reports", "/uni/settings", "/uni/settings/admins",
    "/uni/settings/branding", "/uni/settings/calendar", "/uni/settings/domains", "/uni/settings/ecosphere", "/uni/sponsorship",
    "/uni/students", "/uni/students/[id]",
  ]),
  ...["adoption", "activity", "skills", "tiers", "outcomes", "faculty", "benchmark"].map(
    (area): SweepRoute => ({ route: "/uni/dashboard/[area]", role: "official", params: { area: `=${area}` } }),
  ),
  ...r("staff", [
    "/ops", "/ops/appeals", "/ops/appeals/[id]", "/ops/audit", "/ops/billing", "/ops/billing/[type]/[id]", "/ops/config",
    "/ops/config/plans", "/ops/config/skills", "/ops/evidence", "/ops/evidence/code-checks/[id]", "/ops/evidence/credentials/[id]",
    "/ops/evidence/flags/[id]", "/ops/evidence/ranking/[id]", "/ops/exam-periods", "/ops/feedback", "/ops/feedback/[id]",
    "/ops/graduation", "/ops/leads", "/ops/metrics", "/ops/orgs", "/ops/orgs/competitions", "/ops/orgs/spam", "/ops/reports",
    "/ops/reports/[id]", "/ops/sanctions", "/ops/staff", "/ops/teachers", "/ops/universities", "/ops/universities/claims/[id]",
    "/ops/users",
  ]),
  { route: "/ops/config/[key]", role: "staff", params: { key: "=alerts.limits" } },
  { route: "/ops/users/[id]", role: "staff", params: { id: "studentId" } },
  { route: "/ops/users/[id]/view/[page]", role: "staff", params: { id: "studentId", page: "=profile" } },
  { route: "/ops/orgs/[id]", role: "staff", params: { id: "orgId" } },
  { route: "/ops/universities/[id]", role: "staff", params: { id: "uniId" } },
];

export const PLACEHOLDER_ID = "00000000-0000-4000-8000-000000000000";

/** The URL to open: fixtures and literals fill their segments, the rest get a made-up id; optional catch-alls drop out. */
export function sweepPath(entry: SweepRoute, fixtures: Partial<SweepFixtures>): string {
  return entry.route
    .replace(/\/\[\[\.\.\.[^\]]+\]\]/g, "")
    .replace(/\[([^\]]+)\]/g, (_, name: string) => {
      const source = entry.params?.[name];
      if (source?.startsWith("=")) return encodeURIComponent(source.slice(1));
      const value = source ? fixtures[source as keyof SweepFixtures] : undefined;
      return encodeURIComponent(value ?? (name === "step" ? "1" : name === "type" ? "user" : PLACEHOLDER_ID));
    });
}
