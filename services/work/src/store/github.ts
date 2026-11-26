import { enqueue, rateLimit } from "@skilient/platform";
import { openToken, sealToken } from "../domain/token-crypto";
import { refused } from "../refusals";
import type { Db, Tx } from "./db";
import { count, milestone } from "./shell";
import { publish } from "./publish";
import { syncCommitToVentures } from "./contributions";

/**
 * The GitHub connection, ported from _github_connect.sql and _github_evidence.sql. The harvest job's stages
 * (src/harvest/stages.ts) call these; each runs in the job's transaction. Work is queued as platform jobs of kind
 * `github` with the stage message as payload (pgmq `github_jobs` today).
 */
export const JOB_KIND = "github";

export type Stage =
  | { stage: "discover"; user_id: string; job_id: number }
  | { stage: "classify"; user_id: string; job_id: number; repo_id: number }
  | { stage: "harvest"; user_id: string; job_id?: number; repo_id: number }
  | { stage: "extract"; user_id: string; job_id?: number; repo_id: number; shas: string[]; pushed_at?: string }
  | { stage: "code_check"; check_id: string }
  | { stage: "prs"; user_id: string }
  | { stage: "pr"; user_id: string; repo: string; number: number }
  | { stage: "webhook"; delivery_id: string }
  | { stage: "revoke"; revocation_id: number };

/** `enqueue_github(message, delay)`. */
export async function enqueueStage(tx: Tx, msg: Stage, delaySeconds = 0): Promise<void> {
  await enqueue(tx, { kind: JOB_KIND, payload: msg as unknown as Record<string, unknown>, runAt: delaySeconds > 0 ? new Date(Date.now() + delaySeconds * 1000) : undefined });
}

/** `start_github_sync(user, trigger)`: one open sync per student; starts with discovery. */
export async function startSync(tx: Tx, userId: string, trigger: "connect" | "resync" | "webhook" | "nightly"): Promise<number> {
  const [open] = await tx<{ id: string }[]>`select id::text from work.github_sync_jobs where user_id = ${userId} and status in ('queued', 'running')`;
  if (open) return Number(open.id);
  const [row] = await tx<{ id: string }[]>`
    insert into work.github_sync_jobs (user_id, trigger, stage, pending) values (${userId}, ${trigger}, 'discover', 1) returning id::text`;
  const id = Number(row!.id);
  await enqueueStage(tx, { stage: "discover", user_id: userId, job_id: id });
  return id;
}

/** `update_sync_job(job, stage, repos_total, repos_done_increment, finish, error)`. */
export async function updateSyncJob(
  tx: Tx,
  jobId: number | undefined,
  p: { stage?: string | null; reposTotal?: number | null; reposDone?: number; finish?: "done" | "failed" | "cancelled" | null; error?: string | null },
): Promise<void> {
  if (jobId === undefined) return;
  await tx`
    update work.github_sync_jobs
       set stage = coalesce(${p.stage ?? null}, stage),
           status = case when ${p.finish ?? null}::text is not null then ${p.finish ?? null} when status = 'queued' then 'running' else status end,
           repos_total = coalesce(${p.reposTotal ?? null}::int, repos_total),
           repos_done = least(repos_done + ${p.reposDone ?? 0}, coalesce(${p.reposTotal ?? null}::int, repos_total)),
           error = coalesce(left(${p.error ?? null}, 2000), error),
           finished_at = case when ${p.finish ?? null}::text is not null then now() else finished_at end,
           updated_at = now()
     where id = ${jobId} and status in ('queued', 'running')`;
}

/** `github_job_advance(job, messages, commits, stage)`: queue what follows; close the sync when nothing is pending. */
export async function advance(tx: Tx, jobId: number | undefined, next: readonly Stage[], commits = 0, stage: string | null = null): Promise<boolean> {
  for (const m of next) await enqueueStage(tx, m);
  if (jobId === undefined) return false;
  const [row] = await tx<{ pending: number }[]>`
    update work.github_sync_jobs
       set pending = greatest(pending + ${next.length} - 1, 0),
           commits_analysed = commits_analysed + greatest(${commits}, 0),
           stage = coalesce(${stage}, stage),
           status = case when status = 'queued' then 'running' else status end,
           updated_at = now()
     where id = ${jobId} and status in ('queued', 'running')
    returning pending`;
  if (!row || row.pending > 0) return false;
  await tx`update work.github_sync_jobs set status = 'done', stage = 'done', finished_at = now(), repos_done = repos_total, updated_at = now() where id = ${jobId}`;
  return true;
}

// ---- Tokens ----

export interface Tokens {
  accessToken: string;
  accessExpiresAt: string | null;
  refreshToken: string | null;
  refreshExpiresAt: string | null;
}

