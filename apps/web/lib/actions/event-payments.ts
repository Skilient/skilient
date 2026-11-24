"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { actionContext } from "@/lib/actions/context";
import { rpcAction } from "@/lib/actions/recruit-run";
import { fail, type ActionResult } from "@/lib/actions/result";
import { call, NO_SESSION, signedIn } from "@/lib/actions/rpc";
import { prepareProof, PROOF_MESSAGES, ProofRejected } from "@/lib/images/proof-file";

/**
 * Paid tickets, paid directly to the society (PRD 5.31). Skilient never holds money: the student pays
 * the society's account with a reference code, uploads the receipt, and an officer checks it. Payment
 * details need a second officer's confirmation. Receipts sit in the private event-receipts bucket,
 * readable by the student, the event's officers and (once reported) moderators, and are deleted 90 days
 * after the event.
 */

const uuid = z.uuid();

const methodSchema = z
  .object({
    societyId: uuid,
    action: z.enum(["add", "replace", "remove"]),
    replacesId: uuid.nullable().default(null),
    kind: z.enum(["bank", "jazzcash", "easypaisa"]).default("bank"),
    bankName: z.string().trim().max(80).default(""),
    accountTitle: z.string().trim().max(80).default(""),
    accountNumber: z
      .string()
      .trim()
      .toUpperCase()
      .max(34)
      .default(""),
  })
  .refine((v) => v.action === "add" || v.replacesId !== null, { message: "Pick the account to change.", path: ["replacesId"] })
  .refine((v) => v.action === "remove" || v.accountTitle.length >= 3, { message: "Give the account title exactly as the bank shows it.", path: ["accountTitle"] })
  .refine((v) => v.action === "remove" || /^[A-Z0-9 -]{6,34}$/.test(v.accountNumber), {
    message: "Use the IBAN, account or wallet number (letters, digits, spaces).",
    path: ["accountNumber"],
  })
  .refine((v) => v.action === "remove" || v.kind !== "bank" || v.bankName.length >= 2, { message: "Name the bank.", path: ["bankName"] });

export async function proposePaymentMethod(input: unknown) {
  return rpcAction<typeof methodSchema, string>({
    name: "payments.propose_method",
    schema: methodSchema,
    input,
    fn: "propose_payment_method",
    args: (v) => ({
      p_society: v.societyId,
      p: {
        action: v.action,
        replaces_id: v.replacesId,
        kind: v.kind,
        bank_name: v.kind === "bank" ? v.bankName : null,
        account_title: v.accountTitle || null,
        account_number: v.accountNumber || null,
      },
    }),
  });
}

/** A second officer confirms (or rejects) a change; the proposer can't (SQL refuses). */
export async function confirmPaymentMethod(input: unknown) {
  return rpcAction({
    name: "payments.confirm_method",
    schema: z.object({ methodId: uuid, accept: z.boolean() }),
    input,
    fn: "confirm_payment_method",
    args: (v) => ({ p_method: v.methodId, p_accept: v.accept }),
  });
}

/** The student's receipt: checked and re-encoded here, stored at {event}/{registration}/{uuid}, then submitted. */
export async function submitReceipt(form: FormData): Promise<ActionResult> {
  const ctx = await actionContext("payments.receipt");
  const parsed = z
    .object({ eventId: uuid, registrationId: uuid, transactionId: z.string().trim().max(60).default("") })
    .safeParse({ eventId: form.get("eventId"), registrationId: form.get("registrationId"), transactionId: form.get("transactionId") ?? "" });
  const file = form.get("receipt");
  if (!parsed.success) {
    ctx.done("refused", { error_code: "invalid_input" });
    return fail("invalid_input", "Something's missing. Reload the page and try again.");
  }
  if (!(file instanceof File) || file.size === 0) {
    ctx.done("refused", { error_code: "invalid_input" });
    return fail("invalid_input", "Choose the receipt (a screenshot or a PDF).", { fields: { receipt: "Choose the receipt (a screenshot or a PDF)." } });
  }
  const session = await signedIn(ctx);
  if (!session) return NO_SESSION;
  let proof;
  try {
    proof = await prepareProof(file);
  } catch (err) {
    const message = err instanceof ProofRejected ? PROOF_MESSAGES[err.reason] : PROOF_MESSAGES.unreadable;
    ctx.done("refused", { error_code: "invalid_file", user_id: session.userId });
    return fail("invalid_file", message, { fields: { receipt: message } });
  }
  const path = `${parsed.data.eventId}/${parsed.data.registrationId}/${randomUUID()}.${proof.ext}`;
  const upload = await session.supabase.storage.from("event-receipts").upload(path, proof.data, { contentType: proof.contentType, upsert: false });
  if (upload.error) {
    ctx.done("refused", { error_code: "upload_refused", user_id: session.userId });
    return fail("not_now", "This ticket isn't waiting for a receipt any more. Reload the page.");
  }
  const result = await call(ctx, session.supabase, session.userId, "submit_receipt", {
    p_registration: parsed.data.registrationId,
    p_path: path,
    p_hash: proof.sha256,
    p_phash: proof.phash,
    p_transaction_id: parsed.data.transactionId || null,
  });
  if (!result.ok) await session.supabase.storage.from("event-receipts").remove([path]);
  return result;
}

export async function reviewPayment(input: unknown) {
  return rpcAction({
    name: "payments.review",
    schema: z
      .object({ paymentId: uuid, approve: z.boolean(), reason: z.string().trim().max(300).default("") })
      .refine((v) => v.approve || v.reason.length >= 5, { message: "Tell the student what's wrong with the receipt.", path: ["reason"] }),
    input,
    fn: "review_payment",
    args: (v) => ({ p_payment: v.paymentId, p_approve: v.approve, p_reason: v.reason || null }),
  });
}

/** No decision after 72 hours: the student raises it; it reaches Skilient as a report. */
export async function raisePaymentIssue(input: unknown) {
  return rpcAction({
    name: "payments.raise",
    schema: z.object({ registrationId: uuid }),
    input,
    fn: "raise_payment_issue",
    args: (v) => ({ p_registration: v.registrationId }),
  });
}

export async function markRefundSent(input: unknown) {
  return rpcAction({
    name: "payments.refund_sent",
    schema: z.object({ paymentId: uuid, note: z.string().trim().max(300).default("") }),
    input,
    fn: "mark_refund_sent",
    args: (v) => ({ p_payment: v.paymentId, p_note: v.note || null }),
  });
}

export async function confirmRefund(input: unknown) {
  return rpcAction({
    name: "payments.refund_confirm",
    schema: z.object({ paymentId: uuid, received: z.boolean() }),
    input,
    fn: "confirm_refund",
    args: (v) => ({ p_payment: v.paymentId, p_received: v.received }),
  });
}
