import { expect, test, type Browser, type Page } from "@playwright/test";
import { fakePostHog } from "./posthog-fake";
import { SWEEP, sweepPath, type SweepFixtures, type SweepRole } from "./sweep-routes";
import { adminClient, createStudent, hasBackend, PASSWORD, signInWithPassword, totp, uniqueEmail, watchConsole, type TestStudent } from "./support";

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

  async function account(email: string, fullName: string, meta: Record<string, unknown> = {}): Promise<TestStudent> {
    const db = adminClient();
    const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: fullName, ...meta } });
    if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
    await db.from("agreement_acceptances").insert({ user_id: data.user.id, version: 1 });
    return { id: data.user.id, email, password: PASSWORD, fullName, username: "" };
  }

  async function signedIn(browser: Browser, who: TestStudent | null, twoFactor = false): Promise<Page> {
    const page = await (await browser.newContext()).newPage();
    if (!who) return page;
    await signInWithPassword(page, who.email, who.password);
    if (!twoFactor) return page;
    await page.goto("/settings/security");
    await page.getByRole("button", { name: "Set up two-factor" }).click();
    const secret = (await page.locator("code").first().textContent())?.trim() ?? "";
    await page.getByLabel("Code from the app").fill(totp(secret));
    await page.getByRole("button", { name: "Confirm" }).click();
    await page.getByRole("checkbox", { name: "I've saved these codes" }).check();
    await page.getByRole("button", { name: "Done" }).click();
    return page;
  }

  /** A student with a venture and a post, so profile, venture and post pages render real content. */
  async function studentFixtures(): Promise<{ student: TestStudent; fixtures: Partial<SweepFixtures> }> {
    const db = adminClient();
    const student = await createStudent({ domain: "nutech.edu.pk", fullName: "Sweep Student" });
    const { data: profile } = await db.from("profiles").select("university_id, universities(slug)").eq("user_id", student.id).single();
    const universityId = profile!.university_id as string;
    const { data: venture, error: ve } = await db
      .from("ventures")
      .insert({ type: "project", owner_id: student.id, university_id: universityId, title: "Sweep timetable", description: "A timetable planner." })
      .select("id")
      .single();
    if (ve) throw new Error(ve.message);
    await db.from("venture_members").insert({ venture_id: venture!.id, user_id: student.id, team_role: "lead" });
    const { data: post, error: pe } = await db
      .from("posts")
      .insert({ author_id: student.id, university_id: universityId, audience: "university", type: "general", body: "Sweep post" })
      .select("id")
      .single();
    if (pe) throw new Error(pe.message);
    const uniSlug = (profile!.universities as unknown as { slug: string }).slug;
    return { student, fixtures: { username: student.username, studentId: student.id, venture: venture!.id, post: post!.id, uniSlug } };
  }

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

  test("signed-out pages", async ({ browser }) => {
    test.setTimeout(300_000);
    const { fixtures } = await studentFixtures();
    await sweep(await signedIn(browser, null), "visitor", fixtures);
  });

  test("student pages", async ({ browser }) => {
    test.setTimeout(600_000);
    const { student, fixtures } = await studentFixtures();
    await sweep(await signedIn(browser, student), "student", fixtures);
  });

  test("faculty pages", async ({ browser }) => {
    test.setTimeout(300_000);
    const db = adminClient();
    const faculty = await account(uniqueEmail("nutech.edu.pk", "fac"), "Dr Sweep", { role: "faculty" });
    const { data: profile } = await db.from("profiles").select("university_id").eq("user_id", faculty.id).single();
    const { error } = await db.from("teacher_profiles").upsert({
      user_id: faculty.id, university_id: profile!.university_id, department: "Computer Science", title: "Lecturer",
      status: "approved", approved_at: new Date().toISOString(), approval_source: "staff",
    });
    if (error) throw new Error(error.message);
    await sweep(await signedIn(browser, faculty), "faculty", {});
  });

  test("recruiter pages", async ({ browser }) => {
    test.setTimeout(300_000);
    const db = adminClient();
    const domain = `sweep-${Math.random().toString(36).slice(2, 8)}.example.com`;
    const recruiter = await account(`rita@${domain}`, "Rita Sweep", { role: "recruiter" });
    const slug = domain.split(".")[0];
    const { data: org, error } = await db
      .from("organizations")
      .insert({ slug, name: "Sweep Co", domain, website: `https://${domain}`, industry: "Software", size: "1-10", city: "Lahore", signer_role: "CEO", status: "verified", created_by: recruiter.id })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await db.from("org_members").insert({ org_id: org!.id, user_id: recruiter.id, role: "admin" });
    await sweep(await signedIn(browser, recruiter, true), "recruiter", { orgSlug: slug });
  });

  test("university official pages", async ({ browser }) => {
    test.setTimeout(300_000);
    const db = adminClient();
    const { data } = await db.from("university_domains").select("university_id, domain, universities!inner(owner_id)").eq("kind", "both").is("universities.owner_id", null).limit(50);
    const { data: open } = await db.from("university_claims").select("university_id").eq("status", "pending");
    const busy = new Set((open ?? []).map((c) => c.university_id));
    const row = (data ?? []).find((r) => !["nutech.edu.pk", "nu.edu.pk", "preston.edu.pk"].includes(r.domain) && !busy.has(r.university_id));
    if (!row) throw new Error("no unclaimed university");
    const official = await account(`sweep-${Math.random().toString(36).slice(2, 8)}@${row.domain}`, "Rida Sweep", { role: "university_admin", university_id: row.university_id });
    await db.from("university_admins").insert({ user_id: official.id, university_id: row.university_id, role: "owner" });
    await db.from("universities").update({ owner_id: official.id, claimed_at: new Date().toISOString() }).eq("id", row.university_id);
    await sweep(await signedIn(browser, official, true), "official", {});
  });

  test("staff pages", async ({ browser }) => {
    test.setTimeout(400_000);
    const db = adminClient();
    const { student, fixtures } = await studentFixtures();
    const admin = await createStudent({ domain: "nutech.edu.pk", fullName: "Sana Sweep" });
    await db.from("staff_roles").insert({ user_id: admin.id, role: "super_admin", granted_by: admin.id });
    const { data: org } = await db.from("organizations").select("id").limit(1).maybeSingle();
    const { data: profile } = await db.from("profiles").select("university_id").eq("user_id", student.id).single();
    await sweep(await signedIn(browser, admin, true), "staff", { ...fixtures, orgId: org?.id, uniId: profile!.university_id as string });
  });
});
