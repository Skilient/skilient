/**
 * What people added for notify (W9): ClaimLaunchRecipients, the stack's queue_university_launch. A live university's
 * consented, confirmed, still-subscribed requests not yet emailed are returned once and marked notified; nothing for a
 * university that isn't live. Notify only; the reply (addresses) is not kept for retries.
 */
import { createHash } from "node:crypto";
import { ConnectError } from "@connectrpc/connect";
import { PeopleService } from "@skilient/contracts/people/v1/people_pb";
import { refusalReason } from "@skilient/platform";
import { describeTransports } from "@skilient/testing";
import { afterAll, expect, it } from "vitest";
import { CLOSED, NUTECH, peopleWorld, stopWorlds, type PeopleWorld } from "./world";

const worlds: PeopleWorld[] = [];
let w: PeopleWorld;
afterAll(() => stopWorlds(worlds));

const reason = (e: unknown) => refusalReason(e) ?? `code ${ConnectError.from(e).code}`;
const hash = () => createHash("sha256").update(crypto.randomUUID()).digest("hex");

describeTransports(
  ["identity", "people"],
  (env) => {
    it("ClaimLaunchRecipients: consented, confirmed, subscribed and not yet emailed; once; live universities only; notify only", async () => {
      const req = async (email: string, uni: string, o: { consent?: boolean; confirmed?: boolean; unsubscribed?: boolean } = {}) =>
        w.people`
          insert into people.university_requests (id, email, domain, university_id, consent, token_hash, confirmed_at, unsubscribed_at)
          values (${crypto.randomUUID()}, ${email}, ${email.split("@")[1]!}, ${uni}, ${o.consent ?? true}, ${hash()},
                  ${o.confirmed === false ? null : new Date()}, ${o.unsubscribed ? new Date() : null})`;
      const stamp = Date.now().toString(36);
      await req(`yes-${stamp}@gmail.test`, NUTECH.id);
      await req(`noconsent-${stamp}@gmail.test`, NUTECH.id, { consent: false });
      await req(`unconfirmed-${stamp}@gmail.test`, NUTECH.id, { confirmed: false });
      await req(`gone-${stamp}@gmail.test`, NUTECH.id, { unsubscribed: true });
      await req(`closed-${stamp}@gmail.test`, CLOSED.id);
      const claim = (uni: string) => env().client(PeopleService, "notify").claimLaunchRecipients({ universityId: uni }, { ...env().call(), headers: { "idempotency-key": crypto.randomUUID() } });
      const first = await claim(NUTECH.id);
      expect([first.universityName, first.recipients.map((r) => r.email)]).toEqual([NUTECH.name, [`yes-${stamp}@gmail.test`]]);
      expect((await claim(NUTECH.id)).recipients).toEqual([]);
      expect((await claim(CLOSED.id)).recipients).toEqual([]);
      await expect(env().client(PeopleService).claimLaunchRecipients({ universityId: NUTECH.id }, env().call())).rejects.toSatisfy((e) => reason(e) === "caller_not_allowed");
    });
  },
  peopleWorld((x) => (w = x), worlds),
);
