/**
 * Journey: apps/web/tests/e2e/societies.spec.ts, "paid tickets: a second officer confirms details, an officer's
 * approval confirms, a hold frees, receipts stay private", through the contracts on both transports. Receipts
 * are files in media (W9): the store keeps the path, web checks the file and media keeps it private (it.todo).
 */
import { ConnectError } from "@connectrpc/connect";
import { CommunityService } from "@skilient/contracts/community/v1/community_pb";
import { refusalReason } from "@skilient/platform";
import { describeTransports } from "@skilient/testing";
import { afterAll, describe, expect, it } from "vitest";
import { helpers, unique } from "../contract/helpers";
import { communityWorld, eventsOf, stopWorlds, tick, type CommunityWorld } from "../contract/world";

const worlds: CommunityWorld[] = [];
let w: CommunityWorld;
afterAll(() => stopWorlds(worlds));

async function reason(p: Promise<unknown>): Promise<string | null> {
  try {
    await p;
    return null;
  } catch (e) {
    if (e instanceof ConnectError) return refusalReason(e);
    throw e;
  }
}

describeTransports(
  ["identity", "people", "content", "messaging", "realtime", "work", "ranking", "community"],
  (env) => {
    const h = helpers(env, () => w);
    const community = () => env().client(CommunityService);

    describe("societies.spec: paid tickets", () => {
      it("a second officer confirms details, an officer's approval confirms, a hold frees", async () => {
        const president = await h.onboarded("Hina Head");
        const secretary = await h.onboarded("Saad Secretary");
        const buyer = await h.onboarded(unique("Zara Buyer"));
        const copier = await h.onboarded(unique("Kamran Copier"));
        const late = await h.onboarded("Laila Late");
        const s = await h.society(president, [secretary]);

        // Payment details: proposed by one officer, confirmed by another (the proposer can't).
        const { methodId } = await community().proposePaymentMethod(
          { societyId: s.id, action: "add", kind: "bank", bankName: "Meezan Bank", accountTitle: s.name.slice(0, 80), accountNumber: "PK36MEZN0000001234567890" },
          h.as(president.token),
        );
        const details = h.json<{ proposals: { mine: boolean; proposed_by: string }[]; active: unknown[] }>(await community().paymentDetailsPage({ societyId: s.id }, h.read(president.token)));
        expect([details.proposals.map((p) => [p.mine, p.proposed_by]), details.active]).toEqual([[[true, "Hina Head"]], []]);
        expect(await reason(community().confirmPaymentMethod({ methodId, accept: true }, h.as(president.token)))).toBe("second_officer");
        await community().confirmPaymentMethod({ methodId, accept: true }, h.as(secretary.token));
        const active = h.json<{ active: { account_number: string }[] }>(await community().paymentDetailsPage({ societyId: s.id }, h.read(secretary.token))).active;
        expect(active.map((m) => m.account_number)).toEqual(["PK36MEZN0000001234567890"]);
        const [audit] = await w.community<{ n: number }[]>`select count(*)::int as n from community.society_audit_log where society_id = ${s.id} and action like 'payment_method.%'`;
        expect(audit!.n).toBe(2);

        // A paid event (PKR 1,500, refunds until 3 days before).
        const { eventId, ticketId } = await h.event(president, s.id, { seats: 10, price: 1500, startsIn: 5 * 86_400_000, refundDays: 3 });
        const buy = async (who: { token: string }) => {
          const r = await community().registerEvent({ eventId, ticketTypeId: ticketId, answersJson: "[]" }, h.as(who.token));
          expect(r.status).toBe("held");
          return r.registrationId;
        };

        // The buyer pays and uploads; the seat stays held until an officer approves.
        const reg = await buy(buyer);
        const sheet = h.json<{ reference_code: string; methods: { bank_name: string }[]; status: string }>(await community().ticketPayment({ eventId }, h.read(buyer.token)));
        expect(sheet.reference_code).toMatch(/^SKL-[A-Z0-9]{4}$/);
        expect([sheet.methods.map((m) => m.bank_name), sheet.status]).toEqual([["Meezan Bank"], "awaiting"]);
        expect(h.json<{ payload: string | null }>(await community().eventTicket({ eventId }, h.read(buyer.token))).payload).toBeNull();
        const hash = "a".repeat(64);
        const path = `${eventId}/${reg}/${crypto.randomUUID()}.webp`;
        expect(await reason(community().submitReceipt({ registrationId: reg, path: `${eventId}/${crypto.randomUUID()}/${crypto.randomUUID()}.webp`, hash, phash: "0f0f0f0f0f0f0f0f" }, h.as(buyer.token)))).toBe(
          "upload_receipt_again",
        );
        await community().submitReceipt({ registrationId: reg, path, hash, phash: "0f0f0f0f0f0f0f0f" }, h.as(buyer.token));
        const [held] = await w.community<{ status: string; receipt_path: string }[]>`
          select r.status, p.receipt_path from community.event_registrations r join community.event_payments p on p.registration_id = r.id where r.id = ${reg}`;
        expect(held).toEqual({ status: "held", receipt_path: path });

        // Someone else uploads the same picture: flagged on the review card, not rejected.
        const copy = await buy(copier);
        await community().submitReceipt({ registrationId: copy, path: `${eventId}/${copy}/${crypto.randomUUID()}.webp`, hash, phash: "0f0f0f0f0f0f0f0f" }, h.as(copier.token));
        const review = h.json<{ id: string; name: string; duplicates: { why: string }[] }[]>(await community().paymentsReview({ eventId }, h.read(president.token)));
        expect(review).toHaveLength(2);
        expect(review.every((c) => c.duplicates.length === 1 && c.duplicates[0]!.why === "receipt")).toBe(true);
        expect(await reason(community().paymentsReview({ eventId }, h.read(buyer.token)))).toBe("event_not_found");

        // The officer approves the buyer's payment: the ticket is confirmed and gets its signed code.
        const card = review.find((c) => c.name.startsWith("Zara Buyer"))!;
        await community().reviewPayment({ paymentId: card.id, approve: true }, h.as(secretary.token));
        const ticket = h.json<{ status: string; payload: string | null }>(await community().eventTicket({ eventId }, h.read(buyer.token)));
        expect(ticket.status).toBe("confirmed");
        expect(ticket.payload).toMatch(/^SKT1\./);
        expect((await eventsOf(w, "payment.changed")).filter((e) => e.payload["payment_id"] === card.id).map((e) => e.payload["change"])).toEqual(["opened", "submitted", "approved"]);

        // An unpaid hold frees after 24 hours (event-tick).
        const lateReg = await buy(late);
        await w.community`update community.event_registrations set hold_expires_at = now() - interval '1 minute' where id = ${lateReg}`;
        await tick(w, "event-tick");
        const [freed] = await w.community<{ status: string; pay: string }[]>`
          select r.status, p.status as pay from community.event_registrations r join community.event_payments p on p.registration_id = r.id where r.id = ${lateReg}`;
        expect(freed).toEqual({ status: "cancelled", pay: "released" });
        expect((await eventsOf(w, "event.registered")).filter((e) => e.payload["registration_id"] === lateReg).map((e) => e.payload["reason"])).toEqual(["registered", "hold_expired"]);
      });

      it.todo("W9 media: receipts stay private (the buyer reads theirs, another student can't) and are deleted 90 days after the event");
      it.todo("W13: the payments page, the buy sheet (Hold my seat, the paid note), the receipt upload (sharp re-encode, hash and dHash), the review cards, axe in both themes");
    });
  },
  communityWorld((x) => (w = x), worlds),
);
