/**
 * Secrets live only in Key Vault, reached by managed identity (CLAUDE.md,
 * "Never"). In Azure (`KEY_VAULT_URL` set) a secret is read from the vault with
 * a token from the Container Apps identity endpoint; elsewhere it is the
 * environment variable `SECRET_<NAME>` (dashes become underscores), which only
 * local runs and tests set. Values are cached for five minutes.
 */
export interface Secrets {
  get(name: string): Promise<string>;
}

export interface SecretsOptions {
  env?: NodeJS.ProcessEnv;
  fetch?: typeof fetch;
  now?: () => number;
}

const CACHE_MS = 5 * 60_000;

export function envName(name: string): string {
  return "SECRET_" + name.toUpperCase().replace(/-/g, "_");
}

export function createSecrets(options: SecretsOptions = {}): Secrets {
  const env = options.env ?? process.env;
  const doFetch = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  const cache = new Map<string, { value: string; until: number }>();
  let vaultToken: { value: string; until: number } | undefined;

  const vault = env["KEY_VAULT_URL"]?.replace(/\/$/, "");

  async function identityToken(): Promise<string> {
    if (vaultToken && vaultToken.until > now()) return vaultToken.value;
    const endpoint = env["IDENTITY_ENDPOINT"];
    const header = env["IDENTITY_HEADER"];
    if (!endpoint || !header) throw new Error("managed identity is not available (IDENTITY_ENDPOINT)");
    const url = new URL(endpoint);
    url.searchParams.set("resource", "https://vault.azure.net");
    url.searchParams.set("api-version", "2019-08-01");
    if (env["AZURE_CLIENT_ID"]) url.searchParams.set("client_id", env["AZURE_CLIENT_ID"]);
    const res = await doFetch(url, { headers: { "x-identity-header": header } });
    if (!res.ok) throw new Error(`managed identity token request failed: ${res.status}`);
    const body = (await res.json()) as { access_token: string; expires_on: string | number };
    vaultToken = { value: body.access_token, until: Number(body.expires_on) * 1000 - 60_000 };
    return vaultToken.value;
  }

  return {
    async get(name) {
      if (!/^[A-Za-z0-9-]{1,127}$/.test(name)) throw new Error("invalid secret name");
      const hit = cache.get(name);
      if (hit && hit.until > now()) return hit.value;
      let value: string;
      if (vault) {
        const res = await doFetch(`${vault}/secrets/${name}?api-version=7.4`, {
          headers: { authorization: `Bearer ${await identityToken()}` },
        });
        if (!res.ok) throw new Error(`secret ${name} could not be read: ${res.status}`);
        value = ((await res.json()) as { value: string }).value;
      } else {
        const v = env[envName(name)];
        if (!v) throw new Error(`secret ${name} is not set (${envName(name)})`);
        value = v;
      }
      cache.set(name, { value, until: now() + CACHE_MS });
      return value;
    },
  };
}
