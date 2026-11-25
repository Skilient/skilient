/**
 * The personal-email domain list reaches production at cutover (W1 follow-up closed in W2, decision
 * 2026-11-25): fixture `public.personal_email_domains` rows (no network, no production data) are parsed by
 * tools/cutover and written by identity, and the signup gate's read (CheckEmailDomains) then sees them.
 * The same container checks `changeEmail`'s `user.email_domain_changed` event (W2 Q9).
 */
import { join } from "node:path";
import { startPostgres, type TestDatabase } from "@skilient/testing/postgres";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parsePersonalDomainExport } from "../../../../tools/cutover/src/auth-import";
import { applyDomainsChanged, applyProfileGateChanged } from "../../src/store/gate-copies";
import { changeEmail } from "../../src/store/gate";
import { importPersonalDomains, importUsers } from "../../src/store/import";
import { personalDomains } from "../../src/store/reads";

const MIGRATIONS = join(import.meta.dirname, "../../migrations");
const UNI = "0190f0b2-0000-7000-8000-0000000000c1";
const USER = "0190f0b2-0000-7000-8000-0000000000c2";

describe("personal email domains import", () => {
  let pg: TestDatabase;
  let sql: postgres.Sql;
  beforeAll(async () => {
    pg = await startPostgres();
    sql = await pg.service("identity", MIGRATIONS);
  });
  afterAll(async () => {
    await pg?.stop();
  });

  it("imports the exported list once, lower-cased, and the gate read sees it", async () => {
    const domains = parsePersonalDomainExport(['{"domain":"gmail.com"}', '{"domain":"Yahoo.COM"}', '{"domain":"gmail.com"}'].join("\n"));
    expect(await importPersonalDomains(sql, domains)).toBe(2);
    expect(await importPersonalDomains(sql, domains)).toBe(0);
    expect([...(await personalDomains(sql, ["gmail.com", "yahoo.com", "uni.test"]))].sort()).toEqual(["gmail.com", "yahoo.com"]);
  });

  it("refuses the whole file when one domain is malformed", async () => {
    await expect(importPersonalDomains(sql, ["hotmail.com", "not a domain"])).rejects.toThrow(/malformed/);
    expect(await personalDomains(sql, ["hotmail.com"])).toEqual(new Set());
  });

  it("an email change to another domain of the same university emits user.email_domain_changed (ids and the domain only)", async () => {
    await importUsers(sql, [
      { id: USER, email: "s@one.import-uni.test", encrypted_password: null, email_confirmed_at: "2026-01-01T00:00:00Z", created_at: "2026-01-01T00:00:00Z", last_sign_in_at: null, banned_until: null },
    ]);
    await sql.begin(async (tx) => {
      await applyDomainsChanged(tx, {
        university_id: UNI,
        live_at: "2026-01-01T00:00:00Z",
        domains: [
          { domain: "one.import-uni.test", kind: "both" },
          { domain: "two.import-uni.test", kind: "both" },
        ],
      });
      await applyProfileGateChanged(tx, { user_id: USER, has_profile: true, role: "student", university_id: UNI, onboarding_complete: true, onboarding_step: 6, status: "active" });
    });
    expect(await sql.begin((tx) => changeEmail(tx, USER, { email: "s2@one.import-uni.test" }))).toBe(1);
    expect(await sql.begin((tx) => changeEmail(tx, USER, { email: "s@two.import-uni.test" }))).toBe(1);
    const events = await sql<{ subjects: string[]; payload: Record<string, unknown> }[]>`
      select subjects::text[] as subjects, payload from platform.events where type = 'user.email_domain_changed' order by seq`;
    expect(events).toEqual([{ subjects: [USER], payload: { user_id: USER, email_domain: "two.import-uni.test" } }]);
  });
});
