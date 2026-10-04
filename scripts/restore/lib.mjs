// Shared helpers for the restore drill (docs/restore-drill.md, .github/workflows/restore-drill.yml).
// Pure functions are unit-tested in tests/unit/restore-drill.test.ts.

const API = "https://api.supabase.com";

/** GET from the Supabase Management API with a personal access token. */
export async function management(path, token) {
  const res = await fetch(`${API}${path}`, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Management API ${path}: HTTP ${res.status}`);
  return res.json();
}

/**
 * Session-mode pooler URL for a project (GitHub runners have no IPv6, so the direct db.<ref>.supabase.co host is
 * unreachable). `pooler` is the answer of GET /v1/projects/{ref}/config/database/pooler.
 */
export function poolerUrl(pooler, password) {
  const list = Array.isArray(pooler) ? pooler : [pooler];
  const primary = list.find((p) => (p.database_type ?? "PRIMARY") === "PRIMARY") ?? list[0];
  if (!primary?.db_host || !primary?.db_user) throw new Error("pooler config has no db_host/db_user");
  return `postgresql://${encodeURIComponent(primary.db_user)}:${encodeURIComponent(password)}@${primary.db_host}:5432/${primary.db_name ?? "postgres"}`;
}

/** The server-side key from GET /v1/projects/{ref}/api-keys?reveal=true: a new secret key, else the legacy service_role. */
export function serviceKey(keys) {
  const secret = keys.find((k) => k.type === "secret" && k.api_key);
  const legacy = keys.find((k) => k.name === "service_role" && k.api_key);
  const key = (secret ?? legacy)?.api_key;
  if (!key) throw new Error("no secret or service_role key in the api-keys answer");
  return key;
}

/** The browser key, for building the app against the restored project. */
export function publishableKey(keys) {
  const pub = keys.find((k) => k.type === "publishable" && k.api_key);
  const legacy = keys.find((k) => k.name === "anon" && k.api_key);
  const key = (pub ?? legacy)?.api_key;
  if (!key) throw new Error("no publishable or anon key in the api-keys answer");
  return key;
}

/**
 * Row counts, production against the restore. Production keeps changing after the dump, so a table passes when the
 * restore has at least `minShare` of production's rows (and no more than production plus `slack`). A table that is
 * missing from the restore, or empty there while production has rows, always fails.
 */
export function compareCounts(prod, restored, { minShare = 0.99, slack = 5 } = {}) {
  const rows = [];
  for (const [table, p] of Object.entries(prod).sort(([a], [b]) => a.localeCompare(b))) {
    const r = restored[table];
    let ok;
    if (r === undefined) ok = false;
    else if (p > 0 && r === 0) ok = false;
    else ok = r >= Math.floor(p * minShare) - slack && r <= p + slack;
    rows.push({ table, prod: p, restored: r ?? null, ok });
  }
  for (const table of Object.keys(restored)) if (!(table in prod)) rows.push({ table, prod: null, restored: restored[table], ok: false });
  return rows;
}

/** Migrations, RLS and policies: the restore must match production exactly. */
export function compareCatalog(prod, restored) {
  const problems = [];
  const missing = prod.migrations.filter((m) => !restored.migrations.includes(m));
  const extra = restored.migrations.filter((m) => !prod.migrations.includes(m));
  if (missing.length) problems.push(`migrations missing in the restore: ${missing.join(", ")}`);
  if (extra.length) problems.push(`migrations only in the restore: ${extra.join(", ")}`);
  if (restored.tablesWithoutRls.length) problems.push(`tables without RLS in the restore: ${restored.tablesWithoutRls.join(", ")}`);
  if (restored.policies !== prod.policies) problems.push(`policies: production ${prod.policies}, restore ${restored.policies}`);
  if (restored.functions !== prod.functions) problems.push(`functions: production ${prod.functions}, restore ${restored.functions}`);
  return problems;
}
