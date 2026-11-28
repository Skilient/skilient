/**
 * What credentials added for notify (W9): NoticeFacts, what record_sign_commit, revoke_record_entry,
 * decline_record_mistake and ops_revoke_cv snapshotted (an entry's kind, title, issuer, code, date as "5 Dec 2026",
 * corrected, revoke reason; a correction's decision note; a CV version's code), in one query. Notify only.
 */
import { ConnectError } from "@connectrpc/connect";
import { CredentialsService } from "@skilient/contracts/credentials/v1/credentials_pb";
import { refusalReason } from "@skilient/platform";
import { describeTransports } from "@skilient/testing";
import { afterAll, expect, it } from "vitest";
import { credentialsWorld, stopWorlds, type CredentialsWorld } from "./world";

const worlds: CredentialsWorld[] = [];
let w: CredentialsWorld;
afterAll(() => stopWorlds(worlds));

const reason = (e: unknown) => refusalReason(e) ?? `code ${ConnectError.from(e).code}`;

describeTransports(
  ["identity", "people", "content", "messaging", "realtime", "work", "ranking", "community", "credentials"],
  (env) => {
    it("NoticeFacts: an entry and its correction as the notices read them; unknown ids are left out; notify only", async () => {
      const user = crypto.randomUUID();
      const entry = crypto.randomUUID();
      const correction = crypto.randomUUID();
      await w.credentials`
        insert into credentials.record_entries (id, user_id, kind, issuer_type, issuer_name, source, source_id, title, occurred_on, status, revoked_at, revoked_by, revoked_category, revoked_reason, evidence)
        values (${entry}, ${user}, 'attended', 'skilient', 'Skilient', 'task', ${crypto.randomUUID()}, 'Plover Census', '2026-12-05', 'revoked', now(), ${user}, 'other', ' Wrong event. ', '{}')`;
      await w.credentials`
        insert into credentials.record_corrections (id, entry_id, user_id, note, status, decision_note, decided_at)
        values (${correction}, ${entry}, ${user}, 'The date on this entry is wrong.', 'declined', 'Checked the sign-in sheet.', now())`;
      const r = await env()
        .client(CredentialsService, "notify")
        .noticeFacts({ entryIds: [entry, crypto.randomUUID()], correctionIds: [correction], recordIds: [crypto.randomUUID()] }, env().call());
      expect(r.entries.map((e) => [e.kind, e.title, e.issuer, e.date, e.corrected, e.revokeReason])).toEqual([["attended", "Plover Census", "Skilient", "5 Dec 2026", false, "Wrong event."]]);
      expect(r.corrections.map((c) => c.note)).toEqual(["Checked the sign-in sheet."]);
      expect(r.records).toEqual([]);
      await expect(env().client(CredentialsService).noticeFacts({}, env().call())).rejects.toSatisfy((e) => reason(e) === "caller_not_allowed");
    });
  },
  credentialsWorld((x) => (w = x), worlds),
);
