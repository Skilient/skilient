import AxeBuilder from "@axe-core/playwright";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { createStudent, hasBackend, signInWithPassword, type TestStudent } from "./support";

/**
 * Phase 18 (PRD 5.34) done-whens, through the app: Openings shows every card's latest item,
 * with its empty state (loading and error states are rendered in tests/unit/openings-cards.test.tsx);
 * a shared post the recipient can't see renders as unavailable; push is chosen per category (the
 * 1-hour reminder arriving as a push, and stopping when the category is off, is
 * tests/worker/notify-push.test.ts with a fake push service). Axe in both themes on every new screen.
 */
const DB_URL = process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const RULES = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

test.describe("Community: Openings, share, push", () => {
  test.skip(!hasBackend, "needs the local Supabase stack");
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "desktop", "account flows run once, on desktop");
  });
  test.use({ timezoneId: "Asia/Karachi" });

  let sql: ReturnType<typeof postgres>;
  test.beforeAll(async () => {
    sql = postgres(DB_URL, { max: 1, onnotice: () => undefined });
  });
  test.afterAll(async () => {
    await sql?.end();
  });

  async function axeBothThemes(page: Page, label: string) {
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.reload();
      await expect(page.locator("html")).toHaveClass(new RegExp(scheme));
      const results = await new AxeBuilder({ page }).withTags(RULES).analyze();
      expect(results.violations.map((v) => `${label} (${scheme}) ${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
    }
    await page.emulateMedia({ colorScheme: "light" });
  }

  async function pageFor(browser: Browser, who: TestStudent): Promise<Page> {
    const page = await (await browser.newContext({ timezoneId: "Asia/Karachi" })).newPage();
    await signInWithPassword(page, who.email, who.password);
    return page;
  }

  async function apiAs(student: TestStudent): Promise<SupabaseClient> {
    const url = process.env.E2E_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const api = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    await api.auth.signInWithPassword({ email: student.email, password: student.password });
    return api;
  }

  async function befriend(a: TestStudent, b: TestStudent) {
    await sql`insert into public.friendships (user_id_a, user_id_b) values (least(${a.id}::uuid, ${b.id}::uuid), greatest(${a.id}::uuid, ${b.id}::uuid))
              on conflict do nothing`;
  }

  test("Openings: one page of cards, each with its latest opening or an honest empty state", async ({ page, request }) => {
    test.setTimeout(180_000);
    const s = await createStudent({ domain: "nutech.edu.pk", fullName: "Openings Student" });
    const tag = s.username.slice(-6);
    const [soc] = await sql<{ id: string }[]>`
      insert into public.societies (university_id, slug, name, name_key, category, about, status, verified_at)
      select university_id, ${`e2e-open-${tag}`}, ${`Open Society ${tag}`}, ${`open society ${tag}`}, 'technology',
             'A society created for the Openings end-to-end test.', 'verified', now()
        from public.profiles where user_id = ${s.id}
      returning id`;
    const title = `Design team intake ${tag}`;
    await sql`insert into public.induction_rounds (society_id, title, deadline, status, published_at)
              values (${soc.id}, ${title}, now() + interval '9 days', 'open', now() + interval '1 second')`;

    // Old links land on the new page (308).
    const old = await request.get("/opportunities/for_you", { maxRedirects: 0 });
    expect(old.status()).toBe(308);
    expect(old.headers().location).toMatch(/\/openings$/);

    await signInWithPassword(page, s.email, s.password);
    await page.goto("/openings");
    const grid = page.getByTestId("openings-grid");
    await expect(grid).toBeVisible();
    for (const c of ["venture_roles", "inductions", "events", "ideas", "paths", "swaps", "this_week"]) {
      await expect(page.getByTestId(`opening-card-${c}`)).toBeVisible();
    }
    const inductions = page.getByTestId("opening-card-inductions");
    await expect(inductions).toHaveAttribute("data-state", "ready");
    await expect(inductions.getByTestId("opening-latest")).toHaveText(title);
    await expect(inductions.getByTestId("opening-new")).toBeVisible();
    // Not following a path: the card's empty state with one action.
    const paths = page.getByTestId("opening-card-paths");
    await expect(paths).toHaveAttribute("data-state", "empty");
    await expect(paths.getByRole("link", { name: "Choose a path" })).toBeVisible();
    await expect(page.getByTestId("opening-card-jobs")).toHaveCount(0);
    // This week leads as the banner, and nothing in any card is cut off at any width (2026-11-15:
    // a long action label used to push the text past the card's edge, where it was clipped).
    await expect(grid.locator("li").first().getByTestId("opening-card-this_week")).toBeVisible();
    const desktop = page.viewportSize()!;
    for (const width of [390, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      // The card hides overflow, so content wider than the card shows up as its scroll width.
      // (A long host name is cut with an ellipsis on purpose: that happens inside the card.)
      const clipped = await grid.locator("article").evaluateAll((cards) =>
        cards.filter((card) => card.scrollWidth > card.clientWidth + 1).map((card) => card.querySelector("h3")?.textContent ?? "?"),
      );
      expect(clipped, `cards clipped at ${width}px`).toEqual([]);
      // A row never ends with a gap: every row's cards reach the grid's right edge.
      const ragged = await grid.evaluate((ul) => {
        const right = ul.getBoundingClientRect().right;
        const rows = new Map<number, number>();
        for (const li of ul.children) {
          const r = li.getBoundingClientRect();
          rows.set(Math.round(r.top), Math.max(rows.get(Math.round(r.top)) ?? 0, r.right));
        }
        return [...rows.values()].filter((edge) => Math.abs(edge - right) > 2).length;
      });
      expect(ragged, `rows with a gap at ${width}px`).toBe(0);
    }
    await page.setViewportSize(desktop);
    await axeBothThemes(page, "openings");

    await inductions.getByRole("link", { name: "Society inductions" }).click();
    await expect(page).toHaveURL(/\/openings\/inductions$/);
    await expect(page.getByTestId("opening-list")).toContainText(title);
    await page.getByTestId("openings-match").click();
    await expect(page.getByRole("heading", { name: "No matches" })).toBeVisible();
    await axeBothThemes(page, "openings category");
    await page.goto("/openings");
    await expect(page.getByTestId("opening-card-inductions").getByTestId("opening-new")).toHaveCount(0);

    await page.goto("/openings/this-week");
    await expect(page.getByTestId("this-week")).toBeVisible();
    await axeBothThemes(page, "this week");
  });

  test("Share: the recipient sees the post, and 'This post isn't available' once they can't", async ({ browser }) => {
    test.setTimeout(180_000);
    const a = await createStudent({ domain: "nutech.edu.pk", fullName: "Sharer Saad" });
    const b = await createStudent({ domain: "nutech.edu.pk", fullName: `Hira Reader ${Date.now().toString(36)}` });
    await befriend(a, b);
    const { data: thread, error } = await (await apiAs(a)).rpc("get_or_create_dm", { p_username: b.username });
    expect(error).toBeNull();
    const [post] = await sql<{ id: string }[]>`
      insert into public.posts (author_id, university_id, audience, type, body)
      select user_id, university_id, 'university', 'general', 'How we cut our CI time in half' from public.profiles where user_id = ${a.id}
      returning id`;

    const aPage = await pageFor(browser, a);
    await aPage.goto(`/post/${post.id}`);
    await aPage.getByTestId("post-share").filter({ visible: true }).click();
    const sheet = aPage.getByTestId("share-sheet");
    await expect(sheet.getByRole("checkbox", { name: b.fullName })).toBeVisible();
    await axeBothThemes(aPage, "post page");
    await aPage.getByTestId("post-share").filter({ visible: true }).click();
    await sheet.getByRole("checkbox", { name: b.fullName }).click();
    await sheet.getByLabel("Add a note (optional)").fill("Worth a read");
    await sheet.getByTestId("share-send").click();
    await expect(aPage.getByTestId("share-status").filter({ visible: true })).toContainText(`Sent to ${b.fullName}`);
    await expect(aPage.getByRole("button", { name: "Undo" })).toBeVisible();

    const bPage = await pageFor(browser, b);
    await bPage.goto(`/chat/${thread}`);
    await expect(bPage.getByTestId("shared-post")).toContainText("How we cut our CI time in half");
    await axeBothThemes(bPage, "chat with a share");

    // Removed by moderation: the reader's card no longer shows it.
    await sql`update public.posts set removed_at = now() where id = ${post.id}`;
    await bPage.reload();
    await expect(bPage.getByTestId("shared-post-unavailable")).toHaveText("This post isn't available");
    await expect(bPage.getByTestId("shared-post")).toHaveCount(0);
  });

  test("People you may know and push preferences", async ({ browser }) => {
    test.setTimeout(180_000);
    const me = await createStudent({ domain: "nutech.edu.pk", fullName: "Suggest Me" });
    const peer = await createStudent({ domain: "nutech.edu.pk", fullName: `Zoya Batch ${Date.now().toString(36)}` });
    // A batch of their own, so earlier runs' students don't crowd the suggestions.
    const batch = 2040 + Math.floor(Math.random() * 50);
    await sql`update public.profiles set graduation_year = ${batch} where user_id in (${me.id}, ${peer.id})`;
    const page = await pageFor(browser, me);
    await page.goto("/friends");
    const card = page.getByTestId("pymk-card").filter({ hasText: peer.fullName });
    await expect(card.getByTestId("pymk-reason")).toContainText("Same batch");
    await axeBothThemes(page, "friends with suggestions");
    await page.getByRole("button", { name: `Dismiss ${peer.fullName}` }).click();
    await expect(card).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId("pymk-card").filter({ hasText: peer.fullName })).toHaveCount(0);

    await page.goto("/settings/notifications");
    const push = page.getByTestId("push-settings");
    await expect(push).toBeVisible();
    const societies = page.getByTestId("push-pref-societies");
    await expect(societies).toHaveAttribute("data-state", "checked");
    await societies.click();
    await expect(societies).toHaveAttribute("data-state", "unchecked");
    await page.reload();
    await expect(page.getByTestId("push-pref-societies")).toHaveAttribute("data-state", "unchecked");
    await axeBothThemes(page, "notification settings");
  });
});
