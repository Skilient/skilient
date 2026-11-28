/**
 * Journey: the photo half of apps/web/tests/e2e/onboarding.spec.ts (W9 hand-off to media), through the real services'
 * contracts on both transports with media's in-memory store: the photo is stored in the uploader's folder of the
 * avatars bucket, a replaced photo (and cover) is deleted from storage, and the one in use stays. Re-encoding
 * (WebP 512x512, no EXIF) is web's (W13, onboarding.journey.test.ts).
 */
import { PeopleService } from "@skilient/contracts/people/v1/people_pb";
import { describeTransports } from "@skilient/testing";
import { afterAll, describe, expect, it } from "vitest";
import { helpers } from "../../../community/test/contract/helpers";
import { upload } from "../../../media/test/world";
import { drain, notifyWorld, stopWorlds, type NotifyWorld } from "../../../notify/test/contract/world";

const worlds: NotifyWorld[] = [];
let w: NotifyWorld;
afterAll(() => stopWorlds(worlds));

describeTransports(
  ["identity", "people", "content", "messaging", "realtime", "work", "ranking", "community", "credentials", "media", "notify"],
  (env) => {
    const h = helpers(env, () => w);
    const as = (token: string) => ({ ...env().call({ userToken: token }), headers: { "idempotency-key": crypto.randomUUID() } });
    const stored = (bucket: string, path: string) => w.store.files.has(`${bucket}/${path}`);

    describe("onboarding.spec: photos (W9)", () => {
      it("the stored photo is in the uploader's folder; replaced photos and covers are deleted from storage", async () => {
        const a = await h.onboarded("Ayesha Photos");
        const first = await upload(env(), w.store, a.token, "avatars");
        expect(first.startsWith(`${a.id}/`)).toBe(true);
        await env().client(PeopleService).setProfileImage({ kind: "avatar", path: first }, as(a.token));
        const second = await upload(env(), w.store, a.token, "avatars");
        await env().client(PeopleService).setProfileImage({ kind: "avatar", path: second }, as(a.token));
        const cover1 = await upload(env(), w.store, a.token, "covers");
        await env().client(PeopleService).setProfileImage({ kind: "cover", path: cover1 }, as(a.token));
        const cover2 = await upload(env(), w.store, a.token, "covers");
        await env().client(PeopleService).setProfileImage({ kind: "cover", path: cover2 }, as(a.token));
        await drain(w, env().host);
        expect([stored("avatars", first), stored("avatars", second), stored("covers", cover1), stored("covers", cover2)]).toEqual([false, true, false, true]);
      });
    });
  },
  notifyWorld((x) => (w = x), worlds),
);
