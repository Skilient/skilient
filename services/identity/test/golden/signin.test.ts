/** Golden replay: sign-in protection and security events (signin.json), against identity's schema. */
import { refuse } from "@skilient/platform";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, it } from "vitest";
import { logSecurityEvent, purgeSecurityData, recordSignIn, securityNotMe, signinFailed, signinStatus } from "../../src/store/signin";
import { anonymous, call, EMAIL, IP, maskKey, PEER, replay, startWorld, step, STUDENT, type Tx } from "./replay";
import type { TestDatabase } from "@skilient/testing/postgres";

const UA = "golden-agent/1.0";
const DEVICE_A = "a".repeat(64);
const DEVICE_B = "b".repeat(64);

describe("signin.json", () => {
  let pg: TestDatabase;
  let sql: postgres.Sql;
  beforeAll(async () => ({ pg, sql } = await startWorld()));
  afterAll(async () => {
    await pg?.stop();
  });

  /** The gate refuses a call with no user before the handler runs; this stands in for it. */
  const signedIn = (user: string | null) => {
    if (!user) throw refuse("not_signed_in", "not signed in");
    return user;
  };

  it("signin_failures", () =>
    replay(sql, "signin", "signin_failures", async (tx) => {
      const email = EMAIL[STUDENT]!;
      const fresh = await call(tx, (sp) => signinStatus(sp, email, IP));
      const failures: Record<string, unknown> = {};
      for (let i = 1; i <= 11; i++) failures[String(i)] = await step(tx, (sp) => signinFailed(sp, email, IP));
      return {
        fresh,
        failures,
        status_after: await call(tx, (sp) => signinStatus(sp, email, IP)),
        unknown_email: await step(tx, (sp) => signinFailed(sp, "nobody@golden-uni.test", "bad-ip")),
      };
    }));

  it("record_sign_in and security_not_me", () =>
    replay(sql, "signin", "record_sign_in", async (tx: Tx) => {
      const signIn = (device: string, method = "password") => step(tx, (sp) => recordSignIn(sp, STUDENT, device, IP, UA, method));
      const first = await signIn(DEVICE_A);
      const again = await signIn(DEVICE_A, "otp");
      const newDevice = await signIn(DEVICE_B, "google");
      const token = (newDevice.result as { ok: true; value: { alert_token: string } }).value.alert_token;
      return {
        first_device: first,
        same_device: again,
        new_device: maskKey(newDevice, "alert_token", "<token>"),
        invalid_device: await call(tx, (sp) => recordSignIn(sp, STUDENT, "xyz", IP, UA, "password")),
        invalid_method: await call(tx, (sp) => recordSignIn(sp, STUDENT, DEVICE_A, IP, UA, "telepathy")),
        signed_out: await anonymous("record_sign_in", () => recordSignIn(tx, null, DEVICE_A, IP, UA, "password")),
        not_me: await step(tx, (sp) => securityNotMe(sp, token)),
        not_me_reused: await call(tx, (sp) => securityNotMe(sp, token)),
        not_me_malformed: await call(tx, (sp) => securityNotMe(sp, "nope")),
        not_me_unknown: await call(tx, (sp) => securityNotMe(sp, "f".repeat(64))),
      };
    }));

  it("log_security_event", () =>
    replay(sql, "signin", "log_security_event", async (tx) => ({
      password_changed: await step(tx, (sp) => logSecurityEvent(sp, signedIn(STUDENT), "password_changed", IP, UA)),
      bad_ip_is_dropped: await step(tx, (sp) => logSecurityEvent(sp, signedIn(STUDENT), "mfa_enrolled", "nope", UA)),
      invalid_kind: await call(tx, (sp) => logSecurityEvent(sp, signedIn(STUDENT), "sign_in", IP, UA)),
      signed_out: await anonymous("log_security_event", () => logSecurityEvent(tx, signedIn(null), "password_changed", IP, UA)),
    })));

  it("purge_security_data (scheduled job)", () =>
    replay(sql, "signin", "purge_security_data", async (tx) => {
      await tx`insert into identity.auth_failures (key, created_at) values
                 ('acct:' || encode(sha256(convert_to(${EMAIL[STUDENT]!}, 'UTF8')), 'hex'), now() - interval '2 days'),
                 ('acct:' || encode(sha256(convert_to(${EMAIL[STUDENT]!}, 'UTF8')), 'hex'), now() - interval '1 hour')`;
      await tx`insert into platform.rate_limit_events (key, created_at) values ('golden:old', now() - interval '2 days'), ('golden:new', now())`;
      await tx`insert into identity.security_events (id, user_id, kind, created_at) values
                 (gen_random_uuid(), ${STUDENT}, 'sign_in', now() - interval '400 days'), (gen_random_uuid(), ${STUDENT}, 'sign_in', now())`;
      await tx`insert into identity.security_alert_tokens (token_hash, user_id, expires_at) values
                 (${"0".repeat(64)}, ${STUDENT}, now() - interval '2 days'), (${"2".repeat(64)}, ${STUDENT}, now() + interval '1 day')`;
      await tx`insert into identity.mfa_backup_codes (user_id, code_hash, used_at) values
                 (${STUDENT}, ${"3".repeat(64)}, now() - interval '400 days'), (${STUDENT}, ${"4".repeat(64)}, null)`;
      // The job runs as a platform job: its outcome stands in for the recorded `public.job_runs` row, and the
      // SQL function returned void, which the recording shows as "".
      let rows = 0;
      const ran = await step(tx, async (sp) => {
        rows = await purgeSecurityData(sp);
        return "";
      });
      return {
        ...ran,
        changes: { ...ran.changes, "public.job_runs": { added: [{ job: "purge-security-data", status: "succeeded", rows, error: null }], removed: [] } },
      };
    }));
  void PEER;
});
