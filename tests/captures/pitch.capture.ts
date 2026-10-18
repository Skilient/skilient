import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";
import postgres from "postgres";
import { issueCv, rotateKey } from "../../supabase/functions/_shared/cv/issue.ts";
import { dbFrom } from "../../supabase/functions/_shared/github/types.ts";
import { adminClient, createStudent, currentAgreementVersion, PASSWORD, signInWithPassword, totp, type TestStudent } from "../e2e/support";

/**
 * Pitch-deck screenshots (not part of the product): a fictional demo campus at NUTECH seeded on the
 * local stack, then real screens from every portal. Output goes to PITCH_OUT (outside the repo).
 * Runs only when PITCH_OUT is set, so `pnpm marketing:captures` skips it.
 */
const OUT = process.env.PITCH_OUT ?? "";
const DB_URL = process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const VIEW = { width: 1440, height: 900 };
const PORTAL = { width: 1100, height: 820 };

type Sql = ReturnType<typeof postgres>;
const log = (...a: unknown[]) => console.log("[pitch]", ...a);

async function account(email: string, fullName: string, meta: Record<string, unknown>): Promise<TestStudent> {
  const db = adminClient();
  const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: fullName, ...meta } });
  if (error || !data.user) throw new Error(`createUser ${email}: ${error?.message}`);
  await db.from("agreement_acceptances").insert({ user_id: data.user.id, version: await currentAgreementVersion(db) });
  return { id: data.user.id, email, password: PASSWORD, fullName, username: "" };
}

async function withTwoFactor(browser: Browser, who: TestStudent): Promise<Page> {
  const page = await (await browser.newContext({ viewport: PORTAL, deviceScaleFactor: 2, reducedMotion: "reduce", colorScheme: "light" })).newPage();
  await signInWithPassword(page, who.email, who.password);
  await page.goto("/settings/security");
  await page.getByRole("button", { name: "Set up two-factor" }).click();
  const secret = (await page.locator("code").first().textContent())?.trim() ?? "";
  await page.getByLabel("Code from the app").fill(totp(secret));
  await page.getByRole("button", { name: "Confirm" }).click();
  await page.getByRole("checkbox", { name: "I've saved these codes" }).check();
  await page.getByRole("button", { name: "Done" }).click();
  await page.waitForTimeout(500);
  return page;
}

async function studentPage(browser: Browser, who: TestStudent, phone = false, view = VIEW): Promise<Page> {
  const ctx = await browser.newContext(
    phone
      ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, reducedMotion: "reduce", colorScheme: "light" }
      : { viewport: view, deviceScaleFactor: 2, reducedMotion: "reduce", colorScheme: "light" },
  );
  const page = await ctx.newPage();
  await signInWithPassword(page, who.email, who.password);
  return page;
}

/** Full-viewport screenshot, plus a full-page one when asked. */
async function snap(page: Page, name: string, opts: { full?: boolean; wait?: number } = {}) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(opts.wait ?? 600);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), animations: "disabled", caret: "hide", fullPage: opts.full ?? false });
  log("shot", name, page.url());
}

