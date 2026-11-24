import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { createStudent, hasBackend, signInWithPassword } from "./support";

/**
 * Phase 14 (decisions 2026-11-02, "Portals"): the recruiter and university portals are off by
 * platform_config `portals.enabled`. Their routes answer 404 for everyone, organisation signup and
 * claim routes go to "Talk to us", the signup hook refuses recruiter and official accounts, and
 * student pages hide the recruiter parts. The @portals test runs in the second pass with the flag
 * switched on (tests/e2e/portals-setup.ts) and checks that everything comes back.
 */
const CLOSED = ["/recruit", "/recruit/search", "/org/settings", "/companies/acme", "/uni", "/uni/people", "/fairs/00000000-0000-4000-8000-000000000000", "/fairs/invite"];

test.describe("Portals off", () => {
  test.skip(!hasBackend, "needs the local Supabase stack");

  test("portal routes answer 404 signed out, and organisation signups go to Talk to us", async ({ page, request }) => {
    for (const path of CLOSED) {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status(), path).toBe(404);
    }
    for (const [from, to] of [
      ["/signup/recruiter", "/recruiters#talk"],
      ["/uni/claim", "/universities#talk"],
      ["/uni/join", "/universities#talk"],
      ["/signup?role=university_admin", "/universities#talk"],
    ]) {
      await page.goto(from);
      await page.waitForURL((url) => `${url.pathname}${url.hash}` === to);
    }
    await expect(page.getByTestId("talk-form")).toBeVisible();
  });

  test("the signup hook refuses recruiter and official accounts", async () => {
    const anon = createClient(process.env.E2E_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    const tag = Math.random().toString(36).slice(2, 8);
    const recruiter = await anon.auth.signUp({ email: `rita-${tag}@acme-${tag}.com`, password: "Skilient-e2e-Passw0rd!", options: { data: { role: "recruiter" } } });
    expect(recruiter.error?.message).toMatch(/Recruiter accounts aren.t open yet/);
    const official = await anon.auth.signUp({ email: `off-${tag}@nutech.edu.pk`, password: "Skilient-e2e-Passw0rd!", options: { data: { role: "university_admin" } } });
    expect(official.error?.message).toMatch(/University accounts aren.t open yet/);
  });

  test("a student sees 404s and no recruiter parts", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "account flows run once, on desktop");
    const student = await createStudent({ domain: "nutech.edu.pk", fullName: "Portal Student" });
    await signInWithPassword(page, student.email, student.password);
    for (const path of ["/recruit", "/uni", "/openings/jobs", "/openings/contact-requests", "/openings/applications/x", "/fairs/invite"]) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(404);
    }
    await page.goto("/openings");
    await expect(page.getByTestId("openings-grid").getByTestId("opening-card-venture_roles")).toBeVisible();
    for (const c of ["jobs", "contact_requests", "applications", "job_fairs", "competitions"]) await expect(page.getByTestId(`opening-card-${c}`)).toHaveCount(0);
    await page.goto("/settings/privacy");
    await expect(page.getByRole("heading", { level: 1, name: "Privacy" })).toBeVisible();
    for (const name of ["Recruiter visibility", "Which companies viewed my profile", "Blocked companies", "Who at my university viewed my record"]) {
      await expect(page.getByRole("heading", { name })).toHaveCount(0);
    }
    await page.goto("/settings/profile");
    await expect(page.getByLabel("Let recruiters find me")).toHaveCount(0);
  });
});

test.describe("Portals on (@portals pass)", { tag: "@portals" }, () => {
  test.skip(!hasBackend, "needs the local Supabase stack");

  test("switching the flag back restores routes and signup", async ({ page, request }) => {
    expect((await request.get("/signup/recruiter", { maxRedirects: 0 })).status()).toBe(200);
    await page.goto("/uni/claim");
    await expect(page).toHaveURL(/\/signin/);
    const anon = createClient(process.env.E2E_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    const tag = Math.random().toString(36).slice(2, 8);
    const recruiter = await anon.auth.signUp({ email: `rita-${tag}@acme-${tag}.com`, password: "Skilient-e2e-Passw0rd!", options: { data: { role: "recruiter" } } });
    expect(recruiter.error).toBeNull();
  });
});
