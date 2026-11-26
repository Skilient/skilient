/**
 * Golden replays of endorsements.json, code_checks.json, growth.json, swaps.json and credentials.json
 * (packages/testing/test/work.golden.test.ts). Rules as replay.ts; plus: the staff check is the API's
 * (`requireTrustReviewer`, two-factor and the role from identity), replayed here from the recorded session's
 * level; an uploaded file's facts are media's (W9), replayed from what the recording put in storage; refusals
 * with values carry them (`refusedWith`) and are compared with the values filled in.
 */
import { ConnectError } from "@connectrpc/connect";
import { refusalReason } from "@skilient/platform";
import type { TestDatabase } from "@skilient/testing/postgres";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, it } from "vitest";
import { requireTrustReviewer } from "../../src/identity";
import { REFUSALS, refusalText, type RefusalReason } from "../../src/refusals";
import * as CC from "../../src/store/code-checks";
import * as CR from "../../src/store/credentials";
import * as E from "../../src/store/endorsements";
import * as P from "../../src/store/paths";
import * as S from "../../src/store/swaps";
import * as T from "../../src/store/tasks";
import { ASAD, changes, MINA, OMAR, replay, resolve, startWorld, ULA, VENTURE, type Tx } from "./replay";

let pg: TestDatabase;
let sql: postgres.Sql;
beforeAll(async () => ({ pg, sql } = await startWorld()));
afterAll(async () => pg?.stop());

type Json = Record<string, unknown>;
type Outcome = { ok: true; value: unknown } | { ok: false; code: string; message: string };

/** Rule 3 with values: a refusal's wording with its `x-refusal-values` filled in. */
async function outcome(run: () => unknown): Promise<Outcome> {
  try {
    return { ok: true, value: (await run()) ?? null };
  } catch (error) {
    if (error instanceof ConnectError) {
      const reason = refusalReason(error) as RefusalReason | null;
      if (!reason || !REFUSALS[reason]) throw error;
      const values = JSON.parse(error.metadata.get("x-refusal-values") ?? "[]") as (string | number)[];
      return { ok: false, code: REFUSALS[reason].sqlstate, message: refusalText(reason, values) };
    }
    const e = error as { code?: unknown; message?: unknown; name?: unknown };
    if (e.name === "PostgresError" && typeof e.code === "string") return { ok: false, code: e.code, message: String(e.message) };
    throw error;
  }
}
const call = (tx: Tx, run: (sp: Tx) => unknown) => outcome(() => tx.savepoint((sp) => Promise.resolve(run(sp))));

