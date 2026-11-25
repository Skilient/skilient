/**
 * The world for people's service-level journeys (decision 2026-11-25, advisor, W2 Q3): each journey mirrors
 * one Playwright spec test (apps/web/tests/e2e/friends.spec.ts, onboarding.spec.ts, the people parts of
 * student-portal.spec.ts, and the privacy centre) and drives identity and people only through their
 * contracts, on both transports. Sign-up goes through identity (code from the memory outbox), the profile
 * arrives through people's lifecycle consumer, and gate facts reach identity through its gate consumer, as in
 * production. Purely web parts (redirects, axe, the live badge over realtime, image files) are `it.todo`
 * naming the workstream that owns them.
 */
import type { CallOptions } from "@connectrpc/connect";
import { AccountRole, IdentityService } from "@skilient/contracts/identity/v1/identity_pb";
import { PeopleService } from "@skilient/contracts/people/v1/people_pb";
import type { ContractEnv } from "@skilient/testing";
import { memoryOutbox } from "../../../identity/src/deps";
import { drainGate, drainLifecycle, NUTECH, PASSWORD, unique, type PeopleWorld } from "../contract/world";

export const codeFrom = (subject: string) => /(\d{6})/.exec(subject)?.[1] ?? "";

async function latestCode(to: string, since: number): Promise<string> {
  const t0 = Date.now();
  while (Date.now() - t0 < 5_000) {
    const mail = memoryOutbox
      .slice(since)
      .reverse()
      .find((m) => m.to === to && m.kind === "signup_code");
    if (mail) return codeFrom(mail.subject);
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error(`no sign-up code for ${to}`);
}

export function journeyClient(env: () => ContractEnv, world: () => PeopleWorld) {
  const id = () => env().client(IdentityService);
  const people = () => env().client(PeopleService);
  /** A signed-in call; writes carry a fresh idempotency key, as web sends one per user action. */
  const as = (token: string): CallOptions => ({ ...env().call({ userToken: token }), headers: { "idempotency-key": crypto.randomUUID() } });

  /** Sign up through identity (the code from the email), and let people's consumer create the profile. */
  async function signUp(uni: typeof NUTECH, fullName: string) {
    const email = unique(uni.domain, "j");
    const since = memoryOutbox.length;
    const { userId } = await id().signUp(
      { email, password: PASSWORD, role: AccountRole.STUDENT, fullName, agreementVersion: 0, universityId: "", captchaToken: "" },
      env().call(),
    );
    const session = (await id().verifyEmail({ email, code: await latestCode(email, since) }, env().call())).session!;
    await drainLifecycle(world());
    return { id: userId, email, token: session.accessToken };
  }

  /** The six wizard steps through people's contract, then the gate fact reaches identity. */
  async function onboard(token: string, o: { department?: string; year?: number; username?: string; bio?: string } = {}) {
    const p = people();
    await p.saveUniversityStep({ universityId: "", department: o.department ?? "Computer Science", programme: "BS Computer Science", graduationYear: o.year ?? 2027, campus: "" }, as(token));
    const username = o.username ?? `j${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
    await p.saveProfileStep({ username, bio: o.bio ?? "" }, as(token));
    await p.saveGithubStep({ choice: "skipped" }, as(token));
    await p.saveSkillsStep({}, as(token));
    await p.saveLookingForStep({ lookingFor: ["internship"], recruiterVisible: false }, as(token));
    const done = await p.completeOnboarding({}, as(token));
    await drainGate(world());
    return { username, completed: done.completed };
  }

  /** `createStudent` from apps/web/tests/e2e/support.ts: signed up and onboarded. */
  async function createStudent(uni: typeof NUTECH, fullName: string, o: Parameters<typeof onboard>[1] = {}) {
    const s = await signUp(uni, fullName);
    const { username } = await onboard(s.token, o);
    return { ...s, username, fullName };
  }

  return { id, people, as, signUp, onboard, createStudent };
}
