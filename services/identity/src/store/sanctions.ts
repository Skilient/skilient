import { refuse } from "@skilient/platform";
import type postgres from "postgres";
import { isStaff, requireAnyStaff, requireModerator, type Actor } from "../authorize";
import { audit } from "./audit";
import { revokeAllSessions } from "./sessions";

/**
 * Identity's half of a sanction (decision 2026-11-25: trust's writes into identity data go through identity
 * commands). Trust records the sanction and calls SanctionUser or LiftSanction with the staff member's
 * access token forwarded; identity re-checks that staff member's role and two-factor level itself, applies
 * its half (sessions, token version, the ban), and writes its own audit row in the same transaction.
 *
 * Ported from `private.sanction_user`, `lift_sanction` and `lift_sanction_row`, with today's messages:
 *   - warn: no session change;
 *   - suspend: every session ends and the token version is bumped (decision Q11);
 *   - ban: the same, plus `banned_until` = the end, or 2999-12-31 for a permanent ban.
 * `identity.sanction_marks` keeps what identity applied, keyed by trust's sanction id, so a repeat is
 * refused, "one restriction at a time" holds, and lifting a ban knows whether another ban remains.
 */
type Tx = postgres.TransactionSql;

export const PERMANENT_BAN = new Date("2999-12-31T00:00:00Z");
const KINDS = ["warn", "suspend", "ban"] as const;
type Kind = (typeof KINDS)[number];
const WEEK_MS = 7 * 24 * 3600 * 1000;

interface Mark {
  sanction_id: string;
  user_id: string;
  kind: Kind;
  until: Date | null;
  reason: string;
  staff_id: string;
  lifted_at: Date | null;
  lift_reason: string | null;
}

/** The sanction as the audit row shows it (today's `private.sanction_json`, without trust's case fields). */
function markJson(m: Mark | null | undefined): Record<string, unknown> | null {
  if (!m) return null;
  return {
    id: m.sanction_id,
    kind: m.kind,
    until: m.until?.toISOString() ?? null,
    reason: m.reason,
    staff_id: m.staff_id,
    lifted_at: m.lifted_at?.toISOString() ?? null,
    lift_reason: m.lift_reason,
  };
}

const MARK_COLUMNS = "sanction_id::text, user_id::text, kind, until, reason, staff_id::text, lifted_at, lift_reason";

/** `private.active_restriction`, for identity's half: the suspension or ban in force now, if any. */
async function activeRestriction(tx: Tx, userId: string): Promise<Mark | null> {
  const [m] = await tx.unsafe<Mark[]>(
    `select ${MARK_COLUMNS} from identity.sanction_marks
      where user_id = $1 and kind in ('suspend', 'ban') and lifted_at is null and (until is null or until > now())
      order by created_at desc limit 1`,
    [userId],
  );
  return m ?? null;
}

export interface SanctionInput {
  userId: string;
  kind: string;
  until: Date | null;
  reason: string;
  sanctionId: string;
}

