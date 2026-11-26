import { appendEvents, uuidv7, type NewEvent } from "@skilient/platform";
import { refused } from "../refusals";
import type { Db, Tx } from "./db";

/**
 * Anti-gaming flags for trust reviewers (/ops evidence?tab=ranking), ported from _ranking.sql's
 * ranking_flag_queue, ranking_flag_case, claim_ranking_flag and review_ranking_flag, and _skill_swap.sql's
 * swap_flags (work detects; ranking keeps one open flag per kind and members). Names come from people's
 * ProfileCards in web: these return ids. Every change publishes `ranking_flag.changed` (work's peer-review
 * check reads open and upheld ring and swap flags), and every staff write is audited with its before and after.
 */
export const flagChanged = (f: { id: string; kind: string; members: readonly string[]; status: string }): NewEvent => ({
  type: "ranking_flag.changed",
  subjects: [f.id, ...f.members],
  payload: { flag_id: f.id, kind: f.kind, members: [...f.members], status: f.status },
});

/** One audit row with the state before and after, and `audit.recorded` (ids only) for trust's /ops view. */
export async function audit(
  tx: Tx,
  row: { staffId: string; action: string; targetType: string; targetId: string; reason: string; before: unknown; after: unknown },
): Promise<string> {
  const id = uuidv7();
  await tx`
    insert into ranking.audit_log (id, staff_id, action, target_type, target_id, reason, before, after)
    values (${id}, ${row.staffId}, ${row.action}, ${row.targetType}, ${row.targetId}, ${row.reason},
            ${JSON.stringify(row.before ?? {})}::text::jsonb, ${JSON.stringify(row.after ?? {})}::text::jsonb)`;
  await appendEvents(tx, [{ type: "audit.recorded", subjects: [row.staffId], payload: { audit_id: id, action: row.action, target_type: row.targetType, target_id: row.targetId } }]);
  return id;
}

export interface QueueRow {
  id: string;
  kind: string;
  member_ids: string[];
  gain: string | null;
  from_total: string | null;
  to_total: string | null;
  endorsements: number;
  status: string;
  claimed_by: string | null;
  claimed_by_me: boolean;
  created_at: Date;
  reviewed_at: Date | null;
}

/** `ranking_flag_queue(status)`: open flags oldest first, or those reviewed in the last 30 days, newest first. */
export function flagQueue(db: Db, me: string, status: string) {
  return db<QueueRow[]>`
    select f.id::text, f.kind, f.members::text[] as member_ids, (f.detail->>'gain') as gain, (f.detail->>'from_total') as from_total,
           (f.detail->>'to_total') as to_total, cardinality(f.endorsement_ids) as endorsements, f.status, f.claimed_by::text,
           coalesce(f.claimed_by = ${me}::uuid, false) as claimed_by_me, f.created_at, f.reviewed_at
      from ranking.anti_gaming_flags f
     where (${status} = 'open' and f.status = 'open')
        or (${status} = 'reviewed' and f.status <> 'open' and f.reviewed_at > now() - interval '30 days')
     order by case when ${status} = 'open' then f.created_at end asc, f.reviewed_at desc
     limit 200`;
}

/** `ranking_flag_case(id)`: the flag, its members' published scores and the endorsements behind it. Null when unknown. */
export async function flagCase(db: Db, me: string, id: string) {
  const [f] = await db<
    {
      id: string;
      kind: string;
      status: string;
      detail: Record<string, unknown>;
      reason: string | null;
      created_at: Date;
      reviewed_at: Date | null;
      claimed_by: string | null;
      reviewed_by: string | null;
      members: string[];
      endorsement_ids: string[];
    }[]
  >`
    select id::text, kind, status, detail, reason, created_at, reviewed_at, claimed_by::text, reviewed_by::text, members::text[], endorsement_ids::text[]
      from ranking.anti_gaming_flags where id = ${id}`;
  if (!f) return null;
  const members = await db<{ user_id: string; university_id: string | null; total: string | null; tier: string | null }[]>`
    select m.uid::text as user_id, p.university_id::text, s.total::text, s.tier
      from unnest(${f.members}::uuid[]) m(uid)
      left join ranking.members p on p.user_id = m.uid
      left join ranking.ranking_scores s on s.user_id = m.uid
     order by m.uid`;
  const endorsements = await db<
    { id: string; endorser_id: string; endorsee_id: string; skill_id: string; skill_label: string | null; venture_id: string; venture_status: string | null; deliverables: number; hidden: boolean; created_at: Date }[]
  >`
    select e.id::text, e.endorser_id::text, e.endorsee_id::text, e.skill_id,
           (select k.label from ranking.user_skills k where k.skill_id = e.skill_id and k.label is not null limit 1) as skill_label,
           e.venture_id::text, v.status as venture_status, coalesce(c.deliverables, 0)::int as deliverables, e.hidden, e.created_at
      from ranking.endorsements e
      left join ranking.ventures v on v.venture_id = e.venture_id
      left join ranking.venture_completions c on c.venture_id = e.venture_id
     where e.id = any(${f.endorsement_ids}::uuid[])
     order by e.created_at, e.id`;
  return { ...f, claimed_by_me: f.claimed_by === me, is_member: f.members.includes(me), member_rows: members, endorsement_rows: endorsements };
}

