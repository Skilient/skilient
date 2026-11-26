import type { NewEvent } from "@skilient/platform";
import { rateLimit } from "@skilient/platform";
import { refused, refusedWith, type RefusalReason } from "../refusals";
import { codeCheckBlocker, requestCodeCheck } from "./code-checks";
import { requireUser, type Db, type Tx } from "./db";
import { enqueueStage } from "./github";
import { publish } from "./publish";

/**
 * Proof tasks, ported from _paths_tasks.sql. A task is done when GitHub shows the skill in the linked repository
 * after it started, a peer review passes, or a code check passes. Done publishes `task.completed`: credentials
 * issues the Record entry (W8), notify tells the student (W9), trust counts it (W10).
 */
export async function completeTask(tx: Tx, attemptId: string, by: "github" | "peer" | "code_check"): Promise<boolean> {
  const [a] = await tx<{ id: string; user_id: string; task_id: string; skill_id: string }[]>`
    update work.task_attempts set status = 'done', done_at = now(), verified_by = ${by}, route = coalesce(route, ${by}), note = null, updated_at = now()
     where id = ${attemptId} and status not in ('done', 'abandoned')
    returning id::text, user_id::text, task_id::text, skill_id`;
  if (!a) return false;
  await tx`update work.task_reviews set status = 'withdrawn', responded_at = coalesce(responded_at, now()) where attempt_id = ${a.id} and status in ('offered', 'accepted')`;
  const [t] = await tx<{ title: string; skill: string }[]>`
    select t.title, s.name as skill from work.proof_tasks t join work.skills s on s.id = ${a.skill_id} where t.id = ${a.task_id}`;
  await publish(tx, [taskCompleted(a.user_id, a.id, a.skill_id, t!.skill, t!.title, by)]);
  return true;
}

const taskCompleted = (userId: string, attemptId: string, skillId: string, skillLabel: string, title: string, by: string): NewEvent => ({
  type: "task.completed",
  subjects: [userId, attemptId],
  // Staff-curated catalogue text only (the task's title, the skill's name), as the Record entry needs them.
  payload: { user_id: userId, attempt_id: attemptId, skill_id: skillId, skill_label: skillLabel, task_title: title, verified_by: by },
});

/** `task_github_check(user)`: attempts whose skill GitHub now shows in the linked repository, since they started. */
export async function taskGithubCheck(tx: Tx, userId: string): Promise<number> {
  const ready = await tx<{ id: string }[]>`
    select a.id::text from work.task_attempts a
     where a.user_id = ${userId} and a.status in ('verifying', 'awaiting_peer', 'in_review') and a.repo_id is not null
       and exists (select 1 from work.skill_evidence e
                     join work.github_commits c on c.user_id = e.user_id and c.repo_id = e.repo_id and c.sha = e.sha
                    where e.user_id = a.user_id and e.repo_id = a.repo_id and e.skill_id = a.skill_id
                      and c.status = 'counted' and e.occurred_at >= a.started_at)
     order by a.id`;
  let n = 0;
  for (const r of ready) if (await completeTask(tx, r.id, "github")) n++;
  return n;
}

// ---- Students ----

async function taskLimit(db: Db, field: "active" | "peers" | "reviews_week" | "reoffer_days" | "github_wait_minutes"): Promise<number> {
  const fallback = { active: 3, peers: 3, reviews_week: 5, reoffer_days: 7, github_wait_minutes: 30 }[field];
  const [r] = await db<{ n: number | null }[]>`select (value ->> ${field})::int as n from work.config where key = 'tasks.limits'`;
  return r?.n ?? fallback;
}

