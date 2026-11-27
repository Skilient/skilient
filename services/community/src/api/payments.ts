import type { ServiceImpl } from "@connectrpc/connect";
import * as C from "@skilient/contracts/community/v1/community_pb";
import { z } from "zod";
import * as P from "../store/payments";
import { filler, id, json, meOf, opt, parse, restricted, Text, write, type ApiDeps } from "./util";

const Hex = (n: number) => z.union([z.literal(""), z.string().regex(new RegExp(`^[0-9a-f]{${n}}$`))]);

/** Paid tickets: payment details (two officers), the buyer's sheet and receipt, review, issues and refunds. */
export function paymentsApi(deps: ApiDeps): Partial<ServiceImpl<typeof C.CommunityService>> {
  const { sql } = deps;
  return {
    async proposePaymentMethod(req, ctx) {
      const p = parse(
        z.object({
          societyId: z.uuid(),
          action: Text(20),
          replacesId: z.union([z.literal(""), z.uuid()]),
          kind: z.union([z.literal(""), z.enum(["bank", "jazzcash", "easypaisa"])]),
          bankName: Text(120),
          accountTitle: Text(160),
          accountNumber: Text(60),
        }),
        req,
      );
      return write(deps, ctx, C.ProposePaymentMethodRequestSchema, C.ProposePaymentMethodResponseSchema, req, async (tx) => {
        restricted(ctx);
        const methodId = await P.proposeMethod(tx, meOf(ctx), p.societyId, {
          action: p.action,
          replaces_id: opt(p.replacesId),
          kind: p.kind,
          bank_name: p.bankName,
          account_title: p.accountTitle,
          account_number: p.accountNumber,
        });
        return { methodId };
      });
    },
    async confirmPaymentMethod(req, ctx) {
      const methodId = id(req.methodId);
      return write(deps, ctx, C.ConfirmPaymentMethodRequestSchema, C.ConfirmPaymentMethodResponseSchema, req, async (tx) => {
        await P.confirmMethod(tx, meOf(ctx), methodId, req.accept);
        return {};
      });
    },
    async paymentDetailsPage(req, ctx) {
      return { json: json(await P.paymentDetailsPage(sql, meOf(ctx), id(req.societyId), filler(deps, ctx))) };
    },
    async ticketPayment(req, ctx) {
      return { json: json(await P.ticketPayment(sql, meOf(ctx), id(req.eventId))) };
    },
    async submitReceipt(req, ctx) {
      const p = parse(z.object({ registrationId: z.uuid(), path: Text(200), hash: z.string().regex(/^[0-9a-f]{64}$/), phash: Hex(16), transactionId: Text(40) }), req);
      return write(deps, ctx, C.SubmitReceiptRequestSchema, C.SubmitReceiptResponseSchema, req, async (tx) => {
        await P.submitReceipt(tx, meOf(ctx), p.registrationId, p.path, p.hash, p.phash, p.transactionId, deps.files);
        return {};
      });
    },
    async paymentsReview(req, ctx) {
      return { json: json(await P.paymentsReview(sql, meOf(ctx), id(req.eventId), filler(deps, ctx))) };
    },
    async reviewPayment(req, ctx) {
      const p = parse(z.object({ paymentId: z.uuid(), reason: Text(300) }), req);
      return write(deps, ctx, C.ReviewPaymentRequestSchema, C.ReviewPaymentResponseSchema, req, async (tx) => {
        await P.reviewPayment(tx, meOf(ctx), p.paymentId, req.approve, opt(p.reason));
        return {};
      });
    },
    async raisePaymentIssue(req, ctx) {
      const registrationId = id(req.registrationId);
      return write(deps, ctx, C.RaisePaymentIssueRequestSchema, C.RaisePaymentIssueResponseSchema, req, async (tx) => {
        await P.raiseIssue(tx, meOf(ctx), registrationId);
        return {};
      });
    },
    async markRefundSent(req, ctx) {
      const p = parse(z.object({ paymentId: z.uuid(), note: Text(300) }), req);
      return write(deps, ctx, C.MarkRefundSentRequestSchema, C.MarkRefundSentResponseSchema, req, async (tx) => {
        await P.markRefundSent(tx, meOf(ctx), p.paymentId, opt(p.note));
        return {};
      });
    },
    async confirmRefund(req, ctx) {
      const paymentId = id(req.paymentId);
      return write(deps, ctx, C.ConfirmRefundRequestSchema, C.ConfirmRefundResponseSchema, req, async (tx) => {
        await P.confirmRefund(tx, meOf(ctx), paymentId, req.received);
        return {};
      });
    },
  };
}
