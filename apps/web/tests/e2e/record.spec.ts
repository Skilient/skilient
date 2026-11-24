import AxeBuilder from "@axe-core/playwright";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PDFParse } from "pdf-parse";
import postgres from "postgres";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { rotateKey } from "../../supabase/functions/_shared/cv/issue.ts";
import { drainRecordQueue } from "../../supabase/functions/_shared/cv/record.ts";
import { formatCode } from "../../supabase/functions/_shared/cv/sign.ts";
import { dbFrom } from "../../supabase/functions/_shared/github/types.ts";
import { adminClient, createStudent, currentAgreementVersion, hasBackend, signInWithPassword, uniqueEmail, watchConsole, PASSWORD, type TestStudent } from "./support";

/**
 * Phase 16 (PRD 5.30) done-whens: a check-in at a verified society's event becomes a sealed entry
 * that verifies at /verify/[code], and a revoked one shows revoked; an officer can't issue to
 * themselves without a second officer; a claim email turns into entries after signup with the same
 * address and never with a different one; the transcript PDF verifies every entry on it. (Formula
 * v2's hand-worked scores and "attendance never adds rank" are pgTAP 32 and 58.) Entries are sealed
 * with the cv-sign function's own code over a direct database connection, as cv.spec.ts signs CVs.
 * Axe in both themes on every new screen.
 */
const DB_URL = process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const RULES = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

