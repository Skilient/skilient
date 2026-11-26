import type { Job, Logger } from "@skilient/platform";
import { agentAuthor, parseAgents, type AgentIdentity } from "../gh/agents";
import { GitHub, GitHubError, RateLimited, refreshUserToken, revokeGrant } from "../gh/client";
import {
  analyseCommit,
  compileTaxonomy,
  duplicateCandidates,
  globToRegExp,
  isBulkImport,
  linguistGlobPatterns,
  type ChangedFile,
  type CompiledTaxonomy,
  type TaxonomySkill,
} from "../gh/detectors";
import { addedRuns, pickWindow } from "../gh/snippet";
import type { Fetch, GithubConfig } from "../gh/types";
import * as CC from "../store/code-checks";
import type { Tx } from "../store/db";
import * as G from "../store/github";
import { recomputeUserSkills, recordPullRequest } from "../store/skills";
import { taskGithubCheck } from "../store/tasks";

/**
 * The `harvest` job (docs/azure/prd.md, "Jobs"; the `github-worker` Edge Function today, PRD 5.5 "Import
 * pipeline"): one platform job of kind `github` per stage message. Each stage is idempotent and runs in the job's
 * transaction. Rate-limited work is re-queued with GitHub's delay; a failure is retried by the job queue and,
 * on the last attempt (or when the student's token is gone), the sync is marked failed or cancelled.
 * Ported from apps/web/supabase/functions/_shared/github/worker.ts; constants as there.
 */
export const MAX_COMMITS = 500;
export const EXTRACT_BATCH = 10;
export const MAX_PRS = 100;
export const APPROVER_MIN_AGE_DAYS = 90;
export const MAX_AGENT_PRS = 100;

export interface HarvestDeps {
  cfg: GithubConfig;
  /** The 32-byte key that seals students' GitHub tokens (Key Vault `work-github-token-key`). */
  tokenKey: Buffer;
  fetch?: Fetch;
  now?: () => number;
  random?: () => number;
  logger?: Logger;
}

/** The student's token was revoked or can't be refreshed: stop, don't retry. */
class NoToken extends Error {}

interface Ctx extends HarvestDeps {
  tx: Tx;
  now: () => number;
  github: GitHub;
  fetchImpl: Fetch;
  taxonomy?: { skills: TaxonomySkill[]; compiled: CompiledTaxonomy };
}

/** The job handler for kind `github`. */
export function harvestHandler(deps: HarvestDeps) {
  return async (tx: Tx, job: Job): Promise<void> => {
    const now = deps.now ?? Date.now;
    const fetchImpl = deps.fetch ?? fetch;
    const ctx: Ctx = { ...deps, tx, now, fetchImpl, github: new GitHub(deps.cfg, fetchImpl, now) };
    const msg = job.payload as unknown as G.Stage;
    const began = now();
    const ids = (({ stage: _s, ...rest }) => rest)(msg as G.Stage & Record<string, unknown>);
    try {
      await tx.savepoint((sp) => STAGES[msg.stage]({ ...ctx, tx: sp }, msg as never));
      deps.logger?.info("github.job", { action: `harvest.${msg.stage}`, outcome: "ok", ms: now() - began, ...redact(ids) });
    } catch (error) {
      if (error instanceof RateLimited) {
        await G.enqueueStage(tx, msg, error.seconds);
        deps.logger?.info("github.job", { action: `harvest.${msg.stage}`, outcome: "deferred", ...redact(ids) });
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      if (error instanceof NoToken || job.attempts >= job.max_attempts) {
        if ("job_id" in msg)
          await G.updateSyncJob(tx, msg.job_id, { finish: error instanceof NoToken ? "cancelled" : "failed", error: `${msg.stage}: ${message}` });
        deps.logger?.warn("github.job", { action: `harvest.${msg.stage}`, outcome: "dead_letter", error_code: message.slice(0, 80), ...redact(ids) });
        return;
      }
      throw error;
    }
  };
}

/** Log fields: ids only (user ids hashed by the logger's caller contract), never repository names. */
const redact = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([k]) => k !== "repo" && k !== "shas"));

