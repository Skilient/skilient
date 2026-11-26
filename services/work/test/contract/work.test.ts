/**
 * work's contract on both transports, co-hosted with identity, people, content, messaging and realtime: every
 * method is implemented, every caller rule holds, ventures work through the contract as web calls them (with the
 * events other services read), and GitHub connect plus the harvest job turn commits into levels against a fake
 * GitHub. Golden replays (test/golden) pin the rules; these pin the wiring, the events and the job.
 */
import { Code, ConnectError } from "@connectrpc/connect";
import { WorkService } from "@skilient/contracts/work/v1/work_pb";
import { refusalReason } from "@skilient/platform";
import { describeTransports } from "@skilient/testing";
import { afterAll, expect, it } from "vitest";
import { usernameOf } from "../../../people/test/contract/world";
import { patchOf } from "./fake-github";
import { drainCopies, runJobs, stopWorlds, student, workWorld, type WorkWorld } from "./world";

const worlds: WorkWorld[] = [];
let w: WorkWorld;
afterAll(() => stopWorlds(worlds));

const reason = (e: unknown) => refusalReason(e) ?? `code ${ConnectError.from(e).code}`;
const code = (e: unknown) => ConnectError.from(e).code;

const BATCH: Record<string, string> = { ventureCards: "content", ventureTitles: "messaging", skillsOf: "people", skillCatalogue: "people" };

