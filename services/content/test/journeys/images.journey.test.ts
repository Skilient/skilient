/**
 * Journey: the image halves of apps/web/tests/e2e/posts.spec.ts (W9 hand-offs to media), through the real services'
 * contracts on both transports with media's in-memory store: images are stored in media's post-media bucket, checked
 * before content attaches them, and content keeps the path; the same for venture updates (work checks them).
 * Re-encoding is web's (W13, in posts.journey.test.ts).
 */
import { ContentService } from "@skilient/contracts/content/v1/content_pb";
import { WorkService } from "@skilient/contracts/work/v1/work_pb";
import { refusalReason } from "@skilient/platform";
import { describeTransports } from "@skilient/testing";
import { afterAll, describe, expect, it } from "vitest";
import { helpers } from "../../../community/test/contract/helpers";
import { upload } from "../../../media/test/world";
import { notifyWorld, stopWorlds as stopAll, type NotifyWorld } from "../../../notify/test/contract/world";

const reason = (e: unknown) => refusalReason(e);
const mediaWorlds: NotifyWorld[] = [];
let mw: NotifyWorld;
afterAll(() => stopAll(mediaWorlds));

describeTransports(
  ["identity", "people", "content", "messaging", "realtime", "work", "ranking", "community", "credentials", "media", "notify"],
  (env) => {
    const h = helpers(env, () => mw);
    const as = (token: string) => ({ ...env().call({ userToken: token }), headers: { "idempotency-key": crypto.randomUUID() } });

    describe("posts.spec: images (W9)", () => {
      it("the image is stored under post-media; an image never uploaded is refused; content keeps the path", async () => {
        const a = await h.onboarded("Parveen Pictures");
        await expect(
          env().client(ContentService).createPost({ type: "general", audience: "university", body: "Missing image", media: [{ path: `${a.id}/${crypto.randomUUID()}.webp`, width: 10, height: 10 }] }, as(a.token)),
        ).rejects.toSatisfy((e) => reason(e) !== null);
        const path = await upload(env(), mw.store, a.token, "post-media");
        const { postId } = await env().client(ContentService).createPost({ type: "general", audience: "university", body: "Robotics club photo", media: [{ path, width: 1200, height: 800 }] }, as(a.token));
        expect(mw.store.files.has(`post-media/${path}`)).toBe(true);
        const [card] = (await env().client(ContentService).postCards({ postIds: [postId] }, env().call({ userToken: a.token }))).cards;
        expect(card!.media.map((m) => m.path)).toEqual([path]);
      });

      it("venture update images are stored under post-media and checked before the update is posted", async () => {
        const owner = await h.onboarded("Vena Updates");
        const { ventureId } = await env().client(WorkService).createVenture({ type: "project", title: "Plover Tracker", description: "Counting birds.", visibility: "public", skillIds: [], roles: [], questions: [] }, as(owner.token));
        await expect(
          env().client(WorkService).postVentureUpdate({ ventureId, body: "First build", media: [{ path: `${owner.id}/${crypto.randomUUID()}.webp`, width: 10, height: 10 }] }, as(owner.token)),
        ).rejects.toSatisfy((e) => reason(e) !== null);
        const path = await upload(env(), mw.store, owner.token, "post-media");
        const { updateId } = await env().client(WorkService).postVentureUpdate({ ventureId, body: "First build", media: [{ path, width: 1200, height: 800 }] }, as(owner.token));
        expect(updateId).not.toBe("");
        expect(mw.store.files.has(`post-media/${path}`)).toBe(true);
      });
    });
  },
  notifyWorld((x) => (mw = x), mediaWorlds),
);