/** `store_github_tokens(user, …)`, sealed with the token key. */
export async function storeTokens(tx: Tx, key: Buffer, userId: string, t: Tokens): Promise<void> {
  const access = sealToken(key, t.accessToken, userId);
  const refresh = t.refreshToken ? sealToken(key, t.refreshToken, userId) : null;
  await tx`
    insert into work.github_tokens (user_id, access_token, access_expires_at, refresh_token, refresh_expires_at)
    values (${userId}, ${access}, ${t.accessExpiresAt}::timestamptz, ${refresh}, ${t.refreshExpiresAt}::timestamptz)
    on conflict (user_id) do update set access_token = excluded.access_token, access_expires_at = excluded.access_expires_at,
      refresh_token = excluded.refresh_token, refresh_expires_at = excluded.refresh_expires_at, updated_at = now()`;
}

export interface StoredTokens {
  access: string;
  accessExpiresAt: Date | null;
  refresh: string | null;
  refreshExpiresAt: Date | null;
}

export async function loadTokens(db: Db, key: Buffer, userId: string): Promise<StoredTokens | null> {
  const [row] = await db<{ access_token: Buffer; access_expires_at: Date | null; refresh_token: Buffer | null; refresh_expires_at: Date | null }[]>`
    select access_token, access_expires_at, refresh_token, refresh_expires_at from work.github_tokens where user_id = ${userId}`;
  if (!row) return null;
  return {
    access: openToken(key, row.access_token, userId),
    accessExpiresAt: row.access_expires_at,
    refresh: row.refresh_token ? openToken(key, row.refresh_token, userId) : null,
    refreshExpiresAt: row.refresh_expires_at,
  };
}

/**
 * Deleting a student's tokens queues their revocation at GitHub (the `github_tokens_revoke` trigger): the sealed
 * tokens move to github_revocations and the harvest job's `revoke` stage revokes and forgets them.
 */
export async function dropTokens(tx: Tx, userId: string): Promise<void> {
  const gone = await tx<{ access_token: Buffer; refresh_token: Buffer | null }[]>`
    delete from work.github_tokens where user_id = ${userId} returning access_token, refresh_token`;
  for (const t of gone) {
    const [r] = await tx<{ id: string }[]>`
      insert into work.github_revocations (user_id, access_token, refresh_token) values (${userId}, ${t.access_token}, ${t.refresh_token}) returning id::text`;
    await enqueueStage(tx, { stage: "revoke", revocation_id: Number(r!.id) });
  }
}

/** The revocation's tokens, opened (the `revoke` stage). */
export async function revocation(db: Db, key: Buffer, id: number): Promise<{ access: string | null; refresh: string | null } | null> {
  const [row] = await db<{ user_id: string; access_token: Buffer; refresh_token: Buffer | null }[]>`
    select user_id::text, access_token, refresh_token from work.github_revocations where id = ${id}`;
  if (!row) return null;
  return { access: openToken(key, row.access_token, row.user_id), refresh: row.refresh_token ? openToken(key, row.refresh_token, row.user_id) : null };
}

/** `finish_github_revocation(id)`: the sealed tokens are forgotten. */
export async function finishRevocation(tx: Tx, id: number): Promise<void> {
  await tx`delete from work.github_revocations where id = ${id}`;
}

/** `mark_github_revoked(user)`: GitHub refused the grant; the account stays listed as revoked. */
export async function markRevoked(tx: Tx, userId: string): Promise<void> {
  await tx`update work.github_accounts set revoked_at = now(), updated_at = now() where user_id = ${userId} and revoked_at is null`;
  await dropTokens(tx, userId);
  await tx`update work.github_sync_jobs set status = 'cancelled', finished_at = now(), updated_at = now() where user_id = ${userId} and status in ('queued', 'running')`;
  await publish(tx, [milestone(userId, "github.connected", false)]);
}

// ---- Linking ----

export interface InstallationInput {
  id: number;
  account_id: number;
  account_login: string;
  account_type: "User" | "Organization";
  repository_selection: "all" | "selected";
  suspended?: boolean;
}

/** `sync_user_installations(user, installations)`: the App's installations the student can see, and nothing else. */
export async function syncUserInstallations(tx: Tx, userId: string, installations: readonly InstallationInput[]): Promise<void> {
  for (const i of installations)
    await tx`
      insert into work.github_installations (installation_id, account_id, account_login, account_type, repository_selection, suspended_at)
      values (${i.id}, ${i.account_id}, ${i.account_login}, ${i.account_type}, ${i.repository_selection}, case when ${i.suspended ?? false} then now() end)
      on conflict (installation_id) do update
        set account_login = excluded.account_login, repository_selection = excluded.repository_selection,
            suspended_at = case when excluded.suspended_at is null then null else coalesce(work.github_installations.suspended_at, excluded.suspended_at) end,
            deleted_at = null, updated_at = now()`;
  const ids = installations.map((i) => i.id);
  for (const id of ids) await tx`insert into work.github_user_installations (user_id, installation_id) values (${userId}, ${id}) on conflict do nothing`;
  await tx`delete from work.github_user_repos where user_id = ${userId} and not (installation_id = any(${ids}::bigint[]))`;
  await tx`delete from work.github_user_installations where user_id = ${userId} and not (installation_id = any(${ids}::bigint[]))`;
  await deleteOrphanRepos(tx);
}

