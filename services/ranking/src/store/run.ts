import { appendEvents, uuidv7, type NewEvent } from "@skilient/platform";
import { clean, daysBetween, isoDow, pktDate } from "../domain/numbers";
import { computeRanking, rankingPoints, type Formula } from "../domain/score";
import { nextTierRequirements, nextTierState, tierMet, type Tier, type TierFacts } from "../domain/tiers";
import { num, type Tx } from "./db";
import { loadFacts } from "./facts";
import { formulaInForce } from "./formula";
import { flagChanged } from "./flags";
import { detectRings } from "./rings";

/**
 * The nightly run (ranking_start, ranking_step, ranking_apply, assign_percentiles_and_tiers,
 * take_ranking_snapshot): a small state machine, one committed step at a time. rings → students (compute,
 * rapid-gain hold, publish; one batch of `batch_size` per step) → percentiles and tiers → the Sunday snapshot.
 * Every student in a run is scored as of the run's moment, so a rerun gives the same numbers.
 *
 * After the tiers stage, ranking tells others what changed (and only that): `tier.changed` (work's paths,
 * notify's tier-up notice, trust's analytics) and `fact.value_changed` {tier.next, tier.points} for people's
 * shell; `ranking.published` when the run is done.
 */
export interface Run {
  id: string;
  run_on: string;
  as_of: Date;
  formula_version: number;
  formula: Formula;
  stage: string;
  cursor: string | null;
  students: number;
  held: number;
  steps: number;
}
type Json = Record<string, unknown>;

/** `ranking_start(as_of)`: one run per PKT day; returns its id, or null when today's has started. */
export async function startRun(tx: Tx, asOf: Date = new Date()): Promise<string | null> {
  const f = await formulaInForce(tx);
  const [r] = await tx<{ id: string }[]>`
    insert into ranking.ranking_runs (run_on, as_of, formula_version, formula)
    values (${pktDate(asOf)}::date, ${asOf}, ${f.version}, ${JSON.stringify(f.value)}::text::jsonb)
    on conflict (run_on) do nothing returning id::text`;
  return r?.id ?? null;
}

interface Score {
  user_id: string;
  formula_version: number;
  components: Json;
  total: string;
  ranked: boolean;
  tier: Tier | null;
  momentum_peak: string;
}

