import { createHmac } from "node:crypto";
import type { Store } from "./store";

/**
 * Azure Blob Storage through its REST API, reached by the container app's managed identity (no account key
 * anywhere; CLAUDE.md, "Never": secrets live only in Key Vault, and this needs none). One container per bucket,
 * named as the bucket. Signed links are user-delegation SAS: a delegation key fetched with the identity's token
 * (cached until shortly before it expires) signs each link (`sasStringToSign`, unit-tested against the documented
 * field order). Public buckets' containers allow anonymous blob reads (deploy's Bicep, W13).
 */
const VERSION = "2022-11-02";

interface DelegationKey {
  oid: string;
  tid: string;
  start: string;
  expiry: string;
  service: string;
  version: string;
  value: string;
  until: number;
}

export interface AzureOptions {
  /** https://<account>.blob.core.windows.net */
  url: string;
  env?: NodeJS.ProcessEnv;
  fetch?: typeof fetch;
}

const iso = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");

/** The user-delegation SAS string-to-sign (service version 2020-12-06 and later). */
export function sasStringToSign(f: {
  permissions: string;
  start: string;
  expiry: string;
  resource: string;
  key: Pick<DelegationKey, "oid" | "tid" | "start" | "expiry" | "service" | "version">;
  version: string;
}): string {
  return [
    f.permissions,
    f.start,
    f.expiry,
    f.resource,
    f.key.oid,
    f.key.tid,
    f.key.start,
    f.key.expiry,
    f.key.service,
    f.key.version,
    "", // signedAuthorizedUserObjectId
    "", // signedUnauthorizedUserObjectId
    "", // signedCorrelationId
    "", // signedIP
    "https",
    f.version,
    "b",
    "", // signedSnapshotTime
    "", // signedEncryptionScope
    "",
    "",
    "",
    "",
    "",
  ].join("\n");
}

export function azureStore(options: AzureOptions): Store {
  const env = options.env ?? process.env;
  const doFetch = options.fetch ?? fetch;
  const base = options.url.replace(/\/$/, "");
  const account = new URL(base).hostname.split(".")[0]!;
  let token: { value: string; until: number } | undefined;
  let delegation: DelegationKey | undefined;

  async function bearer(): Promise<string> {
    if (token && token.until > Date.now()) return token.value;
    const endpoint = env["IDENTITY_ENDPOINT"];
    const header = env["IDENTITY_HEADER"];
    if (!endpoint || !header) throw new Error("managed identity is not available (IDENTITY_ENDPOINT)");
    const url = new URL(endpoint);
    url.searchParams.set("resource", "https://storage.azure.com/");
    url.searchParams.set("api-version", "2019-08-01");
    if (env["AZURE_CLIENT_ID"]) url.searchParams.set("client_id", env["AZURE_CLIENT_ID"]);
    const res = await doFetch(url, { headers: { "x-identity-header": header } });
    if (!res.ok) throw new Error(`managed identity token request failed: ${res.status}`);
    const body = (await res.json()) as { access_token: string; expires_on: string | number };
    token = { value: body.access_token, until: Number(body.expires_on) * 1000 - 60_000 };
    return token.value;
  }

  const headers = async (extra: Record<string, string> = {}) => ({ authorization: `Bearer ${await bearer()}`, "x-ms-version": VERSION, ...extra });
  const tag = (xml: string, name: string) => new RegExp(`<${name}>([^<]*)</${name}>`).exec(xml)?.[1] ?? "";

  async function key(): Promise<DelegationKey> {
    if (delegation && delegation.until > Date.now()) return delegation;
    const start = new Date(Date.now() - 5 * 60_000);
    const expiry = new Date(Date.now() + 6 * 3600_000);
    const res = await doFetch(`${base}/?restype=service&comp=userdelegationkey`, {
      method: "POST",
      headers: await headers({ "content-type": "application/xml" }),
      body: `<?xml version="1.0" encoding="utf-8"?><KeyInfo><Start>${iso(start)}</Start><Expiry>${iso(expiry)}</Expiry></KeyInfo>`,
    });
    if (!res.ok) throw new Error(`user delegation key request failed: ${res.status}`);
    const xml = await res.text();
    delegation = {
      oid: tag(xml, "SignedOid"),
      tid: tag(xml, "SignedTid"),
      start: tag(xml, "SignedStart"),
      expiry: tag(xml, "SignedExpiry"),
      service: tag(xml, "SignedService"),
      version: tag(xml, "SignedVersion"),
      value: tag(xml, "Value"),
      until: expiry.getTime() - 3600_000,
    };
    return delegation;
  }

  async function sas(bucket: string, path: string, permissions: string, expiresAt: Date): Promise<string> {
    const k = await key();
    const start = iso(new Date(Date.now() - 5 * 60_000));
    const expiry = iso(expiresAt);
    const resource = `/blob/${account}/${bucket}/${path}`;
    const sig = createHmac("sha256", Buffer.from(k.value, "base64"))
      .update(sasStringToSign({ permissions, start, expiry, resource, key: k, version: VERSION }), "utf8")
      .digest("base64");
    const q = new URLSearchParams({ sp: permissions, st: start, se: expiry, skoid: k.oid, sktid: k.tid, skt: k.start, ske: k.expiry, sks: k.service, skv: k.version, sv: VERSION, sr: "b", spr: "https", sig });
    return `${base}/${bucket}/${path}?${q.toString()}`;
  }

  return {
    async uploadLink(bucket, path, mime, expiresAt) {
      return { url: await sas(bucket, path, "cw", expiresAt), headers: { "x-ms-blob-type": "BlockBlob", "content-type": mime } };
    },
    downloadLink: (bucket, path, expiresAt) => sas(bucket, path, "r", expiresAt),
    publicUrl: (bucket, path) => `${base}/${bucket}/${path}`,
    async head(bucket, path) {
      const res = await doFetch(`${base}/${bucket}/${path}`, { method: "HEAD", headers: await headers() });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`blob head failed: ${res.status}`);
      return { bytes: Number(res.headers.get("content-length") ?? 0), mime: res.headers.get("content-type") ?? "" };
    },
    async put(bucket, path, mime, data) {
      const res = await doFetch(`${base}/${bucket}/${path}`, { method: "PUT", headers: await headers({ "x-ms-blob-type": "BlockBlob", "content-type": mime }), body: data });
      if (!res.ok) throw new Error(`blob put failed: ${res.status}`);
    },
    async remove(bucket, paths) {
      for (const p of paths) {
        const res = await doFetch(`${base}/${bucket}/${p}`, { method: "DELETE", headers: await headers() });
        if (!res.ok && res.status !== 404) throw new Error(`blob delete failed: ${res.status}`);
      }
    },
  };
}
