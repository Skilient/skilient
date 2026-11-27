/**
 * W7 done-when: the seat-lock concurrency test (apps/web/tests/worker/event-seats.test.ts) through community's
 * contract on both transports. 120 students call RegisterEvent at the same moment for a ticket type with 50 seats:
 * exactly 50 are confirmed and 70 waitlisted at positions 1..70. A second registration by the same student, even
 * in parallel, is refused and leaves one row. Then 10 confirmed students cancel at once and the waitlist moves up
 * in order, under the same row lock. Community gets a 30-connection pool here, so the registrations really race in
 * Postgres (the world's default pool has 2).
 */
import { randomBytes } from "node:crypto";
import { ConnectError } from "@connectrpc/connect";
import { CommunityService } from "@skilient/contracts/community/v1/community_pb";
import { refusalReason } from "@skilient/platform";
import { describeTransports, type TransportOptions } from "@skilient/testing";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import { publishAs } from "../../../content/test/contract/world";
import { NUTECH } from "../../../people/test/contract/world";
import { helpers } from "../contract/helpers";
import { communityWorld, drain, stopWorlds, type CommunityWorld } from "../contract/world";

const N = 120;
const SEATS = 50;
const worlds: CommunityWorld[] = [];
let w: CommunityWorld;
const pools: postgres.Sql[] = [];
afterAll(async () => {
  await Promise.all(pools.map((p) => p.end({ timeout: 1 })));
  await stopWorlds(worlds);
});

/** The community world with a 30-connection pool for community. */
function racingWorld(): () => Promise<TransportOptions> {
  const start = communityWorld((x) => (w = x), worlds);
  return async () => {
    const o = await start();
    const password = randomBytes(18).toString("base64url");
    await w.pg.admin.unsafe(`alter role svc_community password '${password}'`);
    const c = w.pg.container;
    const big = postgres({ host: c.getHost(), port: c.getPort(), database: c.getDatabase(), username: "svc_community", password, max: 30, onnotice: () => {} });
    // The world's own handle reconnects with the new password too.
    const small = postgres({ host: c.getHost(), port: c.getPort(), database: c.getDatabase(), username: "svc_community", password, max: 4, onnotice: () => {} });
    pools.push(big, small);
    w.community = small;
    return { ...o, database: (s: string) => (s === "community" ? big : o.database!(s)) };
  };
}

describeTransports(
  ["identity", "people", "content", "messaging", "realtime", "work", "ranking", "community"],
  (env) => {
    const h = helpers(env, () => w);
    const community = () => env().client(CommunityService);

    describe("event-seats: no oversell under 120 concurrent students", () => {
      const students: { id: string; token: string }[] = [];
      let eventId = "";
      let ticketId = "";
      // 120 registrations queue on one row lock; the test is about no oversell, so a call may wait longer than the 2 s
      // call deadline (latency under load is W15's).
      const register = (s: { token: string }) => community().registerEvent({ eventId, ticketTypeId: ticketId, answersJson: "[]" }, { ...h.as(s.token), timeoutMs: 60_000 });

      it("confirms exactly 50 and waitlists the rest at 1..70", async () => {
        const officer = await h.onboarded("Seat Officer");
        const s = await h.society(officer);
        ({ eventId, ticketId } = await h.event(officer, s.id, { seats: SEATS }));
        // 120 onboarded students, as people publishes them (community copies profile.updated).
        for (let i = 0; i < N; i++) {
          const id = crypto.randomUUID();
          await publishAs(w.people, "profile.updated", [id], {
            user_id: id,
            role: "student",
            university_id: NUTECH.id,
            department_hash: null,
            graduation_year: 2027,
            visibility: "university",
            status: "active",
            onboarding_complete: true,
          });
          students.push({ id, token: await w.token(id, "aal1") });
        }
        await drain(w);

        const results = await Promise.all(students.map((x) => register(x).then((r) => ({ ok: true as const, r }), (e: unknown) => ({ ok: false as const, e }))));
        expect(results.filter((r) => !r.ok).map((r) => (r.ok ? "" : String((r.e as Error).message)))).toEqual([]);
        const statuses = results.map((r) => (r.ok ? r.r.status : ""));
        expect(statuses.filter((x) => x === "confirmed")).toHaveLength(SEATS);
        expect(statuses.filter((x) => x === "waitlisted")).toHaveLength(N - SEATS);

        const rows = await w.community<{ status: string; waitlist_position: number | null }[]>`
          select status, waitlist_position from community.event_registrations where event_id = ${eventId}`;
        expect(rows).toHaveLength(N);
        expect(rows.filter((r) => r.status === "confirmed")).toHaveLength(SEATS);
        const positions = rows.filter((r) => r.status === "waitlisted").map((r) => r.waitlist_position!).sort((a, b) => a - b);
        expect(positions).toEqual(Array.from({ length: N - SEATS }, (_, i) => i + 1));
      });

      it("refuses a second registration by the same student, even in parallel", async () => {
        const twice = await Promise.all([0, 1, 2].map(() => register(students[0]!).then(() => null, (e: unknown) => (e instanceof ConnectError ? refusalReason(e) : String(e)))));
        expect(twice).toEqual(["already_registered", "already_registered", "already_registered"]);
        const [n] = await w.community<{ n: number }[]>`select count(*)::int as n from community.event_registrations where event_id = ${eventId} and user_id = ${students[0]!.id}`;
        expect(n!.n).toBe(1);
      });

      it("moves the waitlist up in order when 10 confirmed students cancel at once", async () => {
        const confirmed = await w.community<{ user_id: string }[]>`
          select user_id::text from community.event_registrations where event_id = ${eventId} and status = 'confirmed' limit 10`;
        const firstTen = await w.community<{ user_id: string }[]>`
          select user_id::text from community.event_registrations where event_id = ${eventId} and status = 'waitlisted' order by waitlist_position limit 10`;
        const byId = new Map(students.map((x) => [x.id, x]));
        const cancels = await Promise.all(
          confirmed.map((c) => community().cancelRegistration({ eventId }, { ...h.as(byId.get(c.user_id)!.token), timeoutMs: 60_000 }).then(() => null, (e: unknown) => String(e))),
        );
        expect(cancels.filter((x) => x !== null)).toEqual([]);
        const [counts] = await w.community<{ confirmed: number; waitlisted: number; cancelled: number }[]>`
          select count(*) filter (where status = 'confirmed')::int as confirmed, count(*) filter (where status = 'waitlisted')::int as waitlisted,
                 count(*) filter (where status = 'cancelled')::int as cancelled
            from community.event_registrations where event_id = ${eventId}`;
        expect(counts).toEqual({ confirmed: SEATS, waitlisted: N - SEATS - 10, cancelled: 10 });
        const promoted = await w.community<{ user_id: string }[]>`
          select user_id::text from community.event_registrations where event_id = ${eventId} and status = 'confirmed' and user_id = any(${firstTen.map((r) => r.user_id)}::uuid[])`;
        expect(promoted).toHaveLength(10);
      });
    });
  },
  racingWorld(),
);
