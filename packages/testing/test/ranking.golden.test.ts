/**
 * Ranking golden recordings (W6). Records what the current stack (local Supabase) returns for the ported ranking
 * functions, so the W6 service can be held to the same results. The sheet is docs/azure/ranking-function-bins.md.
 *
 *   GOLDEN_STACK_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres GOLDEN_RECORD=1 pnpm exec vitest run test/ranking.golden.test.ts
 *
 * Without GOLDEN_RECORD it compares the stack with the files. Without GOLDEN_STACK_DB_URL the file is skipped.
 * Every case builds the reference world (test/fixtures/ranking-reference.ts: the students of pgTAP 32 with
 * fixture ids, `.test` domains and fixture names) in its own transaction, which is rolled back.
 */
import { join } from "node:path";
import type postgres from "postgres";
import { describe, expect, it } from "vitest";
import { actAs, assertLocalStack, attempt, callCurrentStackSql, golden, type SqlOutcome, type StackActor } from "../src/golden";
import * as F from "./fixtures/ranking-reference";

const DB = process.env["GOLDEN_STACK_DB_URL"];
if (DB !== undefined) assertLocalStack(DB);
const DIR = join(import.meta.dirname, "golden", "ranking");

type Tx = postgres.TransactionSql;
type Row = Record<string, unknown>;
const OWNER: StackActor = { role: "postgres" };
const ANON: StackActor = { role: "anon", claims: { role: "anon" } };
const byId = new Map(F.STUDENTS.map((s) => [s.id, s]));
export function as(user: string, aal: "aal1" | "aal2" = "aal1"): StackActor {
  return { role: "authenticated", claims: { sub: user, role: "authenticated", aal, email: F.emailOf(byId.get(user)!) } };
}

// ---------------------------------------------------------------------------
// The world on the stack
// ---------------------------------------------------------------------------
async function insertUsers(tx: Tx): Promise<void> {
  for (const s of F.STUDENTS)
    await tx.unsafe(
      `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
       values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2, '', now() - interval '400 days',
               '{"provider":"email","providers":["email"]}'::jsonb, $3::text::jsonb, now() - interval '400 days', now())`,
      [s.id, F.emailOf(s), JSON.stringify({ full_name: F.nameOf(s) })],
    );
  for (const s of F.STUDENTS) {
    await tx.unsafe(
      `update public.profiles set username = $2, department = $3, graduation_year = $4, visibility = 'university', onboarding_complete = true where user_id = $1`,
      [s.id, F.usernameOf(s), s.department, s.batch],
    );
    await tx.unsafe(`update public.onboarding_state set step = 6, completed_at = now() where user_id = $1`, [s.id]);
  }
}

const venture = (tx: Tx, v: F.Venture) =>
  tx.unsafe(
    `insert into public.ventures (id, type, owner_id, university_id, title, description, status, skill_ids, created_at)
     select $1, 'project', $2, p.university_id, $3, 'Reference venture', 'in_progress', $4::text[], $5::timestamptz from public.profiles p where p.user_id = $2`,
    [v.id, v.owner, v.title, v.skills, F.pkt(v.created)],
  );

async function ventures(tx: Tx, list: F.Venture[]): Promise<void> {
  for (const v of list) {
    await venture(tx, v);
    if (v.status === "recruiting") await tx.unsafe(`update public.ventures set status = 'recruiting' where id = $1`, [v.id]);
    for (const m of v.members) await tx.unsafe(`insert into public.venture_members (venture_id, user_id) values ($1, $2)`, [v.id, m]);
    for (let i = 1; i <= v.deliverables; i++)
      await tx.unsafe(`insert into public.venture_deliverables (venture_id, label, url) values ($1, $2, $3)`, [v.id, `Link ${i}`, `https://ref-${v.id.slice(-4)}.example/${i}`]);
  }
}