const deleteOrphanRepos = (tx: Tx) => tx`delete from work.github_repos r where not exists (select 1 from work.github_user_repos ur where ur.repo_id = r.repo_id)`;

export type LinkStatus = "linked" | "clash" | "other_account";

/**
 * `complete_github_link`: binds the signed-in student to the GitHub account behind the OAuth code (exchanged by
 * the caller). A GitHub account linked to someone else is a clash staff look into; a second account is refused.
 */
export async function completeLink(
  tx: Tx,
  key: Buffer,
  userId: string,
  account: { github_id: number; login: string },
  tokens: Tokens,
  installations: readonly InstallationInput[],
): Promise<LinkStatus> {
  const [existing] = await tx<{ user_id: string }[]>`select user_id::text from work.github_accounts where github_id = ${account.github_id}`;
  if (existing && existing.user_id !== userId) {
    await tx`insert into work.github_link_clashes (user_id, github_id, github_login, linked_user_id) values (${userId}, ${account.github_id}, ${account.login}, ${existing.user_id})`;
    return "clash";
  }
  const [other] = await tx`select 1 from work.github_accounts where user_id = ${userId} and github_id <> ${account.github_id}`;
  if (other) return "other_account";
  await tx`
    insert into work.github_accounts (user_id, github_id, login) values (${userId}, ${account.github_id}, ${account.login})
    on conflict (user_id) do update set login = excluded.login, revoked_at = null, updated_at = now()`;
  await storeTokens(tx, key, userId, tokens);
  await syncUserInstallations(tx, userId, installations);
  await startSync(tx, userId, "connect");
  await publish(tx, [milestone(userId, "github.connected", true)]);
  return "linked";
}

/** `refresh_github_login(user, github id, login)`: GitHub renames follow. */
export async function refreshLogin(tx: Tx, userId: string, githubId: number, login: string): Promise<void> {
  await tx`update work.github_accounts set login = ${login}, updated_at = now() where user_id = ${userId} and github_id = ${githubId} and login is distinct from ${login}`;
}

/** `remove_github_data(user)`: the connection and the shared repositories go; commits and evidence stay. */
export async function removeGithubData(tx: Tx, userId: string): Promise<void> {
  await tx`update work.github_sync_jobs set status = 'cancelled', finished_at = now(), updated_at = now() where user_id = ${userId} and status in ('queued', 'running')`;
  await dropTokens(tx, userId);
  await tx`delete from work.github_user_repos where user_id = ${userId}`;
  await tx`delete from work.github_user_installations where user_id = ${userId}`;
  await tx`delete from work.github_accounts where user_id = ${userId}`;
  await deleteOrphanRepos(tx);
  await publish(tx, [milestone(userId, "github.connected", false)]);
}

/** `disconnect_github()`: false when nothing is connected. */
export async function disconnectGithub(tx: Tx, me: string | null, recompute: (tx: Tx, users: readonly string[]) => Promise<void>): Promise<boolean> {
  if (!me) throw refused("not_signed_in");
  const [a] = await tx`select 1 from work.github_accounts where user_id = ${me}`;
  if (!a) return false;
  await removeGithubData(tx, me);
  // github_user_repos_recompute: the levels drop the evidence of unshared repositories.
  await recompute(tx, [me]);
  return true;
}

/** `request_github_resync()`: 5 an hour; false when not connected. */
export async function requestResync(tx: Tx, me: string | null): Promise<boolean> {
  if (!me) throw refused("not_signed_in");
  const [a] = await tx`select 1 from work.github_accounts where user_id = ${me} and revoked_at is null`;
  if (!a) return false;
  if (!(await rateLimit(tx, `github_resync:${me}`, 5, 3_600))) throw refused("rate_limited");
  await startSync(tx, me, "resync");
  return true;
}

/** `github_nightly_sync()`: every connected student, once a night (a scheduled job, `batch`). */
export async function nightlySync(tx: Tx): Promise<number> {
  const users = await tx<{ user_id: string }[]>`select user_id::text from work.github_accounts where revoked_at is null order by user_id`;
  for (const u of users) await startSync(tx, u.user_id, "nightly");
  return users.length;
}

// ---- Repositories ----

export interface DiscoveredRepo {
  id: number;
  full_name: string;
  owner_id: number;
  private: boolean;
  fork: boolean;
  default_branch: string | null;
  pushed_at: string | null;
}

/** `upsert_discovered_repos(user, installation, repos)`: returns the shared, not excluded ones to classify. */
export async function upsertDiscoveredRepos(tx: Tx, userId: string, installationId: number, repos: readonly DiscoveredRepo[]): Promise<number[]> {
  const ids = repos.map((r) => r.id);
  for (const r of repos)
    await tx`
      insert into work.github_repos (repo_id, full_name, owner_id, private, fork, default_branch, pushed_at)
      values (${r.id}, ${r.full_name}, ${r.owner_id}, ${r.private}, ${r.fork}, ${r.default_branch}, ${r.pushed_at}::timestamptz)
      on conflict (repo_id) do update set full_name = excluded.full_name, owner_id = excluded.owner_id, private = excluded.private,
        fork = excluded.fork, default_branch = excluded.default_branch, pushed_at = excluded.pushed_at, updated_at = now()`;
  for (const id of ids)
    await tx`
      insert into work.github_user_repos (user_id, repo_id, installation_id) values (${userId}, ${id}, ${installationId})
      on conflict (user_id, repo_id) do update set installation_id = excluded.installation_id`;
  await tx`delete from work.github_user_repos where user_id = ${userId} and installation_id = ${installationId} and not (repo_id = any(${ids}::bigint[]))`;
  const keep = await tx<{ repo_id: string }[]>`
    select repo_id::text from work.github_user_repos where user_id = ${userId} and repo_id = any(${ids}::bigint[]) and not excluded`;
  return keep.map((r) => Number(r.repo_id));
}

