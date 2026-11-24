import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { golden, normalise } from "../src/golden";

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
