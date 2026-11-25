/** Onboarding rules, pure (the wizard's `advance` in apps/web lib/actions/onboarding.ts and complete_onboarding). */
export const ONBOARDING_STEPS = 6;

/** The step to show next after finishing `completed`: forward only, never past the last. */
export function nextStep(saved: number, completed: number): number {
  return Math.min(Math.max(saved, completed + 1), ONBOARDING_STEPS);
}

export interface Readiness {
  username: string | null;
  universityId: string | null;
  department: string | null;
  graduationYear: number | null;
}

/** complete_onboarding's check: username, university, department and batch are all set. */
export function readyToComplete(p: Readiness | undefined): boolean {
  return p != null && p.username != null && p.universityId != null && p.department != null && p.graduationYear != null;
}

/** The first onboarding step for a role, and whether the account starts onboarded (handle_new_user). */
export function startingStep(role: string): number {
  return role === "student" ? 1 : 6;
}
