import { expect, test, type Browser, type Page } from "./fixtures";
import { fakePostHog } from "./posthog-fake";
import { chunkTitle, sweepChunks, sweepPath, type SweepFixtures, type SweepRole, type SweepRoute } from "./sweep-routes";
import { adminClient, currentAgreementVersion, createStudent, hasBackend, PASSWORD, settle, signInWithPassword, totp, uniqueEmail, watchConsole, type TestStudent } from "./support";

/**
 * CSP sweep (PRD 8 "CSP reports no violations on every screen"; phase 13 slice 3). Every page in app/
 * (tests/e2e/sweep-routes.ts, kept complete by tests/unit/csp-sweep.test.ts) is opened as the role that
 * uses it, on the analytics server so PostHog and its recorder are loaded too. A page fails on any CSP
 * console error, a page error, a 5xx, or a redirect out of its area (a fixture that no longer sets the
 * role up properly would otherwise sweep the sign-in page 30 times).
 *
 * Each role's pages are split into chunks of SWEEP_CHUNK, one test (own account, own browser context) per
 * chunk, so the sweep spreads over shards instead of one 3-minute test per role. Before each page is judged,
 * it waits for PostHog to start on it (its first /ingest request; the loader waits for an idle moment, at most
 * 4 s) and for the page to settle, instead of a flat network-idle wait capped at 5 s.
 */
const ANALYTICS_URL = `http://127.0.0.1:${Number(process.env.PORT ?? 3100) + 1}`;

test.skip(!!process.env.E2E_BASE_URL, "needs the local analytics server");
test.use({ baseURL: ANALYTICS_URL });

