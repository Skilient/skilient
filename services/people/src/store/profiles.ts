import { rateLimit } from "@skilient/platform";
import type postgres from "postgres";
import { canViewProfile, normaliseUsername, validUsername, type Visibility } from "../domain/profile";
import { refused } from "../refusals";
import { profileFlags, publishProfile, type Db, type Tx } from "./publish";

/**
 * Profiles: reading one (full, card or nothing), the batch reads other services use, username checks and
 * the edits a user may make (ported from the profiles RLS policies and column grants, the profile triggers
 * `sync_public_card`, `sync_profile_department`, `check_profile_department`, and `get_profile_card`,
 * `username_available`, `set_read_receipts`, `my_chat_settings`, `set_leaderboard_opt_out`).
 */
export interface ProfileRow {
  user_id: string;
  role: string;
  university_id: string | null;
  university_name: string | null;
  email_domain: string | null;
  full_name: string;
  username: string | null;
  department: string | null;
  department_id: string | null;
  programme: string | null;
  graduation_year: number | null;
  campus: string | null;
  bio: string | null;
  avatar_path: string | null;
  cover_path: string | null;
  visibility: Visibility;
  recruiter_visible: boolean;
  looking_for: string[];
  onboarding_complete: boolean;
  chat_read_receipts: boolean;
  leaderboard_opt_out: boolean;
  status: "active" | "graduate" | "deleting";
  delete_after: Date | null;
}

export async function loadProfile(db: Db, userId: string): Promise<ProfileRow | undefined> {
  const [row] = await db<ProfileRow[]>`
    select p.user_id::text, p.role, p.university_id::text, u.name as university_name, p.email_domain, p.full_name, p.username,
           p.department, p.department_id::text, p.programme, p.graduation_year, p.campus, p.bio, p.avatar_path, p.cover_path,
           p.visibility, p.recruiter_visible, p.looking_for, p.onboarding_complete, p.chat_read_receipts, p.leaderboard_opt_out,
           p.status, p.delete_after
      from people.profiles p left join people.universities u on u.id = p.university_id
     where p.user_id = ${userId}`;
  return row;
}

/** `private.require_user`: signed in and onboarded. */
export async function requireOnboarded(db: Db, userId: string | null, plain = true): Promise<string> {
  if (!userId) throw refused(plain ? "not_signed_in_plain" : "not_signed_in");
  const [row] = await db<{ ok: boolean }[]>`select onboarding_complete as ok from people.profiles where user_id = ${userId}`;
  if (!row?.ok) throw refused("finish_onboarding");
  return userId;
}

export type ProfileLookup =
  | { kind: "full"; profile: Omit<ProfileRow, "email_domain" | "department_id" | "role" | "recruiter_visible" | "onboarding_complete" | "chat_read_receipts" | "leaderboard_opt_out" | "status" | "delete_after" | "university_id"> & { is_owner: boolean } }
  | { kind: "card"; card: { user_id: string; username: string; full_name: string; department: string | null; graduation_year: number | null } }
  | { kind: "not_found" };

/** The profile page's read in one query: the target, the viewer's university, and friendship and blocks. */
async function viewOf(db: Db, viewerId: string, username: string) {
  const [row] = await db<
    (ProfileRow & { viewer_university: string | null; friends: boolean; blocked: boolean })[]
  >`
    select p.user_id::text, p.role, p.university_id::text, u.name as university_name, p.full_name, p.username, p.department,
           p.programme, p.graduation_year, p.campus, p.bio, p.avatar_path, p.cover_path, p.visibility, p.looking_for,
           (select v.university_id::text from people.profiles v where v.user_id = ${viewerId}) as viewer_university,
           exists (select 1 from people.friendships f where f.user_id_a = least(${viewerId}::uuid, p.user_id) and f.user_id_b = greatest(${viewerId}::uuid, p.user_id)) as friends,
           exists (select 1 from people.blocks b where (b.blocker_id = ${viewerId} and b.blocked_id = p.user_id) or (b.blocker_id = p.user_id and b.blocked_id = ${viewerId})) as blocked
      from people.profiles p left join people.universities u on u.id = p.university_id
     where p.username = ${username}`;
  return row;
}

/**
 * The profile page (apps/web lib/data/profiles.ts getProfile): the full profile when the viewer may see it,
 * else the restricted card, else not found (unknown, or a block either way). A non-owner view counts toward
 * 300 a day (PRD 10 anti-scraping).
 */