export async function seed(tx: Tx, options: { extras?: boolean } = {}): Promise<void> {
  for (const u of F.UNIVERSITIES) {
    await tx.unsafe(`insert into public.universities (id, name, slug, live_at) values ($1, $2, $3, now() - interval '400 days')`, [u.id, u.name, u.slug]);
    await tx.unsafe(`insert into public.university_domains (university_id, domain, kind, source) values ($1, $2, 'both', 'ops')`, [u.id, u.domain]);
  }
  await insertUsers(tx);
  await ventures(tx, F.VENTURES);
  for (const x of F.ENTRIES)
    await tx.unsafe(
      `insert into public.contributions (id, venture_id, user_id, kind, description, source, commit_sha, created_at)
       values ($1, $2, $3, 'code', $4, $5::public.contribution_source, $6, $7::timestamptz)`,
      [F.fid(x.tag), x.venture, x.author, `Reference entry ${x.tag}`, x.source, x.source === "github" ? F.shaOf(x.tag) : null, F.pkt(x.at)],
    );
  for (const x of F.ENTRIES.filter((y) => y.confirmer))
    await tx.unsafe(`insert into public.contribution_confirmations (contribution_id, confirmer_id, created_at) values ($1, $2, $3::timestamptz)`, [
      F.fid(x.tag),
      x.confirmer,
      F.pkt(x.confirmedAt!),
    ]);
  for (const v of F.VENTURES.filter((y) => y.completed))
    await tx.unsafe(`update public.ventures set status = 'completed', completed_at = $2::timestamptz where id = $1`, [v.id, F.pkt(v.completed!)]);
  // Completion posts "Shipped" with today's date; the reference dates everything by hand.
  await tx.unsafe(`delete from public.posts where type = 'shipped' and venture_id = any($1::uuid[])`, [F.VENTURES.map((v) => v.id)]);

  for (const p of F.PULL_REQUESTS)
    await tx.unsafe(
      `insert into public.github_pull_requests (user_id, repo_github_id, number, pr_github_id, repo_full_name, repo_private, merged_at, approver_github_id, counted, exclusion)
       values ($1, $2, $3, $4, $5, false, $6::timestamptz, $7, $8, $9)`,
      [p.user, p.repoId, p.number, p.prId, p.repo, F.pkt(p.mergedAt), p.counted ? 77 : null, p.counted, p.counted ? null : "own_repo"],
    );

  const [q] = await tx.unsafe(`select min(id) as id from public.micro_survey_questions where dimension = 'informative'`);
  for (const p of F.POSTS) {
    await tx.unsafe(
      `insert into public.posts (id, author_id, university_id, audience, type, body, created_at)
       select $1, $2, p.university_id, 'university', 'general', $3, $4::timestamptz from public.profiles p where p.user_id = $2`,
      [F.fid(p.tag), p.author, `Reference post ${p.tag}`, F.pkt(p.at)],
    );
    for (let i = 1; i <= p.answers; i++) {
      await tx.unsafe(`insert into public.micro_survey_assignments (post_id, user_id, question_id, dimension) values ($1, $2, $3, 'informative')`, [F.fid(p.tag), F.Q(i), (q as Row)["id"] as number]);
      await tx.unsafe(
        `insert into public.micro_survey_responses (post_id, user_id, question_id, dimension, answer, latency_ms, weight, created_at, locked_at)
         values ($1, $2, $3, 'informative', $4, 1500, 1, $5::timestamptz, $5::timestamptz + interval '10 minutes')`,
        [F.fid(p.tag), F.Q(i), (q as Row)["id"] as number, F.answerOf(p, i), F.answeredAt(p)],
      );
    }
  }
  for (const [a, b] of F.FRIENDSHIPS)
    await tx.unsafe(`insert into public.friendships (user_id_a, user_id_b) values (least($1::uuid, $2::uuid), greatest($1::uuid, $2::uuid))`, [a, b]);

  for (const a of F.APPLICATIONS)
    await tx.unsafe(
      `insert into public.application_threads (id, venture_id, candidate_id, owner_id, status, message, created_at, decided_at)
       values ($1, $2, $3, $4, $5::public.application_status, 'Can I join?', $6::timestamptz, $7::timestamptz)`,
      [a.id, a.venture, a.candidate, a.owner, a.status, a.created, a.decided],
    );

  for (const c of F.CREDENTIALS)
    await tx.unsafe(
      `insert into public.credentials (id, user_id, title, issuer, issued_on, expires_on, file_path, file_type, file_bytes, status, recognised_issuer_id, reviewed_at, created_at)
       values ($1, $2, $3, 'Issuer', date '2026-01-10', $4::date, $5, 'pdf', 1000, $6::public.credential_status, $7, $8::timestamptz, $9::timestamptz)`,
      [c.id, c.user, c.title, c.expires, `${c.user}/${c.id}.pdf`, c.status, c.issuer, c.status === "pending" ? null : F.pkt("2026-02-01 10:00"), F.CREDENTIAL_CREATED],
    );

  for (const x of F.ENDORSEMENTS)
    await tx.unsafe(
      `insert into public.endorsements (id, endorser_id, endorsee_id, venture_id, skill_id, created_at, hidden, hidden_at) values ($1, $2, $3, $4, $5, $6::timestamptz, $7, $8::timestamptz)`,
      [x.id, x.endorser, x.endorsee, x.venture, x.skill, F.pkt(x.at), x.hidden, x.hidden ? F.pkt("2026-09-23 10:00") : null],
    );

  for (const p of F.PENALTIES)
    await tx.unsafe(`insert into public.ranking_adjustments (id, user_id, kind, severity, reason, created_at) values ($1, $2, 'penalty', $3, $4, $5::timestamptz)`, [
      p.id,
      p.user,
      p.severity,
      p.reason,
      F.pkt(p.at),
    ]);
  for (const x of F.EXAM_PERIODS)
    await tx.unsafe(`insert into public.exam_periods (id, university_id, starts_on, ends_on, reason) values ($1, $2, $3::date, $4::date, $5)`, [x.id, x.university, x.starts, x.ends, x.reason]);

  for (const p of F.PREVIOUS)
    await tx.unsafe(
      `insert into public.ranking_scores (user_id, formula_version, components, proof, momentum, adjustments, total, ranked, tier, momentum_peak, computed_at, published_at)
       values ($1, 1, '{}'::jsonb, 0, 0, 0, 0, $2, $3::public.ranking_tier, $4, now(), now())`,
      [p.user, p.ranked, p.tier, p.peak],
    );

  // Skill levels last: the triggers above recompute them from evidence.
  await tx.unsafe(`delete from public.user_skills where user_id = any($1::uuid[])`, [F.STUDENTS.map((s) => s.id)]);
  for (const [u, s, l] of F.SKILLS) await tx.unsafe(`insert into public.user_skills (user_id, skill_id, level) values ($1, $2, $3)`, [u, s, l]);

  // The Record (formula v2).
  await tx.unsafe(`insert into public.signing_keys (key_id, public_key, active_from, retired_at) values ('cv-20260101-0000cccc', repeat('C', 43), '2026-01-01', '2026-01-02')`);
  for (const s of F.SOCIETIES)
    await tx.unsafe(
      `insert into public.societies (id, university_id, slug, name, name_key, category, about, status, verified_at)
       values ($1, $2, $3, $4, lower($4), 'technology', 'A reference society for the ranking reference students.', 'verified', $5::timestamptz)`,
      [s.id, F.UNI_A, s.slug, s.name, F.pkt(s.verified)],
    );
  let code = 0;
  for (const r of F.RECORD)
    await tx.unsafe(
      `insert into public.record_entries (id, user_id, kind, issuer_type, issuer_id, issuer_name, source, source_id, title, evidence, occurred_on, status, code, key_id,
                                          payload, envelope_hash, signature, signed_at, revoked_at, revoked_category, revoked_reason)
       values ($1, $2, $3, $4, $5, coalesce((select name from public.societies where id = $5), 'Skilient'), $6, gen_random_uuid(), $7, $8::text::jsonb, $9::date,
               $10, $11, 'cv-20260101-0000cccc', '{}'::jsonb, repeat('a', 64), repeat('A', 86), $12::timestamptz,
               case when $10 = 'revoked' then now() end, case when $10 = 'revoked' then 'not_earned' end, case when $10 = 'revoked' then 'Reference revocation' end)`,
      [
        r.id,
        r.user,
        r.kind,
        r.society ? "society" : "skilient",
        r.society ? F.SOC(r.society) : null,
        r.kind === "office_bearer" ? "term" : r.kind === "venture_completed" ? "venture" : "event",
        `Reference ${r.kind}`,
        JSON.stringify(r.evidence),
        r.on,
        r.status,
        `93R${String(++code).padStart(7, "0")}`,
        F.signedAt(r),
      ],
    );

  if (options.extras) {
    await tx.unsafe(`update public.profiles set leaderboard_opt_out = true where user_id = $1`, [F.OPTED_OUT]);
    await tx.unsafe(`update public.profiles set status = 'graduate', graduated_at = now() - interval '13 months' where user_id = $1`, [F.GRADUATE]);
    await tx.unsafe(`update public.profiles set status = 'deleting', delete_after = now() + interval '7 days' where user_id = $1`, [F.DELETING]);
    await tx.unsafe(`insert into public.blocks (blocker_id, blocked_id) values ($1, $2)`, F.BLOCK);
    for (const s of F.SNAPSHOT_ROWS)
      await tx.unsafe(
        `insert into public.ranking_snapshots (user_id, week, formula_version, components, total, ranked, tier) values ($1, $2::date, 2, '{}'::jsonb, $3, $4, $5::public.ranking_tier)`,
        [s.user, F.LAST_WEEK, s.total, s.ranked, s.tier],
      );
  }
}

