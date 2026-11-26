/**
 * The ranking reference world (docs/ranking-reference.md; apps/web/supabase/tests/32_ranking_reference.test.sql)
 * as data, so the same facts are built twice: on the current stack by packages/testing/test/ranking.golden.test.ts
 * (as rows in its tables) and in ranking's own schema by services/ranking/test (as the events other services
 * publish). Ids are fixed and RFC 4122 (version 4 bits), so recordings are stable and ranking's event schemas
 * accept them. As of Wednesday 9 December 2026, 12:00 PKT.
 *
 * R1 to R13 are the reference students (R7 at university B, the rest at A); Q1 to Q10 answer surveys, apply to
 * ventures and endorse R10. The extra facts at the end (departments, batches, an opt-out, a graduate, a deleting
 * account, a block, last week's snapshot) are for the boards and touch no reference number.
 */
import { createHash } from "node:crypto";

export const AS_OF = "2026-12-09T12:00:00+05:00";
/** PKT wall time "YYYY-MM-DD HH:MM" → an ISO instant. */
export const pkt = (s: string) => `${s.replace(" ", "T")}:00+05:00`;
const pad = (i: number, n = 2) => String(i).padStart(n, "0");

export const R = (i: number) => `93200000-0000-4000-8000-0000000000${pad(i)}`;
export const Q = (i: number) => `93200000-0000-4000-8000-0000000001${pad(i)}`;
export const V = (i: number) => `93200000-0000-4000-8000-00000000a0${pad(i)}`;
export const UNI_A = "93200000-0000-4000-8000-00000000f001";
export const UNI_B = "93200000-0000-4000-8000-00000000f002";
export const SOC = (k: "a" | "b" | "c" | "d") => `93200000-0000-4000-8000-0000000005${k}1`;
/** A stable version-4 id for a tag (contributions, posts, endorsements, credentials, entries). */
export function fid(tag: string): string {
  const h = createHash("md5").update(`ranking-reference:${tag}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export const UNIVERSITIES = [
  { id: UNI_A, name: "Ranking Golden University A", slug: "ranking-golden-a", domain: "ranking-a.test" },
  { id: UNI_B, name: "Ranking Golden University B", slug: "ranking-golden-b", domain: "ranking-b.test" },
];

export interface Student {
  id: string;
  tag: string;
  university: string;
  department: string;
  batch: number;
}
const dept = (i: number) => (i >= 8 && i <= 10 ? "Software Engineering" : "Computer Science");
export const STUDENTS: Student[] = [
  ...Array.from({ length: 13 }, (_, k) => k + 1).map((i) => ({ id: R(i), tag: `r${i}`, university: i === 7 ? UNI_B : UNI_A, department: dept(i), batch: i >= 8 && i <= 10 ? 2028 : 2027 })),
  ...Array.from({ length: 10 }, (_, k) => k + 1).map((i) => ({ id: Q(i), tag: `q${i}`, university: UNI_A, department: "Computer Science", batch: 2026 })),
];
export const emailOf = (s: Student) => `${s.tag}@${s.university === UNI_A ? "ranking-a.test" : "ranking-b.test"}`;
export const nameOf = (s: Student) => `Ref ${s.tag.toUpperCase()} Kestrel`;
export const usernameOf = (s: Student) => `rk_${s.tag}`;

/** Skill categories of every skill the world uses (the stack's catalogue). */
export const CATEGORY: Record<string, string> = {
  aws: "platform", css: "language", django: "framework", docker: "tool", flask: "framework", gin: "framework", go: "language", html: "language",
  java: "language", javascript: "language", jest: "library", kotlin: "language", kubernetes: "tool", linting: "practice", numpy: "library",
  pandas: "library", postgresql: "platform", pytest: "library", python: "language", pytorch: "library", react: "framework", redis: "platform",
  rust: "language", sql: "language", swift: "language", terraform: "tool", typescript: "language", vue: "framework",
};

/** Skill labels (the stack's catalogue names). */
export const LABEL: Record<string, string> = {
  aws: "Amazon Web Services", css: "CSS", django: "Django", docker: "Docker", flask: "Flask", gin: "Gin", go: "Go", html: "HTML", java: "Java",
  javascript: "JavaScript", jest: "Jest", kotlin: "Kotlin", kubernetes: "Kubernetes", linting: "Linting and code style", numpy: "NumPy",
  pandas: "pandas", postgresql: "PostgreSQL", pytest: "pytest", python: "Python", pytorch: "PyTorch", react: "React", redis: "Redis", rust: "Rust",
  sql: "SQL", swift: "Swift", terraform: "Terraform", typescript: "TypeScript", vue: "Vue",
};

export interface Venture {
  id: string;
  owner: string;
  title: string;
  skills: string[];
  created: string;
  members: string[];
  deliverables: number;
  /** completed_at (PKT) for completed ventures; recruiting / in_progress otherwise. */
  completed?: string;
  status: "recruiting" | "in_progress" | "completed";
}
export const VENTURES: Venture[] = [
  { id: V(1), owner: R(1), title: "Timetable", skills: ["react", "typescript", "python", "docker"], created: "2026-06-01 12:00", members: [R(1), R(2), R(3), R(4)], deliverables: 1, completed: "2026-09-21 12:00", status: "completed" },
  { id: V(2), owner: R(5), title: "Canteen", skills: ["python", "django", "postgresql", "pytest", "go", "gin", "docker", "redis"], created: "2026-07-01 12:00", members: [R(5), R(6)], deliverables: 4, completed: "2026-07-29 12:00", status: "completed" },
  { id: V(3), owner: R(2), title: "Library", skills: ["react"], created: "2026-05-01 12:00", members: [R(2), R(3), R(9), R(10)], deliverables: 0, status: "in_progress" },
  { id: V(4), owner: R(7), title: "Hostel", skills: ["html", "css"], created: "2026-08-01 12:00", members: [R(7), R(8)], deliverables: 1, completed: "2026-12-01 12:00", status: "completed" },
  { id: V(5), owner: R(5), title: "Bus routes", skills: ["python"], created: "2026-11-01 12:00", members: [R(5)], deliverables: 0, status: "recruiting" },
  { id: V(8), owner: R(8), title: "Study groups", skills: ["sql"], created: "2026-09-01 12:00", members: [R(8)], deliverables: 0, status: "recruiting" },
];

export interface Entry {
  tag: string;
  author: string;
  venture: string;
  source: "manual" | "github";
  at: string;
  confirmer: string | null;
  confirmedAt: string | null;
}
const e = (tag: string, author: string, venture: string, source: "manual" | "github", at: string, confirmer: string | null = null, confirmedAt: string | null = null): Entry => ({
  tag,
  author,
  venture,
  source,
  at,
  confirmer,
  confirmedAt,
});
export const ENTRIES: Entry[] = [
  e("r1a", R(1), V(1), "manual", "2026-06-10 10:00", R(2), "2026-09-21 10:00"),
  e("r1b", R(1), V(1), "manual", "2026-07-15 10:00", R(2), "2026-09-21 10:00"),
  e("r1c", R(1), V(1), "manual", "2026-09-14 10:00", R(2), "2026-09-21 10:00"),
  e("r1d", R(1), V(1), "manual", "2026-09-21 09:00", R(2), "2026-09-21 10:00"),
  e("r2a", R(2), V(1), "github", "2026-09-10 10:00"),
  e("r2b", R(2), V(1), "github", "2026-09-10 16:00"),
  e("r2c", R(2), V(1), "github", "2026-09-11 10:00"),
  e("r2d", R(2), V(1), "manual", "2026-09-12 10:00"),
  e("r2e", R(2), V(1), "manual", "2026-09-13 10:00"),
  e("r3a", R(3), V(1), "manual", "2026-08-20 10:00", R(1), "2026-09-15 10:00"),
  e("r3b", R(3), V(1), "manual", "2026-08-21 10:00"),
  e("r3c", R(3), V(1), "manual", "2026-08-22 10:00"),
  e("r4a", R(4), V(1), "manual", "2026-09-01 10:00"),
  e("r4b", R(4), V(1), "manual", "2026-09-05 10:00"),
  e("r5a", R(5), V(2), "manual", "2026-07-10 10:00", R(6), "2026-07-25 10:00"),
  e("r5b", R(5), V(2), "manual", "2026-07-15 10:00", R(6), "2026-07-25 10:00"),
  e("r5c", R(5), V(2), "manual", "2026-07-20 10:00", R(6), "2026-07-25 10:00"),
  e("r6a", R(6), V(2), "github", "2026-07-05 10:00"),
  e("r6b", R(6), V(2), "github", "2026-07-06 10:00"),
  e("r6c", R(6), V(2), "github", "2026-07-07 10:00"),
  e("r2f", R(2), V(3), "github", "2026-11-10 10:00"),
  e("r2g", R(2), V(3), "manual", "2026-11-24 10:00"),
  e("r3d", R(3), V(3), "manual", "2026-10-12 10:00", R(2), "2026-10-13 10:00"),
  e("r9a", R(9), V(3), "manual", "2026-12-02 10:00", R(2), "2026-12-03 10:00"),
  e("r10a", R(10), V(3), "github", "2026-06-01 10:00"),
  e("r8a", R(8), V(4), "manual", "2026-09-29 10:00"),
  e("r8b", R(8), V(4), "manual", "2026-10-13 10:00"),
  e("r8c", R(8), V(4), "manual", "2026-10-27 10:00"),
  e("r8d", R(8), V(4), "manual", "2026-11-10 10:00"),
  e("r8e", R(8), V(4), "manual", "2026-11-24 10:00"),
  ...Array.from({ length: 20 }, (_, k) => e(`r7_${k + 1}`, R(7), V(4), "manual", "2026-09-15 10:00", R(8), "2026-09-16 10:00")),
];
/** A GitHub entry's commit sha (40 hex), stable per tag. */
export const shaOf = (tag: string) => createHash("sha1").update(`ranking-reference:${tag}`).digest("hex");

export interface PullRequest {
  user: string;
  repoId: number;
  number: number;
  prId: number;
  repo: string;
  mergedAt: string;
  counted: boolean;
}
export const PULL_REQUESTS: PullRequest[] = [
  { user: R(2), repoId: 93201, number: 1, prId: 9320101, repo: "org/one", mergedAt: "2026-10-05 10:00", counted: true },
  { user: R(2), repoId: 93201, number: 2, prId: 9320102, repo: "org/one", mergedAt: "2026-10-06 10:00", counted: true },
  { user: R(2), repoId: 93202, number: 1, prId: 9320201, repo: "org/two", mergedAt: "2026-11-11 10:00", counted: true },
  { user: R(2), repoId: 93203, number: 1, prId: 9320301, repo: "rk2/own", mergedAt: "2026-11-12 10:00", counted: false },
  ...Array.from({ length: 25 }, (_, k) => ({
    user: R(6),
    repoId: 93206,
    number: k + 1,
    prId: 9320600 + k + 1,
    repo: "org/six",
    mergedAt: k + 1 <= 13 ? "2026-10-01 10:00" : "2026-10-28 10:00",
    counted: true,
  })),
];

export interface Post {
  tag: string;
  author: string;
  at: string;
  /** Answerers, in order Q1.. (each an Informative tick, except p5b's Q6 to Q10, crosses). */
  answers: number;
}
export const POSTS: Post[] = [
  { tag: "p1", author: R(1), at: "2026-12-01 10:00", answers: 10 },
  { tag: "p2", author: R(2), at: "2026-10-20 10:00", answers: 4 },
  { tag: "p5a", author: R(5), at: "2026-11-02 10:00", answers: 10 },
  { tag: "p5b", author: R(5), at: "2026-11-03 10:00", answers: 10 },
  { tag: "p5c", author: R(5), at: "2026-11-20 10:00", answers: 6 },
  { tag: "p7", author: R(7), at: "2026-09-30 12:00", answers: 10 },
  ...["a", "b", "c", "d", "e", "f", "g"].map((x, k) => ({
    tag: `p8${x}`,
    author: R(8),
    at: ["2026-09-22 10:00", "2026-10-06 10:00", "2026-10-20 10:00", "2026-11-03 10:00", "2026-11-17 10:00", "2026-12-01 10:00", "2026-12-08 10:00"][k]!,
    answers: 10,
  })),
];
export const answerOf = (post: Post, i: number) => !(post.tag === "p5b" && i >= 6);
/** An answer lands an hour after the post. */
export const answeredAt = (post: Post) => new Date(new Date(pkt(post.at)).getTime() + 3600_000).toISOString();
export const FRIENDSHIPS: [string, string][] = [1, 2, 3, 4].map((i) => [R(5), Q(i)]);

export interface Application {
  id: string;
  venture: string;
  candidate: string;
  owner: string;
  status: "accepted" | "declined";
  created: string;
  decided: string;
}
const addHours = (iso: string, h: number) => new Date(new Date(iso).getTime() + h * 3600_000).toISOString();
export const APPLICATIONS: Application[] = [
  ...[1, 2, 3, 4].map((i) => ({
    id: fid(`app-v1-${i}`),
    venture: V(1),
    candidate: Q(i),
    owner: R(1),
    status: (i % 2 === 0 ? "accepted" : "declined") as "accepted" | "declined",
    created: pkt("2026-06-05 10:00"),
    decided: addHours(pkt("2026-06-05 10:00"), i === 4 ? 80 : 24),
  })),
  ...Array.from({ length: 12 }, (_, k) => k + 1).map((i) => ({
    id: fid(`app-v5-${i}`),
    venture: V(5),
    candidate: i <= 10 ? Q(i) : R(i - 10),
    owner: R(5),
    status: "declined" as const,
    created: addHours(pkt("2026-11-24 10:00"), 24 * (i - 1)),
    decided: addHours(pkt("2026-11-24 10:00"), 24 * (i - 1) + 20),
  })),
  ...Array.from({ length: 11 }, (_, k) => k + 1).map((i) => ({
    id: fid(`app-v8-${i}`),
    venture: V(8),
    candidate: i <= 10 ? Q(i) : R(1),
    owner: R(8),
    status: "declined" as const,
    created: pkt("2026-10-01 10:00"),
    decided: pkt("2026-10-02 10:00"),
  })),
];

export interface Credential {
  id: string;
  user: string;
  title: string;
  expires: string | null;
  status: "approved" | "pending";
  issuer: string | null;
}
const cred = (tag: string, user: string, title: string, expires: string | null, status: "approved" | "pending", issuer: string | null): Credential => ({
  id: fid(`cred-${tag}`),
  user,
  title,
  expires,
  status,
  issuer,
});
export const CREDENTIALS: Credential[] = [
  cred("r1a", R(1), "Cloud Practitioner", null, "approved", "aws"),
  cred("r1b", R(1), "Local course", null, "approved", null),
  cred("r1c", R(1), "Old course", "2026-12-08", "approved", null),
  cred("r1d", R(1), "Waiting", null, "pending", null),
  cred("r5a", R(5), "Python", null, "approved", "google"),
  cred("r5b", R(5), "Django", null, "approved", "microsoft"),
  cred("r5c", R(5), "SQL", null, "approved", "oracle"),
  cred("r8a", R(8), "Freelancing", "2026-12-09", "approved", "nftp"),
];
/** Every credential is created on 10 January 2026 (the issue date) and reviewed on 1 February. */
export const CREDENTIAL_CREATED = pkt("2026-01-10 10:00");

export interface Endorsement {
  id: string;
  endorser: string;
  endorsee: string;
  venture: string;
  skill: string;
  at: string;
  hidden: boolean;
}
const end = (tag: string, endorser: string, endorsee: string, venture: string, skill: string, at: string, hidden = false): Endorsement => ({
  id: fid(`end-${tag}`),
  endorser,
  endorsee,
  venture,
  skill,
  at,
  hidden,
});
export const ENDORSEMENTS: Endorsement[] = [
  end("r2r1", R(2), R(1), V(1), "react", "2026-09-22 10:00"),
  end("r3r1", R(3), R(1), V(1), "typescript", "2026-09-22 10:00"),
  end("r1r2", R(1), R(2), V(1), "react", "2026-09-22 10:00"),
  end("r4r2", R(4), R(2), V(1), "javascript", "2026-09-22 10:00"),
  end("r3r2", R(3), R(2), V(1), "python", "2026-09-22 10:00", true),
  end("r6r5", R(6), R(5), V(2), "python", "2026-07-30 10:00"),
  end("r5r6", R(5), R(6), V(2), "go", "2026-07-30 10:00"),
  end("r7r8", R(7), R(8), V(4), "sql", "2026-12-02 10:00"),
  ...Array.from({ length: 10 }, (_, k) => k + 1).flatMap((i) => ["rust", "go"].map((s) => end(`q${i}${s}`, Q(i), R(10), V(3), s, "2026-11-01 10:00"))),
];

export const PENALTIES = [
  { id: fid("pen-r3-low"), user: R(3), severity: "low", reason: "Spam in comments", at: "2026-11-01 10:00" },
  { id: fid("pen-r3-medium"), user: R(3), severity: "medium", reason: "Older, expired", at: "2025-11-01 10:00" },
  { id: fid("pen-r9-high"), user: R(9), severity: "high", reason: "Harassment", at: "2026-12-01 10:00" },
] as const;

export const EXAM_PERIODS = [{ id: fid("exam-b"), university: UNI_B, starts: "2026-10-15", ends: "2026-11-13", reason: "Mid-terms" }];

/** "The previous run": endorsers' tiers, and R7's Momentum peak (formula version 1). */
export const PREVIOUS: { user: string; tier: string | null; ranked: boolean; peak: number }[] = [
  { user: R(1), tier: "shine", ranked: true, peak: 0 },
  { user: R(2), tier: "spark", ranked: true, peak: 0 },
  { user: R(5), tier: "flare", ranked: true, peak: 0 },
  { user: R(6), tier: "radiant", ranked: true, peak: 0 },
  { user: R(7), tier: null, ranked: false, peak: 220 },
  ...Array.from({ length: 10 }, (_, k) => ({ user: Q(k + 1), tier: "luminary", ranked: true, peak: 0 })),
];

export const SKILLS: [string, string, number][] = [
  [R(1), "react", 3], [R(1), "typescript", 2], [R(1), "python", 4], [R(1), "docker", 2], [R(1), "rust", 1],
  [R(2), "react", 2], [R(2), "javascript", 2],
  [R(3), "sql", 2],
  [R(5), "python", 3], [R(5), "django", 3], [R(5), "postgresql", 2], [R(5), "pytest", 2],
  [R(6), "go", 4], [R(6), "gin", 3], [R(6), "docker", 3], [R(6), "redis", 2], [R(6), "kubernetes", 2],
  [R(7), "html", 2], [R(7), "css", 2],
  [R(9), "rust", 2],
  ...["rust", "go", "python", "java", "kotlin", "swift", "react", "vue", "django", "flask", "numpy", "pandas", "pytorch", "docker", "kubernetes",
      "terraform", "aws", "postgresql", "redis", "linting", "jest"].map((s): [string, string, number] => [R(10), s, 4]),
];

export const SOCIETIES = [
  { id: SOC("a"), slug: "rk-ref-a", name: "Ref CS Society", verified: "2026-01-01 12:00" },
  { id: SOC("b"), slug: "rk-ref-b", name: "Ref Debating Society", verified: "2026-01-01 12:00" },
  { id: SOC("c"), slug: "rk-ref-c", name: "Ref Robotics Club", verified: "2026-11-20 12:00" },
  { id: SOC("d"), slug: "rk-ref-d", name: "Ref Film Society", verified: "2026-01-01 12:00" },
];

export interface RecordEntry {
  id: string;
  user: string;
  society: "a" | "b" | "c" | "d" | null;
  kind: string;
  evidence: Record<string, unknown>;
  on: string;
  status: "sealed" | "revoked" | "superseded";
}
const term = (role: string, from: string, to: string) => ({ line: "Reference term", role, from, to });
let n = 0;
const rec = (user: number, society: RecordEntry["society"], kind: string, evidence: Record<string, unknown>, on: string, status: RecordEntry["status"] = "sealed"): RecordEntry => ({
  id: fid(`rec-${++n}`),
  user: R(user),
  society,
  kind,
  evidence,
  on,
  status,
});
export const RECORD: RecordEntry[] = [
  rec(11, "a", "office_bearer", term("president", "2025-09-01", "2026-06-30"), "2026-06-30"),
  rec(11, "a", "office_bearer", term("officer", "2025-09-01", "2026-01-31"), "2026-01-31"),
  rec(11, "a", "result", { line: "1st of 12 teams", place: 1, entrants: 12 }, "2026-11-15"),
  rec(11, "b", "result", { line: "2nd of 4", place: 2, entrants: 4 }, "2026-10-01"),
  rec(11, "b", "result", { line: "3rd of 8", place: 3, entrants: 8 }, "2026-10-20"),
  rec(11, "b", "attended", { line: "Checked in 10:04" }, "2026-10-20"),
  rec(11, "b", "volunteer", { line: "6 h", minutes: 360 }, "2026-10-10"),
  rec(11, "b", "volunteer", { line: "5 h", minutes: 300 }, "2026-11-20"),
  rec(12, "a", "office_bearer", term("president", "2025-09-01", "2026-06-30"), "2026-06-30"),
  rec(12, "a", "office_bearer", term("officer", "2026-09-01", "2026-11-30"), "2026-11-30"),
  rec(12, "b", "office_bearer", term("president", "2025-09-01", "2026-06-30"), "2026-06-30"),
  rec(12, "b", "result", { line: "1st of 5", place: 1, entrants: 5 }, "2026-11-01"),
  rec(12, "c", "office_bearer", term("officer", "2026-09-01", "2026-12-01"), "2026-12-01"),
  rec(12, "d", "result", { line: "Finalist of 20", place: 5, entrants: 20 }, "2026-11-05"),
  rec(13, "a", "attended", { line: "Checked in 09:58" }, "2026-10-01"),
  rec(13, "a", "attended", { line: "Checked in 14:02" }, "2026-11-01"),
  rec(13, "a", "completed", { line: "3 of 4 sessions", sessions: 3, of: 4 }, "2026-11-10"),
  rec(13, "a", "result", { line: "1st of 10", place: 1, entrants: 10 }, "2026-11-12", "revoked"),
  rec(13, "b", "volunteer", { line: "4 h", minutes: 240 }, "2026-11-02", "superseded"),
  rec(13, "b", "volunteer", { line: "3 h", minutes: 180 }, "2026-11-02"),
  rec(13, null, "venture_completed", { line: "Team of 4 · completed 21 Sep 2026", team_size: 4 }, "2026-09-21"),
];
/** An entry is signed at noon PKT on its date. */
export const signedAt = (r: RecordEntry) => pkt(`${r.on} 12:00`);

// ---------------------------------------------------------------------------
// Board extras (no reference number depends on them)
// ---------------------------------------------------------------------------
export const OPTED_OUT = R(6);
export const GRADUATE = R(9); // graduated 13 months ago: off university boards, still on the global one
export const DELETING = Q(10);
export const BLOCK: [string, string] = [R(2), R(3)]; // R2 blocked R3
/** Last week's snapshot (Sunday 22 November 2026): totals and ranked flags for weekly change. */
export const LAST_WEEK = "2026-11-22";
export const SNAPSHOT_ROWS = [
  { user: R(1), total: 600, ranked: true, tier: "shine" },
  { user: R(5), total: 100, ranked: true, tier: "flare" },
  { user: R(2), total: 300, ranked: true, tier: "spark" },
  { user: R(8), total: 50, ranked: true, tier: "raw" },
];

// ---------------------------------------------------------------------------
// Flag cases (flags.json)
// ---------------------------------------------------------------------------
/** Q5 and Q6 endorse each other through an in-progress venture with no outside evidence: a ring. */
export const RING_VENTURE: Venture = { id: V(9), owner: Q(5), title: "Ring venture", skills: ["python"], created: "2026-10-01 12:00", members: [Q(5), Q(6)], deliverables: 0, status: "in_progress" };
export const RING_ENDORSEMENTS: Endorsement[] = [
  end("ring-a", Q(5), Q(6), V(9), "python", "2026-11-01 10:00"),
  end("ring-b", Q(6), Q(5), V(9), "python", "2026-11-02 10:00"),
];
/** Q9 is the trust reviewer and accounts staff in the flag and exam cases (two-factor session). */
export const STAFF = Q(9);
/** The rapid-gain case: R1's previous published score under the formula in force (version 2), before V1 counted. */
export const RAPID_PREVIOUS = { user: R(1), total: 100, tier: "shine" };
