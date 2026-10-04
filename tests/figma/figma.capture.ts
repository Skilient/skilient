import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import postgres from "postgres";
import { adminClient, createStudent, PASSWORD, signInWithPassword, totp, type TestStudent } from "../e2e/support";
import { dumpLayout } from "./layout-dump";

/**
 * Figma reference captures (docs/figma/README.md). For every entry in docs/figma/screens.json,
 * every tab, at 1440×900 and 390×844, light and dark: a PNG and a layout tree (boxes, text,
 * typography, token-named colours) that the Figma build reads so the editable frames match
 * the real UI. One account per role, set up straight in the local database (never production).
 * Routes whose ids can't be resolved from the local data are listed as skipped in the manifest.
 *
 *   FIGMA_PORTAL=student pnpm figma:captures   # one portal; omit for all
 */

const OUT = path.join(process.cwd(), "docs/figma/reference");
const INVENTORY = path.join(process.cwd(), "docs/figma/screens.json");
const DB_URL = process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const ONLY = process.env.FIGMA_PORTAL;

type Role = "anonymous" | "student" | "new_student" | "onboarding_student" | "mfa_pending" | "teacher" | "recruiter" | "university_owner" | "super_admin" | "anyone";
interface Entry {
  route: string;
  portal: string;
  role: Role;
  redirectOnly?: boolean;
  tabs: { kind: "query" | "segment"; param?: string; values: string[] } | null;
  states: string[];
}
type Sql = ReturnType<typeof postgres>;

const VIEWPORTS = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } } as const;
const THEMES = ["light", "dark"] as const;

/** One existing row per dynamic route, from whatever the local database holds. */
const PARAMS: Record<string, (sql: Sql, who: Accounts) => Promise<Record<string, string> | null>> = {
  "/profile/[username]": async (_s, a) => ({ username: a.student.username }),
  "/cv/[username]": async (_s, a) => ({ username: a.student.username }),
  "/post/[id]": one("select id::text as id from public.posts where removed_at is null order by created_at desc limit 1"),
  "/chat/[threadId]": one("select thread_id::text as \"threadId\" from public.chat_messages order by created_at desc limit 1"),
  "/ventures/[id]": one("select id::text as id from public.ventures order by created_at desc limit 1"),
  "/teach/ventures/[id]": one("select id::text as id from public.ventures order by created_at desc limit 1"),
  "/companies/[slug]": one("select slug from public.organizations where status = 'verified' limit 1"),
  "/competitions/[id]": one("select id::text as id from public.competitions order by created_at desc limit 1"),
  "/recruit/competitions/[id]": one("select id::text as id from public.competitions order by created_at desc limit 1"),
  "/events/[id]": one("select id::text as id from public.events order by created_at desc limit 1"),
  "/fairs/[id]": one("select id::text as id from public.job_fairs order by created_at desc limit 1"),
  "/uni/fairs/[id]": one("select id::text as id from public.job_fairs order by created_at desc limit 1"),
  "/ideas/[id]": one("select id::text as id from public.project_ideas order by created_at desc limit 1"),
  "/teach/ideas/[id]": one("select id::text as id from public.project_ideas order by created_at desc limit 1"),
  "/me/code-checks/[id]": one("select id::text as id from public.code_checks order by requested_at desc limit 1"),
  "/teach/code-checks/[id]": one("select id::text as id from public.code_checks order by requested_at desc limit 1"),
  "/ops/evidence/code-checks/[id]": one("select id::text as id from public.code_checks order by requested_at desc limit 1"),
  "/moderation/[id]": one("select id::text as id from public.report_cases order by opened_at desc limit 1"),
  "/ops/reports/[id]": one("select id::text as id from public.report_cases order by opened_at desc limit 1"),
  "/ops/appeals/[id]": one("select id::text as id from public.appeals order by created_at desc limit 1"),
  "/ops/feedback/[id]": one("select id::text as id from public.feedback order by created_at desc limit 1"),
  "/ops/evidence/credentials/[id]": one("select id::text as id from public.credentials order by created_at desc limit 1"),
  "/ops/evidence/flags/[id]": one("select id::text as id from public.review_flags order by created_at desc limit 1"),
  "/ops/evidence/ranking/[id]": one("select id::text as id from public.anti_gaming_flags order by created_at desc limit 1"),
  "/ops/orgs/[id]": one("select id::text as id from public.organizations order by created_at desc limit 1"),
  "/ops/universities/[id]": one("select id::text as id from public.universities where owner_id is not null limit 1"),
  "/ops/universities/claims/[id]": one("select id::text as id from public.university_claims order by created_at desc limit 1"),
  "/ops/users/[id]": async (_s, a) => ({ id: a.student.id }),
  "/ops/users/[id]/view/[page]": async (_s, a) => ({ id: a.student.id }),
  "/ops/billing/[type]/[id]": async (s, a) => ({ type: "org", id: (await s`select org_id::text as id from public.org_members where user_id = ${a.recruiter.id}`)[0]?.id }),
  "/ops/config/[key]": one("select key from public.config_keys order by key limit 1"),
  "/opportunities/jobs/[id]": one("select id::text as id from public.job_posts order by created_at desc limit 1"),
  "/recruit/jobs/[id]": one("select id::text as id from public.job_posts order by created_at desc limit 1"),
  "/recruit/jobs/[id]/applicants": one("select id::text as id from public.job_posts order by created_at desc limit 1"),
  "/opportunities/applications/[id]": one("select id::text as id from public.job_applications limit 1"),
  "/opportunities/contact-requests/[id]": one("select id::text as id from public.contact_requests order by created_at desc limit 1"),
  "/recruit/candidates/[id]": async (_s, a) => ({ id: a.student.id }),
  "/recruit/shortlists/[id]": one("select id::text as id from public.recruiter_shortlists order by created_at desc limit 1"),
  "/teach/reviews/[requestId]": one("select id::text as \"requestId\" from public.review_requests order by created_at desc limit 1"),
  "/teach/judging/[id]": one("select id::text as id from public.competitions order by created_at desc limit 1"),
  "/uni/students/[id]": async (_s, a) => ({ id: a.student.id }),
  "/u/[slug]/[[...page]]": async (s, a) => ({ slug: (await s`select slug from public.universities where id = ${a.uniId}`)[0]?.slug }),
  "/verify/[code]": one("select code from public.cv_records order by issued_at desc limit 1"),
  "/billing/checkout/[session]": one("select id::text as session from public.checkout_sessions order by created_at desc limit 1"),
  "/billing/return/[session]": one("select id::text as session from public.checkout_sessions order by created_at desc limit 1"),
};
// Venture tabs and profile tabs share their parent's ids; event sub-pages share the event's.
for (const sub of ["chat", "contributions", "deliverables", "manage", "reviews", "team", "updates"]) PARAMS[`/ventures/[id]/${sub}`] = PARAMS["/ventures/[id]"];
for (const sub of ["activity", "skills", "ventures"]) PARAMS[`/profile/[username]/${sub}`] = PARAMS["/profile/[username]"];
for (const sub of ["attend", "check-in"]) PARAMS[`/events/[id]/${sub}`] = PARAMS["/events/[id]"];

