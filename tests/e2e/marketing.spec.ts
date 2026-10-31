import AxeBuilder from "@axe-core/playwright";
import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";
import { adminClient, createStudent, hasBackend, signInWithPassword, watchConsole } from "./support";

/**
 * Phase 12 slice 1 (PRD 5.1, docs/marketing-design-plan.md): the marketing frame, the hero and
 * its university email field, the request flow, /join without JavaScript, the hero's fit on
 * desktop and phone, and axe in both themes.
 */
const DB_URL = process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const RULES = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function axeBothThemes(page: Page, label: string) {
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.reload();
    await expect(page).toHaveTitle(/\S/);
    await expect(page.locator("html")).toHaveClass(new RegExp(scheme));
    const results = await new AxeBuilder({ page }).withTags(RULES).analyze();
    expect(results.violations.map((v) => `${label} (${scheme}) ${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
  }
}

test.describe("Marketing: hero", () => {
  test("fits the first screen at 1280×720 and 390×844, headline in two lines on desktop", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "sizes are set explicitly");
    for (const [width, height] of [
      [1280, 720],
      [390, 844],
    ] as const) {
      await page.setViewportSize({ width, height });
      await page.goto("/");
      const field = page.getByTestId("hero-email");
      const join = page.locator("#join").getByRole("button", { name: "Join", exact: true });
      await expect(field).toBeVisible();
      for (const el of [field, join]) {
        const box = (await el.boundingBox())!;
        expect(box.y + box.height, `${width}x${height}`).toBeLessThanOrEqual(height);
      }
      if (width === 1280) {
        const lines = await page.locator("#hero-title").evaluate((h) => Math.round(h.getBoundingClientRect().height / parseFloat(getComputedStyle(h).lineHeight)));
        expect(lines).toBe(2);
        // The orbit of proof objects sits inside the first screen too.
        const orbit = (await page.getByTestId("hero-orbit").boundingBox())!;
        expect(orbit.y + orbit.height).toBeLessThanOrEqual(height);
      }
    }
  });

  test("axe in both themes, on desktop and phone", async ({ page }) => {
    const problems = watchConsole(page);
    await page.goto("/");
    await expect(page.locator("#hero-title")).toBeVisible();
    await axeBothThemes(page, "landing");
    expect(problems).toEqual([]);
  });

  test("the orbit arrives once on load; under reduced motion it is simply there", async ({ browser }, info) => {
    test.skip(info.project.name !== "desktop", "one browser is enough");
    const motion = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
    await motion.goto("/");
    const objects = motion.locator(".orbit-in");
    await expect(objects).toHaveCount(5);
    // The entrance ends with every object fully shown and nothing left running.
    await expect
      .poll(() => objects.evaluateAll((els) => els.every((e) => getComputedStyle(e).opacity === "1" && e.getAnimations().every((a) => a.playState === "finished"))), { timeout: 5000 })
      .toBe(true);

    const still = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: "reduce" })).newPage();
    await still.goto("/");
    expect(await still.locator(".orbit-in").evaluateAll((els) => els.map((e) => getComputedStyle(e).animationName))).toEqual(Array(5).fill("none"));
    expect(await still.locator(".orbit-obj").first().evaluate((e) => getComputedStyle(e).animationName)).toBe("none");
  });
});

test.describe("Marketing: landing story", () => {
  const SECTIONS = [
    "Anyone can write \u201cReact\u201d on a CV.",
    "Ayesha signs up with her university email.",
    "She links GitHub, and her code starts to count.",
    "She builds with classmates, in a team of up to six.",
    "Her teammates confirm the work. Faculty can too.",
    "Six tiers. Only verified work moves you up.",
    "Skilient signs her CV.",
    "Recruiters find her. They ask first.",
    "Our rules",
    "Prove it. Don\u2019t claim it.",
    "For organisations",
    "Free is enough to prove yourself.",
    "Questions",
  ];

  test("every chapter is there, in order, with JavaScript off", async ({ browser }, info) => {
    test.skip(info.project.name !== "desktop", "one browser is enough");
    const page = await (await browser.newContext({ javaScriptEnabled: false })).newPage();
    await page.goto("/");
    const headings = await page.locator("main h2").allTextContents();
    const order = SECTIONS.map((h) => headings.indexOf(h));
    expect(order.every((i) => i >= 0), JSON.stringify(headings)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    for (const h of SECTIONS) await expect(page.getByRole("main").getByRole("heading", { level: 2, name: h, exact: true })).toBeVisible();
    // Without motion each chapter shows its object and the line it added, inline.
    await expect(page.locator("#first-commit .inline-visual")).toBeVisible();
    await expect(page.locator(".story-stage").first()).toBeHidden();
    // The FAQ works without JavaScript too.
    await page.getByText("What happens when I graduate?").click();
    await expect(page.getByText("Your account becomes a graduate account.")).toBeVisible();
  });

  test("on a large screen the record fills as the chapters pass, and the climb rises", async ({ browser }, info) => {
    test.skip(info.project.name !== "desktop", "one browser is enough");
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
    await page.goto("/");
    const stage = page.locator(".story-a .story-stage");
    await expect(stage).toBeVisible();
    const opacity = (selector: string) => page.locator(selector).evaluate((e) => Number(getComputedStyle(e).opacity));
    const scrollToEl = (selector: string, where: "start" | "end") =>
      page.locator(selector).evaluate((el, at) => {
        const top = el.getBoundingClientRect().top + window.scrollY;
        window.scrollTo(0, at === "start" ? top : top + (el as HTMLElement).offsetHeight - window.innerHeight);
      }, where);
    await scrollToEl(".story-a", "start");
    await expect.poll(() => opacity(".story-a .record .rec-skills .rec-fill")).toBe(0);
    await expect.poll(() => opacity(".story-a .record .rec-skills .rec-wait")).toBe(1);
    await scrollToEl(".story-a", "end");
    await expect.poll(() => opacity(".story-a .record .rec-skills .rec-fill")).toBe(1);
    await expect.poll(() => opacity(".story-a .record .rec-endorse .rec-fill")).toBe(1);
    await expect.poll(() => opacity(".story-a .record .rec-tier-flare")).toBe(1);

    const track = page.locator(".climb-track");
    await scrollToEl(".climb", "start");
    const before = await track.evaluate((e) => e.getBoundingClientRect().left);
    await scrollToEl(".climb", "end");
    await expect.poll(() => track.evaluate((e) => e.getBoundingClientRect().left)).toBeLessThan(before - 400);
    await expect(page.locator(".climb-stop-here")).toContainText("Ayesha is here");
  });

  test("reduced motion shows every scene in place; the FAQ works from the keyboard", async ({ browser }, info) => {
    test.skip(info.project.name !== "desktop", "one browser is enough");
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: "reduce" })).newPage();
    await page.goto("/");
    // Nothing pins: the scenes are in normal flow, the climb lists all six tiers.
    expect(await page.locator(".climb-pin").evaluate((e) => getComputedStyle(e).position)).toBe("static");
    await expect(page.locator(".climb-stop")).toHaveCount(6);
    for (const el of await page.locator(".climb-stop").all()) {
      await el.scrollIntoViewIfNeeded();
      await expect(el).toBeVisible();
    }
    await expect(page.locator(".story-stage").first()).toBeHidden();

    const summary = page.locator("summary", { hasText: "How do recruiters contact me?" });
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText("Through a contact request that names the company and the role.")).toBeVisible();
  });

  test("the pricing teaser reads Student Pro from plans", async ({ page }, info) => {
    test.skip(!hasBackend || info.project.name !== "desktop", "needs the local Supabase stack");
    const { data } = await adminClient().from("plans").select("price_pkr").eq("id", "student_pro_monthly").single();
    await page.goto("/");
    await expect(page.getByTestId("pricing-teaser")).toContainText(`PKR ${Number(data!.price_pkr).toLocaleString("en-PK")}`);
  });
});

test.describe("Marketing: without JavaScript", () => {
  test("content shows its end state and the email field posts to /join", async ({ browser }, info) => {
    test.skip(info.project.name !== "desktop", "one browser is enough");
    const page = await (await browser.newContext({ javaScriptEnabled: false })).newPage();
    await page.goto("/");
    await expect(page.locator("#hero-title")).toBeVisible();
    await expect(page.locator(".orbit-obj")).toHaveCount(5);
    // Nothing on the page is hidden waiting for a script.
    const hidden = await page.locator("main *").evaluateAll((els) =>
      els.filter((e) => e.checkVisibility() && getComputedStyle(e).opacity === "0").map((e) => e.className),
    );
    expect(hidden).toEqual([]);

    await page.getByTestId("hero-email").fill("ali@gmail.com");
    await page.locator("#join").getByRole("button", { name: "Join", exact: true }).click();
    await expect(page).toHaveURL(/\/\?email=ali%40gmail\.com&state=personal#join/);
    await expect(page.getByTestId("hero-status")).toContainText("Use your university email.");

    await page.getByTestId("hero-email").fill("someone@nutech.edu.pk");
    await page.locator("#join").getByRole("button", { name: "Join", exact: true }).click();
    await expect(page).toHaveURL(/\/signup\?email=someone%40nutech\.edu\.pk/);
    await expect(page.getByLabel("University email")).toHaveValue("someone@nutech.edu.pk");

    await page.goto("/");
    await page.getByTestId("hero-email").fill("me@no-such-uni-e2e.edu.pk");
    await page.locator("#join").getByRole("button", { name: "Join", exact: true }).click();
    await expect(page).toHaveURL(/\/request-university\?email=/);
    await expect(page.getByRole("heading", { level: 1, name: "Request your university" })).toBeVisible();
  });

  test("the phone menu opens without JavaScript", async ({ browser }, info) => {
    test.skip(info.project.name !== "phone", "the menu is for small screens");
    const page = await (await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } })).newPage();
    await page.goto("/");
    await page.getByRole("button", { name: "Menu" }).click();
    await expect(page.locator("#site-menu").getByRole("link", { name: "Verify a CV" })).toBeVisible();
  });
});

test.describe("Marketing: university email detection and requests", () => {
  test.skip(!hasBackend, "needs the local Supabase stack");
  // Every request from the test runner shares one network's limit: run these one at a time, each from a clean count.
  test.describe.configure({ mode: "serial" });
  async function resetRequestLimit() {
    const sql = postgres(DB_URL, { max: 1, onnotice: () => undefined });
    await sql`delete from private.rate_limit_events where key like 'uni_request:%'`;
    await sql.end();
  }

  test("live, personal, unknown and not-live domains; a request is sent once", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "account flows run once, on desktop");
    const problems = watchConsole(page);
    await resetRequestLimit();
    // A university that isn't live yet.
    const tag = randomBytes(4).toString("hex");
    const db = adminClient();
    const { data: uni, error } = await db
      .from("universities")
      .insert({ name: `Closed Test University ${tag}`, slug: `closed-test-${tag}`, city: "Quetta", live_at: null })
      .select("id")
      .single();
    expect(error).toBeNull();
    await db.from("university_domains").insert({ university_id: uni!.id, domain: `closed-${tag}.edu.pk`, kind: "both" });

    await page.goto("/");
    const field = page.getByTestId("hero-email");
    const status = page.getByTestId("hero-status");
    await field.fill("hira@nutech.edu.pk");
    await expect(status).toContainText("is on Skilient.");
    await field.fill("hira@gmail.com");
    await expect(status).toContainText("Use your university email.");
    await field.fill("hira@unknown-e2e.edu.pk");
    await expect(status).toContainText("We don't recognise this university.");
    await field.fill(`hira.${tag}@closed-${tag}.edu.pk`);
    await expect(status).toContainText(`Closed Test University ${tag} isn't on Skilient yet.`);

    // Join on a not-live domain opens the request sheet with the university named.
    await page.locator("#join").getByRole("button", { name: "Join", exact: true }).click();
    const sheet = page.getByRole("dialog", { name: "Request your university" });
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText(`Requesting Closed Test University ${tag}.`);
    await expect(sheet.getByLabel("University email")).toHaveValue(`hira.${tag}@closed-${tag}.edu.pk`);
    await sheet.getByRole("button", { name: "Send request" }).click();
    await expect(sheet.getByText("Tick the box so we can email you when your university joins.")).toBeVisible();
    await sheet.getByLabel("Email me when my university joins.").check();
    await sheet.getByRole("button", { name: "Send request" }).click();
    await expect(sheet.getByTestId("request-done")).toContainText("Request sent.");
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();

    // Asking again changes nothing.
    await page.goto(`/request-university?email=hira.${tag}%40closed-${tag}.edu.pk`);
    await page.getByLabel("Email me when my university joins.").check();
    await page.getByRole("button", { name: "Send request" }).click();
    await expect(page.getByTestId("request-done")).toContainText(`You've already asked for Closed Test University ${tag}.`);

    const { count } = await db.from("university_requests").select("id", { count: "exact", head: true }).eq("domain", `closed-${tag}.edu.pk`);
    expect(count).toBe(1);
    await axeBothThemes(page, "request-university");

    // Live domains go straight to signup with the email filled in.
    await page.goto("/");
    await page.getByTestId("hero-email").fill("zara@nutech.edu.pk");
    await expect(page.getByTestId("hero-status")).toContainText("is on Skilient.");
    await page.locator("#join").getByRole("button", { name: "Join", exact: true }).click();
    await expect(page).toHaveURL(/\/signup\?email=zara%40nutech\.edu\.pk/);
    await expect(page.getByLabel("University email")).toHaveValue("zara@nutech.edu.pk");
    expect(problems).toEqual([]);
  });

  test("requests are limited to 5 an hour per network; bad email links say so", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "account flows run once, on desktop");
    await resetRequestLimit();
    const tag = randomBytes(4).toString("hex");
    let limited = false;
    for (let i = 0; i < 6; i++) {
      await page.goto(`/request-university?email=r${i}.${tag}%40rate-${tag}.edu.pk`);
      await page.getByLabel("University name").fill(`Rate Test Institute ${tag}`);
      await page.getByLabel("Email me when my university joins.").check();
      await page.getByRole("button", { name: "Send request" }).click();
      const done = page.getByTestId("request-done");
      const refused = page.getByText("Too many requests from this network. Try again in an hour.");
      await expect(done.or(refused)).toBeVisible();
      if (await refused.isVisible()) {
        limited = true;
        expect(i).toBe(5);
      }
    }
    expect(limited).toBe(true);

    await page.goto(`/request-university/confirm?token=${"x".repeat(40)}`);
    await expect(page.getByText("That link has expired or was already used.")).toBeVisible();
    await page.goto(`/request-university/unsubscribe?token=${"x".repeat(40)}`);
    await page.getByRole("button", { name: "Stop emails" }).click();
    await expect(page.getByText("That link has expired or was already used.")).toBeVisible();
  });

  test("signed-in visitors see Open Skilient instead of the field", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "account flows run once, on desktop");
    const student = await createStudent({ domain: "nutech.edu.pk", fullName: "Maham Open" });
    await signInWithPassword(page, student.email, student.password);
    await page.goto("/");
    await expect(page.getByTestId("hero-open")).toHaveAttribute("href", "/feed");
    await expect(page.getByTestId("nav-open")).toBeVisible();
    await expect(page.getByTestId("hero-email")).toHaveCount(0);
  });
});
