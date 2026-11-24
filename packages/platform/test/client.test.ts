import { Code, ConnectError, createContextValues, type UnaryRequest, type UnaryResponse } from "@connectrpc/connect";
import { describe, expect, it } from "vitest";
import { CALL_RULES, createBreaker } from "../src/index";

function fakeRequest(typeName = "skilient.sample.v1.SampleService"): UnaryRequest {
  return { service: { typeName }, contextValues: createContextValues() } as unknown as UnaryRequest;
}

describe("circuit breaker", () => {
  it("opens after five failures in ten seconds and fails fast until it closes", async () => {
    let t = 1_000_000;
    let calls = 0;
    const next = async (): Promise<UnaryResponse> => {
      calls++;
      throw new ConnectError("down", Code.Unavailable);
    };
    const run = createBreaker(() => t)(next as never);
    for (let i = 0; i < CALL_RULES.breakerFailures; i++) await expect(run(fakeRequest())).rejects.toThrow(/down/);
    await expect(run(fakeRequest())).rejects.toThrow(/circuit_open/);
    expect(calls).toBe(CALL_RULES.breakerFailures);
    t += CALL_RULES.breakerOpenMs + 1;
    await expect(run(fakeRequest())).rejects.toThrow(/down/);
    expect(calls).toBe(CALL_RULES.breakerFailures + 1);
  });

  it("does not count refusals as failures", async () => {
    const next = async (): Promise<UnaryResponse> => {
      throw new ConnectError("no", Code.PermissionDenied);
    };
    const run = createBreaker()(next as never);
    for (let i = 0; i < 10; i++) await expect(run(fakeRequest())).rejects.toThrow(/no/);
  });

  it("keeps a separate circuit per service", async () => {
    const next = async (req: UnaryRequest): Promise<UnaryResponse> => {
      if (req.service.typeName === "a") throw new ConnectError("down", Code.Unavailable);
      return {} as UnaryResponse;
    };
    const run = createBreaker()(next as never);
    for (let i = 0; i < 6; i++) await run(fakeRequest("a")).catch(() => undefined);
    await expect(run(fakeRequest("b"))).resolves.toBeDefined();
  });
});

describe("retry", () => {
  const method = (idempotency: number) =>
    ({ service: { typeName: "s" }, method: { idempotency }, stream: false, signal: new AbortController().signal }) as unknown as UnaryRequest;

  it("retries a read once when the callee was unavailable", async () => {
    const { retryReads } = await import("../src/index");
    const { MethodOptions_IdempotencyLevel: L } = await import("@bufbuild/protobuf/wkt");
    let calls = 0;
    const next = async (): Promise<UnaryResponse> => {
      calls++;
      throw new ConnectError("down", Code.Unavailable);
    };
    await expect(retryReads(next as never)(method(L.NO_SIDE_EFFECTS))).rejects.toThrow(/down/);
    expect(calls).toBe(2);
    calls = 0;
    await expect(retryReads(next as never)(method(L.IDEMPOTENCY_UNKNOWN))).rejects.toThrow(/down/);
    expect(calls).toBe(1);
  });
});
