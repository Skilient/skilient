import { uuidv7 } from "@skilient/platform";
import { referenceCode } from "../domain/names";
import { refused } from "../refusals";
import { event as eventRow, eventLimits, requireEventOfficer, requireOfficer, requireUser, society, type Db, type Filler, type Row, type Tx } from "./db";
import { fileReleased, methodChanged, paymentChanged, paymentDisputed, publish, registered, type PaymentChange } from "./publish";
import { CARD, type Files } from "./societies";

/**
 * Paid tickets (PRD 5.31, Ahmed 2026-11-02): the student pays the society directly and uploads the receipt; an
 * officer confirms it. Skilient never handles ticket money. Payment details change only when a second officer
 * confirms (society_audit_log keeps before and after). Ported from 20261111000003_paid_tickets.sql.
 */

interface Payment {
  id: string;
  registration_id: string;
  event_id: string;
  society_id: string;
  user_id: string;
  amount_pkr: number;
  reference_code: string;
  receipt_path: string | null;
  status: string;
  refund_status: string | null;
}
const PAYMENT = (db: Db) => db`id::text, registration_id::text, event_id::text, society_id::text, user_id::text, amount_pkr, reference_code, receipt_path, status, refund_status`;

async function payment(db: Db, where: "id" | "registration", value: string, lock = false): Promise<Payment | undefined> {
  const col = db(where === "id" ? "id" : "registration_id");
  const [p] = lock
    ? await db<Payment[]>`select ${PAYMENT(db)} from community.event_payments where ${col} = ${value} for update`
    : await db<Payment[]>`select ${PAYMENT(db)} from community.event_payments where ${col} = ${value}`;
  return p;
}

const changed = (p: Payment, status: string, refund: string | null, change: PaymentChange, actor: string | null) =>
  paymentChanged({ ...p, status, refund_status: refund }, change, actor);

// ---------------------------------------------------------------------------
// Payment details (two officers)
// ---------------------------------------------------------------------------
export interface MethodInput {
  action: string;
  replaces_id: string | null;
  kind: string;
  bank_name: string;
  account_title: string;
  account_number: string;
}

const methodJson = (db: Db, id: string | null) =>
  db`coalesce((select to_jsonb(m) - 'society_id' from community.society_payment_methods m where m.id = ${id}), '{}'::jsonb)`;

/** `propose_payment_method(society, p)`: add | replace | remove. */
export async function proposeMethod(tx: Tx, me: string | null, societyId: string, p: MethodInput): Promise<string> {
  const s = await requireOfficer(tx, societyId, me);
  if (s.status !== "verified") throw refused("payment_details_once_verified");
  const action = p.action || "add";
  if (!["add", "replace", "remove"].includes(action)) throw refused("unknown_change");
  if (action !== "add") {
    const [ok] = p.replaces_id
      ? await tx<{ x: boolean }[]>`select exists (select 1 from community.society_payment_methods where id = ${p.replaces_id} and society_id = ${societyId} and status = 'active') as x`
      : [{ x: false }];
    if (!ok!.x) throw refused("pick_method");
  }
  if (action === "add") {
    const [n] = await tx<{ n: number }[]>`
      select count(*)::int as n from community.society_payment_methods where society_id = ${societyId} and status in ('active', 'proposed') and action <> 'remove'`;
    if (n!.n >= 3) throw refused("max_methods");
  }
  const id = uuidv7();
  const keep = action !== "remove";
  await tx`
    insert into community.society_payment_methods (id, society_id, action, replaces_id, kind, bank_name, account_title, account_number, proposed_by)
    values (${id}, ${societyId}, ${action}, ${p.replaces_id}, ${keep ? p.kind || null : null},
            ${keep && p.kind === "bank" ? p.bank_name.trim() || null : null}, ${keep ? p.account_title.trim() || null : null},
            ${keep ? p.account_number.trim().toUpperCase() || null : null}, ${me})`;
  await tx`
    insert into community.society_audit_log (society_id, actor_id, action, before, after)
    values (${societyId}, ${me}, 'payment_method.propose', ${methodJson(tx, p.replaces_id)}, ${methodJson(tx, id)})`;
  await publish(tx, [methodChanged({ id, society_id: societyId, action, status: "proposed" }, me)]);
  return id;
}

