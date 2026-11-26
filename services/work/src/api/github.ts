import { create } from "@bufbuild/protobuf";
import type { ServiceImpl } from "@connectrpc/connect";
import { rateLimit } from "@skilient/platform";
import * as W from "@skilient/contracts/work/v1/work_pb";
import { z } from "zod";
import type { ApiDeps } from "../deps";
import { exchangeCode, GitHub } from "../gh/client";
import { refused } from "../refusals";
import * as G from "../store/github";
import * as S from "../store/skills";
import { linkVentureRepo } from "../store/ventures";
import { iso, meOf, parse, Uuid, write } from "./util";

interface Installation {
  id: number;
  app_id: number;
  account: { id: number; login: string; type: string } | null;
  repository_selection: "all" | "selected";
}

/**
 * The GitHub connection: connect (the code exchange and the binding, as the github-link Edge Function did),
 * disconnect, resync, repository exclusions, the settings card, a venture's linked repository, and webhook
 * deliveries web verified.
 */
export function githubApi(deps: ApiDeps): Partial<ServiceImpl<typeof W.WorkService>> {
  const { sql } = deps;
  const need = (ctx: Parameters<typeof meOf>[0]) => {
    const me = meOf(ctx);
    if (!me) throw refused("not_signed_in");
    return me;
  };
  return {
    async connectGithub(req, ctx) {
      const me = need(ctx);
      const code = parse(z.string().regex(/^[A-Za-z0-9_-]{1,200}$/), req.code);
      const gh = deps.github;
      if (!gh) throw refused("github_unavailable");
      // start_github_link's checks: onboarded profile, 10 an hour; the ticket hop is gone (the user is the token's).
      await sql.begin(async (tx) => {
        const [m] = await tx`select 1 from work.members where user_id = ${me}`;
        if (!m) throw refused("not_signed_in");
        if (!(await rateLimit(tx, `github_link:${me}`, 10, 3_600))) throw refused("rate_limited");
      });
      let account: { id: number; login: string };
      let tokens: G.Tokens;
      let ours: G.InstallationInput[];
      try {
        tokens = await exchangeCode(gh.cfg, gh.fetch ?? fetch, code, Date.now());
        const github = new GitHub(gh.cfg, gh.fetch ?? fetch);
        ({ data: account } = await github.request<{ id: number; login: string }>(tokens.accessToken, "/user"));
        const installations = await github.paginate<{ installations: Installation[] }, Installation>(tokens.accessToken, "/user/installations?per_page=100", (p) => p.installations);
        ours = installations
          .filter((i) => String(i.app_id) === gh.cfg.appId && i.account)
          .map((i) => ({
            id: i.id,
            account_id: i.account!.id,
            account_login: i.account!.login,
            account_type: i.account!.type === "Organization" ? "Organization" : "User",
            repository_selection: i.repository_selection === "all" ? "all" : "selected",
          }));
      } catch (error) {
        deps.logger.warn("github.link", { action: "github.connect", outcome: "failed", error_code: error instanceof Error ? error.message.slice(0, 80) : "unknown" });
        return create(W.ConnectGithubResponseSchema, { status: "failed" });
      }
      const status = await sql.begin((tx) => G.completeLink(tx, gh.tokenKey, me, { github_id: account.id, login: account.login }, tokens, ours));
      return create(W.ConnectGithubResponseSchema, { status });
    },
    async disconnectGithub(req, ctx) {
      return write(deps, ctx, W.DisconnectGithubRequestSchema, W.DisconnectGithubResponseSchema, req, async (tx) =>
        create(W.DisconnectGithubResponseSchema, { disconnected: await G.disconnectGithub(tx, meOf(ctx), deps.recompute) }),
      );
    },
    async requestGithubResync(req, ctx) {
      return write(deps, ctx, W.RequestGithubResyncRequestSchema, W.RequestGithubResyncResponseSchema, req, async (tx) =>
        create(W.RequestGithubResyncResponseSchema, { started: await G.requestResync(tx, meOf(ctx)) }),
      );
    },
    async setRepoExcluded(req, ctx) {
      const me = need(ctx);
      const repo = Number(parse(z.bigint().min(1n), req.repoId));
      return write(deps, ctx, W.SetRepoExcludedRequestSchema, W.SetRepoExcludedResponseSchema, req, async (tx) => {
        if (!(await G.setRepoExcluded(tx, me, repo, req.excluded, deps.recompute))) throw refused("repo_not_found");
        return create(W.SetRepoExcludedResponseSchema, {});
      });
    },
    async githubOverview(req, ctx) {
      const me = need(ctx);
      const s = await G.githubState(sql, me);
      return create(W.GithubOverviewResponseSchema, {
        connected: !!s.account && !s.account.revoked_at,
        login: s.account?.login ?? "",
        connectedAt: iso(s.account?.connected_at),
        revokedAt: iso(s.account?.revoked_at),
        ...(s.sync
          ? {
              sync: {
                status: s.sync.status,
                stage: s.sync.stage ?? "",
                reposTotal: s.sync.repos_total,
                reposDone: s.sync.repos_done,
                commitsAnalysed: s.sync.commits_analysed,
                skillsFound: s.sync.skills_found,
                createdAt: iso(s.sync.created_at),
                finishedAt: iso(s.sync.finished_at),
              },
            }
          : {}),
        repos: req.withRepos
          ? s.repos.map((r) => ({ repoId: BigInt(r.repo_id), fullName: r.full_name, private: r.private, kind: r.kind ?? "", excluded: r.excluded, harvestedAt: iso(r.harvested_at) }))
          : [],
      });
    },
    async ownerRepos(_req, ctx) {
      const rows = await G.ownerRepos(sql, need(ctx));
      return create(W.OwnerReposResponseSchema, { repos: rows.map((r) => ({ repoId: BigInt(r.repo_id), fullName: r.full_name })) });
    },
    async linkVentureRepo(req, ctx) {
      const venture = parse(Uuid, req.ventureId);
      const repo = Number(parse(z.bigint().min(0n), req.repoId));
      return write(deps, ctx, W.LinkVentureRepoRequestSchema, W.LinkVentureRepoResponseSchema, req, async (tx) => {
        await linkVentureRepo(tx, meOf(ctx), venture, repo);
        return create(W.LinkVentureRepoResponseSchema, {});
      });
    },
    async recordGithubWebhook(req) {
      const delivery = parse(Uuid, req.deliveryId);
      const event = parse(z.string().regex(/^[a-z_]{1,60}$/), req.event);
      const action = req.action ? parse(z.string().regex(/^[a-z_]{1,60}$/), req.action) : null;
      const payload = parse(z.string().max(1_000_000), req.payloadJson);
      let body: unknown;
      try {
        body = JSON.parse(payload);
      } catch {
        throw refused("invalid_input");
      }
      if (!body || typeof body !== "object" || Array.isArray(body)) throw refused("invalid_input");
      const recorded = await sql.begin((tx) =>
        G.recordWebhook(tx, { delivery_id: delivery, event, action, installation_id: req.installationId > 0n ? Number(req.installationId) : null, payload: body }),
      );
      return create(W.RecordGithubWebhookResponseSchema, { recorded });
    },
  };
}

