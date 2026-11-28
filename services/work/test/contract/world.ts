/**
 * The contract world for work: messaging's world (identity, people, content, messaging, realtime, each under its
 * own role) plus work's schema, a fake GitHub (fake-github.ts) and the GitHub App's secrets, generated for the
 * run (never stored): an RSA key for the App JWT, a client secret, the token key. Work's background jobs are
 * off; tests run the copies consumers with `drain` and the job queue with `runJobs`.
 */
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { join } from "node:path";
import { createWorker } from "@skilient/platform";
import type { TransportOptions } from "@skilient/testing";
import type postgres from "postgres";
import { drainCopies as drainMessaging, messagingWorld, type MessagingWorld } from "../../../messaging/test/contract/world";
import { workJobs } from "../../src/jobs";
import { copiesConsumer, COPIES_CONSUMER, COPY_EVENTS } from "../../src/store/copies";
import { APP_ID, FakeGithub } from "./fake-github";

export const MIGRATIONS = join(import.meta.dirname, "../../migrations");
export { connect, NU, NUTECH, student, stopWorlds } from "../../../messaging/test/contract/world";

export interface WorkWorld extends MessagingWorld {
  work: postgres.Sql;
  github: FakeGithub;
  tokenKey: Buffer;
}

const secrets = {
  privateKey: generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  clientSecret: randomBytes(16).toString("hex"),
  tokenKey: randomBytes(32),
};

export function workWorld(onWorld: (w: WorkWorld) => void, worlds: WorkWorld[] = []): () => Promise<TransportOptions> {
  process.env["WORK_JOBS"] = "off";
  process.env["WORK_GITHUB_APP_ID"] = APP_ID;
  process.env["WORK_GITHUB_CLIENT_ID"] = "Iv1.fake";
  let base: MessagingWorld | undefined;
  const start = messagingWorld((w) => (base = w), []);
  return async () => {
    const github = new FakeGithub();
    await github.start();
    process.env["WORK_GITHUB_API_URL"] = github.url;
    process.env["WORK_GITHUB_WEB_URL"] = github.url;
    const o = await start();
    const work = await base!.pg.service("work", MIGRATIONS);
    const w: WorkWorld = { ...base!, work, github, tokenKey: secrets.tokenKey };
    const stop = w.pg.stop.bind(w.pg);
    w.pg.stop = async () => {
      await github.stop();
      await stop();
    };
    worlds.push(w);
    onWorld(w);
    const db = o.database!;
    return {
      ...o,
      secrets: {
        ...o.secrets,
        "github-app-private-key": secrets.privateKey,
        "github-app-client-secret": secrets.clientSecret,
        "work-github-token-key": secrets.tokenKey.toString("base64url"),
      },
      database: (s: string) => (s === "work" ? work : db(s)),
    };
  };
}

/** Runs every copies consumer (content's, messaging's, work's) until each has read everything it handles. */
export async function drainCopies(w: WorkWorld): Promise<void> {
  await drainMessaging(w);
  const c = copiesConsumer({ sql: w.work });
  for (let i = 0; i < 100; i++) {
    const [pending] = await w.work`
      select count(*)::int as n from platform.events e
       where e.type = any(${[...COPY_EVENTS]}::text[])
         and not exists (select 1 from platform.applied_events a where a.consumer = ${COPIES_CONSUMER} and a.event_id = e.id)`;
    if (pending!.n === 0) return drainMessaging(w);
    await c.runOnce();
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error("work's copies consumer did not catch up");
}

/** Runs work's queued jobs (the harvest stages and anything else queued) until none is left. */
export async function runJobs(w: WorkWorld, rounds = 50): Promise<number> {
  const worker = createWorker({
    sql: w.work,
    workerId: "test",
    handlers: workJobs({
      logger: { info: () => {}, warn: () => {}, error: () => {} } as never,
      harvest: {
        cfg: { appId: APP_ID, clientId: "Iv1.fake", clientSecret: secrets.clientSecret, privateKey: secrets.privateKey, apiUrl: w.github.url, webUrl: w.github.url },
        tokenKey: secrets.tokenKey,
      },
    }),
    backoffMs: () => 0,
  });
  let total = 0;
  for (let i = 0; i < rounds; i++) {
    const n = await worker.runOnce();
    total += n;
    if (n === 0) {
      const [q] = await w.work<{ n: number }[]>`select count(*)::int as n from platform.jobs where status = 'queued' and run_at <= now()`;
      if (q!.n === 0) return total;
    }
  }
  return total;
}

/** work's copy of ranking's tiers (compute_paths' seniors), for ranking's hand-off tests (W6). */
export const rankingTiersOf = (w: WorkWorld, userIds: string[]) =>
  w.work<{ tier: string; ranked: boolean }[]>`select tier, ranked from work.ranking_tiers where user_id = any(${userIds}::uuid[]) order by user_id`.then((r) => [...r]);

/** work's copy of ranking's ring and swap flags (the peer-review check), for ranking's hand-off tests (W6). */
export const rankingFlagsOf = (w: WorkWorld, members: string[]) =>
  w.work<{ flag_id: string; status: string }[]>`select flag_id::text, status from work.ranking_flags where members @> ${members}::uuid[] order by flag_id`.then((r) => [...r]);

/** Gives a student a skill at a level (work's own rows), for the owners' hand-off tests (W8 credentials). */
export const giveSkill = (w: WorkWorld, userId: string, skillId: string, level: number, repos = 0, activeDays = 0) =>
  w.work`insert into work.user_skills (user_id, skill_id, level, repos, active_days) values (${userId}, ${skillId}, ${level}, ${repos}, ${activeDays})`.then(() => undefined);

/** Moves a swap session into the past so it can be confirmed (W8 credentials' Taught entry). */
export const pastSwapSession = (w: WorkWorld, sessionId: string) =>
  w.work`update work.swap_sessions set starts_at = now() - interval '2 hours' where id = ${sessionId}`.then(() => undefined);