/** `confirm_payment_method(method, accept)`: a second officer confirms (or rejects); the proposer can't. */
export async function confirmMethod(tx: Tx, me: string | null, methodId: string, accept: boolean): Promise<void> {
  const [m] = await tx<{ id: string; society_id: string; action: string; replaces_id: string | null; proposed_by: string | null }[]>`
    select id::text, society_id::text, action, replaces_id::text, proposed_by::text from community.society_payment_methods where id = ${methodId} and status = 'proposed' for update`;
  if (!m) throw refused("change_not_found");
  await requireOfficer(tx, m.society_id, me);
  if (m.proposed_by === me) throw refused("second_officer");
  const [before] = await tx<{ v: Row }[]>`select ${methodJson(tx, m.replaces_id)} as v`;
  let status: string;
  if (!accept) {
    status = "rejected";
    await tx`update community.society_payment_methods set status = 'rejected', confirmed_by = ${me}, confirmed_at = now() where id = ${m.id}`;
  } else {
    if (m.action !== "add") await tx`update community.society_payment_methods set status = 'ended', ended_at = now() where id = ${m.replaces_id} and status = 'active'`;
    status = m.action === "remove" ? "ended" : "active";
    await tx`
      update community.society_payment_methods
         set status = ${status}, confirmed_by = ${me}, confirmed_at = now(), effective_at = now(), ended_at = case when ${m.action} = 'remove' then now() end
       where id = ${m.id}`;
  }
  await tx`
    insert into community.society_audit_log (society_id, actor_id, action, before, after)
    values (${m.society_id}, ${me}, ${accept ? "payment_method.confirm" : "payment_method.reject"}, ${JSON.stringify(before!.v)}::text::jsonb, ${methodJson(tx, m.id)})`;
  await publish(tx, [methodChanged({ id: m.id, society_id: m.society_id, action: m.action, status }, me)]);
}

/** `payment_details_page(society)`. */
export async function paymentDetailsPage(db: Db, me: string | null, societyId: string, fill: Filler): Promise<Row> {
  const s = await requireOfficer(db, societyId, me);
  const [r] = await db<{ v: Row }[]>`
    select jsonb_build_object(
      'society', (select ${CARD(db)} from community.societies s where s.id = ${societyId}), 'paid_paused', ${s.paid_paused}::boolean,
      'active', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'kind', m.kind, 'bank_name', m.bank_name, 'account_title', m.account_title,
                                                              'account_number', m.account_number, 'effective_at', m.effective_at) order by m.effective_at)
                            from community.society_payment_methods m where m.society_id = ${societyId} and m.status = 'active'), '[]'::jsonb),
      'proposals', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'action', m.action, 'replaces_id', m.replaces_id, 'kind', m.kind,
                                                                 'bank_name', m.bank_name, 'account_title', m.account_title, 'account_number', m.account_number,
                                                                 'proposed_by', case when m.proposed_by is not null then '$name:' || m.proposed_by end,
                                                                 'proposed_at', m.proposed_at, 'mine', m.proposed_by = ${me}) order by m.proposed_at)
                               from community.society_payment_methods m where m.society_id = ${societyId} and m.status = 'proposed'), '[]'::jsonb),
      'history', coalesce((select jsonb_agg(jsonb_build_object('action', a.action, 'actor', case when a.actor_id is not null then '$name:' || a.actor_id end,
                                                               'at', a.created_at) order by a.created_at desc)
                             from community.society_audit_log a where a.society_id = ${societyId} and a.action like 'payment_method.%'), '[]'::jsonb)) as v`;
  return fill(r!.v);
}

