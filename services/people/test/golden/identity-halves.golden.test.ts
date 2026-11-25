/**
 * People's half of identity's goldens (W1 left them to W2: services/identity/test/golden/replay.ts, FOREIGN).
 * The recorded `public.profiles` and `public.onboarding_state` changes in identity's signup.json and
 * deletion.json are produced here end to end: identity's own account creation emits user.created, people's
 * lifecycle consumer reads it (with identity's GetSignupDetails store read as its batch port) and writes the
 * rows; the deletion events drive the status mirror and the removal. Both services run in one Postgres with
 * their own roles; this file never names identity's schema (it calls identity's code).
 */
import { join } from "node:path";
import { appendEvents } from "@skilient/platform";
import { startPostgres, type TestDatabase } from "@skilient/testing/postgres";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyDomainsChanged, applyPortalsChanged } from "../../../identity/src/store/gate-copies";
import { createAccount, signupDetails, type NewAccount } from "../../../identity/src/store/signup";
import { lifecycleConsumer } from "../../src/store/lifecycle";
import { normalise } from "@skilient/testing";
import { MIGRATIONS, recordedIdentity, renumber as renumberPlaceholders } from "./replay";

/** Normalises raw ids and times the way the recorder did, then numbers placeholders by first appearance. */
const renumber = (v: unknown) => renumberPlaceholders(normalise(v));

const IDENTITY_MIGRATIONS = join(import.meta.dirname, "../../../identity/migrations");
const UNI = "9a000000-0000-4000-8000-000000000001";
const NEWBIE = "9b000000-0000-4000-8000-000000000005";
const EXTRA = "9b000000-0000-4000-8000-000000000006";
const STUDENT = "9b000000-0000-4000-8000-000000000001";

let pg: TestDatabase;
let identity: postgres.Sql;
let people: postgres.Sql;

beforeAll(async () => {
  pg = await startPostgres();
  identity = await pg.service("identity", IDENTITY_MIGRATIONS);
  people = await pg.service("people", MIGRATIONS);
  await identity.begin(async (tx) => {
    await applyPortalsChanged(tx, { recruiter: true, university: true, faculty: true });
    await applyDomainsChanged(tx, { university_id: UNI, live_at: new Date(Date.now() - 86_400_000).toISOString(), domains: [{ domain: "golden-uni.test", kind: "both" }] });
  });
  await people`insert into people.universities (id, name, slug) values (${UNI}, 'Golden University', 'golden-university')`;
});
afterAll(async () => pg?.stop());

/** people.lifecycle with identity's signup-details read as its prepare port (the service calls GetSignupDetails). */
const consumer = () =>
  lifecycleConsumer({
    sql: people,
    details: async (ids) => new Map((await signupDetails(identity, ids)).map((r) => [r.user_id, { fullName: r.full_name, emailDomain: r.email_domain }])),
  });

/** The recorded profile and onboarding columns, from people's schema. */
async function peopleRows(ids: readonly string[]) {
  const profiles = await people`
    select delete_after, full_name, onboarding_complete, role, status, university_id, user_id, visibility from people.profiles
     where user_id = any(${[...ids]}::uuid[]) order by user_id`;
  const onboarding = await people`
    select case when completed_at is null then null else '<time>' end as completed_at, role, step, user_id from people.onboarding_state
     where user_id = any(${[...ids]}::uuid[]) order by user_id`;
  return JSON.parse(JSON.stringify({ profiles, onboarding })) as { profiles: Record<string, unknown>[]; onboarding: Record<string, unknown>[] };
}
const masked = (rows: Record<string, unknown>[]) => rows.map((r) => ({ ...r, ...(r["delete_after"] ? { delete_after: "<time>" } : {}) }));

function account(id: string, email: string, meta: Record<string, string>, provider: "email" | "google" = "email"): NewAccount {
  return { id, email, provider, role: (meta["role"] as NewAccount["role"]) ?? null, universityId: meta["university_id"] ?? null, fullName: meta["full_name"] ?? null, confirmed: true };
}

