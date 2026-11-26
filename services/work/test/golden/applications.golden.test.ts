/**
 * Golden replays of applications.json and teams.json (packages/testing/test/work.golden.test.ts). Where today's
 * function returned SQL null for "nothing changed" (an update or delete that matched no row and `returning
 * true`), the port's false is read as that null.
 */
import type { TestDatabase } from "@skilient/testing/postgres";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, it } from "vitest";
import * as A from "../../src/store/applications";
import * as V from "../../src/store/ventures";
import { ASAD, BINA, block, call, GUL, MINA, OMAR, OPEN, replay, resolve, ROLE, startWorld, step, ULA, VENTURE, type Tx } from "./replay";

let pg: TestDatabase;
let sql: postgres.Sql;
beforeAll(async () => ({ pg, sql } = await startWorld()));
afterAll(async () => pg?.stop());

type Json = Record<string, unknown>;
const orNull = (b: boolean) => (b ? true : null);
const apply = (me: string | null, venture: string, role: string | null, message: string, answers: string[]) => (sp: Tx) => A.applyToVenture(sp, me, venture, role, message, answers);
const value = (o: unknown) => (o as { result?: { value: string }; value?: string }).result?.value ?? (o as { value: string }).value;
const missing = async () => [];

describe("applications.json", () => {
  it("apply", () =>
    replay(sql, "applications", "apply", async (tx) => {
      const out: Json = {};
      out["applied"] = await step(tx, apply(ASAD, VENTURE, ROLE, " I can help ", ["  A drone  "]));
      out["again"] = await call(tx, apply(ASAD, VENTURE, null, "Again", ["x"]));
      out["member"] = await call(tx, apply(MINA, VENTURE, null, "Me", ["x"]));
      out["other_university"] = await call(tx, apply(ULA, VENTURE, null, "Hi", ["x"]));
      out["graduate"] = await call(tx, apply(GUL, VENTURE, null, "Hi", ["x"]));
      out["wrong_answers"] = await call(tx, apply(BINA, VENTURE, null, "Hi", []));
      out["long_answer"] = await call(tx, apply(BINA, VENTURE, null, "Hi", ["x".repeat(501)]));
      out["unknown_role"] = await call(tx, apply(BINA, VENTURE, "9d000000-0000-4000-8000-0000000000ff", "Hi", ["x"]));
      out["public_no_questions"] = await step(tx, apply(ULA, OPEN, null, "Count me in", []));
      await tx`update work.venture_roles set filled = 1 where id = ${ROLE}`;
      out["role_filled"] = await call(tx, apply(BINA, VENTURE, ROLE, "Hi", ["x"]));
      await tx`update work.ventures set visibility = 'unlisted' where id = ${OPEN}`;
      out["unlisted"] = await call(tx, apply(BINA, OPEN, null, "Hi", []));
      await block(tx, OMAR, BINA);
      out["blocked_owner"] = await call(tx, apply(BINA, VENTURE, null, "Hi", ["x"]));
      out["signed_out"] = await call(tx, apply(null, VENTURE, null, "Hi", ["x"]), "apply_to_venture");
      return out;
    }));

  it("decide", () =>
    replay(sql, "applications", "decide", async (tx) => {
      const out: Json = {};
      const a = value(await call(tx, apply(ASAD, VENTURE, ROLE, "Pick me", ["Robots"])));
      const b = value(await call(tx, apply(BINA, VENTURE, null, "Me too", ["Apps"])));
      const c = value(await call(tx, apply(ULA, OPEN, null, "Hello", [])));
      const decide = (me: string, id: string, accept: boolean) => (sp: Tx) => A.decideApplication(sp, me, id, accept);
      const msg = (me: string, id: string, body: string) => (sp: Tx) => A.addApplicationMessage(sp, me, id, body);
      const seq = (s: { result: { ok: boolean; value?: unknown }; changes: unknown }) => ({ ...s, result: s.result.ok ? { ok: true, value: "string" } : s.result });
      out["message_candidate"] = seq(await step(tx, msg(ASAD, a, " When do we start? ")));
      out["message_owner"] = seq(await step(tx, msg(OMAR, a, "Monday")));
      out["message_outsider"] = await call(tx, msg(MINA, a, "Hi"));
      out["decide_not_owner"] = await call(tx, decide(MINA, a, true));
      out["accept"] = await step(tx, decide(OMAR, a, true));
      out["accept_again"] = await call(tx, decide(OMAR, a, true));
      out["message_after"] = await call(tx, msg(ASAD, a, "Thanks"));
      out["decline"] = await step(tx, decide(OMAR, b, false));
      out["withdraw"] = await step(tx, async (sp) => orNull(await A.withdrawApplication(sp, ULA, c)));
      out["withdraw_again"] = await call(tx, async (sp) => orNull(await A.withdrawApplication(sp, ULA, c)));
      out["decide_withdrawn"] = await call(tx, decide(MINA, c, true));
      out["decide_unknown"] = await call(tx, decide(OMAR, "9e000000-0000-4000-8000-0000000000ff", true));
      return out;
    }));

  it("invites", () =>
    replay(sql, "applications", "invites", async (tx) => {
      const out: Json = {};
      const invite = (me: string, v: string, name: string) => (sp: Tx) => A.inviteToVenture(sp, me, v, resolve(name));
      const respond = (me: string, id: string, accept: boolean) => (sp: Tx) => A.respondInvite(sp, me, id, accept);
      const i1 = await step(tx, invite(OMAR, VENTURE, " WK_ASAD "));
      out["invite"] = i1;
      out["again"] = await call(tx, invite(OMAR, VENTURE, "wk_asad"));
      out["member"] = await call(tx, invite(OMAR, VENTURE, "wk_mina"));
      out["other_university"] = await call(tx, invite(OMAR, VENTURE, "wk_ula"));
      out["unknown"] = await call(tx, invite(OMAR, VENTURE, "wk_nobody"));
      out["not_owner"] = await call(tx, invite(MINA, VENTURE, "wk_bina"));
      await call(tx, apply(ASAD, VENTURE, null, "Also applying", ["x"]));
      out["accept"] = await step(tx, respond(ASAD, value(i1), true));
      out["accept_again"] = await call(tx, respond(ASAD, value(i1), true));
      const i2 = value(await call(tx, invite(MINA, OPEN, "wk_ula")));
      out["respond_not_invitee"] = await call(tx, respond(BINA, i2, true));
      out["decline"] = await step(tx, respond(ULA, i2, false));
      const i3 = value(await call(tx, invite(MINA, OPEN, "wk_bina")));
      out["revoke_not_owner"] = await call(tx, (sp) => A.revokeInvite(sp, OMAR, i3));
      out["revoke"] = await step(tx, (sp) => A.revokeInvite(sp, MINA, i3));
      out["revoke_again"] = await call(tx, (sp) => A.revokeInvite(sp, MINA, i3));
      out["respond_revoked"] = await call(tx, respond(BINA, i3, true));
      await block(tx, BINA, MINA);
      out["blocked"] = await call(tx, invite(MINA, OPEN, "wk_bina"));
      return out;
    }));
});

