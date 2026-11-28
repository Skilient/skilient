import { RuleTester } from "eslint";
import { describe, expect, it } from "vitest";
import { checkService } from "../src/check-migrations.mjs";
import rule from "../src/no-foreign-schema.mjs";

const services = ["identity", "people", "content", "sample-relay"];

describe("no-foreign-schema", () => {
  it("allows a service its own schema and flags any other", () => {
    new RuleTester({ languageOptions: { ecmaVersion: 2024, sourceType: "module" } }).run("no-foreign-schema", rule as never, {
      valid: [
        { filename: "/r/services/people/src/store/q.ts", code: 'db.selectFrom("people.profiles")', options: [{ services }] },
        { filename: "/r/services/people/src/store/q.ts", code: "sql`select * from people.profiles`", options: [{ services }] },
        { filename: "/r/services/people/src/x.ts", code: 'import x from "@skilient/contracts/identity/v1/identity_pb";', options: [{ services }] },
        { filename: "/r/services/people/src/x.ts", code: 'const t = "skilient.identity.v1.IdentityService";', options: [{ services }] },
        { filename: "/r/services/people/src/x.ts", code: 'import "./identity.ts";', options: [{ services }] },
        { filename: "/r/services/sample-relay/src/x.ts", code: 'q("sample_relay.things")', options: [{ services }] },
        { filename: "/r/services/people/src/x.ts", code: 'read("identity.json")', options: [{ services }] },
        // Prose: a sentence ending in a service's name is not a schema (no space around a SQL dot, lowercase names).
        { filename: "/r/services/people/src/x.ts", code: 'const t = "refreshed with this month\'s content. It has a new code.";', options: [{ services: [...services, "ranking"] }] },
        { filename: "/r/services/people/src/x.ts", code: 'const t = "Identity.Users";', options: [{ services }] },
        // A platform config key named after a service (CONFIG_KEYS).
        { filename: "/r/services/people/src/x.ts", code: 'if (key === "ranking.formula") go();', options: [{ services: [...services, "ranking"] }] },
      ],
      invalid: [
        { filename: "/r/services/people/src/store/q.ts", code: 'db.selectFrom("identity.users")', options: [{ services }], errors: [{ messageId: "foreign" }] },
        { filename: "/r/services/people/src/store/q.ts", code: "sql`select * from content.posts p`", options: [{ services }], errors: [{ messageId: "foreign" }] },
        { filename: "/r/services/people/src/store/q.ts", code: 'q(\'select 1 from "content"."posts"\')', options: [{ services }], errors: [{ messageId: "foreign" }] },
        { filename: "/r/packages/platform/src/x.ts", code: 'q("people.profiles")', options: [{ services }], errors: [{ messageId: "foreign" }] },
        // The config-key allowance is for that key only: the same schema's tables are still flagged, in the same string too.
        { filename: "/r/services/people/src/x.ts", code: 'q("select * from ranking.ranking_scores")', options: [{ services: [...services, "ranking"] }], errors: [{ messageId: "foreign" }] },
        { filename: "/r/services/people/src/x.ts", code: 'q("ranking.formula and ranking.scores")', options: [{ services: [...services, "ranking"] }], errors: [{ messageId: "foreign" }] },
        // Repeated use (the pattern keeps no state between strings).
        { filename: "/r/services/people/src/x.ts", code: 'q("content.posts"); q("content.posts");', options: [{ services }], errors: [{ messageId: "foreign" }, { messageId: "foreign" }] },
      ],
    });
  });
});

describe("migration check", () => {
  const ok = `create table people.profiles (id uuid primary key);
alter table people.profiles enable row level security;
alter table people.profiles force row level security;`;

  it("passes a table with forced row-level security in its own schema", () => {
    expect(checkService("people", [["0001_profiles.sql", ok]], services)).toEqual([]);
  });

  it("flags a missing RLS line, a foreign schema, a bad name and an unqualified table", () => {
    const problems = checkService(
      "people",
      [
        ["0001_profiles.sql", "create table people.profiles (id uuid);\nalter table people.profiles enable row level security;"],
        ["0002_bad.sql", "create table identity.users (id uuid);\nselect * from content.posts;"],
        ["init.sql", "create table loose (id int);"],
      ],
      services,
    );
    expect(problems.join("\n")).toMatch(/people\.profiles force row level security/);
    expect(problems.join("\n")).toMatch(/another service's schema 'identity'/);
    expect(problems.join("\n")).toMatch(/another service's schema 'content'/);
    expect(problems.join("\n")).toMatch(/creates identity\.users outside its own schema/);
    expect(problems.join("\n")).toMatch(/init\.sql: name it NNNN_what\.sql/);
    expect(problems.join("\n")).toMatch(/create table loose must name its schema/);
  });

  it("ignores schemas named only in comments", () => {
    expect(checkService("people", [["0001_a.sql", `-- copied from identity.users\n${ok}`]], services)).toEqual([]);
  });
});
