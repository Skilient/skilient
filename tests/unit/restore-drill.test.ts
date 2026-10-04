import { describe, expect, it } from "vitest";
import { compareCatalog, compareCounts, poolerUrl, publishableKey, serviceKey } from "../../scripts/restore/lib.mjs";

describe("restore drill helpers", () => {
  it("builds a session-pooler URL from the Management API answer", () => {
    const pooler = [
      { database_type: "READ_REPLICA", db_host: "replica.example", db_user: "postgres.ref", db_name: "postgres" },
      { database_type: "PRIMARY", db_host: "aws-0-ap-south-1.pooler.supabase.com", db_port: 6543, db_user: "postgres.ref", db_name: "postgres" },
    ];
    expect(poolerUrl(pooler, "p@ss/word")).toBe("postgresql://postgres.ref:p%40ss%2Fword@aws-0-ap-south-1.pooler.supabase.com:5432/postgres");
    expect(() => poolerUrl([], "x")).toThrow();
  });

  it("picks the server and browser keys, new style first", () => {
    const keys = [
      { name: "anon", api_key: "legacy-anon" },
      { name: "service_role", api_key: "legacy-service" },
      { name: "default", type: "publishable", api_key: "sb_publishable_x" },
      { name: "default", type: "secret", api_key: "sb_secret_x" },
    ];
    expect(serviceKey(keys)).toBe("sb_secret_x");
    expect(publishableKey(keys)).toBe("sb_publishable_x");
    expect(serviceKey(keys.slice(0, 2))).toBe("legacy-service");
    expect(() => serviceKey([])).toThrow();
  });

  it("allows rows written after the dump, never a missing or emptied table", () => {
    const rows = compareCounts(
      { "public.posts": 1000, "public.likes": 0, "auth.users": 40, "public.gone": 3 },
      { "public.posts": 995, "public.likes": 0, "auth.users": 0, "public.extra": 1 },
    );
    const byTable = Object.fromEntries(rows.map((r) => [r.table, r.ok]));
    expect(byTable).toEqual({ "public.posts": true, "public.likes": true, "auth.users": false, "public.gone": false, "public.extra": false });
  });

  it("requires identical migrations, RLS on every public table, and the same policies and functions", () => {
    const prod = { migrations: ["1", "2"], tablesWithoutRls: [], policies: 10, functions: 50 };
    expect(compareCatalog(prod, { ...prod })).toEqual([]);
    expect(compareCatalog(prod, { migrations: ["1"], tablesWithoutRls: ["public.x"], policies: 9, functions: 50 })).toHaveLength(3);
  });
});