/** `start_task(task)`: one open attempt per task (returned again), up to `active` open at once. */
export async function startTask(tx: Tx, meId: string | null, taskId: string): Promise<string> {
  const me = await requireUser(tx, meId);
  const [t] = await tx<{ skill_id: string; difficulty: string }[]>`select skill_id, difficulty from work.proof_tasks where id = ${taskId} and active`;
  if (!t) throw refused("task_not_found");
  const [m] = await tx`select 1 from work.members where user_id = ${me.id} and role = 'student'`;
  if (!m) throw refused("tasks_students");
  await tx`select pg_advisory_xact_lock(hashtextextended(${"task_attempts:" + me.id}, 0))`;
  const [open] = await tx<{ id: string }[]>`select id::text from work.task_attempts where user_id = ${me.id} and task_id = ${taskId} and status not in ('done', 'abandoned')`;
  if (open) return open.id;
  const [done] = await tx`select 1 from work.task_attempts where user_id = ${me.id} and task_id = ${taskId} and status = 'done'`;
  if (done) throw refused("task_done");
  const active = await taskLimit(tx, "active");
  const [n] = await tx<{ n: number }[]>`select count(*)::int as n from work.task_attempts where user_id = ${me.id} and status not in ('done', 'abandoned')`;
  if (n!.n >= active) throw refusedWith("tasks_max", active);
  const [row] = await tx<{ id: string }[]>`insert into work.task_attempts (user_id, task_id, skill_id) values (${me.id}, ${taskId}, ${t.skill_id}) returning id::text`;
  return row!.id;
}

async function ownAttempt(tx: Tx, me: string, attemptId: string) {
  const [a] = await tx<{ id: string; status: string; repo_id: string | null; skill_id: string; code_check_id: string | null }[]>`
    select id::text, status, repo_id::text, skill_id, code_check_id::text from work.task_attempts where id = ${attemptId} and user_id = ${me} for update`;
  if (!a) throw refused("task_not_found");
  return a;
}

/** `link_task_repo(attempt, repo)`: one of the student's classified, shared repositories, before submitting. */
export async function linkTaskRepo(tx: Tx, meId: string | null, attemptId: string, repoId: number): Promise<void> {
  const me = await requireUser(tx, meId);
  const a = await ownAttempt(tx, me.id, attemptId);
  if (!["started", "needs_changes"].includes(a.status)) throw refused("task_repo_locked");
  const [g] = await tx`select 1 from work.github_accounts where user_id = ${me.id} and revoked_at is null`;
  if (!g) throw refused("check_connect_github");
  const [r] = await tx<{ full_name: string }[]>`
    select g.full_name from work.github_user_repos ur join work.github_repos g on g.repo_id = ur.repo_id
     where ur.user_id = ${me.id} and ur.repo_id = ${repoId} and not ur.excluded and ur.kind is not null`;
  if (!r) throw refused("task_pick_repo");
  await tx`update work.task_attempts set repo_id = ${repoId}, repo_full_name = ${r.full_name}, updated_at = now() where id = ${attemptId}`;
}

/** `submit_task(attempt)`: GitHub verifies first (a fresh harvest of the repository); peers after the wait. */
export async function submitTask(tx: Tx, meId: string | null, attemptId: string): Promise<string> {
  const me = await requireUser(tx, meId);
  const a = await ownAttempt(tx, me.id, attemptId);
  if (!["started", "needs_changes"].includes(a.status)) throw refused("task_submitted");
  if (!a.repo_id) throw refused("task_link_repo");
  if (!(await rateLimit(tx, `task_submit:${me.id}`, 10, 86_400))) throw refused("rate_limited");
  await tx`update work.task_attempts set status = 'verifying', route = 'github', submitted_at = now(), code_check_id = null, updated_at = now() where id = ${attemptId}`;
  await enqueueStage(tx, { stage: "harvest", user_id: me.id, repo_id: Number(a.repo_id) });
  await taskGithubCheck(tx, me.id);
  const [s] = await tx<{ status: string }[]>`select status from work.task_attempts where id = ${attemptId}`;
  return s!.status;
}

/** `abandon_task(attempt)`. */
export async function abandonTask(tx: Tx, meId: string | null, attemptId: string): Promise<void> {
  const me = await requireUser(tx, meId);
  const r = await tx`update work.task_attempts set status = 'abandoned', updated_at = now() where id = ${attemptId} and user_id = ${me.id} and status not in ('done', 'abandoned') returning 1`;
  if (!r.length) throw refused("task_not_open");
  await withdrawReviews(tx, attemptId);
}

