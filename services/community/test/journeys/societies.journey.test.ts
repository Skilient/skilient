/**
 * Journey: apps/web/tests/e2e/societies.spec.ts, "a society goes from request to verified to its first induction
 * round, and posts as itself", through the contracts on both transports. Community, content (the post as the
 * society and its byline) and people (names) are the real services. Web-only parts are `it.todo` for W13.
 */
import { CommunityService } from "@skilient/contracts/community/v1/community_pb";
import { ContentService } from "@skilient/contracts/content/v1/content_pb";
import { describeTransports } from "@skilient/testing";
import { ConnectError } from "@connectrpc/connect";
import { refusalReason } from "@skilient/platform";
import { afterAll, describe, expect, it } from "vitest";
import { usernameOf } from "../../../people/test/contract/world";
import { helpers, unique } from "../contract/helpers";
import { communityWorld, drain, eventsOf, stopWorlds, type CommunityWorld } from "../contract/world";

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
    const content = () => env().client(ContentService);

    describe("societies.spec: request, verify, inductions, post as the society", () => {
      it("a society goes from request to verified to its first induction round, and posts as itself", async () => {
        const name = unique("Robotics Circle");
        const president = await h.onboarded("Parveen President");
        const member = await h.onboarded("Mehwish Member");
        const reviewer = await h.onboarded("Tariq Trust", { staffRoles: ["trust_reviewer"] });

        // Request, with a proof document in the requester's own folder.
        const proof = `${president.id}/${crypto.randomUUID()}.pdf`;
        const { societyId } = await community().requestSociety(
          { name, category: "technology", about: "We build small robots and teach first-years to solder.", proofPath: proof, officeBearer: true },
          h.as(president.token),
        );
        const [row] = await w.community<{ slug: string; proof_path: string; status: string }[]>`
          select s.slug, r.proof_path, s.status from community.societies s join community.society_requests r on r.society_id = s.id where s.id = ${societyId}`;
        expect([row!.proof_path, row!.status]).toEqual([proof, "pending"]);
        expect(h.json<{ status: string }[]>(await community().mySocietyRequests({}, h.read(president.token))).map((r) => r.status)).toEqual(["pending"]);

        // A duplicate name is caught while typing ("The X Society" is the same name).
        const check = h.json<{ available: boolean; name: string; university: string }>(await community().societyNameCheck({ name: `The ${name} Society` }, h.read(member.token)));
        expect([check.available, check.name]).toEqual([false, name]);
        expect(check.university).toBe("National University of Technology (NUTECH)");

        // Trust review in /ops: claim, approve (audited before and after).
        const queue = h.json<{ society_id: string; requester: string }[]>(await community().opsSocieties({ status: "open" }, h.read(reviewer.token)));
        expect(queue.find((q) => q.society_id === societyId)?.requester).toBe("Parveen President");
        const cased = h.json<{ proof_path: string }>(await community().opsSocietyCase({ societyId }, h.read(reviewer.token)));
        expect(cased.proof_path).toBe(proof);
        await community().claimSociety({ societyId, claim: true }, h.as(reviewer.token));
        await community().decideSociety({ societyId, action: "approve", reason: "" }, h.as(reviewer.token));
        const audit = await w.community<{ action: string; before: unknown; after: unknown }[]>`
          select action, before, after from community.audit_log where target_id = ${societyId} order by created_at, action`;
        expect(audit.map((a) => a.action).sort()).toEqual(["society.approve", "society.claim"]);
        expect(audit.find((a) => a.action === "society.approve")).toMatchObject({ before: { status: "pending", request_status: "pending" }, after: { status: "verified" } });
        expect((await eventsOf(w, "audit.recorded")).filter((e) => e.payload["target_id"] === societyId)).toHaveLength(2);
        await drain(w);

        // The President sets it up: inductions only, a round with a question.
        const page = h.json<{ checklist: Record<string, boolean>; officer: boolean; president: boolean; roll_call: { name: string; title: string }[] }>(
          await community().societyPage({ slug: row!.slug }, h.read(president.token)),
        );
        expect([page.officer, page.president, page.checklist["logo"], page.roll_call]).toEqual([true, true, false, [expect.objectContaining({ name: "Parveen President", title: "President" })]]);
        const manage = h.json<{ members: { name: string; role: string }[] }>(await community().societyManage({ societyId }, h.read(president.token)));
        expect(manage.members.map((m) => [m.name, m.role])).toEqual([["Parveen President", "president"]]);
        await community().setMembershipMode({ societyId, mode: "inductions" }, h.as(president.token));
        const deadline = new Date(Date.now() + 7 * 86_400_000).toISOString();
        const { roundId } = await community().saveInductionRound(
          { societyId, title: unique("Fall inductions"), deadline, roles: [{ title: "Hardware lead", seats: 1 }], questions: ["What have you built so far?"] },
          h.as(president.token),
        );
        await community().publishInductionRound({ roundId }, h.as(president.token));
        expect(h.json<{ status: string }>(await community().inductionRoundPage({ roundId }, h.read(president.token))).status).toBe("open");

        // A student applies; the President accepts; they're a member.
        expect(await reason(community().joinSociety({ societyId }, h.as(member.token)))).toBe("join_by_inductions");
        const visible = h.json<{ rounds: { id: string }[] }>(await community().societyPage({ slug: row!.slug }, h.read(member.token)));
        expect(visible.rounds.map((r) => r.id)).toEqual([roundId]);
        const round = h.json<{ roles: { id: string }[] }>(await community().inductionRoundPage({ roundId }, h.read(member.token)));
        await community().applyInduction({ roundId, roleId: round.roles[0]!.id, answers: ["A line-following robot for the science fair."] }, h.as(member.token));
        expect(h.json<{ mine: { status: string } }>(await community().inductionRoundPage({ roundId }, h.read(member.token))).mine.status).toBe("pending");
        const officerView = h.json<{ applications: { id: string; name: string }[] }>(await community().inductionRoundPage({ roundId }, h.read(president.token)));
        expect(officerView.applications.map((a) => a.name)).toEqual(["Mehwish Member"]);
        await community().decideInductionApplication({ applicationId: officerView.applications[0]!.id, action: "accept", note: "" }, h.as(president.token));
        const [m] = await w.community<{ role: string; team_title: string }[]>`select role, team_title from community.society_members where society_id = ${societyId} and user_id = ${member.id}`;
        expect(m).toEqual({ role: "member", team_title: "Hardware lead" });

        // Posting as the society (content learns the society and its officers from community's events), and its byline.
        await drain(w);
        const body = unique("Workshop sign-ups open soon");
        const { postId } = await content().createPost({ type: "general", audience: "university", body, societyId }, h.as(president.token));
        const cards = await content().postCards({ postIds: [postId] }, h.read(member.token));
        expect(JSON.parse(cards.cards[0]!.societyJson)).toEqual({ id: societyId, name, slug: row!.slug, logo_path: null });
        // A member who isn't an officer can't post as the society.
        expect(await reason(content().createPost({ type: "general", audience: "university", body: "Not mine", societyId }, h.as(member.token)))).not.toBeNull();
        // Students have no Event type: only societies post events.
        expect(await reason(content().createPost({ type: "event", audience: "university", body: "My party", event: { startsAt: deadline, place: "Hall" } }, h.as(member.token)))).not.toBeNull();
        expect(await usernameOf(w, president.id)).toBeTruthy();
      });

      it.todo("W13: the request stepper (steps left, the proof upload), the live name check while typing, /ops/societies, the setup checklist, the membership form, the round form, the composer's Post as, the Societies feed chip, axe in both themes");
    });
  },
  communityWorld((x) => (w = x), worlds),
);
