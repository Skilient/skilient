import { randomBytes } from "node:crypto";
import { createLogger, createSecrets, defineService, noUserTokens, serviceKeysFrom } from "@skilient/platform";
import { SampleService } from "@skilient/contracts/sample/v1/sample_pb";
import { describe, expect, it } from "vitest";
import { createHost, resolveUrl, serviceNameOf } from "../src/index";

const base = {
  instance: "t",
  keys: serviceKeysFrom(randomBytes(32).toString("base64url")),
  users: noUserTokens,
  logHashKey: "k",
  logger: createLogger({ write: () => {} }),
  secrets: createSecrets({ env: {} }),
};

describe("placement", () => {
  it("uses SERVICE_URL_<NAME> first, then the container the service lives in", () => {
    const env = { CORE_A_URL: "https://a", CORE_B_URL: "https://b", SERVICE_URL_PEOPLE: "http://override" };
    expect(resolveUrl("people", env)).toBe("http://override");
    expect(resolveUrl("identity", env)).toBe("https://a");
    expect(resolveUrl("billing", env)).toBe("https://b");
    expect(resolveUrl("sample-relay", { SERVICE_URL_SAMPLE_RELAY: "http://r" })).toBe("http://r");
    expect(resolveUrl("sample", env)).toBeUndefined();
  });

  it("derives the service name from the Protobuf package", () => {
    expect(serviceNameOf("skilient.sample_relay.v1.SampleRelayService")).toBe("sample-relay");
  });
});

describe("createHost", () => {
  it("refuses an empty or unknown SERVICES list", async () => {
    await expect(createHost({ ...base, services: [] })).rejects.toThrow(/names no service/);
    await expect(createHost({ ...base, services: ["nope"] })).rejects.toThrow(/unknown service nope/);
  });

  it("refuses a service whose contract package does not match its name", async () => {
    const wrong = defineService({ name: "people", contract: SampleService, callers: { echo: [], whoAmI: [] }, create: () => ({}) });
    await expect(createHost({ ...base, services: ["people"], registry: { people: wrong as never } })).rejects.toThrow(
      /must be skilient\.people\.v1/,
    );
  });

  it("fails at start when a called service has no route", async () => {
    await expect(createHost({ ...base, services: ["sample-relay"], resolveUrl: () => undefined })).rejects.toThrow(/no_route:sample/);
  });
});
