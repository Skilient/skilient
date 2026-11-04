import "server-only";

import { rpcJson } from "@/lib/data/rpc-json";
import { clockTime, dayLabel } from "@/lib/format/time";
import type { PathStepState, TaskStatus, SwapStatus, SessionStatus } from "@/lib/growth/constants";
import { publicImageUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

/**
 * Paths, proof tasks and the skill swap (PRD 5.32). Each read is one SQL function that checks
 * the caller (supabase/migrations/20261113000001_paths_tasks.sql, ..02_skill_swap.sql); dates
 * are formatted here, on the server, and passed to client components as labels.
 */

const avatar = (path: string | null | undefined) => publicImageUrl("avatars", path ?? null);
const when = (iso: string | null | undefined) => (iso ? `${dayLabel(iso)}, ${clockTime(iso)}` : null);

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

export interface PathCard {
  role: string;
  name: string;
  pictogram: string;
  source: "data" | "starter";
  seniors: number | null;
  following: boolean;
  total: number;
  proved: number;
  nextSkill: string | null;
  nextName: string | null;
}

export interface OpenTask {
  id: string;
  title: string;
  skill: string;
  status: TaskStatus;
  startedLabel: string;
}

export interface ReviewOffer {
  id: string;
  status: "offered" | "accepted";
  title: string;
  skill: string;
  student: string;
  offeredLabel: string;
}

export interface MyPaths {
  maxFollows: number;
  minSeniors: number;
  githubConnected: boolean;
  roles: PathCard[];
  tasks: OpenTask[];
  reviews: ReviewOffer[];
  reviewsLeft: number;
}

interface RawPaths {
  max_follows: number;
  min_seniors: number;
  github_connected: boolean;
  roles: { role: string; name: string; pictogram: string; source: "data" | "starter"; seniors: number | null; following: boolean; total: number; proved: number; next_skill: string | null; next_name: string | null }[];
  tasks: { id: string; title: string; skill: string; status: TaskStatus; started_at: string }[];
  reviews: { id: string; status: "offered" | "accepted"; title: string; skill: string; student: string; offered_at: string }[];
  reviews_left: number;
}

export async function getMyPaths(): Promise<MyPaths> {
  const r = await rpcJson<RawPaths>("my_paths");
  return {
    maxFollows: r.max_follows,
    minSeniors: r.min_seniors,
    githubConnected: r.github_connected,
    roles: r.roles.map((p) => ({
      role: p.role, name: p.name, pictogram: p.pictogram, source: p.source, seniors: p.seniors, following: p.following,
      total: p.total, proved: p.proved, nextSkill: p.next_skill, nextName: p.next_name,
    })),
    tasks: r.tasks.map((t) => ({ id: t.id, title: t.title, skill: t.skill, status: t.status, startedLabel: dayLabel(t.started_at) })),
    reviews: r.reviews.map((v) => ({ id: v.id, status: v.status, title: v.title, skill: v.skill, student: v.student, offeredLabel: dayLabel(v.offered_at) })),
    reviewsLeft: r.reviews_left,
  };
}

export interface PathStep {
  skillId: string;
  name: string;
  position: number;
  state: PathStepState;
  level: number;
  provedOn: string | null;
  attemptId: string | null;
  attemptStatus: TaskStatus | null;
}

export interface PathView {
  role: string;
  name: string;
  pictogram: string;
  source: "data" | "starter";
  seniors: number | null;
  following: boolean;
  total: number;
  proved: number;
  next: { skillId: string; name: string } | null;
  steps: PathStep[];
}

interface RawPathView {
  role: string;
  name: string;
  pictogram: string;
  source: "data" | "starter";
  seniors: number | null;
  following: boolean;
  total: number;
  proved: number;
  next: { skill_id: string; name: string } | null;
  steps: { skill_id: string; name: string; position: number; state: PathStepState; level: number; proved_on: string | null; attempt_id: string | null; attempt_status: TaskStatus | null }[];
}

export async function getPathView(role: string): Promise<PathView> {
  const r = await rpcJson<RawPathView>("path_view", { p_role: role });
  return {
    role: r.role, name: r.name, pictogram: r.pictogram, source: r.source, seniors: r.seniors, following: r.following,
    total: r.total, proved: r.proved, next: r.next ? { skillId: r.next.skill_id, name: r.next.name } : null,
    steps: r.steps.map((s) => ({
      skillId: s.skill_id, name: s.name, position: s.position, state: s.state, level: s.level, provedOn: s.proved_on,
      attemptId: s.attempt_id, attemptStatus: s.attempt_status,
    })),
  };
}

// ---------------------------------------------------------------------------
// Proof tasks
// ---------------------------------------------------------------------------

export interface MyTask {
  id: string;
  status: TaskStatus;
  verifiedBy: "github" | "peer" | "code_check" | null;
  note: string | null;
  startedLabel: string;
  submittedLabel: string | null;
  doneLabel: string | null;
  repo: { id: number; fullName: string } | null;
  task: { id: string; title: string; brief: string; checklist: string[]; difficulty: "starter" | "core" | "stretch" };
  skill: { id: string; name: string };
  githubConnected: boolean;
  repos: { id: number; fullName: string }[];
  codeCheck: { blocker: string | null; id: string | null; status: string | null };
  peers: { offered: number; accepted: boolean; round: number };
  recordCode: string | null;
}

interface RawTask {
  id: string;
  status: TaskStatus;
  verified_by: MyTask["verifiedBy"];
  note: string | null;
  started_at: string;
  submitted_at: string | null;
  done_at: string | null;
  repo: { id: number; full_name: string } | null;
  task: MyTask["task"];
  skill: MyTask["skill"];
  github_connected: boolean;
  repos: { id: number; full_name: string }[];
  code_check: MyTask["codeCheck"];
  peers: MyTask["peers"];
  record_code: string | null;
}

export async function getMyTask(id: string): Promise<MyTask> {
  const r = await rpcJson<RawTask>("my_task", { p_attempt: id });
  return {
    id: r.id, status: r.status, verifiedBy: r.verified_by, note: r.note,
    startedLabel: dayLabel(r.started_at), submittedLabel: when(r.submitted_at), doneLabel: r.done_at ? dayLabel(r.done_at) : null,
    repo: r.repo ? { id: Number(r.repo.id), fullName: r.repo.full_name } : null,
    task: r.task, skill: r.skill, githubConnected: r.github_connected,
    repos: r.repos.map((x) => ({ id: Number(x.id), fullName: x.full_name })),
    codeCheck: r.code_check, peers: r.peers, recordCode: r.record_code,
  };
}

export interface TaskReview {
  id: string;
  status: "offered" | "accepted" | "declined" | "expired" | "withdrawn" | "confirmed" | "needs_changes";
  note: string | null;
  student: string;
  university: string | null;
  skill: string;
  task: { title: string; brief: string; checklist: string[]; difficulty: string };
  repo: string | null;
  submittedLabel: string | null;
  reviewsLeft: number;
}

export async function getTaskReview(id: string): Promise<TaskReview> {
  const r = await rpcJson<{
    id: string; status: TaskReview["status"]; note: string | null; student: string; university: string | null; skill: string;
    task: TaskReview["task"]; repo: string | null; submitted_at: string | null; reviews_left: number;
  }>("task_review_page", { p_review: id });
  return {
    id: r.id, status: r.status, note: r.note, student: r.student, university: r.university, skill: r.skill, task: r.task,
    repo: r.repo, submittedLabel: when(r.submitted_at), reviewsLeft: r.reviews_left,
  };
}

// ---------------------------------------------------------------------------
// The skill drawer
// ---------------------------------------------------------------------------

export interface SkillDrawer {
  skill: { id: string; name: string };
  level: number;
  state: PathStepState | null;
  why: { path: string; source: "data" | "starter"; seniors: number | null; position: number | null; prev: string | null; afterDays: number | null } | null;
  evidence: { kind: string; level: number; title: string; detail: string | null; url: string | null; on: string | null }[];
  commits: number;
  tasks: { id: string; title: string; difficulty: "starter" | "core" | "stretch"; attemptId: string | null; attemptStatus: TaskStatus | null }[];
  teachers: { username: string; name: string; avatarUrl: string | null; level: number; minutes: number }[];
  openings: { ventureId: string; title: string; role: string }[];
}

interface RawDrawer {
  skill: { id: string; name: string };
  level: number;
  state: PathStepState | null;
  why: { path: string; source: "data" | "starter"; seniors: number | null; position: number | null; prev: string | null; after_days: number | null } | null;
  evidence: SkillDrawer["evidence"];
  commits: number;
  tasks: { id: string; title: string; difficulty: "starter" | "core" | "stretch"; attempt_id: string | null; attempt_status: TaskStatus | null }[];
  teachers: { username: string; name: string; avatar_path: string | null; level: number; minutes: number }[];
  openings: { venture_id: string; title: string; role: string }[];
}

export function shapeDrawer(r: RawDrawer): SkillDrawer {
  return {
    skill: r.skill, level: r.level, state: r.state,
    why: r.why ? { path: r.why.path, source: r.why.source, seniors: r.why.seniors, position: r.why.position, prev: r.why.prev, afterDays: r.why.after_days } : null,
    evidence: r.evidence, commits: r.commits,
    tasks: r.tasks.map((t) => ({ id: t.id, title: t.title, difficulty: t.difficulty, attemptId: t.attempt_id, attemptStatus: t.attempt_status })),
    teachers: r.teachers.map((t) => ({ username: t.username, name: t.name, avatarUrl: avatar(t.avatar_path), level: t.level, minutes: t.minutes })),
    openings: r.openings.map((o) => ({ ventureId: o.venture_id, title: o.title, role: o.role })),
  };
}

export type { RawDrawer };

// ---------------------------------------------------------------------------
// Skill swap
// ---------------------------------------------------------------------------

export interface Teacher {
  username: string;
  name: string;
  avatarUrl: string | null;
  level: number;
  note: string | null;
  minutes: number;
  notes: string[];
  open: boolean;
}

interface RawTeacher {
  username: string;
  name: string;
  avatar_path: string | null;
  level: number;
  note: string | null;
  minutes: number;
  notes: string[];
  open: boolean;
}

const teacher = (t: RawTeacher): Teacher => ({
  username: t.username, name: t.name, avatarUrl: avatar(t.avatar_path), level: t.level, note: t.note, minutes: t.minutes, notes: t.notes, open: t.open,
});

export interface SwapsPage {
  teachable: { skillId: string; name: string; level: number; offered: boolean; note: string | null; wantedBy: number }[];
  wants: { skillId: string; name: string; note: string | null; teachers: Teacher[] }[];
  requests: { id: string; skill: string; learner: string; username: string; avatarUrl: string | null; note: string | null; preferredTimes: string | null; offeredSkill: string | null; expiresLabel: string }[];
  swaps: { id: string; role: "teacher" | "learner"; status: SwapStatus; skill: string; other: string; username: string; avatarUrl: string | null; sessions: number; nextSessionLabel: string | null; requestedLabel: string }[];
  minutesTaught: number;
  notesPending: number;
}

export async function getSwapsPage(): Promise<SwapsPage> {
  const r = await rpcJson<{
    teachable: { skill_id: string; name: string; level: number; offered: boolean; note: string | null; wanted_by: number }[];
    wants: { skill_id: string; name: string; note: string | null; teachers: RawTeacher[] }[];
    requests: { id: string; skill: string; learner: string; username: string; avatar_path: string | null; note: string | null; preferred_times: string | null; offered_skill: string | null; expires_at: string }[];
    swaps: { id: string; role: "teacher" | "learner"; status: SwapStatus; skill: string; other: string; username: string; avatar_path: string | null; sessions: number; next_session: string | null; requested_at: string }[];
    minutes_taught: number;
    notes_pending: number;
  }>("swaps_page");
  return {
    teachable: r.teachable.map((t) => ({ skillId: t.skill_id, name: t.name, level: t.level, offered: t.offered, note: t.note, wantedBy: t.wanted_by })),
    wants: r.wants.map((w) => ({ skillId: w.skill_id, name: w.name, note: w.note, teachers: w.teachers.map(teacher) })),
    requests: r.requests.map((q) => ({
      id: q.id, skill: q.skill, learner: q.learner, username: q.username, avatarUrl: avatar(q.avatar_path), note: q.note,
      preferredTimes: q.preferred_times, offeredSkill: q.offered_skill, expiresLabel: dayLabel(q.expires_at),
    })),
    swaps: r.swaps.map((s) => ({
      id: s.id, role: s.role, status: s.status, skill: s.skill, other: s.other, username: s.username, avatarUrl: avatar(s.avatar_path),
      sessions: s.sessions, nextSessionLabel: when(s.next_session), requestedLabel: dayLabel(s.requested_at),
    })),
    minutesTaught: r.minutes_taught,
    notesPending: r.notes_pending,
  };
}

export async function getSwapTeachers(skill: string): Promise<Teacher[]> {
  return (await rpcJson<RawTeacher[]>("swap_teachers", { p_skill: skill })).map(teacher);
}

export interface SwapSession {
  id: string;
  startsAt: string;
  whenLabel: string;
  minutes: number;
  place: string;
  status: SessionStatus;
  proposedByMe: boolean;
  confirmedMinutes: number | null;
  noShowReason: string | null;
  started: boolean;
  note: { id: string; body: string; status: "pending" | "approved" | "declined" } | null;
}

export interface SwapView {
  id: string;
  role: "teacher" | "learner";
  status: SwapStatus;
  skill: { id: string; name: string };
  teacherLevel: number | null;
  other: { name: string; firstName: string; username: string | null; avatarUrl: string | null };
  note: string | null;
  preferredTimes: string | null;
  offeredSkill: string | null;
  mutual: { id: string; skill: string } | null;
  requestedLabel: string;
  expiresLabel: string;
  closedLabel: string | null;
  closeReason: "ended" | "inactive" | "blocked" | null;
  threadId: string | null;
  blocked: boolean;
  taughtCode: string | null;
  confirmed: { sessions: number; minutes: number };
  sessions: SwapSession[];
}

export async function getSwap(id: string): Promise<SwapView> {
  const r = await rpcJson<{
    id: string; role: "teacher" | "learner"; status: SwapStatus; skill: { id: string; name: string }; teacher_level: number | null;
    other: { name: string; first_name: string; username: string | null; avatar_path: string | null };
    note: string | null; preferred_times: string | null; offered_skill: string | null; mutual: { id: string; skill: string } | null;
    requested_at: string; expires_at: string; closed_at: string | null; close_reason: SwapView["closeReason"]; thread_id: string | null;
    blocked: boolean; taught_code: string | null; confirmed: { sessions: number; minutes: number };
    sessions: { id: string; starts_at: string; minutes: number; place: string; status: SessionStatus; proposed_by_me: boolean; confirmed_minutes: number | null; no_show_reason: string | null; note: SwapSession["note"] }[];
  }>("swap_page", { p_swap: id });
  const now = Date.now();
  return {
    id: r.id, role: r.role, status: r.status, skill: r.skill, teacherLevel: r.teacher_level,
    other: { name: r.other.name, firstName: r.other.first_name, username: r.other.username, avatarUrl: avatar(r.other.avatar_path) },
    note: r.note, preferredTimes: r.preferred_times, offeredSkill: r.offered_skill, mutual: r.mutual,
    requestedLabel: dayLabel(r.requested_at), expiresLabel: dayLabel(r.expires_at), closedLabel: r.closed_at ? dayLabel(r.closed_at) : null,
    closeReason: r.close_reason, threadId: r.thread_id, blocked: r.blocked, taughtCode: r.taught_code, confirmed: r.confirmed,
    sessions: r.sessions.map((x) => ({
      id: x.id, startsAt: x.starts_at, whenLabel: when(x.starts_at) ?? "", minutes: x.minutes, place: x.place, status: x.status,
      proposedByMe: x.proposed_by_me, confirmedMinutes: x.confirmed_minutes, noShowReason: x.no_show_reason,
      started: Date.parse(x.starts_at) <= now, note: x.note,
    })),
  };
}

export interface ThankYouNotes {
  minutes: number;
  notes: { body: string; author: string; skill: string; on: string }[];
}

export async function getSwapNotesFor(userId: string): Promise<ThankYouNotes> {
  return rpcJson<ThankYouNotes>("swap_notes_for", { p_user: userId });
}

// ---------------------------------------------------------------------------
// Ops: the proof-task bank
// ---------------------------------------------------------------------------

export interface BankTask {
  id: string;
  skillId: string;
  skill: string;
  title: string;
  difficulty: "starter" | "core" | "stretch";
  brief: string;
  checklist: string[];
  active: boolean;
  started: number;
  done: number;
}

export async function getProofTaskBank(): Promise<BankTask[]> {
  const r = await rpcJson<{ id: string; skill_id: string; skill: string; title: string; difficulty: BankTask["difficulty"]; brief: string; checklist: string[]; active: boolean; started: number; done: number }[]>("ops_proof_tasks");
  return r.map((t) => ({ id: t.id, skillId: t.skill_id, skill: t.skill, title: t.title, difficulty: t.difficulty, brief: t.brief, checklist: t.checklist, active: t.active, started: t.started, done: t.done }));
}

/** Every live skill (the "I want to learn" picker). */
export async function getSkillOptions(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("skills").select("id, name").is("retired_at", null).order("name");
  if (error) throw new Error(`skills: ${error.code}`);
  return data ?? [];
}
