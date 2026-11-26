/**
 * The W3 done-when: "Feed budgets met at 300 simulated users" (docs/azure/prd.md, performance budgets: feed
 * data 120 ms for the first page, 60 ms for the next, 40 ms for a survey tick; perf/budgets.json). A university
 * of 300 students is seeded into content's schema as the copies and the students' own writes would leave it:
 * a week of posts (five each), friendships, comments, survey counts and views. Every student then opens the
 * University Feed (FeedPage with its cards, as web calls it), ten at a time, and pages once; survey ticks and
 * card reads are timed too. Content's database connection counts the queries each call makes. Runs on both
 * transports, in its own pass (`pnpm test` runs the budget project after the others).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ContentService } from "@skilient/contracts/content/v1/content_pb";
import { describeTransports } from "@skilient/testing";
import { afterAll, expect, it } from "vitest";
import { contentWorld, stopWorlds, type ContentWorld } from "../contract/world";

const budgets = JSON.parse(readFileSync(join(import.meta.dirname, "../../../../perf/budgets.json"), "utf8")) as Record<string, { p95Ms: number; dbTrips: number }>;
const B = (m: string) => budgets[`skilient.content.v1.ContentService/${m}`]!;
const worlds: ContentWorld[] = [];
let w: ContentWorld;
let queries = 0;
afterAll(() => stopWorlds(worlds));

const STUDENTS = 300;
// Calls in flight at once. The test database gives each service 2 connections (production: 10 per replica), so
// this measures each call, not queueing; load at 30, 100 and 300 users is the k6 run (W15).
const WIDTH = 1;
const UNI = "9b000000-0000-4000-8000-0000000000b1";
const OTHER = "9b000000-0000-4000-8000-0000000000b2";

// The pool is held as in production (60 s per audience).
process.env["CONTENT_FEED_POOL_MS"] = "60000";
const counting = contentWorld((x) => (w = x), worlds);
async function options() {
  const o = await counting();
  (w.content.options as { debug?: unknown }).debug = () => void queries++;
  await seed();
  return o;
}

/** A week at one university, written set-based into content's own schema. */
async function seed(): Promise<void> {
  await w.content.begin(async (tx) => {
    await tx`
      insert into content.members (user_id, role, university_id, department_hash, graduation_year, visibility, status, onboarding_complete, account_created_at)
      select ('9b100000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid, 'student', case when i % 10 = 0 then ${OTHER}::uuid else ${UNI}::uuid end,
             encode(sha256(convert_to('Dept ' || (i % 6), 'UTF8')), 'hex'), 2025 + i % 4, 'university', 'active', true, now() - interval '60 days'
        from generate_series(1, ${STUDENTS}) i`;
    // Each student has about ten friends.
    await tx`
      insert into content.friendships (user_id_a, user_id_b)
      select distinct least(a, b), greatest(a, b)
        from (select ('9b100000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid as a,
                     ('9b100000-0000-4000-8000-' || lpad((1 + (i * 7 + k * 13) % ${STUDENTS})::text, 12, '0'))::uuid as b
                from generate_series(1, ${STUDENTS}) i, generate_series(1, 5) k) x
       where a <> b`;
    // Five posts each over the last week (a third of them global), at every stage but held.
    await tx`
      insert into content.posts (id, author_id, university_id, audience, type, body, stage, created_at)
      select gen_random_uuid(), ('9b100000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
             case when i % 10 = 0 then ${OTHER}::uuid else ${UNI}::uuid end,
             case when (i + k) % 3 = 0 then 'global' else 'university' end, 'general', 'Post ' || i || '.' || k,
             (array['seed', 'limited', 'full', 'full', 'global_boost', 'demoted'])[1 + (i + k) % 6],
             now() - make_interval(mins => (i * 37 + k * 1013) % (7 * 24 * 60))
        from generate_series(1, ${STUDENTS}) i, generate_series(1, 5) k`;
    await tx`insert into content.post_stats (post_id, views, answers, positives, commenters) select id, 20, 6, 4, 2 from content.posts`;
    await tx`
      insert into content.post_survey_counts (post_id, dimension, assigned, ticks, crosses, weighted_ticks, weighted_crosses)
      select id, d, 5, 3, 2, 2.5, 1.5 from content.posts, unnest(array['informative', 'interesting', 'credible']) d`;
    await tx`
      insert into content.post_comments (id, post_id, author_id, body, created_at)
      select gen_random_uuid(), p.id, ('9b100000-0000-4000-8000-' || lpad((1 + (abs(hashtext(p.id::text)) + k) % ${STUDENTS})::text, 12, '0'))::uuid,
             'A comment long enough to count', p.created_at + interval '5 minutes'
        from content.posts p, generate_series(1, 2) k`;
    await tx`
      insert into content.post_views (post_id, user_id)
      select p.id, ('9b100000-0000-4000-8000-' || lpad((1 + (abs(hashtext(p.id::text)) + k * 31) % ${STUDENTS})::text, 12, '0'))::uuid
        from content.posts p, generate_series(1, 10) k
      on conflict do nothing`;
  });
  // As autovacuum would have by now: statistics and visibility for the planner (the service role cannot analyze tables it does not own).
  await w.pg.admin`vacuum analyze`;
}

const user = (i: number) => `9b100000-0000-4000-8000-${String(i).padStart(12, "0")}`;
const p95 = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length * 0.95)]!;