/** `ranking_apply(run, user)`: compute, then publish, or hold a rapid gain. Returns whether it was held. */
async function applyStudent(tx: Tx, run: Run, userId: string, old: Score | undefined, c: Json & { total: number; proof: number }): Promise<boolean> {
  const rg = run.formula.rapid_gain;
  const total = c.total;
  const facts = c["facts"] as TierFacts;
  const ranked = (facts.peer_verified_entries ?? 0) >= 1;
  const momentum = c["momentum"] as Json;
  const work = c["work"] as Json & { ventures: Json[] };
  const adjustments = c["adjustments"] as Json;
  const components = JSON.stringify(c);
  if (!old) {
    await tx`
      insert into ranking.ranking_scores (user_id, formula_version, components, proof, momentum, adjustments, total, ranked, momentum_peak, computed_at, published_at)
      values (${userId}, ${run.formula_version}, ${components}::text::jsonb, ${c.proof}, ${momentum["points"] as number}, ${adjustments["points"] as number},
              ${total}, ${ranked}, ${momentum["peak"] as number}, now(), now())`;
    return false;
  }
  const [open] = await tx`select 1 from ranking.anti_gaming_flags where kind = 'rapid_gain' and user_id = ${userId} and status = 'open'`;
  if (open) {
    await tx`update ranking.ranking_scores set held = true, held_total = ${total}, computed_at = now() where user_id = ${userId}`;
    return true;
  }
  if (old.formula_version === run.formula_version) {
    let baseline = Number(old.total);
    let known = ((old.components["work"] as Json | undefined)?.["ventures"] as Json[] | undefined) ?? [];
    const [decided] = await tx<{ detail: Json }[]>`
      select detail from ranking.anti_gaming_flags
       where kind = 'rapid_gain' and user_id = ${userId} and status = 'cleared' and applied_at is null order by reviewed_at desc limit 1`;
    if (decided) {
      baseline = Math.max(baseline, Number(decided.detail["to_total"]));
      known = [...known, ...((decided.detail["ventures"] as Json[] | undefined) ?? [])];
    }
    const fresh = work.ventures.filter((v) => !known.some((k) => k["venture_id"] === v["venture_id"]));
    const newPoints = fresh.reduce((s, v) => s + (v["points"] as number), 0);
    const oldWork = Number(((old.components["work"] as Json | undefined)?.["points"] as number | undefined) ?? NaN);
    let exempt = Math.min(newPoints, Math.max(0, (work["points"] as number) - oldWork));
    if (Number.isNaN(exempt)) exempt = 0;
    const [ring] = await tx`select 1 from ranking.anti_gaming_flags where kind = 'ring' and status = 'open' and members @> array[${userId}]::uuid[]`;
    if (ring) exempt = 0;
    const since = run.as_of.getTime() - rg.completion_days * 86_400_000;
    const completions = work.ventures.filter((v) => new Date(v["completed_at"] as string).getTime() > since).length;
    const gain = total - baseline - exempt;
    if (gain > rg.points || (fresh.length > 0 && completions > rg.completions)) {
      await tx`update ranking.anti_gaming_flags set applied_at = now() where kind = 'rapid_gain' and user_id = ${userId} and status <> 'open' and applied_at is null`;
      const id = uuidv7();
      const detail = {
        reason: gain > rg.points ? "gain" : "completions",
        from_total: baseline,
        to_total: total,
        gain: clean(total - baseline),
        exempt,
        completions,
        run_on: run.run_on,
        from: rankingPoints(old.components),
        to: rankingPoints(c),
        ventures: work.ventures,
      };
      await tx`
        insert into ranking.anti_gaming_flags (id, kind, user_id, members, detail)
        values (${id}, 'rapid_gain', ${userId}, ${[userId]}::uuid[], ${JSON.stringify(detail)}::text::jsonb)`;
      await appendEvents(tx, [flagChanged({ id, kind: "rapid_gain", members: [userId], status: "open" })]);
      await tx`update ranking.ranking_scores set held = true, held_total = ${total}, computed_at = now() where user_id = ${userId}`;
      return true;
    }
  }
  await tx`update ranking.anti_gaming_flags set applied_at = now() where kind = 'rapid_gain' and user_id = ${userId} and status <> 'open' and applied_at is null`;
  await tx`
    update ranking.ranking_scores
       set formula_version = ${run.formula_version}, components = ${components}::text::jsonb, proof = ${c.proof},
           momentum = ${momentum["points"] as number}, adjustments = ${adjustments["points"] as number}, total = ${total}, ranked = ${ranked},
           momentum_peak = ${momentum["peak"] as number}, held = false, held_total = null, computed_at = now(), published_at = now()
     where user_id = ${userId}`;
  return false;
}

/** The students stage's batch: compute every student after the cursor, in user id order. */
async function studentsBatch(tx: Tx, run: Run): Promise<{ n: number; held: number; last: string | null }> {
  const batch = run.formula.batch_size ?? 500;
  const users = await tx<{ user_id: string }[]>`
    select user_id::text from ranking.members
     where role = 'student' and onboarding_complete and (${run.cursor}::uuid is null or user_id > ${run.cursor}::uuid)
     order by user_id limit ${batch}`;
  const ids = users.map((u) => u.user_id);
  if (!ids.length) return { n: 0, held: 0, last: null };
  const olds = new Map(
    (
      await tx<Score[]>`
        select user_id::text, formula_version, components, total::text, ranked, tier, momentum_peak::text
          from ranking.ranking_scores where user_id = any(${ids}::uuid[]) order by user_id for update`
    ).map((s) => [s.user_id, s]),
  );
  const facts = await loadFacts(tx, ids, run.as_of);
  let held = 0;
  for (const id of ids) {
    const old = olds.get(id);
    const c = computeRanking(facts.get(id)!, run.formula, run.as_of, Number(old?.momentum_peak ?? 0));
    if (await applyStudent(tx, run, id, old, c)) held += 1;
  }
  return { n: ids.length, held, last: ids.at(-1)! };
}