// ---------------------------------------------------------------------------
// Holds and payments
// ---------------------------------------------------------------------------
/** `open_payment(registration)`: the payment record for a held seat (a fresh reference code). */
export async function openPayment(tx: Tx, registrationId: string): Promise<void> {
  const [r] = await tx<{ event_id: string; user_id: string; society_id: string; price: number | null }[]>`
    select r.event_id::text, r.user_id::text, e.society_id::text, t.price_pkr as price
      from community.event_registrations r join community.events e on e.id = r.event_id
      left join community.event_ticket_types t on t.id = r.ticket_type_id where r.id = ${registrationId}`;
  if (!r || r.price === null) return;
  let code = referenceCode();
  for (;;) {
    const [x] = await tx<{ x: boolean }[]>`select exists (select 1 from community.event_payments where reference_code = ${code}) as x`;
    if (!x!.x) break;
    code = referenceCode();
  }
  const [p] = await tx<Payment[]>`
    insert into community.event_payments (id, registration_id, event_id, society_id, user_id, amount_pkr, reference_code)
    values (${uuidv7()}, ${registrationId}, ${r.event_id}, ${r.society_id}, ${r.user_id}, ${r.price}, ${code})
    on conflict (registration_id) do update
      set status = 'awaiting', amount_pkr = excluded.amount_pkr, reject_reason = null, decided_by = null, decided_at = null,
          receipt_path = null, receipt_hash = null, receipt_phash = null, transaction_id = null, uploaded_at = null,
          refund_status = null, issue_raised_at = null
    returning ${PAYMENT(tx)}`;
  await publish(tx, [changed(p!, "awaiting", null, "opened", null)]);
}

/** `ticket_payment(event)`: the buyer's sheet. */
export async function ticketPayment(db: Db, me: string | null, eventId: string): Promise<Row> {
  const m = await requireUser(db, me);
  const [r] = await db<{ v: Row | null }[]>`
    select (select jsonb_build_object(
      'payment_id', p.id, 'registration_id', r.id, 'event_id', e.id, 'amount_pkr', p.amount_pkr, 'reference_code', p.reference_code,
      'status', p.status, 'reject_reason', p.reject_reason, 'uploaded_at', p.uploaded_at, 'hold_expires_at', r.hold_expires_at,
      'registration_status', r.status, 'refund_status', p.refund_status, 'refund_note', p.refund_note,
      'refund_policy', e.refund_policy, 'refund_days', e.refund_days, 'has_receipt', p.receipt_path is not null,
      'issue_raised_at', p.issue_raised_at,
      'society', (select jsonb_build_object('name', s.name, 'slug', s.slug) from community.societies s where s.id = p.society_id),
      'methods', case when p.status in ('awaiting', 'rejected', 'under_review') then coalesce((
          select jsonb_agg(jsonb_build_object('kind', x.kind, 'bank_name', x.bank_name, 'account_title', x.account_title,
                                              'account_number', x.account_number, 'updated_at', x.effective_at) order by x.effective_at)
            from community.society_payment_methods x where x.society_id = p.society_id and x.status = 'active'), '[]'::jsonb) end)
      from community.event_registrations r join community.event_payments p on p.registration_id = r.id join community.events e on e.id = r.event_id
     where r.event_id = ${eventId} and r.user_id = ${m.id}) as v`;
  if (!r!.v) throw refused("no_payment");
  return r!.v;
}

/** `submit_receipt(registration, path, hash, phash, transaction)`: after web checked the file and media stored it. */
export async function submitReceipt(tx: Tx, me: string | null, registrationId: string, path: string, hash: string, phash: string, transactionId: string, files: Files): Promise<void> {
  const m = await requireUser(tx, me);
  const [r] = await tx<{ id: string; event_id: string; status: string; expired: boolean }[]>`
    select id::text, event_id::text, status, coalesce(hold_expires_at < now(), false) as expired
      from community.event_registrations where id = ${registrationId} and user_id = ${m.id} for update`;
  const p = await payment(tx, "registration", registrationId, true);
  if (!r || !p) throw refused("ticket_not_found");
  if (!["awaiting", "rejected"].includes(p.status) || r.status !== "held") throw refused("not_waiting_receipt");
  if (r.expired) throw refused("hold_expired");
  const parts = path.split("/");
  if (parts[0] !== r.event_id || parts[1] !== r.id || !(await files.exists("event-receipts", path))) throw refused("upload_receipt_again");
  const events = [];
  if (p.receipt_path && p.receipt_path !== path) events.push(...fileReleased("event-receipts", p.receipt_path, m.id));
  await tx`
    update community.event_payments
       set receipt_path = ${path}, receipt_hash = ${hash}, receipt_phash = ${phash || null},
           transaction_id = ${transactionId.trim() || null}, status = 'under_review', uploaded_at = now(), reject_reason = null
     where id = ${p.id}`;
  // The hold lasts until an officer decides.
  await tx`update community.event_registrations set hold_expires_at = null where id = ${r.id}`;
  events.push(changed(p, "under_review", p.refund_status, "submitted", m.id));
  await publish(tx, events);
}

