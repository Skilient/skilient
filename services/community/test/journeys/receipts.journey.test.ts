/**
 * Journey: the receipt half of apps/web/tests/e2e/societies.spec.ts's paid tickets (W9 hand-off to media), through the
 * real services' contracts on both transports with media's in-memory store: a receipt is uploaded into the
 * registration's folder of the private event-receipts bucket and attached only once stored; the buyer reads theirs,
 * another student can't (community signs links for the officers); 90 days after the event the receipt is released and
 * deleted.
 */
import { CommunityService } from "@skilient/contracts/community/v1/community_pb";
import { MediaService } from "@skilient/contracts/media/v1/media_pb";
import { refusalReason } from "@skilient/platform";
import { describeTransports } from "@skilient/testing";
import { afterAll, describe, expect, it } from "vitest";
import { upload } from "../../../media/test/world";
import { drain, notifyWorld, stopWorlds, type NotifyWorld } from "../../../notify/test/contract/world";
import { closeoutPayments } from "../../src/store/payments";
import { helpers, unique } from "../contract/helpers";

const worlds: NotifyWorld[] = [];
let w: NotifyWorld;
afterAll(() => stopWorlds(worlds));

describeTransports(
  ["identity", "people", "content", "messaging", "realtime", "work", "ranking", "community", "credentials", "media", "notify"],
  (env) => {
    const h = helpers(env, () => w);
    const community = () => env().client(CommunityService);

    describe("societies.spec: receipts (W9)", () => {
      it("receipts stay private (the buyer reads theirs, another student can't) and are deleted 90 days after the event", async () => {
        const president = await h.onboarded("Hina Receipts");
        const secretary = await h.onboarded("Saad Receipts");
        const buyer = await h.onboarded(unique("Zara Receipts"));
        const other = await h.onboarded(unique("Omar Receipts"));
        const s = await h.society(president, [secretary]);
        const { methodId } = await community().proposePaymentMethod(
          { societyId: s.id, action: "add", kind: "bank", bankName: "Meezan Bank", accountTitle: s.name.slice(0, 80), accountNumber: "PK36MEZN0000001234567890" },
          h.as(president.token),
        );
        await community().confirmPaymentMethod({ methodId, accept: true }, h.as(secretary.token));
        const { eventId, ticketId } = await h.event(president, s.id, { seats: 10, price: 1500, startsIn: 5 * 86_400_000, refundDays: 3 });
        const { registrationId } = await community().registerEvent({ eventId, ticketTypeId: ticketId, answersJson: "[]" }, h.as(buyer.token));

        // Not uploaded yet: refused; uploaded into the registration's folder: attached.
        const hash = "b".repeat(64);
        const never = `${eventId}/${registrationId}/${crypto.randomUUID()}.webp`;
        await expect(community().submitReceipt({ registrationId, path: never, hash, phash: "0f0f0f0f0f0f0f0f" }, h.as(buyer.token))).rejects.toSatisfy(
          (e) => refusalReason(e) === "upload_receipt_again",
        );
        const path = await upload(env(), w.store, buyer.token, "event-receipts", { folder: `${eventId}/${registrationId}` });
        await community().submitReceipt({ registrationId, path, hash, phash: "0f0f0f0f0f0f0f0f" }, h.as(buyer.token));

        // Private: the buyer's own link opens it; another student gets none; community (for officers) can sign one.
        const links = (token: string) => env().client(MediaService).downloadLinks({ bucket: "event-receipts", paths: [path], ttlSeconds: 0 }, env().call({ userToken: token }));
        const mine = (await links(buyer.token)).links;
        expect(mine).toHaveLength(1);
        expect(w.store.read(mine[0]!.url)).not.toBeNull();
        expect((await links(other.token)).links).toEqual([]);
        expect((await env().client(MediaService, "community").downloadLinks({ bucket: "event-receipts", paths: [path], ttlSeconds: 0 }, env().call())).links).toHaveLength(1);

        // 90 days after the event: released by community's close-out, deleted by media.
        await w.community`update community.events set starts_at = now() - interval '92 days', ends_at = now() - interval '91 days' where id = ${eventId}`;
        await w.community.begin((tx) => closeoutPayments(tx));
        await drain(w, env().host);
        expect(w.store.files.has(`event-receipts/${path}`)).toBe(false);
      });
    });
  },
  notifyWorld((x) => (w = x), worlds),
);
