import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import postgres from "postgres";

/**
 * Golden tests (CLAUDE.md, "How to work" 4): before a service is written, each
 * public function's outputs are recorded on the current stack; the ported
 * service is done when its outputs match.
 *
 *   GOLDEN_RECORD=1  write the recorded value (run against the current stack)
 *   otherwise        compare with the file, after normalising ids and times
 */
export interface Normalise {
  /** Replace UUIDs with <uuid:n>, numbered by first appearance. Default true. */
  uuids?: boolean;
  /** Replace ISO timestamps with <time>. Default true. */
  times?: boolean;
  /** Object keys whose values are dropped (e.g. tokens). */
  dropKeys?: readonly string[];
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const TIME = /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}(?::?\d{2})?)?/g;

export function normalise(value: unknown, options: Normalise = {}): unknown {
  const ids = new Map<string, string>();
  const drop = new Set(options.dropKeys ?? []);
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") {
      let s = v;
      if (options.times !== false) s = s.replace(TIME, "<time>");
      if (options.uuids !== false)
        s = s.replace(UUID, (id) => {
          const key = id.toLowerCase();
          if (!ids.has(key)) ids.set(key, `<uuid:${ids.size + 1}>`);
          return ids.get(key)!;
        });
      return s;
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object")
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>)
          .filter(([k]) => !drop.has(k))
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, x]) => [k, walk(x)]),
      );
    return v;
  };
  return walk(value);
}

export type GoldenResult = { status: "recorded" } | { status: "matched" } | { status: "differs"; expected: unknown; actual: unknown };

/** Records (GOLDEN_RECORD=1) or compares one case in a JSON file of cases. */
export function golden(file: string, name: string, value: unknown, options: Normalise = {}): GoldenResult {
  const actual = normalise(value, options);
  const cases: Record<string, unknown> = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>) : {};
  if (process.env["GOLDEN_RECORD"] === "1") {
    cases[name] = actual;
    mkdirSync(dirname(file), { recursive: true });
    const sorted = Object.fromEntries(Object.entries(cases).sort(([a], [b]) => a.localeCompare(b)));
    writeFileSync(file, JSON.stringify(sorted, null, 2) + "\n");
    return { status: "recorded" };
  }
  if (!(name in cases)) throw new Error(`no golden case "${name}" in ${file}; record it with GOLDEN_RECORD=1 against the current stack`);
  const expected = cases[name];
  return JSON.stringify(expected) === JSON.stringify(actual) ? { status: "matched" } : { status: "differs", expected, actual };
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Golden recorders write fixture rows and delete them again, so they may only
 * ever reach the local stack. Throws for any URL whose host is not localhost,
 * 127.0.0.1 or [::1], for an empty or missing value, and for a Postgres URL
 * whose `host`/`hostaddr` parameter would send the connection elsewhere.
 * There is no fallback. The message names the host, never the credentials.
 */
export function assertLocalStack(url: string | null | undefined): asserts url is string {
  if (typeof url !== "string" || url.trim() === "") throw new Error("golden recording refused: no stack URL given (local stack only)");
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    throw new Error("golden recording refused: the stack URL does not parse (local stack only)");
  }
  const host = parsed.hostname.toLowerCase();
  if (!LOCAL_HOSTS.has(host)) throw new Error(`golden recording refused: host "${host || "(none)"}" is not the local stack`);
  for (const key of ["host", "hostaddr"]) {
    if (parsed.searchParams.has(key)) throw new Error(`golden recording refused: the "${key}" parameter could point the connection elsewhere`);
  }
}

/**
 * Calls a public function on the current stack (Supabase PostgREST RPC) as a
 * signed-in user, for recording. `token` is that user's access token on the
 * local stack; `key` is the stack's publishable key. Local stack only.
 */
export async function callCurrentStack(
  stack: { url: string; key: string },
  fn: string,
  args: Record<string, unknown>,
  token?: string,
): Promise<{ status: number; body: unknown }> {
  assertLocalStack(stack.url);
  const res = await fetch(`${stack.url}/rest/v1/rpc/${encodeURIComponent(fn)}`, {
    method: "POST",
    headers: {
      apikey: stack.key,
      authorization: `Bearer ${token ?? stack.key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(args),
  });
  const text = await res.text();
  return { status: res.status, body: text ? (JSON.parse(text) as unknown) : null };
}

/** Who a SQL call runs as on the current stack: a Postgres role plus the JWT claims `auth.uid()` and `auth.jwt()` read. */
export interface StackActor {
  role: "anon" | "authenticated" | "service_role" | "postgres";
  claims?: Record<string, unknown>;
}

export type SqlOutcome<T> = { ok: true; value: T } | { ok: false; code: string; message: string };

const ROLLBACK = Symbol("rollback");

/** Switches the actor inside a transaction from `callCurrentStackSql`. `postgres` is the owner: triggers, jobs, row snapshots. */
export async function actAs(tx: postgres.TransactionSql, actor: StackActor): Promise<void> {
  await tx.unsafe(actor.role === "postgres" ? "reset role" : `set local role ${actor.role}`);
  await tx`select set_config('request.jwt.claims', ${actor.claims ? JSON.stringify(actor.claims) : ""}, true)`;
  await tx`select set_config('request.jwt.claim.sub', '', true)`;
}

/** Runs one step in a savepoint, so a refusal is recorded as its SQLSTATE and message and the transaction goes on. */
export async function attempt<T>(tx: postgres.TransactionSql, step: (sp: postgres.TransactionSql) => Promise<T>): Promise<SqlOutcome<T>> {
  try {
    return { ok: true, value: (await tx.savepoint((sp) => step(sp))) as T };
  } catch (err) {
    const e = err as { code?: string; message?: string };
    if (typeof e.code === "string") return { ok: false, code: e.code, message: e.message ?? "" };
    throw err;
  }
}

/**
 * Calls the current stack's database directly, for what PostgREST cannot reach:
 * private functions, triggers, scheduled jobs and row snapshots. `run` gets one
 * transaction, starting as `postgres`; it switches actor with `actAs`. The
 * transaction is rolled back unless `commit`, so recording leaves no rows
 * behind (sequences still advance). Timestamps come back as the database's
 * text so `normalise` can mask them.
 */
export async function callCurrentStackSql<T>(
  dbUrl: string,
  run: (tx: postgres.TransactionSql) => Promise<T>,
  options: { commit?: boolean } = {},
): Promise<SqlOutcome<T>> {
  assertLocalStack(dbUrl);
  const asText = { to: 25, from: [1082, 1083, 1114, 1184, 1266], serialize: (x: unknown) => String(x), parse: (x: string) => x };
  const sql = postgres(dbUrl, { max: 1, onnotice: () => {}, types: { stackTime: asText } });
  let value: T | undefined;
  try {
    await sql.begin(async (tx) => {
      value = await run(tx);
      if (!options.commit) throw ROLLBACK;
    });
    return { ok: true, value: value as T };
  } catch (err) {
    if (err === ROLLBACK) return { ok: true, value: value as T };
    const e = err as { code?: string; message?: string };
    if (typeof e.code === "string") return { ok: false, code: e.code, message: e.message ?? "" };
    throw err;
  } finally {
    await sql.end({ timeout: 1 });
  }
}