const STUDENTS: { name: string; dept: string; year: number; city: string; skills: Record<string, number> }[] = [
  { name: "Ayesha Siddiqui", dept: "Computer Science", year: 2027, city: "Islamabad", skills: { react: 4, typescript: 3, postgresql: 3, nodejs: 2, tailwindcss: 2, python: 2, docker: 1, playwright: 1 } },
  { name: "Bilal Ahmed", dept: "Computer Science", year: 2027, city: "Rawalpindi", skills: { nodejs: 3, postgresql: 2, express: 2, docker: 2, typescript: 2 } },
  { name: "Mariam Javed", dept: "Software Engineering", year: 2027, city: "Islamabad", skills: { css: 3, react: 2, figma: 0, html: 2, tailwindcss: 2 } },
  { name: "Hamza Khan", dept: "Computer Science", year: 2026, city: "Islamabad", skills: { react: 3, nextjs: 2, typescript: 2, vercel: 1 } },
  { name: "Usman Tariq", dept: "Software Engineering", year: 2026, city: "Rawalpindi", skills: { flutter: 3, dart: 3, firebase: 2, kotlin: 1 } },
  { name: "Zainab Qureshi", dept: "Computer Science", year: 2027, city: "Islamabad", skills: { python: 3, django: 2, postgresql: 2, docker: 1 } },
  { name: "Fatima Noor", dept: "Software Engineering", year: 2028, city: "Wah Cantt", skills: { javascript: 2, react: 1, jest: 1 } },
  { name: "Hira Baig", dept: "Artificial Intelligence", year: 2026, city: "Islamabad", skills: { python: 4, pytorch: 3, opencv: 3, numpy: 2, fastapi: 2 } },
  { name: "Ali Hassan", dept: "Artificial Intelligence", year: 2026, city: "Rawalpindi", skills: { python: 3, tensorflow: 2, pandas: 2, "scikit-learn": 2 } },
  { name: "Sana Iqbal", dept: "Artificial Intelligence", year: 2027, city: "Islamabad", skills: { python: 2, pandas: 2, matplotlib: 2, jupyter: 1 } },
  { name: "Omar Farooq", dept: "Computer Science", year: 2026, city: "Islamabad", skills: { java: 3, "spring-boot": 2, mysql: 2, docker: 1 } },
  { name: "Areeba Khan", dept: "Computer Science", year: 2027, city: "Taxila", skills: { java: 2, android: 2, kotlin: 2 } },
  { name: "Talha Mehmood", dept: "Software Engineering", year: 2027, city: "Islamabad", skills: { php: 3, laravel: 2, mysql: 2, vue: 1 } },
  { name: "Maham Raza", dept: "Computer Science", year: 2028, city: "Islamabad", skills: { cpp: 2, c: 2, python: 1 } },
  { name: "Danish Akram", dept: "Electrical Engineering", year: 2026, city: "Rawalpindi", skills: { arduino: 3, c: 2, "raspberry-pi": 2, python: 2 } },
  { name: "Iqra Shahid", dept: "Software Engineering", year: 2027, city: "Islamabad", skills: { react: 2, typescript: 2, "react-native": 2, expo: 1 } },
  { name: "Saad Qamar", dept: "Computer Science", year: 2026, city: "Islamabad", skills: { go: 3, kubernetes: 2, docker: 3, terraform: 1, aws: 2 } },
  { name: "Noor Fatima", dept: "Artificial Intelligence", year: 2028, city: "Rawalpindi", skills: { python: 2, "hugging-face-transformers": 1, pandas: 1 } },
  { name: "Rehan Butt", dept: "Computer Science", year: 2027, city: "Islamabad", skills: { csharp: 2, "aspnet-core": 2, sql: 2 } },
  { name: "Laraib Aslam", dept: "Software Engineering", year: 2028, city: "Islamabad", skills: { html: 2, css: 2, javascript: 1 } },
  { name: "Kashif Mir", dept: "Electrical Engineering", year: 2027, city: "Taxila", skills: { verilog: 2, vhdl: 2, matlab: 2 } },
  { name: "Mehwish Anwar", dept: "Computer Science", year: 2026, city: "Islamabad", skills: { typescript: 3, nestjs: 2, postgresql: 3, redis: 2, docker: 2 } },
  { name: "Ahsan Latif", dept: "Computer Science", year: 2027, city: "Rawalpindi", skills: { unity: 2, csharp: 2, blender: 0 } },
  { name: "Rabia Sultan", dept: "Software Engineering", year: 2026, city: "Islamabad", skills: { "automated-testing": 2, cypress: 2, playwright: 2, javascript: 2 } },
];

