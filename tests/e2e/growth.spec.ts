import AxeBuilder from "@axe-core/playwright";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { createStudent, hasBackend, signInWithPassword, watchConsole, type TestStudent } from "./support";

/**
 * Phase 17 (PRD 5.32) done-whens, through the app: a path shows the starter order with no data and
 * the data order once 10 seniors qualify; a task linked to a repository that proves the skill
 * completes without a peer (the github-worker's own run is tests/worker/github-worker.test.ts;
 * here its check runs over a direct connection); a peer can't review a friend's task; a swap with a
 * confirmed session issues exactly one Taught entry. (Every cross-user write is refused in pgTAP 59.)
 * Axe in both themes on every new screen.
 */
const DB_URL = process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const RULES = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

test.describe("Growth: paths, proof tasks, skill swap", () => {
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

  async function ok<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
    const { data, error } = await p;
    if (error) throw new Error(error.message);
    return data;
  }

  test("paths: starter order, then the data order at 10 seniors; a GitHub-proved task; a peer never reviews a friend", async ({ browser }) => {
    test.setTimeout(300_000);
    const tag = Math.random().toString(36).slice(2, 7);
    const student = await createStudent({ domain: "nutech.edu.pk", fullName: `Hira Path ${tag}` });
    const peer = await createStudent({ domain: "nu.edu.pk", fullName: `Rehan Peer ${tag}` });
    const friend = await createStudent({ domain: "nutech.edu.pk", fullName: `Faraz Friend ${tag}` });
    const seniors = Array.from({ length: 10 }, () => crypto.randomUUID());

    // A run that timed out never reached its cleanup: drop its seniors first.
    await sql`delete from auth.users where email like 'path-senior-%@nutech.edu.pk'`;
    await sql`select private.compute_paths()`;
    try {
      // --- The starter path ------------------------------------------------------------
      const page = await pageFor(browser, student);
      const problems = watchConsole(page);
      await page.goto("/me/paths?role=devops");
      await expect(page.getByRole("heading", { name: "Paths", exact: true })).toBeVisible();
      await expect(page.getByTestId("path-source")).toContainText("Starter path");
      await expect(page.getByTestId("path-square").first()).toHaveAttribute("data-skill", "shell");
      await expect(page.getByTestId("paths-no-github")).toBeVisible();
      await axeBothThemes(page, "/me/paths");

      // --- 10 seniors (Shine, 7 of DevOps' 11 skills at L2 (60%, rounded up), Docker first) switch it -----------
      await sql`insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at)
                select x, 'path-senior-' || ${tag} || '-' || n || '@nutech.edu.pk', jsonb_build_object('full_name', 'Senior ' || n), now()
                  from unnest(${seniors}::uuid[]) with ordinality as t(x, n)`;
      await sql`insert into public.ranking_scores (user_id, formula_version, components, proof, momentum, adjustments, total, ranked, tier, computed_at, published_at)
                select x, 2, '{}', 0, 0, 0, 500, true, 'shine', now(), now() from unnest(${seniors}::uuid[]) x`;
      await sql`insert into public.user_skills (user_id, skill_id, level, l2_at)
                select x, s.skill, 2, now() - interval '300 days' + make_interval(days => s.d)
                  from unnest(${seniors}::uuid[]) x,
                       (values ('docker', 0), ('shell', 20), ('github-actions', 40), ('nginx', 60), ('terraform', 80), ('aws', 100), ('docker-compose', 120)) as s(skill, d)`;
      await sql`select private.compute_paths()`;
      await page.reload();
      await expect(page.getByTestId("path-source")).toContainText("Based on 10 seniors' records");
      await expect(page.getByTestId("path-square").first()).toHaveAttribute("data-skill", "docker");

      // Follow it; the progress card's next step points at the next square.
      await page.getByTestId("follow-devops").click();
      await expect(page.getByTestId("unfollow-devops")).toBeVisible();
      await expect(page.locator('[data-testid="path-square"][data-state="next"]')).toHaveAttribute("data-skill", "docker");

      // --- A proof task proved by GitHub, without a peer ----------------------------------
      // The drawer offers at most 3 tasks: earlier runs' test tasks are switched off first.
      await sql`update public.proof_tasks set active = false where title like 'Ship a container %' or title like 'Chart a service %'`;
      await sql`
        insert into public.proof_tasks (skill_id, title, difficulty, brief, checklist)
        values ('docker', ${`Ship a container ${tag}`}, 'starter', 'Write a Dockerfile for one of your projects so it runs with one command anywhere.',
                '["docker build works from a clean checkout", "The image runs as a non-root user", "The README has the command"]')
        returning id`;
      const ghId = 9_170_000 + Math.floor(Math.random() * 90_000);
      await sql`insert into public.github_accounts (user_id, github_id, login) values (${student.id}, ${ghId}, ${`hira-${tag}`})`;
      await sql`insert into public.github_installations (installation_id, account_id, account_login, account_type) values (${ghId}, ${ghId}, ${`hira-${tag}`}, 'User')`;
      await sql`insert into public.github_repos (repo_id, full_name, owner_id, private, default_branch) values (${ghId}, ${`hira-${tag}/api`}, ${ghId}, false, 'main')`;
      await sql`insert into public.github_user_repos (user_id, repo_id, installation_id, kind) values (${student.id}, ${ghId}, ${ghId}, 'owned')`;
      await page.reload();
      await page.locator('[data-testid="path-square"][data-skill="docker"]').click();
      const drawer = page.getByTestId("skill-drawer");
      await expect(drawer).toBeVisible();
      await expect(drawer).toContainText("Why it's here");
      await drawer.getByTestId("drawer-task").filter({ hasText: `Ship a container ${tag}` }).getByTestId("start-task").click();
      await page.waitForURL(/\/me\/tasks\/[0-9a-f-]{36}$/);
      await expect(page.getByTestId("task-status")).toHaveText("Started");
      await axeBothThemes(page, "/me/tasks/[id]");
      await page.getByTestId("task-repo").selectOption({ label: `hira-${tag}/api` });
      await page.getByTestId("task-submit").click();
      await expect(page.getByTestId("task-status")).toHaveText("Verifying with GitHub");
      // The rescan finds a counted Docker commit made since the task started (the worker's check).
      await sql`select private.record_commit(${student.id}, ${ghId}, jsonb_build_object(
                  'sha', encode(extensions.digest(${`docker-${tag}`}, 'sha1'), 'hex'), 'committed_at', now(), 'authored_at', now(),
                  'seen_via', 'harvest', 'meaningful_lines', 12,
                  'detections', '[{"skill": "docker", "kind": "file", "path": "Dockerfile", "lines": 0}]'::jsonb, 'blobs', '[]'::jsonb))`;
      await sql`select private.task_github_check(${student.id})`;
      await page.reload();
      await expect(page.getByTestId("task-done")).toContainText("verified by GitHub");
      const ghAttempt = page.url().split("/").pop()!;
      const [{ n: peersAsked }] = await sql<{ n: number }[]>`select count(*)::int as n from public.task_reviews where attempt_id = ${ghAttempt}`;
      expect(peersAsked).toBe(0);
      const [entry] = await sql<{ kind: string; issuer_name: string }[]>`select kind, issuer_name from public.record_entries where source_id = ${ghAttempt}`;
      expect(entry).toEqual({ kind: "proof_task", issuer_name: "Skilient" });

      // --- A peer can't review a friend's task --------------------------------------------
      // Helm at L2 for the peer and the friend only, so the offer is theirs to get.
      await sql`delete from public.user_skills where skill_id = 'helm' and level >= 2 and user_id not in (${peer.id}, ${friend.id})`;
      await sql`insert into public.user_skills (user_id, skill_id, level) values (${peer.id}, 'helm', 2), (${friend.id}, 'helm', 2)`;
      await sql`insert into public.friendships (user_id_a, user_id_b) values (least(${student.id}::uuid, ${friend.id}::uuid), greatest(${student.id}::uuid, ${friend.id}::uuid))`;
      const [helmTask] = await sql<{ id: string }[]>`
        insert into public.proof_tasks (skill_id, title, difficulty, brief, checklist)
        values ('helm', ${`Chart a service ${tag}`}, 'core', 'Package one of your services as a Helm chart with values for two environments.',
                '["The chart installs with helm install", "Values differ for staging and production", "The README explains the values"]')
        returning id`;
      const api = await apiAs(student);
      const attempt = (await ok(api.rpc("start_task", { p_task: helmTask.id } as never))) as unknown as string;
      await ok(api.rpc("link_task_repo", { p_attempt: attempt, p_repo: ghId } as never));
      await ok(api.rpc("submit_task", { p_attempt: attempt } as never));
      await sql`update public.task_attempts set submitted_at = now() - interval '2 hours' where id = ${attempt}`;
      await sql`select private.proof_tasks_tick()`;
      const offered = await sql<{ reviewer_id: string }[]>`select reviewer_id from public.task_reviews where attempt_id = ${attempt}`;
      expect(offered.map((r) => r.reviewer_id)).toEqual([peer.id]);

      // The friend, even with an offer forced in, is refused.
      const [forced] = await sql<{ id: string }[]>`insert into public.task_reviews (attempt_id, reviewer_id, round) values (${attempt}, ${friend.id}, 1) returning id`;
      const friendPage = await pageFor(browser, friend);
      await friendPage.goto(`/me/tasks/reviews/${forced.id}`);
      await friendPage.getByTestId("review-accept").click();
      await expect(friendPage.getByText("You can't review this task.")).toBeVisible();

      // The peer accepts from /me/paths, then confirms against the checklist.
      const peerPage = await pageFor(browser, peer);
      await peerPage.goto("/me/paths");
      await peerPage.getByTestId("review-offers").getByRole("link").first().click();
      await expect(peerPage.getByRole("heading", { level: 1 })).toContainText(`Can you check Hira's Helm task?`);
      await axeBothThemes(peerPage, "/me/tasks/reviews/[id]");
      await peerPage.getByTestId("review-accept").click();
      await expect(peerPage.getByTestId("review-tick")).toHaveCount(3);
      for (const tick of await peerPage.getByTestId("review-tick").all()) await tick.click();
      await peerPage.getByTestId("review-confirm").click();
      await expect(peerPage.getByTestId("review-closed")).toContainText("You confirmed this task");
      const [peerDone] = await sql<{ verified_by: string }[]>`select verified_by from public.task_attempts where id = ${attempt}`;
      expect(peerDone.verified_by).toBe("peer");
      expect(problems).toEqual([]);
    } finally {
      await sql`delete from auth.users where id = any(${seniors}::uuid[])`;
      await sql`select private.compute_paths()`;
      await sql`update public.proof_tasks set active = false where title like ${`% ${tag}`}`;
    }
  });

  test("skill swap: request, accept, DM, a confirmed session, a thank-you note, one Taught entry", async ({ browser }) => {
    test.setTimeout(240_000);
    const tag = Math.random().toString(36).slice(2, 7);
    const teacher = await createStudent({ domain: "nutech.edu.pk", fullName: `Ayesha Teach ${tag}` });
    const learner = await createStudent({ domain: "nutech.edu.pk", fullName: `Hira Learn ${tag}` });
    await sql`insert into public.user_skills (user_id, skill_id, level) values (${teacher.id}, 'kotlin', 3)
              on conflict (user_id, skill_id) do update set level = 3`;

    // The teacher offers Kotlin (L3 verified).
    const tPage = await pageFor(browser, teacher);
    const problems = watchConsole(tPage);
    await tPage.goto("/swaps?tab=teach");
    await tPage.getByTestId("offer-kotlin").click();
    await expect(tPage.locator('[data-testid="teachable"][data-skill="kotlin"]')).toContainText("Offered");
    await axeBothThemes(tPage, "/swaps (teach)");

    // The learner wants Kotlin, finds the teacher, asks.
    const lPage = await pageFor(browser, learner);
    await lPage.goto("/swaps");
    await lPage.getByTestId("want-skill").selectOption("kotlin");
    await lPage.getByTestId("want-add").click();
    const row = lPage.getByTestId("teacher").filter({ hasText: `Ayesha Teach ${tag}` });
    await expect(row).toContainText("L3 Kotlin");
    await axeBothThemes(lPage, "/swaps (learn)");
    await row.getByTestId("swap-ask").click();
    await lPage.getByTestId("swap-note").fill("I want to build an Android app.");
    await lPage.getByTestId("swap-send").click();
    await expect(row.getByText("Asked")).toBeVisible();

    // The teacher accepts: a DM opens.
    await tPage.goto("/swaps?tab=teach");
    await tPage.getByTestId("swap-request").filter({ hasText: `Hira Learn ${tag}` }).getByTestId("swap-accept").click();
    await expect(tPage.getByTestId("swap-request").filter({ hasText: `Hira Learn ${tag}` })).toHaveCount(0);
    const [swap] = await sql<{ id: string; thread_id: string | null; status: string }[]>`
      select id, thread_id, status from public.swaps where teacher_id = ${teacher.id} and learner_id = ${learner.id}`;
    expect(swap.status).toBe("accepted");
    expect(swap.thread_id).not.toBeNull();

    // The learner proposes a session; the teacher accepts it.
    await lPage.goto(`/swaps/${swap.id}`);
    await expect(lPage.getByTestId("swap-chat")).toBeVisible();
    const at = new Date(Date.now() + 2 * 86_400_000 + 5 * 3_600_000).toISOString().slice(0, 16); // UTC+5 wall time
    // Filled again until it sticks: a fill that lands before hydration is reset by React.
    await expect(async () => {
      await lPage.getByTestId("session-at").fill(at);
      await lPage.getByTestId("session-place").fill("Library, room 2");
      await expect(lPage.getByTestId("session-at")).toHaveValue(at, { timeout: 1_000 });
    }).toPass();
    await lPage.getByTestId("session-propose").click();
    await expect(lPage.getByTestId("swap-session")).toContainText("Proposed");
    await tPage.goto(`/swaps/${swap.id}`);
    await tPage.getByTestId("session-accept").click();
    await expect(tPage.getByTestId("swap-session")).toContainText("Booked");

    // It happened: the learner confirms 90 minutes with a thank-you note.
    await sql`update public.swap_sessions set starts_at = now() - interval '3 hours' where swap_id = ${swap.id}`;
    await lPage.reload();
    await axeBothThemes(lPage, "/swaps/[id]");
    await lPage.getByTestId("confirm-minutes").fill("90");
    await lPage.getByTestId("confirm-note").fill("Thank you, coroutines finally make sense!");
    await lPage.getByTestId("confirm-session").click();
    await expect(lPage.getByTestId("swap-session")).toContainText("Happened");

    // The teacher approves the note and ends the swap.
    await tPage.reload();
    await tPage.getByTestId("note-approve").click();
    await expect(tPage.getByTestId("swap-note")).toContainText("On the profile");
    tPage.once("dialog", (d) => void d.accept());
    await tPage.getByTestId("swap-end").click();
    await expect(tPage.getByTestId("swap-closed")).toBeVisible();

    const entries = await sql<{ title: string; line: string; user_id: string }[]>`
      select title, evidence ->> 'line' as line, user_id from public.record_entries where kind = 'taught' and source_id = ${swap.id}`;
    expect(entries).toEqual([{ title: "Taught Kotlin to Hira", line: "1 session · 1.5 h", user_id: teacher.id }]);

    // The note is on the teacher's profile for others.
    await lPage.goto(`/profile/${teacher.username}`);
    await expect(lPage.getByTestId("swap-notes")).toContainText("Thank you, coroutines finally make sense!");
    expect(problems).toEqual([]);
  });
});