/** `payments_review(event)`: the officers' Payments tab, with duplicates (same receipt, a near picture, or the transaction ID). */
export async function paymentsReview(db: Db, me: string | null, eventId: string, fill: Filler): Promise<Row[]> {
  await requireEventOfficer(db, eventId, me);
  const [r] = await db<{ v: Row[] }[]>`
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', p.id, 'name', '$name:' || p.user_id, 'username', '$username:' || p.user_id, 'amount_pkr', p.amount_pkr, 'reference_code', p.reference_code,
             'transaction_id', p.transaction_id, 'status', p.status, 'uploaded_at', p.uploaded_at, 'receipt_path', p.receipt_path,
             'reject_reason', p.reject_reason, 'refund_status', p.refund_status, 'refund_requested_at', p.refund_requested_at,
             'issue_raised_at', p.issue_raised_at,
             'duplicates', coalesce((
               select jsonb_agg(jsonb_build_object('name', '$name:' || o.user_id, 'event', oe.title, 'at', o.uploaded_at,
                                                   'why', case when o.transaction_id is not null and lower(o.transaction_id) = lower(p.transaction_id) then 'transaction' else 'receipt' end))
                 from community.event_payments o join community.events oe on oe.id = o.event_id
                where o.society_id = p.society_id and o.id <> p.id
                  and ((p.receipt_hash is not null and o.receipt_hash = p.receipt_hash)
                       or (p.receipt_phash is not null and o.receipt_phash is not null
                           and bit_count(('x' || o.receipt_phash)::bit(64) # ('x' || p.receipt_phash)::bit(64)) <= 4)
                       or (p.transaction_id is not null and lower(o.transaction_id) = lower(p.transaction_id)))), '[]'::jsonb))
             order by (p.status = 'under_review') desc, p.uploaded_at nulls last), '[]'::jsonb) as v
      from community.event_payments p where p.event_id = ${eventId}`;
  return fill(r!.v);
}

/** `review_payment(payment, approve, reason)`: approving confirms the ticket; rejecting gives another hold. */
export async function reviewPayment(tx: Tx, me: string | null, paymentId: string, approve: boolean, reasonIn: string | null): Promise<void> {
  const p = await payment(tx, "id", paymentId, true);
  if (!p) throw refused("payment_not_found");
  const e = await requireEventOfficer(tx, p.event_id, me);
  if (p.status !== "under_review") throw refused("not_waiting_review");
  const reason = (reasonIn ?? "").trim() || null;
  if (!approve && (reason ?? "").length < 3) throw refused("say_why");
  const events = [];
  if (approve) {
    await tx`update community.event_payments set status = 'approved', decided_by = ${me}, decided_at = now(), issue_raised_at = null where id = ${p.id}`;
    const conf = await tx`update community.event_registrations set status = 'confirmed', hold_expires_at = null, decided_at = now() where id = ${p.registration_id} and status = 'held'`;
    events.push(changed(p, "approved", p.refund_status, "approved", me));
    if (conf.count) events.push(registered({ id: p.registration_id, event_id: p.event_id, society_id: p.society_id, user_id: p.user_id, status: "confirmed", waitlist_position: null }, "held", "decided", true, me));
  } else {
    const L = await eventLimits(tx);
    await tx`update community.event_payments set status = 'rejected', reject_reason = ${reason}, decided_by = ${me}, decided_at = now() where id = ${p.id}`;
    await tx`update community.event_registrations set hold_expires_at = now() + make_interval(hours => ${L.hold_hours}) where id = ${p.registration_id} and status = 'held'`;
    events.push(changed(p, "rejected", p.refund_status, "rejected", me));
  }
  void e;
  await publish(tx, events);
}

