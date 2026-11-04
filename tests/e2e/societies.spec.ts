import AxeBuilder from "@axe-core/playwright";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import postgres from "postgres";
import sharp from "sharp";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { adminClient, createStudent, hasBackend, signInWithPassword, totp, watchConsole, type TestStudent } from "./support";

/**
 * Phase 15 (PRD 5.31, screen spec 3.14) done-whens: a society goes from request to verified to its
 * first induction round; a student can't create an event; no oversell (the parallel case is
 * tests/worker/event-seats.test.ts) and the waitlist; a ticket checks in once and the second scan
 * shows the first time; the headcount moves live; close-out lists every checked-in attendee for
 * issuing; CSV and feedback; a paid ticket confirms only on an officer's receipt approval and an unpaid
 * hold frees after 24 hours; a payment-details change needs a second officer; receipts are private.
 * Axe in both themes on every new screen with real content.
 */
const DB_URL = process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const RULES = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

test.describe("Societies and events", () => {
  test.skip(!hasBackend, "needs the local Supabase stack");
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "desktop", "account flows run once, on desktop");
  });
  test.use({ timezoneId: "Asia/Karachi" });

  let sql: ReturnType<typeof postgres>;
  test.beforeAll(() => {
    sql = postgres(DB_URL, { max: 1, onnotice: () => undefined });
  });
  test.afterAll(async () => {
    await sql?.end();
  });

  async function axeBothThemes(page: Page, label: string) {
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.reload();
      await expect(page).toHaveTitle(/\S/);
      await expect(page.locator("html")).toHaveClass(new RegExp(scheme));
      const results = await new AxeBuilder({ page }).withTags(RULES).analyze();
      expect(results.violations.map((v) => `${label} (${scheme}) ${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
    }
    await page.emulateMedia({ colorScheme: "light" });
  }

  async function pageFor(browser: Browser, who: TestStudent): Promise<Page> {
    const page = await (await browser.newContext({ timezoneId: "Asia/Karachi", acceptDownloads: true })).newPage();
    await signInWithPassword(page, who.email, who.password);
    return page;
  }

  /** Signed in with two-factor turned on, so the session is aal2 (/ops needs it). */
  async function twoFactorPage(browser: Browser, who: TestStudent): Promise<Page> {
    const page = await pageFor(browser, who);
    await page.goto("/settings/security");
    await page.getByRole("button", { name: "Set up two-factor" }).click();
    const secret = (await page.locator("code").first().textContent())?.trim() ?? "";
    await page.getByLabel("Code from the app").fill(totp(secret));
    await page.getByRole("button", { name: "Confirm" }).click();
    await page.getByRole("checkbox", { name: "I've saved these codes" }).check();
    await page.getByRole("button", { name: "Done" }).click();
    return page;
  }

  async function apiAs(student: TestStudent): Promise<SupabaseClient> {
    const url = process.env.E2E_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const api = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    await api.auth.signInWithPassword({ email: student.email, password: student.password });
    return api;
  }

  /** "2026-11-03T18:30" in Pakistan time, for datetime-local inputs. */
  function pkt(ms: number): string {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
        .formatToParts(new Date(ms))
        .map((p) => [p.type, p.value]),
    );
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  }

  /** A verified society straight in the database, for tests that start after verification. */
  async function society(president: TestStudent, officers: TestStudent[], tag: string): Promise<{ id: string; slug: string; name: string }> {
    const name = `Test Society ${tag}`;
    const [u] = await sql<{ university_id: string }[]>`select university_id from public.profiles where user_id = ${president.id}`;
    const [s] = await sql<{ id: string; slug: string }[]>`
      insert into public.societies (university_id, slug, name, name_key, category, about, status, created_by, verified_at)
      values (${u.university_id}, ${`test-society-${tag}`}, ${name}, ${`test ${tag}`}, 'technology',
              'A society for end-to-end tests of events and tickets.', 'verified', ${president.id}, now())
      returning id, slug`;
    await sql`insert into public.society_members (society_id, user_id, role, title) values (${s.id}, ${president.id}, 'president', 'President')`;
    for (const o of officers) await sql`insert into public.society_members (society_id, user_id, role, title) values (${s.id}, ${o.id}, 'officer', 'General Secretary')`;
    return { ...s, name };
  }

  test("a society goes from request to verified to its first induction round, and posts as itself", async ({ browser }) => {
    test.setTimeout(300_000);
    const db = adminClient();
    const tag = Math.random().toString(36).slice(2, 7);
    const name = `Robotics Circle ${tag}`;
    const president = await createStudent({ domain: "nutech.edu.pk", fullName: "Parveen President" });
    const member = await createStudent({ domain: "nutech.edu.pk", fullName: "Mehwish Member" });
    const reviewer = await createStudent({ domain: "nutech.edu.pk", fullName: "Tariq Trust" });
    await db.from("staff_roles").insert({ user_id: reviewer.id, role: "trust_reviewer", granted_by: reviewer.id });

    // Request, with a proof PDF.
    const page = await pageFor(browser, president);
    const problems = watchConsole(page);
    await page.goto("/societies");
    await axeBothThemes(page, "/societies");
    await page.getByTestId("request-society").click();
    await expect(page.getByTestId("request-stepper")).toBeVisible();
    await page.getByLabel("Society name").fill(name);
    await page.getByLabel("Category").selectOption("technology");
    await expect(page.getByTestId("stepper-left")).toHaveText("3 steps left: About, Proof, Review");
    await axeBothThemes(page, "/societies/new");
    await page.getByLabel("Society name").fill(name);
    await page.getByLabel("Category").selectOption("technology");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel("What the society does").fill("We build small robots and teach first-years to solder.");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByTestId("proof-file").setInputFiles({ name: "notification.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7\n%test proof\n%%EOF") });
    await page.getByRole("checkbox", { name: /I am an office bearer/ }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText(name)).toBeVisible();
    await page.getByTestId("submit-request").click();
    await expect(page.getByTestId("request-sent")).toBeVisible();
    const [row] = await sql<{ id: string; slug: string; proof_path: string }[]>`
      select s.id, s.slug, r.proof_path from public.societies s join public.society_requests r on r.society_id = s.id where s.name = ${name}`;
    expect(row.proof_path).toMatch(new RegExp(`^${president.id}/[0-9a-f-]{36}\\.pdf$`));

    // A duplicate name is caught while typing.
    const other = await pageFor(browser, member);
    await other.goto("/societies/new");
    await other.getByLabel("Society name").fill(`The ${name} Society`);
    await expect(other.getByText(/is already on Skilient at/)).toBeVisible();

    // Trust review in /ops: claim, approve (audited).
    const ops = await twoFactorPage(browser, reviewer);
    await ops.goto("/ops/societies");
    await expect(ops.getByTestId("society-queue")).toContainText(name);
    await ops.getByRole("link", { name }).click();
    await expect(ops.getByTestId("proof-link")).toBeVisible();
    await ops.getByTestId("claim-society").click();
    await ops.getByTestId("decide-society").getByRole("button", { name: "Approve" }).click();
    await expect(ops.getByText("Approve: done.")).toBeVisible();
    await axeBothThemes(ops, "/ops/societies/[id]");
    const { data: audit } = await db.from("ops_audit_log").select("action").eq("target_id", row.id);
    expect(audit!.map((a) => a.action).sort()).toEqual(["society.approve", "society.claim"]);

    // The President sets it up: inductions only, a round with a question.
    await page.goto(`/societies/${row.slug}`);
    await expect(page.getByTestId("setup-checklist")).toBeVisible();
    await axeBothThemes(page, "/societies/[slug]");
    await page.getByTestId("manage-society").click();
    await expect(page.getByTestId("society-manage")).toBeVisible();
    await page.getByTestId("membership-form").getByLabel("Membership").selectOption("inductions");
    await page.getByTestId("membership-form").getByRole("button", { name: "Save" }).click();
    await expect(page.getByTestId("membership-form").getByText("Saved.")).toBeVisible();
    await axeBothThemes(page, "/societies/[slug]/manage");
    await page.goto(`/societies/${row.slug}/inductions/new`);
    await page.getByLabel("Round title", { exact: true }).fill(`Fall inductions ${tag}`);
    await page.getByLabel("Applications close", { exact: true }).fill(pkt(Date.now() + 7 * 86400_000));
    await page.getByLabel("Role 1", { exact: true }).fill("Hardware lead");
    await page.getByLabel("Question 1", { exact: true }).fill("What have you built so far?");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByTestId("induction-round")).toBeVisible();
    await page.getByTestId("publish-round").click();
    await expect(page.getByText("Open", { exact: true })).toBeVisible();
    const roundUrl = page.url();

    // A student applies; the President accepts; they're a member.
    await other.goto(`/societies/${row.slug}`);
    await expect(other.getByRole("link", { name: "Apply in a round" })).toBeVisible();
    await other.goto(roundUrl);
    await other.getByLabel("What have you built so far?").fill("A line-following robot for the science fair.");
    await other.getByRole("button", { name: "Send application" }).click();
    await expect(other.getByTestId("my-application")).toContainText("Applied");
    await axeBothThemes(other, "/societies/[slug]/inductions/[id]");
    await page.reload();
    await page.getByTestId("accept-application").click();
    await expect(page.getByTestId("application")).toContainText("Accepted");
    const [m] = await sql<{ role: string }[]>`select role::text from public.society_members where society_id = ${row.id} and user_id = ${member.id}`;
    expect(m.role).toBe("member");

    // Posting as the society, and the Societies chip. Students have no Event type any more.
    await page.goto("/feed");
    const composer = page.getByTestId("composer");
    await expect(composer.getByRole("radio", { name: "Event" })).toHaveCount(0);
    await composer.getByTestId("post-as").selectOption({ label: name });
    await composer.getByLabel("What's on your mind?").fill(`Workshop sign-ups open soon ${tag}`);
    await composer.getByRole("button", { name: "Post", exact: true }).click();
    const post = page.getByTestId("post").filter({ hasText: `Workshop sign-ups open soon ${tag}` });
    await expect(post.getByTestId("post-society")).toHaveText(name);
    await page.goto("/feed?filter=societies");
    await expect(page.getByTestId("post").filter({ hasText: `Workshop sign-ups open soon ${tag}` })).toBeVisible();
    expect(problems).toEqual([]);
  });

  test("events: the stepper, the waitlist, a ticket that checks in once, a live headcount, close-out, CSV and feedback", async ({ browser }) => {
    test.setTimeout(300_000);
    const tag = Math.random().toString(36).slice(2, 7);
    const officer = await createStudent({ domain: "nutech.edu.pk", fullName: "Omar Officer" });
    const first = await createStudent({ domain: "nutech.edu.pk", fullName: `Ayesha First ${tag}` });
    const second = await createStudent({ domain: "nutech.edu.pk", fullName: "Bilal Second" });
    const s = await society(officer, [], tag);

    // A student can't open the stepper.
    const student = await pageFor(browser, first);
    await student.goto(`/societies/${s.slug}/events/new`);
    await expect(student.getByText("We couldn't find that page")).toBeVisible();
    await expect(student.getByTestId("event-stepper")).toHaveCount(0);

    // The officer creates and publishes an event: one session starting in an hour, one seat.
    const page = await pageFor(browser, officer);
    const problems = watchConsole(page);
    await page.goto(`/societies/${s.slug}`);
    await page.getByTestId("create-event").click();
    await expect(page.getByTestId("event-stepper")).toBeVisible();
    await expect(page.getByTestId("stepper-left")).toHaveText("6 steps left: When and where, Tickets, Who can come, Form, Record, Review");
    await axeBothThemes(page, "/societies/[slug]/events/new");
    await expect(page.getByTestId("event-stepper")).toBeVisible();
    await page.getByLabel("Title", { exact: true }).fill(`Soldering basics ${tag}`);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel("Place", { exact: true }).fill("Lab 2, Block C");
    await page.getByLabel("Starts", { exact: true }).fill(pkt(Date.now() + 3600_000));
    await page.getByLabel("Ends", { exact: true }).fill(pkt(Date.now() + 3 * 3600_000));
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel("Seats", { exact: true }).fill("1");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Add a question" }).click();
    await page.getByLabel("Question 1", { exact: true }).fill("Have you soldered before?");
    await page.getByRole("checkbox", { name: "Required" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByTestId("publish-event").click();
    await expect(page.getByTestId("event-manage")).toBeVisible();
    const eventId = page.url().split("/events/")[1].split("/")[0];
    const [ev] = await sql<{ status: string; post_id: string | null }[]>`select status, post_id from public.events where id = ${eventId}`;
    expect(ev.status).toBe("published");
    expect(ev.post_id).not.toBeNull();

    // The first student gets the seat; the second is waitlisted at 1.
    await student.goto(`/events/${eventId}`);
    await axeBothThemes(student, "/events/[id]");
    await student.getByTestId("register").click();
    await student.getByLabel(/Have you soldered before\?/).fill("Once, in school.");
    await student.getByTestId("confirm-register").click();
    await expect(student.getByTestId("ticket")).toContainText("Valid");
    await expect(student.getByTestId("ticket-qr")).toBeVisible();
    await axeBothThemes(student, "/events/[id]/ticket");
    const late = await pageFor(browser, second);
    await late.goto(`/events/${eventId}`);
    await late.getByTestId("register").click();
    await late.getByLabel(/Have you soldered before\?/).fill("No.");
    await expect(late.getByTestId("confirm-register")).toHaveText("Join the waitlist");
    await late.getByTestId("confirm-register").click();
    await expect(late.getByTestId("waitlist-position")).toContainText("Number 1 on the waitlist");

    // Check-in: the signed code checks in once; the second scan shows the first time. A second staff
    // screen sees the headcount move over Realtime.
    const payload = ((await (await apiAs(first)).rpc("event_ticket", { p_event: eventId })).data as { payload: string }).payload;
    expect(payload).toMatch(/^SKT1\./);
    await page.goto(`/events/${eventId}/check-in`);
    const watcher = await pageFor(browser, officer);
    await watcher.goto(`/events/${eventId}/check-in`);
    await expect(watcher.getByTestId("headcount")).toContainText("0 checked in of 1");
    await page.getByTestId("ticket-code").fill(payload);
    await page.getByTestId("ticket-code").press("Enter");
    await expect(page.getByTestId("check-in-result")).toHaveAttribute("data-result", "green");
    await expect(page.getByTestId("check-in-result")).toContainText(`Ayesha First ${tag}`);
    await expect(watcher.getByTestId("headcount")).toContainText("1 checked in of 1");
    // The form is busy until the headcount refresh started by the first scan finishes; Enter on a busy form does nothing.
    const scanForm = page.locator("form").filter({ has: page.getByTestId("ticket-code") });
    await expect(scanForm.getByRole("button", { name: "Check in" })).toBeEnabled();
    await page.getByTestId("ticket-code").fill(payload);
    await page.getByTestId("ticket-code").press("Enter");
    await expect(page.getByTestId("check-in-result")).toHaveAttribute("data-result", "amber");
    await expect(page.getByTestId("check-in-result")).toContainText("Already checked in");
    await page.getByTestId("ticket-code").fill(`${payload.slice(0, -4)}0000`);
    await page.getByTestId("ticket-code").press("Enter");
    await expect(page.getByTestId("check-in-result")).toHaveAttribute("data-result", "red");
    await page.getByTestId("check-in-email").fill(`walkin-${tag}@nutech.edu.pk`);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByTestId("check-in-result")).toContainText("claim it when they join");
    await axeBothThemes(page, "/events/[id]/check-in");

    // CSV for officers, formula-escaped.
    const csv = await page.request.get(`/api/events/${eventId}/export`);
    expect(csv.status()).toBe(200);
    const text = await csv.text();
    expect(text.split("\r\n")[0]).toContain('"Name","Username"');
    expect(text).toContain(`Ayesha First ${tag}`);
    expect((await student.request.get(`/api/events/${eventId}/export`)).status()).toBe(404);

    // Close-out after the event: every checked-in attendee is listed, issuing stores the preview.
    await sql`update public.event_sessions set starts_at = now() - interval '3 hours', ends_at = now() - interval '1 hour' where event_id = ${eventId}`;
    await sql`update public.events set starts_at = now() - interval '3 hours', ends_at = now() - interval '1 hour' where id = ${eventId}`;
    await page.goto(`/events/${eventId}/manage?tab=closeout`);
    await expect(page.getByTestId("closeout-attendees")).toContainText(`Ayesha First ${tag}`);
    await expect(page.getByTestId("issue-preview")).toContainText("Attended1");
    await axeBothThemes(page, "/events/[id]/manage (close-out)");
    await page.getByTestId("issue-entries").click();
    await expect(page.getByText(/Issued /)).toBeVisible();
    const [issued] = await sql<{ n: number }[]>`select count(*)::int as n from public.event_issuances where event_id = ${eventId}`;
    expect(issued.n).toBe(1);
    await page.goto(`/events/${eventId}/manage`);
    await axeBothThemes(page, "/events/[id]/manage");

    // Feedback for a week after.
    await student.goto(`/events/${eventId}`);
    await student.getByRole("radio", { name: "5 out of 5" }).click();
    await student.getByRole("button", { name: "Send feedback" }).click();
    await expect(student.getByTestId("feedback-form")).toHaveCount(0);
    await student.goto("/me/tickets");
    await axeBothThemes(student, "/me/tickets");
    expect(problems).toEqual([]);
  });

  test("paid tickets: a second officer confirms details, an officer's approval confirms, a hold frees, receipts stay private", async ({ browser }) => {
    test.setTimeout(300_000);
    const tag = Math.random().toString(36).slice(2, 7);
    const president = await createStudent({ domain: "nutech.edu.pk", fullName: "Hina Head" });
    const secretary = await createStudent({ domain: "nutech.edu.pk", fullName: "Saad Secretary" });
    const buyer = await createStudent({ domain: "nutech.edu.pk", fullName: `Zara Buyer ${tag}` });
    const copier = await createStudent({ domain: "nutech.edu.pk", fullName: `Kamran Copier ${tag}` });
    const late = await createStudent({ domain: "nutech.edu.pk", fullName: "Laila Late" });
    const s = await society(president, [secretary], tag);

    // Payment details: proposed by one officer, confirmed by another.
    const head = await pageFor(browser, president);
    const problems = watchConsole(head);
    await head.goto(`/societies/${s.slug}/manage/payments`);
    const add = head.getByTestId("add-method");
    await add.getByLabel("Bank (for bank accounts)").fill("Meezan Bank");
    await add.getByLabel("Account title").fill(s.name);
    await add.getByLabel("Account number or IBAN").fill("PK36MEZN0000001234567890");
    await add.getByRole("button", { name: "Propose this account" }).click();
    await expect(head.getByTestId("proposals")).toContainText("Another officer confirms it.");
    await expect(head.getByTestId("confirm-method")).toHaveCount(0);
    await axeBothThemes(head, "/societies/[slug]/manage/payments");
    const sec = await pageFor(browser, secretary);
    await sec.goto(`/societies/${s.slug}/manage/payments`);
    await sec.getByTestId("confirm-method").click();
    await expect(sec.getByTestId("active-methods")).toContainText("PK36MEZN0000001234567890");

    // A paid event (PKR 1,500, refunds until 3 days before).
    const api = await apiAs(president);
    const start = new Date(Date.now() + 5 * 86400_000);
    const { data: eventId, error } = await api.rpc("save_society_event", {
      p_society: s.id,
      p: {
        type: "workshop",
        title: `Paid workshop ${tag}`,
        location: "Hall A",
        sessions: [{ starts_at: start.toISOString(), ends_at: new Date(start.getTime() + 2 * 3600_000).toISOString() }],
        ticket_types: [{ name: "Participant", capacity: 10, price_pkr: 1500 }],
        eligibility: { scope: "university" },
        approval_mode: "automatic",
        record_kinds: ["attended"],
        refund_policy: "until",
        refund_days: 3,
      },
    });
    expect(error).toBeNull();
    expect((await api.rpc("publish_event", { p_event: eventId })).error).toBeNull();

    const receipt = await sharp({ create: { width: 900, height: 1400, channels: 3, background: "#f4f4f4" } })
      .composite([{ input: Buffer.from('<svg width="900" height="1400"><rect x="80" y="120" width="740" height="90" fill="#111"/><rect x="80" y="400" width="500" height="40" fill="#555"/></svg>') }])
      .png()
      .toBuffer();

    async function buy(who: TestStudent): Promise<Page> {
      const p = await pageFor(browser, who);
      await p.goto(`/events/${eventId}`);
      await p.getByTestId("register").click();
      await expect(p.getByTestId("paid-note")).toContainText("Skilient doesn't handle the money");
      await expect(p.getByTestId("confirm-register")).toHaveText("Hold my seat");
      await p.getByTestId("confirm-register").click();
      await expect(p.getByTestId("payment-panel")).toBeVisible();
      return p;
    }

    // The buyer pays and uploads; the seat stays held until an officer approves.
    const b = await buy(buyer);
    await expect(b.getByTestId("reference-code")).toHaveText(/^SKL-[A-Z0-9]{4}$/);
    await expect(b.getByTestId("pay-methods")).toContainText("Meezan Bank");
    await axeBothThemes(b, "/events/[id]/ticket (paid)");
    await b.getByTestId("receipt-file").setInputFiles({ name: "receipt.png", mimeType: "image/png", buffer: receipt });
    await b.getByTestId("upload-receipt").click();
    await expect(b.getByTestId("payment-panel")).toContainText("Receipt under review");
    const [held] = await sql<{ status: string; receipt_path: string }[]>`
      select r.status, p.receipt_path from public.event_registrations r join public.event_payments p on p.registration_id = r.id
       where r.event_id = ${eventId} and r.user_id = ${buyer.id}`;
    expect(held.status).toBe("held");
    expect(held.receipt_path).toMatch(new RegExp(`^${eventId}/[0-9a-f-]{36}/[0-9a-f-]{36}\\.webp$`));

    // Someone else uploads the same picture: flagged on the review card, not rejected.
    const c = await buy(copier);
    await c.getByTestId("receipt-file").setInputFiles({ name: "receipt.png", mimeType: "image/png", buffer: receipt });
    await c.getByTestId("upload-receipt").click();
    await expect(c.getByTestId("payment-panel")).toContainText("Receipt under review");

    // Receipts are private: the buyer reads theirs, another student can't.
    expect((await (await apiAs(buyer)).storage.from("event-receipts").download(held.receipt_path)).error).toBeNull();
    expect((await (await apiAs(late)).storage.from("event-receipts").download(held.receipt_path)).error).not.toBeNull();

    // The officer reviews: the duplicate is flagged; approving confirms the buyer's ticket.
    await head.goto(`/events/${eventId}/manage?tab=payments`);
    await expect(head.getByTestId("payment-card")).toHaveCount(2);
    await expect(head.getByTestId("duplicate-flag").first()).toBeVisible();
    await axeBothThemes(head, "/events/[id]/manage (payments)");
    const buyerCard = head.locator(`[data-testid="payment-card"][data-payer="Zara Buyer ${tag}"]`);
    await buyerCard.getByTestId("approve-payment").click();
    await expect(buyerCard.getByTestId("approve-payment")).toHaveCount(0);
    await expect(buyerCard.getByText("Paid", { exact: true })).toBeVisible();
    await b.reload();
    await expect(b.getByTestId("ticket")).toContainText("Valid");
    await expect(b.getByTestId("ticket-qr")).toBeVisible();

    // An unpaid hold frees after 24 hours (event-tick).
    await buy(late);
    await sql`update public.event_registrations set hold_expires_at = now() - interval '1 minute' where event_id = ${eventId} and user_id = ${late.id}`;
    await sql`select private.event_tick()`;
    const [freed] = await sql<{ status: string; pay: string }[]>`
      select r.status, p.status as pay from public.event_registrations r join public.event_payments p on p.registration_id = r.id
       where r.event_id = ${eventId} and r.user_id = ${late.id}`;
    expect(freed).toEqual({ status: "cancelled", pay: "released" });
    expect(problems).toEqual([]);
  });
});