const withdrawReviews = (tx: Tx, attemptId: string) =>
  tx`update work.task_reviews set status = 'withdrawn', responded_at = coalesce(responded_at, now()) where attempt_id = ${attemptId} and status in ('offered', 'accepted')`;

/** `task_code_check_blocker(user, skill)`. */
async function taskCheckBlocker(db: Db, user: string, skill: string): Promise<RefusalReason | null> {
  const [p] = await db`
    select 1 from work.code_check_prompts p join work.skills s on s.id = ${skill}
     where p.active and (p.skill_id = ${skill} or (p.skill_id is null and p.category = s.category)) limit 1`;
  if (!p) return "task_no_checks";
  return codeCheckBlocker(db, user, skill);
}

/** `choose_task_code_check(attempt)`: the code-check route instead of GitHub and peers. */
export async function chooseTaskCodeCheck(tx: Tx, meId: string | null, attemptId: string): Promise<string> {
  const me = await requireUser(tx, meId);
  const a = await ownAttempt(tx, me.id, attemptId);
  if (!["started", "needs_changes", "verifying", "awaiting_peer"].includes(a.status)) throw refused("task_check_now");
  const block = await taskCheckBlocker(tx, me.id, a.skill_id);
  if (block) throw refused(block);
  const check = await requestCodeCheck(tx, me.id, a.skill_id);
  await tx`
    update work.task_attempts set status = 'code_check', route = 'code_check', code_check_id = ${check}, submitted_at = coalesce(submitted_at, now()), updated_at = now()
     where id = ${attemptId}`;
  await withdrawReviews(tx, attemptId);
  return check;
}

/** `my_task(attempt)`: the student's attempt page (the Record code is credentials', W8). */
export async function myTask(tx: Tx, meId: string | null, attemptId: string) {
  const me = await requireUser(tx, meId);
  const [a] = await tx<{
    id: string; status: string; route: string | null; verified_by: string | null; note: string | null; started_at: Date; submitted_at: Date | null; done_at: Date | null;
    repo_id: string | null; repo_full_name: string | null; task_id: string; title: string; brief: string; checklist: string[]; difficulty: string;
    skill_id: string; skill_name: string; code_check_id: string | null; code_check_status: string | null; round: number;
    offered: number; accepted: boolean; github_connected: boolean;
  }[]>`
    select a.id::text, a.status, a.route, a.verified_by, a.note, a.started_at, a.submitted_at, a.done_at, a.repo_id::text, a.repo_full_name,
           t.id::text as task_id, t.title, t.brief, t.checklist, t.difficulty, a.skill_id, k.name as skill_name, a.code_check_id::text,
           (select c.status from work.code_checks c where c.id = a.code_check_id) as code_check_status, a.round,
           (select count(*)::int from work.task_reviews r where r.attempt_id = a.id and r.round = a.round and r.status = 'offered') as offered,
           exists (select 1 from work.task_reviews r where r.attempt_id = a.id and r.status = 'accepted') as accepted,
           exists (select 1 from work.github_accounts g where g.user_id = ${me.id} and g.revoked_at is null) as github_connected
      from work.task_attempts a join work.proof_tasks t on t.id = a.task_id join work.skills k on k.id = a.skill_id
     where a.id = ${attemptId} and a.user_id = ${me.id}`;
  if (!a) throw refused("task_not_found");
  const repos = ["started", "needs_changes"].includes(a.status)
    ? await tx<{ repo_id: string; full_name: string }[]>`
        select g.repo_id::text, g.full_name from work.github_user_repos ur join work.github_repos g on g.repo_id = ur.repo_id
         where ur.user_id = ${me.id} and not ur.excluded and ur.kind is not null order by g.pushed_at desc nulls last, g.full_name`
    : [];
  return { ...a, repos, codeCheckBlocker: await taskCheckBlocker(tx, me.id, a.skill_id) };
}