describe("identity goldens, people's half", () => {
  it("signup.json#handle_new_user and #handle_new_user_roles: the rows people creates from user.created", async () => {
    const cases: [string, string, NewAccount][] = [
      ["handle_new_user", "student_with_agreement", account(NEWBIE, "golden.newbie@golden-uni.test", { full_name: "Golden Newbie" })],
      ["handle_new_user", "student_without_agreement", account(EXTRA, "golden.extra@golden-uni.test", {})],
      ["handle_new_user_roles", "faculty", account("9b000000-0000-4000-8000-0000000000b6", "golden.prof@golden-uni.test", { role: "faculty", university_id: UNI })],
      ["handle_new_user_roles", "recruiter", account("9b000000-0000-4000-8000-0000000000b5", "golden.hr@golden-company.test", { role: "recruiter", full_name: "Golden HR" })],
    ];
    for (const [group, name, input] of cases) {
      await identity.begin((tx) => createAccount(tx, input));
      await consumer().runOnce();
      const rows = await peopleRows([input.id!]);
      const recorded = recordedIdentity("signup", group, name) as Record<string, { added: unknown[]; removed: unknown[] }>;
      expect(renumber({ "public.onboarding_state": rows.onboarding, "public.profiles": masked(rows.profiles) }), `${group}#${name}`).toEqual(
        renumber({ "public.onboarding_state": recorded["public.onboarding_state"]!.added, "public.profiles": recorded["public.profiles"]!.added }),
      );
    }
    // A replayed user.created changes nothing (the consumer records applied ids; the handler is idempotent too).
    expect(await consumer().runOnce()).toBe(0);
  });

  it("deletion.json#request_cancel and #delete_account: the status mirror and the removal", async () => {
    await identity.begin((tx) => createAccount(tx, account(STUDENT, "golden.student@golden-uni.test", { full_name: "Golden 1" })));
    await consumer().runOnce();
    // The recording's student had finished onboarding (people's own rows, set as the seed did).
    await people`update people.profiles set onboarding_complete = true, username = 'golden1' where user_id = ${STUDENT}`;
    await people`update people.onboarding_state set step = 6, completed_at = now() where user_id = ${STUDENT}`;
    const emit = (type: string, payload: Record<string, unknown> = {}) => identity.begin((tx) => appendEvents(tx, [{ type, subjects: [STUDENT], payload }]));
    const changeOf = async (run: () => Promise<unknown>) => {
      const before = masked((await peopleRows([STUDENT])).profiles);
      await run();
      await consumer().runOnce();
      const after = masked((await peopleRows([STUDENT])).profiles);
      return { added: after.filter((r) => !before.some((b) => JSON.stringify(b) === JSON.stringify(r))), removed: before.filter((b) => !after.some((r) => JSON.stringify(b) === JSON.stringify(r))) };
    };
    const requested = await changeOf(() => emit("user.deletion_requested", { delete_after: new Date(Date.now() + 14 * 86_400_000).toISOString() }));
    const cancelled = await changeOf(() => emit("user.deletion_cancelled"));
    const rec = recordedIdentity("deletion", "request_cancel") as Record<string, { changes: Record<string, unknown> }>;
    expect(renumber({ requested, cancelled })).toEqual(renumber({ requested: rec["requested"]!.changes["public.profiles"], cancelled: rec["cancelled"]!.changes["public.profiles"] }));

    await emit("user.deletion_requested", { delete_after: new Date(Date.now() - 60_000).toISOString() });
    await consumer().runOnce();
    const before = await peopleRows([STUDENT]);
    await emit("user.deleted", { user_id: STUDENT });
    await consumer().runOnce();
    const after = await peopleRows([STUDENT]);
    expect(after).toEqual({ profiles: [], onboarding: [] });
    const del = (recordedIdentity("deletion", "delete_account") as Record<string, { changes: Record<string, { removed: unknown[] }> }>)["deleted"]!.changes;
    expect(renumber({ "public.onboarding_state": before.onboarding, "public.profiles": masked(before.profiles) })).toEqual(
      renumber({ "public.onboarding_state": del["public.onboarding_state"]!.removed, "public.profiles": del["public.profiles"]!.removed }),
    );
    // People confirms the deletion to identity, once.
    const confirmations = await people`select subjects::text[] as subjects from platform.events where type = 'user.deletion_confirmed' and producer = 'svc_people'`;
    expect(confirmations).toEqual([{ subjects: [STUDENT] }]);
  });
});
