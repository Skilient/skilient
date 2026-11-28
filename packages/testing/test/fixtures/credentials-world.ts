/**
 * The credentials golden world as data, so the same facts are built twice: on the current stack by
 * packages/testing/test/credentials.golden.test.ts (as rows in its tables) and in credentials' own schema by
 * services/credentials/test/golden (as the owners' events and batch reads plus credentials' own rows). Ids are
 * fixed and RFC 4122 (version 4 bits); domains end in `.test`; names are distinctive and nobody's.
 *
 * Two universities. At A: the verified society SOC (Priya presides, Osman is an officer, Mehr a member) and the
 * pending society PENDING; Sami is a student with work to show (one L2 skill and a completed venture); Nida is a
 * student with nothing yet; Tariq is a trust reviewer (staff); Zara walks in to SOC's event by email and signs up
 * later. Ula studies at B. Every student is onboarded (Computer Science, batch 2027) unless noted.
 *
 * Signing keys are made by the tests, never stored: the recorder installs one on the stack inside its rolled-back
 * transaction, the replays and the contract tests make their own and pass them through TransportOptions.secrets.
 */
const pad = (i: number, n = 2) => String(i).padStart(n, "0");
const U = (i: number) => `98b00000-0000-4000-8000-0000000000${pad(i)}`;

export const UNI_A = "98a00000-0000-4000-8000-00000000000a";
export const UNI_B = "98a00000-0000-4000-8000-00000000000b";
export const UNIS = [UNI_A, UNI_B];
export const UNIVERSITIES = [
  { id: UNI_A, name: "Credentials Golden University A", slug: "credentials-golden-a", domain: "cred-a.test" },
  { id: UNI_B, name: "Credentials Golden University B", slug: "credentials-golden-b", domain: "cred-b.test" },
];

export const PRIYA = U(1);
export const OSMAN = U(2);
export const MEHR = U(3);
export const SAMI = U(4);
export const NIDA = U(5);
export const TARIQ = U(6);
export const ULA = U(7);
/** Zara has no account at the start: she walks in by email and signs up in the claim case. */
export const ZARA = U(8);
export const USERS = [PRIYA, OSMAN, MEHR, SAMI, NIDA, TARIQ, ULA];
export const ALL_USERS = [...USERS, ZARA];

export const UNI_OF: Record<string, string> = Object.fromEntries(ALL_USERS.map((u) => [u, u === ULA ? UNI_B : UNI_A]));
export const NAME: Record<string, string> = {
  [PRIYA]: "Priya Heron",
  [OSMAN]: "Osman Heron",
  [MEHR]: "Mehr Heron",
  [SAMI]: "Sami Heron",
  [NIDA]: "Nida Heron",
  [TARIQ]: "Tariq Heron",
  [ULA]: "Ula Kestrel",
  [ZARA]: "Zara Heron",
};
export const USERNAME: Record<string, string> = Object.fromEntries(ALL_USERS.map((u) => [u, `cr_${NAME[u]!.split(" ")[0]!.toLowerCase()}`]));
export const EMAIL: Record<string, string> = Object.fromEntries(
  ALL_USERS.map((u) => [u, `${USERNAME[u]!.slice(3)}@${u === ULA ? "cred-b.test" : "cred-a.test"}`]),
);
export const DEPARTMENT = "Computer Science";
export const BATCH = 2027;

export const SOC = "98c00000-0000-4000-8000-000000000001";
export const SOC_SLUG = "heron-astronomy";
export const SOC_NAME = "Heron Astronomy Society";
export const SOC_KEY = "heron astronomy";
export const PENDING = "98c00000-0000-4000-8000-000000000002";
export const PENDING_SLUG = "heron-chess";
export const PENDING_NAME = "Heron Chess Club";
export const PENDING_KEY = "heron chess";

/** SOC's ended event (two sessions; record kinds attended, completed, result, volunteer). */
export const EVENT = "98e00000-0000-4000-8000-000000000001";
export const EVENT_TITLE = "Night sky workshop";
export const SESSION_1 = "98e00000-0000-4000-8000-000000000011";
export const SESSION_2 = "98e00000-0000-4000-8000-000000000012";
/** PENDING's ended event: an unverified society issues nothing. */
export const EVENT_PENDING = "98e00000-0000-4000-8000-000000000002";
export const SESSION_PENDING = "98e00000-0000-4000-8000-000000000021";
/** Zara's walk-in row on SOC's event. */
export const WALK_IN = "98e00000-0000-4000-8000-000000000031";
export const RESULT_LABEL = "Best sketch";