describeTransports(
  ["identity", "people", "content", "messaging", "realtime", "work"],
  (env) => {
    const work = (as = "web") => env().client(WorkService, as);
    const as = (token: string) => ({ ...env().call({ userToken: token }), headers: { "idempotency-key": crypto.randomUUID() } });
    const read = (token: string) => env().call({ userToken: token });
    const events = async (type: string, subject: string) =>
      w.work<{ payload: Record<string, unknown>; producer: string }[]>`
        select payload, producer from platform.events where type = ${type} and ${subject}::uuid = any(subjects) order by txid, seq`;
    const onboarded = async (fullName: string) => {
      const s = await student(w, { fullName });
      await drainCopies(w);
      return s;
    };

    it("implements every method in the contract", async () => {
      for (const m of WorkService.methods) {
        const fn = (work(BATCH[m.localName] ?? "web") as unknown as Record<string, (req: object, o: object) => Promise<unknown>>)[m.localName]!;
        const err = await fn({}, env().call()).then(
          () => null,
          (e: unknown) => e,
        );
        if (err) expect([m.localName, code(err)]).not.toEqual([m.localName, Code.Unimplemented]);
      }
    });

    it("refuses callers outside each method's list", async () => {
      await expect(work("content").createVenture({}, env().call())).rejects.toSatisfy((e) => code(e) === Code.PermissionDenied);
      await expect(work("web").ventureCards({}, env().call())).rejects.toSatisfy((e) => code(e) === Code.PermissionDenied);
      await expect(work("web").ventureTitles({}, env().call())).rejects.toSatisfy((e) => code(e) === Code.PermissionDenied);
      await expect(work("messaging").skillsOf({}, env().call())).rejects.toSatisfy((e) => code(e) === Code.PermissionDenied);
    });

    it("a venture through the contract: create, invite, accept, events for people, content and messaging", async () => {
      const owner = await onboarded("Venture Owner");
      const mate = await onboarded("Venture Mate");
      const { ventureId } = await work().createVenture(
        { type: "project", title: "Contract Robotics", description: "Robots.", skillIds: ["python"], roles: [{ title: "Dev", skillIds: [], slots: 1 }], questions: [] },
        as(owner.token),
      );
      const [created] = await events("venture.updated", ventureId);
      expect(created!.payload).toMatchObject({ venture_id: ventureId, owner_id: owner.id, status: "recruiting", visibility: "public" });
      expect(created!.producer).toBe("svc_work");
      const { inviteId } = await work().inviteToVenture({ ventureId, username: await usernameOf(w, mate.id) }, as(owner.token));
      expect((await events("badge.count_changed", mate.id)).filter((e) => e.payload["key"] === "ventures.invites").slice(-1)[0]!.payload).toMatchObject({ count: 1 });
      expect((await work().respondInvite({ inviteId, accept: true }, as(mate.token))).status).toBe("accepted");
      const joined = await events("group.member_changed", mate.id);
      expect(joined.slice(-1)[0]!.payload).toMatchObject({ kind: "venture", group_id: ventureId, user_id: mate.id, member: true });
      // The page, as the mate sees it; another's double invite refused.
      const page = await work().getVenture({ ventureId }, read(mate.token));
      expect([page.isMember, page.isOwner, page.members, page.team.map((t) => t.userId)]).toEqual([true, false, 2, [owner.id, mate.id]]);
      await expect(work().inviteToVenture({ ventureId, username: await usernameOf(w, mate.id) }, as(owner.token))).rejects.toSatisfy((e) => reason(e) === "already_member");
      // The batch reads: content's card and messaging's title.
      const cards = await work("content").ventureCards({ viewerId: mate.id, ventureIds: [ventureId] }, env().call());
      expect(cards.cards.map((c) => [c.title, c.isMember, c.members])).toEqual([["Contract Robotics", true, 2]]);
      expect((await work("messaging").ventureTitles({ ventureIds: [ventureId] }, env().call())).ventures).toEqual([expect.objectContaining({ ventureId, title: "Contract Robotics" })]);
    });

    it("GitHub connect and the harvest job: the account, the repositories, the commits, the levels and their events", async () => {
      const dev = await onboarded("Harvest Dev");
      const repo = { id: 7001, full_name: "harvestdev/app", owner_id: 9001, languages: { Python: 1000 } };
      w.github.account("code-harvest", { id: 9001, login: "harvestdev", installation: 5001, repos: [repo] });
      const py = Array.from({ length: 60 }, (_, i) => `value_${i} = compute(${i})`);
      for (const [i, day] of ["2026-11-01", "2026-11-03", "2026-11-05"].entries())
        w.github.commit(repo.id, {
          sha: `${"a".repeat(39)}${i}`,
          authorId: 9001,
          authorLogin: "harvestdev",
          date: `${day}T10:00:00Z`,
          files: [{ filename: `src/module_${i}.py`, additions: 60, patch: patchOf(py) }],
        });
      expect((await work().connectGithub({ code: "code-harvest", installationId: 5001n }, as(dev.token))).status).toBe("linked");
      expect((await work().connectGithub({ code: "code-unknown", installationId: 0n }, as(dev.token))).status).toBe("failed");
      await runJobs(w);
      const overview = await work().githubOverview({ withRepos: true }, read(dev.token));
      const [job] = await w.work<{ error: string | null }[]>`select error from work.github_sync_jobs order by id desc limit 1`;
      expect(job!.error).toBeNull();
      expect([overview.connected, overview.login, overview.sync?.status, overview.repos.map((r) => [r.fullName, r.kind])]).toEqual([
        true,
        "harvestdev",
        "done",
        [["harvestdev/app", "owned"]],
      ]);
      const skills = await work().mySkills({}, read(dev.token));
      expect(skills.skills.find((s) => s.skillId === "python")).toMatchObject({ level: 2, activeDays: 3, repos: 1 });
      const changed = (await events("skill.changed", dev.id)).map((e) => e.payload);
      expect(changed).toContainEqual({ user_id: dev.id, skill_id: "python", skill_label: "Python", level: 2, category: "language" });
      expect((await events("milestone.reached", dev.id)).map((e) => e.payload["key"])).toEqual(expect.arrayContaining(["github.connected", "skills.l2"]));
      // The drawer: the three commits, counted.
      const drawer = await work().skillEvidence({ skillId: "python" }, read(dev.token));
      expect([drawer.total, drawer.items.map((i) => i.status)]).toEqual([3, ["counted", "counted", "counted"]]);
      // Disconnecting drops the shared repositories and the levels they showed.
      expect((await work().disconnectGithub({}, as(dev.token))).disconnected).toBe(true);
      expect((await work().mySkills({}, read(dev.token))).skills).toEqual([]);
    });
  },
  workWorld((x) => (w = x), worlds),
);