// ---- Peer reviews ----

/**
 * `task_peer_ok(reviewer, student, skill)`: a different, onboarded student at L2+ in the skill, not a friend or
 * blocked, under the weekly review limit. The ring flags (ranking's, W6) and sanctions (trust's, W10) the check
 * read today join when those services publish them (docs/decisions.md 2026-11-26).
 */
const peerOk = (db: Db, reviewer: string, studentColumn: string, skillColumn: string, weekly: number) => db`(
  ${db(studentColumn)} <> ${reviewer}::uuid
  and exists (select 1 from work.user_skills u where u.user_id = ${reviewer} and u.skill_id = ${db(skillColumn)} and u.level >= 2)
  and exists (select 1 from work.members p where p.user_id = ${reviewer} and p.role = 'student' and coalesce(p.status, '') <> 'deleting' and p.onboarding_complete)
  and not exists (select 1 from work.friendships f where f.user_id_a = least(${reviewer}::uuid, ${db(studentColumn)}) and f.user_id_b = greatest(${reviewer}::uuid, ${db(studentColumn)}))
  and not exists (select 1 from work.blocks b where (b.blocker_id = ${reviewer} and b.blocked_id = ${db(studentColumn)}) or (b.blocker_id = ${db(studentColumn)} and b.blocked_id = ${reviewer}))
  and (select count(*) from work.task_reviews r where r.reviewer_id = ${reviewer} and r.status in ('accepted', 'confirmed', 'needs_changes')
        and r.responded_at > now() - interval '7 days') < ${weekly})`;

/** `offer_task_peers(attempt)`: a new round offered to up to `peers` qualified students, at random. */
export async function offerTaskPeers(tx: Tx, attemptId: string): Promise<number> {
  const [a] = await tx<{ id: string; status: string; round: number; user_id: string; skill_id: string }[]>`
    select id::text, status, round, user_id::text, skill_id from work.task_attempts where id = ${attemptId} for update`;
  if (!a || !["verifying", "awaiting_peer", "in_review"].includes(a.status)) return 0;
  const round = a.round + 1;
  await tx`update work.task_reviews set status = 'expired', responded_at = coalesce(responded_at, now()) where attempt_id = ${a.id} and status in ('offered', 'accepted')`;
  await tx`update work.task_attempts set status = 'awaiting_peer', round = ${round}, offered_at = now(), route = 'peer', updated_at = now() where id = ${a.id}`;
  const weekly = await taskLimit(tx, "reviews_week");
  const candidates = await tx<{ user_id: string }[]>`
    select u.user_id::text from work.user_skills u
      cross join (select ${a.user_id}::uuid as student, ${a.skill_id}::text as skill) x
     where u.skill_id = ${a.skill_id} and u.level >= 2
       and not exists (select 1 from work.task_reviews r where r.attempt_id = ${a.id} and r.reviewer_id = u.user_id)`;
  const ok: string[] = [];
  for (const c of candidates) {
    const [r] = await tx<{ ok: boolean }[]>`select ${peerOk(tx, c.user_id, "x.student", "x.skill", weekly)} as ok from (select ${a.user_id}::uuid as student, ${a.skill_id}::text as skill) x`;
    if (r!.ok) ok.push(c.user_id);
  }
  const chosen = ok.sort(() => Math.random() - 0.5).slice(0, await taskLimit(tx, "peers"));
  const offers = chosen.length
    ? await tx<{ id: string; reviewer_id: string }[]>`
        insert into work.task_reviews (attempt_id, reviewer_id, round) select ${a.id}, r, ${round} from unnest(${chosen}::uuid[]) r returning id::text, reviewer_id::text`
    : [];
  await publish(tx, offers.map((o) => taskReviewChanged(o.id, a.id, o.reviewer_id, a.user_id, "offered")));
  return offers.length;
}

