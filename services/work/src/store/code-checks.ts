import type { NewEvent } from "@skilient/platform";
import { rateLimit } from "@skilient/platform";
import { refused, refusedWith, type RefusalReason } from "../refusals";
import { audit } from "./audit";
import { requireUser, type Db, type Tx } from "./db";
import { enqueueStage } from "./github";
import { completeTask } from "./tasks";
import { publish } from "./publish";

/**
 * Code checks (PRD 5.5), ported from _code_checks.sql and _teacher_portal.sql (due dates, routing). A check is
 * prepared by the harvest job's `code_check` stage: a run of 20 to 40 lines the student added in one of their
 * counted commits for the skill. Only where the snippet is gets recorded, never the code.
 */
export interface CodeCheckLimits {
  min_lines: number;
  max_lines: number;
  [k: string]: number;
}

/** `code_check_limit(name)` for every name: work.config `code_check.limits`. */
export async function codeCheckLimits(db: Db): Promise<CodeCheckLimits> {
  const [r] = await db<{ value: CodeCheckLimits }[]>`select value from work.config where key = 'code_check.limits'`;
  return r!.value;
}

/** `code_check_candidates(check)`: up to 10 counted commits for the skill with enough lines (or an import). */
export async function codeCheckCandidates(tx: Tx, checkId: string) {
  const limits = await codeCheckLimits(tx);
  return tx<{ repo_id: string; sha: string; installation_id: string; paths: string[] }[]>`
    select e.repo_id::text, e.sha, ur.installation_id::text, e.paths
      from work.code_checks c
      join work.skill_evidence e on e.user_id = c.user_id and e.skill_id = c.skill_id
      join work.github_commits g on g.user_id = e.user_id and g.repo_id = e.repo_id and g.sha = e.sha and g.status = 'counted'
      join work.github_user_repos ur on ur.user_id = e.user_id and ur.repo_id = e.repo_id and not ur.excluded
     where c.id = ${checkId} and c.status = 'preparing' and (e.lines >= ${limits.min_lines} or e.detectors && array['import'])
     order by random() limit 10`;
}

/** `code_check_prepared(check, repo, sha, path, start, end)`: ready; the student is told (notify, W9). */
export async function codeCheckPrepared(tx: Tx, checkId: string, repoId: number, sha: string, path: string, start: number, end: number): Promise<boolean> {
  const [c] = await tx<{ user_id: string; skill_id: string }[]>`
    update work.code_checks set status = 'ready', ready_at = now(), repo_id = ${repoId}, sha = ${sha}, path = ${path}, start_line = ${start}, end_line = ${end}
     where id = ${checkId} and status = 'preparing' returning user_id::text, skill_id`;
  if (!c) return false;
  await publish(tx, [codeCheckChanged(checkId, c.user_id, c.skill_id, "ready")]);
  return true;
}

/** `code_check_unavailable(check, reason)`: no snippet could be prepared (or the snippet was never served). */
export async function codeCheckUnavailable(tx: Tx, checkId: string, reason: string): Promise<boolean> {
  const r = await tx<{ user_id: string; skill_id: string }[]>`
    update work.code_checks set status = 'unavailable', unavailable_reason = left(${reason}, 200)
     where id = ${checkId} and (status = 'preparing' or (status in ('ready', 'in_progress') and snippet_served_at is null))
    returning user_id::text, skill_id`;
  if (r.length) {
    await publish(tx, [codeCheckChanged(checkId, r[0]!.user_id, r[0]!.skill_id, "unavailable")]);
    await checkToTasks(tx, checkId, "unavailable");
  }
  return r.length > 0;
}

/** `code_check.changed` {check_id, user_id, skill_id, status}: notify's ready, graded and expired notices (W9). */
export const codeCheckChanged = (checkId: string, userId: string, skillId: string, status: string): NewEvent => ({
  type: "code_check.changed",
  subjects: [checkId, userId],
  payload: { check_id: checkId, user_id: userId, skill_id: skillId, status },
});

