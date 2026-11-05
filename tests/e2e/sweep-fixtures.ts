import type { Browser, Page } from "@playwright/test";
import type { SweepFixtures, SweepRole } from "./sweep-routes";
import { adminClient, currentAgreementVersion, createStudent, PASSWORD, signInWithPassword, totp, uniqueEmail, type TestStudent } from "./support";

/**
 * The accounts and data every whole-app sweep needs (CSP sweep, design-gate sweep): one signed-in page per
 * role, with real content behind the profile, venture and post pages. Shared so both sweeps open the same
 * screens in the same state.
 */

export async function account(email: string, fullName: string, meta: Record<string, unknown> = {}): Promise<TestStudent> {
  const db = adminClient();
  const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: fullName, ...meta } });
  if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
  await db.from("agreement_acceptances").insert({ user_id: data.user.id, version: await currentAgreementVersion(db) });
  return { id: data.user.id, email, password: PASSWORD, fullName, username: "" };
}

export async function signedIn(browser: Browser, who: TestStudent | null, twoFactor = false, contextOptions: Parameters<Browser["newContext"]>[0] = {}): Promise<Page> {
  const page = await (await browser.newContext(contextOptions)).newPage();
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

let cached: Promise<{ student: TestStudent; fixtures: Partial<SweepFixtures> }> | null = null;

/**
 * A student with a venture and a post, so profile, venture and post pages render real content. Made once per
 * worker and reused by every sweep chunk: one post per chunk crowded other specs' posts off the NUTECH feed's
 * first page (survey.spec.ts reloads a ranked feed and expects its post there).
 */
export function studentFixtures(): Promise<{ student: TestStudent; fixtures: Partial<SweepFixtures> }> {
  cached ??= makeStudentFixtures().catch((e) => {
    cached = null;
    throw e;
  });
  return cached;
}

async function makeStudentFixtures(): Promise<{ student: TestStudent; fixtures: Partial<SweepFixtures> }> {
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

/** The signed-in page and fixtures for one role. Recruiter and official need the portals flag on (@portals pass). */
export async function roleSession(
  browser: Browser,
  role: SweepRole,
  contextOptions: Parameters<Browser["newContext"]>[0] = {},
): Promise<{ page: Page; fixtures: Partial<SweepFixtures> }> {
  const db = adminClient();
  if (role === "visitor") {
    const { fixtures } = await studentFixtures();
    return { page: await signedIn(browser, null, false, contextOptions), fixtures };
  }
  if (role === "student") {
    const { student, fixtures } = await studentFixtures();
    return { page: await signedIn(browser, student, false, contextOptions), fixtures };
  }
  if (role === "faculty") {
    const faculty = await account(uniqueEmail("nutech.edu.pk", "fac"), "Dr Sweep", { role: "faculty" });
    const { data: profile } = await db.from("profiles").select("university_id").eq("user_id", faculty.id).single();
    const { error } = await db.from("teacher_profiles").upsert({
      user_id: faculty.id, university_id: profile!.university_id, department: "Computer Science", title: "Lecturer",
      status: "approved", approved_at: new Date().toISOString(), approval_source: "staff",
    });
    if (error) throw new Error(error.message);
    return { page: await signedIn(browser, faculty, false, contextOptions), fixtures: {} };
  }
  if (role === "recruiter") {
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
    return { page: await signedIn(browser, recruiter, true, contextOptions), fixtures: { orgSlug: slug } };
  }
  if (role === "official") {
    const { data } = await db.from("university_domains").select("university_id, domain, universities!inner(owner_id)").eq("kind", "both").is("universities.owner_id", null).limit(50);
    const { data: open } = await db.from("university_claims").select("university_id").eq("status", "pending");
    const busy = new Set((open ?? []).map((c) => c.university_id));
    const row = (data ?? []).find((r) => !["nutech.edu.pk", "nu.edu.pk", "preston.edu.pk"].includes(r.domain) && !busy.has(r.university_id));
    if (!row) throw new Error("no unclaimed university");
    const official = await account(`sweep-${Math.random().toString(36).slice(2, 8)}@${row.domain}`, "Rida Sweep", { role: "university_admin", university_id: row.university_id });
    await db.from("university_admins").insert({ user_id: official.id, university_id: row.university_id, role: "owner" });
    await db.from("universities").update({ owner_id: official.id, claimed_at: new Date().toISOString() }).eq("id", row.university_id);
    return { page: await signedIn(browser, official, true, contextOptions), fixtures: {} };
  }
  // staff
  const { student, fixtures } = await studentFixtures();
  const admin = await createStudent({ domain: "nutech.edu.pk", fullName: "Sana Sweep" });
  await db.from("staff_roles").insert({ user_id: admin.id, role: "super_admin", granted_by: admin.id });
  const { data: org } = await db.from("organizations").select("id").limit(1).maybeSingle();
  const { data: profile } = await db.from("profiles").select("university_id").eq("user_id", student.id).single();
  return { page: await signedIn(browser, admin, true, contextOptions), fixtures: { ...fixtures, orgId: org?.id, uniId: profile!.university_id as string } };
}
