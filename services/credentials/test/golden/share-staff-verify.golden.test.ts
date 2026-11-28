import { readFileSync } from "node:fs";
import { join } from "node:path";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { TestDatabase } from "@skilient/testing/postgres";
import { check, cvEnvelopeOf, recordEnvelopeOf } from "../../src/signing/sign";
import * as Cv from "../../src/store/cv";
import { requireUser, takeCode } from "../../src/store/db";
import { issueCv } from "../../src/store/issue";
import * as Rec from "../../src/store/record";
import { call, eligibleNow, F, fill, grant, inputsFor, issueAndSeal, key, ok, replay, sealPending, startWorld, step, world, type Tx } from "./replay";

let pg: TestDatabase;
let sql: postgres.Sql;
beforeAll(async () => ({ pg, sql } = await startWorld()));
afterAll(async () => pg?.stop());

const first = async (tx: Tx, user: string, source: "first" | "on_demand" = "first") => expect((await issueCv(tx, user, source, inputsFor(user), key)).status).toBe("issued");
const owner = async (u: string) => ({ eligible: eligibleNow(u), username: world.profiles.get(u)?.username ?? null });
const SPARK = (u: string) => ["spark", "flare", "shine", "radiant", "luminary"].includes(world.tiers.get(u)?.tier ?? "");

describe("credentials goldens replayed: share links", () => {
  it("cv", () =>
    replay(sql, "share", "cv", async (tx) => {
      const out: Record<string, unknown> = {};
      const create = (u: string, hash: string, label: string | null, days: number | null) => (sp: Tx) => Cv.createShareLink(sp, u, eligibleNow(u), SPARK(u), hash, label, days);
      const open = (hash: string, viewer: string | null) => (sp: Tx) => Cv.openShared(sp, hash, viewer, owner);
      out["no_tier"] = await call(tx, create(F.NIDA, F.LINK_HASH, "Mine", 30));
      out["bad_days"] = await call(tx, create(F.SAMI, F.LINK_HASH, "Mine", 14));
      out["bad_hash"] = await call(tx, create(F.SAMI, "xyz", "Mine", 30));
      out["create"] = await step(tx, create(F.SAMI, F.LINK_HASH, "  Recruiters  ", 30));
      out["create_forever"] = await step(tx, create(F.SAMI, F.LINK_HASH_2, " ", null));
      out["open_no_cv"] = await step(tx, open(F.LINK_HASH, F.VIEWER));
      await first(tx, F.SAMI);
      out["open"] = await step(tx, open(F.LINK_HASH, F.VIEWER));
      out["open_again"] = await step(tx, open(F.LINK_HASH, F.VIEWER));
      out["open_other"] = await step(tx, open(F.LINK_HASH, F.VIEWER_2));
      out["open_no_key"] = await step(tx, open(F.LINK_HASH, null));
      out["open_unknown"] = await call(tx, open("9".repeat(64), F.VIEWER));
      ok(await call(tx, (sp) => Cv.saveSettings(sp, F.SAMI, true, { sections: ["summary"], showPercentile: null, showEmail: false, visibility: "private" })));
      out["open_private"] = await call(tx, open(F.LINK_HASH, F.VIEWER));
      const link = ((await tx`select id::text from credentials.cv_share_links where token_hash = ${F.LINK_HASH}`)[0] as unknown as { id: string }).id;
      out["revoke_other"] = await call(tx, (sp) => Cv.revokeShareLink(sp, F.MEHR, link));
      out["revoke"] = await step(tx, (sp) => Cv.revokeShareLink(sp, F.SAMI, link));
      out["revoke_again"] = await call(tx, (sp) => Cv.revokeShareLink(sp, F.SAMI, link));
      out["open_revoked"] = await call(tx, open(F.LINK_HASH, F.VIEWER));
      for (let i = 3; i <= 10; i++) ok(await call(tx, create(F.SAMI, String(i % 10).repeat(63) + "f", null, 7)));
      out["eleventh"] = await call(tx, create(F.SAMI, "e".repeat(64), null, 7));
      return out;
    }));

  it("record", () =>
    replay(sql, "share", "record", async (tx) => {
      const out: Record<string, unknown> = {};
      await issueAndSeal(tx);
      await tx`update credentials.record_entries set occurred_on = occurred_on - (case kind when 'attended' then 2 when 'completed' then 1 else 0 end) where user_id = ${F.SAMI}`;
      const create = (hash: string, label: string, days: number | null) => (sp: Tx) => Rec.createShareLink(sp, F.SAMI, hash, label, days);
      /** The handler's document: the share and the person from people. */
      const open = (hash: string) => async (sp: Tx) => {
        const r = await Rec.openShare(sp, hash, F.VIEWER);
        if (r.state !== "ok") return { state: r.state };
        const p = world.profiles.get(r.user_id!)!;
        return { state: "ok", expires_at: r.expires_at, person: { name: p.name, username: p.username, university: p.university, department: p.department }, entries: r.entries };
      };
      out["no_days"] = await call(tx, create(F.LINK_HASH, "Mine", null));
      out["create"] = await step(tx, create(F.LINK_HASH, "  Scholarship  ", 90));
      out["signed_out"] = await call(tx, () => requireUser(null), "create_record_share_link");
      const hide = ((await tx`select id::text from credentials.record_entries where user_id = ${F.SAMI} and kind = 'result'`)[0] as unknown as { id: string }).id;
      ok(await call(tx, (sp) => Rec.setDisplay(sp, F.SAMI, hide, false, true)));
      out["open"] = await step(tx, open(F.LINK_HASH));
      out["open_again"] = await step(tx, open(F.LINK_HASH));
      out["open_unknown"] = await call(tx, open("9".repeat(64)));
      const link = ((await tx`select id::text from credentials.record_share_links where token_hash = ${F.LINK_HASH}`)[0] as unknown as { id: string }).id;
      out["revoke_other"] = await call(tx, (sp) => Rec.revokeShareLink(sp, F.MEHR, link));
      out["revoke"] = await step(tx, (sp) => Rec.revokeShareLink(sp, F.SAMI, link));
      out["open_revoked"] = await call(tx, open(F.LINK_HASH));
      out["mine"] = await call(tx, async (sp) => (await Rec.myRecord(sp, F.SAMI, null))["links"]);
      return out;
    }));
});

