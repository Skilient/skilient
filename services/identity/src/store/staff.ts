import { appendEvents, refuse, type User } from "@skilient/platform";
import type postgres from "postgres";
import { requireSuperAdmin, type Actor, type StaffRole } from "../authorize";
import { audit } from "./audit";
import type { PeopleNames } from "./people-names";
import { bumpTokenVersion, revokeAllSessions } from "./sessions";

/**
 * Staff roles and the two-factor reset (step 9), ported from `private.ops_staff`, `grant_staff_role`,
 * `revoke_staff_role` and `ops_reset_mfa`. Every write checks the role and two-factor level, writes one
 * audit row with the state before and after in the same transaction (decision Q4), and bumps the target's
 * token version so a role change applies within a second (decision Q11). Messages are today's, so the
 * goldens match.
 */
type Db = postgres.Sql | postgres.TransactionSql;
type Tx = postgres.TransactionSql;

export const STAFF_ROLES: readonly StaffRole[] = ["moderator", "trust_reviewer", "accounts", "super_admin"];

/**
 * The actor behind a call: the signed-in user from the verified access token (forwarded unchanged when trust
 * or work calls on a staff member's behalf), with their staff roles read from identity itself. The token's
 * aal is the two-factor level; nothing the caller sends in the body names the actor.
 */
export async function loadActor(db: Db, user: User | null): Promise<Actor> {
  if (!user) throw refuse("not_signed_in", "not signed in");
  const rows = await db<{ role: StaffRole }[]>`select role from identity.staff_roles where user_id = ${user.id} order by role`;
  return { id: user.id, aal: user.aal, staffRoles: rows.map((r) => r.role) };
}

async function rolesOf(tx: Tx, userId: string): Promise<string[]> {
  const rows = await tx<{ role: string }[]>`select role from identity.staff_roles where user_id = ${userId} order by role`;
  return rows.map((r) => r.role);
}

function reasonOf(reason: string | null | undefined): string {
  const r = (reason ?? "").trim();
  if (r.length < 3) throw refuse("invalid_input", "give a reason");
  return r;
}

export interface StaffMember {
  user_id: string;
  name: string | null;
  email: string;
  roles: string[];
  since: string;
  is_me: boolean;
  two_factor: boolean;
}

/** `private.ops_staff`: every staff member, by name (names from people, one batch call). Super admins only. */
export async function opsStaff(db: Db, actor: Actor, people: PeopleNames): Promise<StaffMember[]> {
  const me = requireSuperAdmin(actor);
  const rows = await db<{ user_id: string; email: string; roles: string[]; since: Date; two_factor: boolean }[]>`
    select s.user_id::text, u.email, array_agg(s.role order by s.role) as roles, min(s.granted_at) as since,
           exists (select 1 from identity.totp_factors f where f.user_id = s.user_id and f.status = 'verified') as two_factor
      from identity.staff_roles s
      join identity.users u on u.id = s.user_id
     group by s.user_id, u.email`;
  const names = rows.length ? await people.namesOf(rows.map((r) => r.user_id)) : new Map<string, string>();
  const members = rows.map((r) => ({
    user_id: r.user_id,
    name: names.get(r.user_id) ?? null,
    email: r.email,
    roles: r.roles,
    since: r.since.toISOString(),
    is_me: r.user_id === me,
    two_factor: r.two_factor,
  }));
  // Today's order is by full name (nulls last); email breaks ties and orders accounts people does not know.
  const key = (m: StaffMember) => [m.name == null ? 1 : 0, m.name ?? "", m.email] as const;
  return members.sort((a, b) => {
    const [x, y] = [key(a), key(b)];
    return x[0] - y[0] || (x[1] < y[1] ? -1 : x[1] > y[1] ? 1 : 0) || (x[2] < y[2] ? -1 : x[2] > y[2] ? 1 : 0);
  });
}

