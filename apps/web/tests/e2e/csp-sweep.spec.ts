import { expect, test, type Page } from "@playwright/test";
import { fakePostHog } from "./posthog-fake";
import { SWEEP, sweepPath, type SweepFixtures, type SweepRole } from "./sweep-routes";
import { roleSession } from "./sweep-fixtures";
import { hasBackend, watchConsole } from "./support";

/**
 * CSP sweep (PRD 8 "CSP reports no violations on every screen"; phase 13 slice 3). Every page in app/
 * (tests/e2e/sweep-routes.ts, kept complete by tests/unit/csp-sweep.test.ts) is opened as the role that
 * uses it, on the analytics server so PostHog and its recorder are loaded too. A page fails on any CSP
 * console error, a page error, a 5xx, or a redirect out of its area (a fixture that no longer sets the
 * role up properly would otherwise sweep the sign-in page 30 times).
 */
const ANALYTICS_URL = `http://127.0.0.1:${Number(process.env.PORT ?? 3100) + 1}`;

test.skip(!!process.env.E2E_BASE_URL, "needs the local analytics server");
test.use({ baseURL: ANALYTICS_URL });

test.describe("CSP sweep", () => {
  test.skip(!hasBackend, "needs the local Supabase stack");
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "desktop", "runs once, on desktop");
  });

  async function sweep(page: Page, role: SweepRole, fixtures: Partial<SweepFixtures>) {
    const fake = await fakePostHog(page);
    const problems = watchConsole(page);
    const failures: string[] = [];
    for (const entry of SWEEP.filter((s) => s.role === role)) {
      const path = sweepPath(entry, fixtures);
      const before = problems.length;
      const response = await page.goto(path, { waitUntil: "load" });
      await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
      const status = response?.status() ?? 0;
      const landed = new URL(page.url()).pathname;
      if (status >= 500) failures.push(`${path}: HTTP ${status}`);
      if (role !== "visitor" && /^\/(signin|agreement|settings\/security)(\/|$)/.test(landed) && !path.startsWith(landed)) {
        failures.push(`${path}: sent to ${landed}`);
      }
      for (const p of problems.slice(before)) failures.push(`${path}: ${p}`);
    }
    expect(failures).toEqual([]);
    expect(fake.scripts.length, "PostHog loaded during the sweep").toBeGreaterThan(0);
  }

  const roles: { role: SweepRole; title: string; timeout: number; portals?: boolean }[] = [
    { role: "visitor", title: "signed-out pages", timeout: 300_000 },
    { role: "student", title: "student pages", timeout: 600_000 },
    { role: "faculty", title: "faculty pages", timeout: 300_000 },
    { role: "recruiter", title: "recruiter pages", timeout: 300_000, portals: true },
    { role: "official", title: "university official pages", timeout: 300_000, portals: true },
    { role: "staff", title: "staff pages", timeout: 400_000 },
  ];
  for (const r of roles) {
    test(r.title, r.portals ? { tag: "@portals" } : {}, async ({ browser }) => {
      test.setTimeout(r.timeout);
      const { page, fixtures } = await roleSession(browser, r.role);
      await sweep(page, r.role, fixtures);
    });
  }
});
