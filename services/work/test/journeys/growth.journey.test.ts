/**
 * Journeys: apps/web/tests/e2e/github.spec.ts and growth.spec.ts, through the contracts on both transports, with
 * the fake GitHub. Facts that belong to other services' future events (ranking tiers, W6) are written to work's
 * own copy tables, as those events will. Web-only parts are `it.todo` for W13.
 */
import { MessagingService } from "@skilient/contracts/messaging/v1/messaging_pb";
import { WorkService } from "@skilient/contracts/work/v1/work_pb";
import { refusalReason } from "@skilient/platform";
import { describeTransports } from "@skilient/testing";
import { afterAll, describe, expect, it } from "vitest";
import { usernameOf } from "../../../people/test/contract/world";
import { patchOf } from "../contract/fake-github";
import { drainCopies, NU, runJobs, stopWorlds, student, workWorld, type WorkWorld } from "../contract/world";

const worlds: WorkWorld[] = [];
let w: WorkWorld;
afterAll(() => stopWorlds(worlds));

describeTransports(
  ["identity", "people", "content", "messaging", "realtime", "work"],
  (env) => {
    const work = () => env().client(WorkService);
    const as = (token: string) => ({ ...env().call({ userToken: token }), headers: { "idempotency-key": crypto.randomUUID() } });
    const read = (token: string) => env().call({ userToken: token });
    const onboarded = async (fullName: string, uni?: typeof NU) => {
      const s = await student(w, { fullName, ...(uni ? { uni } : {}) });
      await drainCopies(w);
      return s;
    };
    const json = <T>(r: { json: string }) => JSON.parse(r.json) as T;
    let repoSeq = 7300;
    /** A connected student with one owned repository and `days` Python commits on it. */
    const connected = async (name: string, days = 3) => {
      const s = await onboarded(name);
      const id = ++repoSeq;
      const login = `gh${id}`;
      const repo = { id, full_name: `${login}/app`, owner_id: 20_000 + id, languages: { Python: 1000 } };
      w.github.account(`code-${id}`, { id: 20_000 + id, login, installation: 6000 + id, repos: [repo] });
      const py = Array.from({ length: 60 }, (_, i) => `v_${i} = run(${i})`);
      for (let i = 0; i < days; i++)
        w.github.commit(id, { sha: `${id.toString(16).padStart(8, "0")}${"d".repeat(31)}${i}`, authorId: 20_000 + id, authorLogin: login, date: `2026-11-0${1 + 2 * i}T10:00:00Z`, files: [{ filename: `m${i}.py`, additions: 60, patch: patchOf(py) }] });
      expect((await work().connectGithub({ code: `code-${id}`, installationId: BigInt(6000 + id) }, as(s.token))).status).toBe("linked");
      await runJobs(w);
      return { ...s, repoId: id, login };
    };

    describe("github.spec", () => {
      it("a connected student sees their repositories, can exclude one and can disconnect", async () => {
        const s = await connected("Repo Student");
        const o = await work().githubOverview({ withRepos: true }, read(s.token));
        expect(o.repos.map((r) => [r.fullName, r.excluded])).toEqual([[`${s.login}/app`, false]]);
        await work().setRepoExcluded({ repoId: BigInt(s.repoId), excluded: true }, as(s.token));
        expect((await work().mySkills({}, read(s.token))).skills).toEqual([]);
        await work().setRepoExcluded({ repoId: BigInt(s.repoId), excluded: false }, as(s.token));
        expect((await work().mySkills({}, read(s.token))).skills.map((x) => x.skillId)).toContain("python");
        expect((await work().disconnectGithub({}, as(s.token))).disconnected).toBe(true);
        expect((await work().githubOverview({ withRepos: true }, read(s.token))).connected).toBe(false);
      });

      it("skills show their level to classmates, and their evidence to the owner only", async () => {
        const s = await connected("Skill Owner");
        const mate = await onboarded("Skill Classmate");
        const levels = await env().client(WorkService, "people").skillsOf({ userIds: [s.id] }, env().call());
        expect(levels.skills.find((x) => x.skillId === "python")?.level).toBe(2);
        expect((await work().skillEvidence({ skillId: "python" }, read(mate.token))).items).toEqual([]);
        expect((await work().skillEvidence({ skillId: "python" }, read(s.token))).total).toBe(3);
      });

      it("a webhook delivery is recorded once; its replay is ignored", async () => {
        const deliveryId = crypto.randomUUID();
        const req = { deliveryId, event: "installation", action: "suspend", installationId: 999n, payloadJson: JSON.stringify({ installation: { id: 999 } }) };
        expect((await work().recordGithubWebhook(req, env().call())).recorded).toBe(true);
        expect((await work().recordGithubWebhook(req, env().call())).recorded).toBe(false);
        await runJobs(w);
        const [e] = await w.work<{ processed: boolean }[]>`select processed_at is not null as processed from work.github_webhook_events where delivery_id = ${deliveryId}`;
        expect(e!.processed).toBe(true);
      });

      it.todo("W13: the OAuth state per user and the callback refusing another's state; the signature check on deliveries (web verifies, then calls RecordGithubWebhook)");
      it.todo("W13: onboarding's Connect GitHub step and skipping it; the settings page, axe in both themes");
    });

    describe("growth.spec: paths", () => {
      it("starter order, then the data order at 10 seniors; a GitHub-proved task; a peer never reviews a friend", async () => {
        const s = await connected("Hira Path");
        const peer = await onboarded("Rehan Peer", NU);
        const friend = await onboarded("Faraz Friend");
        const recompute = async () => {
          const { computePaths } = await import("../../src/store/paths");
          await w.work.begin((tx) => computePaths(tx));
        };
        await recompute();
        let view = json<{ source: string; steps: { skill_id: string }[] }>(await work().pathView({ role: "devops" }, read(s.token)));
        expect([view.source, view.steps[0]!.skill_id]).toEqual(["starter", "shell"]);
        // 10 seniors at Shine with 7 DevOps skills at L2, Docker first: the data order.
        const seniors = Array.from({ length: 10 }, () => crypto.randomUUID());
        await w.work`insert into work.members (user_id, role, onboarding_complete) select x, 'student', true from unnest(${seniors}::uuid[]) x`;
        await w.work`insert into work.ranking_tiers (user_id, tier, ranked) select x, 'shine', true from unnest(${seniors}::uuid[]) x`;
        await w.work`
          insert into work.user_skills (user_id, skill_id, level, l2_at)
          select x, s.skill, 2, now() - interval '300 days' + make_interval(days => s.d) from unnest(${seniors}::uuid[]) x,
                 (values ('docker', 0), ('shell', 20), ('github-actions', 40), ('nginx', 60), ('terraform', 80), ('aws', 100), ('docker-compose', 120)) as s(skill, d)`;
        await recompute();
        view = json(await work().pathView({ role: "devops" }, read(s.token)));
        expect([view.source, view.steps[0]!.skill_id]).toEqual(["data", "docker"]);
        await work().followPath({ role: "devops", follow: true }, as(s.token));
        const [fact] = await w.work<{ payload: { value: { skill_id: string } } }[]>`
          select payload from platform.events where type = 'fact.value_changed' and ${s.id}::uuid = any(subjects) order by txid desc, seq desc limit 1`;
        expect(fact!.payload.value.skill_id).toBe("docker");

        // A task proved by GitHub: a counted Docker commit after it started.
        const [task] = await w.work<{ id: string }[]>`
          insert into work.proof_tasks (skill_id, title, difficulty, brief, checklist)
          values ('docker', 'Ship a container', 'starter', 'Write a Dockerfile for one of your projects so it runs with one command anywhere.', '["docker build works from a clean checkout", "The image runs as a non-root user", "The README has the command"]') returning id::text`;
        const { attemptId } = await work().startTask({ taskId: task!.id }, as(s.token));
        await work().linkTaskRepo({ attemptId, repoId: BigInt(s.repoId) }, as(s.token));
        w.github.commit(s.repoId, { sha: `${"e".repeat(40)}`, authorId: 20_000 + s.repoId, authorLogin: s.login, date: new Date().toISOString(), files: [{ filename: "Dockerfile", additions: 5, patch: patchOf(["FROM python:3.12", "COPY . .", "USER app", "RUN pip install .", "CMD [\"app\"]"]) }] });
        await work().submitTask({ attemptId }, as(s.token));
        await runJobs(w);
        const done = json<{ status: string; verified_by: string }>(await work().myTask({ attemptId }, read(s.token)));
        expect([done.status, done.verified_by]).toEqual(["done", "github"]);
        const [completed] = await w.work<{ n: number }[]>`select count(*)::int as n from platform.events where type = 'task.completed' and ${attemptId}::uuid = any(subjects)`;
        expect(completed!.n).toBe(1);

        // Peers: Helm at L2 for a peer and a friend; only the peer is offered the review.
        await w.work`insert into work.user_skills (user_id, skill_id, level) values (${peer.id}, 'helm', 2), (${friend.id}, 'helm', 2) on conflict do nothing`;
        await w.work`delete from work.user_skills where skill_id = 'helm' and level >= 2 and user_id not in (${peer.id}, ${friend.id})`;
        await w.work`insert into work.friendships (user_id_a, user_id_b) values (least(${s.id}::uuid, ${friend.id}::uuid), greatest(${s.id}::uuid, ${friend.id}::uuid))`;
        const [helm] = await w.work<{ id: string }[]>`
          insert into work.proof_tasks (skill_id, title, difficulty, brief, checklist)
          values ('helm', 'Chart a service', 'core', 'Package one of your services as a Helm chart with values for two environments.', '["The chart installs with helm install", "Values differ for staging and production", "The README explains the values"]') returning id::text`;
        const { attemptId: second } = await work().startTask({ taskId: helm!.id }, as(s.token));
        await work().linkTaskRepo({ attemptId: second, repoId: BigInt(s.repoId) }, as(s.token));
        await work().submitTask({ attemptId: second }, as(s.token));
        await w.work`update work.task_attempts set submitted_at = now() - interval '2 hours' where id = ${second}`;
        const { proofTasksTick } = await import("../../src/store/tasks");
        await w.work.begin((tx) => proofTasksTick(tx));
        const offered = await w.work<{ reviewer_id: string; id: string }[]>`select reviewer_id::text, id::text from work.task_reviews where attempt_id = ${second}`;
        expect(offered.map((r) => r.reviewer_id)).toEqual([peer.id]);
        await work().acceptTaskReview({ reviewId: offered[0]!.id }, as(peer.token));
        await work().reviewTask({ reviewId: offered[0]!.id, confirm: true, note: "", ticks: [true, true, true] }, as(peer.token));
        expect(json<{ status: string; verified_by: string }>(await work().myTask({ attemptId: second }, read(s.token))).verified_by).toBe("peer");
      });

      it.todo("W13: /me/paths, the square drawer, /me/tasks and the review page, axe in both themes");
    });

    describe("growth.spec: skill swap", () => {
      it("request, accept, DM, a confirmed session, a thank-you note, one Taught entry", async () => {
        const teacher = await onboarded("Tara Teacher");
        const learner = await onboarded("Lalo Learner");
        await w.work`insert into work.user_skills (user_id, skill_id, level) values (${teacher.id}, 'typescript', 2)`;
        await work().saveSwapOffer({ skillId: "typescript", note: "Happy to teach", on: true }, as(teacher.token));
        await work().saveSwapWant({ skillId: "typescript", note: "", on: true }, as(learner.token));
        const teachers = json<{ user_id: string }[]>(await work().swapTeachers({ skillId: "typescript" }, read(learner.token)));
        expect(teachers.map((t) => t.user_id)).toEqual([teacher.id]);
        const { swapId } = await work().requestSwap({ teacherUsername: await usernameOf(w, teacher.id), skillId: "typescript", note: "Please", preferredTimes: "Evenings", offeredSkillId: "" }, as(learner.token));
        await expect(
          work().requestSwap({ teacherUsername: await usernameOf(w, teacher.id), skillId: "typescript", note: "", preferredTimes: "", offeredSkillId: "" }, as(learner.token)),
        ).rejects.toSatisfy((e) => refusalReason(e) === "swap_open_already");
        await work().respondSwap({ swapId, accept: true }, as(teacher.token));
        await drainCopies(w);
        const dm = await env().client(MessagingService).getOrCreateDm({ username: await usernameOf(w, learner.id) }, as(teacher.token));
        expect(dm.threadId).not.toBe("");
        const startsAt = new Date(Date.now() + 86_400_000).toISOString();
        const { sessionId } = await work().proposeSwapSession({ swapId, startsAt, minutes: 60, place: "Library, room 2" }, as(teacher.token));
        await work().respondSwapSession({ sessionId, accept: true }, as(learner.token));
        await w.work`update work.swap_sessions set starts_at = now() - interval '2 hours' where id = ${sessionId}`;
        await work().confirmSwapSession({ sessionId, happened: true, minutes: 60, reason: "", note: "Thank you, very clear" }, as(learner.token));
        const page = json<{ sessions: { note_id: string }[] }>(await work().swapPage({ swapId }, read(teacher.token)));
        await work().decideSwapNote({ noteId: page.sessions[0]!.note_id, approve: true }, as(teacher.token));
        const notes = json<{ minutes: number; notes: { body: string }[] }>(await work().swapNotesFor({ userId: teacher.id }, read(learner.token)));
        expect([notes.minutes, notes.notes.map((n) => n.body)]).toEqual([60, ["Thank you, very clear"]]);
        await work().endSwap({ swapId }, as(learner.token));
        const closed = await w.work<{ payload: { sessions: number; minutes: number } }[]>`select payload from platform.events where type = 'swap.closed' and ${swapId}::uuid = any(subjects)`;
        expect(closed.map((c) => [c.payload.sessions, c.payload.minutes])).toEqual([[1, 60]]);
      });

      it.todo("W8: the Taught entry is issued on the teacher's Record from swap.closed");
      it.todo("W13: /swaps tabs, the swap page and the profile's notes, axe in both themes");
    });
  },
  workWorld((x) => (w = x), worlds),
);
