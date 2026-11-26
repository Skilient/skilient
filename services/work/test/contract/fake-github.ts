/**
 * A scriptable GitHub for the contract world and journeys: an HTTP server the service reaches through
 * WORK_GITHUB_API_URL and WORK_GITHUB_WEB_URL. Each OAuth code belongs to one GitHub account; that account sees the
 * App's installation and the repositories the test puts there. Commits are listed for their author and served with
 * their files (patches) and contents. Shapes follow GitHub's REST API as the worker reads it (the old worker
 * test's fake, apps/web/tests/worker/github-worker.test.ts, scripted per test instead of fixed).
 */
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

export const APP_ID = "424242";

export interface FakeFile {
  filename: string;
  status?: string;
  additions: number;
  deletions?: number;
  patch: string;
  sha?: string;
  /** The file's content at the commit (served by /contents for code-check snippets). */
  content?: string;
}

export interface FakeCommit {
  sha: string;
  authorId: number;
  authorLogin: string;
  date: string;
  files: FakeFile[];
}

export interface FakeAccount {
  id: number;
  login: string;
  installation: number;
  repos: { id: number; full_name: string; owner_id: number; private?: boolean; languages?: Record<string, number> }[];
}

export class FakeGithub {
  private server: Server | undefined;
  url = "";
  readonly calls: string[] = [];
  /** OAuth code → account. */
  readonly codes = new Map<string, FakeAccount>();
  /** Access token → account. */
  private tokens = new Map<string, FakeAccount>();
  /** repo id → commits (newest first). */
  readonly commits = new Map<number, FakeCommit[]>();
  private counter = 0;

  /** A student's GitHub account, reachable by its code. */
  account(code: string, a: FakeAccount): FakeAccount {
    this.codes.set(code, a);
    return a;
  }

  commit(repoId: number, c: FakeCommit): void {
    this.commits.set(repoId, [c, ...(this.commits.get(repoId) ?? [])]);
  }

