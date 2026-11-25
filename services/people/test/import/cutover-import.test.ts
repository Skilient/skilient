/**
 * Cutover obligations for people (W14): imported universities and profiles land in people's tables and reach
 * identity's gate copies through the events they send, so no imported account fails the sign-up gate.
 * Fixture rows shaped like the Supabase export; no real data, no network.
 */
import { uuidv7 } from "@skilient/platform";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createBareUser, gateDomains, gateProfileFacts } from "../../../identity/test/contract/world";
import { importProfiles, importUniversities } from "../../src/store/import";
import { drainGate, peopleWorld, stopWorlds, type PeopleWorld } from "../contract/world";

const worlds: PeopleWorld[] = [];
let w: PeopleWorld;
beforeAll(async () => {
  await peopleWorld((x) => (w = x), worlds)();
});
afterAll(() => stopWorlds(worlds));

const UNI = "9a000000-0000-4000-8000-0000000000c1";
const DEPT = "9a000000-0000-4000-8000-0000000000c2";
const universities = {
  universities: [{ id: UNI, name: "Imported University", slug: "imported-university", city: "Lahore", province: "Punjab", live_at: "2026-01-01T00:00:00Z", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", owner_id: "ignored-column" }],
  domains: [{ university_id: UNI, domain: "imported-uni.test", kind: "both", source: "hec_seed", created_at: "2026-01-01T00:00:00Z" }],
  departments: [{ id: DEPT, university_id: UNI, name: "Computer Science", created_at: "2026-01-01T00:00:00Z" }],
  programmes: [],
};

describe("cutover import into people", () => {
  it("imports universities once and sends their domains to identity's gate copy", async () => {
    expect(await importUniversities(w.people, universities)).toMatchObject({ universities: 1, domains: 1, departments: 1, domainEvents: 1 });
    expect(await importUniversities(w.people, universities)).toMatchObject({ universities: 0, domains: 0, departments: 0 });
    await drainGate(w);
    expect(await gateDomains(w.sql, UNI)).toEqual([{ domain: "imported-uni.test", kind: "both" }]);
  });

  it("imports profiles with their email domain, and identity's gate then knows each account", async () => {
    const ids = [uuidv7(), uuidv7()];
    const profiles = ids.map((id, i) => ({
      user_id: id,
      role: "student",
      university_id: UNI,
      full_name: `Imported ${i}`,
      username: `imported_${i}_${id.slice(-6)}`,
      department_id: DEPT,
      visibility: "university",
      recruiter_visible: false,
      looking_for: [],
      availability: [],
      onboarding_complete: true,
      status: "active",
      created_at: "2026-02-01T00:00:00Z",
      updated_at: "2026-02-01T00:00:00Z",
      leaderboard_opt_out: false,
      chat_read_receipts: true,
    }));
    const onboarding = ids.map((id) => ({ user_id: id, role: "student", step: 6, data: {}, completed_at: "2026-02-01T00:00:00Z", created_at: "2026-02-01T00:00:00Z", updated_at: "2026-02-01T00:00:00Z" }));
    const emails = ids.map((id, i) => ({ user_id: id, email: `Imported.${i}@Imported-Uni.TEST` }));
    // Cutover order: identity's users first (its gate keeps facts only for accounts it knows), then people.
    for (const e of emails) await createBareUser(w.sql, e.user_id, e.email);
    expect(await importProfiles(w.people, { profiles, onboarding, emails })).toEqual({ profiles: 2, onboarding: 2, gateEvents: 2 });
    expect(await importProfiles(w.people, { profiles, onboarding, emails })).toEqual({ profiles: 0, onboarding: 0, gateEvents: 0 });
    const stored = await w.people<{ email_domain: string }[]>`select email_domain from people.profiles where user_id = any(${ids}::uuid[])`;
    expect(stored.map((r) => r.email_domain)).toEqual(["imported-uni.test", "imported-uni.test"]);
    const events = await w.people`select payload from platform.events where type = 'profile.gate_changed' and subjects && ${ids}::uuid[]`;
    expect(events).toHaveLength(2);
    for (const e of events) expect(JSON.stringify(e["payload"])).not.toMatch(/Imported \d|@/); // ids and flags only
    await drainGate(w);
    expect(await gateProfileFacts(w.sql, ids)).toEqual([
      { has_profile: true, onboarding_complete: true },
      { has_profile: true, onboarding_complete: true },
    ]);
  });
});
