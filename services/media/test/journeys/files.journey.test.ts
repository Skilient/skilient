/**
 * Journey: apps/web/tests/worker/storage-cleanup.test.ts and the file halves of the posts, onboarding and evidence
 * specs, through the real owners' contracts on both transports with media's in-memory store (test/world.ts). The W9
 * done-when's file half: unused files are deleted (a deleted post's images, a replaced photo, a deleted
 * credential), an image that was never uploaded can't be attached, and a private file opens only for its owner or
 * through the owning service.
 */
import { ContentService } from "@skilient/contracts/content/v1/content_pb";
import { MediaService } from "@skilient/contracts/media/v1/media_pb";
import { PeopleService } from "@skilient/contracts/people/v1/people_pb";
import { WorkService } from "@skilient/contracts/work/v1/work_pb";
import { refusalReason } from "@skilient/platform";
import { describeTransports } from "@skilient/testing";
import { afterAll, describe, expect, it } from "vitest";
import { helpers } from "../../../community/test/contract/helpers";
import { drain, notifyWorld, stopWorlds, type NotifyWorld } from "../../../notify/test/contract/world";
import { upload } from "../world";

const worlds: NotifyWorld[] = [];
let w: NotifyWorld;
afterAll(() => stopWorlds(worlds));

describeTransports(
  ["identity", "people", "content", "messaging", "realtime", "work", "ranking", "community", "credentials", "media", "notify"],
  (env) => {
    const h = helpers(env, () => w);
    const as = (token: string) => ({ ...env().call({ userToken: token }), headers: { "idempotency-key": crypto.randomUUID() } });
    const settle = () => drain(w, env().host);
    const stored = (bucket: string, path: string) => w.store.files.has(`${bucket}/${path}`);

    describe("Files", () => {
      it("a post's image must be uploaded first; deleting the post deletes the image", async () => {
        const a = await h.onboarded("Anum Files");
        const never = `${a.id}/${crypto.randomUUID()}.webp`;
        await expect(
          env().client(ContentService).createPost({ type: "general", audience: "university", body: "Plover chicks!", media: [{ path: never, width: 800, height: 600 }] }, as(a.token)),
        ).rejects.toSatisfy((e) => refusalReason(e) !== null);
        const path = await upload(env(), w.store, a.token, "post-media");
        const { postId } = await env().client(ContentService).createPost({ type: "general", audience: "university", body: "Plover chicks!", media: [{ path, width: 800, height: 600 }] }, as(a.token));
        expect(stored("post-media", path)).toBe(true);
        // Public bucket: anyone reads it by its plain address.
        const b = await h.onboarded("Bina Files");
        expect((await env().client(MediaService).downloadLinks({ bucket: "post-media", paths: [path], ttlSeconds: 0 }, env().call({ userToken: b.token }))).links).toHaveLength(1);
        await env().client(ContentService).deletePost({ postId }, as(a.token));
        await settle();
        expect(stored("post-media", path)).toBe(false);
      });

      it("a replaced profile photo is deleted; the new one stays", async () => {
        const a = await h.onboarded("Anum Photo");
        const first = await upload(env(), w.store, a.token, "avatars");
        await env().client(PeopleService).setProfileImage({ kind: "avatar", path: first }, as(a.token));
        const second = await upload(env(), w.store, a.token, "avatars");
        await env().client(PeopleService).setProfileImage({ kind: "avatar", path: second }, as(a.token));
        await settle();
        expect(stored("avatars", first)).toBe(false);
        expect(stored("avatars", second)).toBe(true);
      });

      it("a credential's PDF is private (the student and the owning service read it, another student can't) and goes with the credential", async () => {
        const a = await h.onboarded("Anum Evidence");
        const other = await h.onboarded("Bina Evidence");
        const path = await upload(env(), w.store, a.token, "credentials", { mime: "application/pdf", bytes: new TextEncoder().encode("%PDF-1.7 plover survey") });
        const { credentialId } = await env().client(WorkService).submitCredential({ path, title: "Plover Survey Certificate", issuer: "Golden Board", issuedOn: "2026-10-01", expiresOn: "", verifyUrl: "" }, as(a.token));
        const links = (token: string) => env().client(MediaService).downloadLinks({ bucket: "credentials", paths: [path], ttlSeconds: 0 }, env().call({ userToken: token }));
        const mine = (await links(a.token)).links;
        expect(mine).toHaveLength(1);
        expect(w.store.read(mine[0]!.url)).toEqual(new TextEncoder().encode("%PDF-1.7 plover survey"));
        expect((await links(other.token)).links).toEqual([]);
        expect((await env().client(MediaService, "work").downloadLinks({ bucket: "credentials", paths: [path], ttlSeconds: 0 }, env().call())).links).toHaveLength(1);
        // Someone else's file can't be attached as theirs.
        await expect(
          env().client(WorkService).submitCredential({ path, title: "Not Mine", issuer: "Golden Board", issuedOn: "2026-10-01", expiresOn: "", verifyUrl: "" }, as(other.token)),
        ).rejects.toSatisfy((e) => refusalReason(e) !== null);
        await env().client(WorkService).deleteCredential({ credentialId }, as(a.token));
        await settle();
        expect(stored("credentials", path)).toBe(false);
      });

      it("uploads: the bucket's types and sizes, the uploader's own folder, and the per-uploader caps", async () => {
        const a = await h.onboarded("Anum Rules");
        const b = await h.onboarded("Bina Rules");
        const create = (token: string, r: { bucket: string; mime: string; bytes: number; folder?: string }) =>
          env().client(MediaService).createUpload({ bucket: r.bucket, mime: r.mime, bytes: BigInt(r.bytes), folder: r.folder ?? "" }, as(token));
        const why = async (p: Promise<unknown>) => p.then(() => null).catch((e: unknown) => refusalReason(e));
        expect(await why(create(a.token, { bucket: "post-media", mime: "application/pdf", bytes: 10 }))).toBe("file_type");
        expect(await why(create(a.token, { bucket: "post-media", mime: "image/webp", bytes: 6 * 1024 * 1024 }))).toBe("file_size");
        expect(await why(create(a.token, { bucket: "post-media", mime: "image/webp", bytes: 10, folder: b.id }))).toBe("not_your_folder");
        expect(await why(create(a.token, { bucket: "chat-media", mime: "image/webp", bytes: 10 }))).toBe("folder_needed");
        for (let i = 0; i < 5; i++) await create(a.token, { bucket: "society-documents", mime: "application/pdf", bytes: 10 });
        expect(await why(create(a.token, { bucket: "society-documents", mime: "application/pdf", bytes: 10 }))).toBe("too_many_files");
        expect(await why(env().client(MediaService).checkFiles({ bucket: "post-media", paths: [`${a.id}/x.webp`] }, env().call()))).not.toBeNull();
      });
    });
  },
  notifyWorld((x) => (w = x), worlds),
);