export async function getProfile(tx: Tx, viewerId: string | null, raw: string): Promise<ProfileLookup> {
  if (!viewerId) throw refused("not_signed_in");
  const username = normaliseUsername(raw);
  if (!username || !/^[a-z0-9_]{3,30}$/.test(username)) return { kind: "not_found" };
  const row = await viewOf(tx, viewerId, username);
  const isOwner = row?.user_id === viewerId;
  if (!isOwner && !(await rateLimit(tx, `profile_view:${viewerId}`, 300, 86_400))) throw refused("profile_views_limited");
  if (!row) return { kind: "not_found" };
  const target = { userId: row.user_id, visibility: row.visibility, universityId: row.university_id };
  if (canViewProfile(viewerId, target, { viewerUniversityId: row.viewer_university, friends: row.friends, blocked: row.blocked }))
    return {
      kind: "full",
      profile: {
        user_id: row.user_id,
        username: row.username,
        full_name: row.full_name,
        university_name: row.university_name,
        department: row.department,
        programme: row.programme,
        graduation_year: row.graduation_year,
        campus: row.campus,
        bio: row.bio,
        avatar_path: row.avatar_path,
        cover_path: row.cover_path,
        visibility: row.visibility,
        looking_for: row.looking_for,
        is_owner: isOwner,
      },
    };
  if (row.blocked) return { kind: "not_found" };
  return { kind: "card", card: { user_id: row.user_id, username: row.username!, full_name: row.full_name, department: row.department, graduation_year: row.graduation_year } };
}

/** `get_profile_card`: the restricted card, unless blocked either way (signed in only). */
export async function profileCard(db: Db, viewerId: string | null, raw: string | null) {
  if (!viewerId) return [];
  return db<{ user_id: string; username: string; full_name: string; department: string | null; graduation_year: number | null }[]>`
    select p.user_id::text, p.username, p.full_name, p.department, p.graduation_year
      from people.profiles p
     where p.username = ${normaliseUsername(raw)}
       and not exists (select 1 from people.blocks b where (b.blocker_id = ${viewerId} and b.blocked_id = p.user_id) or (b.blocker_id = p.user_id and b.blocked_id = ${viewerId}))`;
}

/** `can_view_profile` for one viewer and many targets, in one query (the visibility golden; lists use it inline). */
export async function canView(db: Db, viewerId: string | null, targets: readonly string[]): Promise<Map<string, boolean>> {
  if (!viewerId) {
    // As private.can_view_profile with no caller: only a global profile passes (every method that shows a
    // profile requires sign-in first, so this matters only for parity).
    const open = await db<{ user_id: string }[]>`select user_id::text from people.profiles where user_id = any(${[...targets]}::uuid[]) and visibility = 'global'`;
    return new Map(targets.map((t) => [t, open.some((r) => r.user_id === t)]));
  }
  const rows = await db<{ user_id: string; ok: boolean }[]>`
    select p.user_id::text, ${canViewSql(db, viewerId)} as ok from people.profiles p where p.user_id = any(${[...targets]}::uuid[])`;
  return new Map(targets.map((t) => [t, rows.find((r) => r.user_id === t)?.ok ?? false]));
}

/**
 * `private.can_view_profile` inline, for a profile aliased `p` and a viewer id: a fragment the list queries
 * embed, so each list stays one database trip.
 */
export function canViewSql(db: Db, viewerId: string) {
  return db`(p.user_id = ${viewerId}::uuid or (
      not exists (select 1 from people.blocks b where (b.blocker_id = ${viewerId}::uuid and b.blocked_id = p.user_id) or (b.blocker_id = p.user_id and b.blocked_id = ${viewerId}::uuid))
      and (p.visibility = 'global'
           or (p.visibility = 'university' and p.university_id = (select v.university_id from people.profiles v where v.user_id = ${viewerId}::uuid))
           or exists (select 1 from people.friendships f where f.user_id_a = least(${viewerId}::uuid, p.user_id) and f.user_id_b = greatest(${viewerId}::uuid, p.user_id)))))`;
}

/** `username_available`: shape first (no rate-limit hit), then 120 checks an hour, then taken by someone else. */
export async function usernameAvailable(tx: Tx, userId: string | null, raw: string | null): Promise<boolean> {
  if (!userId) throw refused("not_signed_in_plain");
  const name = normaliseUsername(raw);
  if (!validUsername(name)) return false;
  if (!(await rateLimit(tx, `username_check:${userId}`, 120, 3600))) throw refused("username_rate_limited");
  const [taken] = await tx`select 1 from people.profiles where username = ${name} and user_id <> ${userId}`;
  return !taken;
}

