import { uuidv7 } from "@skilient/platform";
import { refused, refusedWith } from "../refusals";
import { society, type Db, type Filler, type Row, type Tx } from "./db";
import { audit, memberChanged, publish, societyStatusChanged, societyVerified } from "./publish";
import { CARD } from "./societies";

/**
 * Staff: the society verification queue (trust reviewers with two-factor; the handler checks the role). Every
 * write is audited with the state before and after, in its transaction (ops_audit_log on the stack; community's
 * audit_log and audit.recorded here). Ported from 20261111000001_societies.sql.
 */

/** `ops_societies(status)`: open | more_info | decided | anything else for all. */
export async function opsSocieties(db: Db, me: string, status: string, fill: Filler): Promise<Row[]> {
  const [r] = await db<{ v: Row[] }[]>`
    select coalesce(jsonb_agg(jsonb_build_object(
             'society_id', s.id, 'name', s.name, 'slug', s.slug, 'category', s.category, 'university', '$university:' || s.university_id,
             'status', s.status, 'request_status', r.status, 'requester', '$name:' || r.requester_id, 'created_at', r.created_at,
             'age_hours', floor(extract(epoch from now() - r.created_at) / 3600),
             'claimed_by', case when r.claimed_by is not null then '$name:' || r.claimed_by end, 'mine', r.claimed_by = ${me})
             order by r.created_at), '[]'::jsonb) as v
      from (select r.* from community.society_requests r
             where case ${status} when 'open' then r.status = 'pending' when 'more_info' then r.status = 'more_info'
                                  when 'decided' then r.status in ('approved', 'rejected') else true end
             order by r.created_at limit 200) r
      join community.societies s on s.id = r.society_id`;
  return fill(r!.v);
}

/** `ops_society_case(society)`: the latest request with its proof. */
export async function opsSocietyCase(db: Db, me: string, societyId: string, fill: Filler): Promise<Row> {
  const [r] = await db<{ v: Row }[]>`
    select ${CARD(db)} || jsonb_build_object(
      'request_id', r.id, 'request_status', r.status, 'proof_path', r.proof_path, 'proof_url', r.proof_url,
      'office_bearer', r.office_bearer, 'staff_note', r.staff_note, 'created_at', r.created_at,
      'claimed_by', case when r.claimed_by is not null then '$name:' || r.claimed_by end, 'mine', r.claimed_by = ${me},
      'requester', jsonb_build_object('name', '$name:' || r.requester_id, 'username', '$username:' || r.requester_id,
                                      'department', '$department:' || r.requester_id, 'graduation_year', '$batch:' || r.requester_id),
      'status_reason', s.status_reason) as v
      from (select * from community.society_requests where society_id = ${societyId} order by created_at desc limit 1) r
      join community.societies s on s.id = r.society_id`;
  if (!r) throw refused("society_not_found");
  return fill(r.v);
}

/** `claim_society(society, claim)`. */
export async function claimSociety(tx: Tx, me: string, societyId: string, claim: boolean): Promise<void> {
  const [r] = await tx<{ id: string; claimed_by: string | null }[]>`
    select id::text, claimed_by::text from community.society_requests where society_id = ${societyId} and status = 'pending' for update`;
  if (!r) throw refused("nothing_to_claim");
  if (r.claimed_by !== null && r.claimed_by !== me) throw refused("someone_reviewing");
  await tx`
    update community.society_requests set claimed_by = ${claim ? me : null}, claimed_at = ${claim ? new Date() : null}, updated_at = now() where id = ${r.id}`;
  await audit(tx, {
    staffId: me,
    action: claim ? "society.claim" : "society.release",
    targetType: "society",
    targetId: societyId,
    reason: claim ? "claim society request" : "release society request",
    before: { claimed_by: r.claimed_by },
    after: { claimed_by: claim ? me : null },
  });
}

const ACTIONS: Record<string, string | undefined> = { approve: "verified", more_info: "more_info", reject: "rejected", suspend: "suspended", reinstate: "verified" };

/** `decide_society(society, action, reason)`: approve | more_info | reject | suspend | reinstate | pause_paid | resume_paid. */
export async function decideSociety(tx: Tx, me: string, societyId: string, action: string, reasonIn: string | null): Promise<void> {
  const s = await society(tx, societyId, true);
  if (!s) throw refused("society_not_found");
  const [r] = await tx<{ id: string; requester_id: string; status: string }[]>`
    select id::text, requester_id::text, status from community.society_requests where society_id = ${societyId} order by created_at desc limit 1 for update`;
  const reason = (reasonIn ?? "").trim() || null;
  if (["more_info", "reject", "suspend", "pause_paid"].includes(action) && (reason ?? "").length < 3) throw refused("society_reason");
  if (action === "pause_paid" || action === "resume_paid") {
    if (s.status !== "verified") throw refused("verified_sells");
    await tx`update community.societies set paid_paused = ${action === "pause_paid"}, updated_at = now() where id = ${societyId}`;
    await audit(tx, {
      staffId: me,
      action: `society.${action}`,
      targetType: "society",
      targetId: societyId,
      reason: reason ?? action,
      before: { paid_paused: s.paid_paused },
      after: { paid_paused: action === "pause_paid" },
    });
    return;
  }
  const to = ACTIONS[action];
  if (!to) throw refused("unknown_action");
  if ((["approve", "more_info", "reject"].includes(action) && s.status !== "pending") || (action === "suspend" && s.status !== "verified") || (action === "reinstate" && s.status !== "suspended"))
    throw refusedWith("society_cant", s.status);
  const [after] = await tx<{ verified_at: Date | null }[]>`
    update community.societies
       set status = ${to}, status_reason = ${reason},
           verified_by = case when ${action} = 'approve' then ${me}::uuid else verified_by end,
           verified_at = case when ${action} = 'approve' then now() else verified_at end, updated_at = now()
     where id = ${societyId} returning verified_at`;
  if (["approve", "more_info", "reject"].includes(action) && r) {
    await tx`
      update community.society_requests
         set status = ${action === "approve" ? "approved" : action === "reject" ? "rejected" : "more_info"}, staff_note = ${reason},
             decided_at = case when ${action} <> 'more_info' then now() end, updated_at = now()
       where id = ${r.id}`;
  }
  const events = [];
  if (action === "approve" && r) {
    // The requester opens the society as its President.
    await tx`
      insert into community.society_members (society_id, user_id, role, title) values (${societyId}, ${r.requester_id}, 'president', 'President')
      on conflict (society_id, user_id) do update set role = 'president', title = 'President'`;
    await tx`insert into community.society_follows (society_id, user_id) values (${societyId}, ${r.requester_id}) on conflict do nothing`;
    await tx`
      insert into community.society_terms (id, society_id, user_id, role, title, term_start, term_end)
      values (${uuidv7()}, ${societyId}, ${r.requester_id}, 'president', 'President', current_date, (current_date + interval '1 year')::date)
      on conflict do nothing`;
    events.push(memberChanged(societyId, r.requester_id, "president", me));
  }
  await audit(tx, {
    staffId: me,
    action: `society.${action}`,
    targetType: "society",
    targetId: societyId,
    reason: reason ?? `${action} society`,
    before: { status: s.status, request_status: r?.status ?? null },
    after: { status: to },
  });
  const next = { ...s, status: to, verified_at: after!.verified_at };
  events.push(societyStatusChanged(next, s.status, r?.requester_id ?? null, me));
  if (to === "verified" && s.status !== "verified" && action === "approve") events.push(societyVerified(next, r?.requester_id ?? null));
  await publish(tx, events);
}
