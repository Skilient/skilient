import type { PeopleService } from "@skilient/contracts/people/v1/people_pb";
import { type CallerPolicy, type User } from "@skilient/platform";
import { refused } from "./refusals";

const WEB = ["web"] as const;
/** Services that show people (names, avatars, universities) or check relations, through the batch reads. */
const SERVICES = ["web", "identity", "content", "messaging", "work", "ranking", "community", "credentials", "notify", "trust", "market", "billing", "media"] as const;

/**
 * Which callers may use each method; the gate refuses anyone else before the body is read. Web calls almost
 * everything; the batch reads serve every service (no call inside a loop); department and programme edits
 * are market's (decision 2026-11-25, advisor, W2 Q5a: market checks the university seat first).
 */
export const callers: CallerPolicy<typeof PeopleService> = {
  getShell: WEB,
  todoCounts: WEB,
  nextBestAction: WEB,
  gettingStarted: WEB,
  learnState: WEB,
  getMyProfile: WEB,
  getProfile: WEB,
  profileCards: SERVICES,
  resolveUsernames: SERVICES,
  filterByName: ["community"],
  relations: SERVICES,
  claimLaunchRecipients: ["notify"],
  usernameAvailable: WEB,
  updateProfile: WEB,
  setProfileImage: WEB,
  setReadReceipts: WEB,
  setLeaderboardOptOut: WEB,
  getOnboarding: WEB,
  departmentOptions: WEB,
  classmates: WEB,
  setMyUniversity: WEB,
  saveUniversityStep: WEB,
  saveProfileStep: WEB,
  saveGithubStep: WEB,
  saveSkillsStep: WEB,
  saveLookingForStep: WEB,
  completeOnboarding: WEB,
  listFriends: WEB,
  listFriendRequests: WEB,
  listBlocks: WEB,
  listMutes: WEB,
  friendshipState: WEB,
  pendingFriendRequestCount: WEB,
  sendFriendRequest: WEB,
  respondFriendRequest: WEB,
  cancelFriendRequest: WEB,
  unfriend: WEB,
  blockUser: WEB,
  unblockUser: WEB,
  muteUser: WEB,
  searchPeople: WEB,
  peopleYouMayKnow: WEB,
  dismissSuggestion: WEB,
  setUiState: WEB,
  saveTour: WEB,
  restartTour: WEB,
  seeTip: WEB,
  listUniversities: ["web", "community", "credentials"],
  requestUniversity: WEB,
  confirmUniversityRequest: WEB,
  unsubscribeUniversityRequest: WEB,
  opsUniversityRequests: WEB,
  opsBatches: WEB,
  opsSetUniversityLive: WEB,
  opsOpenAllUniversities: WEB,
  opsAddUniDomain: WEB,
  opsSetFinalYearBatch: WEB,
  saveDepartment: ["market"],
  deleteDepartment: ["market"],
  saveProgramme: ["market"],
  deleteProgramme: ["market"],
};

/** Staff roles as identity's StaffRolesOf returns them. */
export type StaffRole = "moderator" | "trust_reviewer" | "accounts" | "super_admin";

/**
 * `private.is_staff('accounts')` / `require_accounts`: a two-factor session and the accounts role (or super
 * admin). The roles come from identity, one StaffRolesOf call per request (decision Q5b, advisor).
 */
export function requireAccounts(user: User | null, roles: readonly StaffRole[]): string {
  if (!user || user.aal !== "aal2" || !roles.some((r) => r === "accounts" || r === "super_admin")) throw refused("accounts_only");
  return user.id;
}
