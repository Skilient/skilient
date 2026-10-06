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
    await adminClient().from("posts").delete().in("author_id", [me.id, ...people.map((p) => p.id)]);
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
