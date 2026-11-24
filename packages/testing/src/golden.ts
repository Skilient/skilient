import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

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

/**
 * Calls a public function on the current stack (Supabase PostgREST RPC) as a
 * signed-in user, for recording. `token` is that user's access token on the
 * local stack; `key` is the stack's publishable key.
 */
export async function callCurrentStack(
  stack: { url: string; key: string },
  fn: string,
  args: Record<string, unknown>,
  token?: string,
): Promise<{ status: number; body: unknown }> {
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
