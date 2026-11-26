/**
 * Golden replays of ventures.json (packages/testing/test/work.golden.test.ts, "ventures").
 */
import type { TestDatabase } from "@skilient/testing/postgres";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, it } from "vitest";
import * as V from "../../src/store/ventures";
import { call, entry, MINA, OMAR, OPEN, replay, startWorld, step, ULA, ASAD, UNKNOWN_VENTURE, VENTURE, type Tx } from "./replay";

let pg: TestDatabase;
let sql: postgres.Sql;
beforeAll(async () => ({ pg, sql } = await startWorld()));
afterAll(async () => pg?.stop());

type Json = Record<string, unknown>;
/** create_venture's jsonb, read as the function read it (defaults and trims as there). */
function newVenture(p: Json): V.NewVenture {
  const s = (k: string) => (typeof p[k] === "string" ? (p[k] as string) : null);
  return {
    type: s("type") ?? "",
    title: s("title") ?? "",
    description: s("description") ?? "",
    visibility: s("visibility") ?? "public",
    stage: s("stage"),
    pitch_url: s("pitch_url") || null,
    affiliation: s("affiliation")?.trim() || null,
    skill_ids: (p["skill_ids"] as string[] | undefined) ?? [],
    team_size: (p["team_size"] as number | undefined) ?? 4,
    roles: ((p["roles"] as Json[] | undefined) ?? []).map((r) => ({ title: String(r["title"]), skill_ids: (r["skill_ids"] as string[] | undefined) ?? [], slots: (r["slots"] as number | undefined) ?? 1 })),
    questions: (p["questions"] as string[] | undefined) ?? [],
  };
}

const NEW_VENTURE = {
  type: "startup",
  title: "  Heron Labs ",
  description: "Tools for labs.",
  visibility: "public",
  stage: "prototype",
  pitch_url: "https://heron.example/pitch",
  affiliation: " Incubator ",
  skill_ids: ["react", "python", "react"],
  team_size: 5,
  roles: [{ title: " Backend ", skill_ids: ["python"], slots: 2 }],
  questions: [" Why us? "],
};

describe("ventures.json", () => {
  it("create_venture", () =>
    replay(sql, "ventures", "create_venture", async (tx) => {
      const out: Json = {};
      const make = (me: string | null, p: Json, fn?: string) => (fn ? call(tx, (sp) => V.createVenture(sp, me, newVenture(p)), fn) : step(tx, (sp) => V.createVenture(sp, me, newVenture(p))));
      const attempt = (p: Json) => call(tx, (sp) => V.createVenture(sp, ASAD, newVenture(p)));
      out["created"] = await make(ASAD, NEW_VENTURE);
      out["defaults"] = await make(ULA, { type: "project", title: "Plover Notes", description: "Shared notes." });
      out["too_many_roles"] = await attempt({ ...NEW_VENTURE, roles: Array(7).fill({ title: "Dev" }) });
      out["too_many_questions"] = await attempt({ ...NEW_VENTURE, questions: ["a?", "b?", "c?", "d?"] });
      out["unknown_skill"] = await attempt({ ...NEW_VENTURE, skill_ids: ["no-such-skill"] });
      out["project_with_stage"] = await attempt({ ...NEW_VENTURE, type: "project" });
      out["short_title"] = await attempt({ ...NEW_VENTURE, title: "ab" });
      out["signed_out"] = await make(null, NEW_VENTURE, "create_venture");
      return out;
    }));

  it("update_transition", () =>
    replay(sql, "ventures", "update_transition", async (tx) => {
      const out: Json = {};
      const upd = (me: string, v: string, p: V.VentureEdit) => (sp: Tx) => V.updateVenture(sp, me, v, p);
      const tr = (me: string, v: string, to: string) => (sp: Tx) => V.transitionVenture(sp, me, v, to);
      out["update"] = await step(tx, upd(OMAR, VENTURE, { title: " Heron Robotics 2 ", skill_ids: ["typescript"], team_size: 5 }));
      out["update_not_owner"] = await call(tx, upd(MINA, VENTURE, { title: "Mine now" }));
      out["update_unknown"] = await call(tx, upd(OMAR, UNKNOWN_VENTURE, { title: "Nope" }));
      out["recruiting_to_completed"] = await call(tx, tr(OMAR, VENTURE, "completed"));
      out["to_in_progress"] = await step(tx, tr(OMAR, VENTURE, "in_progress"));
      out["complete_no_deliverable"] = await call(tx, tr(OMAR, VENTURE, "completed"));
      await tx`insert into work.venture_deliverables (id, venture_id, label, url, added_by) values (gen_random_uuid(), ${VENTURE}, 'Repo', 'https://example.com/repo', ${OMAR})`;
      out["complete_unverified"] = await call(tx, tr(OMAR, VENTURE, "completed"));
      const a = await entry(tx, VENTURE, OMAR, "Built the arm", 30);
      const b = await entry(tx, VENTURE, MINA, "Wrote the firmware", 20);
      await tx`insert into work.contribution_confirmations (contribution_id, confirmer_id) values (${a}, ${MINA}), (${b}, ${OMAR})`;
      out["complete"] = await step(tx, tr(OMAR, VENTURE, "completed"));
      out["completed_to_abandoned"] = await call(tx, tr(OMAR, VENTURE, "abandoned"));
      out["update_completed"] = await call(tx, upd(OMAR, VENTURE, { title: "Too late" }));
      out["abandon_open"] = await step(tx, tr(MINA, OPEN, "abandoned"));
      return out;
    }));
});
