import { describe, expect, it, vi } from "vitest";
import { createSecrets, envName } from "../src/index";

describe("secrets", () => {
  it("reads SECRET_<NAME> outside Azure", async () => {
    expect(envName("service-token-key")).toBe("SECRET_SERVICE_TOKEN_KEY");
    const secrets = createSecrets({ env: { SECRET_SERVICE_TOKEN_KEY: "v" } });
    expect(await secrets.get("service-token-key")).toBe("v");
    await expect(secrets.get("log-hash-key")).rejects.toThrow(/SECRET_LOG_HASH_KEY/);
  });

  it("reads Key Vault with the managed identity token in Azure, and caches", async () => {
    const fetch = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const u = new URL(String(url));
      if (u.host === "mi.local") {
        expect(u.searchParams.get("resource")).toBe("https://vault.azure.net");
        expect(u.searchParams.get("client_id")).toBe("client-1");
        expect((init?.headers as Record<string, string>)["x-identity-header"]).toBe("h");
        return Response.json({ access_token: "tok", expires_on: String(Math.floor(Date.now() / 1000) + 3600) });
      }
      expect(u.pathname).toBe("/secrets/service-token-key");
      expect((init?.headers as Record<string, string>)["authorization"]).toBe("Bearer tok");
      return Response.json({ value: "from-vault" });
    });
    const secrets = createSecrets({
      env: {
        KEY_VAULT_URL: "https://vault.local/",
        IDENTITY_ENDPOINT: "http://mi.local/token",
        IDENTITY_HEADER: "h",
        AZURE_CLIENT_ID: "client-1",
        SECRET_SERVICE_TOKEN_KEY: "ignored-in-azure",
      },
      fetch: fetch as unknown as typeof globalThis.fetch,
    });
    expect(await secrets.get("service-token-key")).toBe("from-vault");
    expect(await secrets.get("service-token-key")).toBe("from-vault");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("refuses names Key Vault would not accept", async () => {
    await expect(createSecrets({ env: {} }).get("bad/name")).rejects.toThrow(/invalid secret name/);
  });
});
