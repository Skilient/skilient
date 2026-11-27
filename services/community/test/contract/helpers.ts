/**
 * Shared steps for community's contract tests and journeys: calls as a student, a verified society set up through
 * the contract (request, staff approval), officers invited and accepted, and an event created and published.
 */
import { CommunityService } from "@skilient/contracts/community/v1/community_pb";
import type { ContractEnv } from "@skilient/testing";
import { usernameOf } from "../../../people/test/contract/world";
import { drain, student, type CommunityWorld } from "./world";

export interface Person {
  id: string;
  token: string;
}

let n = 0;
export const unique = (s: string) => `${s} ${Date.now().toString(36)}${++n}`;

export function helpers(env: () => ContractEnv, world: () => CommunityWorld) {
  const community = () => env().client(CommunityService);
  const as = (token: string) => ({ ...env().call({ userToken: token }), headers: { "idempotency-key": crypto.randomUUID() } });
  const read = (token: string) => env().call({ userToken: token });
  const onboarded = async (fullName: string, opts: { staffRoles?: string[]; department?: string; year?: number } = {}): Promise<Person> => {
    const s = await student(world(), {
      fullName,
      ...(opts.staffRoles ? { staffRoles: opts.staffRoles } : {}),
      ...(opts.department || opts.year ? { onboard: { ...(opts.department ? { department: opts.department } : {}), ...(opts.year ? { year: opts.year } : {}) } } : {}),
    });
    await drain(world());
    return s;
  };
  const json = <T = Record<string, unknown>>(r: { json: string }) => JSON.parse(r.json) as T;

  /** A society requested by `president` and approved by a trust reviewer (audited), with `officers` invited and accepted. */
  async function society(president: Person, officers: Person[] = [], opts: { name?: string; reviewer?: Person } = {}) {
    const name = opts.name ?? unique("Wren Club");
    const { societyId } = await community().requestSociety(
      { name, category: "technology", about: "A society for the contract tests of community.", proofUrl: "https://example.org/notice", officeBearer: true },
      as(president.token),
    );
    const reviewer = opts.reviewer ?? (await onboarded(unique("Trust Reviewer"), { staffRoles: ["trust_reviewer"] }));
    await community().claimSociety({ societyId, claim: true }, as(reviewer.token));
    await community().decideSociety({ societyId, action: "approve", reason: "" }, as(reviewer.token));
    const today = new Date().toISOString().slice(0, 10);
    const later = new Date(Date.now() + 200 * 86_400_000).toISOString().slice(0, 10);
    for (const o of officers) {
      const { inviteId } = await community().inviteOfficer(
        { societyId, username: await usernameOf(world(), o.id), title: "General Secretary", termStart: today, termEnd: later },
        as(president.token),
      );
      await community().answerSocietyInvite({ inviteId, accept: true }, as(o.token));
    }
    await drain(world());
    const [s] = await world().community<{ slug: string }[]>`select slug from community.societies where id = ${societyId}`;
    return { id: societyId, slug: s!.slug, name, reviewer };
  }

  /** A published event of `societyId`: one session `startsIn` ms from now lasting `hours`, one ticket type. */
  async function event(
    officer: Person,
    societyId: string,
    opts: { title?: string; seats?: number; price?: number; startsIn?: number; hours?: number; question?: string; refundDays?: number; publish?: boolean } = {},
  ) {
    const starts = new Date(Date.now() + (opts.startsIn ?? 2 * 86_400_000));
    const ends = new Date(starts.getTime() + (opts.hours ?? 2) * 3600_000);
    const { eventId } = await community().saveSocietyEvent(
      {
        societyId,
        type: "workshop",
        title: opts.title ?? unique("Soldering basics"),
        location: "Lab 2, Block C",
        sessions: [{ startsAt: starts.toISOString(), endsAt: ends.toISOString() }],
        ticketTypes: [{ name: "Seat", capacity: opts.seats ?? 1, pricePkr: opts.price ?? 0 }],
        eligibility: { scope: "university" },
        approvalMode: "automatic",
        questions: opts.question ? [{ label: opts.question, kind: "short", required: true }] : [],
        recordKinds: ["attended"],
        ...(opts.refundDays ? { refundPolicy: "until", refundDays: opts.refundDays } : {}),
      },
      as(officer.token),
    );
    if (opts.publish !== false) await community().publishEvent({ eventId }, as(officer.token));
    const [t] = await world().community<{ id: string }[]>`select id::text from community.event_ticket_types where event_id = ${eventId} and position = 1`;
    return { eventId, ticketId: t!.id };
  }

  return { community, as, read, onboarded, json, society, event };
}