function one(query: string) {
  return async (sql: Sql) => {
    const rows = await sql.unsafe(query);
    return (rows[0] as Record<string, string> | undefined) ?? null;
  };
}

interface Accounts {
  student: TestStudent;
  newStudent: TestStudent;
  onboardingStudent: TestStudent;
  mfaStudent: TestStudent;
  teacher: TestStudent;
  recruiter: TestStudent;
  uniOwner: TestStudent;
  admin: TestStudent;
  uniId: string;
}

async function account(email: string, fullName: string, meta: Record<string, unknown>): Promise<TestStudent> {
  const db = adminClient();
  const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: fullName, ...meta } });
  if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
  await db.from("agreement_acceptances").insert({ user_id: data.user.id, version: 1 });
  return { id: data.user.id, email, password: PASSWORD, fullName, username: "" };
}

/** Fictional people (decisions 2026-10-02), one per role. */
async function setupAccounts(sql: Sql): Promise<Accounts> {
  const tag = Math.random().toString(36).slice(2, 8);
  const student = await createStudent({ domain: "nutech.edu.pk", fullName: "Ayesha Siddiqui" });
  const newStudent = await createStudent({ domain: "nutech.edu.pk", fullName: "Bilal Ahmed", onboarded: false, agreement: false });
  // Agreement accepted, wizard not finished, furthest step 6: every step of /onboarding opens.
  const onboardingStudent = await createStudent({ domain: "nutech.edu.pk", fullName: "Mariam Javed", onboarded: false });
  await sql`update public.onboarding_state set step = 6 where user_id = ${onboardingStudent.id}`;
  const mfaStudent = await createStudent({ domain: "nutech.edu.pk", fullName: "Hamza Khan" });
  const admin = await createStudent({ domain: "nutech.edu.pk", fullName: "Sana Superadmin" });
  await sql`insert into public.staff_roles (user_id, role, granted_by) values (${admin.id}, 'super_admin', ${admin.id})`;

  const [{ university_id: uniId }] = await sql`select university_id::text from public.profiles where user_id = ${student.id}`;
  const teacher = await account(`fac-${tag}@nutech.edu.pk`, "Dr Farah Naqvi", { role: "faculty" });
  await sql`insert into public.teacher_profiles (user_id, university_id, department, title, status, approved_at, approval_source)
            values (${teacher.id}, ${uniId}, 'Computer Science', 'Assistant Professor', 'approved', now(), 'staff')
            on conflict (user_id) do update set status = 'approved', approved_at = now(), approval_source = 'staff'`;

  const domain = `northwind-${tag}.example.com`;
  const recruiter = await account(`rita@${domain}`, "Rita Rehman", { role: "recruiter" });
  const [org] = await sql`insert into public.organizations (slug, name, domain, website, industry, size, city, signer_role, status, verified_at, created_by)
            values (${`northwind-${tag}`}, 'Northwind Labs', ${domain}, ${`https://${domain}`}, 'Software', '51-200', 'Lahore', 'Head of Talent', 'verified', now(), ${recruiter.id})
            returning id::text`;
  await sql`insert into public.org_members (org_id, user_id, role) values (${org.id}, ${recruiter.id}, 'admin')`;

  const [{ domain: uniDomain }] = await sql`select domain from public.university_domains where university_id = ${uniId} limit 1`;
  const uniOwner = await account(`registrar-${tag}@${uniDomain}`, "Rida Registrar", { role: "university_admin", university_id: uniId });
  await sql`update public.universities set owner_id = ${uniOwner.id} where id = ${uniId} and owner_id is null`;
  await sql`insert into public.university_admins (user_id, university_id, role) values (${uniOwner.id}, ${uniId}, 'owner') on conflict do nothing`;
  return { student, newStudent, onboardingStudent, mfaStudent, teacher, recruiter, uniOwner, admin, uniId };
}

/** Signed in, with two-factor on where the portal needs aal2. Returns the storage state. */
async function signedInState(browser: Browser, who: TestStudent, twoFactor: boolean, passwordOnlyAfter = false) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await signInWithPassword(page, who.email, who.password);
  if (twoFactor) {
    await page.goto("/settings/security");
    await page.getByRole("button", { name: "Set up two-factor" }).click();
    const secret = (await page.locator("code").first().textContent())?.trim() ?? "";
    await page.getByLabel("Code from the app").fill(totp(secret));
    await page.getByRole("button", { name: "Confirm" }).click();
    await page.getByRole("checkbox", { name: "I've saved these codes" }).check();
    await page.getByRole("button", { name: "Done" }).click();
  }
  if (passwordOnlyAfter) {
    // Two-factor is on; a fresh password sign-in stops at /signin/mfa (aal1).
    await ctx.close();
    const fresh = await browser.newContext();
    await signInWithPassword(await fresh.newPage(), who.email, who.password);
    const pending = await fresh.storageState();
    await fresh.close();
    return pending;
  }
  const state = await ctx.storageState();
  await ctx.close();
  return state;
}

async function setTheme(page: Page, theme: (typeof THEMES)[number]) {
  await page.evaluate((t) => {
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(t);
    document.documentElement.style.colorScheme = t;
  }, theme);
  await page.waitForTimeout(150);
}

function fill(route: string, params: Record<string, string>) {
  return route.replace(/\/\[\[\.\.\.(\w+)\]\]/, "").replace(/\[(\w+)\]/g, (_, k: string) => encodeURIComponent(params[k] ?? ""));
}

/** Every URL an entry needs: one per tab, or the route itself. */
function urls(e: Entry, params: Record<string, string>): { tab: string; url: string }[] {
  if (!e.tabs) return [{ tab: "default", url: fill(e.route, params) }];
  if (e.tabs.kind === "segment") {
    const key = e.route.match(/\[(\w+)\]$/)![1];
    return e.tabs.values.map((v) => ({ tab: v, url: fill(e.route, { ...params, [key]: v }) }));
  }
  const base = fill(e.route, params);
  return e.tabs.values.map((v) => ({ tab: v, url: `${base}?${e.tabs!.param ?? "tab"}=${v}` }));
}

const slug = (s: string) => s.replace(/^\//, "").replace(/[[\]().]/g, "").replace(/[/?=&]+/g, "_") || "home";

test("figma reference captures", async ({ browser }) => {
  test.setTimeout(3 * 60 * 60_000);
  const inventory = JSON.parse(await readFile(INVENTORY, "utf8")) as { entries: Entry[] };
  const entries = inventory.entries.filter((e) => !ONLY || e.portal === ONLY);
  const sql = postgres(DB_URL, { max: 1, onnotice: () => undefined });
  const manifest: { route: string; tab: string; url: string; files?: Record<string, string>; skipped?: string }[] = [];
  try {
    const who = await setupAccounts(sql);
    const roles: Record<Role, { user: TestStudent | null; twoFactor: boolean; passwordOnlyAfter?: boolean }> = {
      anonymous: { user: null, twoFactor: false },
      anyone: { user: null, twoFactor: false },
      student: { user: who.student, twoFactor: false },
      new_student: { user: who.newStudent, twoFactor: false },
      onboarding_student: { user: who.onboardingStudent, twoFactor: false },
      mfa_pending: { user: who.mfaStudent, twoFactor: true, passwordOnlyAfter: true },
      teacher: { user: who.teacher, twoFactor: false },
      recruiter: { user: who.recruiter, twoFactor: true },
      university_owner: { user: who.uniOwner, twoFactor: true },
      super_admin: { user: who.admin, twoFactor: true },
    };
    const states = new Map<Role, Awaited<ReturnType<typeof signedInState>> | undefined>();

    for (const e of entries) {
      if (e.redirectOnly) {
        manifest.push({ route: e.route, tab: "default", url: e.route, skipped: "redirect-only route (not a screen)" });
        continue;
      }
      let params: Record<string, string> = {};
      const resolve = PARAMS[e.route] as (typeof PARAMS)[string] | undefined;
      if (e.route.includes("[") && e.tabs?.kind !== "segment") {
        let why = resolve ? "no local row" : "no resolver";
        const got = resolve ? await resolve(sql, who).catch((err: unknown) => ((why = String(err).slice(0, 200)), null)) : null;
        if (!got || Object.values(got).some((v) => !v)) {
          manifest.push({ route: e.route, tab: "default", url: e.route, skipped: why });
          continue;
        }
        params = got;
      } else if (resolve) {
        params = (await resolve(sql, who).catch(() => null)) ?? {};
      }
      const role = roles[e.role];
      if (role.user && !states.has(e.role)) states.set(e.role, await signedInState(browser, role.user, role.twoFactor, role.passwordOnlyAfter));
      for (const { tab, url } of urls(e, params)) {
        const files: Record<string, string> = {};
        for (const [vp, size] of Object.entries(VIEWPORTS)) {
          const ctx: BrowserContext = await browser.newContext({ viewport: size, hasTouch: vp === "phone", storageState: states.get(e.role) });
          const page = await ctx.newPage();
          try {
            const res = await page.goto(url, { waitUntil: "networkidle" });
            if (res && res.status() >= 400) throw new Error(`HTTP ${res.status()}`);
            // A gate redirect would capture the wrong page under this route's name.
            const want = new URL(url, page.url()).pathname, got = new URL(page.url()).pathname;
            if (got !== want) throw new Error(`redirected to ${got}`);
            const dir = path.join(OUT, e.portal);
            await mkdir(dir, { recursive: true });
            for (const theme of THEMES) {
              await setTheme(page, theme);
              const name = `${slug(e.route)}__${tab}__${vp}-${theme}`;
              await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: true, animations: "disabled", caret: "hide" });
              await writeFile(path.join(dir, `${name}.json`), JSON.stringify(await page.evaluate(dumpLayout)));
              files[`${vp}-${theme}`] = path.relative(OUT, path.join(dir, name));
            }
          } catch (err) {
            manifest.push({ route: e.route, tab, url, skipped: String(err).slice(0, 200) });
          } finally {
            await ctx.close();
          }
        }
        if (Object.keys(files).length) manifest.push({ route: e.route, tab, url, files });
      }
    }
  } finally {
    await sql.end();
    await mkdir(OUT, { recursive: true });
    await writeFile(path.join(OUT, `manifest${ONLY ? `-${ONLY}` : ""}.json`), `${JSON.stringify(manifest, null, 2)}\n`);
  }
});
