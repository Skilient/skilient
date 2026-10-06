import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type postgres from "postgres";
import { adminClient, createStudent, type TestStudent } from "../e2e/support";

/**
 * Sample content for the student-portal Figma captures (decisions 2026-10-06): fictional NUTECH
 * classmates, friends and requests, posts with comments, a venture with its team, roles, updates,
 * contributions and group chat, a direct message thread, skills and an endorsement. Local stack
 * only. Each step is best-effort: a step that a limit or a schema change refuses is logged and
 * skipped, so the captures still run.
 */
type Sql = ReturnType<typeof postgres>;

async function as(user: TestStudent): Promise<SupabaseClient> {
  const url = process.env.E2E_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const api = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  const { error } = await api.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw new Error(`sign in ${user.fullName}: ${error.message}`);
  return api;
}

async function step(name: string, run: () => Promise<unknown>) {
  try {
    await run();
  } catch (err) {
    console.warn(`seed-student: ${name} skipped: ${String(err).slice(0, 200)}`);
  }
}

async function rpc<T>(api: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await api.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}

const TIPS = ["opportunities", "venture", "cv", "score", "privacy"];

export async function seedStudentWorld(sql: Sql, me: TestStudent, tag: string) {
  const names = ["Bilal Ahmed", "Mariam Javed", "Hamza Khan", "Zainab Qureshi", "Usman Tariq", "Hira Baig"];
  const people: TestStudent[] = [];
  for (const fullName of names) people.push(await createStudent({ domain: "nutech.edu.pk", fullName }));
  const [bilal, mariam, hamza, zainab, usman, hira] = people;

  // Readable usernames instead of the e2e ones, so profile URLs and mentions look real.
  for (const p of [me, ...people]) {
    const handle = `${p.fullName.split(" ")[0].toLowerCase()}_${tag}`;
    await sql`update public.profiles set username = ${handle}, headline = ${"CS student at NUTECH"} where user_id = ${p.id}`.catch(() =>
      sql`update public.profiles set username = ${handle} where user_id = ${p.id}`,
    );
    p.username = handle;
  }
  await sql`insert into public.tips_seen (user_id, tip_id) select ${me.id}, t from unnest(${TIPS}::text[]) t on conflict do nothing`;

  const api = new Map<string, SupabaseClient>();
  const client = async (u: TestStudent) => api.get(u.id) ?? api.set(u.id, await as(u)).get(u.id)!;

  // Friends: three accepted, one request received, one sent. Written directly: the request RPC is rate limited.
  await step("friends", async () => {
    for (const f of [bilal, mariam, hamza]) {
      const [a, b] = me.id < f.id ? [me.id, f.id] : [f.id, me.id];
      await sql`insert into public.friendships (user_id_a, user_id_b) values (${a}, ${b}) on conflict do nothing`;
    }
  });
  await step("friend request received", async () => {
    await sql`insert into public.friend_requests (sender_id, receiver_id) values (${zainab.id}, ${me.id}) on conflict do nothing`;
  });
  await step("friend request sent", async () => {
    await sql`insert into public.friend_requests (sender_id, receiver_id) values (${me.id}, ${usman.id}) on conflict do nothing`;
  });

  // Skills: what the profile, /me/skills and the CV show.
  await step("skills", async () => {
    const mine: [string, number, number, number][] = [
      ["react", 3, 41, 9],
      ["typescript", 3, 38, 7],
      ["postgresql", 2, 22, 4],
      ["nodejs", 2, 19, 3],
      ["tailwindcss", 1, 8, 2],
    ];
    for (const [skill, level, days, repos] of mine) {
      await sql`insert into public.user_skills (user_id, skill_id, level, active_days, lines, hits, repos, last_used_at)
                values (${me.id}, ${skill}, ${level}, ${days}, ${days * 140}, ${days * 3}, ${repos}, now() - interval '2 days')
                on conflict (user_id, skill_id) do update set level = excluded.level, active_days = excluded.active_days, repos = excluded.repos`;
    }
    for (const [i, p] of people.entries()) {
      await sql`insert into public.user_skills (user_id, skill_id, level, active_days, repos, last_used_at)
                values (${p.id}, ${["react", "python", "nextjs", "postgresql", "nodejs", "django"][i]}, ${1 + (i % 3)}, ${10 + i * 4}, ${1 + i}, now())
                on conflict do nothing`;
    }
  });

  // Posts and comments in the university feed.
  const posts: string[] = [];
  await step("posts", async () => {
    // Earlier runs' sample posts would show up twice.
    for (const start of ["Our React build took", "Shipped: our lab booking app", "Looking for one designer for a campus", "Wrote up how we model lab slots", "Anyone else preparing for the systems design"]) {
      await adminClient().from("posts").delete().like("body", `${start}%`);
    }
    const write = async (u: TestStudent, body: string, audience = "university") =>
      posts.push(await rpc<string>(await client(u), "create_post", { p: { type: "general", audience, body, media: [] } }));
    await write(hira, "Our React build took 4 minutes. Caching dependencies in CI and splitting out the admin pages got it to 40 seconds. Config diff is in our repo.");
    await write(usman, "Shipped: our lab booking app is live for second-year CS students. Thanks to everyone who tested it in the last two weeks.");
    await write(mariam, "Looking for one designer for a campus food-ordering project. We have the backend done and need help with the ordering flow.");
    await write(me, "Wrote up how we model lab slots in Postgres with exclusion constraints, so two bookings can never overlap. Happy to walk anyone through it.");
    await write(bilal, "Anyone else preparing for the systems design midterm? Sharing my notes on caching and queues in the department group.", "global");
  });
  await step("comments", async () => {
    if (!posts[3]) return;
    for (const [u, body] of [
      [bilal, "This saved us a week on the room booking project. Thanks for writing it up."],
      [mariam, "Could you share the migration? We have the same problem with tutoring slots."],
    ] as const) {
      await sql`insert into public.post_comments (post_id, author_id, body) values (${posts[3]}, ${u.id}, ${body})`;
    }
  });

  // A venture led by the student, with a team, open roles, updates and contributions.
  let ventureId = "";
  let myCode = "";
  await step("venture", async () => {
    const [{ university_id }] = await sql`select university_id from public.profiles where user_id = ${me.id}`;
    await sql`delete from public.ventures where title = 'Lab booking for CS students'`;
    const [v] = await sql`
      insert into public.ventures (type, owner_id, university_id, title, description, status, skill_ids, team_size)
      values ('project', ${me.id}, ${university_id}, 'Lab booking for CS students',
              'Students book lab machines and see what is free right now. Built with the CS department; used by second-year students.',
              'in_progress', array['react', 'postgresql', 'nodejs'], 6)
      returning id::text`;
    ventureId = v.id;
    await sql`insert into public.venture_members (venture_id, user_id, team_role) values (${v.id}, ${me.id}, 'lead') on conflict do nothing`;
    for (const [u, role] of [[bilal, "developer"], [mariam, "designer"], [hamza, "developer"]] as const) {
      await sql`insert into public.venture_members (venture_id, user_id, team_role) values (${v.id}, ${u.id}, ${role}) on conflict do nothing`;
    }
    await sql`insert into public.venture_roles (venture_id, title, skill_ids, slots, filled) values
      (${v.id}, 'Backend developer', array['postgresql', 'nodejs'], 1, 0),
      (${v.id}, 'QA and testing', array['playwright'], 1, 0)`;
  });
  await step("venture updates", async () => {
    if (!ventureId) return;
    await rpc(await client(me), "post_venture_update", { p_venture: ventureId, p_body: "Booking conflicts are gone: slots now use an exclusion constraint. Next up is the lab dashboard for TAs." });
    await rpc(await client(me), "post_venture_update", { p_venture: ventureId, p_body: "First 120 bookings this week. Mariam's new booking flow cut the average time to book from 90 to 25 seconds." });
  });
  await step("contributions", async () => {
    if (!ventureId) return;
    const log = async (u: TestStudent, kind: string, description: string, hours: number) => {
      const [row] = await sql`insert into public.contributions (venture_id, user_id, kind, description, hours)
                              values (${ventureId}, ${u.id}, ${kind}, ${description}, ${hours}) returning id`;
      return row.id as string;
    };
    const a = await log(me, "code", "Booking API with overlap checks and the slot calendar", 14);
    myCode = a;
    // An endorsement cites an entry that shows the skill.
    await sql`update public.contributions set skill_ids = array['react', 'postgresql'] where id = ${a}`;
    const b = await log(mariam, "design", "Booking flow redesign and usability test with 8 students", 9);
    const c = await log(bilal, "code", "Admin pages for lab assistants", 6);
    await log(hamza, "docs", "Setup guide and API reference", 3);
    for (const [entry, by] of [[a, bilal], [a, mariam], [b, me], [c, me]] as const) {
      await sql`insert into public.contribution_confirmations (contribution_id, confirmer_id) values (${entry}, ${by.id}) on conflict do nothing`;
    }
  });

  // Chats: a direct thread and the venture's group chat.
  await step("dm", async () => {
    const thread = await rpc<string>(await client(me), "get_or_create_dm", { p_username: bilal.username });
    const lines: [TestStudent, string][] = [
      [bilal, "Are we still meeting in the lab at 3?"],
      [me, "Yes. I'll bring the slot calendar changes so we can test them on the lab machines."],
      [bilal, "Great. I fixed the admin table sorting, will push before then."],
      [me, "Perfect, see you there."],
    ];
    for (const [u, body] of lines) await rpc(await client(u), "send_message", { p_thread: thread, p_body: body });
  });
  await step("group chat", async () => {
    if (!ventureId) return;
    const [t] = await sql`select id::text from public.chat_threads where venture_id = ${ventureId} limit 1`;
    if (!t) return;
    for (const [u, body] of [
      [mariam, "New booking flow is ready for review. Link in the deliverables tab."],
      [hamza, "Docs for the API are up too."],
      [me, "Thanks both, I'll review tonight."],
    ] as const) await sql`insert into public.chat_messages (thread_id, sender_id, body) values (${t.id}, ${u.id}, ${body})`;
  });

  // An endorsement from a teammate, on a skill used in the venture.
  await step("endorsement", async () => {
    if (!ventureId) return;
    await rpc(await client(bilal), "endorse", { p_endorsee: me.id, p_venture: ventureId, p_items: [{ skill: "react", evidence: myCode }], p_note: "Built the whole booking calendar and reviewed every PR." });
  });

  // Rank and tier for the score, leaderboard and profile badges.
  await step("ranking", () => sql`select private.ranking_run_all(now())`);
  return { people, ventureId };
}