const VX = `(select v.title from work.ventures v where v.id = x.venture_id)`;
const USERS = [OMAR, MINA, ASAD, ULA, "9b000000-0000-4000-8000-000000000005", "9b000000-0000-4000-8000-000000000006"];
/** Rule 1 for this group: work's tables under the recorded names. */
const RENAMED_2: Record<string, string> = {
  "public.endorsements": `select x.endorser_id, x.endorsee_id, ${VX} as venture, x.skill_id, x.evidence_id is not null as evidence, x.note, x.hidden
       from work.endorsements x where x.endorsee_id = any($1) order by 1, 2, 4`,
  "public.user_skills": `select x.user_id, x.skill_id, x.level, x.peer_verified from work.user_skills x where x.user_id = any($1) and x.level >= 1 order by 1, 2`,
  "public.credentials": `select x.user_id, x.title, x.issuer, x.issued_on::text, x.expires_on::text, x.file_type, x.status, x.recognised_issuer_id, x.claimed_by, x.reviewer_id, x.review_reason
       from work.credentials x where x.user_id = any($1) order by 1, 2`,
  "public.code_checks": `select x.user_id, x.skill_id, x.status, x.answers, x.started_at is not null as started, x.submitted_at is not null as submitted
       from work.code_checks x where x.user_id = any($1) order by 1, 2, 3`,
  "public.task_attempts": `select x.user_id, (select t.title from work.proof_tasks t where t.id = x.task_id) as task, x.status, x.route, x.repo_full_name
       from work.task_attempts x where x.user_id = any($1) order by 1, 2`,
  "public.path_follows": `select x.user_id, x.role from work.path_follows x where x.user_id = any($1) order by 1, 2`,
  "public.swap_offers": `select x.user_id, x.skill_id, x.note from work.swap_offers x where x.user_id = any($1) order by 1, 2`,
  "public.swap_wants": `select x.user_id, x.skill_id, x.note from work.swap_wants x where x.user_id = any($1) order by 1, 2`,
  "public.swaps": `select x.teacher_id, x.learner_id, x.skill_id, x.offered_skill_id, x.status, x.note, x.preferred_times, x.close_reason
       from work.swaps x where x.learner_id = any($1) order by 1, 2, 3, 5`,
  "public.swap_sessions": `select x.minutes, x.place, x.status, x.confirmed_minutes, x.no_show_reason from work.swap_sessions x
       join work.swaps s on s.id = x.swap_id where s.learner_id = any($1) order by 2, 3`,
  "public.swap_notes": `select x.author_id, x.teacher_id, x.body, x.status from work.swap_notes x where x.author_id = any($1) order by 3`,
};
async function snapshot2(tx: Tx) {
  const out: Record<string, string[]> = {};
  for (const [table, text] of Object.entries(RENAMED_2)) out[table] = (await tx.unsafe(text, [USERS] as never[])).map((r) => JSON.stringify(r));
  return out;
}
async function step(tx: Tx, run: (sp: Tx) => unknown) {
  const before = await snapshot2(tx);
  const result = await call(tx, run);
  return { result, changes: changes(before, await snapshot2(tx)) };
}
const value = (o: { result: Outcome } | Outcome) => (("result" in o ? o.result : o) as { value: string }).value;
const orNull = (b: boolean) => (b ? true : null);
const githubAccount = (tx: Tx, user: string, id: number, login: string) => tx`insert into work.github_accounts (user_id, github_id, login) values (${user}, ${id}, ${login})`;

describe("endorsements.json", () => {
  it("endorse", () =>
    replay(sql, "endorsements", "endorse", async (tx) => {
      const out: Json = {};
      const endorse = (me: string, who: string, items: { skill: string; evidence?: string }[], note: string | null) => (sp: Tx) =>
        E.endorse(sp, me, who, VENTURE, items.map((i) => ({ skill: i.skill, evidence: i.evidence ?? null })), note);
      out["not_in_progress"] = await call(tx, endorse(OMAR, MINA, [{ skill: "react" }], null));
      await tx`update work.ventures set status = 'in_progress' where id = ${VENTURE}`;
      const [e] = await tx<{ id: string }[]>`insert into work.contributions (id, venture_id, user_id, kind, description, skill_ids) values (gen_random_uuid(), ${VENTURE}, ${MINA}, 'code', 'Built the arm UI', '{react}') returning id::text`;
      const entry = e!.id;
      out["endorse"] = await step(tx, endorse(OMAR, MINA, [{ skill: "react", evidence: entry }, { skill: "typescript" }], " Great work "));
      out["again"] = await call(tx, endorse(OMAR, MINA, [{ skill: "react" }], null));
      out["self"] = await call(tx, endorse(OMAR, OMAR, [{ skill: "react" }], null));
      out["outsider"] = await call(tx, endorse(ASAD, MINA, [{ skill: "react" }], null));
      out["not_teammate"] = await call(tx, endorse(OMAR, ASAD, [{ skill: "react" }], null));
      out["empty"] = await call(tx, endorse(MINA, OMAR, [], null));
      out["twice_in_one"] = await call(tx, endorse(MINA, OMAR, [{ skill: "react" }, { skill: "react" }], null));
      out["foreign_skill"] = await call(tx, endorse(MINA, OMAR, [{ skill: "python" }], null));
      out["evidence_not_theirs"] = await call(tx, endorse(MINA, OMAR, [{ skill: "react", evidence: entry }], null));
      out["long_note"] = await call(tx, endorse(MINA, OMAR, [{ skill: "react" }], "x".repeat(281)));
      out["too_many"] = await call(tx, endorse(MINA, OMAR, ["react", "typescript", "python", "docker", "nextjs", "postgresql"].map((s) => ({ skill: s })), null));
      out["for_endorsee"] = await call(tx, async (sp) =>
        (await E.endorsementsFor(sp, MINA, MINA))
          .sort((a, b) => a.skill_id.localeCompare(b.skill_id))
          .map((r) => ({ skill_id: r.skill_id, skill_name: r.skill_name, endorser_id: r.endorser_id, venture_title: r.venture_title, note: r.note, has_evidence: r.has_evidence, hidden: r.hidden })),
      );
      out["for_classmate"] = await call(tx, async (sp) => (await E.endorsementsFor(sp, ASAD, MINA)).map((r) => ({ skill_id: r.skill_id, endorser_id: r.endorser_id, hidden: r.hidden })));
      const [h] = await tx<{ id: string }[]>`select id::text from work.endorsements where endorsee_id = ${MINA} and skill_id = 'react'`;
      out["hide"] = await step(tx, (sp) => E.hideEndorsement(sp, MINA, h!.id, true));
      out["hide_not_mine"] = await call(tx, (sp) => E.hideEndorsement(sp, OMAR, h!.id, true));
      out["for_classmate_hidden"] = await call(tx, async (sp) => (await E.endorsementsFor(sp, ASAD, MINA)).map((r) => ({ skill_id: r.skill_id })));
      return out;
    }));
});

