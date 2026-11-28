/**
 * The contract world for ranking: work's world (identity, people, content, messaging, realtime and work, each under
 * its own role, with the fake GitHub) plus ranking's schema. Ranking's background work is off; tests run its
 * copies consumer with `drain` (which also runs the other services' consumers, so ranking's own events reach
 * work and people) and the nightly run with `nightly`.
 */
import { join } from "node:path";
import type { TransportOptions } from "@skilient/testing";
import type postgres from "postgres";
import { copiesConsumer as peopleCopies, COPIES_CONSUMER as PEOPLE_CONSUMER, COPY_EVENTS as PEOPLE_COPIES } from "../../../people/src/store/copies";
import { drainCopies as drainWork, workWorld, type WorkWorld } from "../../../work/test/contract/world";
import { copiesConsumer, COPIES_CONSUMER, COPY_EVENTS } from "../../src/store/copies";
import { runAll } from "../../src/store/run";

export const MIGRATIONS = join(import.meta.dirname, "../../migrations");
export { NU, NUTECH, stopWorlds, student } from "../../../work/test/contract/world";

export interface RankingWorld extends WorkWorld {
  ranking: postgres.Sql;
}

export function rankingWorld(onWorld: (w: RankingWorld) => void, worlds: RankingWorld[] = []): () => Promise<TransportOptions> {
  process.env["RANKING_JOBS"] = "off";
  let base: WorkWorld | undefined;
  const start = workWorld((w) => (base = w), []);
  return async () => {
    const o = await start();
    const ranking = await base!.pg.service("ranking", MIGRATIONS);
    const w: RankingWorld = { ...base!, ranking };
    worlds.push(w);
    onWorld(w);
    const db = o.database!;
    return { ...o, database: (s: string) => (s === "ranking" ? ranking : db(s)) };
  };
}

async function pending(sql: postgres.Sql, consumer: string, types: readonly string[]): Promise<number> {
  const [r] = await sql<{ n: number }[]>`
    select count(*)::int as n from platform.events e
     where e.type = any(${[...types]}::text[])
       and not exists (select 1 from platform.applied_events a where a.consumer = ${consumer} and a.event_id = e.id)`;
  return r!.n;
}

/**
 * Runs every consumer until all have read what they handle: the others' (people, content, messaging, work), then
 * ranking's, then the others again for what ranking published (work's tiers and flags, people's shell facts).
 */
export async function drain(w: RankingWorld): Promise<void> {
  await drainWork(w);
  const c = copiesConsumer({ sql: w.ranking });
  for (let i = 0; i < 200 && (await pending(w.ranking, COPIES_CONSUMER, COPY_EVENTS)) > 0; i++) await c.runOnce();
  if ((await pending(w.ranking, COPIES_CONSUMER, COPY_EVENTS)) > 0) throw new Error("ranking's copies consumer did not catch up");
  await drainWork(w);
  // people's shell facts (ranking's fact.value_changed) live in people's copies consumer.
  const p = peopleCopies({ sql: w.people });
  for (let i = 0; i < 200 && (await pending(w.people, PEOPLE_CONSUMER, PEOPLE_COPIES)) > 0; i++) await p.runOnce();
}

let day = 0;
/**
 * The nightly run as the jobs run it (one committed step at a time), then everyone reads what it published. A run
 * is one per PKT day, so each call takes the next day unless given a moment.
 */
export async function nightly(w: RankingWorld, asOf = new Date(Date.now() + ++day * 86_400_000)): Promise<string | null> {
  await drain(w);
  const stage = await runAll(w.ranking as never, asOf);
  await drain(w);
  return stage;
}

/** ranking's copy of a society's verification (the Record's 30-day hold), for community's hand-off tests (W7). */
export const societyCopyOf = (w: RankingWorld, societyId: string) =>
  w.ranking<{ status: string; verified: boolean }[]>`select status, verified_at is not null as verified from ranking.societies where society_id = ${societyId}`.then((r) => [...r]);

/** ranking's copy of a user's Record entries (record.sealed and record.revoked), for credentials' hand-off tests (W8). */
export const recordCopyOf = (w: RankingWorld, userId: string) =>
  w.ranking<{ kind: string; status: string; evidence: Record<string, unknown> }[]>`
    select kind, status, evidence from ranking.record_entries where user_id = ${userId} order by kind, status`.then((r) => [...r]);

/** Publishes a student's score with a tier and percentile (ranking's own row), for credentials' CV tests (W8). */
export const publishTier = (w: RankingWorld, userId: string, tier: string, percentile: number) =>
  w.ranking`insert into ranking.ranking_scores (user_id, formula_version, components, proof, momentum, adjustments, total, ranked, tier, percentile, computed_at, published_at)
            values (${userId}, 2, '{}', 0, 0, 0, 120, true, ${tier}, ${percentile}, now(), now())
            on conflict (user_id) do update set tier = excluded.tier, percentile = excluded.percentile`.then(() => undefined);
