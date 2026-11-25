/**
 * The gate-fact copies (decision 2026-11-25, Q1) and the sign-up tables. Each consumer applies an event once
 * (a replay changes nothing), applies only events from the owning service (any service can append to the
 * log, so a forged producer is refused), and skips an event it cannot read without stopping. Another
 * service's role can neither read nor write the new tables, and a `user.created` payload never carries an
 * email or a name.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendEvents, uuidv7, type Consumer } from "@skilient/platform";
import { startPostgres, type TestDatabase } from "@skilient/testing/postgres";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { gateFactsConsumer } from "../../src/store/gate-copies";
import { readGateState } from "../../src/store/gate";
import { createAccount } from "../../src/store/signup";

const MIGRATIONS = join(import.meta.dirname, "../../migrations");
const UNI = "9a000000-0000-4000-8000-0000000000b1";

describe("gate-fact copies and sign-up tables", () => {
  let pg: TestDatabase;
  let identity: postgres.Sql;
  let people: postgres.Sql;
  let trust: postgres.Sql;
  let market: postgres.Sql;
  let consumer: Consumer;
  const empty = () => mkdtempSync(join(tmpdir(), "mig-"));

  beforeAll(async () => {
    pg = await startPostgres();
    identity = await pg.service("identity", MIGRATIONS);
    people = await pg.service("people", empty());
    trust = await pg.service("trust", empty());
    market = await pg.service("market", empty());
    consumer = gateFactsConsumer({ sql: identity });
  });
  afterAll(async () => {
    await pg?.stop();
  });

  const emit = (db: postgres.Sql, type: string, payload: Record<string, unknown>, id = uuidv7()) =>
    db.begin((tx) => appendEvents(tx, [{ id, type, payload }])).then(() => id);
  /** Replays an event the consumer already applied: the platform's applied-ids table must stop it. */
  const replayEvent = async (id: string) => {
    await pg.admin`update platform.cursors set last_txid = '0'::xid8, last_seq = 0 where consumer = 'identity.gate-facts'`;
    return id;
  };
  const drain = async () => {
    while ((await consumer.runOnce()) > 0);
  };

  it("university.domains_changed (people) replaces a university's domains, once", async () => {
    const id = await emit(people, "university.domains_changed", {
      university_id: UNI,
      live_at: "2026-01-01T00:00:00Z",
      domains: [
        { domain: "Copy-Uni.test", kind: "both" },
        { domain: "staff.copy-uni.test", kind: "faculty" },
      ],
    });
    await drain();
    expect(await identity`select domain, kind from identity.allowed_domains where university_id = ${UNI} order by domain`).toEqual([
      { domain: "copy-uni.test", kind: "both" },
      { domain: "staff.copy-uni.test", kind: "faculty" },
    ]);
    await emit(people, "university.domains_changed", { university_id: UNI, live_at: null, domains: [{ domain: "copy-uni.test", kind: "student" }] });
    await drain();
    // The first event again changes nothing: it was applied already.
    await replayEvent(id);
    await drain();
    expect(await identity`select domain, kind, university_live_at from identity.allowed_domains where university_id = ${UNI}`).toEqual([
      { domain: "copy-uni.test", kind: "student", university_live_at: null },
    ]);
  });

  it("config.portals_changed (trust) sets the portals flag; a forged producer is ignored", async () => {
    await emit(people, "config.portals_changed", { recruiter: true, university: true, faculty: false }); // not trust's
    await drain();
    expect(await identity`select value from identity.gate_config`).toEqual([]);
    await emit(trust, "config.portals_changed", { recruiter: true, university: false, faculty: true });
    await drain();
    expect(await identity`select value from identity.gate_config where key = 'portals.enabled'`).toEqual([{ value: { recruiter: true, university: false, faculty: true } }]);
  });

  it("profile.gate_changed (people) and org.member_changed (market) update the gate state", async () => {
    const user = uuidv7();
    await identity`insert into identity.users (id, email) values (${user}, 'hr@copy-company.test')`;
    const facts = { user_id: user, has_profile: true, role: "recruiter", university_id: null, onboarding_complete: true, onboarding_step: 6, status: "active" };
    await emit(people, "profile.gate_changed", facts);
    await emit(market, "org.member_changed", { user_id: user, org_domain: "other-company.test" });
    await drain();
    let state = await identity.begin((tx) => readGateState(tx, user));
    expect([state.has_profile, state.role, state.email_allowed]).toEqual([true, "recruiter", false]); // not the org's domain
    await emit(market, "org.member_changed", { user_id: user, org_domain: "copy-company.test" });
    await emit(market, "profile.gate_changed", { ...facts, status: "deleting" }); // forged: people owns profiles
    await drain();
    state = await identity.begin((tx) => readGateState(tx, user));
    expect([state.email_allowed, state.status]).toEqual([true, "active"]);
    await emit(people, "profile.gate_changed", { ...facts, has_profile: false, role: "recruiter" });
    await drain();
    state = await identity.begin((tx) => readGateState(tx, user));
    expect([state.has_profile, state.email_allowed]).toEqual([false, false]);
  });

  it("skips an unreadable event without stopping the copies", async () => {
    await emit(people, "university.domains_changed", { university_id: "nope", domains: "x" });
    await emit(people, "university.domains_changed", { university_id: UNI, live_at: null, domains: [{ domain: "after-bad.test", kind: "both" }] });
    await drain();
    expect(await identity`select domain from identity.allowed_domains where university_id = ${UNI}`).toEqual([{ domain: "after-bad.test" }]);
  });

  it("facts for an account identity does not know are dropped", async () => {
    const ghost = uuidv7();
    await emit(people, "profile.gate_changed", { user_id: ghost, has_profile: true, role: "student", university_id: null, onboarding_complete: false, onboarding_step: 1, status: "active" });
    await emit(market, "org.member_changed", { user_id: ghost, org_domain: "x.test" });
    await drain();
    expect(await identity`select 1 from identity.profile_facts where user_id = ${ghost}`).toEqual([]);
    expect(await identity`select 1 from identity.recruiter_org_domains where user_id = ${ghost}`).toEqual([]);
  });

  it.each(["gate_config", "profile_facts", "recruiter_org_domains", "signup_details", "email_codes", "identities"])(
    "identity.%s refuses every other service",
    async (table) => {
      for (const other of [people, trust, market]) {
        await expect(other.unsafe(`select * from identity.${table} limit 1`)).rejects.toThrow(/permission denied/);
        await expect(other.unsafe(`insert into identity.${table} default values`)).rejects.toThrow(/permission denied/);
        await expect(other.unsafe(`delete from identity.${table}`)).rejects.toThrow(/permission denied/);
      }
    },
  );

  it("user.created carries no email and no name; the name stays in identity", async () => {
    await identity`insert into identity.allowed_domains (domain, university_id, kind, university_live_at) values ('payload-uni.test', ${UNI}, 'both', now())`;
    const { userId } = await identity.begin((tx) => createAccount(tx, { email: "Named.Person@payload-uni.test", fullName: "Named Person", provider: "email", confirmed: false }));
    const [event] = await identity<{ payload: Record<string, unknown> }[]>`select payload from platform.events where type = 'user.created' and ${userId}::uuid = any(subjects)`;
    const text = JSON.stringify(event!.payload).toLowerCase();
    expect(text).not.toContain("named");
    expect(text).not.toContain("payload-uni.test");
    expect(await identity`select full_name from identity.signup_details where user_id = ${userId}`).toEqual([{ full_name: "Named Person" }]);
  });
});
