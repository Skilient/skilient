/**
 * Golden recording for password change (W1 identity). The logic lives in the
 * app action `changePassword` (lib/actions/auth.ts) and Supabase Auth, not in
 * SQL, so this drives the real action in a browser and records its result
 * codes and effects. Output: packages/testing/test/golden/identity/password.json.
 *
 * Start the app on the LOCAL stack only (every hosted key blanked), then:
 *   E2E_BASE_URL=http://127.0.0.1:3199 E2E_SUPABASE_URL=… E2E_SUPABASE_SECRET_KEY=… \
 *   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=… GOLDEN_STACK_DB_URL=… [GOLDEN_RECORD=1] \
 *   pnpm exec playwright test --config playwright.golden.config.ts
 *
 * Every URL must be the local stack (assertLocalStack): the app, the Auth API
 * and the database are checked when this file loads, before any request or
 * cleanup, and there is no fallback to another variable.
 *
 * The breached-password refusal is not recorded: it needs the Have I Been
 * Pwned API, an external service whose answer this recording cannot fix.
 */
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { assertLocalStack, callCurrentStackSql, golden } from "../../../../packages/testing/src/golden";
import { currentAgreementVersion, signInWithPassword } from "../e2e/support";

/** A URL from the environment that must be the local stack; no fallback. */
function localUrl(name: string): string {
  const value = process.env[name];
  assertLocalStack(value);
  return value;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`set ${name} from the local stack`);
  return value;
}

const DB = localUrl("GOLDEN_STACK_DB_URL");
const AUTH_URL = localUrl("E2E_SUPABASE_URL");
localUrl("E2E_BASE_URL");
const SECRET_KEY = required("E2E_SUPABASE_SECRET_KEY");
const PUBLISHABLE = required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const FILE = join(__dirname, "../../../../packages/testing/test/golden/identity/password.json");

// Fixture account, created and deleted by this recording. Local stack only.
const EMAIL = "golden.password@nutech.edu.pk";
const OLD = "Golden-old-Passw0rd-2026";
const NEW = "Golden-new-Passw0rd-2026";
const THIRD = "Golden-third-Passw0rd-2026";

async function removeFixture(): Promise<void> {
  const out = await callCurrentStackSql(
    DB,
    async (tx) => {
      await tx`delete from private.rate_limit_events where key in (select 'password_change:' || id::text from auth.users where email = ${EMAIL})`;
      await tx`delete from auth.users where email = ${EMAIL}`;
    },
    { commit: true },
  );
  if (!out.ok) throw new Error(`cleanup: ${out.code} ${out.message}`);
}

async function dbRead<T>(run: (tx: Parameters<Parameters<typeof callCurrentStackSql>[1]>[0]) => Promise<T>): Promise<T> {
  const out = await callCurrentStackSql(DB, run);
  if (!out.ok) throw new Error(`${out.code} ${out.message}`);
  return out.value;
}

/** Submits the form and returns what the server action answered: its code, or ok. */
async function submit(page: Page, current: string, password: string, confirm: string): Promise<{ code: string; message: string | null }> {
  const form = page.getByTestId("change-password-form");
  await form.getByLabel("Current password", { exact: true }).fill(current);
  await form.getByLabel("New password", { exact: true }).fill(password);
  await form.getByLabel("Type it again", { exact: true }).fill(confirm);
  // Read the action's answer on the way through, before the page can re-render or navigate.
  let resolveBody: (text: string) => void = () => {};
  const body = new Promise<string>((resolve) => (resolveBody = resolve));
  const handler = async (route: import("@playwright/test").Route) => {
    if (route.request().method() !== "POST" || !route.request().headers()["next-action"]) return route.fallback();
    const response = await route.fetch();
    resolveBody(await response.text());
    await route.fulfill({ response });
  };
  await page.route("**/*", handler);
  await form.getByRole("button", { name: "Change password" }).click();
  const text = await body;
  await page.unroute("**/*", handler);
  const code = /"ok":true/.test(text) ? "ok" : (/"code":"([a-z_]+)"/.exec(text)?.[1] ?? "unparsed");
  const raw = code === "ok" ? null : (/"message":("(?:[^"\\]|\\.)*")/.exec(text)?.[1] ?? null);
  const message = raw === null ? null : (JSON.parse(raw) as string);
  return { code, message };
}

async function passwordGrant(password: string): Promise<{ status: number; error_code: string | null }> {
  const res = await fetch(`${AUTH_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: PUBLISHABLE, "content-type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password }),
  });
  const body = (await res.json()) as { error_code?: string };
  return { status: res.status, error_code: body.error_code ?? null };
}

test("password change: result codes and effects", async ({ page, browser }) => {
  await removeFixture();
  const db = createClient(AUTH_URL, SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.auth.admin.createUser({ email: EMAIL, password: OLD, email_confirm: true, user_metadata: { full_name: "Golden Password" } });
  if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
  const id = data.user.id;
  await db.from("agreement_acceptances").insert({ user_id: id, version: await currentAgreementVersion(db) });
  await db.from("profiles").update({ username: "golden_password", department: "Computer Science", graduation_year: 2027, onboarding_complete: true }).eq("user_id", id);
  await db.from("tour_progress").insert({ user_id: id, tour_id: "student", step: 0, skipped_at: new Date().toISOString() });

  try {
    await signInWithPassword(page, EMAIL, OLD);
    const other = await (await browser.newContext()).newPage();
    await signInWithPassword(other, EMAIL, OLD);
    const sessions = () => dbRead(async (tx) => (await tx`select count(*)::int as n from auth.sessions where user_id = ${id}`)[0]?.["n"]);
    const events = () =>
      dbRead(async (tx) => (await tx`select count(*)::int as n from public.security_events where user_id = ${id} and kind = 'password_changed'`)[0]?.["n"]);
    const sessionsBefore = await sessions();

    await page.goto("/settings/security");
    const refusals = {
      confirm_mismatch: await submit(page, OLD, NEW, `${NEW}x`),
      too_short: await submit(page, OLD, "short", "short"),
      same_as_current: await submit(page, OLD, OLD, OLD),
      wrong_current: await submit(page, "not-my-password-at-all", NEW, NEW),
    };
    const eventsBeforeSuccess = await events();
    const success = await submit(page, OLD, NEW, NEW);
    await expect(page.getByTestId("password-changed")).toBeVisible();

    const effects = {
      sessions_before: sessionsBefore,
      sessions_after: await sessions(),
      password_changed_events_before: eventsBeforeSuccess,
      password_changed_events_after: await events(),
      old_password_grant: await passwordGrant(OLD),
      new_password_grant: await passwordGrant(NEW),
      other_device_after: await other.goto("/feed").then(() => new URL(other.url()).pathname),
      this_device_after: await page.goto("/settings/security").then(() => new URL(page.url()).pathname),
    };

    // The limit is 5 changes per 15 minutes per account; wrong_current and success used two.
    const untilLimited: string[] = [];
    for (let i = 0; i < 6; i++) {
      const r = await submit(page, "not-my-password-at-all", THIRD, THIRD);
      untilLimited.push(r.code);
      if (r.code === "rate_limited") break;
    }

    const result = golden(FILE, "password_change", { refusals, success, effects, attempts_until_rate_limited: untilLimited });
    if (result.status === "differs") expect(result.actual).toEqual(result.expected);
  } finally {
    await removeFixture();
  }
});