/** Terms: Priya's (president, a year) and Osman's (officer). */
export const TERM_PRIYA = "98f00000-0000-4000-8000-000000000001";
export const TERM_OSMAN = "98f00000-0000-4000-8000-000000000002";
export const TERM_TITLE_PRIYA = "President";
export const TERM_TITLE_OSMAN = "General Secretary";

/** Sami's work (work's facts, as work's CvFacts returns them and as the stack's rows produce them). */
export const SKILL_ID = "android";
export const SKILL_NAME = "Android";
export const SKILL_CATEGORY = "platform";
export const SKILL_REPOS = 2;
export const SKILL_DAYS = 5;
export const VENTURE = "98d00000-0000-4000-8000-000000000001";
export const VENTURE_TITLE = "Heron Tracker";
export const VENTURE_DESCRIPTION = "A tracker for the observatory's telescope bookings.";
/** Sami's published tier: spark, ranked, percentile 0.9 (top 10%). */
export const TIER = "spark";
export const PERCENTILE = 0.9;

/** Proof tasks and swaps reach the Record as work's events; their ids. */
export const ATTEMPT = "98d00000-0000-4000-8000-000000000011";
export const TASK_TITLE = "Build a list screen";
export const SWAP = "98d00000-0000-4000-8000-000000000021";

/** Ids the recorder and the replays send (exports, transcript). */
export const EXPORT_CV = "98d10000-0000-4000-8000-000000000001";
export const EXPORT_CERT = "98d10000-0000-4000-8000-000000000002";
export const EXPORT_TRANSCRIPT = "98d10000-0000-4000-8000-000000000003";
/** Token hashes and viewer keys the recorder sends (the stack takes hashes; the port makes its tokens). */
export const LINK_HASH = "1".repeat(64);
export const LINK_HASH_2 = "2".repeat(64);
export const VIEWER = "a".repeat(64);
export const VIEWER_2 = "b".repeat(64);
export const PDF_HASH = "c".repeat(64);

/** The CV's work parts, as work's CvFacts returns them for Sami (the stack's cv_snapshot_base on the rows above). */
export function workFactsFor(user: string): Record<string, unknown> {
  if (user !== SAMI)
    return { skills: [], projects: [], open_source: [], endorsements: [], credentials: [], top_skills: [], projects_count: 0, completed_count: 0, pull_requests_count: 0 };
  return {
    skills: [
      {
        id: SKILL_ID,
        name: SKILL_NAME,
        category: SKILL_CATEGORY,
        level: 2,
        ai_assisted: false,
        evidence: { repos: SKILL_REPOS, active_days: SKILL_DAYS, pull_requests: 0, entries: 0, endorsements: 0 },
      },
    ],
    projects: [],
    open_source: [],
    endorsements: [],
    credentials: [],
    top_skills: [SKILL_NAME],
    projects_count: 0,
    completed_count: 0,
    pull_requests_count: 0,
  };
}

type Row = Record<string, unknown>;

/** Values the stack makes at random or from the clock, recorded as their type (never their value). */
export function typed(value: unknown, key = ""): unknown {
  if (typeof value === "string") {
    let s = value
      .replace(/\b\d{1,2} [A-Z][a-z]{2} \d{4}\b/g, "<pkt date>")
      .replace(/\b[A-Z][a-z]{2} \d{4}\b/g, "<month>")
      .replace(/Checked in \d{2}:\d{2}/g, "Checked in <hh:mm>")
      .replace(/cv-\d{8}-[0-9a-f]{8}/g, "<key id>");
    if (/^\d{4}-\d{2}-\d{2}$/.test(s) || /^\d{4}-\d{2}$/.test(s)) s = "<date>";
    if (/^[0-9a-f]{64}$/.test(s) && !/^(.)\1{63}$/.test(s)) s = "<sha256>";
    if (/^[A-Za-z0-9_-]{86}$/.test(s)) s = "<signature>";
    if (/^[A-Za-z0-9_-]{43}$/.test(s) && (key === "public_key" || key === "key")) s = "<public key>";
    if (/^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{10}$/.test(s) && /code|codes|supersedes/.test(key)) s = "<code>";
    return s;
  }
  if (Array.isArray(value)) return value.map((v) => typed(v, key));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Row).map(([k, v]) => [k, typed(v, k)]));
  return value;
}