/** `classify_repo(user, repo, owner, fork, parent, template)`. */
export async function classifyRepo(
  tx: Tx,
  userId: string,
  repoId: number,
  d: { owner_id: number; fork: boolean; parent_full_name: string | null; template_full_name: string | null },
): Promise<string> {
  const [a] = await tx<{ github_id: string }[]>`select github_id::text from work.github_accounts where user_id = ${userId}`;
  const kind = d.fork ? "fork" : d.template_full_name !== null ? "template" : a && d.owner_id === Number(a.github_id) ? "owned" : "collaborator";
  await tx`update work.github_repos set fork = ${d.fork}, parent_full_name = ${d.parent_full_name}, template_full_name = ${d.template_full_name}, updated_at = now() where repo_id = ${repoId}`;
  await tx`update work.github_user_repos set kind = ${kind}, classified_at = now() where user_id = ${userId} and repo_id = ${repoId}`;
  return kind;
}

/** `set_repo_details(repo, languages, upstream blobs)`. */
export async function setRepoDetails(tx: Tx, repoId: number, languages: readonly string[], upstream: readonly string[] | null): Promise<void> {
  await tx`update work.github_repos set languages = ${languages.slice(0, 100)}::text[], updated_at = now() where repo_id = ${repoId}`;
  if (upstream === null) return;
  await tx`delete from work.github_upstream_blobs where repo_id = ${repoId}`;
  const blobs = [...new Set(upstream.filter((b) => /^[0-9a-f]{40}$/.test(b)))];
  if (blobs.length) await tx`insert into work.github_upstream_blobs (repo_id, blob_sha) select ${repoId}, b from unnest(${blobs}::text[]) b on conflict do nothing`;
}

/** `set_repo_linguist_excludes(repo, globs)`. */
export async function setLinguistExcludes(tx: Tx, repoId: number, globs: readonly string[]): Promise<void> {
  await tx`update work.github_repos set linguist_excludes = ${globs.slice(0, 200)}::text[], updated_at = now() where repo_id = ${repoId}`;
}

export interface RepoRow {
  installation_id: string;
  kind: string | null;
  excluded: boolean;
  default_branch: string | null;
  linguist_excludes: string[];
  github_id: string;
  login: string;
}

/** The worker's REPO_QUERY: a shared repository with its student's live account. */
export async function repoFor(db: Db, userId: string, repoId: number): Promise<RepoRow | undefined> {
  const [r] = await db<RepoRow[]>`
    select ur.installation_id::text, ur.kind, ur.excluded, g.default_branch, g.linguist_excludes, a.github_id::text, a.login
      from work.github_user_repos ur
      join work.github_repos g on g.repo_id = ur.repo_id
      join work.github_accounts a on a.user_id = ur.user_id and a.revoked_at is null
     where ur.user_id = ${userId} and ur.repo_id = ${repoId}`;
  return r;
}

// ---- Commits ----

export interface ListedCommitInput {
  sha: string;
  authored_at: string | null;
  committed_at: string | null;
  parents: number;
  signed: boolean;
  ai_agent?: string | null;
  via_pr?: number | null;
}

/**
 * `harvest_commits(user, repo, commits, complete)`: records the listed commits (merges excluded at once); when the
 * list is complete, a commit no longer listed was rewritten away. Returns the shas still to extract, oldest first.
 */
