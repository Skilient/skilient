/**
 * The W2 done-when: "Shell call meets its budget" (docs/azure/prd.md, performance budgets: at most 3 calls
 * per page, one database trip per read; perf/budgets.json gives GetShell a p95 of 30 ms). GetShell is called
 * as web calls it, on both transports, for a student with friends, requests and every copied fact present,
 * and people's database connection counts the queries each call makes.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PeopleService } from "@skilient/contracts/people/v1/people_pb";
import { describeTransports } from "@skilient/testing";
import { afterAll, expect, it } from "vitest";
import { applyCopyEvent } from "../../src/store/copies";
import { peopleWorld, student, stopWorlds, type PeopleWorld } from "../contract/world";

const budgets = JSON.parse(readFileSync(join(import.meta.dirname, "../../../../perf/budgets.json"), "utf8")) as Record<string, { p95Ms: number; dbTrips: number }>;
const SHELL = budgets["skilient.people.v1.PeopleService/GetShell"]!;
const worlds: PeopleWorld[] = [];
let w: PeopleWorld;
let queries = 0;
afterAll(async () => {
  await stopWorlds(worlds);
});

/**
 * people's own connection (svc_people) counts every query it sends: postgres.js reads `options.debug` per
 * query, so installing it on the world's connection counts what the host's people service sends.
 */
const counting = peopleWorld((x) => (w = x), worlds);
async function options() {
  const o = await counting();
  (w.people.options as { debug?: unknown }).debug = () => void queries++;
  return o;
}

describeTransports(
  ["identity", "people"],
  (env) => {
    it(`GetShell: one database trip, p95 within ${SHELL.p95Ms} ms`, async () => {
      const me = await student(w, { fullName: "Budget Student" });
      const others = await Promise.all(Array.from({ length: 5 }, (_, i) => student(w, { fullName: `Friend ${i}` })));
      await w.people.begin(async (tx) => {
        for (const o of others.slice(0, 3)) await tx`insert into people.friendships (user_id_a, user_id_b) values (least(${me.id}::uuid, ${o.id}::uuid), greatest(${me.id}::uuid, ${o.id}::uuid))`;
        for (const o of others.slice(3)) await tx`insert into people.friend_requests (id, sender_id, receiver_id) values (gen_random_uuid(), ${o.id}, ${me.id})`;
        for (const [producer, key, count] of [["svc_notify", "notifications", 4], ["svc_messaging", "chat", 2], ["svc_work", "ventures.invites", 1], ["svc_market", "openings", 7]] as const)
          await applyCopyEvent(tx, { type: "badge.count_changed", producer, version: 1, payload: { user_id: me.id, key, count } });
        await applyCopyEvent(tx, { type: "milestone.reached", producer: "svc_work", version: 1, payload: { user_id: me.id, key: "github.connected" } });
        await applyCopyEvent(tx, { type: "fact.value_changed", producer: "svc_ranking", version: 1, payload: { user_id: me.id, key: "tier.points", value: { l2: 15, venture: 150, endorsement: 15 } } });
      });
      const people = env().client(PeopleService);
      const call = () => people.getShell({}, env().call({ userToken: me.token }));
      for (let i = 0; i < 20; i++) await call(); // warm up connections and prepared statements
      const first = await call();
      expect(first.badges).toEqual(expect.objectContaining({ friends: 2, notifications: 4, chat: 2, ventures: 1, openings: 7 }));

      const N = 200;
      const before = queries;
      const times: number[] = [];
      for (let i = 0; i < N; i++) {
        const t0 = performance.now();
        await call();
        times.push(performance.now() - t0);
      }
      const trips = (queries - before) / N;
      times.sort((a, b) => a - b);
      const p95 = times[Math.floor(N * 0.95)]!;
      expect(trips).toBe(SHELL.dbTrips);
      expect(p95).toBeLessThan(SHELL.p95Ms);
      console.info(`GetShell over ${env().transport}: p95 ${p95.toFixed(1)} ms, ${trips} database trip(s) per call`);
    });
  },
  options,
);