/** `assign_percentiles_and_tiers(on, f)`, then what changed goes out. Returns the rows updated. */
export async function assignTiers(tx: Tx, on: string, f: Formula, formulaVersion: number): Promise<number> {
  await tx`
    update ranking.ranking_scores s set percentile = r.pr
      from (select user_id, percent_rank() over (order by total) as pr from ranking.ranking_scores where ranked) r
     where s.user_id = r.user_id and s.percentile is distinct from r.pr`;
  await tx`update ranking.ranking_scores set percentile = null where not ranked and percentile is not null`;
  const rows = await tx<{ user_id: string; tier: Tier | null; below_since: string | null; ranked: boolean; total: string; percentile: number | null; facts: TierFacts | null }[]>`
    select user_id::text, tier, below_since::text, ranked, total::text, percentile, components->'facts' as facts from ranking.ranking_scores order by user_id`;
  const drop = f.tiers["drop_days"]!;
  const updates: { user_id: string; tier: Tier | null; tier_met: Tier | null; below_since: string | null }[] = [];
  for (const r of rows) {
    const met = tierMet(r.ranked, Number(r.total), r.percentile, r.facts ?? {}, f);
    const next = nextTierState({ tier: r.tier, below_since: r.below_since }, met, on, drop, daysBetween);
    updates.push({ user_id: r.user_id, tier: next.tier, tier_met: met, below_since: next.below_since });
  }
  if (updates.length)
    await tx`
      update ranking.ranking_scores s set tier = u.tier, tier_met = u.tier_met, below_since = u.below_since::date
        from json_to_recordset(${JSON.stringify(updates)}::text::json) as u(user_id uuid, tier text, tier_met text, below_since text)
       where s.user_id = u.user_id`;
  await publishChanges(tx, f, formulaVersion);
  return updates.length;
}

/**
 * Tells others what changed since ranking last told them, for every scored student: `tier.changed` when the
 * tier or ranked flag moved, `fact.value_changed` when the next-tier requirements or the checklist points
 * moved. `ranking.published` keeps the last value of each, so a run without changes sends nothing.
 */
export async function publishChanges(tx: Tx, f: Formula, formulaVersion: number, onlyUsers?: readonly string[]): Promise<number> {
  const rows = await tx<{ user_id: string; tier: Tier | null; ranked: boolean; total: string; percentile: number | null; facts: TierFacts | null; published: Record<string, Json> | null }[]>`
    select s.user_id::text, s.tier, s.ranked, s.total::text, s.percentile, s.components->'facts' as facts,
           (select json_object_agg(p.key, p.value) from ranking.published p where p.user_id = s.user_id) as published
      from ranking.ranking_scores s
     where ${onlyUsers ? tx`s.user_id = any(${[...onlyUsers]}::uuid[])` : tx`true`}
     order by s.user_id`;
  const points = { l2: f.skills.level_points["2"] ?? null, venture: f.work["venture_points"] ?? null, endorsement: f.endorsements.points ?? null, version: formulaVersion };
  const events: NewEvent[] = [];
  const saves: { user_id: string; key: string; value: Json }[] = [];
  for (const r of rows) {
    const prev = r.published ?? {};
    const tier = { tier: r.tier, ranked: r.ranked };
    if (JSON.stringify(prev["tier"] ?? null) !== JSON.stringify(tier)) {
      const before = (prev["tier"] as { tier: string | null } | undefined)?.tier ?? null;
      events.push({ type: "tier.changed", subjects: [r.user_id], payload: { user_id: r.user_id, tier: r.tier, ranked: r.ranked, previous_tier: before } });
      saves.push({ user_id: r.user_id, key: "tier", value: tier });
    }
    const next = nextTierRequirements({ ranked: r.ranked, tier: r.tier, total: Number(r.total), percentile: r.percentile, facts: r.facts ?? {} }, f);
    if (JSON.stringify(prev["tier.next"] ?? null) !== JSON.stringify(next)) {
      events.push({ type: "fact.value_changed", subjects: [r.user_id], payload: { user_id: r.user_id, key: "tier.next", value: next } });
      saves.push({ user_id: r.user_id, key: "tier.next", value: next as unknown as Json });
    }
    if (JSON.stringify(prev["tier.points"] ?? null) !== JSON.stringify(points)) {
      const { version: _v, ...value } = points;
      events.push({ type: "fact.value_changed", subjects: [r.user_id], payload: { user_id: r.user_id, key: "tier.points", value } });
      saves.push({ user_id: r.user_id, key: "tier.points", value: points });
    }
  }
  if (saves.length)
    await tx`
      insert into ranking.published (user_id, key, value)
      select u.user_id, u.key, u.value from json_to_recordset(${JSON.stringify(saves)}::text::json) as u(user_id uuid, key text, value jsonb)
      on conflict (user_id, key) do update set value = excluded.value, published_at = now()`;
  await appendEvents(tx, events);
  return events.length;
}