describe("credentials goldens replayed: staff", () => {
  const staffRefusal = (reason: "trust_only" | "staff_only") => ({
    ok: false,
    code: "42501",
    message: reason === "trust_only" ? "trust reviewers only, with two-factor on" : "trust reviewers and moderators only, with two-factor on",
  });

  it("cv", () =>
    replay(sql, "staff", "cv", async (tx) => {
      const out: Record<string, unknown> = {};
      await first(tx, F.SAMI);
      await grant(tx, F.SAMI, "cv.refresh_on_demand");
      await first(tx, F.SAMI, "on_demand");
      await tx`update credentials.cv_records set issued_at = issued_at - interval '1 hour' where user_id = ${F.SAMI} and version = 1`;
      const search = (q: string) => call(tx, async (sp) => fill(await Cv.opsCvRecords(sp, q, q.trim().toLowerCase().replace(/^@/, "") === F.USERNAME[F.SAMI] ? F.SAMI : null)));
      out["search_student"] = staffRefusal("trust_only");
      out["search_aal1"] = staffRefusal("trust_only");
      out["search_short"] = await search("cr");
      out["search"] = await search(`@${F.USERNAME[F.SAMI]}`);
      const [v1, v2] = await tx<{ id: string; code: string }[]>`select id::text, code from credentials.cv_records where user_id = ${F.SAMI} order by version`;
      out["search_code"] = await search(`${v1!.code.slice(0, 5).toLowerCase()}-${v1!.code.slice(5)}`);
      out["revoke_no_reason"] = await call(tx, (sp) => Cv.opsRevokeCv(sp, F.TARIQ, v1!.id, false, "no"));
      out["revoke"] = await step(tx, (sp) => Cv.opsRevokeCv(sp, F.TARIQ, v1!.id, false, " Fake university email "));
      out["revoke_again"] = await call(tx, (sp) => Cv.opsRevokeCv(sp, F.TARIQ, v1!.id, false, "Fake university email"));
      out["revoke_all"] = await step(tx, (sp) => Cv.opsRevokeCv(sp, F.TARIQ, v2!.id, true, "Account taken over"));
      out["revoke_student"] = staffRefusal("trust_only");
      return out;
    }));

  it("record", () =>
    replay(sql, "staff", "record", async (tx) => {
      const out: Record<string, unknown> = {};
      await issueAndSeal(tx);
      const e = (await tx<{ id: string; code: string }[]>`select id::text, code from credentials.record_entries where user_id = ${F.SAMI} and kind = 'attended'`)[0]!;
      out["lookup_student"] = staffRefusal("staff_only");
      out["lookup_aal1"] = staffRefusal("staff_only");
      out["lookup"] = await call(tx, async (sp) => fill(await Rec.opsRecordEntry(sp, ` ${e.code.toLowerCase()} `)));
      out["lookup_unknown"] = await call(tx, (sp) => Rec.opsRecordEntry(sp, "0000000000"));
      out["revoke"] = await step(tx, (sp) => Rec.revokeEntry(sp, F.TARIQ, true, e.id, "misconduct", " Ticket was shared "));
      // aal1: the handler finds no staff role, and Tariq is no officer.
      out["revoke_aal1"] = await call(tx, (sp) => Rec.revokeEntry(sp, F.TARIQ, false, e.id, "misconduct", "Ticket was shared"));
      return out;
    }));
});