async function lockFlag(tx: Tx, id: string) {
  const [f] = await tx<{ id: string; kind: string; status: string; claimed_by: string | null; members: string[]; user_id: string | null; detail: Record<string, unknown> }[]>`
    select id::text, kind, status, claimed_by::text, members::text[], user_id::text, detail from ranking.anti_gaming_flags where id = ${id} for update`;
  if (!f || f.status !== "open") throw refused("flag_not_waiting");
  return f;
}

/** `claim_ranking_flag(id, claim)`: claim or release; never a flag about yourself. Audited. */
export async function claimFlag(tx: Tx, me: string, id: string, claim: boolean): Promise<void> {
  const f = await lockFlag(tx, id);
  if (f.members.includes(me)) throw refused("own_flag");
  if (claim) {
    if (f.claimed_by !== null && f.claimed_by !== me) throw refused("flag_claimed_by_other");
    await tx`update ranking.anti_gaming_flags set claimed_by = ${me}, claimed_at = now(), updated_at = now() where id = ${id}`;
  } else {
    if (f.claimed_by !== me) throw refused("flag_not_claimed");
    await tx`update ranking.anti_gaming_flags set claimed_by = null, claimed_at = null, updated_at = now() where id = ${id}`;
  }
  await audit(tx, {
    staffId: me,
    action: claim ? "ranking_flag.claim" : "ranking_flag.release",
    targetType: "anti_gaming_flag",
    targetId: id,
    reason: claim ? "claimed to review" : "released",
    before: { claimed_by: f.claimed_by },
    after: { claimed_by: claim ? me : null },
  });
}

/**
 * `review_ranking_flag(id, uphold, reason)`: clear (a ring's endorsements count again; a held gain counts from
 * the next run) or uphold (a ring stays at 0; a held gain becomes a negative adjustment of the same size). Audited.
 */
export async function reviewFlag(tx: Tx, me: string, id: string, uphold: boolean, reason: string): Promise<void> {
  const text = reason.trim();
  if (text.length < 3) throw refused("give_reason");
  const f = await lockFlag(tx, id);
  if (f.claimed_by !== me) throw refused("claim_flag_first");
  const status = uphold ? "upheld" : "cleared";
  const kept = text.slice(0, 2000);
  await tx`
    update ranking.anti_gaming_flags
       set status = ${status}, reviewed_by = ${me}, reviewed_at = now(), reason = ${kept}, claimed_by = null, claimed_at = null, updated_at = now()
     where id = ${id}`;
  const gain = f.detail["gain"] === undefined ? null : Number(f.detail["gain"]);
  const adjustment = f.kind === "rapid_gain" && status === "upheld" ? -(gain ?? 0) : null;
  if (f.kind === "rapid_gain" && status === "upheld" && gain !== null && gain > 0)
    await tx`
      insert into ranking.ranking_adjustments (id, user_id, kind, points, reason, flag_id, staff_id)
      values (${uuidv7()}, ${f.user_id}, 'rapid_gain', ${-gain}, ${kept}, ${id}, ${me})`;
  await audit(tx, {
    staffId: me,
    action: `ranking_flag.${uphold ? "uphold" : "clear"}`,
    targetType: "anti_gaming_flag",
    targetId: id,
    reason: text,
    before: { status: f.status, kind: f.kind },
    after: { status, adjustment },
  });
  await appendEvents(tx, [flagChanged({ id, kind: f.kind, members: f.members, status })]);
}

/** work's `swap.flagged`: one open flag per kind and members (swap_flags deduplicated here). */
export async function recordSwapFlag(tx: Tx, kind: "swap_repeat" | "swap_ring", members: readonly string[], detail: Record<string, unknown>): Promise<boolean> {
  const sorted = [...members].sort();
  const [open] = await tx`select 1 from ranking.anti_gaming_flags where kind = ${kind} and status = 'open' and members = ${sorted}::uuid[]`;
  if (open) return false;
  const id = uuidv7();
  await tx`insert into ranking.anti_gaming_flags (id, kind, members, detail) values (${id}, ${kind}, ${sorted}::uuid[], ${JSON.stringify(detail)}::text::jsonb)`;
  await appendEvents(tx, [flagChanged({ id, kind, members: sorted, status: "open" })]);
  return true;
}