describe("code_checks.json", () => {
  it("student", () =>
    replay(sql, "code_checks", "student", async (tx) => {
      const out: Json = {};
      const req = (skill: string) => (sp: Tx) => CC.requestCodeCheck(sp, MINA, skill);
      out["no_github"] = await call(tx, req("python"));
      await githubAccount(tx, MINA, 9_900_001, "mina-gh");
      out["no_l2"] = await call(tx, req("python"));
      await tx`insert into work.user_skills (user_id, skill_id, level, active_days, lines, hits, repos) values (${MINA}, 'python', 2, 3, 200, 3, 1)`;
      out["unknown_skill"] = await call(tx, req("no-such-skill"));
      const first = await step(tx, req("python"));
      out["requested"] = first;
      out["open"] = await call(tx, req("python"));
      const id = value(first);
      out["state"] = await call(tx, async (sp) => {
        const s = await CC.codeCheckState(sp, MINA, "python");
        return [{ status: s.status, blocker: s.blocker ? REFUSALS[s.blocker].text : null }];
      });
      out["start_preparing"] = await call(tx, (sp) => CC.startCodeCheck(sp, MINA, id));
      out["start_not_mine"] = await call(tx, (sp) => CC.startCodeCheck(sp, ASAD, id));
      await tx`update work.code_checks set status = 'ready', ready_at = now(), repo_id = 1, sha = ${"f".repeat(40)}, path = 'a.py', start_line = 1, end_line = 30 where id = ${id}`;
      out["start"] = await step(tx, (sp) => CC.startCodeCheck(sp, MINA, id));
      out["save_not_served"] = await call(tx, (sp) => CC.saveCodeCheck(sp, MINA, id, { what: "x" }, false));
      await tx`update work.code_checks set snippet_served_at = now(), deadline_at = now() + interval '20 minutes' where id = ${id}`;
      out["save_bad_keys"] = await call(tx, (sp) => CC.saveCodeCheck(sp, MINA, id, { how: "x" }, false));
      out["save"] = await step(tx, (sp) => CC.saveCodeCheck(sp, MINA, id, { what: "Adds" }, false));
      out["submit"] = await step(tx, (sp) => CC.saveCodeCheck(sp, MINA, id, { what: "Adds", why: "Totals", change: "sum()" }, true));
      out["save_after"] = await call(tx, (sp) => CC.saveCodeCheck(sp, MINA, id, { what: "x" }, false));
      return out;
    }));
});