describe("credentials goldens replayed: verify", () => {
  it("cv", () =>
    replay(sql, "verify", "cv", async (tx) => {
      const out: Record<string, unknown> = {};
      await first(tx, F.SAMI);
      await grant(tx, F.SAMI, "cv.refresh_on_demand");
      await first(tx, F.SAMI, "on_demand");
      const [v1, v2] = await tx<{ id: string; code: string }[]>`select id::text, code from credentials.cv_records where user_id = ${F.SAMI} order by version`;
      await tx`insert into credentials.cv_pdf_exports (id, record_id, user_id, template, paper, pdf_hash, path, bytes) values (${F.EXPORT_CV}, ${v2!.id}, ${F.SAMI}, 'standard', 'a4', ${F.PDF_HASH}, ${`${F.SAMI}/${F.EXPORT_CV}.pdf`}, 100)`;
      out["superseded"] = await call(tx, (sp) => Cv.verifyCv(sp, v1!.code.toLowerCase(), null));
      out["newest"] = await call(tx, (sp) => Cv.verifyCv(sp, v2!.code, F.PDF_HASH.toUpperCase()));
      out["altered"] = await call(tx, (sp) => Cv.verifyCv(sp, v2!.code, "d".repeat(64)));
      ok(await call(tx, (sp) => Cv.revokeCv(sp, F.SAMI, v2!.id)));
      out["revoked"] = await call(tx, (sp) => Cv.verifyCv(sp, v2!.code, F.PDF_HASH));
      out["unknown"] = await call(tx, (sp) => Cv.verifyCv(sp, "0000000000", null));
      return out;
    }));

  it("entry", () =>
    replay(sql, "verify", "entry", async (tx) => {
      const out: Record<string, unknown> = {};
      await issueAndSeal(tx);
      const of = async (kind: string) => (await tx<{ id: string; code: string }[]>`select id::text, code from credentials.record_entries where user_id = ${F.SAMI} and kind = ${kind}`)[0]!;
      const result = await of("result");
      const att = await of("attended");
      out["sealed"] = await call(tx, (sp) => Rec.verifyEntry(sp, att.code.toLowerCase()));
      ok(await call(tx, (sp) => Rec.correctEntry(sp, F.PRIYA, result.id, { place: 2 }, null)));
      await sealPending(tx);
      out["superseded"] = await call(tx, (sp) => Rec.verifyEntry(sp, result.code));
      ok(await call(tx, (sp) => Rec.revokeEntry(sp, F.OSMAN, false, att.id, "not_earned", "Left after ten minutes")));
      out["revoked"] = await call(tx, (sp) => Rec.verifyEntry(sp, att.code));
      out["unknown"] = await call(tx, (sp) => Rec.verifyEntry(sp, "0000000000"));
      return out;
    }));

  it("namespace", () =>
    replay(sql, "verify", "namespace", async (tx) => {
      await first(tx, F.SAMI);
      await issueAndSeal(tx);
      const cv = ((await tx`select code from credentials.cv_records where user_id = ${F.SAMI}`)[0] as unknown as { code: string }).code;
      const entry = ((await tx`select code from credentials.record_entries where status = 'sealed' limit 1`)[0] as unknown as { code: string }).code;
      const taken = (code: string, kind: "cv" | "record") =>
        call(tx, (sp) => takeCode(sp, code, kind)).then((o) => (o.ok ? { ok: true } : { ok: false, code: o.code }));
      void entry;
      // The stack's cv_issue_commit (on_demand, no Student Pro) refused before it reached the code: the same refusal here.
      const cvSide = await call(tx, (sp) => issueCv(sp, F.SAMI, "on_demand", inputsFor(F.SAMI), key)).then((o) => (o.ok ? { ok: true } : { ok: false, code: o.code }));
      return { entry_takes_cv_code: await taken(cv, "record"), cv_takes_entry_code: cvSide };
    }));
});