/** Runs `run` for every item, `width` at a time; returns each call's time in ms. */
async function timed<T>(items: T[], width: number, run: (x: T) => Promise<unknown>): Promise<number[]> {
  const times: number[] = [];
  for (let i = 0; i < items.length; i += width)
    await Promise.all(
      items.slice(i, i + width).map(async (x) => {
        const t0 = performance.now();
        await run(x);
        times.push(performance.now() - t0);
      }),
    );
  return times;
}

describeTransports(
  ["identity", "people", "content"],
  (env) => {
    it(`FeedPage for ${STUDENTS} students: first page within ${B("FeedPage").p95Ms} ms p95, next page within 60 ms, at most ${B("FeedPage").dbTrips} trips`, async () => {
      const content = env().client(ContentService);
      const ids = Array.from({ length: STUDENTS }, (_, i) => user(i + 1));
      const tokens = new Map(await Promise.all(ids.map(async (id) => [id, await w.token(id, "aal1")] as const)));
      const call = (id: string, key = true) => {
        const o = env().call({ userToken: tokens.get(id)! });
        return key ? { ...o, headers: { "idempotency-key": crypto.randomUUID() } } : o;
      };
      const first = (id: string) => content.feedPage({ audience: "university", filter: "all", cursor: "", limit: 20, withCards: true }, call(id));
      for (const id of ids.slice(0, 10)) await first(id); // warm up connections and prepared statements

      const cursors = new Map<string, string>();
      const before = queries;
      const firstTimes = await timed(ids, WIDTH, async (id) => {
        const page = await first(id);
        expect(page.cards.length).toBe(page.items.length);
        cursors.set(id, page.nextCursor);
      });
      const tripsFirst = (queries - before) / STUDENTS;
      const mid = queries;
      const nextTimes = await timed(ids, WIDTH, (id) =>
        content.feedPage({ audience: "university", filter: "all", cursor: cursors.get(id)!, limit: 20, withCards: true }, call(id)),
      );
      const tripsNext = (queries - mid) / STUDENTS;
      console.info(
        `FeedPage over ${env().transport}, ${STUDENTS} students: first p95 ${p95(firstTimes).toFixed(1)} ms (${tripsFirst.toFixed(1)} trips), next p95 ${p95(nextTimes).toFixed(1)} ms (${tripsNext.toFixed(1)} trips)`,
      );
      expect(p95(firstTimes)).toBeLessThan(B("FeedPage").p95Ms);
      expect(p95(nextTimes)).toBeLessThan(60);
      expect(tripsFirst).toBeLessThanOrEqual(B("FeedPage").dbTrips);
      expect(tripsNext).toBeLessThanOrEqual(B("FeedPage").dbTrips);
    });

    it(`PostCards, RecordViews and AnswerSurvey within their budgets`, async () => {
      const content = env().client(ContentService);
      const ids = Array.from({ length: 100 }, (_, i) => user(i + 1));
      const tokens = new Map(await Promise.all(ids.map(async (id) => [id, await w.token(id, "aal1")] as const)));
      const call = (id: string, key = true) => {
        const o = env().call({ userToken: tokens.get(id)! });
        return key ? { ...o, headers: { "idempotency-key": crypto.randomUUID() } } : o;
      };
      const posts = (await w.content<{ id: string }[]>`select id::text from content.posts where university_id = ${UNI} and stage <> 'seed' order by created_at desc limit 20`).map((r) => r.id);
      for (const id of ids.slice(0, 5)) await content.postCards({ postIds: posts }, call(id, false));
      let before = queries;
      const cardTimes = await timed(ids, WIDTH, (id) => content.postCards({ postIds: posts }, call(id, false)));
      expect((queries - before) / ids.length).toBe(B("PostCards").dbTrips);

      before = queries;
      const viewTimes = await timed(ids, WIDTH, (id) => content.recordViews({ postIds: posts.slice(0, 5) }, call(id)));
      expect((queries - before) / ids.length).toBeLessThanOrEqual(B("RecordViews").dbTrips);

      // A survey tick: the question is assigned first (as the strip does), then answered.
      const asked = new Set<string>();
      await timed(ids, WIDTH, async (id) => {
        const s = await content.surveyForPosts({ postIds: [posts[0]!] }, call(id));
        if (s.entries[0]?.questionId) asked.add(id);
      });
      await timed(ids, WIDTH, (id) => content.recordViews({ postIds: [posts[0]!] }, call(id)));
      const authorOf = new Map((await w.content<{ id: string; author: string }[]>`select id::text, author_id::text as author from content.posts where id = ${posts[0]!}`).map((r) => [r.id, r.author]));
      const answering = ids.filter((id) => asked.has(id) && id !== authorOf.get(posts[0]!));
      expect(answering.length).toBeGreaterThan(50);
      before = queries;
      const tickTimes = await timed(answering, WIDTH, (id) => content.answerSurvey({ postId: posts[0]!, answer: true, latencyMs: 1500 }, call(id)));
      expect((queries - before) / answering.length).toBeLessThanOrEqual(B("AnswerSurvey").dbTrips);
      console.info(
        `over ${env().transport}: PostCards p95 ${p95(cardTimes).toFixed(1)} ms, RecordViews p95 ${p95(viewTimes).toFixed(1)} ms, AnswerSurvey p95 ${p95(tickTimes).toFixed(1)} ms`,
      );
      expect(p95(cardTimes)).toBeLessThan(B("PostCards").p95Ms);
      expect(p95(viewTimes)).toBeLessThan(B("RecordViews").p95Ms);
      expect(p95(tickTimes)).toBeLessThan(B("AnswerSurvey").p95Ms);
    });
  },
  options,
);
