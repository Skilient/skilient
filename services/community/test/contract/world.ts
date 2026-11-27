/**
 * The contract world for community: ranking's world (identity, people, content, messaging, realtime, work and
 * ranking, each under its own role) plus community's schema, and a ticket key generated for the run (passed as
 * the Key Vault secret community-ticket-key through TransportOptions.secrets; never stored). Community's
 * background work is off: tests run the copies consumers with `drain` and the jobs with `tick`. Uploaded files
 * are media's (W9): the world's `files` set stands in for media's records.
 */
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import type { TransportOptions } from "@skilient/testing";
import type postgres from "postgres";
import { drain as drainRanking, rankingWorld, type RankingWorld } from "../../../ranking/test/contract/world";
import { copiesConsumer, COPIES_CONSUMER, COPY_EVENTS } from "../../src/store/copies";
import { closeoutTick, eventTick } from "../../src/store/closeout";
import { societyTick } from "../../src/store/inductions";

export const MIGRATIONS = join(import.meta.dirname, "../../migrations");
export { NU, NUTECH, stopWorlds, student } from "../../../ranking/test/contract/world";

export interface CommunityWorld extends RankingWorld {
  community: postgres.Sql;
  ticketKey: Buffer;
}

const ticketKey = randomBytes(32);

export function communityWorld(onWorld: (w: CommunityWorld) => void, worlds: CommunityWorld[] = []): () => Promise<TransportOptions> {
  process.env["COMMUNITY_JOBS"] = "off";
  let base: RankingWorld | undefined;
  const start = rankingWorld((w) => (base = w), []);
  return async () => {
    const o = await start();
    const community = await base!.pg.service("community", MIGRATIONS);
    const w: CommunityWorld = { ...base!, community, ticketKey };
    worlds.push(w);
    onWorld(w);
    const db = o.database!;
    return {
      ...o,
      secrets: { ...o.secrets, "community-ticket-key": ticketKey.toString("base64url") },
      database: (s: string) => (s === "community" ? community : db(s)),
    };
  };
}

async function pending(sql: postgres.Sql, consumer: string, types: readonly string[]): Promise<number> {
  const [r] = await sql<{ n: number }[]>`
    select count(*)::int as n from platform.events e
     where e.type = any(${[...types]}::text[])
       and not exists (select 1 from platform.applied_events a where a.consumer = ${consumer} and a.event_id = e.id)`;
  return r!.n;
}

/** Runs every consumer until all have read what they handle: community's copies, then everyone else's, twice. */
export async function drain(w: CommunityWorld): Promise<void> {
  for (let round = 0; round < 2; round++) {
    const c = copiesConsumer({ sql: w.community });
    for (let i = 0; i < 200 && (await pending(w.community, COPIES_CONSUMER, COPY_EVENTS)) > 0; i++) await c.runOnce();
    if ((await pending(w.community, COPIES_CONSUMER, COPY_EVENTS)) > 0) throw new Error("community's copies consumer did not catch up");
    await drainRanking(w);
  }
}

/** One run of a community job, committed (as the scheduler would run it). */
export async function tick(w: CommunityWorld, job: "society-tick" | "event-tick" | "event-closeout"): Promise<number> {
  const run = job === "society-tick" ? societyTick : job === "event-tick" ? eventTick : closeoutTick;
  return w.community.begin((tx) => run(tx));
}

/** Community's events of a type since a moment (what notify, credentials, trust and media will read). */
export const eventsOf = (w: CommunityWorld, type: string) =>
  w.community<{ payload: Record<string, unknown>; producer: string }[]>`
    select payload, producer from platform.events where type = ${type} order by seq`.then((r) => [...r]);