/** `take_ranking_snapshot(on)`. */
export async function takeSnapshot(tx: Tx, on: string): Promise<number> {
  const rows = await tx<{ user_id: string; formula_version: number; components: Json; total: string; ranked: boolean; tier: string | null; percentile: number | null }[]>`
    select user_id::text, formula_version, components, total::text, ranked, tier, percentile from ranking.ranking_scores`;
  const list = rows.map((r) => ({ ...r, components: rankingPoints(r.components) }));
  if (!list.length) return 0;
  await tx`
    insert into ranking.ranking_snapshots (user_id, week, formula_version, components, total, ranked, tier, percentile)
    select u.user_id, ${on}::date, u.formula_version, u.components, u.total, u.ranked, u.tier, u.percentile
      from json_to_recordset(${JSON.stringify(list)}::text::json)
           as u(user_id uuid, formula_version integer, components jsonb, total numeric, ranked boolean, tier text, percentile double precision)
    on conflict (user_id, week) do update set formula_version = excluded.formula_version, components = excluded.components, total = excluded.total,
       ranked = excluded.ranked, tier = excluded.tier, percentile = excluded.percentile`;
  return list.length;
}

/**
 * `ranking_step()`: one committed step of the oldest unfinished run; returns the stage it moved to (null when
 * there is nothing to do). A failure marks the run failed with its error, as today.
 */
export async function step(tx: Tx): Promise<string | null> {
  const [row] = await tx<(Omit<Run, "as_of" | "run_on"> & { as_of: Date; run_on: string })[]>`
    select id::text, run_on::text, as_of, formula_version, formula, stage, cursor::text, students, held, steps
      from ranking.ranking_runs where finished_at is null order by id limit 1 for update skip locked`;
  if (!row) return null;
  const r = row as Run;
  let stage = r.stage;
  let n = 0;
  let held = 0;
  let last: string | null = null;
  try {
    await tx.savepoint(async (sp) => {
      if (r.stage === "rings") {
        await detectRings(sp, r.formula);
        stage = "students";
      } else if (r.stage === "students") {
        const b = await studentsBatch(sp, r);
        n = b.n;
        held = b.held;
        last = b.last;
        if (n < (r.formula.batch_size ?? 500)) stage = "tiers";
      } else if (r.stage === "tiers") {
        await assignTiers(sp, r.run_on, r.formula, r.formula_version);
        stage = isoDow(r.run_on) === 7 ? "snapshot" : "done";
      } else if (r.stage === "snapshot") {
        await takeSnapshot(sp, r.run_on);
        stage = "done";
      }
    });
  } catch (err) {
    await tx`
      update ranking.ranking_runs set stage = 'failed', error = left(${String((err as Error).message ?? err)}, 2000), finished_at = now(), steps = steps + 1
       where id = ${r.id}`;
    return "failed";
  }
  await tx`
    update ranking.ranking_runs
       set stage = ${stage}, cursor = ${stage === "students" ? last : null}::uuid, students = students + ${n}, held = held + ${held}, steps = steps + 1,
           finished_at = case when ${stage} = 'done' then now() end
     where id = ${r.id}`;
  if (stage === "done")
    await appendEvents(tx, [
      { type: "ranking.published", subjects: [], payload: { run_on: r.run_on, formula_version: r.formula_version, students: r.students + n, held: r.held + held } },
    ]);
  return stage;
}

/** `ranking_run_all(as_of)`: a whole run, one committed step per transaction (tests and a manual rerun). */
export async function runAll(sql: { begin: <T>(fn: (tx: Tx) => Promise<T>) => Promise<T> }, asOf: Date = new Date()): Promise<string | null> {
  await sql.begin((tx) => startRun(tx, asOf));
  let stage: string | null = null;
  for (let i = 0; i < 100_000; i++) {
    stage = await sql.begin((tx) => step(tx));
    if (stage === null || stage === "done" || stage === "failed") break;
  }
  return stage;
}

/** The run's published numbers for one student, as the score page reads them (for callers outside a run). */
export const scoreRow = (tx: Tx, userId: string) =>
  tx<{ total: string; held: boolean }[]>`select total::text, held from ranking.ranking_scores where user_id = ${userId}`.then((r) => (r[0] ? { total: num(r[0].total)!, held: r[0].held } : null));
