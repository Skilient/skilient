import { readdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { Kysely } from "kysely";
import { PostgresJSDialect } from "kysely-postgres-js";
import postgres from "postgres";

/**
 * Database access for a service: `postgres.js` for the connection, Kysely for
 * typed queries (docs/azure/prd.md, "Stack"). Each service connects as its own
 * login role and reads only its own schema.
 */
export interface DbOptions {
  host: string;
  port?: number;
  database: string;
  user: string;
  /** A password, or a function that returns one (an Entra token for managed identity in Azure). */
  password: string | (() => Promise<string>);
  ssl?: boolean;
  max?: number;
}

export interface Db<DB> {
  sql: postgres.Sql;
  db: Kysely<DB>;
  close(): Promise<void>;
}

export function createDb<DB>(options: DbOptions): Db<DB> {
  const sql = postgres({
    host: options.host,
    port: options.port ?? 5432,
    database: options.database,
    username: options.user,
    pass: options.password,
    ssl: options.ssl ? "require" : false,
    max: options.max ?? 10,
    idle_timeout: 30,
    connect_timeout: 5,
    prepare: true,
    connection: { application_name: options.user },
  });
  const db = new Kysely<DB>({ dialect: new PostgresJSDialect({ postgres: sql }) });
  return { sql, db, close: () => db.destroy() };
}

/**
 * An Entra access token for Azure Database for PostgreSQL, from the Container
 * Apps managed identity endpoint. Used as the password; cached until near expiry.
 */
export function entraPassword(env: NodeJS.ProcessEnv = process.env, doFetch: typeof fetch = fetch): () => Promise<string> {
  let cached: { value: string; until: number } | undefined;
  return async () => {
    if (cached && cached.until > Date.now()) return cached.value;
    const endpoint = env["IDENTITY_ENDPOINT"];
    const header = env["IDENTITY_HEADER"];
    if (!endpoint || !header) throw new Error("managed identity is not available (IDENTITY_ENDPOINT)");
    const url = new URL(endpoint);
    url.searchParams.set("resource", "https://ossrdbms-aad.database.windows.net");
    url.searchParams.set("api-version", "2019-08-01");
    if (env["AZURE_CLIENT_ID"]) url.searchParams.set("client_id", env["AZURE_CLIENT_ID"]);
    const res = await doFetch(url, { headers: { "x-identity-header": header } });
    if (!res.ok) throw new Error(`managed identity token request failed: ${res.status}`);
    const body = (await res.json()) as { access_token: string; expires_on: string | number };
    cached = { value: body.access_token, until: Number(body.expires_on) * 1000 - 5 * 60_000 };
    return cached.value;
  };
}

const IDENT = /^[a-z][a-z0-9_]{0,62}$/;
const FILE = /^\d{4}_[a-z0-9_]+\.sql$/;

export interface Migration {
  name: string;
  checksum: string;
  sql: string;
}

/** The `platform` schema's own migrations: the shared event log, job queue, schedules and idempotency keys. */
export const PLATFORM_MIGRATIONS = join(import.meta.dirname, "..", "migrations");

/** The forward-only migrations in a service's `migrations/` folder, in order. Names are `0001_what.sql`. */
export function readMigrations(dir: string): Migration[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((name) => {
      if (!FILE.test(name)) throw new Error(`migration ${name} must be named NNNN_what.sql`);
      const sql = readFileSync(join(dir, name), "utf8");
      return { name, sql, checksum: createHash("sha256").update(sql).digest("hex") };
    });
}

/**
 * Applies a service's migrations to its schema, each in its own transaction,
 * under an advisory lock. An applied file that has changed is an error:
 * migrations are forward-only. Returns the names applied.
 */
export async function migrate(sql: postgres.Sql, schema: string, migrations: Migration[]): Promise<string[]> {
  if (!IDENT.test(schema)) throw new Error(`invalid schema name ${schema}`);
  const applied: string[] = [];
  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtext(${"migrate:" + schema}))`;
    await tx.unsafe(`create schema if not exists ${schema}`);
    await tx.unsafe(
      `create table if not exists ${schema}._migrations (name text primary key, checksum text not null, applied_at timestamptz not null default now())`,
    );
    const done = new Map(
      (await tx.unsafe<{ name: string; checksum: string }[]>(`select name, checksum from ${schema}._migrations`)).map((r) => [
        r.name,
        r.checksum,
      ]),
    );
    for (const m of migrations) {
      const seen = done.get(m.name);
      if (seen && seen !== m.checksum) throw new Error(`migration ${schema}/${m.name} changed after it was applied`);
      if (seen) continue;
      await tx.savepoint(async (sp) => {
        await sp.unsafe(m.sql);
        await sp.unsafe(`insert into ${schema}._migrations (name, checksum) values ($1, $2)`, [m.name, m.checksum]);
      });
      applied.push(m.name);
    }
  });
  return applied;
}