export async function harvestCommits(tx: Tx, userId: string, repoId: number, commits: readonly ListedCommitInput[], complete: boolean): Promise<string[]> {
  const [shared] = await tx`select 1 from work.github_user_repos where user_id = ${userId} and repo_id = ${repoId}`;
  if (!shared) return [];
  const listed = commits.map((c) => c.sha);
  for (const c of commits.filter((x) => /^[0-9a-f]{40}$/.test(x.sha))) {
    const merge = (c.parents ?? 1) > 1;
    await tx`
      insert into work.github_commits (user_id, repo_id, sha, authored_at, occurred_at, seen_via, signed, status, exclusion, extracted_at, ai_agent, via_pr)
      values (${userId}, ${repoId}, ${c.sha}, ${c.authored_at}::timestamptz, least(coalesce(${c.committed_at}::timestamptz, now()), now()), 'harvest', ${c.signed},
              ${merge ? "excluded" : "pending"}, ${merge ? "merge" : null}, case when ${merge} then now() end, ${c.ai_agent || null}, ${c.via_pr ?? null})
      on conflict (user_id, repo_id, sha) do update
        set ai_agent = coalesce(work.github_commits.ai_agent, excluded.ai_agent), via_pr = coalesce(work.github_commits.via_pr, excluded.via_pr)
        where excluded.ai_agent is not null`;
  }
  if (complete) {
    await tx`
      delete from work.skill_evidence e using work.github_commits c
       where c.user_id = ${userId} and c.repo_id = ${repoId} and not (c.sha = any(${listed}::text[])) and c.status <> 'excluded' and c.ai_agent is null
         and e.user_id = c.user_id and e.repo_id = c.repo_id and e.sha = c.sha`;
    await tx`
      update work.github_commits set status = 'excluded', exclusion = 'rewritten', extracted_at = coalesce(extracted_at, now())
       where user_id = ${userId} and repo_id = ${repoId} and not (sha = any(${listed}::text[])) and status <> 'excluded' and ai_agent is null`;
  }
  await tx`update work.github_user_repos set harvested_at = now(), last_synced_at = now() where user_id = ${userId} and repo_id = ${repoId}`;
  const pending = await tx<{ sha: string }[]>`
    select sha from work.github_commits where user_id = ${userId} and repo_id = ${repoId} and extracted_at is null order by occurred_at, sha`;
  return pending.map((p) => p.sha);
}

export interface CommitRecord {
  sha: string;
  authored_at: string | null;
  committed_at: string | null;
  pushed_at: string | null;
  seen_via: "harvest" | "push";
  signed: boolean;
  ai_agent: string | null;
  via_pr: number | null;
  files: number;
  meaningful_lines: number;
  excluded: string | null;
  detections: { skill: string; kind: string; path: string; lines: number }[];
  blobs: string[];
}

/**
 * `record_commit(user, repo, commit)`: one extracted commit with its skill evidence, and the anti-gaming checks
 * (backdated pushes, bursts over 50 commits or 5,000 lines a day, blobs another account committed). Returns
 * whether the commit was new to extraction.
 */
export async function recordCommit(tx: Tx, userId: string, repoId: number, c: CommitRecord): Promise<boolean> {
  if (!/^[0-9a-f]{40}$/.test(c.sha)) throw refused("invalid_input");
  const [shared] = await tx`select 1 from work.github_user_repos where user_id = ${userId} and repo_id = ${repoId}`;
  if (!shared) return false;
  const [existing] = await tx<{ extracted_at: Date | null; occurred_at: Date }[]>`
    select extracted_at, occurred_at from work.github_commits where user_id = ${userId} and repo_id = ${repoId} and sha = ${c.sha}`;
  if (existing?.extracted_at) return false;
  const [{ occurred }] = (await tx<{ occurred: Date }[]>`
    select case when ${c.seen_via} = 'push' and ${c.pushed_at}::timestamptz is not null then least(${c.pushed_at}::timestamptz, now())
                when ${existing ? existing.occurred_at.toISOString() : null}::timestamptz is not null then ${existing ? existing.occurred_at.toISOString() : null}::timestamptz
                else least(coalesce(${c.committed_at}::timestamptz, now()), now()) end as occurred`) as unknown as [{ occurred: Date }];
  const occurredAt = occurred.toISOString();
  await tx`
    insert into work.github_commits (user_id, repo_id, sha, authored_at, occurred_at, seen_via, signed, files, meaningful_lines, status, exclusion, extracted_at, ai_agent, via_pr)
    values (${userId}, ${repoId}, ${c.sha}, ${c.authored_at}::timestamptz, ${occurredAt}::timestamptz, ${c.seen_via}, ${c.signed}, ${c.files},
            least(${c.meaningful_lines}, 400), ${c.excluded === null ? "counted" : "excluded"}, ${c.excluded}, now(), ${c.ai_agent || null}, ${c.via_pr})
    on conflict (user_id, repo_id, sha) do update
      set authored_at = excluded.authored_at, occurred_at = excluded.occurred_at,
          seen_via = case when excluded.seen_via = 'push' then 'push' else work.github_commits.seen_via end,
          signed = excluded.signed, files = excluded.files, meaningful_lines = excluded.meaningful_lines, status = excluded.status,
          exclusion = excluded.exclusion, extracted_at = excluded.extracted_at,
          ai_agent = coalesce(work.github_commits.ai_agent, excluded.ai_agent), via_pr = coalesce(work.github_commits.via_pr, excluded.via_pr)`;
  if (c.detections.length)
    await tx`
      insert into work.skill_evidence (user_id, skill_id, repo_id, sha, detectors, paths, lines, occurred_at)
      select ${userId}, d.skill, ${repoId}, ${c.sha}, array_agg(distinct d.kind), (array_agg(distinct d.path))[1:10], least(coalesce(sum(d.lines), 0), 400), ${occurredAt}::timestamptz
        from json_to_recordset(${JSON.stringify(c.detections)}::text::json) as d(skill text, kind text, path text, lines int)
        join work.skills s on s.id = d.skill
       group by d.skill
      on conflict (user_id, repo_id, sha, skill_id) do nothing`;
  if (c.excluded !== null) return true;
  // github_commit_contributions: the counted commit reaches the ventures linked to this repository.
  await syncCommitToVentures(tx, userId, repoId);
  const blobs = c.blobs.filter((b) => /^[0-9a-f]{40}$/.test(b));
  if (blobs.length)
    await tx`insert into work.github_commit_blobs (blob_sha, user_id, repo_id, sha) select b, ${userId}, ${repoId}, ${c.sha} from unnest(${blobs}::text[]) b on conflict do nothing`;
  if (c.seen_via === "push" && c.authored_at && c.pushed_at && Date.parse(c.authored_at) < Date.parse(c.pushed_at) - 30 * 86_400_000)
    await openReviewFlag(tx, userId, "backdating", c.sha, { authored_at: c.authored_at, pushed_at: c.pushed_at }, [{ repo_id: repoId, sha: c.sha }]);
  const [day] = await tx<{ day: string; commits: number; lines: number }[]>`
    select d.day::text, count(*)::int as commits, coalesce(sum(g.meaningful_lines), 0)::int as lines
      from (select (${occurredAt}::timestamptz at time zone 'Asia/Karachi')::date as day) d
      join work.github_commits g on g.user_id = ${userId} and g.status in ('counted', 'held') and (g.occurred_at at time zone 'Asia/Karachi')::date = d.day
     group by d.day`;
  if (day && (day.commits > 50 || day.lines > 5000)) {
    const all = await tx<{ repo_id: string; sha: string }[]>`
      select repo_id::text, sha from work.github_commits
       where user_id = ${userId} and status in ('counted', 'held') and (occurred_at at time zone 'Asia/Karachi')::date = ${day.day}::date`;
    await openReviewFlag(tx, userId, "burst", day.day, { day: day.day, commits: day.commits, lines: day.lines }, all.map((x) => ({ repo_id: Number(x.repo_id), sha: x.sha })));
  }
  const others = await tx<{ user_id: string; repo_id: string; sha: string }[]>`
    select distinct o.user_id::text, o.repo_id::text, o.sha
      from work.github_commit_blobs mine join work.github_commit_blobs o on o.blob_sha = mine.blob_sha
     where mine.user_id = ${userId} and mine.repo_id = ${repoId} and mine.sha = ${c.sha} and o.user_id <> ${userId} and o.repo_id <> ${repoId}`;
  for (const o of others) {
    await openReviewFlag(tx, userId, "cross_account_duplicate", o.user_id, { other_repo_id: Number(o.repo_id) }, [{ repo_id: repoId, sha: c.sha }]);
    await openReviewFlag(tx, o.user_id, "cross_account_duplicate", userId, { other_repo_id: repoId }, [{ repo_id: Number(o.repo_id), sha: o.sha }]);
  }
  return true;
}