// ---- Students ----

/** `has_authored_level(user, skill)`: L2 from the student's own commits (3+ days and enough use). */
const authoredL2 = (db: Db, user: string, skill: string) => db`exists (
  select 1 from work.user_skills u join work.skills s on s.id = u.skill_id
   where u.user_id = ${user} and u.skill_id = ${skill} and u.active_days >= 3
     and ((s.category = 'language' and u.lines >= 150) or (s.category <> 'language' and u.hits >= 3)))`;

/** `code_check_blocker(user, skill)`: why the student can't request a check now, or null. */
export async function codeCheckBlocker(db: Db, user: string, skill: string): Promise<RefusalReason | null> {
  const limits = await codeCheckLimits(db);
  const [r] = await db<{ blocker: RefusalReason | null }[]>`
    select case
      when not exists (select 1 from work.github_accounts a where a.user_id = ${user} and a.revoked_at is null) then 'check_connect_github'
      when not ${authoredL2(db, user, skill)} then 'check_needs_l2'
      when exists (select 1 from work.code_checks c where c.user_id = ${user} and c.skill_id = ${skill} and c.status = 'passed') then 'check_passed'
      when exists (select 1 from work.code_checks c where c.user_id = ${user} and c.skill_id = ${skill}
                    and c.status in ('preparing', 'ready', 'in_progress', 'submitted')) then 'check_open'
      when exists (select 1 from work.code_checks c where c.user_id = ${user} and c.skill_id = ${skill}
                    and c.snippet_served_at > now() - make_interval(days => ${limits["retry_days"]!})) then 'check_retry'
    end as blocker`;
  return r!.blocker;
}

/** `request_code_check(skill)`: a prompt for the skill (or its category); the harvest job prepares the snippet. */
export async function requestCodeCheck(tx: Tx, meId: string | null, skill: string): Promise<string> {
  const me = await requireUser(tx, meId);
  const [s] = await tx`select 1 from work.skills where id = ${skill} and retired_at is null`;
  if (!s) throw refused("skill_not_found");
  const block = await codeCheckBlocker(tx, me.id, skill);
  if (block) throw refused(block);
  if (!(await rateLimit(tx, `code_check:${me.id}`, 5, 86_400))) throw refused("rate_limited");
  const [p] = await tx<{ id: string }[]>`
    select p.id::text from work.code_check_prompts p join work.skills s on s.id = ${skill}
     where p.active and (p.skill_id = ${skill} or (p.skill_id is null and p.category = s.category))
     order by (p.skill_id is not null) desc, random() limit 1`;
  const [row] = await tx<{ id: string }[]>`
    insert into work.code_checks (user_id, skill_id, prompt_id) values (${me.id}, ${skill}, ${p?.id ?? null}) returning id::text`;
  await enqueueStage(tx, { stage: "code_check", check_id: row!.id });
  return row!.id;
}

/** `start_code_check(id)`: starts a ready check (idempotent while in progress: returns its deadline). */
export async function startCodeCheck(tx: Tx, meId: string | null, id: string): Promise<Date | null> {
  const me = await requireUser(tx, meId);
  const [c] = await tx<{ status: string; deadline_at: Date | null }[]>`select status, deadline_at from work.code_checks where id = ${id} and user_id = ${me.id} for update`;
  if (!c) throw refused("check_not_found");
  if (c.status === "in_progress") return c.deadline_at;
  if (c.status !== "ready") throw refused("check_not_ready");
  await tx`update work.code_checks set status = 'in_progress', started_at = now() where id = ${id}`;
  return null;
}