interface Others {
  recruiter: TestStudent;
  teacher: TestStudent;
  admin: TestStudent;
  uniOwner: TestStudent;
  uniId: string;
}

/**
 * Slice 4 (decisions 2026-10-06): what the student's Opportunities, Events, Fairs, Competitions,
 * Ideas, code check, moderation, appeals, feedback and billing pages show. Same best-effort rule.
 */
export async function seedStudentOpportunities(sql: Sql, me: TestStudent, o: Others, people: TestStudent[]) {
  const [bilal] = people;
  const api = await as(me);
  const [{ org_id: org }] = await sql`select org_id::text from public.org_members where user_id = ${o.recruiter.id}`;
  const desc = (s: string) => `${s} You will work with a small product team, ship to real users every week and get a mentor for your first three months.`;

  // Jobs from the recruiter's organisation, one applied to.
  const jobs: string[] = [];
  await step("jobs", async () => {
    for (const [title, type, min, max, loc, remote] of [
      ["Frontend Engineering Intern", "internship", 60000, 80000, "Lahore", false],
      ["Junior Backend Developer (Node.js)", "full_time", 150000, 220000, "Islamabad", true],
      ["Data Analyst, Part-time", "part_time", 70000, 90000, "Lahore", false],
    ] as const) {
      const [j] = await sql`insert into public.job_posts (org_id, created_by, title, type, location, remote, salary_min, salary_max, currency, pay_period, min_skill_levels, openings, deadline, description, status, published_at)
        values (${org}, ${o.recruiter.id}, ${title}, ${type}, ${loc}, ${remote}, ${min}, ${max}, 'PKR', 'month', '[]', 2, current_date + 21,
                ${desc(`Northwind Labs is hiring a ${title.toLowerCase()} to build tools used by clinics across Punjab.`)}, 'live', now() - interval '2 days')
        returning id::text`;
      jobs.push(j.id);
    }
  });
  await step("application", async () => {
    if (!jobs[0]) return;
    await rpc(api, "apply_to_job", { p_job: jobs[0], p_note: "I built the booking calendar for our lab app in React and would love to do more frontend work." }).catch(() =>
      sql`insert into public.job_applications (job_id, student_id, note) values (${jobs[0]}, ${me.id}, 'I built the booking calendar for our lab app in React.')`,
    );
    await sql`update public.job_applications set stage = 'interview', stage_changed_at = now() where job_id = ${jobs[0]} and student_id = ${me.id}`;
  });
  await step("contact request", async () => {
    await sql`insert into public.contact_requests (org_id, recruiter_id, student_id, role_title, message, expires_at)
      values (${org}, ${o.recruiter.id}, ${me.id}, 'Frontend Engineer',
              'Hi Ayesha, we saw your lab booking work and your React proofs. We are hiring for our clinic scheduling team and would like to talk.',
              now() + interval '7 days')`;
  });

  // A live competition from the organisation.
  await step("competition", async () => {
    await sql`insert into public.competitions (org_id, created_by, title, role, skills, brief, starts_at, ends_at, team_size, prize, rubric, status)
      values (${org}, ${o.recruiter.id}, 'Clinic queue challenge', 'Frontend Developer', '[{"skill":"react","min_level":2}]',
              ${"Build a patient queue screen for a small clinic: patients check in on a tablet, staff call the next patient, and the waiting room display updates without a refresh. Judged on usability, code quality and how well it works offline."},
              now() - interval '2 days', now() + interval '12 days', 2, 'PKR 100,000 and an internship interview',
              '[{"criterion":"Usability","weight":40},{"criterion":"Code quality","weight":35},{"criterion":"Offline behaviour","weight":25}]', 'live')`;
  });

  // University events: one the student registered for, one open, one past.
  await step("events", async () => {
    const rows = [
      ["Intro to system design", "talk", "4 days", "CS Auditorium, NUTECH"],
      ["React performance workshop", "workshop", "9 days", "Lab 3, Block B"],
      ["Spring hackathon kickoff", "hackathon", "-12 days", "Main hall"],
    ] as const;
    for (const [title, type, at, loc] of rows) {
      const [e] = await sql`insert into public.events (university_id, created_by, type, title, description, starts_at, ends_at, location, capacity)
        values (${o.uniId}, ${o.uniOwner.id}, ${type}, ${title}, ${`${title} for NUTECH students. Bring a laptop; seats are limited.`},
                now() + ${at}::interval, now() + ${at}::interval + interval '2 hours', ${loc}, 120) returning id::text`;
      if (type !== "workshop") await sql`insert into public.event_registrations (event_id, user_id, checked_in_at) values (${e.id}, ${me.id}, ${type === "hackathon" ? sql`now() - interval '12 days'` : null}) on conflict do nothing`;
    }
  });

  // A job fair with the organisation's booth.
  await step("job fair", async () => {
    const [f] = await sql`insert into public.job_fairs (university_id, title, description, starts_at, ends_at, status, created_by)
      values (${o.uniId}, 'NUTECH Spring Career Fair', 'Meet 20 companies hiring interns and graduates. Join a booth queue from your phone.',
              now() + interval '6 days', now() + interval '6 days 6 hours', 'published', ${o.uniOwner.id}) returning id::text`;
    await sql`insert into public.job_fair_booths (fair_id, org_id, roles, about) values (${f.id}, ${org}, array['Frontend intern', 'Backend developer'], 'Clinic software used in 40 hospitals.')`;
  });

  // A project idea from the teacher.
  await step("project idea", async () => {
    await sql`insert into public.project_ideas (teacher_id, university_id, title, brief, skills, difficulty, team_size, duration_weeks, deliverables, max_teams, deadline, course_label)
      values (${o.teacher.id}, ${o.uniId}, 'Library seat finder',
              'Students waste time looking for free seats in the library. Build a small app that shows free seats from a door counter and lets students hold a seat for 15 minutes.',
              array['react', 'nodejs', 'postgresql'], 'intermediate', 3, 8, 'Working app, a short demo video script and a one-page report.', 4, current_date + 30, 'CS-341 Web Engineering')`;
  });

  // A graded code check.
  await step("code check", async () => {
    await sql`insert into public.code_checks (user_id, skill_id, status, path, start_line, end_line, answers, rubric, feedback, requested_at, started_at, submitted_at, graded_at, grader_id)
      values (${me.id}, 'react', 'passed', 'src/components/SlotCalendar.tsx', 42, 88,
              ${sql.json({ what: "It renders the week's lab slots and greys out the ones already booked.", why: "Booked slots come from one query keyed by week, so switching weeks doesn't refetch every slot.", change: "Pass the lab id into the query key and filter the slots by lab before rendering." })},
              ${sql.json({ behaviour: { pass: true }, design: { pass: true, comment: "Good reason for the query key." }, change: { pass: true }, accuracy: { pass: true } })},
              'Clear answers that match the code. Well done.', now() - interval '6 days', now() - interval '6 days', now() - interval '6 days', now() - interval '3 days', ${o.admin.id})`;
  });

  // A post of the student's that was reported and removed, with an appeal.
  await step("moderation", async () => {
    // Written directly: create_post allows one post every 30 seconds.
    const [{ id: post }] = await sql`insert into public.posts (author_id, university_id, audience, type, body)
      select ${me.id}, university_id, 'university', 'general', 'Selling my old Casio fx-991 calculator, DM me. Also have notes for every CS course for sale.'
      from public.profiles where user_id = ${me.id} returning id::text`;
    const bApi = await as(bilal);
    await rpc(bApi, "submit_report", { p_type: "post", p_target: post, p_reason: "spam", p_detail: "Selling things in the course feed." });
    const [c] = await sql`select id::text from public.report_cases where target_id = ${post}`;
    await sql`update public.report_cases set status = 'removed', resolved_by = ${o.admin.id}, resolved_at = now(), resolution_reason = 'Buying and selling isn''t allowed in the university feed.' where id = ${c.id}`;
    await sql`update public.posts set removed_at = now() where id = ${post}`;
    await rpc(api, "submit_appeal", { p_type: "report_case", p_id: c.id, p_body: "The calculator was for a classmate who asked in our group. I didn't know selling wasn't allowed; I'd like the notes part restored." });
  });

  await step("feedback", async () => {
    await rpc(api, "submit_feedback", { p_type: "idea", p_body: "It would help to see which labs are free right now from the Explore page.", p_screenshot: null, p_page: "/explore", p_device: "desktop", p_version: "1.0" });
    await sql`update public.feedback set status = 'planned', staff_reply = 'Thanks Ayesha, this is on our list for the next release.', replied_at = now() where user_id = ${me.id}`;
  });

  await step("checkout", () => rpc(api, "create_checkout", { p_subject: "user", p_plan: "student_pro_monthly", p_currency: "PKR", p_gateway: "simulated", p_key: `figma-${me.id}` }));
}