test("pitch: demo campus and every portal", async ({ browser }) => {
  test.skip(!OUT, "set PITCH_OUT to run the pitch captures");
  test.setTimeout(1_500_000);
  await mkdir(OUT, { recursive: true });
  const sql: Sql = postgres(DB_URL, { max: 1, onnotice: () => undefined });
  const db = adminClient();
  try {
    const [{ id: nutech }] = await sql`select university_id as id from public.university_domains where domain = 'nutech.edu.pk'`;
    // Earlier runs of this script.
    await sql`delete from public.ventures where title in ('Lab booking for CS students', 'Campus Rides', 'Crop disease detector', 'Hostel mess tracker')`;
    await sql`delete from public.organizations where slug = 'indus-softworks-sample'`;
    await sql`update public.universities set owner_id = null where id = ${nutech}`;
    await sql`delete from auth.users where id in (select user_id from public.profiles where university_id = ${nutech} or full_name = 'Hassan Raza')`;

    // --- Students ---------------------------------------------------------------------------
    const people: (TestStudent & { dept: string })[] = [];
    for (const s of STUDENTS) {
      const st = await createStudent({ domain: "nutech.edu.pk", fullName: s.name });
      const username = s.name.toLowerCase().replace(/[^a-z]+/g, "_") + "_" + Math.random().toString(36).slice(2, 5);
      await sql`update public.profiles set username = ${username}, department = ${s.dept}, graduation_year = ${s.year}, city = ${s.city},
                  recruiter_visible = true, availability = array['internship','full_time']::text[], remote_ok = true, visibility = 'university',
                  bio = ${`${s.dept} student at NUTECH. I like shipping things people use.`}
                where user_id = ${st.id}`;
      await sql`insert into public.tips_seen (user_id, tip_id) select ${st.id}, t from unnest(array['opportunities', 'venture', 'cv', 'score', 'privacy']) t on conflict do nothing`;
      people.push({ ...st, username, dept: s.dept });
    }
    const by = (n: string) => people.find((p) => p.fullName === n)!;
    // Background classmates so the dashboards have groups of five or more.
    const FIRST = ["Abdullah", "Aiman", "Anas", "Bushra", "Daniyal", "Eman", "Faizan", "Ghazal", "Haris", "Huma", "Imran", "Javeria", "Kamran", "Komal", "Moiz", "Nida", "Owais", "Pakeeza", "Qasim", "Rida", "Shayan", "Tooba", "Umair", "Wajiha", "Yasir", "Zoya"];
    const LAST = ["Abbasi", "Awan", "Chaudhry", "Durrani", "Gillani", "Hashmi", "Janjua", "Kiani", "Lodhi", "Minhas", "Niazi", "Qazi", "Rana", "Satti", "Warraich"];
    const DEPTS = ["Computer Science", "Computer Science", "Software Engineering", "Artificial Intelligence", "Electrical Engineering"];
    const POOL = ["python", "javascript", "react", "java", "cpp", "html", "css", "sql", "typescript", "nodejs", "flutter", "pandas", "django", "android", "docker"];
    const background: TestStudent[] = [];
    for (let i = 0; i < 56; i++) {
      const name = `${FIRST[i % FIRST.length]} ${LAST[(i * 7) % LAST.length]}`;
      const st = await createStudent({ domain: "nutech.edu.pk", fullName: name });
      const username = name.toLowerCase().replace(/[^a-z]+/g, "_") + "_" + Math.random().toString(36).slice(2, 5);
      await sql`update public.profiles set username = ${username}, department = ${DEPTS[i % DEPTS.length]}, graduation_year = ${2026 + (i % 3)},
                  city = ${i % 3 ? "Islamabad" : "Rawalpindi"}, recruiter_visible = ${i % 4 !== 0}, availability = array['internship']::text[], visibility = 'university'
                where user_id = ${st.id}`;
      const n = 1 + (i % 4);
      for (let k = 0; k < n; k++) {
        const skill = POOL[(i * 3 + k * 5) % POOL.length];
        const level = k === 0 ? 1 + (i % 3) : 1;
        await sql`insert into public.user_skills (user_id, skill_id, level, active_days, lines, hits, repos, last_used_at, updated_at)
          values (${st.id}, ${skill}, ${level}, ${level * 6}, ${level * 500}, ${level * 3}, 1, now() - make_interval(days => ${i % 40}), now() - make_interval(days => ${i % 40}))
          on conflict do nothing`;
      }
      background.push(st);
    }
    log("background", background.length);

    const ayesha = by("Ayesha Siddiqui");
    log("students", people.length);

    // --- Teacher -----------------------------------------------------------------------------
    const teacher = await account(`amna.rauf.${Date.now().toString(36)}@nutech.edu.pk`, "Dr. Amna Rauf", { role: "faculty" });
    await sql`update public.profiles set username = ${"dr_amna_rauf_" + Math.random().toString(36).slice(2, 5)}, department = 'Software Engineering', onboarding_complete = true where user_id = ${teacher.id}`;
    await sql`insert into public.teacher_profiles (user_id, university_id, department, title, status, approved_at, approval_source)
              values (${teacher.id}, ${nutech}, 'Software Engineering', 'Assistant Professor', 'approved', now() - interval '60 days', 'staff')
              on conflict (user_id) do update set status = 'approved', approved_at = excluded.approved_at`;

    // --- Ventures ----------------------------------------------------------------------------
    async function venture(title: string, description: string, owner: TestStudent, skills: string[], members: [TestStudent, string][], daysAgo: number) {
      const [v] = await sql`insert into public.ventures (type, owner_id, university_id, title, description, status, skill_ids, team_size, created_at)
        values ('project', ${owner.id}, ${nutech}, ${title}, ${description}, 'in_progress', ${skills}, 6, now() - make_interval(days => ${daysAgo})) returning id`;
      await sql`insert into public.venture_members (venture_id, user_id, team_role, joined_at) values (${v.id}, ${owner.id}, 'lead', now() - make_interval(days => ${daysAgo})) on conflict do nothing`;
      for (const [m, role] of members) {
        await sql`insert into public.venture_members (venture_id, user_id, team_role, joined_at) values (${v.id}, ${m.id}, ${role}::venture_team_role, now() - make_interval(days => ${daysAgo - 2})) on conflict do nothing`;
      }
      return v.id as string;
    }
    async function contribute(v: string, who: TestStudent, kind: string, text: string, hours: number, skills: string[], daysAgo: number, confirmers: [TestStudent, "peer" | "supervisor"][]) {
      const [c] = await sql`insert into public.contributions (venture_id, user_id, kind, description, hours, skill_ids, created_at)
        values (${v}, ${who.id}, ${kind}::contribution_kind, ${text}, ${hours}, ${skills}, now() - make_interval(days => ${daysAgo})) returning id`;
      for (const [cf, role] of confirmers) {
        await sql`insert into public.contribution_confirmations (contribution_id, confirmer_id, confirmer_role, created_at) values (${c.id}, ${cf.id}, ${role}, now() - make_interval(days => ${daysAgo - 1}))`;
      }
    }
    const [bilal, mariam, hamza, usman, zainab, fatima, hira, ali, sana, omar, areeba, talha] = [
      "Bilal Ahmed", "Mariam Javed", "Hamza Khan", "Usman Tariq", "Zainab Qureshi", "Fatima Noor", "Hira Baig", "Ali Hassan", "Sana Iqbal", "Omar Farooq", "Areeba Khan", "Talha Mehmood",
    ].map(by);

    const lab = await venture("Lab booking for CS students", "Students book lab machines and see what is free right now. Built with the CS department; used by second-year students.", ayesha, ["react", "postgresql", "nodejs"], [[bilal, "developer"], [mariam, "designer"], [hamza, "developer"]], 120);
    await contribute(lab, ayesha, "code", "Built the booking calendar and the live 'free now' view in React", 22, ["react", "typescript"], 100, [[bilal, "peer"], [hamza, "peer"]]);
    await contribute(lab, ayesha, "code", "Designed the Postgres schema and the double-booking guard", 12, ["postgresql"], 90, [[bilal, "peer"]]);
    await contribute(lab, bilal, "code", "Wrote the Node API and the lab-staff admin endpoints", 18, ["nodejs", "express"], 95, [[ayesha, "peer"]]);
    await contribute(lab, mariam, "design", "Designed the booking flow and tested it with 12 second-year students", 14, ["css"], 98, [[ayesha, "peer"]]);
    await contribute(lab, hamza, "code", "Built the Next.js landing page and deployment", 9, ["nextjs"], 85, [[ayesha, "peer"]]);

    const rides = await venture("Campus Rides", "Carpooling for NUTECH students and staff: match rides from Rawalpindi and Islamabad, split fuel costs.", usman, ["flutter", "firebase", "react"], [[ayesha, "developer"], [zainab, "developer"], [fatima, "researcher"]], 70);
    await sql`insert into public.venture_supervisors (venture_id, teacher_id, status, invited_by, created_at, started_at) values (${rides}, ${teacher.id}, 'active', ${usman.id}, now() - interval '60 days', now() - interval '59 days')`;
    await contribute(rides, usman, "code", "Built the Flutter rider app and live ride matching", 30, ["flutter", "dart"], 50, [[zainab, "peer"], [teacher, "supervisor"]]);
    await contribute(rides, ayesha, "code", "Built the React admin dashboard for ride reports", 10, ["react", "typescript"], 40, [[usman, "peer"], [teacher, "supervisor"]]);
    await contribute(rides, zainab, "code", "Django API for fare splitting and payouts", 16, ["python", "django"], 45, [[usman, "peer"]]);
    await contribute(rides, fatima, "research", "Surveyed 140 students on commute routes and times", 8, [], 55, [[usman, "peer"]]);

    const crops = await venture("Crop disease detector", "A phone camera app that spots wheat rust early. Trained on 9,000 labelled leaf photos from Punjab farms.", hira, ["python", "pytorch", "opencv"], [[ali, "developer"], [sana, "researcher"]], 90);
    await sql`insert into public.venture_supervisors (venture_id, teacher_id, status, invited_by, created_at, started_at) values (${crops}, ${teacher.id}, 'active', ${hira.id}, now() - interval '80 days', now() - interval '79 days')`;
    await contribute(crops, hira, "code", "Trained the leaf-rust classifier (91% on the held-out set)", 40, ["python", "pytorch"], 60, [[ali, "peer"], [teacher, "supervisor"]]);
    await contribute(crops, ali, "code", "Built the TensorFlow Lite export for phones", 15, ["tensorflow"], 50, [[hira, "peer"]]);
    await contribute(crops, sana, "research", "Labelled 2,000 photos with an agronomist", 20, ["pandas"], 65, [[hira, "peer"]]);

    const mess = await venture("Hostel mess tracker", "Hostel residents see today's menu, rate meals and the mess committee sees what to fix.", omar, ["java", "spring-boot", "android"], [[areeba, "developer"], [talha, "developer"]], 40);
    await contribute(mess, omar, "code", "Spring Boot API and menu scheduling", 14, ["java", "spring-boot"], 30, [[areeba, "peer"]]);
    await contribute(mess, areeba, "code", "Android app for ratings", 12, ["android", "kotlin"], 28, [[omar, "peer"]]);

    // Ship the lab-booking venture (records the completion and posts "Shipped").
    await sql`update public.ventures set status = 'completed', completed_at = now() - interval '20 days' where id = ${lab}`;
    log("ventures done");

    // --- Endorsements (teammates and the supervisor) ------------------------------------------
    const endorse = async (from: TestStudent, to: TestStudent, v: string, skill: string, note: string, kind: "peer" | "teacher" = "peer") =>
      sql`insert into public.endorsements (endorser_id, endorsee_id, venture_id, skill_id, note, endorser_kind, created_at) values (${from.id}, ${to.id}, ${v}, ${skill}, ${note}, ${kind}, now() - interval '15 days')`;
    await endorse(bilal, ayesha, lab, "react", "Ayesha built the whole booking calendar and fixed every edge case we found.");
    await endorse(hamza, ayesha, lab, "postgresql", "Her schema stopped double bookings on day one.");
    await endorse(usman, ayesha, rides, "react", "Shipped our admin dashboard in a week.");
    await endorse(teacher, ayesha, rides, "typescript", "Clean, well-tested code. One of the strongest students I supervise.", "teacher");
    await endorse(ayesha, bilal, lab, "nodejs", "Bilal's API never went down during the pilot.");
    await endorse(teacher, hira, crops, "pytorch", "Careful experiments and honest evaluation.", "teacher");
    await endorse(ali, hira, crops, "python", "Led the model work end to end.");
    await endorse(zainab, usman, rides, "flutter", "Usman built the app that 60 students now use.");

    // --- Skills (GitHub levels sit under the proof levels from confirmations) ------------------
    for (const s of STUDENTS) {
      const p = by(s.name);
      for (const [skill, level] of Object.entries(s.skills)) {
        if (level <= 0) continue;
        const exists = await sql`select 1 from public.skills where id = ${skill}`;
        if (!exists.length) continue;
        const lines = level * 900 + Math.round(Math.random() * 700);
        await sql`insert into public.user_skills (user_id, skill_id, level, active_days, lines, hits, repos, last_used_at, updated_at)
          values (${p.id}, ${skill}, ${level}, ${level * 9 + 4}, ${lines}, ${level * 6}, ${Math.max(1, level)}, now() - interval '3 days', now())
          on conflict (user_id, skill_id) do update set level = greatest(public.user_skills.level, excluded.level), active_days = excluded.active_days,
            lines = excluded.lines, hits = excluded.hits, repos = excluded.repos, last_used_at = excluded.last_used_at`;
      }
    }
    await sql`insert into public.github_accounts (user_id, github_id, login, connected_at) values (${ayesha.id}, 90210771, 'ayesha-siddiqui-dev', now() - interval '150 days') on conflict do nothing`;

    // --- Ranking (the real nightly engine) and the talent index -------------------------------
    await sql`delete from public.ranking_runs where run_on = current_date`;
    await sql`select private.ranking_run_all(now())`;
    for (const p of [...people, ...background]) await sql`select private.refresh_talent_index(${p.id})`;
    const tiers = await sql`select p.full_name, r.tier, r.total from public.ranking_scores r join public.profiles p on p.user_id = r.user_id where r.user_id = any(${people.map((p) => p.id)}) order by r.total desc`;
    log("tiers", tiers.map((t) => `${t.full_name}:${t.tier}:${Math.round(Number(t.total))}`).join(" | "));

    // --- Feed posts with survey answers from classmates ---------------------------------------
    async function post(author: TestStudent, body: string, minutesAgo: number, type = "general", readers = 0, dimension = "informative") {
      const [p] = await sql`insert into public.posts (author_id, university_id, audience, type, body, created_at) values (${author.id}, ${nutech}, 'university', ${type}::post_type, ${body}, now() - make_interval(mins => ${minutesAgo})) returning id`;
      const [q] = await sql`select id from public.micro_survey_questions where dimension = ${dimension} order by id limit 1`;
      for (const r of people.filter((x) => x.id !== author.id).slice(0, readers)) {
        await sql`insert into public.micro_survey_assignments (post_id, user_id, question_id, dimension) values (${p.id}, ${r.id}, ${q.id}, ${dimension}) on conflict do nothing`;
        await sql`insert into public.micro_survey_responses (post_id, user_id, question_id, dimension, answer, latency_ms, weight, locked_at) values (${p.id}, ${r.id}, ${q.id}, ${dimension}, true, 6000, 1, now()) on conflict do nothing`;
      }
      return p.id as string;
    }
    await post(hira, "Our wheat-rust model hit 91% on held-out photos. Biggest win: we stopped random-cropping leaves and kept the whole leaf in frame. Notebook is in our venture.", 50, "general", 14, "informative");
    await post(bilal, "Postgres tip from the lab booking project: an exclusion constraint on (machine, time range) killed every double booking without a single line of app code.", 95, "general", 11, "informative");
    await post(usman, "Campus Rides now matches 60 students a day between Rawalpindi and H-11. Looking for one more Flutter developer, see the open role on our venture.", 160, "general", 9, "interesting");
    await post(saadOr(people), "Wrote up how we cut our Docker image from 1.2 GB to 140 MB with multi-stage builds. Slides in the comments.", 300, "general", 7, "informative");

    // --- CV: signed with the cv-sign function's own code ---------------------------------------
    const cvdb = dbFrom(sql);
    const [active] = await sql`select key_id from public.signing_keys where retired_at is null`;
    if (!active) await rotateKey({ db: cvdb, log: () => undefined });
    const issued = await issueCv({ db: cvdb, log: () => undefined }, ayesha.id, "first");
    if (issued.status !== "issued") throw new Error(`cv: ${issued.status}`);
    const cvCode = issued.code;
    log("cv", cvCode);

    // --- Project ideas and review requests for the teacher ------------------------------------
    await sql`insert into public.project_ideas (teacher_id, university_id, title, brief, skills, difficulty, team_size, duration_weeks, deliverables, max_teams, status, course_label) values
      (${teacher.id}, ${nutech}, 'Attendance by QR for large lectures', 'Students scan a rotating QR code; the teacher sees attendance live and exports it to the LMS.', array['react','nodejs','postgresql'], 'intermediate', 4, 8, 'A working web app used in one real lecture, and a short report.', 3, 'open', 'SE-4201 Web Engineering'),
      (${teacher.id}, ${nutech}, 'Urdu handwriting recognition', 'Recognise handwritten Urdu digits and words from exam answer sheets.', array['python','pytorch'], 'advanced', 3, 12, 'A model, its evaluation and a demo page.', 2, 'open', 'AI-4102 Deep Learning'),
      (${teacher.id}, ${nutech}, 'Library seat finder', 'Show free library seats from door counters, on a phone.', array['flutter','firebase'], 'intro', 3, 6, 'A phone app and a one-page poster.', 4, 'open', null)`;
    await sql`insert into public.review_requests (venture_id, teacher_id, requested_by, status, due_at, created_at) values
      (${rides}, ${teacher.id}, ${usman.id}, 'open', now() + interval '5 days', now() - interval '2 days'),
      (${crops}, ${teacher.id}, ${hira.id}, 'open', now() + interval '9 days', now() - interval '1 day')`;
    await sql`insert into public.supervisor_comments (venture_id, author_id, body, created_at) values
      (${rides}, ${teacher.id}, 'Good progress. Before the review, add a short note on how you keep riders'' phone numbers private.', now() - interval '3 days')`;

    // --- Recruiter organisation ---------------------------------------------------------------
    const recruiter = await account(`hassan.raza.${Date.now().toString(36)}@indus-softworks-sample.pk`, "Hassan Raza", { role: "recruiter" });
    const [org] = await sql`insert into public.organizations (slug, name, domain, website, industry, size, city, signer_role, status, verified_at, created_by, about)
      values ('indus-softworks-sample', 'Indus Softworks', 'indus-softworks-sample.pk', 'https://indus-softworks-sample.pk', 'Software', '51-200', 'Islamabad', 'Head of Talent', 'verified', now() - interval '30 days', ${recruiter.id},
              'We build logistics software for Pakistani retailers. 120 engineers in Islamabad and Lahore.') returning id`;
    await sql`insert into public.org_members (org_id, user_id, role, status) values (${org.id}, ${recruiter.id}, 'admin', 'active') on conflict do nothing`;
    const ends = new Date(Date.now() + 30 * 86400_000).toISOString();
    const { data: recPlan } = await db.from("plans").select("grants").eq("id", "recruiter_growth_monthly").single();
    await db.from("entitlement_grants").insert(Object.entries(recPlan!.grants as Record<string, unknown>).map(([key, value]) => ({ subject_type: "org", subject_id: org.id, key, value, source: "admin", ends_at: ends, reason: "pitch demo" })));
    await sql`insert into public.job_posts (org_id, title, type, location, remote, salary_min, salary_max, deadline, description, status, published_at) values
      (${org.id}, 'Frontend intern (React)', 'internship', 'Islamabad', false, 40000, 60000, current_date + 21, 'Work with our web team on a customer dashboard. You will ship small features every week with a mentor.', 'live', now()),
      (${org.id}, 'Junior backend engineer', 'full_time', null, true, 120000, 160000, current_date + 30, 'Build and run Postgres-backed APIs for our logistics product.', 'live', now() - interval '1 day')`;

    // --- University admin (career office) on Growth -------------------------------------------
    const uniAdmin = await account(`career.${Date.now().toString(36)}@nutech.edu.pk`, "Sadia Malik", { role: "university_admin", university_id: nutech });
    await sql`update public.universities set owner_id = ${uniAdmin.id} where id = ${nutech}`;
    await sql`insert into public.university_admins (user_id, university_id, role) values (${uniAdmin.id}, ${nutech}, 'owner') on conflict do nothing`;
    const { data: uniPlan } = await db.from("plans").select("grants").eq("id", "uni_growth_yearly").single();
    await db.from("entitlement_grants").insert(Object.entries(uniPlan!.grants as Record<string, unknown>).map(([key, value]) => ({ subject_type: "university", subject_id: nutech, key, value, source: "admin", ends_at: ends, reason: "pitch demo" })));
    // Activity in the last 30 days and recruiter searches (skills gap demand).
    const everyone = [...people, ...background];
    for (const [i, p] of everyone.entries()) {
      if (i % 5 === 4) continue;
      await sql`insert into private.user_activity (user_id, last_active_at) values (${p.id}, now() - make_interval(days => ${i % 20}))
                on conflict (user_id) do update set last_active_at = excluded.last_active_at`;
    }
    for (const p of everyone) await sql`select private.refresh_talent_index(${p.id})`;
    await sql`insert into private.user_activity (user_id, last_active_at) values (${ayesha.id}, now() - interval '1 hour') on conflict (user_id) do update set last_active_at = excluded.last_active_at`;
    await sql`select private.refresh_talent_index(${ayesha.id})`;
    const demand: [string, number][] = [["react", 14], ["python", 11], ["nodejs", 9], ["flutter", 7], ["docker", 6], ["postgresql", 6], ["kubernetes", 5], ["typescript", 5]];
    for (const [skill, n] of demand) {
      for (let k = 0; k < n; k++) {
        await sql`insert into public.search_audit (org_id, user_id, mode, filters, result_count, at) values (${org.id}, ${recruiter.id}, 'full', ${sql.json({ skills: [{ skill, min_level: 2 }] })}, 3, now() - make_interval(days => ${k}))`;
      }
    }
    await sql`select private.uni_stats_compute(${nutech})`.catch((e) => log("uni_stats", e.message));

    // ================= Screens ================================================================
    const sp = await studentPage(browser, ayesha);
    await sp.goto("/feed");
    await expect(sp.getByTestId("post").first()).toBeVisible();
    await snap(sp, "01-feed");
    await snap(sp, "01-feed-full", { full: true });
    await sp.goto(`/ventures/${lab}`);
    await snap(sp, "02-venture");
    await sp.goto(`/ventures/${lab}/contributions`);
    await snap(sp, "03-contributions");
    await sp.goto(`/ventures/${lab}/team`);
    await snap(sp, "04-team");
    await sp.goto("/me/skills");
    await snap(sp, "05-skills");
    await snap(sp, "05-skills-full", { full: true });
    await sp.goto(`/profile/${ayesha.username}`);
    await snap(sp, "06-profile");
    await snap(sp, "06-profile-full", { full: true });
    await sp.goto("/me/score");
    await snap(sp, "07-score");
    await snap(sp, "07-score-full", { full: true });
    await sp.goto("/leaderboard");
    await snap(sp, "08-leaderboard");
    await sp.goto("/me/cv");
    await snap(sp, "09-cv");
    await snap(sp, "09-cv-full", { full: true });
    await sp.goto("/me");
    await snap(sp, "10-me");
    await sp.goto("/explore");
    await snap(sp, "11-explore");

    const anon = await (await browser.newContext({ viewport: VIEW, deviceScaleFactor: 2, colorScheme: "light" })).newPage();
    await anon.goto(`/verify/${cvCode}`);
    await snap(anon, "12-verify");
    await snap(anon, "12-verify-full", { full: true });

    const phone = await studentPage(browser, ayesha, true);
    for (const [p, n] of [["/feed", "p-feed"], ["/me/skills", "p-skills"], ["/me/score", "p-score"], ["/me/cv", "p-cv"], [`/ventures/${lab}`, "p-venture"], [`/ventures/${lab}/contributions`, "p-contrib"], [`/ventures/${lab}/team`, "p-team"], ["/leaderboard", "p-leaderboard"]] as const) {
      await phone.goto(p);
      await snap(phone, n);
    }

    const anonPhone = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, colorScheme: "light" })).newPage();
    await anonPhone.goto(`/verify/${cvCode}`);
    await snap(anonPhone, "p-verify");

    const tp = await studentPage(browser, teacher, false, PORTAL);
    await tp.goto("/teach");
    await snap(tp, "20-teach-home");
    await snap(tp, "20-teach-home-full", { full: true });
    await tp.goto("/teach/reviews");
    await snap(tp, "21-teach-reviews");
    await tp.goto("/teach/ideas");
    await snap(tp, "22-teach-ideas");
    await tp.goto(`/teach/ventures/${rides}`);
    await snap(tp, "23-teach-venture");

    const rp = await withTwoFactor(browser, recruiter);
    await rp.goto("/recruit");
    await snap(rp, "30-recruit-home");
    await rp.goto("/recruit/search?skills=react:2");
    await snap(rp, "31-recruit-search-react");
    await rp.goto("/recruit/search?skills=react:3,postgresql:2");
    await snap(rp, "31-recruit-search-react3");
    await rp.goto("/recruit/search");
    await snap(rp, "31-recruit-search");
    await snap(rp, "31-recruit-search-full", { full: true });
    await rp.goto(`/recruit/candidates/${ayesha.id}`);
    await snap(rp, "32-recruit-candidate");
    await snap(rp, "32-recruit-candidate-full", { full: true });
    await rp.goto("/recruit/analytics");
    await snap(rp, "33-recruit-analytics");

    const up = await withTwoFactor(browser, uniAdmin);
    await up.goto("/uni");
    await snap(up, "40-uni-home");
    await snap(up, "40-uni-home-full", { full: true });
    for (const area of ["adoption", "skills", "tiers", "activity", "skills_gap"]) {
      await up.goto(`/uni/dashboard/${area}`);
      await snap(up, `41-uni-dash-${area}`);
    }
    await up.goto("/uni/students");
    await snap(up, "42-uni-students");

    await writeFile(path.join(OUT, "meta.json"), JSON.stringify({ cvCode, ayesha: ayesha.username, lab, rides, crops }, null, 2));
  } finally {
    await sql.end();
  }
});

function saadOr(people: TestStudent[]): TestStudent {
  return people.find((p) => p.fullName === "Saad Qamar")!;
}