/** `open_review_flag(user, kind, key, refs, commits)`: an open flag holds its counted commits back. */
export async function openReviewFlag(tx: Tx, userId: string, kind: string, key: string, refs: Record<string, unknown>, commits: { repo_id: number; sha: string }[]): Promise<number> {
  const [flag] = await tx<{ id: string; status: string }[]>`
    insert into work.review_flags (user_id, kind, key, refs) values (${userId}, ${kind}, ${key}, ${JSON.stringify(refs)}::text::jsonb)
    on conflict (user_id, kind, key) do update set refs = work.review_flags.refs || excluded.refs
    returning id::text, status`;
  for (const c of commits)
    await tx`insert into work.review_flag_commits (flag_id, user_id, repo_id, sha) values (${flag!.id}, ${userId}, ${c.repo_id}, ${c.sha}) on conflict do nothing`;
  if (flag!.status === "open")
    await tx`
      update work.github_commits g set status = 'held'
        from work.review_flag_commits l
       where l.flag_id = ${flag!.id} and g.user_id = l.user_id and g.repo_id = l.repo_id and g.sha = l.sha and g.status = 'counted'`;
  return Number(flag!.id);
}

// ---- Agent pull requests, merged pull requests ----

/** `agent_prs_checked(user, repo, mark)`: when the repository's merged pull requests were last checked for agents. */
export async function agentPrsChecked(tx: Tx, userId: string, repoId: number, mark: boolean): Promise<Date | null> {
  const [r] = await tx<{ at: Date | null }[]>`select agent_prs_checked_at as at from work.github_user_repos where user_id = ${userId} and repo_id = ${repoId}`;
  if (mark) await tx`update work.github_user_repos set agent_prs_checked_at = now() where user_id = ${userId} and repo_id = ${repoId}`;
  return r?.at ?? null;
}

export const agentCommitShas = (db: Db, userId: string, repoId: number) =>
  db<{ sha: string; ai_agent: string; via_pr: number }[]>`select sha, ai_agent, via_pr from work.github_commits where user_id = ${userId} and repo_id = ${repoId} and ai_agent is not null`;

export const knownPullRequests = (db: Db, userId: string) =>
  db<{ repo_full_name: string; number: number }[]>`select lower(repo_full_name) as repo_full_name, number from work.github_pull_requests where user_id = ${userId}`;