/**
 * Slice 5 (decisions 2026-10-06): the teacher's world. Dr Farah Naqvi supervises the lab booking
 * venture, has an open and a finished review, grades React and TypeScript code checks, judges a
 * university hackathon and has three project ideas. Same best-effort rule.
 */
export async function seedTeacherWorld(sql: Sql, me: TestStudent, o: Others, people: TestStudent[], ventureId: string) {
  const [bilal, mariam, hamza] = people;
  const t = o.teacher;

  await step("teacher settings", () =>
    sql`insert into public.teacher_settings (user_id, grading_opt_in, weekly_grading_cap, grading_skills, digest)
        values (${t.id}, true, 5, array['react', 'typescript'], true)
        on conflict (user_id) do update set grading_opt_in = true, grading_skills = array['react', 'typescript']`,
  );

  await step("more ideas", async () => {
    for (const [title, brief, skills, difficulty, status] of [
      ["Attendance from QR codes", "Lecturers waste the first ten minutes on attendance. Build a QR check-in that rotates every 30 seconds and exports to the university portal.", ["react", "nodejs"], "intro", "open"],
      ["Past paper search", "A searchable archive of past exam papers by course and topic, with a moderation step before anything is published.", ["python", "postgresql"], "advanced", "closed"],
    ] as const) {
      await sql`insert into public.project_ideas (teacher_id, university_id, title, brief, skills, difficulty, team_size, duration_weeks, deliverables, max_teams, status, created_at)
        values (${t.id}, ${o.uniId}, ${title}, ${brief}, ${skills as unknown as string[]}, ${difficulty}, 3, 6, 'Working app and a short report.', 3, ${status}, now() - interval '20 days')`;
    }
  });

  // Supervision of the student's venture, with comments.
  await step("supervision", async () => {
    if (!ventureId) return;
    await sql`insert into public.venture_supervisors (venture_id, teacher_id, status, invited_by, started_at)
      values (${ventureId}, ${t.id}, 'active', ${me.id}, now() - interval '25 days')`;
    for (const [who, body] of [
      [t, "Good progress on the overlap check. Before the TA dashboard, please add a short test plan to the deliverables."],
      [me, "Thanks, Dr Naqvi. Test plan is up; we'll start the dashboard next week."],
    ] as const) await sql`insert into public.supervisor_comments (venture_id, author_id, body) values (${ventureId}, ${who.id}, ${body})`;
  });

  // A second venture with a finished review, then the open request on the student's venture.
  await step("reviews", async () => {
    const [{ university_id }] = await sql`select university_id from public.profiles where user_id = ${mariam.id}`;
    const [v] = await sql`insert into public.ventures (type, owner_id, university_id, title, description, status, skill_ids, team_size, created_at)
      values ('project', ${mariam.id}, ${university_id}, 'Campus food ordering', 'Order from the campus cafes ahead of time and pick up between classes.',
              'in_progress', array['react', 'nodejs'], 4, now() - interval '60 days') returning id::text`;
    for (const [u, role] of [[mariam, "lead"], [hamza, "developer"]] as const)
      await sql`insert into public.venture_members (venture_id, user_id, team_role) values (${v.id}, ${u.id}, ${role}) on conflict do nothing`;
    const [done] = await sql`insert into public.review_requests (venture_id, teacher_id, requested_by, status, due_at, closed_at, created_at)
      values (${v.id}, ${t.id}, ${mariam.id}, 'submitted', now() - interval '10 days', now() - interval '12 days', now() - interval '20 days') returning id::text`;
    await sql`insert into public.venture_reviews (request_id, venture_id, teacher_id, rubric, comments, average, created_at)
      values (${done.id}, ${v.id}, ${t.id}, ${sql.json({ scope: 4, technical: 4, collaboration: 5, documentation: 3, outcome: 4 })},
              'Solid scope and a working pickup flow. The README needs setup steps before anyone else can run it.', 4.0, now() - interval '12 days')`;
    if (ventureId)
      await sql`insert into public.review_requests (venture_id, teacher_id, requested_by, status, due_at)
        values (${ventureId}, ${t.id}, ${me.id}, 'open', now() + interval '9 days')`;
  });

  // A TypeScript check waiting for this teacher, and the student's React check graded by them.
  await step("code checks to grade", async () => {
    await sql`update public.code_checks set grader_id = ${t.id} where user_id = ${me.id} and status = 'passed'`;
    await sql`insert into public.code_checks (user_id, skill_id, status, path, start_line, end_line, answers, requested_at, started_at, submitted_at, due_at, claimed_by, claimed_at)
      values (${bilal.id}, 'typescript', 'submitted', 'src/admin/BookingTable.tsx', 12, 64,
              ${sql.json({ what: "It sorts the booking table by any column and keeps the sort in the URL.", why: "Keeping the sort in the URL means the TA can share a sorted view; the alternative was component state.", change: "Add a lab filter next to the sort and read both from the query string." })},
              now() - interval '2 days', now() - interval '2 days', now() - interval '1 day', now() + interval '2 days', ${t.id}, now() - interval '3 hours')`;
  });

  // A university hackathon this teacher judges, with two submitted teams.
  await step("judging", async () => {
    const [c] = await sql`insert into public.competitions (host_type, university_id, created_by, title, role, skills, brief, starts_at, ends_at, team_size, prize, rubric, status)
      values ('university', ${o.uniId}, ${o.uniOwner.id}, 'NUTECH Spring Hackathon', 'Full-stack developer', '[{"skill":"react","min_level":1}]',
              ${"Build something that makes campus life easier in 48 hours: queues, bookings, lost and found, anything students complain about. Teams of up to three; submit a public GitHub repo."},
              now() - interval '4 days', now() - interval '2 days', 3, 'PKR 50,000 and a featured spot on the university page',
              '[{"criterion":"Usefulness","weight":40},{"criterion":"Technical quality","weight":40},{"criterion":"Presentation","weight":20}]', 'frozen') returning id::text`;
    await sql`insert into public.competition_judges (competition_id, teacher_id) values (${c.id}, ${t.id})`;
    for (const [name, lead, mates, repo] of [
      ["Queue Busters", me, [bilal], "https://github.com/queue-busters/cafe-queue"],
      ["Lost & Found", mariam, [hamza], "https://github.com/lostfound-nutech/finder"],
    ] as const) {
      const [team] = await sql`insert into public.competition_teams (competition_id, name, lead_id, repo_url, submitted_at)
        values (${c.id}, ${name}, ${lead.id}, ${repo}, now() - interval '2 days 2 hours') returning id::text`;
      for (const s of [lead, ...mates])
        await sql`insert into public.competition_team_members (team_id, competition_id, student_id, status) values (${team.id}, ${c.id}, ${s.id}, 'joined')`;
    }
  });
}