test.describe("CSP sweep", { tag: "@desktop-only" }, () => {
  test.skip(!hasBackend, "needs the local Supabase stack");

  async function account(email: string, fullName: string, meta: Record<string, unknown> = {}): Promise<TestStudent> {
    const db = adminClient();
    const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: fullName, ...meta } });
    if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
    await db.from("agreement_acceptances").insert({ user_id: data.user.id, version: await currentAgreementVersion(db) });
    return { id: data.user.id, email, password: PASSWORD, fullName, username: "" };
  }

  /** A fresh context for one chunk; the caller closes it. */
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

  async function sweep(page: Page, role: SweepRole, routes: SweepRoute[], fixtures: Partial<SweepFixtures>) {
    const fake = await fakePostHog(page);
    const problems = watchConsole(page);
    const failures: string[] = [];
    try {
      for (const entry of routes) {
        const path = sweepPath(entry, fixtures);
        const before = problems.length;
        const analytics = page.waitForRequest((r) => new URL(r.url()).pathname.startsWith("/ingest/"), { timeout: 8_000 }).catch(() => null);
        const response = await page.goto(path, { waitUntil: "load" });
        const status = response?.status() ?? 0;
        if (status < 400) {
          if (!(await analytics)) failures.push(`${path}: PostHog never started`);
          await settle(page);
        }
        const landed = new URL(page.url()).pathname;
        if (status >= 500) failures.push(`${path}: HTTP ${status}`);
        if (role !== "visitor" && /^\/(signin|agreement|settings\/security)(\/|$)/.test(landed) && !path.startsWith(landed)) {
          failures.push(`${path}: sent to ${landed}`);
        }
        for (const p of problems.slice(before)) failures.push(`${path}: ${p}`);
      }
    } finally {
      await page.context().close();
    }
    expect(failures).toEqual([]);
    expect(fake.scripts.length, "PostHog loaded during the sweep").toBeGreaterThan(0);
  }

  for (const [index, routes] of sweepChunks("visitor").entries()) {
    test(chunkTitle("visitor", sweepChunks("visitor"), index), async ({ browser }) => {
      test.setTimeout(120_000);
      const { fixtures } = await studentFixtures();
      await sweep(await signedIn(browser, null), "visitor", routes, fixtures);
    });
  }

  for (const [index, routes] of sweepChunks("student").entries()) {
    test(chunkTitle("student", sweepChunks("student"), index), async ({ browser }) => {
      test.setTimeout(120_000);
      const { student, fixtures } = await studentFixtures();
      await sweep(await signedIn(browser, student), "student", routes, fixtures);
    });
  }

  for (const [index, routes] of sweepChunks("faculty").entries()) {
    test(chunkTitle("faculty", sweepChunks("faculty"), index), async ({ browser }) => {
      test.setTimeout(120_000);
      const db = adminClient();
      const faculty = await account(uniqueEmail("nutech.edu.pk", "fac"), "Dr Sweep", { role: "faculty" });
      const { data: profile } = await db.from("profiles").select("university_id").eq("user_id", faculty.id).single();
      const { error } = await db.from("teacher_profiles").upsert({
        user_id: faculty.id, university_id: profile!.university_id, department: "Computer Science", title: "Lecturer",
        status: "approved", approved_at: new Date().toISOString(), approval_source: "staff",
      });
      if (error) throw new Error(error.message);
      await sweep(await signedIn(browser, faculty), "faculty", routes, {});
    });
  }

  for (const [index, routes] of sweepChunks("recruiter").entries()) {
    test(chunkTitle("recruiter", sweepChunks("recruiter"), index), { tag: "@portals" }, async ({ browser }) => {
      test.setTimeout(120_000);
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
      await sweep(await signedIn(browser, recruiter, true), "recruiter", routes, { orgSlug: slug });
    });
  }

  for (const [index, routes] of sweepChunks("official").entries()) {
    test(chunkTitle("official", sweepChunks("official"), index), { tag: "@portals" }, async ({ browser }) => {
      test.setTimeout(120_000);
      const db = adminClient();
      const { data } = await db.from("university_domains").select("university_id, domain, universities!inner(owner_id)").eq("kind", "both").is("universities.owner_id", null).limit(50);
      const { data: open } = await db.from("university_claims").select("university_id").eq("status", "pending");
      const busy = new Set((open ?? []).map((c) => c.university_id));
      // Chunks run in parallel: each claims a different unclaimed university.
      const candidates = (data ?? []).filter((r) => !["nutech.edu.pk", "nu.edu.pk", "preston.edu.pk"].includes(r.domain) && !busy.has(r.university_id));
      let official: TestStudent | null = null;
      for (const row of candidates) {
        const who = await account(`sweep-${Math.random().toString(36).slice(2, 8)}@${row.domain}`, "Rida Sweep", { role: "university_admin", university_id: row.university_id });
        // Take the university only if it is still unowned (other chunks and uni.spec.ts look for one too).
        const { data: claimed } = await db.from("universities").update({ owner_id: who.id, claimed_at: new Date().toISOString() }).eq("id", row.university_id).is("owner_id", null).select("id");
        if (!claimed?.length) continue;
        await db.from("university_admins").insert({ user_id: who.id, university_id: row.university_id, role: "owner" });
        official = who;
        break;
      }
      if (!official) throw new Error("no unclaimed university");
      await sweep(await signedIn(browser, official, true), "official", routes, {});
    });
  }

  for (const [index, routes] of sweepChunks("staff").entries()) {
    test(chunkTitle("staff", sweepChunks("staff"), index), async ({ browser }) => {
      test.setTimeout(120_000);
      const db = adminClient();
      const { student, fixtures } = await studentFixtures();
      const admin = await createStudent({ domain: "nutech.edu.pk", fullName: "Sana Sweep" });
      await db.from("staff_roles").insert({ user_id: admin.id, role: "super_admin", granted_by: admin.id });
      const { data: org } = await db.from("organizations").select("id").limit(1).maybeSingle();
      const { data: profile } = await db.from("profiles").select("university_id").eq("user_id", student.id).single();
      await sweep(await signedIn(browser, admin, true), "staff", routes, { ...fixtures, orgId: org?.id, uniId: profile!.university_id as string });
    });
  }
});
