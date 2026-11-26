import { appendEvents } from "@skilient/platform";
import type { Config } from "../domain/config";
import { chooseDimension, responseWeight } from "../domain/survey";
import { refused } from "../refusals";
import { canViewPost, type Db, type Tx } from "./db";

/**
 * The micro-survey, views and stats (ported from 20260929030000_micro_survey.sql: assign_survey_question,
 * survey_for_posts, answer_survey, record_views, post_insights and the stats_on_* triggers). Assigning and
 * answering write in the caller's transaction, set-based: one read for every post's state, one insert for
 * every new assignment. An answer publishes `survey.answered {post_id, user_id, dimension, answer}` for trust
 * (analytics, W10).
 */

/** `assign_survey_question` for every post given (at most 50) that the reader can see. */
async function assign(tx: Tx, me: string, ids: readonly string[], c: Config, pick: (n: number) => number): Promise<void> {
  const posts = await tx<{ id: string; type: string; author_id: string; assigned: boolean; counts: Record<string, number> }[]>`
    select p.id::text, p.type, p.author_id::text,
           exists (select 1 from content.survey_assignments a where a.post_id = p.id and a.user_id = ${me}) as assigned,
           coalesce((select jsonb_object_agg(sc.dimension, sc.assigned) from content.post_survey_counts sc where sc.post_id = p.id), '{}'::jsonb) as counts
      from content.posts p
     where p.id = any(${ids as string[]}::uuid[]) and ${canViewPost(tx, me)}`;
  const todo = posts.filter((p) => !p.assigned && p.author_id !== me && ["general", "invite", "event", "shipped"].includes(p.type));
  if (todo.length === 0) return;
  const dims = await tx<{ dimension: string; post_types: string[]; tie_priority: number; questions: number[] }[]>`
    select d.dimension, d.post_types, d.tie_priority,
           coalesce((select array_agg(q.id order by q.id) from content.survey_questions q where q.dimension = d.dimension and q.active), '{}') as questions
      from content.survey_dimensions d`;
  const rows: { post_id: string; user_id: string; question_id: number; dimension: string }[] = [];
  for (const p of todo) {
    const d = chooseDimension(p.type, p.counts, dims, c, pick);
    if (!d) continue;
    rows.push({ post_id: p.id, user_id: me, question_id: d.questions[pick(d.questions.length)]!, dimension: d.dimension });
  }
  if (rows.length === 0) return;
  const added = await tx<{ post_id: string; dimension: string }[]>`
    insert into content.survey_assignments ${tx(rows)} on conflict (post_id, user_id) do nothing returning post_id::text, dimension`;
  if (added.length)
    // stats_on_assignment
    await tx`
      insert into content.post_survey_counts (post_id, dimension, assigned)
      select x.post_id::uuid, x.dimension, 1 from jsonb_to_recordset(${JSON.stringify(added)}::text::jsonb) as x(post_id text, dimension text)
      on conflict (post_id, dimension) do update set assigned = content.post_survey_counts.assigned + 1`;
}

export interface SurveyRow {
  post_id: string;
  question_id: number | null;
  question: string | null;
  dimension: string | null;
  my_answer: boolean | null;
  answered_at: Date | null;
  can_change: boolean;
  public_line: Record<string, { count: number; phrase: string }>;
}

/** `survey_for_posts`: assigns once, then the reader's question, answer and the public line for each post. */
export async function surveyForPosts(tx: Tx, me: string | null, raw: readonly string[], c: Config, pick: (n: number) => number = randomIndex): Promise<SurveyRow[]> {
  if (!me) throw refused("not_signed_in");
  const ids = raw.slice(0, 50);
  await assign(tx, me, ids, c, pick);
  return tx<SurveyRow[]>`
    select p.id::text as post_id, a.question_id, q.text as question, a.dimension, r.answer as my_answer, r.created_at as answered_at,
           r.post_id is not null and now() < r.locked_at as can_change,
           coalesce((select jsonb_object_agg(d.dimension, jsonb_build_object('count', sc.ticks, 'phrase', d.public_phrase))
                       from content.post_survey_counts sc join content.survey_dimensions d on d.dimension = sc.dimension
                      where sc.post_id = p.id and d.public and sc.ticks >= ${c["survey.public_min"]}), '{}'::jsonb) as public_line
      from unnest(${ids as string[]}::uuid[]) as ids(id)
      join content.posts p on p.id = ids.id
      left join content.survey_assignments a on a.post_id = p.id and a.user_id = ${me}
      left join content.survey_questions q on q.id = a.question_id
      left join content.survey_responses r on r.post_id = p.id and r.user_id = ${me}
     where ${canViewPost(tx, me)}`;
}

