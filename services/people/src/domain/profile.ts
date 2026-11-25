/**
 * Profile rules, pure (ported from `private.reserved_usernames`, the profiles check constraints,
 * `private.username_available`'s shape check and `private.can_view_profile`).
 */
export const RESERVED_USERNAMES: readonly string[] = [
  "admin", "administrator", "api", "auth", "edit", "feed", "help", "me", "new", "null",
  "onboarding", "ops", "profile", "root", "security", "settings", "signin", "signup",
  "skilient", "staff", "support", "system", "undefined", "uni", "verify",
];

export const USERNAME = /^[a-z0-9_]{3,30}$/;

/** `lower(btrim(x))`: how every username argument was read (btrim strips spaces only). */
export function normaliseUsername(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  return raw.replace(/^ +| +$/g, "").toLowerCase();
}

/** A username a profile may hold (the profiles_username_check constraint). */
export function validUsername(name: string | null): name is string {
  return name != null && USERNAME.test(name) && !RESERVED_USERNAMES.includes(name);
}

export type Visibility = "friends" | "university" | "global";
export const VISIBILITIES: readonly Visibility[] = ["friends", "university", "global"];
export const LOOKING_FOR = ["internship", "job", "teammates", "project", "mentorship"] as const;

export interface ViewTarget {
  userId: string;
  visibility: Visibility;
  universityId: string | null;
}

export interface ViewerRelation {
  /** The viewer's university (null when none). */
  viewerUniversityId: string | null;
  friends: boolean;
  /** A block in either direction. */
  blocked: boolean;
}

/** `private.can_view_profile`: self; or not blocked and (global, same university, or friends). */
export function canViewProfile(viewerId: string | null, target: ViewTarget, rel: ViewerRelation): boolean {
  if (viewerId == null) return target.visibility === "global";
  if (viewerId === target.userId) return true;
  if (rel.blocked) return false;
  return (
    target.visibility === "global" ||
    (target.visibility === "university" && target.universityId != null && target.universityId === rel.viewerUniversityId) ||
    rel.friends
  );
}

/** `private.department_key`: departments compared by lower-cased trimmed text. */
export function departmentKey(d: string | null | undefined): string | null {
  const k = (d ?? "").replace(/^\s+|\s+$/g, "").toLowerCase();
  return k === "" ? null : k;
}