/** SanctionUser. Returns trust's sanction id. */
export async function sanctionUser(tx: Tx, actor: Actor, input: SanctionInput): Promise<string> {
  const me = requireModerator(actor);
  const reason = (input.reason ?? "").trim();
  if (reason.length < 3) throw refuse("invalid_input", "give a reason");
  if (!KINDS.includes(input.kind as Kind)) throw refuse("invalid_input", "choose warn, suspend or ban");
  const kind = input.kind as Kind;
  if (input.userId === me) throw refuse("not_allowed", "you can't sanction your own account");
  // Locking the account serialises sanctions on it, so two cannot both pass the "one at a time" check.
  const [user] = await tx`select id from identity.users where id = ${input.userId} for update`;
  if (!user) throw refuse("not_found", "account not found");
  const now = Date.now();
  const until = input.until;
  if (kind === "warn" && until) throw refuse("invalid_input", "a warning has no end date");
  if (kind === "suspend" && (!until || until.getTime() <= now)) throw refuse("invalid_input", "choose when the suspension ends");
  if (kind === "suspend" && until!.getTime() > now + WEEK_MS && !isStaff(actor, "super_admin"))
    throw refuse("not_allowed", "moderators can suspend for at most 7 days");
  if (kind === "ban") {
    if (!isStaff(actor, "super_admin")) throw refuse("not_allowed", "only a super admin can ban an account");
    if (until && until.getTime() <= now) throw refuse("invalid_input", "the ban must end in the future, or leave the end empty for a permanent ban");
  }
  const current = await activeRestriction(tx, input.userId);
  if (kind !== "warn" && current) throw refuse("precondition", `this account already has an active ${current.kind}; lift it first`);

  const added = await tx.unsafe<Mark[]>(
    `insert into identity.sanction_marks (sanction_id, user_id, kind, until, reason, staff_id)
     values ($1, $2, $3, $4, $5, $6) on conflict (sanction_id) do nothing returning ${MARK_COLUMNS}`,
    [input.sanctionId, input.userId, kind, until, reason, me],
  );
  const mark = added[0];
  if (!mark) throw refuse("conflict", "that sanction was already applied");

  if (kind === "suspend" || kind === "ban") {
    // Every device is signed out now, so the restriction applies without waiting for a token to expire.
    await revokeAllSessions(tx, input.userId, `sanction_${kind}`);
  }
  if (kind === "ban") {
    const done = await tx`update identity.users set banned_until = ${until ?? PERMANENT_BAN}, updated_at = now() where id = ${input.userId}`;
    if (done.count !== 1) throw refuse("not_found", "account not found");
  }
  await audit(tx, {
    staffId: me,
    action: `sanction.${kind}`,
    targetType: "user",
    targetId: input.userId,
    reason,
    before: { active: markJson(current) },
    after: { active: markJson((await activeRestriction(tx, input.userId)) ?? current), sanction: markJson(mark) },
  });
  return mark.sanction_id;
}

/** LiftSanction: identity's half of `private.lift_sanction` and `lift_sanction_row`. */
export async function liftSanction(tx: Tx, actor: Actor, input: { userId: string; sanctionId: string; reason: string }): Promise<void> {
  const me = requireAnyStaff(actor);
  const reason = (input.reason ?? "").trim();
  if (reason.length < 3) throw refuse("invalid_input", "give a reason");
  const [before] = await tx.unsafe<Mark[]>(
    `select ${MARK_COLUMNS} from identity.sanction_marks where sanction_id = $1 and user_id = $2 for update`,
    [input.sanctionId, input.userId],
  );
  if (!before) throw refuse("not_found", "sanction not found");
  if ((before.kind === "ban" && !isStaff(actor, "super_admin")) || (before.kind !== "ban" && !isStaff(actor, "moderator")))
    throw refuse("not_allowed", "your role can't lift this sanction");
  if (!before.lifted_at && before.until && before.until.getTime() <= Date.now()) throw refuse("precondition", "this sanction has already ended");
  const [after] = await tx.unsafe<Mark[]>(
    `update identity.sanction_marks set lifted_at = now(), lifted_by = $2, lift_reason = $3
      where sanction_id = $1 and lifted_at is null returning ${MARK_COLUMNS}`,
    [input.sanctionId, me, reason],
  );
  if (!after) throw refuse("precondition", "that sanction was already lifted");
  if (after.kind === "ban") {
    const [stillBanned] = await tx`
      select 1 from identity.sanction_marks
       where user_id = ${input.userId} and kind = 'ban' and lifted_at is null and (until is null or until > now())`;
    if (!stillBanned) await tx`update identity.users set banned_until = null, updated_at = now() where id = ${input.userId}`;
  }
  await audit(tx, { staffId: me, action: "sanction.lift", targetType: "sanction", targetId: input.sanctionId, reason, before: markJson(before), after: markJson(after) });
}
