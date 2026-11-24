import { Code, ConnectError } from "@connectrpc/connect";
import { SampleRelayService } from "@skilient/contracts/sample_relay/v1/sample_relay_pb";
import { describeTransports } from "@skilient/testing";
import { expect, it } from "vitest";

describeTransports(["sample", "sample-relay"], (env) => {
  it("relays to sample, in memory when both are hosted in one process", async () => {
    const reply = await env().client(SampleRelayService).relay({ message: "hi" }, env().call());
    expect(reply).toMatchObject({
      message: "hi",
      transport: "memory",
      relayServedBy: `test-${env().transport}`,
      echoServedBy: `test-${env().transport}`,
    });
  });

  it("carries the request id and the user on, as the relay service at depth two", async () => {
    const requestId = `relay-${env().transport}-0001`;
    const token = await env().keys.userToken("44444444-4444-4444-8444-444444444444");
    await env().client(SampleRelayService).relay({ message: "hi" }, env().call({ requestId, userToken: token }));
    const lines = env().logs.filter((l) => l["request_id"] === requestId);
    expect(lines.map((l) => [l["rpc"], l["caller"], l["depth"], l["transport"]])).toEqual([
      ["skilient.sample.v1.SampleService/Echo", "sample-relay", 2, "memory"],
      ["skilient.sample_relay.v1.SampleRelayService/Relay", "web", 1, env().transport],
    ]);
    expect(lines[0]!["user"]).toBe(lines[1]!["user"]);
    expect(lines[0]!["user"]).toEqual(expect.any(String));
  });

  it("refuses any caller but web", async () => {
    const error = await env()
      .client(SampleRelayService, "sample")
      .relay({ message: "hi" }, env().call())
      .catch((e: unknown) => ConnectError.from(e));
    expect(error).toBeInstanceOf(ConnectError);
    expect((error as ConnectError).code).toBe(Code.PermissionDenied);
  });
});
