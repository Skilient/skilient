import { describe, expect, it } from "vitest";
import { callers } from "../../src/authorize";

describe("sample-relay callers", () => {
  it("lets only web relay, so no chain is deeper than two", () => {
    expect(callers.relay).toEqual(["web"]);
  });
});
