/**
 * Facts made the way students make them, through work's contract: a venture, a teammate invited and joined,
 * entries each confirms for the other, a deliverable, completion, endorsements. Ranking hears all of it through
 * work's events.
 */
import { WorkService } from "@skilient/contracts/work/v1/work_pb";
import type { ContractEnv } from "@skilient/testing";
import { usernameOf } from "../../../people/test/contract/world";
import { drain, student, type RankingWorld } from "./world";

export interface Team {
  owner: { id: string; token: string };
  mate: { id: string; token: string };
  ventureId: string;
}

export function teams(env: () => ContractEnv, world: () => RankingWorld) {
  const work = () => env().client(WorkService);
  const as = (token: string) => ({ ...env().call({ userToken: token }), headers: { "idempotency-key": crypto.randomUUID() } });
  const onboarded = async (fullName: string, opts: { staffRoles?: string[]; department?: string } = {}) => {
    const s = await student(world(), { fullName, ...(opts.staffRoles ? { staffRoles: opts.staffRoles } : {}), ...(opts.department ? { onboard: { department: opts.department } } : {}) });
    await drain(world());
    return s;
  };

  /** Two students on a venture, each with an entry the other confirmed; completed (with a deliverable) unless `complete` is false. */
  async function team(names: [string, string], opts: { complete?: boolean; endorse?: boolean } = {}): Promise<Team> {
    const owner = await onboarded(names[0]);
    const mate = await onboarded(names[1]);
    const { ventureId } = await work().createVenture(
      { type: "project", title: `${names[0]}'s project`, description: "A project for the board.", visibility: "university", skillIds: ["python"], roles: [], questions: [] },
      as(owner.token),
    );
    const { inviteId } = await work().inviteToVenture({ ventureId, username: await usernameOf(world(), mate.id) }, as(owner.token));
    await work().respondInvite({ inviteId, accept: true }, as(mate.token));
    await work().transitionVenture({ ventureId, to: "in_progress" }, as(owner.token));
    const a = await work().logContribution({ ventureId, kind: "code", description: "Built the data model", evidenceUrl: "", hours: 3, skillIds: ["python"] }, as(owner.token));
    const b = await work().logContribution({ ventureId, kind: "code", description: "Wrote the importer", evidenceUrl: "", hours: 2, skillIds: ["python"] }, as(mate.token));
    await work().confirmContribution({ contributionId: a.contributionId }, as(mate.token));
    await work().confirmContribution({ contributionId: b.contributionId }, as(owner.token));
    if (opts.complete !== false) {
      await work().addVentureDeliverable({ ventureId, label: "App", url: "https://example.org/app" }, as(owner.token));
      await work().transitionVenture({ ventureId, to: "completed" }, as(owner.token));
    }
    if (opts.endorse !== false) {
      await work().endorse({ endorseeId: mate.id, ventureId, items: [{ skillId: "python", evidenceId: "" }], note: "" }, as(owner.token));
      await work().endorse({ endorseeId: owner.id, ventureId, items: [{ skillId: "python", evidenceId: "" }], note: "" }, as(mate.token));
    }
    await drain(world());
    return { owner, mate, ventureId };
  }

  return { team, onboarded, as, read: (token: string) => env().call({ userToken: token }) };
}
