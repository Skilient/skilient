import { expect, test } from "@playwright/test";
import { fakePostHog, type FakePostHog } from "./posthog-fake";
import { createStudent, hasBackend, signInWithPassword, watchConsole } from "./support";

/**
 * PostHog in the browser (PRD 10; phase 13 slice 1), against the second test server, which runs the
 * same build with a PostHog project key (playwright.config.ts). PostHog itself is faked at /ingest:
 * its remote config turns replays on, its scripts come from the installed posthog-js, and every
 * payload is decoded and checked. Checks: named events only, no personal data, PostHog only on our
 * own origin, replays masked, nothing recorded on chat, and the CSP stays clean with PostHog and its
 * recorder loaded.
 */
const ANALYTICS_URL = `http://127.0.0.1:${Number(process.env.PORT ?? 3100) + 1}`;
const ALLOWED = new Set(["$pageview", "$identify", "$snapshot", "$$heatmap", "signup_start", "uni_detected", "uni_not_live", "uni_requested", "org_cta_click"]);

test.skip(!!process.env.E2E_BASE_URL, "needs the local analytics server");
test.use({ baseURL: ANALYTICS_URL });


const names = (fake: FakePostHog) => fake.events.map((e) => e.event);
/** posthog-js sends a replay's first snapshot some seconds in; activity helps it along. */
const REPLAY_WAIT = 60_000;

test.describe.configure({ timeout: 120_000 });

test("landing: named events only, no personal data, PostHog on our own origin, masked replay, clean CSP", async ({ page }) => {
  const fake = await fakePostHog(page);
  const problems = watchConsole(page);
  await page.goto("/");
  const headline = (await page.locator("h1").first().innerText()).split(/\s+/).slice(0, 3).join(" ");

  await page.getByLabel("University email").first().fill("someone.private@nutech.edu.pk");
  await expect.poll(() => names(fake), { timeout: 20_000 }).toContain("uni_detected");
  await page.mouse.wheel(0, 600);
  await expect.poll(() => fake.snapshots.length, { timeout: REPLAY_WAIT }).toBeGreaterThan(0);

  for (const name of names(fake)) expect(ALLOWED.has(name), name).toBe(true);
  const detected = fake.events.find((e) => e.event === "uni_detected")!;
  expect(detected.properties).toMatchObject({ source: "hero" });
  expect(detected.properties.university_id).toMatch(/^[0-9a-f-]{36}$/);
  const pageview = fake.events.find((e) => e.event === "$pageview")!;
  expect(pageview.properties).not.toHaveProperty("title");

  const wire = fake.wire.join("\n");
  expect(wire).not.toContain("someone.private");
  expect(wire).not.toContain(headline);
  expect(fake.snapshots.some((s) => s.data.includes("****"))).toBe(true);
  expect(fake.outsideRequests).toEqual([]);
  expect(problems).toEqual([]);
});

test("signed in: identified by uuid only, and nothing recorded on chat", async ({ page }) => {
  test.skip(!hasBackend, "needs the local Supabase stack");
  const student = await createStudent({ domain: "nutech.edu.pk", fullName: "Analytics Person" });
  const fake = await fakePostHog(page);
  const problems = watchConsole(page);
  await signInWithPassword(page, student.email, student.password);
  await page.goto("/feed");

  await expect.poll(() => names(fake), { timeout: 20_000 }).toContain("$identify");
  const identify = fake.events.find((e) => e.event === "$identify")!;
  expect(identify.properties.distinct_id).toBe(student.id);
  const traits = identify.$set ?? (identify.properties.$set as Record<string, unknown>);
  expect(Object.keys(traits).sort()).toEqual(["role", "university_id"]);
  expect(traits.role).toBe("student");
  // The feed is recorded (this session is in the sample): the recorder is running.
  await expect.poll(() => fake.scripts, { timeout: 20_000 }).toContain("lazy-recorder.js");

  // Into chat by a client-side navigation: recording pauses, and nothing is sent from chat.
  const before = fake.events.length;
  await page.getByRole("link", { name: "Chat" }).first().click();
  await page.waitForURL(/\/chat/);
  await page.waitForTimeout(8_000);
  // And by a full page load: the recorder never starts there.
  await page.goto("/chat");
  await page.waitForTimeout(5_000);
  expect(fake.events.slice(before).filter((e) => e.event === "$snapshot")).toEqual([]);
  expect(fake.snapshots.some((s) => s.href?.includes("/chat"))).toBe(false);
  expect(names(fake)).toContain("$pageview");

  const wire = fake.wire.join("\n");
  for (const secret of [student.email, student.fullName, student.username]) expect(wire).not.toContain(secret);
  for (const name of names(fake)) expect(ALLOWED.has(name), name).toBe(true);
  expect(fake.outsideRequests).toEqual([]);
  expect(problems).toEqual([]);
});
