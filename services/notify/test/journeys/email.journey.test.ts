/**
 * Journey: apps/web/tests/worker/notify-worker.test.ts and the notifications spec, through the real producers'
 * contracts on both transports, with Azure Communication Services Email faked (test/fakes.ts). The W9 done-when's email and digest half:
 * an instant email for a friend request (sent once, from notify@), the daily digest of a comment and a mention
 * (never empty, never to someone active), the 60-a-day cap that parks the rest until tomorrow, and an ops alert that
 * goes past it.
 */
import { ContentService } from "@skilient/contracts/content/v1/content_pb";
import { NotifyService } from "@skilient/contracts/notify/v1/notify_pb";
import { PeopleService } from "@skilient/contracts/people/v1/people_pb";
import { describeTransports } from "@skilient/testing";
import { afterAll, describe, expect, it } from "vitest";
import { helpers } from "../../../community/test/contract/helpers";
import { usernameOf } from "../../../people/test/contract/world";
import { drain, notifyWorld, stopWorlds, type NotifyWorld } from "../contract/world";
import { fakeAzureEmail } from "../fakes";
import { noticesOf, runNotifyJobs, runSchedule } from "../world";

/** The address the test account signed up with (people's student() returns it). */
const mail = (p: unknown) => (p as { email: string }).email;
const worlds: NotifyWorld[] = [];
let w: NotifyWorld;
afterAll(() => stopWorlds(worlds));