describe("growth.json", () => {
  it("tasks_paths", () =>
    replay(sql, "growth", "tasks_paths", async (tx) => {
      const out: Json = {};
      const [t] = await tx<{ id: string }[]>`select id::text from work.proof_tasks where skill_id = 'docker' and active order by title limit 1`;
      const start = await step(tx, (sp) => T.startTask(sp, ASAD, t!.id));
      out["start"] = start;
      out["start_again_same"] = await call(tx, async (sp) => (await T.startTask(sp, ASAD, t!.id)) === value(start));
      out["start_unknown"] = await call(tx, (sp) => T.startTask(sp, ASAD, "9f000000-0000-4000-8000-0000000000ff"));
      const id = value(start);
      out["link_no_github"] = await call(tx, (sp) => T.linkTaskRepo(sp, ASAD, id, 5));
      out["submit_no_repo"] = await call(tx, (sp) => T.submitTask(sp, ASAD, id));
      await githubAccount(tx, ASAD, 9_900_002, "asad-gh");
      out["link_unknown_repo"] = await call(tx, (sp) => T.linkTaskRepo(sp, ASAD, id, 5));
      out["abandon"] = await step(tx, (sp) => T.abandonTask(sp, ASAD, id));
      out["abandon_again"] = await call(tx, (sp) => T.abandonTask(sp, ASAD, id));
      const follow = (role: string, on: boolean) => (sp: Tx) => P.followPath(sp, ASAD, role, on);
      out["follow"] = await step(tx, follow("devops", true));
      out["follow_again"] = await step(tx, follow("devops", true));
      out["follow_second"] = await step(tx, follow("frontend", true));
      out["follow_third"] = await call(tx, follow("backend", true));
      out["follow_unknown"] = await call(tx, follow("astronaut", true));
      out["unfollow"] = await step(tx, follow("devops", false));
      return out;
    }));
});

describe("swaps.json", () => {
  it("swap", () =>
    replay(sql, "swaps", "swap", async (tx) => {
      const out: Json = {};
      const req = (me: string, teacher: string, skill: string, note: string | null, times: string | null, offer: string | null) => (sp: Tx) =>
        S.requestSwap(sp, me, resolve(teacher), skill, note, times, offer);
      out["offer_no_l2"] = await call(tx, (sp) => S.saveSwapOffer(sp, OMAR, "typescript", "Happy to teach", true));
      await tx`insert into work.user_skills (user_id, skill_id, level) values (${OMAR}, 'typescript', 2), (${ASAD}, 'python', 2)`;
      out["offer"] = await step(tx, (sp) => S.saveSwapOffer(sp, OMAR, "typescript", " Happy to teach ", true));
      out["want"] = await step(tx, (sp) => S.saveSwapWant(sp, ASAD, "typescript", null, true));
      out["want_unknown"] = await call(tx, (sp) => S.saveSwapWant(sp, ASAD, "no-such-skill", null, true));
      out["other_university"] = await call(tx, req(ULA, "wk_omar", "typescript", null, null, null));
      out["not_taught"] = await call(tx, req(ASAD, "wk_omar", "react", null, null, null));
      out["offer_back_no_l2"] = await call(tx, req(ASAD, "wk_omar", "typescript", null, null, "react"));
      out["self"] = await call(tx, req(OMAR, "wk_omar", "typescript", null, null, null));
      const r = await step(tx, req(ASAD, "wk_omar", "typescript", " Please ", "Evenings", "python"));
      out["request"] = r;
      out["again"] = await call(tx, req(ASAD, "wk_omar", "typescript", null, null, null));
      const swap = value(r);
      out["respond_not_teacher"] = await call(tx, (sp) => S.respondSwap(sp, ASAD, swap, true));
      out["accept"] = await step(tx, (sp) => S.respondSwap(sp, OMAR, swap, true));
      out["accept_again"] = await call(tx, (sp) => S.respondSwap(sp, OMAR, swap, true));
      const at = async (days: number) => ((await tx<{ t: string }[]>`select (now() + make_interval(days => ${days}))::text as t`)[0]!.t);
      const propose = (days: number, minutes: number, place: string) => async (sp: Tx) => S.proposeSwapSession(sp, OMAR, swap, await at(days), minutes, place);
      out["propose_past"] = await call(tx, propose(-1, 60, "Library"));
      out["propose_long"] = await call(tx, propose(1, 300, "Library"));
      out["propose_no_place"] = await call(tx, propose(1, 60, " "));
      const p = await step(tx, propose(1, 60, " Library, room 2 "));
      out["propose"] = p;
      const session = value(p);
      out["respond_own"] = await call(tx, (sp) => S.respondSwapSession(sp, OMAR, session, true));
      out["respond"] = await step(tx, (sp) => S.respondSwapSession(sp, ASAD, session, true));
      const confirm = (me: string, happened: boolean, minutes: number | null, note: string | null) => (sp: Tx) => S.confirmSwapSession(sp, me, session, happened, minutes, null, note);
      out["confirm_future"] = await call(tx, confirm(ASAD, true, 60, null));
      await tx`update work.swap_sessions set starts_at = now() - interval '2 hours' where id = ${session}`;
      out["confirm_teacher"] = await call(tx, confirm(OMAR, true, 60, null));
      out["confirm_no_reason"] = await call(tx, confirm(ASAD, false, null, null));
      out["confirm"] = await step(tx, confirm(ASAD, true, 60, " Thank you "));
      out["end"] = await step(tx, (sp) => S.endSwap(sp, ASAD, swap));
      out["end_again"] = await call(tx, (sp) => S.endSwap(sp, ASAD, swap));
      return out;
    }));
});