describe("teams.json", () => {
  it("members", () =>
    replay(sql, "teams", "members", async (tx) => {
      const out: Json = {};
      out["owner_leaves"] = await call(tx, (sp) => V.leaveVenture(sp, OMAR, VENTURE));
      out["outsider_leaves"] = await call(tx, (sp) => V.leaveVenture(sp, ASAD, VENTURE));
      out["set_role"] = await step(tx, (sp) => V.setMemberRole(sp, OMAR, VENTURE, MINA, "designer"));
      out["set_role_not_member"] = await call(tx, (sp) => V.setMemberRole(sp, OMAR, VENTURE, ASAD, "designer"));
      out["set_role_not_owner"] = await call(tx, (sp) => V.setMemberRole(sp, MINA, VENTURE, OMAR, "other"));
      out["remove_owner"] = await call(tx, (sp) => V.removeVentureMember(sp, OMAR, VENTURE, OMAR));
      out["remove_not_member"] = await call(tx, (sp) => V.removeVentureMember(sp, OMAR, VENTURE, ASAD));
      out["transfer_not_member"] = await call(tx, (sp) => V.transferOwnership(sp, OMAR, VENTURE, ASAD));
      const a = value(await call(tx, apply(ASAD, VENTURE, null, "Hi", ["x"])));
      out["transfer"] = await step(tx, (sp) => V.transferOwnership(sp, OMAR, VENTURE, MINA));
      out["pending_follows_owner"] = await call(tx, async (sp) => [...(await sp`select owner_id from work.applications where id = ${a}`)]);
      out["old_owner_leaves"] = await step(tx, (sp) => V.leaveVenture(sp, OMAR, VENTURE));
      out["remove"] = await step(tx, (sp) => V.removeVentureMember(sp, MINA, OPEN, MINA));
      return out;
    }));

  it("roles_deliverables", () =>
    replay(sql, "teams", "roles_deliverables", async (tx) => {
      const out: Json = {};
      const save = (me: string, role: string | null, title: string, skills: string[], slots: number) => (sp: Tx) => V.saveVentureRole(sp, me, VENTURE, role, title, skills, slots);
      out["add_role"] = await step(tx, save(OMAR, null, " Backend ", ["typescript"], 2));
      out["edit_role"] = await step(tx, save(OMAR, ROLE, "Frontend dev", ["react", "typescript"], 2));
      out["edit_unknown_role"] = await call(tx, save(OMAR, "9d000000-0000-4000-8000-0000000000ff", "X1", [], 1));
      out["role_unknown_skill"] = await call(tx, save(OMAR, null, "QA", ["nope"], 1));
      out["role_not_owner"] = await call(tx, save(MINA, null, "QA", [], 1));
      for (const t of ["R3", "R4", "R5", "R6"]) await call(tx, save(OMAR, null, t, [], 1));
      out["seventh_role"] = await call(tx, save(OMAR, null, "R7", [], 1));
      out["delete_role"] = await step(tx, (sp) => V.deleteVentureRole(sp, OMAR, VENTURE, ROLE));
      out["questions"] = await step(tx, (sp) => V.setVentureQuestions(sp, OMAR, VENTURE, [" First? ", "Second?"]));
      out["four_questions"] = await call(tx, (sp) => V.setVentureQuestions(sp, OMAR, VENTURE, ["a1?", "b1?", "c1?", "d1?"]));
      const d1 = await step(tx, (sp) => V.addDeliverable(sp, MINA, VENTURE, " Repo ", " https://example.com/r "));
      out["deliverable_member"] = d1;
      out["deliverable_outsider"] = await call(tx, (sp) => V.addDeliverable(sp, ASAD, VENTURE, "Mine", "https://example.com/m"));
      out["deliverable_http"] = await call(tx, (sp) => V.addDeliverable(sp, OMAR, VENTURE, "Insecure", "http://example.com"));
      out["remove_deliverable_outsider"] = await call(tx, (sp) => V.removeDeliverable(sp, ASAD, value(d1)));
      out["remove_deliverable_owner"] = await step(tx, (sp) => V.removeDeliverable(sp, OMAR, value(d1)));
      out["remove_deliverable_gone"] = await call(tx, (sp) => V.removeDeliverable(sp, OMAR, value(d1)));
      return out;
    }));

  it("follow_updates", () =>
    replay(sql, "teams", "follow_updates", async (tx) => {
      const out: Json = {};
      const follow = (me: string, v: string, on: boolean) => (sp: Tx) => A.followVenture(sp, me, v, on);
      const post = (me: string, body: string) => (sp: Tx) => A.postVentureUpdate(sp, me, VENTURE, body, [], missing);
      const del = (me: string, id: string) => async (sp: Tx) => orNull(await A.deleteVentureUpdate(sp, me, id));
      out["follow_public"] = await step(tx, follow(ULA, OPEN, true));
      out["follow_again"] = await step(tx, follow(ULA, OPEN, true));
      out["follow_university"] = await call(tx, follow(ASAD, VENTURE, true));
      out["unfollow"] = await step(tx, follow(ULA, OPEN, false));
      const u1 = await step(tx, post(MINA, " Arm works! "));
      out["update_member"] = u1;
      out["update_outsider"] = await call(tx, post(ASAD, "Hi"));
      const u2 = value(await call(tx, post(OMAR, "Owner note")));
      out["delete_not_author"] = await call(tx, del(ASAD, u2));
      out["delete_by_owner"] = await step(tx, del(OMAR, value(u1)));
      out["delete_own"] = await step(tx, del(OMAR, u2));
      await tx`update work.ventures set status = 'abandoned', abandoned_at = now() where id = ${VENTURE}`;
      out["update_abandoned"] = await call(tx, post(MINA, "Still here"));
      return out;
    }));
});