/** The fields a user may edit on their own profile (the column grants on public.profiles). */
export interface ProfilePatch {
  full_name?: string;
  username?: string | null;
  bio?: string | null;
  campus?: string | null;
  programme?: string | null;
  department?: string | null;
  graduation_year?: number | null;
  visibility?: Visibility;
  looking_for?: string[];
  recruiter_visible?: boolean;
  avatar_path?: string | null;
  cover_path?: string | null;
}
export const EDITABLE: readonly (keyof ProfilePatch)[] = [
  "full_name", "username", "bio", "campus", "programme", "department", "graduation_year", "visibility", "looking_for", "recruiter_visible", "avatar_path", "cover_path",
];

const len = (s: string | null | undefined, min: number, max: number) => s == null || ([...s].length >= min && [...s].length <= max);

/** The check constraints on the columns being written, in the order Postgres reports them. */
function checkPatch(userId: string, p: ProfilePatch): void {
  if (p.full_name !== undefined && !len(p.full_name.replace(/^\s+|\s+$/g, ""), 1, 60)) throw refused("full_name_invalid");
  if (p.username !== undefined && p.username !== null && !validUsername(p.username)) throw refused("username_invalid");
  if (p.bio !== undefined && !len(p.bio, 0, 280)) throw refused("bio_too_long");
  if (p.campus !== undefined && !len(p.campus, 2, 60)) throw refused("field_invalid");
  if (p.programme !== undefined && !len(p.programme, 2, 80)) throw refused("field_invalid");
  if (p.department !== undefined && !len(p.department, 2, 80)) throw refused("field_invalid");
  if (p.graduation_year != null && (p.graduation_year < 1980 || p.graduation_year > 2100)) throw refused("field_invalid");
  if (p.looking_for && p.looking_for.some((x) => !["internship", "job", "teammates", "project", "mentorship"].includes(x))) throw refused("field_invalid");
  for (const k of ["avatar_path", "cover_path"] as const)
    if (p[k] != null && !(p[k]!.startsWith(`${userId}/`) && p[k]!.length <= 200)) throw refused("field_invalid");
}

/**
 * Writes a user's own profile edit: the department triggers, the check constraints and the username's
 * uniqueness, as the current stack applied them, then `profile.updated` (and the gate event when a gate
 * field moved) in the same transaction. Returns the row count (1), as the app's update did.
 */
export async function updateOwnProfile(tx: Tx, userId: string | null, patch: ProfilePatch | Record<string, unknown>): Promise<number> {
  if (!userId) throw refused("field_not_editable");
  if (Object.keys(patch).some((k) => !(EDITABLE as readonly string[]).includes(k))) throw refused("field_not_editable");
  const [cur] = await tx<{ role: string; university_id: string | null; department: string | null; department_id: string | null; username: string | null }[]>`
    select role, university_id::text, department, department_id::text, username from people.profiles where user_id = ${userId} for update`;
  if (!cur) return 0;
  const before = await profileFlags(tx, userId);
  const p = { ...patch } as ProfilePatch;
  // sync_profile_department, then check_profile_department (BEFORE triggers, in name order).
  let departmentId: string | null | undefined;
  if (p.department !== undefined && p.department !== cur.department) {
    const [d] = await tx<{ id: string }[]>`
      select id::text from people.departments where university_id = ${cur.university_id} and lower(name) = lower(btrim(coalesce(${p.department}::text, '')))`;
    departmentId = d?.id ?? null;
    if (cur.role === "student" && p.department !== null && departmentId === null) {
      const [listed] = await tx`select 1 from people.departments where university_id = ${cur.university_id} limit 1`;
      if (listed) throw refused("department_not_listed");
    }
  }
  checkPatch(userId, p);
  if (p.username != null && p.username !== cur.username) {
    const [taken] = await tx`select 1 from people.profiles where username = ${p.username} and user_id <> ${userId}`;
    if (taken) throw refused("username_taken");
  }
  const sets: Record<string, unknown> = { ...p };
  if (departmentId !== undefined) sets["department_id"] = departmentId;
  if (Object.keys(sets).length === 0) return 1;
  const done = await tx`update people.profiles set ${tx(sets as Record<string, postgres.ParameterOrJSON<never>>)} where user_id = ${userId}`;
  if (done.count !== 1) throw refused("profile_not_found");
  await publishProfile(tx, userId, before);
  return done.count;
}

/** `set_read_receipts` (people's privacy setting; messaging copies it from profile.updated). */
export async function setReadReceipts(tx: Tx, userId: string | null, on: boolean | null): Promise<void> {
  if (!userId) throw refused("not_signed_in");
  const before = await profileFlags(tx, userId);
  const done = await tx`update people.profiles set chat_read_receipts = ${on ?? true} where user_id = ${userId}`;
  if (done.count !== 1) throw refused("not_signed_in");
  await publishProfile(tx, userId, before);
}