export async function sharedRepoId(db: Db, userId: string, githubRepoId: number): Promise<number | null> {
  const [r] = await db<{ repo_id: string }[]>`select repo_id::text from work.github_user_repos where user_id = ${userId} and repo_id = ${githubRepoId} and not excluded`;
  return r ? Number(r.repo_id) : null;
}

/** `ai_agents()`: the identities commits are matched against (work.config `github.ai_agents`). */
export async function aiAgents(db: Db): Promise<unknown> {
  const [r] = await db<{ value: unknown }[]>`select value from work.config where key = 'github.ai_agents'`;
  return r?.value ?? [];
}

// ---- Webhooks ----

/** `record_github_webhook(delivery, event, action, installation, payload)`: stored once, then a job. */
export async function recordWebhook(tx: Tx, w: { delivery_id: string; event: string; action: string | null; installation_id: number | null; payload: unknown }): Promise<boolean> {
  const r = await tx`
    insert into work.github_webhook_events (delivery_id, event, action, installation_id, payload)
    values (${w.delivery_id}, ${w.event}, ${w.action}, ${w.installation_id}, ${JSON.stringify(w.payload)}::text::jsonb)
    on conflict (delivery_id) do nothing returning 1`;
  if (!r.length) return false;
  await enqueueStage(tx, { stage: "webhook", delivery_id: w.delivery_id });
  return true;
}

/**
 * `process_github_webhook(delivery)` and `github_webhook_pr(delivery)`: installation changes applied; students
 * whose access changed are returned for a fresh discovery; pushes to a shared default branch queue extraction
 * (or a fresh harvest after a force push); a merged or approved pull request by a connected student queues a
 * `pr` stage.
 */
export async function processWebhook(tx: Tx, deliveryId: string): Promise<{ discover: string[]; next: Stage[] }> {
  const [ev] = await tx<{ event: string; action: string | null; installation_id: string | null; payload: Record<string, unknown>; received_at: Date; processed_at: Date | null }[]>`
    select event, action, installation_id::text, payload, received_at, processed_at from work.github_webhook_events where delivery_id = ${deliveryId} for update`;
  if (!ev || ev.processed_at) return { discover: [], next: [] };
  const p = ev.payload as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const installation = ev.installation_id ? Number(ev.installation_id) : Number(p["installation"]?.["id"] ?? NaN);
  let discover: string[] = [];
  const next: Stage[] = [];
  const usersOf = async () => (await tx<{ user_id: string }[]>`select user_id::text from work.github_user_installations where installation_id = ${installation}`).map((u) => u.user_id);
  if (ev.event === "installation") {
    if (ev.action === "deleted") {
      await tx`update work.github_installations set deleted_at = now() where installation_id = ${installation}`;
      await tx`delete from work.github_user_repos where installation_id = ${installation}`;
      await tx`delete from work.github_user_installations where installation_id = ${installation}`;
      await deleteOrphanRepos(tx);
    } else if (ev.action === "suspend") {
      await tx`update work.github_installations set suspended_at = now() where installation_id = ${installation}`;
    } else if (ev.action === "unsuspend") {
      await tx`update work.github_installations set suspended_at = null where installation_id = ${installation}`;
      discover = await usersOf();
    }
  } else if (ev.event === "installation_repositories") {
    const removed = ((p["repositories_removed"] ?? []) as { id: number }[]).map((r) => Number(r.id)).filter(Number.isFinite);
    await tx`delete from work.github_user_repos where installation_id = ${installation} and repo_id = any(${removed}::bigint[])`;
    await deleteOrphanRepos(tx);
    if (typeof p["repository_selection"] === "string")
      await tx`update work.github_installations set repository_selection = ${p["repository_selection"]} where installation_id = ${installation}`;
    discover = await usersOf();
  } else if (ev.event === "github_app_authorization" && ev.action === "revoked") {
    const [u] = await tx<{ user_id: string }[]>`select user_id::text from work.github_accounts where github_id = ${Number(p["sender"]?.["id"] ?? 0)}`;
    if (u) await markRevoked(tx, u.user_id);
  } else if (ev.event === "push" && p["deleted"] !== true) {
    const repo = Number(p["repository"]?.["id"] ?? 0);
    const shas = ((p["commits"] ?? []) as unknown[]).filter((s): s is string => typeof s === "string" && /^[0-9a-f]{40}$/.test(s));
    const targets = await tx<{ user_id: string }[]>`
      select ur.user_id::text from work.github_user_repos ur
        join work.github_repos g on g.repo_id = ur.repo_id
        join work.github_accounts a on a.user_id = ur.user_id and a.revoked_at is null
       where ur.repo_id = ${repo} and not ur.excluded and ur.kind is not null and ${String(p["ref"] ?? "")} = 'refs/heads/' || g.default_branch`;
    for (const t of targets) {
      if (p["forced"] === true) next.push({ stage: "harvest", user_id: t.user_id, repo_id: repo });
      else if (shas.length) next.push({ stage: "extract", user_id: t.user_id, repo_id: repo, shas, pushed_at: ev.received_at.toISOString() });
    }
  }
  await tx`update work.github_webhook_events set processed_at = now() where delivery_id = ${deliveryId}`;
  // github_webhook_pr
  const pr = p["pull_request"] as Record<string, any> | undefined; // eslint-disable-line @typescript-eslint/no-explicit-any
  const repoName = p["repository"]?.["full_name"];
  const merged = ev.event === "pull_request" && ev.action === "closed" && pr?.["merged"] === true;
  const approved = ev.event === "pull_request_review" && ev.action === "submitted" && String(p["review"]?.["state"] ?? "").toLowerCase() === "approved";
  if (pr && typeof repoName === "string" && Number.isInteger(pr["number"]) && (merged || approved)) {
    const [u] = await tx<{ user_id: string }[]>`select user_id::text from work.github_accounts where github_id = ${Number(pr["user"]?.["id"] ?? 0)} and revoked_at is null`;
    if (u) next.push({ stage: "pr", user_id: u.user_id, repo: repoName, number: Number(pr["number"]) });
  }
  return { discover, next };
}

