import type postgres from "postgres";
import { afterAll, beforeAll, describe, it } from "vitest";
import type { TestDatabase } from "@skilient/testing/postgres";
import { eventClosed, S } from "../../src/store/issuing";
import { apart, closedEvent, F, facts, issue, job, replay, sealPending, startWorld } from "./replay";

let pg: TestDatabase;
let sql: postgres.Sql;
beforeAll(async () => ({ pg, sql } = await startWorld()));
afterAll(async () => pg?.stop());

const term = (id: string, user: string, role: string, by: string, start: string, end: string) => ({
  term_id: id,
  society_id: F.SOC,
  user_id: user,
  role,
  status: "confirmed",
  term_start: start,
  term_end: end,
  confirmed_by: by,
  self_confirmed: by === user,
});

describe("credentials goldens replayed: issuing", () => {
  const G = "issuing";

  it("event", () =>
    replay(sql, G, "event", async (tx) => {
      const out: Record<string, unknown> = {};
      out["unverified"] = await job(tx, async (sp) => {
        await issue(sp, "event.closed", "svc_community", await closedEvent(sp, F.EVENT_PENDING));
        return null;
      });
      out["issued"] = await job(tx, async (sp) => {
        await issue(sp, "event.closed", "svc_community", await closedEvent(sp));
        return null;
      });
      out["again"] = await job(tx, async (sp) => ({ issue_event_record: await eventClosed(sp, S.closed.parse(await closedEvent(sp)), facts()) }));
      await apart(tx);
      out["sealed"] = await job(tx, (sp) => sealPending(sp));
      return out;
    }));

  it("term", () =>
    replay(sql, G, "term", async (tx) => {
      const out: Record<string, unknown> = {};
      const [d] = await tx<{ a: string; b: string; c: string; e: string; f: string }[]>`
        select (current_date - 400)::text as a, (current_date - 35)::text as b, (current_date - 300)::text as c, (current_date - 30)::text as e, (current_date - 60)::text as f`;
      out["confirmed"] = await job(tx, async (sp) => {
        await issue(sp, "society.term_changed", "svc_community", term(F.TERM_OSMAN, F.OSMAN, "officer", F.PRIYA, d!.c, d!.e));
        return null;
      });
      out["self_confirmed"] = await job(tx, async (sp) => {
        await issue(sp, "society.term_changed", "svc_community", term(F.TERM_PRIYA, F.PRIYA, "president", F.PRIYA, d!.a, d!.b));
        return null;
      });
      out["pending_society"] = await job(tx, async (sp) => {
        await issue(sp, "society.term_changed", "svc_community", { ...term(crypto.randomUUID(), F.NIDA, "president", F.NIDA, d!.f, d!.f), society_id: F.PENDING });
        return null;
      });
      out["sealed"] = await job(tx, (sp) => sealPending(sp));
      return out;
    }));

  it("skilient", () =>
    replay(sql, G, "skilient", async (tx) => {
      const out: Record<string, unknown> = {};
      const [t] = await tx<{ done: string; today: string; ago: string; now: string }[]>`
        select (now() - interval '1 day')::text as done, (now() at time zone 'Asia/Karachi')::date::text as today, (current_date - 3)::text as ago, now()::text as now`;
      out["venture"] = await job(tx, async (sp) => {
        await issue(sp, "venture.completed", "svc_work", {
          venture_id: F.VENTURE,
          owner_id: F.SAMI,
          completion: {
            completed_at: new Date(t!.done).toISOString(),
            team_size: 2,
            members: [
              { user_id: F.NIDA, github_days: 0, verified_entries: 0 },
              { user_id: F.SAMI, github_days: 3, verified_entries: 0 },
            ],
          },
        });
        return null;
      });
      out["task"] = await job(tx, async (sp) => {
        await issue(
          sp,
          "task.completed",
          "svc_work",
          { user_id: F.SAMI, attempt_id: F.ATTEMPT, skill_id: F.SKILL_ID, skill_label: F.SKILL_NAME, task_title: F.TASK_TITLE, verified_by: "peer" },
          new Date(t!.now).toISOString(),
        );
        const [r] = await sp<{ id: string }[]>`select id::text from credentials.record_entries where source_id = ${F.ATTEMPT}`;
        return { id: r!.id };
      });
      out["taught"] = await job(tx, async (sp) => {
        await issue(sp, "swap.closed", "svc_work", {
          swap_id: F.SWAP,
          teacher_id: F.SAMI,
          learner_id: F.NIDA,
          skill_id: F.SKILL_ID,
          skill_label: F.SKILL_NAME,
          sessions: 2,
          minutes: 90,
          last_session_on: t!.ago,
        });
        const [r] = await sp<{ id: string }[]>`select id::text from credentials.record_entries where source_id = ${F.SWAP}`;
        return { id: r!.id };
      });
      out["sealed"] = await job(tx, (sp) => sealPending(sp));
      return out;
    }));
});