/** `my_chat_settings` */
export async function myChatSettings(db: Db, userId: string | null) {
  if (!userId) throw refused("not_signed_in");
  return db<{ read_receipts: boolean }[]>`select chat_read_receipts as read_receipts from people.profiles where user_id = ${userId}`;
}

/** `set_leaderboard_opt_out` (people records; ranking copies it from profile.updated). */
export async function setLeaderboardOptOut(tx: Tx, userId: string | null, out: boolean | null): Promise<boolean> {
  const me = await requireOnboarded(tx, userId);
  const before = await profileFlags(tx, me);
  const done = await tx`update people.profiles set leaderboard_opt_out = ${out ?? false} where user_id = ${me}`;
  if (done.count !== 1) throw refused("profile_not_found");
  await publishProfile(tx, me, before);
  return out ?? false;
}

/** ProfileCards: the batch read other services use (one trip, at most 500 ids). */
export async function profileCards(db: Db, ids: readonly string[]) {
  return db<
    {
      user_id: string;
      username: string | null;
      full_name: string;
      avatar_path: string | null;
      department: string | null;
      graduation_year: number | null;
      university_id: string | null;
      university_name: string | null;
      role: string;
      status: string;
      visibility: string;
      onboarding_complete: boolean;
      leaderboard_opt_out: boolean;
    }[]
  >`
    select p.user_id::text, p.username, p.full_name, p.avatar_path, p.department, p.graduation_year, p.university_id::text,
           u.name as university_name, p.role, p.status, p.visibility, p.onboarding_complete, p.leaderboard_opt_out
      from people.profiles p left join people.universities u on u.id = p.university_id
     where p.user_id = any(${[...ids]}::uuid[]) order by p.user_id`;
}

/** ResolveUsernames (`private.user_id_for`, batched). */
export async function resolveUsernames(db: Db, names: readonly string[]) {
  const wanted = names.map((n) => normaliseUsername(n) ?? "");
  const rows = await db<{ username: string; user_id: string }[]>`
    select username, user_id::text from people.profiles where username = any(${wanted}::text[])`;
  const byName = new Map(rows.map((r) => [r.username, r.user_id]));
  return names.flatMap((n, i) => (byName.has(wanted[i]!) ? [{ username: n, user_id: byName.get(wanted[i]!)! }] : []));
}

/**
 * Of the given people, those whose name contains the query or whose username starts with it, by name (community's
 * check-in search over an event's registrants: `check_in_search`'s `full_name ilike '%q%' or username ilike 'q%'`).
 */
export async function filterByName(db: Db, userIds: readonly string[], query: string, limit: number): Promise<string[]> {
  const q = query.replace(/[%_]/g, "");
  const rows = await db<{ user_id: string }[]>`
    select user_id::text from people.profiles
     where user_id = any(${[...userIds]}::uuid[]) and (full_name ilike ${"%" + q + "%"} or username ilike ${q + "%"})
     order by full_name limit ${limit}`;
  return rows.map((r) => r.user_id);
}

/** Relations: for one user and many others, friends, a block either way, and whether the user muted them. */
export async function relations(db: Db, userId: string, others: readonly string[]) {
  const rows = await db<{ other_id: string; friends: boolean; blocked: boolean; muted: boolean }[]>`
    select o::text as other_id,
           exists (select 1 from people.friendships f where f.user_id_a = least(${userId}::uuid, o) and f.user_id_b = greatest(${userId}::uuid, o)) as friends,
           exists (select 1 from people.blocks b where (b.blocker_id = ${userId} and b.blocked_id = o) or (b.blocker_id = o and b.blocked_id = ${userId})) as blocked,
           exists (select 1 from people.user_mutes m where m.user_id = ${userId} and m.muted_id = o) as muted
      from unnest(${[...others]}::uuid[]) o`;
  return rows;
}

/** SetProfileImage: the media service stored the file under the user's folder; people records the path. */
export async function setProfileImage(tx: Tx, userId: string | null, kind: "avatar" | "cover", path: string | null): Promise<{ replaced: string | null }> {
  if (!userId) throw refused("not_signed_in");
  const column = kind === "avatar" ? "avatar_path" : "cover_path";
  const [cur] = await tx<{ old: string | null }[]>`select ${tx(column)} as old from people.profiles where user_id = ${userId} for update`;
  if (!cur) throw refused("profile_not_found");
  await updateOwnProfile(tx, userId, { [column]: path });
  return { replaced: cur.old && cur.old !== path ? cur.old : null };
}