/** The ring: Q5 and Q6 endorse each other through V9 (in progress, no outside evidence). */
async function seedRing(tx: Tx): Promise<void> {
  await ventures(tx, [F.RING_VENTURE]);
  for (const x of F.RING_ENDORSEMENTS)
    await tx.unsafe(`insert into public.endorsements (id, endorser_id, endorsee_id, venture_id, skill_id, created_at) values ($1, $2, $3, $4, $5, $6::timestamptz)`, [
      x.id,
      x.endorser,
      x.endorsee,
      x.venture,
      x.skill,
      F.pkt(x.at),
    ]);
}

// ---------------------------------------------------------------------------
// Calls and reads
// ---------------------------------------------------------------------------
async function call(tx: Tx, actor: StackActor, expr: string, params: unknown[] = []): Promise<SqlOutcome<unknown>> {
  const out = await attempt(tx, async (sp) => {
    await actAs(sp, actor);
    const r = await sp.unsafe(`select ${expr} as v`, params as never[]);
    return (r[0] as Row | undefined)?.["v"] ?? null;
  });
  await actAs(tx, OWNER);
  return out;
}

async function rows(tx: Tx, actor: StackActor, text: string, params: unknown[] = []): Promise<SqlOutcome<unknown>> {
  const out = await attempt(tx, async (sp) => {
    await actAs(sp, actor);
    return [...(await sp.unsafe(text, params as never[]))];
  });
  await actAs(tx, OWNER);
  return out;
}