describe("credentials.json", () => {
  it("submit_review", () =>
    replay(sql, "credentials", "submit_review", async (tx) => {
      const out: Json = {};
      // Media's record of uploads (W9): what the recording put in storage.
      const uploads = new Map<string, CR.FileFacts>();
      const files: CR.FileLookup = async (path) => uploads.get(path) ?? null;
      const pdf = `${ASAD}/9e100000-0000-4000-8000-000000000001.pdf`;
      const submit = (o: Partial<CR.NewCredential> = {}) => (sp: Tx) =>
        CR.submitCredential(sp, ASAD, { path: pdf, title: " Cloud Practitioner ", issuer: " Amazon Web Services ", issued_on: "2026-01-10", expires_on: null, verify_url: null, ...o }, files);
      out["no_upload"] = await call(tx, submit());
      out["others_folder"] = await call(tx, submit({ path: `${MINA}/9e100000-0000-4000-8000-000000000001.pdf` }));
      uploads.set(pdf, { owner: ASAD, mimetype: "application/pdf", bytes: 1000 });
      out["future_date"] = await call(tx, submit({ issued_on: "2099-01-01" }));
      out["bad_date"] = await call(tx, submit({ issued_on: "soon" }));
      out["expiry_before"] = await call(tx, submit({ expires_on: "2025-01-01" }));
      const s = await step(tx, submit());
      out["submit"] = s;
      out["same_file"] = await call(tx, submit());
      const id = value(s);
      const big = `${ASAD}/9e100000-0000-4000-8000-000000000002.pdf`;
      uploads.set(big, { owner: ASAD, mimetype: "application/pdf", bytes: 6_000_000 });
      out["too_big"] = await call(tx, submit({ path: big }));
      out["for_before_review"] = await call(tx, async (sp) => (await CR.credentialsFor(sp, MINA, ASAD)).map((c) => ({ title: c.title })));
      // The staff check is the API's: two-factor and the trust reviewer role (from identity).
      const staff = (aal: "aal1" | "aal2") => requireTrustReviewer({ id: OMAR, aal }, ["trust_reviewer"]);
      out["claim_aal1"] = await call(tx, (sp) => CR.claimCredential(sp, staff("aal1"), id, true));
      out["review_unclaimed"] = await call(tx, (sp) => CR.reviewCredential(sp, staff("aal2"), id, true, "Checked", null));
      out["claim"] = await step(tx, (sp) => CR.claimCredential(sp, staff("aal2"), id, true));
      out["review_no_reason"] = await call(tx, (sp) => CR.reviewCredential(sp, staff("aal2"), id, true, "x", null));
      out["review_unknown_issuer"] = await call(tx, (sp) => CR.reviewCredential(sp, staff("aal2"), id, true, "Checked", "no-such-issuer"));
      out["approve"] = await step(tx, (sp) => CR.reviewCredential(sp, staff("aal2"), id, true, " Verified on the site ", null));
      out["audit"] = await call(tx, async (sp) => [...(await sp`select action, reason, before, after from work.audit_log where target_id = ${id} order by created_at, action`)]);
      out["for_after_review"] = await call(tx, async (sp) =>
        (await CR.credentialsFor(sp, MINA, ASAD)).map((c) => ({ title: c.title, issuer: c.issuer, issued_on: c.issued_on, recognised: c.recognised })),
      );
      out["delete_not_mine"] = await call(tx, (sp) => CR.deleteCredential(sp, MINA, id));
      out["delete"] = await step(tx, (sp) => CR.deleteCredential(sp, ASAD, id));
      return out;
    }));
});

void orNull;