const randomIndex = (n: number) => Math.floor(Math.random() * n);

/** `answer_survey` (and `stats_on_response`). */
export async function answerSurvey(tx: Tx, me: string | null, postId: string, answer: boolean | null, latencyMs: number, c: Config): Promise<void> {
  if (!me) throw refused("not_signed_in");
  if (answer === null) throw refused("answer_yes_no");
  // One read: the question, the view, any earlier answer, and the anti-gaming weight's inputs.
  const [a] = await tx<
    {
      question_id: number;
      dimension: string;
      author_id: string;
      viewed: boolean;
      friend_or_teammate: boolean;
      new_account: boolean;
      prior: number;
      variation: boolean;
      had: boolean | null;
      had_weight: string | null;
    }[]
  >`
    select a.question_id, a.dimension, p.author_id::text,
           exists (select 1 from content.post_views v where v.post_id = p.id and v.user_id = ${me}) as viewed,
           exists (select 1 from content.friendships f where f.user_id_a = least(${me}::uuid, p.author_id) and f.user_id_b = greatest(${me}::uuid, p.author_id))
             or exists (select 1 from content.group_members g1 join content.group_members g2 on g2.kind = g1.kind and g2.group_id = g1.group_id
                         where g1.kind = 'venture' and g1.user_id = ${me} and g2.user_id = p.author_id) as friend_or_teammate,
           exists (select 1 from content.members m where m.user_id = ${me}
                      and m.account_created_at > now() - make_interval(days => ${c["survey.weights"].new_account_days})) as new_account,
           (select count(*)::int from content.survey_responses r where r.user_id = ${me}) as prior,
           coalesce((select bool_or(r.answer <> ${answer}) from content.survey_responses r where r.user_id = ${me}), false) as variation,
           mine.answer as had, mine.weight::text as had_weight
      from content.survey_assignments a join content.posts p on p.id = a.post_id
      left join content.survey_responses mine on mine.post_id = a.post_id and mine.user_id = a.user_id
     where a.post_id = ${postId} and a.user_id = ${me} and ${canViewPost(tx, me)}`;
  if (!a) throw refused("no_question");
  if (!a.viewed || latencyMs < c["survey.min_latency_ms"]) throw refused("read_first");
  let weight: number;
  if (a.had !== null) {
    // A change, while the answer is open: the update is the check (and the row lock against a parallel change).
    const [changed] = await tx<{ was: boolean }[]>`
      update content.survey_responses r set answer = ${answer}, updated_at = now()
        from (select answer from content.survey_responses where post_id = ${postId} and user_id = ${me} for update) old
       where r.post_id = ${postId} and r.user_id = ${me} and now() < r.locked_at
      returning old.answer as was`;
    if (!changed) throw refused("answer_final");
    weight = Number(a.had_weight);
    await countAnswer(tx, postId, a.dimension, a.author_id, { answer: changed.was, weight }, { answer, weight });
  } else {
    weight = responseWeight({ friendOrTeammate: a.friend_or_teammate, newAccount: a.new_account, prior: a.prior, variation: a.variation }, c);
    await tx`
      insert into content.survey_responses (post_id, user_id, question_id, dimension, answer, latency_ms, weight, locked_at)
      values (${postId}, ${me}, ${a.question_id}, ${a.dimension}, ${answer}, ${latencyMs}, ${weight},
              now() + make_interval(mins => ${c["survey.change_minutes"]}))`;
    await countAnswer(tx, postId, a.dimension, a.author_id, null, { answer, weight });
  }
  await appendEvents(tx, [{ type: "survey.answered", subjects: [postId, me], payload: { post_id: postId, user_id: me, dimension: a.dimension, answer, weight } }]);
}