async function userToken(ctx: Ctx, userId: string): Promise<string> {
  const row = await G.loadTokens(ctx.tx, ctx.tokenKey, userId);
  if (!row) throw new NoToken("no token");
  const soon = ctx.now() + 5 * 60_000;
  if (!row.accessExpiresAt || row.accessExpiresAt.getTime() > soon) return row.access;
  if (!row.refresh || (row.refreshExpiresAt && row.refreshExpiresAt.getTime() < ctx.now())) {
    await G.markRevoked(ctx.tx, userId);
    throw new NoToken("token expired");
  }
  try {
    const fresh = await refreshUserToken(ctx.cfg, ctx.fetchImpl, row.refresh, ctx.now());
    await G.storeTokens(ctx.tx, ctx.tokenKey, userId, fresh);
    return fresh.accessToken;
  } catch (error) {
    if (error instanceof GitHubError && error.status < 500) {
      await G.markRevoked(ctx.tx, userId);
      throw new NoToken("refresh refused");
    }
    throw error;
  }
}

interface ListedRepo {
  id: number;
  full_name: string;
  owner: { id: number };
  private: boolean;
  fork: boolean;
  default_branch: string | null;
  pushed_at: string | null;
}
interface RepoDetail {
  id: number;
  owner: { id: number };
  fork: boolean;
  parent?: { full_name: string };
  template_repository?: { full_name: string } | null;
}
interface Installation {
  id: number;
  app_id: number;
  account: { id: number; login: string; type: string } | null;
  repository_selection: string;
  suspended_at: string | null;
}
interface ListedCommit {
  sha: string;
  author: { id: number; login?: string; type?: string } | null;
  parents: { sha: string }[];
  commit: {
    author: { date: string; email?: string | null; name?: string | null } | null;
    committer: { date: string } | null;
    verification?: { verified: boolean };
  };
}
interface GitHubFile {
  filename?: string;
  status?: string;
  additions?: number;
  deletions?: number;
  patch?: string | null;
  sha?: string | null;
}
interface CommitDetail extends ListedCommit {
  files?: GitHubFile[];
}
interface GitHubUser {
  id: number;
  login: string;
  type?: string;
}
interface SearchIssues {
  items: { number: number; user: GitHubUser | null; repository_url: string; pull_request?: { merged_at?: string | null } }[];
}
interface PullDetail {
  id: number;
  number: number;
  user: GitHubUser | null;
  merged_at: string | null;
  merge_commit_sha?: string | null;
  merged_by: GitHubUser | null;
  base: { repo: { id: number; full_name: string; private: boolean; owner: GitHubUser } };
}
interface Review {
  user: GitHubUser | null;
  state: string;
}

/** GitHub's file entries in the detectors' shape; entries without a name are dropped. */
export function changedFiles(files: GitHubFile[] | undefined): ChangedFile[] {
  return (files ?? []).flatMap((f) =>
    typeof f.filename === "string" && f.filename
      ? [{ path: f.filename, status: f.status ?? "modified", additions: f.additions, deletions: f.deletions, patch: f.patch ?? null, sha: f.sha ?? null }]
      : [],
  );
}

const isHuman = (u: GitHubUser | null | undefined): u is GitHubUser => !!u && (u.type ?? "User") === "User" && !u.login.toLowerCase().endsWith("[bot]");

/** "owner/repo" with GitHub's name characters, never "." or ".." as a segment. */
export function isRepoName(name: string): boolean {
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(name) && !name.split("/").some((part) => /^\.+$/.test(part));
}

/** "owner/repo" from a search result's `repository_url`. */
export function repoFromUrl(url: string): string | null {
  const m = /\/repos\/([^/]+\/[^/]+)$/.exec(url);
  return m && isRepoName(m[1]!) ? m[1]! : null;
}

async function loadAgents(ctx: Ctx): Promise<AgentIdentity[]> {
  return parseAgents(await G.aiAgents(ctx.tx));
}