/** `save_code_check(id, answers, submit)`: saves (and submits) the three answers within the time. */
export async function saveCodeCheck(tx: Tx, meId: string | null, id: string, answers: unknown, submit: boolean): Promise<string> {
  const me = await requireUser(tx, meId);
  const limits = await codeCheckLimits(tx);
  const max = limits["answer_max"]!;
  const [c] = await tx<{ status: string; snippet_served_at: Date | null; late: boolean | null; skill_id: string }[]>`
    select status, snippet_served_at, skill_id, now() > deadline_at + make_interval(secs => ${limits["grace_seconds"]!}) as late
      from work.code_checks where id = ${id} and user_id = ${me.id} for update`;
  if (!c) throw refused("check_not_found");
  if (c.status !== "in_progress" || !c.snippet_served_at) throw refused("check_not_open");
  if (c.late !== false) throw refused("check_time_up");
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) throw refused("check_answers");
  const entries = Object.entries(answers as Record<string, unknown>);
  if (entries.some(([k, v]) => !["what", "why", "change"].includes(k) || typeof v !== "string")) throw refused("check_answers");
  if (entries.some(([, v]) => [...(v as string)].length > max)) throw refusedWith("check_answer_length", max);
  await tx`
    update work.code_checks set answers = ${JSON.stringify(Object.fromEntries(entries))}::text::jsonb,
           status = case when ${submit} then 'submitted' else status end,
           submitted_at = case when ${submit} then now() else submitted_at end,
           -- code_checks_route: due in due_hours; with the faculty portal deferred every check routes to staff.
           due_at = case when ${submit} then now() + make_interval(hours => ${limits["due_hours"]!}) else due_at end,
           routed_to_staff_at = case when ${submit} then coalesce(routed_to_staff_at, now()) else routed_to_staff_at end
     where id = ${id}`;
  if (submit) await publish(tx, [codeCheckChanged(id, me.id, c.skill_id, "submitted")]);
  return submit ? "submitted" : c.status;
}

/** `code_check_state(skill)`: the reader's latest check for the skill and what blocks a new one. */
export async function codeCheckState(db: Db, me: string, skill: string) {
  const [c] = await db<{ id: string; status: string }[]>`
    select id::text, status from work.code_checks where user_id = ${me} and skill_id = ${skill} order by requested_at desc limit 1`;
  return { checkId: c?.id ?? null, status: c?.status ?? null, blocker: await codeCheckBlocker(db, me, skill) };
}

/** `my_code_check(id)`: the student's own check; the prompt only once the snippet was served. */
export async function myCodeCheck(db: Db, me: string, id: string) {
  const [c] = await db<{
    id: string; skill_id: string; skill_name: string; category: string; status: string; prompt: string | null; path: string | null;
    start_line: number | null; end_line: number | null; answers: Record<string, string>; rubric: unknown; feedback: string | null;
    requested_at: Date; started_at: Date | null; deadline_at: Date | null; snippet_served: boolean; submitted_at: Date | null; graded_at: Date | null; unavailable_reason: string | null;
  }[]>`
    select c.id::text, c.skill_id, s.name as skill_name, s.category, c.status,
           case when c.snippet_served_at is not null then p.prompt end as prompt,
           case when c.status <> 'preparing' then c.path end as path, c.start_line, c.end_line, c.answers,
           case when c.status in ('passed', 'failed') then c.rubric end as rubric,
           case when c.status in ('passed', 'failed') then c.feedback end as feedback,
           c.requested_at, c.started_at, c.deadline_at, c.snippet_served_at is not null as snippet_served, c.submitted_at, c.graded_at, c.unavailable_reason
      from work.code_checks c join work.skills s on s.id = c.skill_id left join work.code_check_prompts p on p.id = c.prompt_id
     where c.id = ${id} and c.user_id = ${me}`;
  return c ?? null;
}

/**
 * `code_check_snippet_access(check, user, aal)`: the student during their check (within the grace), or the
 * staff grader who claimed it (two-factor and the trust reviewer role, checked by the caller and passed in).
 */
