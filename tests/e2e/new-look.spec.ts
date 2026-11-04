import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { SWEEP, sweepPath, type SweepFixtures, type SweepRole } from "./sweep-routes";
import { adminClient, createStudent, hasBackend, PASSWORD, currentAgreementVersion, signInWithPassword, uniqueEmail, watchConsole, type TestStudent } from "./support";

/**
 * Phase 14 "New look" (decisions 2026-11-02, "How the app looks"): the shell (two-tier sidebar,
 * header with ⌘K, phone dock), the post card's ⋯ menu and Share stub, and axe on every screen in
 * light and dark: every visitor, student and faculty page in tests/e2e/sweep-routes.ts. /ops keeps
 * PRD 9 and has its own axe sweep (ops-shell.spec.ts).
 */
const RULES = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function studentWithContent(): Promise<{ student: TestStudent; fixtures: Partial<SweepFixtures> }> {
  const db = adminClient();
  const student = await createStudent({ domain: "nutech.edu.pk", fullName: "Neha Look" });
  const { data: profile } = await db.from("profiles").select("university_id, universities(slug)").eq("user_id", student.id).single();
  const universityId = profile!.university_id as string;
  const { data: venture, error: ve } = await db
    .from("ventures")
    .insert({ type: "project", owner_id: student.id, university_id: universityId, title: "Look timetable", description: "A timetable planner for the new look." })
    .select("id")
    .single();
  if (ve) throw new Error(ve.message);
  await db.from("venture_members").insert({ venture_id: venture!.id, user_id: student.id, team_role: "lead" });
  const { data: post, error: pe } = await db
    .from("posts")
    .insert({ author_id: student.id, university_id: universityId, audience: "university", type: "general", body: "Look post" })
    .select("id")
    .single();
  if (pe) throw new Error(pe.message);
  const uniSlug = (profile!.universities as unknown as { slug: string }).slug;
  return { student, fixtures: { username: student.username, studentId: student.id, venture: venture!.id, post: post!.id, uniSlug } };
}

async function faculty(): Promise<TestStudent> {
  const db = adminClient();
  const email = uniqueEmail("nutech.edu.pk", "fac");
  const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: "Dr Look", role: "faculty" } });
  if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
  await db.from("agreement_acceptances").insert({ user_id: data.user.id, version: await currentAgreementVersion(db) });
  const { data: profile } = await db.from("profiles").select("university_id").eq("user_id", data.user.id).single();
  await db.from("teacher_profiles").upsert({
    user_id: data.user.id, university_id: profile!.university_id, department: "Computer Science", title: "Lecturer",
    status: "approved", approved_at: new Date().toISOString(), approval_source: "staff",
  });
  return { id: data.user.id, email, password: PASSWORD, fullName: "Dr Look", username: "" };
}

async function axeSweep(browser: Browser, who: TestStudent | null, role: SweepRole, fixtures: Partial<SweepFixtures>, colorScheme: "light" | "dark") {
  const failures: string[] = [];
  {
    const page = await (await browser.newContext({ colorScheme })).newPage();
    if (who) await signInWithPassword(page, who.email, who.password);
    for (const entry of SWEEP.filter((s) => s.role === role)) {
      const path = sweepPath(entry, fixtures);
      await page.goto(path, { waitUntil: "load" });
      await page.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => undefined);
      // Let first-paint motion settle so contrast is measured on the end state.
      await page.waitForTimeout(200);
      const results = await new AxeBuilder({ page }).withTags(RULES).analyze();
      for (const v of results.violations) failures.push(`${path} (${colorScheme}) ${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(", ")}`);
    }
    await page.context().close();
  }
  expect(failures).toEqual([]);
}

test.describe("New look: axe on every screen, light and dark", () => {
  test.skip(!hasBackend, "needs the local Supabase stack");
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "desktop", "runs once, on desktop");
  });

  // One test per role and theme, so each stays well inside its timeout on a busy CI shard.
  for (const scheme of ["light", "dark"] as const) {
    test(`visitor pages (${scheme})`, async ({ browser }) => {
      test.setTimeout(400_000);
      await axeSweep(browser, null, "visitor", {}, scheme);
    });

    test(`student pages (${scheme})`, async ({ browser }) => {
      test.setTimeout(600_000);
      const { student, fixtures } = await studentWithContent();
      await axeSweep(browser, student, "student", fixtures, scheme);
    });

    test(`faculty pages (${scheme})`, async ({ browser }) => {
      test.setTimeout(400_000);
      await axeSweep(browser, await faculty(), "faculty", {}, scheme);
    });
  }
});

test.describe("New look: the shell", () => {
  test.skip(!hasBackend, "needs the local Supabase stack");

  async function signedIn(page: Page) {
    const { student, fixtures } = await studentWithContent();
    await signInWithPassword(page, student.email, student.password);
    return { student, fixtures };
  }

  test("⌘K jumps anywhere; the rail and its levels follow the place", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "the rail is desktop and tablet");
    const problems = watchConsole(page);
    await signedIn(page);
    await page.goto("/feed");
    await expect(page.getByTestId("nav-openings")).toHaveAttribute("aria-label", "Openings");
    await page.keyboard.press("Control+k");
    const menu = page.getByTestId("command-menu");
    await expect(menu).toBeVisible();
    await menu.getByRole("combobox").fill("score");
    await expect(menu.getByRole("option", { name: /Score/ })).toBeVisible();
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/me\/score$/);
    await expect(page.getByTestId("nav-me")).toHaveAttribute("aria-current", "page");
    await expect(page.getByTestId("sidebar-levels").getByRole("link", { name: "Score" })).toHaveAttribute("aria-current", "page");
    // The search well opens the same menu, and Escape closes it.
    await page.getByTestId("command-trigger").click();
    await expect(menu).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    expect(problems).toEqual([]);
  });

  test("the phone dock has the five places, Openings among them", async ({ page }, info) => {
    test.skip(info.project.name !== "phone", "the dock is for phones");
    await signedIn(page);
    await page.goto("/feed");
    for (const key of ["home", "openings", "ventures", "chat", "me"]) await expect(page.getByTestId(`tab-${key}`)).toBeVisible();
    await expect(page.getByTestId("tab-home")).toHaveAttribute("aria-current", "page");
    await page.getByTestId("tab-ventures").click();
    await page.waitForURL(/\/ventures$/);
    await expect(page.getByTestId("tab-ventures")).toHaveAttribute("aria-current", "page");
  });

  test("a post: Comment and Share stay visible; Not for me, Mute and Report sit in ⋯", async ({ browser }, info) => {
    test.skip(info.project.name !== "desktop", "account flows run once, on desktop");
    const author = await signedIn(await (await browser.newContext()).newPage());
    const reader = await createStudent({ domain: "nutech.edu.pk", fullName: "Rafay Reader" });
    const page = await (await browser.newContext()).newPage();
    await signInWithPassword(page, reader.email, reader.password);
    await page.goto(`/post/${author.fixtures.post}`);
    const card = page.getByTestId("post").first();
    // Share opens the share-to-chat sheet (phase 18).
    await expect(card.getByTestId("post-share")).toHaveAttribute("aria-haspopup", "dialog");
    await expect(card.getByRole("button", { name: "Not for me" })).toHaveCount(0);
    await card.getByRole("button", { name: "More for this post" }).click();
    await expect(card.getByRole("button", { name: "More for this post" })).toHaveAttribute("aria-expanded", "true");
    for (const name of ["Not for me", "Mute Neha", "Report"]) await expect(card.getByRole("button", { name })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(card.getByRole("button", { name: "Not for me" })).toHaveCount(0);
  });
});