const runAll = async (tx: Tx, asOf: string) => ((await tx.unsafe(`select private.ranking_run_all($1::timestamptz) as v`, [asOf]))[0] as Row)["v"];

/** The published scores of every fixture student, as ranking keeps them. */
const SCORES = `select s.user_id, s.formula_version, s.components, s.proof, s.momentum, s.adjustments, s.total, s.ranked, s.tier, s.tier_met, s.percentile,
                       s.below_since::text, s.momentum_peak, s.held, s.held_total
                  from public.ranking_scores s where s.user_id = any($1::uuid[]) order by s.user_id`;
const ALL = F.STUDENTS.map((s) => s.id);
const scores = async (tx: Tx, users: string[] = ALL) => [...(await tx.unsafe(SCORES, [users]))];
const FLAGS = `select f.kind, f.user_id, f.members, f.endorsement_ids, f.detail, f.status, f.claimed_by, f.reviewed_by, f.reason, f.applied_at is not null as applied
                 from public.anti_gaming_flags f where f.members && $1::uuid[] order by f.kind, f.created_at`;
const flags = async (tx: Tx) => [...(await tx.unsafe(FLAGS, [ALL]))];
const ADJUSTMENTS = `select a.user_id, a.kind, a.severity, a.points, a.reason, a.staff_id, a.case_id, a.flag_id from public.ranking_adjustments a
                      where a.user_id = any($1::uuid[]) order by a.user_id, a.created_at`;
const AUDIT = `select l.staff_id, l.action, l.target_type, l.reason, l.before, l.after from public.ops_audit_log l where l.staff_id = $1 order by l.created_at, l.action`;

async function check(group: string, name: string, run: (tx: Tx) => Promise<unknown>, options: { extras?: boolean } = {}): Promise<void> {
  const out = await callCurrentStackSql(DB!, async (tx) => {
    await seed(tx, options);
    return run(tx);
  });
  if (!out.ok) throw new Error(`${group}/${name}: setup failed: ${out.code} ${out.message}`);
  const r = golden(join(DIR, `${group}.json`), name, out.value);
  if (r.status === "differs") expect(r.actual).toEqual(r.expected);
}

