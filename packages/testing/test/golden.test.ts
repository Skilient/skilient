import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assertLocalStack, callCurrentStack, callCurrentStackSql, golden, normalise } from "../src/golden";

describe("golden runner", () => {
  afterEach(() => {
    delete process.env["GOLDEN_RECORD"];
  });

  it("numbers uuids by first appearance in key order, masks times, sorts keys and drops keys", () => {
    const a = "0b5e9c1e-4c55-4d4c-9c8a-2a1d7d9e1f00";
    const b = "1c6f0d2f-5d66-4e5d-8d9b-3b2e8eaf2a11";
    expect(normalise({ z: a, a: [b, a], at: "2026-11-24T10:00:00.123+00:00", token: "t" }, { dropKeys: ["token"] })).toEqual({
      a: ["<uuid:1>", "<uuid:2>"],
      at: "<time>",
      z: "<uuid:2>",
    });
  });

  it("records with GOLDEN_RECORD=1, then matches or reports the difference", () => {
    const file = join(mkdtempSync(join(tmpdir(), "golden-")), "sample.json");
    process.env["GOLDEN_RECORD"] = "1";
    expect(golden(file, "profile", { name: "A" })).toEqual({ status: "recorded" });
    delete process.env["GOLDEN_RECORD"];
    expect(golden(file, "profile", { name: "A" })).toEqual({ status: "matched" });
    expect(golden(file, "profile", { name: "B" })).toMatchObject({ status: "differs" });
    expect(() => golden(file, "missing", {})).toThrow(/GOLDEN_RECORD=1/);
  });
});

describe("assertLocalStack", () => {
  it("accepts only localhost, 127.0.0.1 and [::1]", () => {
    for (const url of [
      "http://localhost:54321",
      "http://127.0.0.1:54321",
      "http://[::1]:54321",
      "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
      "postgresql://postgres:postgres@localhost:54322/postgres",
      "postgres://u:p@[::1]:5432/db",
      "HTTP://LOCALHOST:3199/",
    ])
      expect(() => assertLocalStack(url), url).not.toThrow();
  });

  it("rejects hosted URLs", () => {
    for (const url of [
      "https://abcdefghijklmnop.supabase.co",
      "postgresql://postgres:pw@db.abcdefghijklmnop.supabase.co:5432/postgres",
      "postgresql://u:p@skilient.postgres.database.azure.com:5432/skilient",
      "http://10.0.0.5:54321",
      "http://192.168.1.10:3199",
      "http://0.0.0.0:3199",
    ])
      expect(() => assertLocalStack(url), url).toThrow(/golden recording refused/);
  });

  it("rejects empty, missing and unparseable values", () => {
    for (const url of ["", "   ", undefined, null, "not a url", "127.0.0.1:54322", "postgresql:///postgres"])
      expect(() => assertLocalStack(url), String(url)).toThrow(/golden recording refused/);
  });

  it("judges the host, not a remote-looking path, port, user or subdomain", () => {
    for (const url of ["http://127.0.0.1:443/db.abcdefghijklmnop.supabase.co", "http://localhost:5432/?next=https://evil.example"])
      expect(() => assertLocalStack(url), url).not.toThrow();
    for (const url of [
      "http://evil.example/127.0.0.1",
      "http://127.0.0.1.evil.example:54321",
      "http://localhost.evil.example",
      "http://localhost@evil.example:54321",
      "postgresql://postgres:postgres@127.0.0.1:54322/postgres?host=db.evil.example",
      "postgresql://postgres:postgres@localhost:54322/postgres?hostaddr=10.0.0.5",
    ])
      expect(() => assertLocalStack(url), url).toThrow(/golden recording refused/);
  });

  it("stops the stack callers before any network call", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(callCurrentStack({ url: "https://abcdefghijklmnop.supabase.co", key: "k" }, "my_gate_state", {})).rejects.toThrow(
      /golden recording refused/,
    );
    await expect(callCurrentStack({ url: "", key: "k" }, "my_gate_state", {})).rejects.toThrow(/golden recording refused/);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
    await expect(callCurrentStackSql("postgresql://u:p@db.example.supabase.co:5432/postgres", async () => 1)).rejects.toThrow(
      /golden recording refused/,
    );
    await expect(callCurrentStackSql(undefined as unknown as string, async () => 1)).rejects.toThrow(/golden recording refused/);
  });
});
