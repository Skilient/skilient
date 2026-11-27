/**
 * The contract world for people: Postgres 17 with identity's and people's schemas, each under its own role,
 * both services co-hosted (people calls identity for staff roles, personal domains and sign-up details).
 * Tokens are minted with identity's signing key at the account's current token version (identity's
 * staff-world.ts), so a test can act as any user at aal1 or aal2. One world per transport.
 *
 * Accounts are created the way they arrive in production: identity holds the account, people's lifecycle
 * consumer creates the profile from identity's user.created (or, for fixtures, people's own handler is
 * called with the details identity would return).
 */
import { join } from "node:path";
import { appendEvents, uuidv7 } from "@skilient/platform";
import type { TransportOptions } from "@skilient/testing";
import type postgres from "postgres";
import { addFactor, staffWorld, type StaffWorld } from "../../../identity/test/contract/staff-world";
import { createUser } from "../../../identity/test/contract/world";
import { gateFactsConsumer, GATE_CONSUMER } from "../../../identity/src/store/gate-copies";
import { importPersonalDomains } from "../../../identity/src/store/import";
import { signupDetails } from "../../../identity/src/store/signup";
import { lifecycleConsumer } from "../../src/store/lifecycle";
import { applyUserCreated } from "../../src/store/lifecycle";
import { profileFlags, publishProfile } from "../../src/store/publish";
import { publishDomains } from "../../src/store/universities";

export const MIGRATIONS = join(import.meta.dirname, "../../migrations");
export const PASSWORD = "People-contract-Passw0rd!";

/** Two live universities (as nutech.edu.pk and nu.edu.pk are on the local stack), one with its own departments. */
export const NUTECH = { id: "9a000000-0000-4000-8000-0000000000f1", name: "National University of Technology (NUTECH)", slug: "nutech-contract", domain: "nutech-contract.test" };
export const NU = { id: "9a000000-0000-4000-8000-0000000000f2", name: "FAST NUCES", slug: "nu-contract", domain: "nu-contract.test" };
export const CLOSED = { id: "9a000000-0000-4000-8000-0000000000f3", name: "Closed Contract University", slug: "closed-contract", domain: "closed-contract.test" };
export const PERSONAL_DOMAIN = "mail-contract.test";

export interface PeopleWorld extends StaffWorld {
  people: postgres.Sql;
}

export function contractEnv(): void {
  process.env["PEOPLE_JOBS"] = "off";
}

export function peopleWorld(onWorld: (w: PeopleWorld) => void, worlds: PeopleWorld[] = []): () => Promise<TransportOptions> {
  contractEnv();
  let base: StaffWorld | undefined;
  const start = staffWorld((w) => (base = w), []);
  return async () => {
    const o = await start();
    const people = await base!.pg.service("people", MIGRATIONS);
    const w: PeopleWorld = { ...base!, people };
    await seed(w);
    worlds.push(w);
    onWorld(w);
    return { ...o, database: (s: string) => (s === "people" ? people : base!.sql) };
  };
}

export async function stopWorlds(worlds: PeopleWorld[]): Promise<void> {
  for (const w of worlds) {
    await w.revocations.stop();
    await w.pg.stop();
  }
}

/** Universities and departments in people, published to identity's gate copy; identity's personal-domain list. */
async function seed(w: PeopleWorld): Promise<void> {
  await w.people.begin(async (tx) => {
    for (const u of [NUTECH, NU, CLOSED]) {
      await tx`insert into people.universities (id, name, slug, live_at) values (${u.id}, ${u.name}, ${u.slug}, ${u === CLOSED ? null : new Date(Date.now() - 86_400_000)})`;
      await tx`insert into people.university_domains (university_id, domain, kind, source) values (${u.id}, ${u.domain}, 'both', 'ops')`;
    }
    for (const name of ["Computer Science", "Software Engineering"]) await tx`insert into people.departments (id, university_id, name) values (${uuidv7()}, ${NUTECH.id}, ${name})`;
    await publishDomains(tx, [NUTECH.id, NU.id, CLOSED.id]);
  });
  await importPersonalDomains(w.sql, [PERSONAL_DOMAIN]);
  await drainGate(w);
}