export async function snippetAccess(db: Db, check: string, user: string, isTrust: boolean) {
  const limits = await codeCheckLimits(db);
  const [a] = await db<{ role: "student" | "grader"; installation_id: string | null; repo_id: string; sha: string; path: string; start_line: number; end_line: number }[]>`
    select case when c.user_id = ${user} then 'student' else 'grader' end as role, ur.installation_id::text, c.repo_id::text, c.sha, c.path, c.start_line, c.end_line
      from work.code_checks c left join work.github_user_repos ur on ur.user_id = c.user_id and ur.repo_id = c.repo_id
     where c.id = ${check} and c.path is not null
       and ((c.user_id = ${user} and c.status = 'in_progress'
             and (c.deadline_at is null or now() <= c.deadline_at + make_interval(secs => ${limits["grace_seconds"]!})))
            or (c.status = 'submitted' and c.claimed_by = ${user} and c.user_id <> ${user} and ${isTrust}))`;
  return a ?? null;
}

/** `code_check_served(check)`: the clock starts when the student first sees the code. */
export async function codeCheckServed(tx: Tx, check: string): Promise<void> {
  const limits = await codeCheckLimits(tx);
  await tx`
    update work.code_checks set snippet_served_at = now(), deadline_at = now() + make_interval(mins => ${limits["minutes"]!})
     where id = ${check} and status = 'in_progress' and snippet_served_at is null`;
}

// ---- Staff ----

/** `code_check_conflict(grader, student)`: themselves, a friend or a teammate. */
const conflict = (db: Db, grader: string, studentColumn: string) => db`(
  ${db(studentColumn)} = ${grader}::uuid
  or exists (select 1 from work.friendships f where f.user_id_a = least(${grader}::uuid, ${db(studentColumn)}) and f.user_id_b = greatest(${grader}::uuid, ${db(studentColumn)}))
  or exists (select 1 from work.venture_members a join work.venture_members b on b.venture_id = a.venture_id where a.user_id = ${grader} and b.user_id = ${db(studentColumn)}))`;

export async function codeCheckQueue(db: Db, staff: string, status: "submitted" | "graded") {
  const limits = await codeCheckLimits(db);
  return db<{ id: string; user_id: string; skill_name: string; status: string; claimed_by: string | null; claimed_by_me: boolean; conflict: boolean; submitted_at: Date | null; overdue: boolean; graded_at: Date | null }[]>`
    select c.id::text, c.user_id::text, s.name as skill_name, c.status, c.claimed_by::text, c.claimed_by = ${staff}::uuid as claimed_by_me,
           ${conflict(db, staff, "c.user_id")} as conflict, c.submitted_at,
           c.status = 'submitted' and c.submitted_at < now() - make_interval(hours => ${limits["due_hours"]!}) as overdue, c.graded_at
      from work.code_checks c join work.skills s on s.id = c.skill_id
     where (${status} = 'submitted' and c.status = 'submitted' and c.routed_to_staff_at is not null)
        or (${status} = 'graded' and c.status in ('passed', 'failed') and c.grader_id is not null and c.graded_at > now() - interval '30 days')
     order by case when ${status} = 'submitted' then c.submitted_at end asc, c.graded_at desc
     limit 200`;
}

export async function codeCheckCase(db: Db, staff: string, id: string) {
  const limits = await codeCheckLimits(db);
  const [c] = await db<{
    id: string; user_id: string; skill_name: string; category: string; status: string; prompt: string | null; path: string | null; start_line: number | null; end_line: number | null;
    answers: Record<string, string>; rubric: unknown; feedback: string | null; claimed_by: string | null; claimed_by_me: boolean; conflict: boolean; submitted_at: Date | null; overdue: boolean;
  }[]>`
    select c.id::text, c.user_id::text, s.name as skill_name, s.category, c.status, pr.prompt, c.path, c.start_line, c.end_line, c.answers, c.rubric, c.feedback,
           c.claimed_by::text, c.claimed_by = ${staff}::uuid as claimed_by_me, ${conflict(db, staff, "c.user_id")} as conflict, c.submitted_at,
           c.status = 'submitted' and c.submitted_at < now() - make_interval(hours => ${limits["due_hours"]!}) as overdue
      from work.code_checks c join work.skills s on s.id = c.skill_id left join work.code_check_prompts pr on pr.id = c.prompt_id
     where c.id = ${id} and c.status in ('submitted', 'passed', 'failed')`;
  return c ?? null;
}