/**
 * The W8 done-when, old half: the CV and the Record entry the current stack signed (recorded with the public key
 * file's rows) verify here, imported as the cutover imports them, through VerifyCv's and VerifyRecordEntry's reads.
 */
describe("what the stack signed still verifies", () => {
  it("a stack-signed CV and Record entry verify with the stack's public key, after import", async () => {
    const saved = (JSON.parse(readFileSync(join(import.meta.dirname, "../../../../packages/testing/test/golden/credentials/signed.json"), "utf8")) as Record<string, StackSigned>)[
      "stack_signed"
    ]!;
    await sql
      .begin(async (tx) => {
        for (const k of saved.keys)
          await tx`insert into credentials.signing_keys (key_id, public_key, active_from, retired_at) values (${k.key_id}, ${k.public_key}, ${k.active_from}, now())`;
        const cv = saved.cv;
        await takeCode(tx, cv["code"] as string, "cv");
        await tx`
          insert into credentials.cv_records (id, user_id, code, version, snapshot, content_hash, snapshot_hash, signature, key_id, source, issued_at, expires_at)
          values (gen_random_uuid(), ${F.SAMI}, ${cv["code"] as string}, 1, ${JSON.stringify(cv["snapshot"])}::text::jsonb, ${cv["content_hash"] as string},
                  ${cv["snapshot_hash"] as string}, ${cv["signature"] as string}, ${cv["key_id"] as string}, 'first', ${cv["issued_at"] as string}, ${cv["expires_at"] as string})`;
        const e = saved.entry;
        await takeCode(tx, e["code"] as string, "record");
        await tx`
          insert into credentials.record_entries (id, user_id, kind, issuer_type, issuer_id, issuer_name, source, source_id, title, evidence, occurred_on, status,
                                                  code, key_id, payload, envelope_hash, signature, signed_at)
          values (gen_random_uuid(), ${F.SAMI}, 'result', 'society', ${F.SOC}, ${F.SOC_NAME}, 'event', ${F.EVENT}, ${F.EVENT_TITLE}, '{}'::jsonb, current_date, 'sealed',
                  ${e["code"] as string}, ${e["key_id"] as string}, ${JSON.stringify(e["payload"])}::text::jsonb, ${e["envelope_hash"] as string}, ${e["signature"] as string}, ${e["signed_at"] as string})`;
        const [v] = await Cv.verifyCv(tx, (cv["code"] as string).toLowerCase(), null);
        const snapshot = v!["snapshot"] as Record<string, unknown>;
        const env = cvEnvelopeOf({ code: v!["code"] as string, key_id: v!["key_id"] as string, issued_at: v!["issued_at"] as string, expires_at: v!["expires_at"] as string, snapshot });
        expect(check(env, v!["snapshot_hash"] as string, v!["signature"] as string, v!["public_key"] as string)).toBe("valid");
        const r = (await Rec.verifyEntry(tx, e["code"] as string))!;
        const renv = recordEnvelopeOf({ code: r["code"] as string, key_id: r["key_id"] as string, signed_at: r["signed_at"] as string, payload: r["payload"] as Record<string, unknown> });
        expect(check(renv, r["envelope_hash"] as string, r["signature"] as string, r["public_key"] as string)).toBe("valid");
        // One changed byte in the content does not.
        expect(check({ ...env, snapshot: { ...snapshot, summary: "x" } }, v!["snapshot_hash"] as string, v!["signature"] as string, v!["public_key"] as string)).toBe("hash_mismatch");
        throw new Error("rollback");
      })
      .catch((e: unknown) => {
        if (!(e instanceof Error) || e.message !== "rollback") throw e;
      });
  });
});

interface StackSigned {
  cv: Record<string, unknown>;
  entry: Record<string, unknown>;
  keys: { key_id: string; public_key: string; active_from: string }[];
}