/** Applies every pending gate event in identity (the consumer sees only transactions older than every open one). */
export async function drainGate(w: PeopleWorld): Promise<void> {
  const gate = gateFactsConsumer({ sql: w.sql });
  for (let i = 0; i < 50; i++) {
    // Asked as identity: each role sees only its own applied-event rows.
    const [pending] = await w.sql`
      select count(*)::int as n from platform.events e
       where e.type in ('university.domains_changed', 'profile.gate_changed')
         and not exists (select 1 from platform.applied_events a where a.consumer = ${GATE_CONSUMER} and a.event_id = e.id)`;
    if (pending!.n === 0) return;
    await gate.runOnce();
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error("identity's gate consumer did not catch up");
}

/** people.lifecycle with identity's sign-up details read (what the service's GetSignupDetails call returns). */
export function lifecycle(w: PeopleWorld) {
  return lifecycleConsumer({
    sql: w.people,
    details: async (ids) => new Map((await signupDetails(w.sql, ids)).map((r) => [r.user_id, { fullName: r.full_name, emailDomain: r.email_domain }])),
  });
}

/** Runs people's lifecycle consumer until it has read every identity event written so far. */
export async function drainLifecycle(w: PeopleWorld): Promise<void> {
  const c = lifecycle(w);
  for (let i = 0; i < 50; i++) {
    const [pending] = await w.people`
      select count(*)::int as n from platform.events e
       where e.producer = 'svc_identity' and e.type like 'user.%'
         and not exists (select 1 from platform.applied_events a where a.consumer = 'people.lifecycle' and a.event_id = e.id)`;
    if (pending!.n === 0) return;
    await c.runOnce();
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error("people's lifecycle consumer did not catch up");
}

let n = 0;
export const unique = (domain: string, tag = "p") => `${tag}-${Date.now().toString(36)}-${++n}@${domain}`;

export interface TestUser {
  id: string;
  email: string;
  token: string;
}

/**
 * A student: the identity account, and the profile people creates from what user.created and
 * GetSignupDetails carry. `onboard` finishes onboarding with a username, department and batch as the wizard
 * would (people's own rows).
 */
export async function student(
  w: PeopleWorld,
  opts: { uni?: typeof NUTECH; fullName?: string; onboard?: { username?: string; department?: string; year?: number; visibility?: string } | false; staffRoles?: string[] } = {},
): Promise<TestUser> {
  const uni = opts.uni ?? NUTECH;
  const email = unique(uni.domain);
  const id = await createUser(w.sql, email, PASSWORD, { roles: opts.staffRoles ?? [] });
  if (opts.staffRoles?.length) await addFactor(w.sql, id);
  await w.people.begin((tx) =>
    applyUserCreated(
      tx,
      id,
      { role: "student", university_id: uni.id, visibility: "university", onboarding_complete: false, onboarding_step: 1, onboarding_completed_at: null, status: "active" },
      new Map([[id, { fullName: opts.fullName ?? "Test Student", emailDomain: uni.domain }]]),
    ),
  );
  if (opts.onboard !== false) {
    const o = opts.onboard ?? {};
    const username = o.username ?? `u${Date.now().toString(36)}${++n}`;
    // As the wizard's last step: the rows, then profile.updated for the services that copy it (W3).
    await w.people.begin(async (tx) => {
      const before = await profileFlags(tx, id);
      await tx`
        update people.profiles p set username = ${username}, department = ${o.department ?? "Computer Science"}, graduation_year = ${o.year ?? 2027},
               visibility = ${o.visibility ?? "university"}, onboarding_complete = true,
               department_id = (select d.id from people.departments d where d.university_id = p.university_id and lower(d.name) = lower(${o.department ?? "Computer Science"}))
         where user_id = ${id}`;
      await tx`update people.onboarding_state set step = 6, completed_at = now() where user_id = ${id}`;
      await publishProfile(tx, id, before);
    });
  }
  return { id, email, token: await w.token(id, opts.staffRoles?.length ? "aal2" : "aal1") };
}

/** The username people holds for a user. */
export async function usernameOf(w: PeopleWorld, id: string): Promise<string> {
  const [r] = await w.people<{ username: string }[]>`select username from people.profiles where user_id = ${id}`;
  return r!.username;
}

/** Publishes an event as another service would (for the copies), from that service's own role. */
export async function publishAs(w: PeopleWorld, role: postgres.Sql, type: string, payload: Record<string, unknown>): Promise<void> {
  void w;
  await role.begin((tx) => appendEvents(tx, [{ type, subjects: typeof payload["user_id"] === "string" ? [payload["user_id"]] : [], payload }]));
}

/** The shell facts people holds for a user (fact.value_changed keys), for the owners' tests (W6 ranking). */
export const factKeysOf = (w: PeopleWorld, userId: string) =>
  w.people<{ key: string }[]>`select key from people.fact_values where user_id = ${userId} order by key`.then((r) => r.map((x) => x.key));

/** people's copy of a group's members (suggestions, labels), for the owners' hand-off tests (W5, W7). */
export const groupMembersOf = (w: PeopleWorld, kind: "venture" | "society", groupId: string) =>
  w.people<{ user_id: string }[]>`select user_id::text from people.group_members where kind = ${kind} and group_id = ${groupId} order by user_id`.then((r) => r.map((x) => x.user_id));