export async function claimCodeCheck(tx: Tx, staff: string, id: string, claim: boolean): Promise<void> {
  const [c] = await tx<{ status: string; claimed_by: string | null; conflict: boolean }[]>`
    select c.status, c.claimed_by::text, ${conflict(tx, staff, "c.user_id")} as conflict from work.code_checks c where c.id = ${id} for update`;
  if (!c || c.status !== "submitted") throw refused("check_not_waiting");
  if (c.conflict) throw refused("check_conflict");
  if (claim) {
    if (c.claimed_by !== null && c.claimed_by !== staff) throw refused("check_claimed_other");
    await tx`update work.code_checks set claimed_by = ${staff}, claimed_at = now() where id = ${id}`;
  } else {
    if (c.claimed_by !== staff) throw refused("check_not_claimed");
    await tx`update work.code_checks set claimed_by = null, claimed_at = null where id = ${id}`;
  }
  await audit(tx, {
    staffId: staff,
    action: claim ? "code_check.claim" : "code_check.release",
    targetType: "code_check",
    targetId: id,
    reason: claim ? "claimed to grade" : "released",
    before: { claimed_by: c.claimed_by },
    after: { claimed_by: claim ? staff : null },
  });
}

export type Rubric = Record<string, { pass: boolean; comment?: string }>;

/** `grade_code_check(id, rubric, feedback)`: pass with enough rubric parts; audited; L4 and any task follow. */
export async function gradeCodeCheck(tx: Tx, staff: string, id: string, rubric: unknown, feedback: string, recompute: (tx: Tx, users: readonly string[]) => Promise<void>): Promise<boolean> {
  if (feedback.trim().length < 3) throw refused("check_feedback");
  const [c] = await tx<{ status: string; claimed_by: string | null; user_id: string; skill_id: string }[]>`
    select status, claimed_by::text, user_id::text, skill_id from work.code_checks where id = ${id} for update`;
  if (!c || c.status !== "submitted") throw refused("check_not_waiting");
  if (c.claimed_by !== staff) throw refused("check_claim_first");
  const parts = ["behaviour", "design", "change", "accuracy"];
  const r = rubric as Record<string, { pass?: unknown; comment?: unknown }> | null;
  if (!r || typeof r !== "object" || Array.isArray(r) || Object.keys(r).length !== 4 || !parts.every((p) => typeof r[p]?.pass === "boolean")) throw refused("check_rubric");
  const clean: Rubric = Object.fromEntries(parts.map((p) => [p, { pass: r[p]!.pass as boolean, comment: String(r[p]!.comment ?? "").slice(0, 500) }]));
  const passed = parts.filter((p) => clean[p]!.pass).length;
  const limits = await codeCheckLimits(tx);
  const pass = passed >= limits["pass_parts"]!;
  const status = pass ? "passed" : "failed";
  await tx`
    update work.code_checks set status = ${status}, rubric = ${JSON.stringify(clean)}::text::jsonb, feedback = left(btrim(${feedback}), 2000),
           grader_id = ${staff}, graded_at = now(), claimed_by = null, claimed_at = null
     where id = ${id}`;
  await audit(tx, {
    staffId: staff,
    action: pass ? "code_check.pass" : "code_check.fail",
    targetType: "code_check",
    targetId: id,
    reason: feedback.trim().slice(0, 2000),
    before: { status: c.status },
    after: { status, parts_passed: passed },
  });
  await publish(tx, [codeCheckChanged(id, c.user_id, c.skill_id, status)]);
  if (pass) await recompute(tx, [c.user_id]);
  await checkToTasks(tx, id, status);
  return pass;
}