  async start(): Promise<void> {
    this.server = createServer((req, res) => {
      let raw = "";
      req.on("data", (d: Buffer) => (raw += d.toString()));
      req.on("end", () => {
        const url = new URL(req.url ?? "/", "http://fake");
        const method = req.method ?? "GET";
        this.calls.push(`${method} ${url.pathname}`);
        const reply = (body: unknown, status = 200) => {
          res.writeHead(status, { "content-type": "application/json", "x-ratelimit-remaining": "4999", "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 3600) });
          res.end(status === 204 ? "" : JSON.stringify(body));
        };
        try {
          this.route(method, url, raw ? (JSON.parse(raw) as Record<string, unknown>) : {}, String(req.headers.authorization ?? ""), reply);
        } catch (e) {
          reply({ message: String(e) }, 500);
        }
      });
    });
    await new Promise<void>((r) => this.server!.listen(0, "127.0.0.1", r));
    this.url = `http://127.0.0.1:${(this.server!.address() as AddressInfo).port}`;
  }

  async stop(): Promise<void> {
    await new Promise<void>((r) => (this.server ? this.server.close(() => r()) : r()));
  }

  private who(auth: string): FakeAccount | undefined {
    return this.tokens.get(auth.replace(/^(token|Bearer) /, ""));
  }

  private installationAccount(id: number): FakeAccount | undefined {
    return [...this.codes.values()].find((a) => a.installation === id);
  }

  private repo(id: number) {
    for (const a of this.codes.values()) {
      const r = a.repos.find((x) => x.id === id);
      if (r) return r;
    }
    return undefined;
  }

  private route(method: string, url: URL, body: Record<string, unknown>, auth: string, reply: (b: unknown, s?: number) => void): void {
    const p = url.pathname;
    if (method === "POST" && p === "/login/oauth/access_token") {
      const a = typeof body["code"] === "string" ? this.codes.get(body["code"]) : undefined;
      if (!a && body["grant_type"] !== "refresh_token") return reply({ error: "bad_verification_code" });
      const token = `gho_${++this.counter}`;
      if (a) this.tokens.set(token, a);
      return reply({ access_token: token, expires_in: 28_800, refresh_token: `ghr_${this.counter}`, refresh_token_expires_in: 15_811_200 });
    }
    if (method === "DELETE" && /^\/applications\/[^/]+\/grant$/.test(p)) return reply(null, 204);
    if (method === "GET" && p === "/user") {
      const a = this.who(auth);
      return a ? reply({ id: a.id, login: a.login }) : reply({ message: "Bad credentials" }, 401);
    }
    if (method === "GET" && p === "/user/installations") {
      const a = this.who(auth);
      if (!a) return reply({ message: "Bad credentials" }, 401);
      return reply({ installations: [{ id: a.installation, app_id: Number(APP_ID), account: { id: a.id, login: a.login, type: "User" }, repository_selection: "selected", suspended_at: null }] });
    }
    let m = /^\/user\/installations\/(\d+)\/repositories$/.exec(p);
    if (method === "GET" && m) {
      const a = this.installationAccount(Number(m[1]));
      return reply({
        repositories: (a?.repos ?? []).map((r) => ({ id: r.id, full_name: r.full_name, owner: { id: r.owner_id }, private: r.private ?? false, fork: false, default_branch: "main", pushed_at: new Date().toISOString() })),
      });
    }
    m = /^\/app\/installations\/(\d+)\/access_tokens$/.exec(p);
    if (method === "POST" && m) {
      const token = `ghs_${m[1]}`;
      const a = this.installationAccount(Number(m[1]));
      if (a) this.tokens.set(token, a);
      return reply({ token, expires_at: new Date(Date.now() + 3_600_000).toISOString() }, 201);
    }
    m = /^\/repositories\/(\d+)(?:\/(languages|commits|pulls|contents)(?:\/(.+))?)?$/.exec(p);
    if (method === "GET" && m) {
      const id = Number(m[1]);
      const r = this.repo(id);
      if (!r) return reply({ message: "Not Found" }, 404);
      if (!m[2]) return reply({ id, owner: { id: r.owner_id }, fork: false, template_repository: null });
      if (m[2] === "languages") return reply(r.languages ?? {});
      if (m[2] === "pulls") return reply([]);
      if (m[2] === "contents") {
        if (m[3] === ".gitattributes") return reply({ message: "Not Found" }, 404);
        const ref = url.searchParams.get("ref");
        const file = (this.commits.get(id) ?? []).find((c) => c.sha === ref)?.files.find((f) => f.filename === decodeURIComponent(m![3] ?? ""));
        return file?.content !== undefined ? reply({ encoding: "base64", content: Buffer.from(file.content).toString("base64") }) : reply({ message: "Not Found" }, 404);
      }
      const all = this.commits.get(id) ?? [];
      const shape = (c: FakeCommit) => ({
        sha: c.sha,
        author: { id: c.authorId, login: c.authorLogin, type: "User" },
        parents: [{ sha: "0".repeat(40) }],
        commit: { author: { date: c.date }, committer: { date: c.date }, verification: { verified: false } },
      });
      if (m[3]) {
        const c = all.find((x) => x.sha === m![3]);
        return c ? reply({ ...shape(c), files: c.files }) : reply({ message: "No commit" }, 422);
      }
      const author = url.searchParams.get("author");
      return reply(all.filter((c) => c.authorLogin === author).map(shape));
    }
    if (method === "GET" && p === "/search/issues") return reply({ total_count: 0, incomplete_results: false, items: [] });
    return reply({ message: `unexpected ${method} ${p}` }, 500);
  }
}

/** n lines of code for a patch, each an addition. */
export function patchOf(lines: string[]): string {
  return `@@ -0,0 +1,${lines.length} @@\n` + lines.map((l) => `+${l}`).join("\n");
}
