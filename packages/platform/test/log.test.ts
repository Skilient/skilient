import { describe, expect, it } from "vitest";
import { createLogger, hashUserId } from "../src/index";

describe("logger", () => {
  it("writes one JSON line with base fields, above the level only", () => {
    const lines: string[] = [];
    const log = createLogger({ level: "info", base: { instance: "a" }, write: (l) => lines.push(l) });
    log.debug("hidden");
    log.child({ service: "people" }).info("rpc", { request_id: "r1" });
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!)).toMatchObject({ level: "info", msg: "rpc", instance: "a", service: "people", request_id: "r1" });
  });

  it("hashes user ids with a key, stably", () => {
    expect(hashUserId("u1", "k")).toBe(hashUserId("u1", "k"));
    expect(hashUserId("u1", "k")).not.toBe(hashUserId("u1", "k2"));
    expect(hashUserId("u1", "k")).not.toContain("u1");
  });
});
