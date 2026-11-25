/**
 * Golden replays of shell.json: tours, tips and UI state, and the shell reads (nav badges, to-dos, the
 * checklist and the next step). Rule 4 (replay.ts): what other services own is published into people's
 * copies as its owner will publish it, from the values recorded beside the output: notify's unread count
 * (the recorded badge), ranking's next tier and formula points (`inputs`).
 */
import type { TestDatabase } from "@skilient/testing/postgres";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, it } from "vitest";
import { gettingStarted, navBadges, nextBestAction, todoCounts } from "../../src/domain/shell";
import { learnState, restartTour, saveTour, seeTip, setUiState, tourState } from "../../src/store/learn";
import { shellInputs } from "../../src/store/shell";
import { ALI, asOwner, BINA, call, CHAND, NEWBIE, recorded, replay, startWorld, step } from "./replay";

let pg: TestDatabase;
let sql: postgres.Sql;
beforeAll(async () => ({ pg, sql } = await startWorld()));
afterAll(async () => pg?.stop());

/**
 * The recorder passed each value as a postgres.js parameter cast to jsonb, which postgres.js serialises as
 * JSON, so the stack received (and stored) the JSON text of the recorder's string: `"true"`, `"\"2026-11-25\""`.
 * The replay hands people exactly what the stack received.
 */
const received = (recorderText: string) => JSON.stringify(recorderText);

describe("shell.json", () => {
  it("learn", () =>
    replay(sql, "shell", "learn", async (tx) => ({
      tour_fresh: await call(tx, (sp) => tourState(sp, ALI, "student")),
      save_progress: await step(tx, (sp) => saveTour(sp, ALI, "student", 3, "progress")),
      tour_after_progress: await call(tx, (sp) => tourState(sp, ALI, "student")),
      save_completed: await step(tx, (sp) => saveTour(sp, ALI, "student", 9, "completed")),
      save_after_completed: await step(tx, (sp) => saveTour(sp, ALI, "student", 2, "skipped")),
      tour_after: await call(tx, (sp) => tourState(sp, ALI, "student")),
      save_unknown_tour: await call(tx, (sp) => saveTour(sp, ALI, "golden", 1, "progress")),
      save_unknown_outcome: await call(tx, (sp) => saveTour(sp, ALI, "student", 1, "maybe")),
      save_bad_step: await call(tx, (sp) => saveTour(sp, ALI, "student", 51, "progress")),
      save_not_onboarded: await call(tx, (sp) => saveTour(sp, NEWBIE, "student", 1, "progress")),
      restart: await step(tx, (sp) => restartTour(sp, ALI, "student")),
      restart_unknown: await step(tx, (sp) => restartTour(sp, ALI, "golden")),
      tour_signed_out: await call(tx, (sp) => tourState(sp, null, "student"), "tour_state"),
      tour_not_onboarded: await call(tx, (sp) => tourState(sp, NEWBIE, "student")),
      tip: await step(tx, (sp) => seeTip(sp, ALI, "cv")),
      tip_again: await step(tx, (sp) => seeTip(sp, ALI, "cv")),
      tip_unknown: await call(tx, (sp) => seeTip(sp, ALI, "golden")),
      tip_signed_out: await call(tx, (sp) => seeTip(sp, null, "cv"), "see_tip"),
      ui: await step(tx, (sp) => setUiState(sp, ALI, "checklist_dismissed", received("true"))),
      ui_replace: await step(tx, (sp) => setUiState(sp, ALI, "checklist_dismissed", received("false"))),
      ui_date: await step(tx, (sp) => setUiState(sp, ALI, "progress_card_dismissed_on", received('"2026-11-25"'))),
      ui_unknown_key: await call(tx, (sp) => setUiState(sp, ALI, "golden", received("true"))),
      ui_too_long: await call(tx, (sp) => setUiState(sp, ALI, "checklist_dismissed", received(JSON.stringify("x".repeat(100))))),
      ui_null: await call(tx, (sp) => setUiState(sp, ALI, "checklist_dismissed", null)),
      ui_not_onboarded: await call(tx, (sp) => setUiState(sp, NEWBIE, "checklist_dismissed", received("true"))),
      ui_read_own: await call(tx, async (sp) => (await learnState(sp, ALI, "student")).ui),
      ui_read_other: await call(tx, async (sp) => (await learnState(sp, BINA, "student")).ui),
      tips_read_own: await call(tx, async (sp) => (await learnState(sp, ALI, "student")).tips.map((tip_id) => ({ tip_id }))),
    })));

  it("shell_reads", () =>
    replay(sql, "shell", "shell_reads", async (tx) => {
      const rec = recorded("shell", "shell_reads") as Record<string, { nav_badges: { value: { notifications: number } }; inputs: { next_tier: { value: unknown }; formula_points: { value: unknown } } }>;
      await tx`insert into people.friend_requests (id, sender_id, receiver_id) values (gen_random_uuid(), ${BINA}, ${ALI}), (gen_random_uuid(), ${CHAND}, ${ALI})`;
      await tx`update people.profiles set bio = 'Builds robots', avatar_path = ${BINA + "/avatar.webp"} where user_id = ${BINA}`;
      const out: Record<string, unknown> = {};
      for (const [name, user] of [["ali", ALI], ["bina", BINA]] as const) {
        const r = rec[name]!;
        await asOwner(tx, "svc_notify", "badge.count_changed", { user_id: user, key: "notifications", count: r.nav_badges.value.notifications });
        await asOwner(tx, "svc_ranking", "fact.value_changed", { user_id: user, key: "tier.next", value: r.inputs.next_tier.value });
        await asOwner(tx, "svc_ranking", "fact.value_changed", { user_id: user, key: "tier.points", value: r.inputs.formula_points.value });
        out[name] = {
          nav_badges: await call(tx, async (sp) => navBadges(await shellInputs(sp, user))),
          todo_counts: await call(tx, async (sp) => todoCounts(await shellInputs(sp, user))),
          getting_started: await call(tx, async (sp) => gettingStarted(await shellInputs(sp, user))),
          next_best_action: await call(tx, async (sp) => nextBestAction(await shellInputs(sp, user))),
          // Recorded inputs, as ranking publishes them (rule 4).
          inputs: r.inputs,
        };
      }
      out["not_onboarded"] = await call(tx, (sp) => shellInputs(sp, NEWBIE));
      out["signed_out"] = await call(tx, (sp) => shellInputs(sp, null), "nav_badges");
      out["getting_started_signed_out"] = await call(tx, (sp) => shellInputs(sp, null), "getting_started");
      return out;
    }));
});