/** The commits an AI agent wrote in one merged (merge-commit) pull request the student opened. Returns how many. */
async function recordAgentPr(ctx: Ctx, token: string, userId: string, repoId: number, pr: { number: number; merge_commit_sha?: string | null }, agents: AgentIdentity[]): Promise<number> {
  const { github } = ctx;
  if (!agents.length || !pr.merge_commit_sha || !/^[0-9a-f]{40}$/.test(pr.merge_commit_sha)) return 0;
  try {
    const { data: merge } = await github.request<ListedCommit>(token, `/repositories/${repoId}/commits/${pr.merge_commit_sha}`);
    if ((merge.parents?.length ?? 0) < 2) return 0;
  } catch (error) {
    if (error instanceof GitHubError && [404, 409, 422].includes(error.status)) return 0;
    throw error;
  }
  const commits = await github.paginate<ListedCommit[], ListedCommit>(token, `/repositories/${repoId}/pulls/${pr.number}/commits?per_page=100`, (page) => page, 3);
  const mine = commits.flatMap((c) => {
    const agent = agentAuthor(c, agents);
    return agent
      ? [{ sha: c.sha, authored_at: c.commit.author?.date ?? null, committed_at: c.commit.committer?.date ?? null, parents: c.parents.length, signed: c.commit.verification?.verified === true, ai_agent: agent, via_pr: pr.number }]
      : [];
  });
  if (!mine.length) return 0;
  await G.harvestCommits(ctx.tx, userId, repoId, mine, false);
  return mine.length;
}

async function loadTaxonomy(ctx: Ctx) {
  if (!ctx.taxonomy) {
    const skills = (await ctx.tx<TaxonomySkill[]>`select id, category, detectors from work.skills where retired_at is null`) as unknown as TaxonomySkill[];
    ctx.taxonomy = { skills, compiled: compileTaxonomy(skills) };
  }
  return ctx.taxonomy;
}

async function linguistExcludes(ctx: Ctx, token: string, repoId: number): Promise<string[]> {
  try {
    const { data } = await ctx.github.request<{ content?: string; encoding?: string }>(token, `/repositories/${repoId}/contents/.gitattributes`);
    if (!data?.content || data.encoding !== "base64") return [];
    return linguistGlobPatterns(Buffer.from(data.content.replace(/\s/g, ""), "base64").toString("latin1")).slice(0, 200);
  } catch (error) {
    if (error instanceof GitHubError && error.status === 404) return [];
    throw error;
  }
}

async function upstreamBlobs(ctx: Ctx, token: string, fullName: string): Promise<string[] | null> {
  try {
    const { data } = await ctx.github.request<{ tree: { type: string; sha: string }[] }>(token, `/repos/${fullName}/git/trees/HEAD?recursive=1`);
    return data.tree.filter((t) => t.type === "blob").map((t) => t.sha).slice(0, 50_000);
  } catch (error) {
    if (error instanceof GitHubError && (error.status === 404 || error.status === 403 || error.status === 409)) return null;
    throw error;
  }
}

const afterEvidence = async (ctx: Ctx, userId: string) => {
  await recomputeUserSkills(ctx.tx, [userId]);
  await taskGithubCheck(ctx.tx, userId);
};