/** `raise_payment_issue(registration)`: "I paid but wasn't confirmed"; the society first, trust after 72 hours. */
export async function raiseIssue(tx: Tx, me: string | null, registrationId: string): Promise<void> {
  const p = await payment(tx, "registration", registrationId, true);
  if (!p || p.user_id !== me || p.status !== "under_review") throw refused("nothing_to_raise");
  await tx`update community.event_payments set issue_raised_at = coalesce(issue_raised_at, now()) where id = ${p.id}`;
  await publish(tx, [changed(p, p.status, p.refund_status, "issue", me)]);
}

/** `registration_cancelled_payment(registration)`: an unpaid hold is released; a paid seat within the policy is owed a refund. */
export async function registrationCancelled(tx: Tx, registrationId: string): Promise<void> {
  const p = await payment(tx, "registration", registrationId, true);
  if (!p) return;
  const e = (await eventRow(tx, p.event_id))!;
  if (["awaiting", "under_review", "rejected"].includes(p.status)) {
    await tx`update community.event_payments set status = 'released' where id = ${p.id}`;
    await publish(tx, [changed(p, "released", p.refund_status, "released", null)]);
    return;
  }
  if (p.status === "approved" && e.refund_policy === "until") {
    const [ok] = await tx<{ x: boolean }[]>`select now() <= ${e.starts_at}::timestamptz - make_interval(days => ${e.refund_days ?? 0}) as x`;
    if (ok!.x) {
      await tx`update community.event_payments set refund_status = 'requested', refund_requested_at = now() where id = ${p.id}`;
      await publish(tx, [changed(p, p.status, "requested", "refund_requested", p.user_id)]);
    }
  }
}

/** `event_cancelled_refunds(event)`: the host cancelled; every paid registrant is owed a refund. */
export async function cancelledRefunds(tx: Tx, eventId: string, actor: string | null): Promise<void> {
  const owed = await tx<Payment[]>`
    update community.event_payments set refund_status = 'requested', refund_requested_at = now()
     where event_id = ${eventId} and status = 'approved' and refund_status is null returning ${PAYMENT(tx)}`;
  const released = await tx<Payment[]>`
    update community.event_payments set status = 'released' where event_id = ${eventId} and status in ('awaiting', 'under_review', 'rejected') returning ${PAYMENT(tx)}`;
  await publish(tx, [...owed.map((p) => changed(p, p.status, "requested", "refund_requested", actor)), ...released.map((p) => changed(p, "released", p.refund_status, "released", actor))]);
}

/** `mark_refund_sent(payment, note)`. */
export async function markRefundSent(tx: Tx, me: string | null, paymentId: string, note: string | null): Promise<void> {
  const p = await payment(tx, "id", paymentId, true);
  if (!p) throw refused("payment_not_found");
  await requireEventOfficer(tx, p.event_id, me);
  if (!["requested", "disputed"].includes(p.refund_status ?? "")) throw refused("no_refund_waiting");
  await tx`update community.event_payments set refund_status = 'sent', refund_sent_at = now(), refund_note = ${(note ?? "").trim() || null} where id = ${p.id}`;
  await publish(tx, [changed(p, p.status, "sent", "refund_sent", me)]);
}

