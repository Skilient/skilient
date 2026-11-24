/**
 * Pure helpers shared by the load seeder (scripts/load/seed.mjs) and unit-tested in
 * tests/unit/load-test.test.ts. The k6 journeys (tests/load/) derive the same emails and usernames
 * from the VU number, so the two must agree; tests/load/lib/users.js mirrors loadEmail/pairOf.
 */

const pad = (n, width = 5) => String(n).padStart(width, "0");

/** The n-th synthetic student (1-based). */
export const loadEmail = (n, domain) => `load-${pad(n)}@${domain}`;
export const loadUsername = (n) => `load_${pad(n)}`;
/** The s-th officer account (1-based); two per society. */
export const officerEmail = (s, domain) => `load-officer-${pad(s, 2)}@${domain}`;

/** The k6 chat partner of student n: the student half the population away, so pairs never overlap. */
export function pairOf(n, users) {
  const half = Math.floor(users / 2);
  return ((n - 1 + half) % users) + 1;
}

export const pick = (list, i) => list[i % list.length];

/** Deterministic PRNG (mulberry32), so re-runs build the same data. */
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Refuses any target but the local stack or the confirmed scratch project. Returns the reason, or null.
 * `confirm` must equal the project ref in the URL; `production` (when given) must not.
 */
export function checkTarget(url, confirm, production) {
  let host;
  try {
    host = new URL(url).hostname;
  } catch {
    return "SUPABASE_URL isn't a URL";
  }
  if (host === "127.0.0.1" || host === "localhost") return null;
  const ref = host.endsWith(".supabase.co") ? host.split(".")[0] : null;
  if (!ref) return `${host} isn't a Supabase project URL`;
  if (production && ref === production) return "that is the production project";
  if (!confirm) return "set LOAD_CONFIRM_SCRATCH to the scratch project's ref";
  if (confirm !== ref) return `LOAD_CONFIRM_SCRATCH (${confirm}) doesn't match ${ref}`;
  return null;
}
