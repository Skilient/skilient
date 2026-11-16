import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { adminClient, createStudent, hasBackend, signInWithPassword, watchConsole, type TestStudent } from "./support";

/**
 * Phase 6 (PRD 5.25, 5.27): the five-area shell, the guided tour by keyboard, the progress
 * card, first-visit tips, the Opportunities hub, the feedback centre, graduates and account
 * deletion with its cooling-off.
 */
test.describe("Student portal", () => {
  test.skip(!hasBackend, "needs the local Supabase stack");

  async function axe(page: Page, label: string) {
    await expect(page).toHaveTitle(/\S/);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    expect(results.violations.map((v) => `${label} ${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
  }

  function apiAs(student: TestStudent) {
    const url = process.env.E2E_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const api = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    return api.auth.signInWithPassword({ email: student.email, password: student.password }).then(() => api);
  }

  test("the shell, the tour by keyboard, the progress card and the tips", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "runs once, on desktop");
    test.setTimeout(150_000);
    const problems = watchConsole(page);
    const me = await createStudent({ domain: "nutech.edu.pk", fullName: "Tour Taker", tour: true });
    await signInWithPassword(page, me.email, me.password);
    await expect(page).toHaveURL(/\/feed/);

    // Every nav item carries its one-line description for assistive tech.
    for (const key of ["home", "openings", "ventures", "chat", "me", "events", "explore", "leaderboard", "notifications", "feedback"]) {
      await expect(page.getByTestId(`nav-${key}`)).toHaveAttribute("aria-describedby", /.+/);
    }

    // The tour starts by itself, lights one thing at a time, and runs from the keyboard alone.
    const popover = page.getByTestId("tour-popover");
    const progress = page.getByTestId("tour-progress");
    await expect(popover).toBeVisible();
    await expect(progress).toHaveText("Step 1 of 15");
    await expect(page.getByTestId("tour-spotlight")).toBeVisible();
    await expect(page.getByTestId("tour-next")).toBeFocused();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    // Focus passes through the trap's guard elements for a moment; it settles back inside the popover.
    await expect
      .poll(() => page.evaluate(() => !!document.activeElement?.closest("[data-testid=tour-popover]")), { timeout: 5000 })
      .toBe(true);
    const next = async (step: number) => {
      await page.getByTestId("tour-next").focus();
      await page.keyboard.press("Enter");
      await expect(progress).toHaveText(`Step ${step} of 15`);
    };
    await next(2);
    await expect(popover).toContainText("Search, or jump anywhere");
    await page.getByTestId("tour-back").focus();
    await page.keyboard.press("Enter");
    await expect(progress).toHaveText("Step 1 of 15");
    // Home: the rail, search, the two feeds, the composer, Your progress, then Openings on the rail.
    for (const step of [2, 3, 4, 5, 6]) await next(step);
    await expect(page).toHaveURL(/\/feed/);
    // It walks to Openings by itself; the first-visit tip stands down while the tour is talking.
    await next(7);
    await expect(page).toHaveURL(/\/openings$/);
    await expect(popover).toContainText("This week");
    await expect(page.getByTestId("tip-opportunities")).toBeHidden();
    // A reload in the middle resumes on the same step, on the same page.
    await page.reload();
    await expect(progress).toHaveText("Step 7 of 15");
    for (const step of [8, 9, 10, 11]) await next(step);
    // Then inside Me: the grouped panel.
    await next(12);
    await expect(page).toHaveURL(/\/me$/);
    await expect(popover).toContainText("Your proof, in one place");
    await next(13);
    await next(14);
    // It ends back on Home, with one thing to do.
    await next(15);
    await expect(page).toHaveURL(/\/feed$/);
    await expect(popover).toContainText("You're set");
    await page.getByTestId("tour-cta").click();
    await expect(popover).toHaveCount(0);
    await expect(page.getByTestId("composer").locator("textarea").first()).toBeFocused();
    const db = adminClient();
    await expect.poll(async () => (await db.from("tour_progress").select("completed_at").eq("user_id", me.id).single()).data?.completed_at ?? null, { timeout: 30_000 }).not.toBeNull();
    // With the tour out of the way the page can be used again: a nav tooltip on hover.
    await page.getByTestId("nav-openings").hover();
    await expect(page.getByRole("tooltip")).toContainText("each card with its newest opening");
    // Walking through Openings on the tour is not the student reading it: nothing was marked as seen.
    expect((await db.from("openings_seen").select("category").eq("user_id", me.id)).data).toEqual([]);
    // Finished: it doesn't start again.
    await page.reload();
    await expect(page.getByTestId("progress-card")).toBeVisible();
    await expect(popover).toHaveCount(0);

    // Replay from Settings, leave with Escape; it stays skipped-or-done and can be replayed again.
    await page.goto("/settings");
    await page.getByTestId("replay-tour").click();
    await expect(page).toHaveURL(/\/feed/);
    await expect(page.getByTestId("tour-progress")).toHaveText("Step 1 of 15");
    await page.keyboard.press("Escape");
    await expect(popover).toHaveCount(0);
    await expect.poll(async () => (await db.from("tour_progress").select("skipped_at").eq("user_id", me.id).single()).data?.skipped_at ?? null, { timeout: 30_000 }).not.toBeNull();

    // The progress card: a new student is asked to join a venture; it hides for the day.
    const card = page.getByTestId("progress-card");
    await expect(card.getByTestId("next-step")).toContainText("Join or start a venture");
    await expect(card.getByTestId("checklist")).toContainText("Getting started: 0 of 6");
    await axe(page, "home");
    await page.getByTestId("progress-dismiss").click();
    await expect(card).toHaveCount(0);
    await page.reload();
    await expect(card).toHaveCount(0);

    // First-visit tips: shown once, dismissed for good.
    await page.goto("/openings");
    const tip = page.getByTestId("tip-opportunities");
    await expect(tip).toBeVisible();
    await tip.getByRole("button", { name: "Show me more" }).click();
    await expect(tip).toContainText("This week is rebuilt every night");
    await tip.getByRole("button", { name: /Dismiss/ }).click();
    await expect(tip).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId("tip-opportunities")).toHaveCount(0);

    // Openings (phase 18): every category page shows its list or its empty state; shared lists may be filled by others.
    await axe(page, "openings");
    for (const slug of ["venture-roles", "inductions", "events", "ideas", "paths", "swaps"]) {
      await page.goto(`/openings/${slug}`);
      await expect(page.getByTestId("opening-list").or(page.locator("[data-empty-state]")).first()).toBeVisible();
    }
    await page.goto("/openings/bogus");
    await expect(page.getByRole("heading", { name: "We couldn't find that page" })).toBeVisible();

    // Me pages.
    for (const [path, heading] of [
      ["/me", me.fullName],
      ["/me/skills", "Your skills"],
      ["/me/work", "My work"],
      ["/settings/privacy", "Privacy"],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await axe(page, path);
    }
    await page.goto("/me/skills");
    await expect(page.getByTestId("github-reminder")).toBeVisible();
    await page.goto("/me/work?tab=endorsements");
    await expect(page.getByRole("heading", { name: "No endorsements yet" })).toBeVisible();
    expect(problems).toEqual([]);
  });

  test("welcome: the film ends on Start the tour, can be skipped, plays once, and leads into the tour", async ({ page, browser }, info) => {
    test.skip(info.project.name !== "desktop", "runs once, on desktop");
    test.setTimeout(120_000);
    const problems = watchConsole(page);
    const me = await createStudent({ domain: "nutech.edu.pk", fullName: "Wajiha Welcome", tour: true });
    await signInWithPassword(page, me.email, me.password);
    // Signing in lands on Home, where the tour would start: leave it for the welcome screen.
    await page.getByTestId("tour-skip").click();

    // First visit: the film plays to its end by itself and hands the keyboard to the way in.
    await page.goto("/onboarding/done");
    const welcome = page.getByTestId("welcome");
    await expect(page.getByRole("heading", { name: /Welcome to Skilient, Wajiha/ })).toBeAttached();
    await expect(page.getByTestId("welcome-description")).toContainText("This is where students prove what they can do.");
    await expect(page.getByTestId("welcome-skip-intro")).toBeVisible();
    await expect(welcome).not.toHaveAttribute("data-skip", "");
    await expect(welcome).toHaveAttribute("data-done", "", { timeout: 10_000 });
    await expect(page.getByTestId("start-tour")).toBeFocused();
    await expect(page.getByTestId("welcome-skip-intro")).toBeHidden();
    // No shell on this screen: it owns the window.
    await expect(page.getByTestId("nav-home")).toHaveCount(0);
    await axe(page, "welcome");

    // Seen once: a second visit shows the end state straight away. Settings replays the film.
    await page.reload();
    await expect(welcome).toHaveAttribute("data-skip", "");
    await page.goto("/settings");
    await page.getByTestId("replay-welcome").click();
    await expect(page).toHaveURL(/\/onboarding\/done\?replay=1$/);
    await expect(page.getByTestId("welcome-skip-intro")).toBeVisible();
    await page.getByTestId("welcome-skip-intro").click();
    await expect(welcome).toHaveAttribute("data-skip", "");

    // Start the tour: Home opens and the tour begins at its first step.
    await page.getByTestId("start-tour").click();
    await expect(page).toHaveURL(/\/feed$/);
    await expect(page.getByTestId("tour-progress")).toHaveText("Step 1 of 15");
    await page.getByTestId("tour-skip").click();

    // A shared computer: the next student to sign in on this browser still gets their own welcome
    // (the "seen" flag is kept per account), and their own tour.
    const next = await createStudent({ domain: "nutech.edu.pk", fullName: "Nida Next", tour: true });
    await page.context().clearCookies();
    await signInWithPassword(page, next.email, next.password);
    await expect(page.getByTestId("tour-progress")).toHaveText("Step 1 of 15");
    await page.getByTestId("tour-skip").click();
    await page.goto("/onboarding/done");
    await expect(page.getByRole("heading", { name: /Welcome to Skilient, Nida/ })).toBeAttached();
    await expect(page.getByTestId("welcome-skip-intro")).toBeVisible();
    await expect(page.getByTestId("welcome")).not.toHaveAttribute("data-skip", "");

    // Less motion: no film at all, the end state from the start.
    const calm = await browser.newContext({ reducedMotion: "reduce" });
    const calmPage = await calm.newPage();
    await signInWithPassword(calmPage, me.email, me.password);
    await calmPage.goto("/onboarding/done?replay=1");
    await expect(calmPage.getByTestId("welcome")).toHaveAttribute("data-skip", "");
    await expect(calmPage.getByTestId("start-tour")).toBeVisible();
    await calm.close();
    expect(problems).toEqual([]);
  });

  test("the phone shell: five places in the dock, a header and a shorter tour", async ({ page }, info) => {
    test.skip(info.project.name !== "phone", "phone only");
    test.setTimeout(90_000);
    const me = await createStudent({ domain: "nutech.edu.pk", fullName: "Phone Tabs", tour: true });
    await signInWithPassword(page, me.email, me.password);
    // Phone: every step but the sidebar's second tier, which only desktop has.
    await expect(page.getByTestId("tour-progress")).toHaveText(/Step 1 of 14/);
    // "Your progress" is a chip above the feed here, not a column.
    await expect(page.getByTestId("progress-chip")).toBeVisible();
    await expect(page.getByTestId("progress-card")).toBeHidden();
    await page.getByTestId("tour-skip").click();
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link")).toHaveCount(5);
    await page.getByTestId("tab-me").click();
    await expect(page).toHaveURL(/\/me$/);
    await expect(page.getByRole("link", { name: "Feedback", exact: false }).first()).toBeVisible();
    await axe(page, "me (phone)");
  });

  test("feedback: send, follow its status, read the reply", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "runs once, on desktop");
    test.setTimeout(90_000);
    const me = await createStudent({ domain: "nutech.edu.pk", fullName: "Fiona Feedback" });
    await signInWithPassword(page, me.email, me.password);
    await page.goto("/feedback");
    await expect(page.getByRole("heading", { name: "You haven't sent any feedback yet" })).toBeVisible();
    await page.getByLabel("What happened, or what would help?").fill("What does Momentum mean on my score page?");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    const list = page.getByTestId("my-feedback");
    await expect(list).toContainText("What does Momentum mean");
    await expect(list).toContainText("Received");
    await axe(page, "feedback");
    const db = adminClient();
    await db.from("feedback").update({ status: "planned", staff_reply: "We'll explain Momentum on the score page." }).eq("user_id", me.id);
    await page.reload();
    await expect(list).toContainText("Planned");
    await expect(list).toContainText("We'll explain Momentum on the score page.");
  });

  test("a graduate posts to the Global Feed only", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "runs once, on desktop");
    test.setTimeout(90_000);
    const grad = await createStudent({ domain: "nutech.edu.pk", fullName: "Gul Graduate" });
    const db = adminClient();
    await db.from("profiles").update({ status: "graduate", graduated_at: new Date().toISOString() }).eq("user_id", grad.id);
    const api = await apiAs(grad);
    const refused = await api.rpc("create_post", { p: { audience: "university", type: "general", body: "hello campus" } });
    expect(refused.error?.code).toBe("42501");
    const allowed = await api.rpc("create_post", { p: { audience: "global", type: "general", body: "hello world" } });
    expect(allowed.error).toBeNull();
    await signInWithPassword(page, grad.email, grad.password);
    await page.goto("/feed");
    await expect(page.getByRole("radio", { name: "University" })).toBeDisabled();
    await expect(page.getByRole("radio", { name: "Global" })).toBeChecked();
  });

  test("deleting an account: cooling-off, locked to one page, cancel restores it", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "runs once, on desktop");
    test.setTimeout(90_000);
    const me = await createStudent({ domain: "nutech.edu.pk", fullName: "Dana Delete" });
    await signInWithPassword(page, me.email, me.password);
    await page.goto("/settings/account/delete");
    await axe(page, "delete account");
    const submit = page.getByTestId("delete-submit");
    await expect(submit).toBeDisabled();
    await page.getByTestId("delete-confirm").fill(me.username);
    await submit.click();
    await expect(page.getByTestId("deletion-pending")).toBeVisible();
    await page.goto("/feed");
    await expect(page).toHaveURL(/\/settings\/account\/delete$/);
    const db = adminClient();
    expect((await db.from("profiles").select("status").eq("user_id", me.id).single()).data?.status).toBe("deleting");
    await page.getByTestId("delete-cancel").click();
    await expect(page).toHaveURL(/\/feed/);
    const { data } = await db.from("profiles").select("status, delete_after").eq("user_id", me.id).single();
    expect(data).toEqual({ status: "active", delete_after: null });
    await expect(page.getByTestId("nav-home")).toBeVisible();
  });
});