test.describe("The Record", () => {
  test.skip(!hasBackend, "needs the local Supabase stack");
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "desktop", "account flows run once, on desktop");
  });
  test.use({ timezoneId: "Asia/Karachi" });

  let sql: ReturnType<typeof postgres>;
  const log = () => undefined;
  test.beforeAll(async () => {
    sql = postgres(DB_URL, { max: 1, onnotice: () => undefined });
    const [active] = await sql`select key_id from public.signing_keys where retired_at is null`;
    if (!active) await rotateKey({ db: dbFrom(sql), log });
  });
  test.afterAll(async () => {
    await sql?.end();
  });

  /** The cv-sign worker's record_drain, run here. */
  async function seal() {
    await drainRecordQueue({ db: dbFrom(sql), log });
  }

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
    const page = await (await browser.newContext({ timezoneId: "Asia/Karachi", acceptDownloads: true })).newPage();
    await signInWithPassword(page, who.email, who.password);
    return page;
  }

  async function apiAs(student: TestStudent): Promise<SupabaseClient> {
    const url = process.env.E2E_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const api = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    await api.auth.signInWithPassword({ email: student.email, password: student.password });
    return api;
  }

  async function ok<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
    const { data, error } = await p;
    if (error) throw new Error(error.message);
    return data;
  }

  test("check-in to sealed entry, second officer, verify, CV, share, transcript, revoke and appeal", async ({ browser }) => {
    test.setTimeout(300_000);
    const tag = Math.random().toString(36).slice(2, 7);
    const president = await createStudent({ domain: "nutech.edu.pk", fullName: `Rida President ${tag}` });
    const officer = await createStudent({ domain: "nutech.edu.pk", fullName: `Rafay Officer ${tag}` });
    const student = await createStudent({ domain: "nutech.edu.pk", fullName: `Rumi Student ${tag}` });

    // A verified society, verified long enough ago that its merit entries count.
    const [u] = await sql<{ university_id: string }[]>`select university_id from public.profiles where user_id = ${president.id}`;
    const [soc] = await sql<{ id: string; slug: string }[]>`
      insert into public.societies (university_id, slug, name, name_key, category, about, status, created_by, verified_at)
      values (${u.university_id}, ${`record-society-${tag}`}, ${`Record Society ${tag}`}, ${`record ${tag}`}, 'technology',
              'A society for end-to-end tests of The Record.', 'verified', ${president.id}, now() - interval '60 days')
      returning id, slug`;
    await sql`insert into public.society_members (society_id, user_id, role, title) values
      (${soc.id}, ${president.id}, 'president', 'President'), (${soc.id}, ${officer.id}, 'officer', 'General Secretary')`;

    // The officer runs an event; the student and the officer attend; a walk-in is added by email.
    const off = await apiAs(officer);
    const eventId = await ok(off.rpc("save_society_event", {
      p_society: soc.id,
      p: {
        type: "workshop", title: `Build with React ${tag}`, description: "Hands-on.", location: "Hall B",
        sessions: [{ starts_at: new Date(Date.now() + 3600_000).toISOString(), ends_at: new Date(Date.now() + 3 * 3600_000).toISOString() }],
        ticket_types: [{ name: "Participant", capacity: 10 }], eligibility: { scope: "university" }, approval_mode: "automatic", record_kinds: ["attended"],
      },
    } as never)) as unknown as string;
    await ok(off.rpc("publish_event", { p_event: eventId } as never));
    const [ticket] = await sql<{ id: string }[]>`select id from public.event_ticket_types where event_id = ${eventId}`;
    for (const who of [student, officer]) {
      const api = await apiAs(who);
      await ok(api.rpc("register_event", { p_event: eventId, p: { ticket_type_id: ticket.id } } as never));
      const t = (await ok(api.rpc("event_ticket", { p_event: eventId } as never))) as unknown as { payload: string };
      expect(((await ok(off.rpc("check_in_scan", { p_event: eventId, p_session: null, p_payload: t.payload } as never))) as unknown as { result: string }).result).toBe("green");
    }
    const walkIn = uniqueEmail("nutech.edu.pk", "walkin");
    await ok(off.rpc("check_in_email", { p_event: eventId, p_session: null, p_email: walkIn } as never));

    // Close-out: the officer issues from the manage page.
    await sql`update public.event_sessions set starts_at = now() - interval '3 hours', ends_at = now() - interval '1 hour' where event_id = ${eventId}`;
    await sql`update public.events set starts_at = now() - interval '3 hours', ends_at = now() - interval '1 hour', status = 'ended' where id = ${eventId}`;
    const officerPage = await pageFor(browser, officer);
    await officerPage.goto(`/events/${eventId}/manage?tab=closeout`);
    await officerPage.getByTestId("issue-entries").click();
    await expect(officerPage.getByText(/Issued /)).toBeVisible();

    // No officer issues to themselves alone: the officer's own entry waits for a second officer.
    const [own] = await sql<{ status: string }[]>`select status from public.record_entries where user_id = ${officer.id} and source_id = ${eventId}`;
    expect(own.status).toBe("awaiting");
    await officerPage.goto(`/societies/${soc.slug}/manage#record`);
    await expect(officerPage.getByTestId("record-awaiting")).toContainText("Another officer confirms");
    const presidentPage = await pageFor(browser, president);
    const problems = watchConsole(presidentPage);
    await presidentPage.goto(`/societies/${soc.slug}/manage#record`);
    await presidentPage.getByTestId("confirm-entry").click();
    await expect(presidentPage.getByTestId("record-awaiting")).toHaveCount(0);
    await seal();

    // The student's entry is sealed with a code that verifies.
    const page = await pageFor(browser, student);
    watchConsole(page);
    await page.goto("/me/record");
    await expect(page.getByRole("heading", { name: "Your Record", exact: true })).toBeVisible();
    const row = page.getByTestId("record-entry").filter({ hasText: `Build with React ${tag}` });
    await expect(row).toContainText("Sealed");
    await expect(row).toContainText("Checked in");
    const [entry] = await sql<{ id: string; code: string }[]>`select id, code from public.record_entries where user_id = ${student.id} and source_id = ${eventId}`;
    await expect(row).toContainText(formatCode(entry.code));
    await axeBothThemes(page, "/me/record");

    const visitor = await (await browser.newContext()).newPage();
    await visitor.goto(`/verify/${entry.code}`);
    await expect(visitor.getByTestId("verify-status")).toHaveAttribute("data-status", "valid");
    await expect(visitor.getByTestId("entry-title")).toContainText(`Attended: Build with React ${tag}`);
    await expect(visitor.getByText("Ed25519, checked")).toBeVisible();
    await axeBothThemes(visitor, "/verify/[code] (entry)");

    // The CV's "Leadership and activities": the student picks the entry.
    await page.goto("/me/cv#activities");
    if (await page.getByTestId("save-cv-activities").count()) {
      await page.getByRole("checkbox", { name: new RegExp(`Build with React ${tag}`) }).check();
      await page.getByTestId("save-cv-activities").click();
      await expect(page.getByText(/Saved\./)).toBeVisible();
      const [cv] = await sql<{ record_entries: string[] }[]>`select record_entries from public.cv_settings where user_id = ${student.id}`;
      expect(cv.record_entries).toEqual([entry.id]);
    }

    // A share link, opened signed-out.
    await page.goto("/me/record");
    await page.getByTestId("record-share-create").click();
    const url = (await page.getByTestId("record-new-link-url").textContent())!.trim();
    await visitor.goto(url.replace(/^https?:\/\/[^/]+/, ""));
    await expect(visitor.getByTestId("shared-record")).toContainText(student.fullName);
    await expect(visitor.getByRole("link", { name: new RegExp(`: verify Build with React ${tag}$`) })).toBeVisible();
    await axeBothThemes(visitor, "/record/[username]");

    // The transcript PDF verifies every entry on it.
    const pdf = await page.request.post("/api/record/pdf", { data: { kind: "transcript" } });
    expect(pdf.status()).toBe(200);
    const exportId = pdf.headers()["x-record-export"];
    const parser = new PDFParse({ data: Buffer.from(await pdf.body()) });
    const text = (await parser.getText()).text.replace(/\s+/g, " ");
    await parser.destroy();
    expect(text).toContain(student.fullName);
    expect(text).toContain(entry.code);
    expect(text).toContain(`/verify/transcript/${exportId}`);
    await visitor.goto(`/verify/transcript/${exportId}`);
    await expect(visitor.getByTestId("verify-status")).toHaveAttribute("data-status", "valid");
    await expect(visitor.getByTestId("transcript-entries").locator("li")).toHaveCount(1);
    await axeBothThemes(visitor, "/verify/transcript/[id]");
    const cert = await page.request.post("/api/record/pdf", { data: { kind: "certificate", entryId: entry.id } });
    expect(cert.status()).toBe(200);
    expect(cert.headers()["content-type"]).toBe("application/pdf");
    const stranger = await createStudent({ domain: "nutech.edu.pk", fullName: `Raza Other ${tag}` });
    const strangerPage = await pageFor(browser, stranger);
    expect((await strangerPage.request.post("/api/record/pdf", { data: { kind: "certificate", entryId: entry.id } })).status()).toBe(404);

    // Revoked by an officer, with a reason: verify shows revoked, the student can appeal.
    await officerPage.goto(`/societies/${soc.slug}/manage#record`);
    await officerPage.getByTestId("record-entries").getByRole("row", { name: new RegExp(student.fullName) }).getByTestId("revoke-entry").click();
    await officerPage.getByRole("radio", { name: "Not earned" }).check();
    await officerPage.getByLabel("Reason the student sees").fill("Checked in but left after ten minutes.");
    await officerPage.getByTestId("revoke-confirm").click();
    await expect(officerPage.getByTestId("record-entries")).toContainText("Revoked");
    await axeBothThemes(officerPage, "/societies/[slug]/manage (record)");
    await visitor.goto(`/verify/${entry.code}`);
    await expect(visitor.getByTestId("verify-status")).toHaveAttribute("data-status", "revoked");
    await expect(visitor.getByTestId("revoked-on")).toContainText("Not earned");
    await expect(visitor.getByTestId("entry-title")).toHaveCount(0);
    await axeBothThemes(visitor, "/verify/[code] (revoked entry)");
    await page.goto("/me/record?status=revoked");
    await expect(page.getByTestId("record-entry").first()).toContainText("Checked in but left after ten minutes.");
    await expect(page.getByRole("button", { name: /Appeal: Revoked/ })).toBeVisible();

    // The formula v2 note on the score page.
    await page.goto("/me/score");
    await expect(page.getByTestId("formula-v2")).toContainText("Attendance and paid tickets never add rank");
    expect(problems).toEqual([]);
  });

  test("a claim email turns into entries after signup with the same address, never with another", async ({ browser }) => {
    test.setTimeout(180_000);
    const tag = Math.random().toString(36).slice(2, 7);
    const president = await createStudent({ domain: "nutech.edu.pk", fullName: `Claim President ${tag}` });
    const officer = await createStudent({ domain: "nutech.edu.pk", fullName: `Claim Officer ${tag}` });
    const [u] = await sql<{ university_id: string }[]>`select university_id from public.profiles where user_id = ${president.id}`;
    const [soc] = await sql<{ id: string }[]>`
      insert into public.societies (university_id, slug, name, name_key, category, about, status, created_by, verified_at)
      values (${u.university_id}, ${`claim-society-${tag}`}, ${`Claim Society ${tag}`}, ${`claim ${tag}`}, 'technology',
              'A society for end-to-end tests of Record claims.', 'verified', ${president.id}, now() - interval '60 days')
      returning id`;
    await sql`insert into public.society_members (society_id, user_id, role, title) values
      (${soc.id}, ${president.id}, 'president', 'President'), (${soc.id}, ${officer.id}, 'officer', 'Events Lead')`;
    const off = await apiAs(officer);
    const eventId = (await ok(off.rpc("save_society_event", {
      p_society: soc.id,
      p: {
        type: "talk", title: `Careers talk ${tag}`, location: "Auditorium",
        sessions: [{ starts_at: new Date(Date.now() + 3600_000).toISOString(), ends_at: new Date(Date.now() + 2 * 3600_000).toISOString() }],
        ticket_types: [{ name: "General", capacity: 50 }], eligibility: { scope: "university" }, record_kinds: ["attended"],
      },
    } as never))) as unknown as string;
    await ok(off.rpc("publish_event", { p_event: eventId } as never));
    const walkIn = uniqueEmail("nutech.edu.pk", "walkin");
    await ok(off.rpc("check_in_email", { p_event: eventId, p_session: null, p_email: walkIn } as never));
    await sql`update public.event_sessions set starts_at = now() - interval '3 hours', ends_at = now() - interval '1 hour' where event_id = ${eventId}`;
    await sql`update public.events set starts_at = now() - interval '3 hours', ends_at = now() - interval '1 hour', status = 'ended' where id = ${eventId}`;
    await ok(off.rpc("issue_event_entries", { p_event: eventId } as never));

    // One claim email is queued for the walk-in.
    const [queued] = await sql<{ n: number }[]>`
      select count(*)::int as n from pgmq.q_notification_emails q join public.record_claims c on c.id = (q.message ->> 'claim_id')::uuid
       where q.message ->> 'kind' = 'record_claim' and c.event_id = ${eventId}`;
    expect(queued.n).toBe(1);

    // Someone with a different address sees nothing waiting.
    const other = await createStudent({ domain: "nutech.edu.pk", fullName: `Other Person ${tag}` });
    const otherPage = await pageFor(browser, other);
    await otherPage.goto("/onboarding/done");
    await expect(otherPage.getByRole("heading", { name: /Welcome to Skilient/ })).toBeAttached();
    await expect(otherPage.getByTestId("claim-card")).toHaveCount(0);

    // The walk-in signs up with the same (verified) address: "1 entry waiting" → Claim.
    const db = adminClient();
    const { data: created } = await db.auth.admin.createUser({ email: walkIn, password: PASSWORD, email_confirm: true, user_metadata: { full_name: `Walk In ${tag}` } });
    const id = created.user!.id;
    await db.from("agreement_acceptances").insert({ user_id: id, version: await currentAgreementVersion(db) });
    await db.from("profiles").update({ username: `e2e_w${tag}`, department: "Computer Science", graduation_year: 2027, onboarding_complete: true }).eq("user_id", id);
    await db.from("tour_progress").insert({ user_id: id, tour_id: "student", step: 0, skipped_at: new Date().toISOString() });
    const walker: TestStudent = { id, email: walkIn, password: PASSWORD, fullName: `Walk In ${tag}`, username: `e2e_w${tag}` };
    const page = await pageFor(browser, walker);
    await page.goto("/onboarding/done");
    // The welcome film reveals the card near its end; skip to the end state.
    await page.keyboard.press("Escape"); // any key ends the film
    await expect(page.getByTestId("claim-card")).toContainText("1 entry waiting");
    await axeBothThemes(page, "/onboarding/done (claim)");
    await page.getByTestId("claim-entries").click();
    await expect(page.getByTestId("claim-card")).toContainText("1 entry added to your Record");
    await seal();
    await page.goto("/me/record");
    await expect(page.getByTestId("record-entry").filter({ hasText: `Careers talk ${tag}` })).toContainText("Sealed");
    const [held] = await sql<{ n: number }[]>`select count(*)::int as n from public.record_entries where source_id = ${eventId} and status = 'held'`;
    expect(held.n).toBe(0);
  });

  test("the empty Record points to the next event", async ({ browser }) => {
    const student = await createStudent({ domain: "nutech.edu.pk", fullName: "Empty Record" });
    const page = await pageFor(browser, student);
    await page.goto("/me/record");
    await expect(page.getByText("Your first entry is one event away")).toBeVisible();
    await axeBothThemes(page, "/me/record (empty)");
  });
});
