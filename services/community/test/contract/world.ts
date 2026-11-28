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

/** Ends an event an hour ago (its sessions too), so its close-out is open (W8 credentials' hand-off tests). */
export async function endEvent(w: CommunityWorld, eventId: string): Promise<void> {
  await w.community`update community.event_sessions set starts_at = now() - interval '3 hours', ends_at = now() - interval '1 hour' where event_id = ${eventId}`;
  await w.community`update community.events set starts_at = now() - interval '3 hours', ends_at = now() - interval '1 hour' where id = ${eventId}`;
}

/** Sets an event's Record kinds and adds a result (W8 credentials' hand-off tests). */
export async function recordKindsAndResult(w: CommunityWorld, eventId: string, userId: string, place: number, label: string | null, setBy: string): Promise<void> {
  await w.community`update community.events set record_kinds = '{attended,completed,result}' where id = ${eventId}`;
  await w.community`insert into community.event_results (id, event_id, user_id, place, label, set_by) values (gen_random_uuid(), ${eventId}, ${userId}, ${place}, ${label}, ${setBy})`;
}

/** Ends an officer's term yesterday and returns its id (W8 credentials' Office bearer entry). */
export async function endTerm(w: CommunityWorld, societyId: string, userId: string): Promise<string> {
  await w.community`update community.society_terms set term_end = current_date - 1, term_start = current_date - 200 where society_id = ${societyId} and user_id = ${userId}`;
  const [t] = await w.community<{ id: string }[]>`select id::text from community.society_terms where society_id = ${societyId} and user_id = ${userId}`;
  return t!.id;
}