describeTransports(
  ["identity", "people", "content", "messaging", "realtime", "work", "ranking", "community", "credentials", "media", "notify"],
  (env) => {
    const h = helpers(env, () => w);
    const as = (token: string) => ({ ...env().call({ userToken: token }), headers: { "idempotency-key": crypto.randomUUID() } });
    const settle = () => drain(w, env().host);

    describe("Email", () => {
      it("a friend request is emailed instantly, once, to the confirmed address, from notify@", async () => {
        await w.notify`delete from notify.email_sends`;
        const a = await h.onboarded("Amal Email");
        const b = await h.onboarded("Bari Email");
        await env().client(PeopleService).sendFriendRequest({ username: await usernameOf(w, a.id) }, as(b.token));
        await settle();
        const mailer = fakeAzureEmail();
        await runNotifyJobs(w, env().host, { fetch: mailer.impl }, ["email-drain"]);
        const mine = mailer.sent.filter((s) => s.to === mail(a));
        expect(mine).toHaveLength(1);
        expect(mine[0]).toMatchObject({ subject: "Bari Email wants to be your friend on Skilient", sender: "notify@skilient.com" });
        expect(mine[0]!.text).toContain("https://skilient.test/friends?tab=received");
        // A second run sends nothing more (the queue row is gone; the ledger would refuse a repeat anyway).
        await w.notify`insert into platform.jobs (kind, payload) values ('email-drain', '{}')`;
        await runNotifyJobs(w, env().host, { fetch: mailer.impl }, ["email-drain"]);
        expect(mailer.sent.filter((s) => s.to === mail(a))).toHaveLength(1);
      });

      it("the daily digest: a comment and a mention, grouped, never empty, not to someone active in the last day", async () => {
        await w.notify`delete from notify.email_sends`;
        const author = await h.onboarded("Asma Digest");
        const commenter = await h.onboarded("Bilal Digest");
        const mentioned = await h.onboarded("Chand Digest");
        const active = await h.onboarded("Dur Digest");
        const { postId } = await env().client(ContentService).createPost({ type: "general", audience: "university", body: "Who is coming to the plover count?" }, as(author.token));
        const { postId: other } = await env().client(ContentService).createPost({ type: "general", audience: "university", body: "Lab hours moved to Friday." }, as(active.token));
        await env().client(ContentService).addComment({ postId, parentId: "", body: `Me! @${await usernameOf(w, mentioned.id)} are you coming?` }, as(commenter.token));
        await env().client(ContentService).addComment({ postId: other, parentId: "", body: "Thanks for the heads up." }, as(mentioned.token));
        await env().client(NotifyService).touchActivity({}, as(active.token));
        await settle();
        expect((await noticesOf(w, author.id)).map((x) => x.type)).toEqual(["comment_received"]);
        expect((await noticesOf(w, mentioned.id)).map((x) => x.type)).toEqual(["comment_mention"]);
        const mailer = fakeAzureEmail();
        // 18:07 Pakistan time: the digest; checked as if a day had passed since the comments.
        await runSchedule(w, env().host, "notification-digest", { fetch: mailer.impl });
        await runNotifyJobs(w, env().host, { fetch: mailer.impl, now: () => new Date(Date.now() + 25 * 3600_000) }, ["email-drain"]);
        const to = (u: unknown) => mailer.sent.filter((s) => s.to === mail(u));
        expect(to(author).map((s) => s.subject)).toEqual(["1 thing waiting for you on Skilient"]);
        expect(to(author)[0]!.text).toContain("Bilal Digest commented on your post");
        expect(to(mentioned)[0]!.text).toContain("Bilal Digest mentioned you");
        expect(to(active)).toEqual([]);
        expect(to(commenter)).toEqual([]);
        // Covered: tomorrow's digest has nothing new for them.
        await runSchedule(w, env().host, "notification-digest", { fetch: mailer.impl });
        await runNotifyJobs(w, env().host, { fetch: mailer.impl, now: () => new Date(Date.now() + 49 * 3600_000) }, ["email-drain"]);
        expect(to(author)).toHaveLength(1);
      });

      it("the daily cap: after 60 the rest wait for tomorrow; an ops alert goes past it", async () => {
        await w.notify`delete from notify.email_sends`;
        await w.notify`insert into notify.email_sends (kind, sent_at) select 'instant', now() from generate_series(1, 60)`;
        const a = await h.onboarded("Amal Capped");
        const b = await h.onboarded("Bari Capped");
        await env().client(PeopleService).sendFriendRequest({ username: await usernameOf(w, a.id) }, as(b.token));
        await settle();
        await env().client(NotifyService, "trust").queueOpsAlert(
          { key: "jobs.stuck", state: "firing", title: "Jobs stuck", detail: "The queue has not moved for 10 minutes.", since: new Date().toISOString(), recipients: ["ops@skilient.test"] },
          { ...env().call(), headers: { "idempotency-key": crypto.randomUUID() } },
        );
        const mailer = fakeAzureEmail();
        await runNotifyJobs(w, env().host, { fetch: mailer.impl }, ["email-drain"]);
        expect(mailer.sent.map((s) => s.to)).toEqual(["ops@skilient.test"]);
        expect(mailer.sent[0]!.subject).toBe("[Skilient alert] Jobs stuck");
        const [parked] = await w.notify<{ later: boolean }[]>`select bool_and(not_before > now() + interval '1 minute') as later from notify.email_queue where kind = 'instant'`;
        expect(parked!.later).toBe(true);
      });

      it("a 5xx retries later with the same request id, and the ledger keeps one send", async () => {
        await w.notify`delete from notify.email_sends`;
        await w.notify`delete from notify.email_queue`;
        const a = await h.onboarded("Amal Retry");
        const b = await h.onboarded("Bari Retry");
        await env().client(PeopleService).sendFriendRequest({ username: await usernameOf(w, a.id) }, as(b.token));
        await settle();
        const failing = fakeAzureEmail([{ status: 503, body: { code: "server_error" } }]);
        await runNotifyJobs(w, env().host, { fetch: failing.impl }, ["email-drain"]);
        expect(failing.sent).toEqual([]);
        await w.notify`update notify.email_queue set not_before = now()`;
        await w.notify`update notify.deliveries set lease_until = now() - interval '1 second'`;
        await w.notify`insert into platform.jobs (kind, payload) values ('email-drain', '{}')`;
        const ok = fakeAzureEmail();
        await runNotifyJobs(w, env().host, { fetch: ok.impl }, ["email-drain"]);
        expect(ok.sent.map((s) => s.to)).toEqual([mail(a)]);
      });
    });
  },
  notifyWorld((x) => (w = x), worlds),
);