/** `confirm_refund(payment, received)`: Received, or Not received (trust after 72 hours unanswered). */
export async function confirmRefund(tx: Tx, me: string | null, paymentId: string, received: boolean): Promise<void> {
  const p = await payment(tx, "id", paymentId, true);
  if (!p || p.user_id !== me || !["sent", "requested"].includes(p.refund_status ?? "")) throw refused("no_refund_to_confirm");
  const status = received ? "received" : "disputed";
  await tx`update community.event_payments set refund_status = ${status}, refund_answered_at = now() where id = ${p.id}`;
  await publish(tx, [changed(p, p.status, status, received ? "refund_received" : "refund_disputed", me)]);
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------
/** Held seats past their hold (no receipt, or a rejected one): freed, and the waitlist moves (event-tick). */
export async function expireHolds(tx: Tx, promote: (tx: Tx, ticketId: string) => Promise<number>): Promise<number> {
  const due = await tx<{ id: string; event_id: string; society_id: string; user_id: string; ticket_type_id: string }[]>`
    select r.id::text, r.event_id::text, e.society_id::text, r.user_id::text, r.ticket_type_id::text
      from community.event_registrations r join community.events e on e.id = r.event_id
     where r.status = 'held' and r.hold_expires_at is not null and r.hold_expires_at < now()
     order by r.hold_expires_at limit 500`;
  let n = 0;
  for (const r of due) {
    await tx`select 1 from community.event_ticket_types where id = ${r.ticket_type_id} for update`;
    const upd = await tx`
      update community.event_registrations set status = 'cancelled', cancelled_at = now(), hold_expires_at = null
       where id = ${r.id} and status = 'held' and hold_expires_at < now()`;
    if (!upd.count) continue;
    const released = await tx<Payment[]>`
      update community.event_payments set status = 'released' where registration_id = ${r.id} and status in ('awaiting', 'rejected') returning ${PAYMENT(tx)}`;
    await publish(tx, [
      registered({ ...r, status: "cancelled", waitlist_position: null }, "held", "hold_expired", true, null),
      ...released.map((p) => changed(p, "released", p.refund_status, "released", null)),
    ]);
    await promote(tx, r.ticket_type_id);
    n += 1;
  }
  return n;
}

/**
 * event-closeout's payments: disputes go to trust after 72 hours (payment.disputed; trust opens the report case,
 * W10); unmarked refunds on a cancelled event after 14 days; receipts are released to media 90 days after the event.
 */
export async function closeoutPayments(tx: Tx): Promise<number> {
  const L = await eventLimits(tx);
  const disputes = await tx<(Payment & { why: "unconfirmed_payment" | "refund_disputed" | "refund_unmarked"; president: string | null })[]>`
    with due as (
      select x.id,
             case when x.issue_raised_at is not null and x.status = 'under_review' and x.issue_raised_at < now() - make_interval(hours => ${L.dispute_hours}) then 'unconfirmed_payment'
                  when x.refund_status = 'disputed' and x.refund_answered_at < now() - make_interval(hours => ${L.dispute_hours}) then 'refund_disputed'
                  else 'refund_unmarked' end as why
        from community.event_payments x join community.events e on e.id = x.event_id
       where x.disputed_at is null
         and ((x.issue_raised_at is not null and x.status = 'under_review' and x.issue_raised_at < now() - make_interval(hours => ${L.dispute_hours}))
              or (x.refund_status = 'disputed' and x.refund_answered_at < now() - make_interval(hours => ${L.dispute_hours}))
              or (x.refund_status = 'requested' and e.cancelled_at is not null and e.cancelled_at < now() - make_interval(days => ${L.refund_flag_days})))
       limit 200)
    update community.event_payments p set disputed_at = now() from due where p.id = due.id
    returning p.id::text, p.registration_id::text, p.event_id::text, p.society_id::text, p.user_id::text, p.amount_pkr, p.reference_code,
              p.receipt_path, p.status, p.refund_status, due.why,
              (select m.user_id::text from community.society_members m where m.society_id = p.society_id and m.role = 'president') as president`;
  const receipts = await tx<{ receipt_path: string; user_id: string }[]>`
    with due as (
      select x.id, x.receipt_path from community.event_payments x join community.events e on e.id = x.event_id
       where x.receipt_path is not null and e.ends_at < now() - make_interval(days => ${L.receipt_delete_days}) limit 500)
    update community.event_payments p set receipt_path = null, receipt_deleted_at = now() from due where p.id = due.id
    returning due.receipt_path, p.user_id::text`;
  await publish(tx, [...disputes.map((p) => paymentDisputed(p, p.president, p.why)), ...receipts.flatMap((r) => fileReleased("event-receipts", r.receipt_path, r.user_id))]);
  return disputes.length + receipts.length;
}

/** Used by staff pages: the society of a payment. */
export const societyOf = society;