const STAGES: { [S in G.Stage["stage"]]: (ctx: Ctx, msg: Extract<G.Stage, { stage: S }>) => Promise<void> } = {
  /** List what the student shared through each installation; queue classification. */
  async discover(ctx, msg) {
    const { tx, github } = ctx;
    const token = await userToken(ctx, msg.user_id);
    github.ensureBudget(token);
    await G.updateSyncJob(tx, msg.job_id, { stage: "discover" });
    const { data: me } = await github.request<{ id: number; login: string }>(token, "/user");
    await G.refreshLogin(tx, msg.user_id, me.id, me.login);
    const installations = await github.paginate<{ installations: Installation[] }, Installation>(token, "/user/installations?per_page=100", (page) => page.installations);
    const ours = installations.filter((i) => String(i.app_id) === ctx.cfg.appId && i.account);
    await G.syncUserInstallations(
      tx,
      msg.user_id,
      ours.map((i) => ({
        id: i.id,
        account_id: i.account!.id,
        account_login: i.account!.login,
        account_type: i.account!.type === "Organization" ? "Organization" : "User",
        repository_selection: i.repository_selection === "all" ? "all" : "selected",
        suspended: Boolean(i.suspended_at),
      })),
    );
    const toClassify: number[] = [];
    for (const installation of ours.filter((i) => !i.suspended_at)) {
      const repos = await github.paginate<{ repositories: ListedRepo[] }, ListedRepo>(token, `/user/installations/${installation.id}/repositories?per_page=100`, (page) => page.repositories);
      toClassify.push(
        ...(await G.upsertDiscoveredRepos(
          tx,
          msg.user_id,
          installation.id,
          repos.map((r) => ({ id: r.id, full_name: r.full_name, owner_id: r.owner.id, private: r.private, fork: r.fork, default_branch: r.default_branch, pushed_at: r.pushed_at })),
        )),
      );
    }
    await G.updateSyncJob(tx, msg.job_id, { stage: "classify", reposTotal: toClassify.length });
    await G.advance(tx, msg.job_id, toClassify.map((repoId) => ({ stage: "classify", user_id: msg.user_id, job_id: msg.job_id, repo_id: repoId })));
    await G.advance(tx, undefined, [{ stage: "prs", user_id: msg.user_id }]);
  },

  /** Owned, collaborator, fork or template, from the repository's own metadata. */
  async classify(ctx, msg) {
    const { tx, github } = ctx;
    const [repo] = await tx<{ installation_id: string }[]>`select installation_id::text from work.github_user_repos where user_id = ${msg.user_id} and repo_id = ${msg.repo_id}`;
    const next: G.Stage[] = [];
    if (repo) {
      const token = await github.installationToken(Number(repo.installation_id));
      github.ensureBudget(token);
      try {
        const { data } = await github.request<RepoDetail>(token, `/repositories/${msg.repo_id}`);
        await G.classifyRepo(tx, msg.user_id, msg.repo_id, {
          owner_id: data.owner.id,
          fork: data.fork,
          parent_full_name: data.parent?.full_name ?? null,
          template_full_name: data.template_repository?.full_name ?? null,
        });
        const { data: languages } = await github.request<Record<string, number>>(token, `/repositories/${msg.repo_id}/languages`);
        const upstream = data.parent?.full_name ?? data.template_repository?.full_name ?? null;
        const blobs = upstream ? await upstreamBlobs(ctx, token, upstream) : null;
        await G.setRepoDetails(tx, msg.repo_id, Object.keys(languages ?? {}), blobs);
        next.push({ stage: "harvest", user_id: msg.user_id, job_id: msg.job_id, repo_id: msg.repo_id });
      } catch (error) {
        if (!(error instanceof GitHubError && error.status === 404)) throw error;
      }
    }
    await G.updateSyncJob(tx, msg.job_id, { reposDone: 1 });
    await G.advance(tx, msg.job_id, next);
  },

  /** The student's own commits on the default branch: newest 500, kept only where GitHub's author.id is theirs. */
  async harvest(ctx, msg) {
    const { tx, github } = ctx;
    const repo = await G.repoFor(tx, msg.user_id, msg.repo_id);
    if (!repo || repo.excluded || !repo.kind) {
      await G.advance(tx, msg.job_id, []);
      return;
    }
    const token = await github.installationToken(Number(repo.installation_id));
    github.ensureBudget(token);
    const branch = repo.default_branch ? `&sha=${encodeURIComponent(repo.default_branch)}` : "";
    let listed: ListedCommit[] = [];
    try {
      listed = await github.paginate<ListedCommit[], ListedCommit>(
        token,
        `/repositories/${msg.repo_id}/commits?author=${encodeURIComponent(repo.login)}${branch}&per_page=100`,
        (page) => page,
        MAX_COMMITS / 100,
      );
    } catch (error) {
      if (!(error instanceof GitHubError && (error.status === 409 || error.status === 404))) throw error;
    }
    const own = listed.filter((c) => c.author?.id === Number(repo.github_id));
    const agents = await loadAgents(ctx);
    if (agents.length) {
      const checked = await G.agentPrsChecked(tx, msg.user_id, msg.repo_id, false);
      const since = checked ? checked.getTime() : 0;
      let pulls: PullDetail[] = [];
      try {
        ({ data: pulls } = await github.request<PullDetail[]>(token, `/repositories/${msg.repo_id}/pulls?state=closed&sort=updated&direction=desc&per_page=${MAX_AGENT_PRS}`));
      } catch (error) {
        if (!(error instanceof GitHubError && (error.status === 404 || error.status === 409))) throw error;
      }
      for (const pr of pulls) {
        if (pr.user?.id !== Number(repo.github_id) || !pr.merged_at || Date.parse(pr.merged_at) < since) continue;
        await recordAgentPr(ctx, token, msg.user_id, msg.repo_id, pr, agents);
      }
      await G.agentPrsChecked(tx, msg.user_id, msg.repo_id, true);
    }
    await G.setLinguistExcludes(tx, msg.repo_id, await linguistExcludes(ctx, token, msg.repo_id));
    const shas = await G.harvestCommits(
      tx,
      msg.user_id,
      msg.repo_id,
      own.map((c) => ({ sha: c.sha, authored_at: c.commit.author?.date ?? null, committed_at: c.commit.committer?.date ?? null, parents: c.parents.length, signed: c.commit.verification?.verified === true })),
      listed.length < MAX_COMMITS,
    );
    await afterEvidence(ctx, msg.user_id);
    const batches: G.Stage[] = [];
    for (let i = 0; i < shas.length; i += EXTRACT_BATCH) batches.push({ stage: "extract", user_id: msg.user_id, job_id: msg.job_id, repo_id: msg.repo_id, shas: shas.slice(i, i + EXTRACT_BATCH) });
    await G.advance(tx, msg.job_id, batches, 0, "extract");
  },

  /** Each commit's files through the taxonomy's detectors, then the levels. Pushed commits arrive with the push time. */
  async extract(ctx, msg) {
    const { tx, github } = ctx;
    const repo = await G.repoFor(tx, msg.user_id, msg.repo_id);
    if (!repo || repo.excluded) {
      await G.advance(tx, msg.job_id, []);
      return;
    }
    const token = await github.installationToken(Number(repo.installation_id));
    github.ensureBudget(token);
    const taxonomy = await loadTaxonomy(ctx);
    const excludeGlobs = repo.linguist_excludes.map(globToRegExp);
    const upstream = new Set((await tx<{ blob_sha: string }[]>`select blob_sha from work.github_upstream_blobs where repo_id = ${msg.repo_id}`).map((r) => r.blob_sha));
    const agents = await loadAgents(ctx);
    const agentShas = new Map((await G.agentCommitShas(tx, msg.user_id, msg.repo_id)).map((r) => [r.sha, r]));
    let recorded = 0;
    for (const sha of msg.shas) {
      if (!/^[0-9a-f]{40}$/.test(sha)) continue;
      let commit: CommitDetail;
      try {
        ({ data: commit } = await github.request<CommitDetail>(token, `/repositories/${msg.repo_id}/commits/${sha}`));
      } catch (error) {
        if (error instanceof GitHubError && (error.status === 404 || error.status === 422)) continue;
        throw error;
      }
      const viaAgent = agentShas.get(sha);
      const isAgent = !!viaAgent && agentAuthor(commit, agents) === viaAgent.ai_agent;
      if (commit.author?.id !== Number(repo.github_id) && !isAgent) continue;
      const allFiles = changedFiles(commit.files);
      const files = allFiles.filter((f) => !(f.sha && upstream.has(f.sha)));
      const parents = commit.parents?.length ?? 1;
      const analysis = analyseCommit(files, taxonomy.compiled, { excludeGlobs });
      const excluded = parents > 1 ? "merge" : isBulkImport(parents, allFiles) ? "bulk_import" : analysis.excluded;
      const isNew = await G.recordCommit(tx, msg.user_id, msg.repo_id, {
        sha,
        authored_at: commit.commit.author?.date ?? null,
        committed_at: commit.commit.committer?.date ?? null,
        pushed_at: msg.pushed_at ?? null,
        seen_via: msg.pushed_at ? "push" : "harvest",
        signed: commit.commit.verification?.verified === true,
        ai_agent: isAgent ? viaAgent!.ai_agent : null,
        via_pr: isAgent ? viaAgent!.via_pr : null,
        files: allFiles.length,
        meaningful_lines: excluded ? 0 : analysis.meaningfulLines,
        excluded: excluded ?? null,
        detections: excluded === "merge" ? [] : analysis.detections.map((d) => ({ skill: d.skillId, kind: d.kind, path: d.path, lines: d.lines })),
        blobs: excluded ? [] : duplicateCandidates(files, { excludeGlobs }),
      });
      if (isNew) recorded++;
    }
    await afterEvidence(ctx, msg.user_id);
    await G.advance(tx, msg.job_id, [], recorded);
  },

  /** A code check's snippet: a run of the student's own added lines in one of their counted commits for the skill. */
  async code_check(ctx, msg) {
    const { tx, github } = ctx;
    const random = ctx.random ?? Math.random;
    const limits = await CC.codeCheckLimits(tx);
    const candidates = await CC.codeCheckCandidates(tx, msg.check_id);
    for (const c of candidates) {
      const token = await github.installationToken(Number(c.installation_id));
      github.ensureBudget(token);
      let commit: CommitDetail;
      try {
        ({ data: commit } = await github.request<CommitDetail>(token, `/repositories/${c.repo_id}/commits/${c.sha}`));
      } catch (error) {
        if (error instanceof GitHubError && [403, 404, 409, 422].includes(error.status)) continue;
        throw error;
      }
      const files = changedFiles(commit.files).filter((f) => c.paths.includes(f.path) && f.patch);
      for (const file of files.sort(() => random() - 0.5)) {
        const window = pickWindow(addedRuns(file.patch), limits.min_lines, limits.max_lines, random);
        if (!window) continue;
        await CC.codeCheckPrepared(tx, msg.check_id, Number(c.repo_id), c.sha, file.path, window.start, window.end);
        return;
      }
    }
    await CC.codeCheckUnavailable(tx, msg.check_id, "none of your commits for this skill has a long enough run of your own code yet");
  },

  /** The student's merged pull requests (for L3): one search, then one `pr` stage per pull request not seen before. */
  async prs(ctx, msg) {
    const { tx, github } = ctx;
    const [account] = await tx<{ github_id: string; login: string }[]>`select github_id::text, login from work.github_accounts where user_id = ${msg.user_id} and revoked_at is null`;
    if (!account) return;
    const token = await userToken(ctx, msg.user_id);
    github.ensureBudget(token);
    const q = encodeURIComponent(`type:pr is:merged author:${account.login}`);
    const { data } = await github.request<SearchIssues>(token, `/search/issues?q=${q}&sort=updated&order=desc&per_page=${MAX_PRS}`);
    const known = new Set((await G.knownPullRequests(tx, msg.user_id)).map((r) => `${r.repo_full_name}#${r.number}`));
    const next: G.Stage[] = [];
    for (const item of data.items ?? []) {
      const repo = repoFromUrl(item.repository_url);
      if (!repo || !item.pull_request || item.user?.id !== Number(account.github_id)) continue;
      if (known.has(`${repo.toLowerCase()}#${item.number}`)) continue;
      next.push({ stage: "pr", user_id: msg.user_id, repo, number: item.number });
    }
    await G.advance(tx, undefined, next);
  },

  /** One merged pull request: in someone else's repository, merged or approved by another person (account 90+ days old). */
  async pr(ctx, msg) {
    const { tx, github } = ctx;
    if (!isRepoName(msg.repo) || !Number.isInteger(msg.number) || msg.number < 1) return;
    const [account] = await tx<{ github_id: string }[]>`select github_id::text from work.github_accounts where user_id = ${msg.user_id} and revoked_at is null`;
    if (!account) return;
    const me = Number(account.github_id);
    const token = await userToken(ctx, msg.user_id);
    github.ensureBudget(token);
    let pr: PullDetail;
    try {
      ({ data: pr } = await github.request<PullDetail>(token, `/repos/${msg.repo}/pulls/${msg.number}`));
    } catch (error) {
      if (error instanceof GitHubError && (error.status === 404 || error.status === 403)) return;
      throw error;
    }
    if (pr.user?.id !== me || !pr.merged_at) return;
    const repo = pr.base.repo;
    const shared = await G.sharedRepoId(tx, msg.user_id, repo.id);
    if (shared) {
      const row = await G.repoFor(tx, msg.user_id, shared);
      if (row && !row.excluded) {
        const installation = await github.installationToken(Number(row.installation_id));
        github.ensureBudget(installation);
        const found = await recordAgentPr(ctx, installation, msg.user_id, repo.id, pr, await loadAgents(ctx));
        if (found) {
          const pending = await tx<{ sha: string }[]>`
            select sha from work.github_commits where user_id = ${msg.user_id} and repo_id = ${repo.id} and extracted_at is null and via_pr = ${pr.number}`;
          const shas = pending.map((p) => p.sha);
          const batches: G.Stage[] = [];
          for (let i = 0; i < shas.length; i += EXTRACT_BATCH) batches.push({ stage: "extract", user_id: msg.user_id, repo_id: repo.id, shas: shas.slice(i, i + EXTRACT_BATCH) });
          await G.advance(tx, undefined, batches);
        }
      }
    }
    const record = {
      repo_github_id: repo.id,
      number: pr.number,
      pr_github_id: pr.id,
      repo_full_name: repo.full_name,
      repo_private: repo.private,
      merged_at: pr.merged_at,
      approver_github_id: null as number | null,
      exclusion: null as string | null,
      files: 0,
      skills: [] as { skill_id: string; path: string }[],
    };
    if (repo.owner.id === me) {
      record.exclusion = "own_repo";
    } else {
      const candidates: GitHubUser[] = [];
      if (isHuman(pr.merged_by) && pr.merged_by.id !== me) candidates.push(pr.merged_by);
      const reviews = await github.paginate<Review[], Review>(token, `/repos/${msg.repo}/pulls/${msg.number}/reviews?per_page=100`, (p) => p, 3);
      for (const r of reviews)
        if (r.state === "APPROVED" && isHuman(r.user) && r.user.id !== me && !candidates.some((c) => c.id === r.user!.id)) candidates.push(r.user);
      const cutoff = Date.parse(pr.merged_at) - APPROVER_MIN_AGE_DAYS * 86_400_000;
      for (const c of candidates) {
        const { data: user } = await github.request<{ id: number; created_at: string }>(token, `/users/${encodeURIComponent(c.login)}`);
        if (user.id === c.id && Date.parse(user.created_at) <= cutoff) {
          record.approver_github_id = c.id;
          break;
        }
      }
      if (!record.approver_github_id) record.exclusion = candidates.length ? "young_account" : "no_other_human";
    }
    if (!record.exclusion) {
      const files = await github.paginate<GitHubFile[], GitHubFile>(token, `/repos/${msg.repo}/pulls/${msg.number}/files?per_page=100`, (p) => p, 2);
      const taxonomy = await loadTaxonomy(ctx);
      const changed = changedFiles(files);
      record.files = changed.length;
      record.skills = analyseCommit(changed, taxonomy.compiled).detections.map((d) => ({ skill_id: d.skillId, path: d.path }));
    }
    await recordPullRequest(tx, msg.user_id, record);
  },

  /** Installation changes are applied; affected students get a fresh discovery; pushes and pull requests queue work. */
  async webhook(ctx, msg) {
    const { discover, next } = await G.processWebhook(ctx.tx, msg.delivery_id);
    for (const userId of discover) await G.startSync(ctx.tx, userId, "webhook");
    await G.advance(ctx.tx, undefined, next);
  },

  /** Revoke at GitHub, then forget the tokens. */
  async revoke(ctx, msg) {
    const row = await G.revocation(ctx.tx, ctx.tokenKey, msg.revocation_id);
    if (row?.access) {
      const revoked = await revokeGrant(ctx.cfg, ctx.fetchImpl, row.access);
      if (!revoked && row.refresh) {
        const fresh = await refreshUserToken(ctx.cfg, ctx.fetchImpl, row.refresh, ctx.now()).catch(() => null);
        if (fresh) await revokeGrant(ctx.cfg, ctx.fetchImpl, fresh.accessToken);
      }
    }
    await G.finishRevocation(ctx.tx, msg.revocation_id);
  },
};