/** `task_review.changed` {review_id, attempt_id, reviewer_id, student_id, status}: notify's review notices (W9). */
const taskReviewChanged = (id: string, attemptId: string, reviewer: string, student: string, status: string): NewEvent => ({
  type: "task_review.changed",
  subjects: [id, reviewer, student],
  payload: { review_id: id, attempt_id: attemptId, reviewer_id: reviewer, student_id: student, status },
});

async function ownReview(tx: Tx, me: string, reviewId: string) {
  const [r0] = await tx<{ attempt_id: string }[]>`select attempt_id::text from work.task_reviews where id = ${reviewId} and reviewer_id = ${me}`;
  if (!r0) throw refused("review_not_found");
  const [a] = await tx<{ id: string; status: string; user_id: string; skill_id: string; task_id: string }[]>`
    select id::text, status, user_id::text, skill_id, task_id::text from work.task_attempts where id = ${r0.attempt_id} for update`;
  const [r] = await tx<{ status: string }[]>`select status from work.task_reviews where id = ${reviewId} for update`;
  return { a: a!, r: r! };
}

/** `task_review_page(review)`: the reviewer's page (the student's first name and university from people). */
export async function taskReviewPage(tx: Tx, meId: string | null, reviewId: string) {
  const me = await requireUser(tx, meId);
  const [r] = await tx<{
    id: string; status: string; note: string | null; checklist_ticks: boolean[] | null; offered_at: Date; student_id: string; skill: string;
    title: string; brief: string; checklist: string[]; difficulty: string; repo: string | null; submitted_at: Date | null;
  }[]>`
    select r.id::text, r.status, r.note, r.checklist as checklist_ticks, r.offered_at, a.user_id::text as student_id, k.name as skill,
           t.title, t.brief, t.checklist, t.difficulty, case when r.status in ('offered', 'accepted') then a.repo_full_name end as repo, a.submitted_at
      from work.task_reviews r join work.task_attempts a on a.id = r.attempt_id join work.proof_tasks t on t.id = a.task_id join work.skills k on k.id = a.skill_id
     where r.id = ${reviewId} and r.reviewer_id = ${me.id}`;
  if (!r) throw refused("review_not_found");
  const weekly = await taskLimit(tx, "reviews_week");
  const [n] = await tx<{ n: number }[]>`
    select count(*)::int as n from work.task_reviews x where x.reviewer_id = ${me.id} and x.status in ('accepted', 'confirmed', 'needs_changes')
       and x.responded_at > now() - interval '7 days'`;
  return { ...r, reviewsLeft: Math.max(0, weekly - n!.n) };
}

/** `accept_task_review(review)`: the first to accept reviews it; the other offers are withdrawn. */
export async function acceptTaskReview(tx: Tx, meId: string | null, reviewId: string): Promise<void> {
  const me = await requireUser(tx, meId);
  const { a, r } = await ownReview(tx, me.id, reviewId);
  if (r.status !== "offered") throw refused("review_closed");
  if (a.status !== "awaiting_peer") throw refused("review_taken");
  const weekly = await taskLimit(tx, "reviews_week");
  const [ok] = await tx<{ ok: boolean }[]>`select ${peerOk(tx, me.id, "x.student", "x.skill", weekly)} as ok from (select ${a.user_id}::uuid as student, ${a.skill_id}::text as skill) x`;
  if (!ok!.ok) throw refused("review_not_allowed");
  await tx`update work.task_reviews set status = 'accepted', responded_at = now() where id = ${reviewId}`;
  await tx`update work.task_reviews set status = 'withdrawn', responded_at = now() where attempt_id = ${a.id} and id <> ${reviewId} and status = 'offered'`;
  await tx`update work.task_attempts set status = 'in_review', offered_at = now(), updated_at = now() where id = ${a.id}`;
}