/** Skills: the reader's levels, the skill drawer, the taxonomy, and other people's levels. */
export function skillsApi(deps: ApiDeps): Partial<ServiceImpl<typeof W.WorkService>> {
  const { sql } = deps;
  const SkillId = z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/);
  return {
    async mySkills(_req, ctx) {
      const me = meOf(ctx);
      if (!me) throw refused("not_signed_in");
      const [rows, held, account] = await Promise.all([
        S.mySkills(sql, me),
        G.heldCount(sql, me),
        sql<{ login: string }[]>`select login from work.github_accounts where user_id = ${me}`,
      ]);
      return create(W.MySkillsResponseSchema, {
        skills: rows.map((r) => ({
          skillId: r.skill_id,
          level: r.level,
          activeDays: r.active_days,
          lines: r.lines,
          hits: r.hits,
          repos: r.repos,
          lastUsedAt: iso(r.last_used_at),
          aiLines: r.ai_lines,
          aiAssisted: r.ai_assisted,
          peerVerified: r.peer_verified,
        })),
        heldCommits: held,
        githubLogin: account[0]?.login ?? "",
      });
    },
    async skillEvidence(req, ctx) {
      const me = meOf(ctx);
      if (!me) throw refused("not_signed_in");
      const skill = parse(SkillId, req.skillId);
      const [ev, proofs] = await Promise.all([G.skillEvidence(sql, me, skill), S.mySkillProofs(sql, me, skill)]);
      return create(W.SkillEvidenceResponseSchema, {
        items: ev.items.map((i) => ({
          repoId: BigInt(i.repo_id),
          repoFullName: i.full_name ?? "",
          sha: i.sha,
          detectors: i.detectors,
          paths: i.paths,
          lines: i.lines,
          occurredAt: iso(i.occurred_at),
          status: i.status ?? "pending",
          exclusion: i.exclusion ?? "",
          signed: i.signed ?? false,
          aiAgent: i.ai_agent ?? "",
        })),
        total: ev.total,
        proofs: proofs.map((p) => ({
          kind: p.kind,
          level: p.level,
          title: p.title ?? "",
          detail: p.detail ?? "",
          url: p.url ?? "",
          ventureId: p.venture_id ?? "",
          endorserId: p.endorser_id ?? "",
          occurredAt: iso(p.occurred_at),
        })),
      });
    },
    async skillCatalogue(req) {
      const ids = parse(z.array(SkillId).max(500), req.skillIds);
      const rows = await S.skillNames(sql, ids.length ? ids : null);
      return create(W.SkillCatalogueResponseSchema, { skills: rows.map((r) => ({ id: r.id, name: r.name, category: r.category, parentId: r.parent_id ?? "" })) });
    },
    async skillsOf(req) {
      const ids = parse(z.array(Uuid).max(500), req.userIds);
      const rows = ids.length ? await S.skillsOf(sql, ids) : [];
      return create(W.SkillsOfResponseSchema, {
        skills: rows.map((r) => ({ userId: r.user_id, skillId: r.skill_id, level: r.level, peerVerified: r.peer_verified, aiAssisted: r.ai_assisted })),
      });
    },
  };
}
