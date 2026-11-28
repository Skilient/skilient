import { eligible } from "./domain/cv";
import type { Ports } from "./ports";
import type { SnapshotInputs } from "./store/snapshot";

/**
 * What the CV needs from other services for one student: people's profile, identity's address and ban, ranking's
 * tier and work's facts, read in parallel (one batch call each), then the endorsers' names filled (people). Depth 2
 * when `call` carries a request on; a root call from a job.
 */
export async function snapshotInputs(ports: Ports, userId: string, call: unknown): Promise<SnapshotInputs> {
  const [profiles, accounts, tiers, work] = await Promise.all([
    ports.profiles([userId], call),
    ports.accounts([userId], call),
    ports.tiers([userId], call),
    ports.workFacts(userId, call),
  ]);
  return { profile: profiles.get(userId), account: accounts.get(userId), tier: tiers.get(userId), work: await ports.fill(work, call) };
}

/** `cv_eligible` for many accounts at once (two batch calls: people and identity). */
export async function eligibleSet(ports: Ports, userIds: readonly string[], call: unknown): Promise<Set<string>> {
  const [profiles, accounts] = await Promise.all([ports.profiles(userIds, call), ports.accounts(userIds, call)]);
  return new Set(
    userIds.filter((u) => {
      const p = profiles.get(u);
      return eligible(p && { role: p.role, onboardingComplete: p.onboardingComplete, username: p.username, universityId: p.universityId, banned: accounts.get(u)?.banned ?? false });
    }),
  );
}