/** `purge_github_data()`: webhook deliveries older than 30 days (daily, `batch`). */
export async function purgeGithubData(tx: Tx): Promise<number> {
  const r = await tx`delete from work.github_webhook_events where received_at < now() - interval '30 days' returning 1`;
  return r.length;
}

/** The GitHub settings card (lib/data/github.ts): the account, its sync, the shared repositories. */
export async function githubState(db: Db, me: string) {
  const [account] = await db<{ login: string; connected_at: Date; revoked_at: Date | null }[]>`
    select login, connected_at, revoked_at from work.github_accounts where user_id = ${me}`;
  const [sync] = await db<{ status: string; stage: string | null; repos_total: number; repos_done: number; commits_analysed: number; skills_found: number; created_at: Date; finished_at: Date | null }[]>`
    select status, stage, repos_total, repos_done, commits_analysed, skills_found, created_at, finished_at from work.github_sync_jobs
     where user_id = ${me} order by created_at desc, id desc limit 1`;
  const repos = await db<{ repo_id: string; full_name: string; private: boolean; kind: string | null; excluded: boolean; harvested_at: Date | null }[]>`
    select ur.repo_id::text, g.full_name, g.private, ur.kind, ur.excluded, ur.harvested_at
      from work.github_user_repos ur join work.github_repos g on g.repo_id = ur.repo_id where ur.user_id = ${me} order by lower(g.full_name)`;
  return { account, sync, repos };
}

/** Keeps a shared repository out of (or back in) the evidence; the levels follow (github_user_repos_recompute). */
export async function setRepoExcluded(tx: Tx, me: string, repoId: number, excluded: boolean, recompute: (tx: Tx, users: readonly string[]) => Promise<void>): Promise<boolean> {
  const r = await tx<{ was: boolean }[]>`
    update work.github_user_repos u set excluded = ${excluded}
      from (select excluded as was from work.github_user_repos where user_id = ${me} and repo_id = ${repoId} for update) o
     where u.user_id = ${me} and u.repo_id = ${repoId} returning o.was`;
  if (!r.length) return false;
  if (r[0]!.was !== excluded) await recompute(tx, [me]);
  return true;
}

/** The owner's shared, not excluded repositories (a venture can link one). */
export const ownerRepos = (db: Db, me: string) =>
  db<{ repo_id: string; full_name: string }[]>`
    select ur.repo_id::text, g.full_name from work.github_user_repos ur join work.github_repos g on g.repo_id = ur.repo_id
     where ur.user_id = ${me} and not ur.excluded order by lower(g.full_name)`;

/** Commits held back for a Trust review. */
export async function heldCount(db: Db, me: string): Promise<number> {
  const [r] = await db<{ n: number }[]>`select count(*)::int as n from work.github_commits where user_id = ${me} and status = 'held'`;
  return r!.n;
}

/** The skill drawer's evidence: the reader's newest 50 commits for the skill with their status and repository. */
export async function skillEvidence(db: Db, me: string, skill: string) {
  const items = await db<{
    repo_id: string;
    full_name: string | null;
    sha: string;
    detectors: string[];
    paths: string[];
    lines: number;
    occurred_at: Date;
    status: string | null;
    exclusion: string | null;
    signed: boolean | null;
    ai_agent: string | null;
  }[]>`
    select e.repo_id::text, g.full_name, e.sha, e.detectors, e.paths, e.lines, e.occurred_at, c.status, c.exclusion, c.signed, c.ai_agent
      from work.skill_evidence e
      left join work.github_commits c on c.user_id = e.user_id and c.repo_id = e.repo_id and c.sha = e.sha
      left join work.github_repos g on g.repo_id = e.repo_id
     where e.user_id = ${me} and e.skill_id = ${skill}
     order by e.occurred_at desc, e.id desc limit 50`;
  const [total] = await db<{ n: number }[]>`select count(*)::int as n from work.skill_evidence where user_id = ${me} and skill_id = ${skill}`;
  return { items, total: total!.n };
}

export { count };
