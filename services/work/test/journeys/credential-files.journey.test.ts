/**
 * Journey: the file half of apps/web/tests/e2e/evidence.spec.ts's credentials (W9 hand-off to media), through the
 * real services' contracts on both transports with media's in-memory store: the PDF is stored privately in the
 * credentials bucket, attached only by its uploader and only once stored, readable by the student and through work
 * (which signs links for the Trust reviewers it lets see the case), never by another student; deleting the credential
 * deletes the file.
 */
import { MediaService } from "@skilient/contracts/media/v1/media_pb";
import { WorkService } from "@skilient/contracts/work/v1/work_pb";
import { refusalReason } from "@skilient/platform";
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
    const pdf = new TextEncoder().encode("%PDF-1.7 certificate");

    describe("evidence.spec: credential files (W9)", () => {
      it("the PDF is stored privately; only the student and reviewers (through work) can open it; it goes with the credential", async () => {
        const student = await h.onboarded("Sana Evidence");
        const other = await h.onboarded("Omar Evidence");
        const submit = (token: string, path: string) =>
          env().client(WorkService).submitCredential({ path, title: "AWS Cloud Practitioner", issuer: "Amazon Web Services", issuedOn: "2026-09-01", expiresOn: "", verifyUrl: "" }, as(token));
        await expect(submit(student.token, `${student.id}/${crypto.randomUUID()}.pdf`)).rejects.toSatisfy((e) => refusalReason(e) !== null);
        const path = await upload(env(), w.store, student.token, "credentials", { mime: "application/pdf", bytes: pdf });
        await expect(submit(other.token, path)).rejects.toSatisfy((e) => refusalReason(e) !== null);
        const { credentialId } = await submit(student.token, path);

        const links = (token: string) => env().client(MediaService).downloadLinks({ bucket: "credentials", paths: [path], ttlSeconds: 0 }, env().call({ userToken: token }));
        const mine = (await links(student.token)).links;
        expect(w.store.read(mine[0]!.url)).toEqual(pdf);
        expect((await links(other.token)).links).toEqual([]);
        const forReviewer = (await env().client(MediaService, "work").downloadLinks({ bucket: "credentials", paths: [path], ttlSeconds: 300 }, env().call())).links;
        expect(w.store.read(forReviewer[0]!.url)).toEqual(pdf);

        await env().client(WorkService).deleteCredential({ credentialId }, as(student.token));
        await drain(w, env().host);
        expect(w.store.files.has(`credentials/${path}`)).toBe(false);
      });
    });
  },
  notifyWorld((x) => (w = x), worlds),
);
