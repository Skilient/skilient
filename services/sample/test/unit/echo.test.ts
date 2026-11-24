import { describe, expect, it } from "vitest";
import { echoInput } from "../../src/domain/echo";

describe("echo input", () => {
  it("trims and accepts 1 to 200 characters", () => {
    expect(echoInput.parse({ message: "  hi  " })).toEqual({ message: "hi" });
    expect(echoInput.safeParse({ message: "x".repeat(200) }).success).toBe(true);
  });

  it("refuses empty and long messages with a reason code", () => {
    expect(echoInput.safeParse({ message: "   " }).error?.issues[0]?.message).toBe("message_empty");
    expect(echoInput.safeParse({ message: "x".repeat(201) }).error?.issues[0]?.message).toBe("message_too_long");
  });
});
