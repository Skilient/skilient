import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Code, ConnectError } from "@connectrpc/connect";
import { headers, refusalReason } from "@skilient/platform";
import { SampleService } from "@skilient/contracts/sample/v1/sample_pb";
import { describeTransports, testKeys } from "@skilient/testing";
import { createServiceSigner } from "@skilient/platform";
import { expect, it } from "vitest";

const budgets = JSON.parse(readFileSync(join(import.meta.dirname, "../../../../perf/budgets.json"), "utf8")) as Record<
  string,
  { p95Ms: number }
>;

async function refusal(promise: Promise<unknown>): Promise<{ code: Code; reason: string | null }> {
  try {
    await promise;
  } catch (error) {
    const e = ConnectError.from(error);
    return { code: e.code, reason: refusalReason(error) };
  }
  throw new Error("expected a refusal");
}

describeTransports(["sample"], (env) => {
  it("echoes the trimmed message, the replica and the depth", async () => {
    const reply = await env().client(SampleService).echo({ message: "  hello " }, env().call());
    expect(reply.message).toBe("hello");
    expect(reply.servedBy).toBe(`test-${env().transport}`);
    expect(reply.depth).toBe(1);
  });

  it("names the verified caller and user", async () => {
    const out = await env().client(SampleService).whoAmI({}, env().call());
    expect(out).toMatchObject({ caller: "web", signedIn: false, userId: "" });
    const token = await env().keys.userToken("11111111-1111-4111-8111-111111111111", { aal: "aal2" });
    const signedIn = await env().client(SampleService).whoAmI({}, env().call({ userToken: token }));
    expect(signedIn).toMatchObject({ caller: "web", signedIn: true, userId: "11111111-1111-4111-8111-111111111111" });
  });

  it("refuses invalid input with a typed reason", async () => {
    expect(await refusal(env().client(SampleService).echo({ message: "   " }, env().call()))).toEqual({
      code: Code.InvalidArgument,
      reason: "message_empty",
    });
    expect(await refusal(env().client(SampleService).echo({ message: "x".repeat(201) }, env().call()))).toEqual({
      code: Code.InvalidArgument,
      reason: "message_too_long",
    });
  });

  it("refuses a caller that is not on the method's list", async () => {
    expect(await refusal(env().client(SampleService, "people").echo({ message: "hi" }, env().call()))).toEqual({
      code: Code.PermissionDenied,
      reason: "caller_not_allowed",
    });
  });

  it("refuses a call without, or with a forged, service token", async () => {
    expect(await refusal(env().raw(SampleService, { [headers.depth]: "1" }).echo({ message: "hi" }))).toEqual({
      code: Code.Unauthenticated,
      reason: "service_token_invalid",
    });
    const other = await testKeys();
    const forged = await createServiceSigner(other.keys, "web")("sample");
    expect(
      await refusal(env().raw(SampleService, { [headers.depth]: "1", [headers.serviceToken]: forged }).echo({ message: "hi" })),
    ).toEqual({ code: Code.Unauthenticated, reason: "service_token_invalid" });
  });

  it("refuses a service token minted for another service", async () => {
    const wrongAudience = await createServiceSigner(env().keys.keys, "web")("people");
    expect(
      await refusal(env().raw(SampleService, { [headers.depth]: "1", [headers.serviceToken]: wrongAudience }).echo({ message: "hi" })),
    ).toEqual({ code: Code.Unauthenticated, reason: "service_token_invalid" });
  });

  it("refuses a call chain deeper than two, and a call with no depth", async () => {
    expect(await refusal(env().client(SampleService).echo({ message: "hi" }, env().call({ depth: 2 })))).toEqual({
      code: Code.PermissionDenied,
      reason: "call_depth_exceeded",
    });
    const token = await createServiceSigner(env().keys.keys, "web")("sample");
    expect(await refusal(env().raw(SampleService, { [headers.serviceToken]: token }).echo({ message: "hi" }))).toEqual({
      code: Code.PermissionDenied,
      reason: "call_depth_missing",
    });
  });

  it("refuses an invalid, expired or foreign user token", async () => {
    const id = "22222222-2222-4222-8222-222222222222";
    const expired = await env().keys.userToken(id, { expiresIn: "-1m" });
    const foreignIssuer = await env().keys.userToken(id, { issuer: "someone-else" });
    const otherKeys = await (await testKeys()).userToken(id);
    for (const userToken of ["not-a-jwt", expired, foreignIssuer, otherKeys]) {
      expect(await refusal(env().client(SampleService).whoAmI({}, env().call({ userToken })))).toEqual({
        code: Code.Unauthenticated,
        reason: "user_token_invalid",
      });
    }
  });

  it("writes one log line per call with the request id and a hashed user id, never content", async () => {
    const id = "33333333-3333-4333-8333-333333333333";
    const token = await env().keys.userToken(id);
    const requestId = `req-${env().transport}-0001`;
    await env().client(SampleService).echo({ message: "private words" }, env().call({ userToken: token, requestId }));
    const lines = env().logs.filter((l) => l["request_id"] === requestId);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ msg: "rpc", rpc: "skilient.sample.v1.SampleService/Echo", caller: "web", code: "ok", depth: 1 });
    expect(lines[0]!["user"]).toEqual(expect.any(String));
    const text = JSON.stringify(lines[0]);
    expect(text).not.toContain(id);
    expect(text).not.toContain("private words");
  });

  it("logs refusals that never reach the handler", async () => {
    await refusal(env().raw(SampleService, { [headers.depth]: "1", [headers.requestId]: `refused-${env().transport}` }).echo({ message: "hi" }));
    expect(env().logs.filter((l) => l["request_id"] === `refused-${env().transport}`)).toEqual([
      expect.objectContaining({ level: "warn", code: "Unauthenticated", reason: "service_token_invalid" }),
    ]);
  });

  it("answers within its perf budget at p95", async () => {
    const client = env().client(SampleService);
    for (let i = 0; i < 10; i++) await client.echo({ message: "warm" }, env().call());
    const times: number[] = [];
    for (let i = 0; i < 100; i++) {
      const t = performance.now();
      await client.echo({ message: "timed" }, env().call());
      times.push(performance.now() - t);
    }
    times.sort((a, b) => a - b);
    expect(times[94]!).toBeLessThanOrEqual(budgets["skilient.sample.v1.SampleService/Echo"]!.p95Ms);
  });
});