/** `decline_task_review(review)`: when no offer is left, a new round goes out. */
export async function declineTaskReview(tx: Tx, meId: string | null, reviewId: string): Promise<void> {
  const me = await requireUser(tx, meId);
  const { a } = await ownReview(tx, me.id, reviewId);
  const r = await tx`update work.task_reviews set status = 'declined', responded_at = now() where id = ${reviewId} and status = 'offered' returning 1`;
  if (!r.length) throw refused("review_closed");
  const [left] = await tx`select 1 from work.task_reviews x where x.attempt_id = ${a.id} and x.status in ('offered', 'accepted')`;
  if (a.status === "awaiting_peer" && !left) await offerTaskPeers(tx, a.id);
}

/** `review_task(review, confirm, note, ticks)`: confirming completes the task; otherwise it goes back with the note. */
export async function reviewTask(tx: Tx, meId: string | null, reviewId: string, confirm: boolean, note: string | null, ticks: unknown): Promise<void> {
  const me = await requireUser(tx, meId);
  const { a, r } = await ownReview(tx, me.id, reviewId);
  const text = note?.trim() || null;
  if (r.status !== "accepted" || a.status !== "in_review") throw refused("review_accept_first");
  const [rel] = await tx<{ x: boolean }[]>`
    select exists (select 1 from work.friendships f where f.user_id_a = least(${me.id}::uuid, ${a.user_id}::uuid) and f.user_id_b = greatest(${me.id}::uuid, ${a.user_id}::uuid))
        or exists (select 1 from work.blocks b where (b.blocker_id = ${me.id} and b.blocked_id = ${a.user_id}) or (b.blocker_id = ${a.user_id} and b.blocked_id = ${me.id})) as x`;
  if (rel!.x) throw refused("review_friend");
  const [t] = await tx<{ checklist: unknown[] }[]>`select checklist from work.proof_tasks where id = ${a.task_id}`;
  if (!Array.isArray(ticks) || ticks.length !== t!.checklist.length || ticks.some((x) => typeof x !== "boolean")) throw refused("review_ticks");
  if (confirm) {
    if (ticks.some((x) => x === false)) throw refused("review_all_met");
    if (text !== null && (text.length < 3 || text.length > 1000)) throw refused("review_note_length");
    await tx`update work.task_reviews set status = 'confirmed', decided_at = now(), checklist = ${JSON.stringify(ticks)}::text::jsonb, note = ${text} where id = ${reviewId}`;
    await completeTask(tx, a.id, "peer");
  } else {
    if (text === null || text.length < 3 || text.length > 1000) throw refused("review_say_what");
    await tx`update work.task_reviews set status = 'needs_changes', decided_at = now(), checklist = ${JSON.stringify(ticks)}::text::jsonb, note = ${text} where id = ${reviewId}`;
    await tx`update work.task_attempts set status = 'needs_changes', note = ${text}, updated_at = now() where id = ${a.id}`;
    await publish(tx, [taskReviewChanged(reviewId, a.id, me.id, a.user_id, "needs_changes")]);
  }
}

/** `proof_tasks_tick()` (every 5 minutes): GitHub's wait over, peers next; stale offers go out again. */
export async function proofTasksTick(tx: Tx): Promise<number> {
  const wait = await taskLimit(tx, "github_wait_minutes");
  const reoffer = await taskLimit(tx, "reoffer_days");
  let n = 0;
  const verifying = await tx<{ id: string; user_id: string }[]>`
    select id::text, user_id::text from work.task_attempts where status = 'verifying' and submitted_at < now() - make_interval(mins => ${wait}) order by id`;
  for (const a of verifying) {
    await taskGithubCheck(tx, a.user_id);
    const [still] = await tx`select 1 from work.task_attempts where id = ${a.id} and status = 'verifying'`;
    if (still) {
      await offerTaskPeers(tx, a.id);
      n++;
    }
  }
  const stale = await tx<{ id: string }[]>`
    select id::text from work.task_attempts where status in ('awaiting_peer', 'in_review') and offered_at < now() - make_interval(days => ${reoffer}) order by id`;
  for (const a of stale) {
    await offerTaskPeers(tx, a.id);
    n++;
  }
  return n;
}