const NEXT_DAY = F.pkt("2026-12-10 12:00");
const SUNDAY = F.pkt("2026-12-13 12:00");

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------
describe.skipIf(!DB)("ranking goldens on the current stack", { timeout: 120_000 }, () => {
  it("run: the nightly run over the reference students (formula v2), completions frozen", () =>
    check("run", "reference", async (tx) => {
      const stage = await runAll(tx, F.AS_OF);
      const run = (await tx.unsafe(`select stage, held, formula_version, run_on::text from public.ranking_runs order by id desc limit 1`))[0];
      const completions = [
        ...(await tx.unsafe(
          `select c.venture_id, c.owner_id, c.team_size, c.weeks, c.skill_tags, c.deliverables, c.verified_members from public.venture_completions c where c.venture_id = any($1::uuid[]) order by c.venture_id`,
          [F.VENTURES.map((v) => v.id)],
        )),
      ];
      return { stage, run, completions, scores: await scores(tx), flags: await flags(tx) };
    }));

  it("run: a second run on a Sunday takes the weekly snapshot (and checks rapid gains against the first)", () =>
    check("run", "snapshots", async (tx) => {
      await runAll(tx, F.AS_OF);
      const stage = await runAll(tx, SUNDAY);
      const snapshots = [
        ...(await tx.unsafe(
          `select n.user_id, n.week::text, n.formula_version, n.components, n.total, n.ranked, n.tier, n.percentile from public.ranking_snapshots n where n.user_id = any($1::uuid[]) order by n.user_id`,
          [ALL],
        )),
      ];
      const after = (await scores(tx)).map((r) => {
        const x = r as Row;
        return { user_id: x["user_id"], total: x["total"], held: x["held"], held_total: x["held_total"], tier: x["tier"], tier_met: x["tier_met"], below_since: x["below_since"], percentile: x["percentile"] };
      });
      return { stage, snapshots, after, flags: await flags(tx) };
    }));

  it("boards: leaderboards by scope and filter, my place, filters; opt-out, graduate, deleting and blocked people", () =>
    check(
      "boards",
      "boards",
      async (tx) => {
        await runAll(tx, F.AS_OF);
        const board = (who: string, scope: string, dept: string | null, batch: number | null, after = 0) =>
          rows(tx, as(who), `select * from public.leaderboard($1, $2, $3::smallint, $4)`, [scope, dept, batch, after]);
        const me = (who: string, scope: string, dept: string | null, batch: number | null) => call(tx, as(who), `public.leaderboard_me($1, $2, $3::smallint)`, [scope, dept, batch]);
        return {
          university: await board(F.R(1), "university", null, null),
          university_after_3: await board(F.R(1), "university", null, null, 3),
          department: await board(F.R(1), "university", "Software Engineering", null),
          batch: await board(F.R(1), "university", null, 2027),
          department_spaces: await board(F.R(1), "university", "  ", null),
          global: await board(F.R(1), "global", null, null),
          blocker: await board(F.R(2), "university", null, null),
          other_university: await board(F.R(7), "university", null, null),
          bad_scope: await board(F.R(1), "everywhere", null, null),
          anon: await rows(tx, ANON, `select * from public.leaderboard('university', null, null, 0)`),
          me_r1: await me(F.R(1), "university", null, null),
          me_r1_global: await me(F.R(1), "global", null, null),
          me_opted_out: await me(F.OPTED_OUT, "university", null, null),
          me_unranked: await me(F.R(4), "university", null, null),
          me_graduate: await me(F.GRADUATE, "university", null, null),
          me_graduate_global: await me(F.GRADUATE, "global", null, null),
          me_department: await me(F.R(8), "university", "Software Engineering", 2028),
          filters_a: await call(tx, as(F.R(1)), `public.leaderboard_filters()`),
          filters_b: await call(tx, as(F.R(7)), `public.leaderboard_filters()`),
        };
      },
      { extras: true },
    ));

  it("boards: tiers on cards (tiers_for), signed in, blocks left out, at most 200", () =>
    check(
      "boards",
      "tiers",
      async (tx) => {
        await runAll(tx, F.AS_OF);
        const ids = [F.R(1), F.R(3), F.R(4), F.R(5), F.R(6), F.R(7), F.R(10), F.Q(1)];
        const many = Array.from({ length: 201 }, (_, i) => `93200000-0000-4000-8000-${String(900000000000 + i)}`);
        return {
          r2: await rows(tx, as(F.R(2)), `select * from public.tiers_for($1::uuid[]) order by user_id`, [ids]),
          r1: await rows(tx, as(F.R(1)), `select * from public.tiers_for($1::uuid[]) order by user_id`, [ids]),
          too_many: await rows(tx, as(F.R(1)), `select * from public.tiers_for($1::uuid[])`, [many]),
          anon: await rows(tx, ANON, `select * from public.tiers_for($1::uuid[])`, [ids]),
        };
      },
      { extras: true },
    ));

  it("boards: the score page (my_score) with its evidence names and the next tier", () =>
    check(
      "boards",
      "score",
      async (tx) => {
        await runAll(tx, F.AS_OF);
        const score = (who: string) => call(tx, as(who), `public.my_score()`);
        return {
          r1: await score(F.R(1)),
          r4: await score(F.R(4)),
          r5: await score(F.R(5)),
          r7: await score(F.R(7)),
          r10: await score(F.R(10)),
          r11: await score(F.R(11)),
          anon: await call(tx, ANON, `public.my_score()`),
          next_r6: await call(tx, OWNER, `private.next_tier_requirements($1)`, [F.R(6)]),
          next_r8: await call(tx, OWNER, `private.next_tier_requirements($1)`, [F.R(8)]),
        };
      },
      { extras: true },
    ));

  it("flags: a ring is found, reviewed by a trust reviewer (claimed, cleared), audited before and after", () =>
    check("flags", "ring", async (tx) => {
      await seedRing(tx);
      await runAll(tx, F.AS_OF);
      const found = await flags(tx);
      const [ring] = (await tx.unsafe(`select id::text from public.anti_gaming_flags where kind = 'ring' and members && $1::uuid[]`, [ALL])) as unknown as { id: string }[];
      const id = ring!.id;
      const out: Record<string, unknown> = { found, q5: await scores(tx, [F.Q(5), F.Q(6)]) };
      out["queue_not_staff"] = await rows(tx, as(F.STAFF, "aal2"), `select * from public.ranking_flag_queue('open')`);
      await tx.unsafe(`insert into public.staff_roles (user_id, role) values ($1, 'trust_reviewer')`, [F.STAFF]);
      out["queue_aal1"] = await rows(tx, as(F.STAFF), `select * from public.ranking_flag_queue('open')`);
      out["queue"] = await rows(tx, as(F.STAFF, "aal2"), `select * from public.ranking_flag_queue('open')`);
      out["case"] = await call(tx, as(F.STAFF, "aal2"), `public.ranking_flag_case($1)`, [id]);
      out["case_unknown"] = await call(tx, as(F.STAFF, "aal2"), `public.ranking_flag_case($1)`, [F.fid("nothing")]);
      out["review_unclaimed"] = await call(tx, as(F.STAFF, "aal2"), `public.review_ranking_flag($1, false, 'Looks fine')`, [id]);
      out["release_unclaimed"] = await call(tx, as(F.STAFF, "aal2"), `public.claim_ranking_flag($1, false)`, [id]);
      out["claim"] = await call(tx, as(F.STAFF, "aal2"), `public.claim_ranking_flag($1, true)`, [id]);
      out["case_claimed"] = await call(tx, as(F.STAFF, "aal2"), `public.ranking_flag_case($1)`, [id]);
      out["review_short_reason"] = await call(tx, as(F.STAFF, "aal2"), `public.review_ranking_flag($1, false, 'x')`, [id]);
      out["review"] = await call(tx, as(F.STAFF, "aal2"), `public.review_ranking_flag($1, false, ' They built it together ')`, [id]);
      out["review_again"] = await call(tx, as(F.STAFF, "aal2"), `public.review_ranking_flag($1, false, 'Again')`, [id]);
      out["reviewed"] = await rows(tx, as(F.STAFF, "aal2"), `select * from public.ranking_flag_queue('reviewed')`);
      out["flags"] = await flags(tx);
      out["audit"] = [...(await tx.unsafe(AUDIT, [F.STAFF]))];
      // The next run: cleared endorsements count again.
      await runAll(tx, NEXT_DAY);
      out["after"] = await scores(tx, [F.Q(5), F.Q(6)]);
      out["flags_after"] = await flags(tx);
      return out;
    }));

  it("flags: a member can't review their own flag; a ring upheld keeps its endorsements at 0", () =>
    check("flags", "ring_upheld", async (tx) => {
      await seedRing(tx);
      await runAll(tx, F.AS_OF);
      const [ring] = (await tx.unsafe(`select id::text from public.anti_gaming_flags where kind = 'ring' and members && $1::uuid[]`, [ALL])) as unknown as { id: string }[];
      const id = ring!.id;
      await tx.unsafe(`insert into public.staff_roles (user_id, role) values ($1, 'trust_reviewer'), ($2, 'trust_reviewer')`, [F.STAFF, F.Q(5)]);
      const out: Record<string, unknown> = {};
      out["member_claim"] = await call(tx, as(F.Q(5), "aal2"), `public.claim_ranking_flag($1, true)`, [id]);
      out["member_case"] = await call(tx, as(F.Q(5), "aal2"), `public.ranking_flag_case($1)`, [id]);
      out["claim"] = await call(tx, as(F.STAFF, "aal2"), `public.claim_ranking_flag($1, true)`, [id]);
      out["other_claim"] = await call(tx, as(F.Q(5), "aal2"), `public.claim_ranking_flag($1, true)`, [id]);
      out["release"] = await call(tx, as(F.STAFF, "aal2"), `public.claim_ranking_flag($1, false)`, [id]);
      out["claim_again"] = await call(tx, as(F.STAFF, "aal2"), `public.claim_ranking_flag($1, true)`, [id]);
      out["uphold"] = await call(tx, as(F.STAFF, "aal2"), `public.review_ranking_flag($1, true, 'Traded endorsements')`, [id]);
      out["audit"] = [...(await tx.unsafe(AUDIT, [F.STAFF]))];
      await runAll(tx, NEXT_DAY);
      out["after"] = await scores(tx, [F.Q(5), F.Q(6)]);
      out["flags_after"] = await flags(tx);
      return out;
    }));

  it("flags: a rapid gain holds the published score; upheld, it becomes a negative adjustment on the next run", () =>
    check("flags", "rapid_gain", async (tx) => {
      await tx.unsafe(
        `update public.ranking_scores set formula_version = 2, total = $2, components = '{"work": {"points": 0, "ventures": []}}'::jsonb where user_id = $1`,
        [F.RAPID_PREVIOUS.user, F.RAPID_PREVIOUS.total],
      );
      await runAll(tx, F.AS_OF);
      const out: Record<string, unknown> = { held: await scores(tx, [F.R(1)]), flags: await flags(tx) };
      out["me"] = await call(tx, as(F.R(1)), `public.leaderboard_me('university', null, null)`);
      out["board"] = await rows(tx, as(F.R(2)), `select * from public.leaderboard('university', null, null, 0)`);
      const [gain] = (await tx.unsafe(`select id::text from public.anti_gaming_flags where kind = 'rapid_gain' and user_id = $1`, [F.R(1)])) as unknown as { id: string }[];
      await tx.unsafe(`insert into public.staff_roles (user_id, role) values ($1, 'trust_reviewer')`, [F.STAFF]);
      out["queue"] = await rows(tx, as(F.STAFF, "aal2"), `select * from public.ranking_flag_queue('open')`);
      out["case"] = await call(tx, as(F.STAFF, "aal2"), `public.ranking_flag_case($1)`, [gain!.id]);
      out["claim"] = await call(tx, as(F.STAFF, "aal2"), `public.claim_ranking_flag($1, true)`, [gain!.id]);
      out["uphold"] = await call(tx, as(F.STAFF, "aal2"), `public.review_ranking_flag($1, true, 'Gain not earned')`, [gain!.id]);
      out["adjustments"] = [...(await tx.unsafe(ADJUSTMENTS, [[F.R(1)]]))];
      out["audit"] = [...(await tx.unsafe(AUDIT, [F.STAFF]))];
      await runAll(tx, NEXT_DAY);
      out["after"] = await scores(tx, [F.R(1)]);
      out["flags_after"] = await flags(tx);
      return out;
    }));

  it("flags: a cleared rapid gain counts from the next run", () =>
    check("flags", "rapid_gain_cleared", async (tx) => {
      await tx.unsafe(
        `update public.ranking_scores set formula_version = 2, total = $2, components = '{"work": {"points": 0, "ventures": []}}'::jsonb where user_id = $1`,
        [F.RAPID_PREVIOUS.user, F.RAPID_PREVIOUS.total],
      );
      await runAll(tx, F.AS_OF);
      const [gain] = (await tx.unsafe(`select id::text from public.anti_gaming_flags where kind = 'rapid_gain' and user_id = $1`, [F.R(1)])) as unknown as { id: string }[];
      await tx.unsafe(`insert into public.staff_roles (user_id, role) values ($1, 'trust_reviewer')`, [F.STAFF]);
      await call(tx, as(F.STAFF, "aal2"), `public.claim_ranking_flag($1, true)`, [gain!.id]);
      const out: Record<string, unknown> = { clear: await call(tx, as(F.STAFF, "aal2"), `public.review_ranking_flag($1, false, 'Earned it')`, [gain!.id]) };
      await runAll(tx, NEXT_DAY);
      out["after"] = await scores(tx, [F.R(1)]);
      out["flags_after"] = await flags(tx);
      return out;
    }));

  it("exams: accounts staff add, list and remove exam periods (audited); refusals", () =>
    check("exams", "staff", async (tx) => {
      const add = (actor: StackActor, uni: string, starts: string, ends: string, reason: string) =>
        call(tx, actor, `public.add_exam_period($1, $2::date, $3::date, $4)`, [uni, starts, ends, reason]);
      const staff = as(F.STAFF, "aal2");
      const out: Record<string, unknown> = {};
      out["not_staff"] = await add(staff, F.UNI_A, "2026-12-14", "2026-12-20", "Finals");
      await tx.unsafe(`insert into public.staff_roles (user_id, role) values ($1, 'accounts')`, [F.STAFF]);
      out["aal1"] = await add(as(F.STAFF), F.UNI_A, "2026-12-14", "2026-12-20", "Finals");
      out["list_aal1"] = await rows(tx, as(F.STAFF), `select * from public.exam_period_list()`);
      out["short_reason"] = await add(staff, F.UNI_A, "2026-12-14", "2026-12-20", "x");
      out["backwards"] = await add(staff, F.UNI_A, "2026-12-20", "2026-12-14", "Finals");
      out["too_long"] = await add(staff, F.UNI_A, "2026-12-01", "2027-01-14", "Finals");
      out["unknown_university"] = await add(staff, F.fid("no-university"), "2026-12-14", "2026-12-20", "Finals");
      out["add"] = await add(staff, F.UNI_A, "2026-12-14", "2026-12-20", " Finals ");
      out["overlap"] = await add(staff, F.UNI_A, "2026-12-20", "2026-12-24", "Retakes");
      out["other_university"] = await add(staff, F.UNI_B, "2026-12-20", "2026-12-24", "Retakes");
      out["list"] = await rows(tx, staff, `select * from public.exam_period_list()`);
      const id = (out["add"] as { value: string }).value;
      out["remove_short_reason"] = await call(tx, staff, `public.remove_exam_period($1, 'x')`, [id]);
      out["remove_unknown"] = await call(tx, staff, `public.remove_exam_period($1, 'Entered by mistake')`, [F.fid("no-exam")]);
      out["remove"] = await call(tx, staff, `public.remove_exam_period($1, 'Entered by mistake')`, [id]);
      out["list_after"] = await rows(tx, staff, `select * from public.exam_period_list()`);
      out["audit"] = [...(await tx.unsafe(AUDIT, [F.STAFF]))];
      return out;
    }));

  // The case above adds a 44-day period first (within the 45-day limit), so its later add overlaps and its
  // removals had no id to send; this one removes a period that was added.
  it("exams: removing an added period (audited); a short reason and an unknown id are refused", () =>
    check("exams_remove", "remove", async (tx) => {
      const staff = as(F.STAFF, "aal2");
      await tx.unsafe(`insert into public.staff_roles (user_id, role) values ($1, 'accounts')`, [F.STAFF]);
      const out: Record<string, unknown> = {};
      out["add"] = await call(tx, staff, `public.add_exam_period($1, $2::date, $3::date, $4)`, [F.UNI_A, "2027-02-01", "2027-02-10", "Mid-terms"]);
      const id = (out["add"] as { value: string }).value;
      out["remove_short_reason"] = await call(tx, staff, `public.remove_exam_period($1, 'x')`, [id]);
      out["remove_not_staff"] = await call(tx, as(F.R(1), "aal2"), `public.remove_exam_period($1, 'Entered by mistake')`, [id]);
      out["remove"] = await call(tx, staff, `public.remove_exam_period($1, ' Entered by mistake ')`, [id]);
      out["remove_again"] = await call(tx, staff, `public.remove_exam_period($1, 'Entered by mistake')`, [id]);
      out["list_after"] = await rows(tx, staff, `select * from public.exam_period_list()`);
      out["audit"] = [...(await tx.unsafe(AUDIT, [F.STAFF]))];
      return out;
    }));
});