/** `stats_on_response`: the post's counts, answers and positives, and Appropriate flags from non-friends. */
export async function countAnswer(
  tx: Tx,
  postId: string,
  dimension: string,
  authorId: string,
  old: { answer: boolean; weight: number } | null,
  now: { answer: boolean; weight: number },
): Promise<void> {
  // As the trigger did: take the old answer off, then add the new one; a weight is numeric(4,3), a zero is 0,
  // so the stored values keep the same scale as today's.
  // One statement: the counts, then the post's answers, positives and (for Appropriate) flags.
  const term = (x: { answer: boolean; weight: number } | null, sign: "+" | "-", tick: boolean) =>
    x === null ? tx`` : tx`${tx.unsafe(sign)} ${x.answer === tick ? tx`${x.weight}::numeric(4,3)` : tx`0`}`;
  const count = (x: { answer: boolean } | null, sign: "+" | "-", tick: boolean) => (x === null ? tx`` : tx`${tx.unsafe(sign)} ${x.answer === tick ? 1 : 0}`);
  const answers = old ? 0 : 1;
  const positives = (now.answer ? 1 : 0) - (old?.answer ? 1 : 0);
  const flags =
    dimension === "appropriate"
      ? tx`(select count(*) from content.survey_responses r
             where r.post_id = ${postId} and r.dimension = 'appropriate' and not r.answer
               and not exists (select 1 from content.friendships f where f.user_id_a = least(r.user_id, ${authorId}::uuid) and f.user_id_b = greatest(r.user_id, ${authorId}::uuid)))`
      : tx`content.post_stats.appropriate_flags`;
  await tx`
    with counted as (
      update content.post_survey_counts
         set ticks = ticks ${count(old, "-", true)} ${count(now, "+", true)}, crosses = crosses ${count(old, "-", false)} ${count(now, "+", false)},
             weighted_ticks = weighted_ticks ${term(old, "-", true)} ${term(now, "+", true)},
             weighted_crosses = weighted_crosses ${term(old, "-", false)} ${term(now, "+", false)}
       where post_id = ${postId} and dimension = ${dimension}
      returning 1)
    insert into content.post_stats (post_id, answers, positives) values (${postId}, ${answers}, greatest(${positives}, 0))
    on conflict (post_id) do update set answers = greatest(content.post_stats.answers + ${answers}, 0),
                                        positives = greatest(content.post_stats.positives + ${positives}, 0),
                                        appropriate_flags = ${flags}, updated_at = now()`;
}

/** `record_views` (and `stats_on_view`): qualified views, at most 100 ids, each once per reader. */
export async function recordViews(tx: Tx, me: string | null, ids: readonly string[]): Promise<number> {
  if (!me) throw refused("not_signed_in");
  // One statement: the new views, and stats_on_view for each.
  const [r] = await tx<{ n: number }[]>`
    with added as (
      insert into content.post_views (post_id, user_id)
      select distinct p.id, ${me}::uuid from content.posts p where p.id = any(${ids.slice(0, 100) as string[]}::uuid[]) and ${canViewPost(tx, me)}
      on conflict do nothing returning post_id),
    counted as (
      insert into content.post_stats (post_id, views) select post_id, 1 from added
      on conflict (post_id) do update set views = content.post_stats.views + 1, updated_at = now()
      returning 1)
    select (select count(*)::int from added) as n, (select count(*) from counted) as c`;
  return r!.n;
}

export interface InsightRow {
  dimension: string;
  label: string;
  ticks: number;
  crosses: number;
  weighted_rate: string | null;
  views: number | null;
  commenters: number | null;
}

/** `post_insights`: the author's results per dimension, with Student Pro (billing's entitlement copy). */
export async function postInsights(db: Db, me: string | null, postId: string): Promise<InsightRow[]> {
  if (!me) throw refused("not_signed_in");
  // One trip: the author check, the entitlement and the rows together.
  const [own] = await db<{ entitled: boolean; rows: InsightRow[] }[]>`
    select exists (select 1 from content.entitlements e where e.subject_id = ${me}::uuid and e.key = 'insights.post_survey'
                     and e.value not in ('false'::jsonb, '0'::jsonb, 'null'::jsonb)) as entitled,
           coalesce((select jsonb_agg(jsonb_build_object(
                       'dimension', c.dimension, 'label', d.label, 'ticks', c.ticks, 'crosses', c.crosses,
                       'weighted_rate', case when c.weighted_ticks + c.weighted_crosses > 0 then round(c.weighted_ticks / (c.weighted_ticks + c.weighted_crosses), 3)::text end,
                       'views', s.views, 'commenters', s.commenters) order by d.public desc, d.dimension)
                       from content.post_survey_counts c
                       join content.survey_dimensions d on d.dimension = c.dimension
                       left join content.post_stats s on s.post_id = c.post_id
                      where c.post_id = p.id), '[]'::jsonb) as rows
      from content.posts p where p.id = ${postId} and p.author_id = ${me}::uuid`;
  if (!own) throw refused("insights_author_only");
  if (!own.entitled) throw refused("insights_paid");
  return own.rows;
}
