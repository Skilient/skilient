import { appendEvents, uuidv7, type NewEvent } from "@skilient/platform";
import type postgres from "postgres";
import { refused } from "../refusals";
import { CODE } from "../signing/sign";

export type Tx = postgres.TransactionSql;
export type Db = postgres.Sql | postgres.TransactionSql;
export type Row = Record<string, unknown>;
/** Fills a document's people placeholders (people's batch reads, carried on from the request). */
export type Filler = <T>(doc: T) => Promise<T>;

/** `require_user()`: the signed-in user, or a refusal. */
export function requireUser(me: string | null): string {
  if (!me) throw refused("not_signed_in");
  return me;
}

/** `record_limit(key)`: the Record's limits (record.limits), with the stack's defaults. */
export async function recordLimit(db: Db, key: "claim_days" | "pins" | "share_links" | "cv_entries" | "batch"): Promise<number> {
  const [r] = await db<{ n: number | null }[]>`select (value ->> ${key})::int as n from credentials.config where key = 'record.limits'`;
  const fallback = { claim_days: 180, pins: 3, share_links: 10, cv_entries: 8, batch: 50 }[key];
  return r?.n ?? fallback;
}

/** `has_entitlement(user, key)`: a copy of billing's grants (entitlement.changed); false when none. */
export async function entitled(db: Db, userId: string | null, key: string): Promise<boolean> {
  if (!userId) return false;
  const [r] = await db<{ ok: boolean }[]>`
    select coalesce((select value not in ('false'::jsonb, 'null'::jsonb, '0'::jsonb) from credentials.entitlements where subject_id = ${userId} and key = ${key}), false) as ok`;
  return r!.ok;
}

/** `is_society_officer(society)` for a user: the copy of community's officers (group.member_changed). */
export async function isOfficer(db: Db, societyId: string | null, userId: string | null): Promise<boolean> {
  if (!societyId || !userId) return false;
  const [r] = await db<{ ok: boolean }[]>`select exists (select 1 from credentials.society_officers where society_id = ${societyId} and user_id = ${userId}) as ok`;
  return r!.ok;
}

export async function officersOf(db: Db, societyId: string): Promise<string[]> {
  return (await db<{ user_id: string }[]>`select user_id::text from credentials.society_officers where society_id = ${societyId} order by user_id`).map((r) => r.user_id);
}

/**
 * Takes a code in the shared namespace (record_code_free): a CV version and a Record entry never share one. A
 * clash is a unique violation the signer retries with a new code.
 */
export async function takeCode(tx: Tx, code: string, kind: "cv" | "record"): Promise<void> {
  if (!CODE.test(code)) throw new Error("bad code");
  await tx`insert into credentials.codes (code, kind) values (${code}, ${kind})`;
}

export const isUniqueViolation = (e: unknown) => (e as { code?: string })?.code === "23505";

export async function publish(tx: Tx, events: NewEvent[]): Promise<void> {
  if (events.length) await appendEvents(tx, events);
}

/** A staff action's audit row and its audit.recorded (ids only), in the action's transaction (ops_audit_log). */
export async function staffAudit(
  tx: Tx,
  row: { staffId: string; action: string; targetType: string; targetId: string; reason: string; before: unknown; after: unknown },
): Promise<void> {
  const id = uuidv7();
  await tx`
    insert into credentials.audit_log (id, scope, actor_id, action, target_type, target_id, reason, before, after)
    values (${id}, 'staff', ${row.staffId}, ${row.action}, ${row.targetType}, ${row.targetId}, ${row.reason},
            ${JSON.stringify(row.before ?? {})}::text::jsonb, ${JSON.stringify(row.after ?? {})}::text::jsonb)`;
  await publish(tx, [{ type: "audit.recorded", subjects: [row.staffId], payload: { audit_id: id, action: row.action, target_type: row.targetType, target_id: row.targetId } }]);
}

/** An officer's action on the society's Record (society_audit_log on the stack). */
export async function societyAudit(tx: Tx, row: { societyId: string; actorId: string; action: string; targetId: string; before: unknown; after: unknown }): Promise<void> {
  await tx`
    insert into credentials.audit_log (id, scope, actor_id, society_id, action, target_type, target_id, before, after)
    values (${uuidv7()}, 'society', ${row.actorId}, ${row.societyId}, ${row.action}, 'record_entry', ${row.targetId},
            ${JSON.stringify(row.before ?? {})}::text::jsonb, ${JSON.stringify(row.after ?? {})}::text::jsonb)`;
}

/** now() as the database sees it, whole seconds (envelope times). */
export async function nowSeconds(db: Db): Promise<Date> {
  const [r] = await db<{ t: Date }[]>`select date_trunc('second', now()) as t`;
  return r!.t;
}
