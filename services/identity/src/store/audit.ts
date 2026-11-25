import { appendEvents, uuidv7 } from "@skilient/platform";
import type postgres from "postgres";

/**
 * One audit row for a staff action, written in the action's transaction with its before and after state,
 * plus an `audit.recorded` event (ids only) for trust's /ops view (decision 2026-11-25, Q4).
 */
export async function audit(
  tx: postgres.TransactionSql,
  row: { staffId: string; action: string; targetType: string; targetId: string; reason: string; before: unknown; after: unknown },
): Promise<string> {
  const id = uuidv7();
  await tx`
    insert into identity.audit_log (id, staff_id, action, target_type, target_id, reason, before, after)
    values (${id}, ${row.staffId}, ${row.action}, ${row.targetType}, ${row.targetId}, ${row.reason},
            ${JSON.stringify(row.before ?? {})}::text::jsonb, ${JSON.stringify(row.after ?? {})}::text::jsonb)`;
  await appendEvents(tx, [{ type: "audit.recorded", subjects: [row.staffId], payload: { audit_id: id, action: row.action, target_type: row.targetType, target_id: row.targetId } }]);
  return id;
}