/** `private.grant_staff_role`: by email, to an account with a verified authenticator. Returns the user id. */
export async function grantStaffRole(tx: Tx, actor: Actor, input: { email: string; role: string; reason: string }): Promise<string> {
  const me = requireSuperAdmin(actor);
  const reason = reasonOf(input.reason);
  if (!STAFF_ROLES.includes(input.role as StaffRole)) throw refuse("invalid_input", "choose a role");
  const email = (input.email ?? "").trim().toLowerCase();
  // Locking the account serialises role changes for it, so two grants cannot both read the same "before".
  const [user] = await tx<{ id: string }[]>`select id from identity.users where email = ${email} for update`;
  if (!user) throw refuse("not_found", "no account with that email");
  const [factor] = await tx`select 1 from identity.totp_factors where user_id = ${user.id} and status = 'verified'`;
  if (!factor) throw refuse("precondition", "that account has no two-factor set up");
  const before = await rolesOf(tx, user.id);
  if (before.includes(input.role)) throw refuse("conflict", "that account already has this role");
  const done = await tx`insert into identity.staff_roles (user_id, role, granted_by) values (${user.id}, ${input.role}, ${me})`;
  if (done.count !== 1) throw refuse("conflict", "that account already has this role");
  await audit(tx, { staffId: me, action: "staff.grant", targetType: "user", targetId: user.id, reason, before: { roles: before }, after: { roles: await rolesOf(tx, user.id) } });
  await bumpTokenVersion(tx, user.id, "staff_role_changed");
  return user.id;
}

/** `private.revoke_staff_role`: never your own super admin role, never the last super admin. */
export async function revokeStaffRole(tx: Tx, actor: Actor, input: { userId: string; role: string; reason: string }): Promise<void> {
  const me = requireSuperAdmin(actor);
  const reason = reasonOf(input.reason);
  if (!STAFF_ROLES.includes(input.role as StaffRole)) throw refuse("invalid_input", "choose a role");
  if (input.role === "super_admin") {
    if (input.userId === me) throw refuse("not_allowed", "you can't remove your own super admin role");
    // Serialise super admin changes so two revocations can't both pass the count.
    await tx`select user_id from identity.staff_roles where role = 'super_admin' for update`;
    const [others] = await tx<{ n: number }[]>`
      select count(*)::int as n from identity.staff_roles where role = 'super_admin' and user_id <> ${input.userId}`;
    if (others!.n === 0) throw refuse("precondition", "the last super admin can't be removed");
  }
  await tx`select id from identity.users where id = ${input.userId} for update`;
  const before = await rolesOf(tx, input.userId);
  const done = await tx`delete from identity.staff_roles where user_id = ${input.userId} and role = ${input.role}`;
  if (done.count !== 1) throw refuse("not_found", "that account doesn't have this role");
  await audit(tx, { staffId: me, action: "staff.revoke", targetType: "user", targetId: input.userId, reason, before: { roles: before }, after: { roles: await rolesOf(tx, input.userId) } });
  await bumpTokenVersion(tx, input.userId, "staff_role_changed");
}

/**
 * `private.ops_reset_mfa`: removes a user's authenticator and backup codes after a staff member checked who
 * they are, and ends every session. Returns the address the reset email goes to (sent after commit by the
 * handler; never logged or put in an event).
 */
export async function opsResetMfa(tx: Tx, actor: Actor, input: { userId: string; identityNote: string }): Promise<string> {
  const me = requireSuperAdmin(actor);
  const note = (input.identityNote ?? "").trim();
  if (note.length < 20) throw refuse("invalid_input", "write down how you checked who they are (at least 20 characters)");
  if (input.userId === me) throw refuse("not_allowed", "you can't reset your own two-factor here");
  const [user] = await tx<{ email: string }[]>`select email from identity.users where id = ${input.userId} for update`;
  if (!user) throw refuse("not_found", "account not found");
  const [counts] = await tx<{ factors: number; codes: number; sessions: number }[]>`
    select (select count(*)::int from identity.totp_factors where user_id = ${input.userId}) as factors,
           (select count(*)::int from identity.mfa_backup_codes where user_id = ${input.userId} and used_at is null) as codes,
           (select count(*)::int from identity.sessions where user_id = ${input.userId} and revoked_at is null) as sessions`;
  const { factors, codes, sessions } = counts!;
  if (factors === 0 && codes === 0) throw refuse("precondition", "this account has no two-factor to reset");
  await tx`delete from identity.totp_factors where user_id = ${input.userId}`;
  await tx`delete from identity.mfa_backup_codes where user_id = ${input.userId}`;
  await revokeAllSessions(tx, input.userId, "mfa_reset");
  await appendEvents(tx, [{ type: "user.mfa_reset", subjects: [input.userId], payload: { reset_at: new Date().toISOString() } }]);
  await audit(tx, {
    staffId: me,
    action: "user.mfa_reset",
    targetType: "user",
    targetId: input.userId,
    reason: note,
    before: { factors, backup_codes: codes },
    after: { factors: 0, backup_codes: 0, sessions_ended: sessions },
  });
  return user.email;
}