/** `code_check_task`: a passed check completes its proof task; a failed, expired or unavailable one sends it back. */
export async function checkToTasks(tx: Tx, checkId: string, status: string): Promise<void> {
  if (status === "passed") {
    const ids = await tx<{ id: string }[]>`select id::text from work.task_attempts where code_check_id = ${checkId} and status = 'code_check' order by id`;
    for (const a of ids) await completeTask(tx, a.id, "code_check");
  } else if (["failed", "expired", "unavailable"].includes(status)) {
    const note =
      status === "failed"
        ? "The code check didn't pass. Improve the work and submit again."
        : status === "expired"
          ? "The code check wasn't started in time. Submit again."
          : "We couldn't find code for a check. Submit again for GitHub and a peer.";
    await tx`update work.task_attempts set status = 'needs_changes', note = ${note}, updated_at = now() where code_check_id = ${checkId} and status = 'code_check'`;
  }
}

/** `code_checks_tick()` (every 5 minutes): time-outs, stale ready, preparing and unserved checks. */
export async function codeChecksTick(tx: Tx): Promise<number> {
  const limits = await codeCheckLimits(tx);
  const timedOut = await tx<{ id: string; user_id: string; status: string; skill_id: string }[]>`
    update work.code_checks
       set status = case when exists (select 1 from jsonb_each_text(answers) e where btrim(e.value) <> '') then 'submitted' else 'failed' end,
           submitted_at = now(),
           graded_at = case when exists (select 1 from jsonb_each_text(answers) e where btrim(e.value) <> '') then null else now() end,
           feedback = case when exists (select 1 from jsonb_each_text(answers) e where btrim(e.value) <> '') then null else 'No answers were given in time.' end,
           due_at = case when exists (select 1 from jsonb_each_text(answers) e where btrim(e.value) <> '') then now() + make_interval(hours => ${limits["due_hours"]!}) else due_at end,
           routed_to_staff_at = case when exists (select 1 from jsonb_each_text(answers) e where btrim(e.value) <> '') then coalesce(routed_to_staff_at, now()) else routed_to_staff_at end
     where status = 'in_progress' and deadline_at is not null and now() > deadline_at + make_interval(secs => ${limits["grace_seconds"]!})
    returning id::text, user_id::text, status, skill_id`;
  const expired = await tx<{ id: string; user_id: string; skill_id: string }[]>`
    update work.code_checks set status = 'expired' where status = 'ready' and ready_at < now() - make_interval(days => ${limits["ready_days"]!})
    returning id::text, user_id::text, skill_id`;
  const unprepared = await tx<{ id: string; user_id: string; skill_id: string }[]>`
    update work.code_checks set status = 'unavailable', unavailable_reason = 'we couldn''t prepare it in time'
     where status = 'preparing' and requested_at < now() - interval '1 day' returning id::text, user_id::text, skill_id`;
  const unserved = await tx<{ id: string; user_id: string; skill_id: string }[]>`
    update work.code_checks set status = 'unavailable', unavailable_reason = 'your code couldn''t be shown'
     where status = 'in_progress' and snippet_served_at is null and started_at < now() - interval '1 day' returning id::text, user_id::text, skill_id`;
  await publish(tx, [
    ...timedOut.map((c) => codeCheckChanged(c.id, c.user_id, c.skill_id, c.status)),
    ...expired.map((c) => codeCheckChanged(c.id, c.user_id, c.skill_id, "expired")),
    ...[...unprepared, ...unserved].map((c) => codeCheckChanged(c.id, c.user_id, c.skill_id, "unavailable")),
  ]);
  for (const c of timedOut.filter((x) => x.status === "failed")) await checkToTasks(tx, c.id, "failed");
  for (const c of expired) await checkToTasks(tx, c.id, "expired");
  for (const c of [...unprepared, ...unserved]) await checkToTasks(tx, c.id, "unavailable");
  return timedOut.length;
}
