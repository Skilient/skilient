"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Badge, Button, EmptyState, Input, Label } from "@/components/ui";
import { markRefundSent, reviewPayment } from "@/lib/actions/event-payments";
import type { PaymentRow } from "@/lib/data/events";
import { PAYMENT_STATUS, pkr, REFUND_STATUS } from "@/lib/societies/constants";

/**
 * The Payments tab (PRD 5.31): each receipt with the amount, reference code, transaction ID and upload
 * time; possible duplicates are flagged, never rejected automatically. Approve confirms the seat; reject
 * needs a reason and gives the student 24 hours to upload again. Never recorded by analytics.
 */
export function PaymentsReview({ rows }: { rows: PaymentRow[] }) {
  if (!rows.length) return <EmptyState object="envelope" title="No payments yet" description="Paid registrations show up here with their receipts." />;
  return (
    <ul className="flex flex-col gap-3" data-testid="payments-review">
      {rows.map((p) => (
        <PaymentCard key={p.id} p={p} />
      ))}
    </ul>
  );
}

function PaymentCard({ p }: { p: PaymentRow }) {
  const id = useId();
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    startTransition(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) return setError(r.message ?? "That didn't work.");
      router.refresh();
    });
  const st = PAYMENT_STATUS[p.status];
  return (
    <li className="neu-card flex flex-col gap-3 p-4" data-testid="payment-card" data-payer={p.name}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">{p.name}</p>
        <span className="flex flex-wrap gap-2">
          {st ? <Badge tone={st.tone}>{st.label}</Badge> : null}
          {p.refundStatus ? <Badge tone="warning">{REFUND_STATUS[p.refundStatus]}</Badge> : null}
          {p.issueRaised ? <Badge tone="error">Raised with Skilient</Badge> : null}
        </span>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-body-sm sm:grid-cols-[auto_1fr_auto_1fr]">
        <dt className="text-text-secondary">Amount</dt>
        <dd className="neu-mono">{pkr(p.amountPkr)}</dd>
        <dt className="text-text-secondary">Reference</dt>
        <dd className="neu-mono">{p.referenceCode}</dd>
        <dt className="text-text-secondary">Transaction</dt>
        <dd className="neu-mono">{p.transactionId ?? "None given"}</dd>
        <dt className="text-text-secondary">Uploaded</dt>
        <dd className="neu-mono">{p.uploadedLabel ?? "Not yet"}</dd>
      </dl>
      {p.receiptUrl ? (
        <a href={p.receiptUrl} target="_blank" rel="noopener noreferrer" className="self-start text-body-sm font-semibold underline underline-offset-4" data-testid="receipt-link">
          Open the receipt
        </a>
      ) : null}
      {p.duplicates.length ? (
        <div className="rounded-md border border-warning/50 p-3 text-body-sm" data-testid="duplicate-flag">
          <p className="font-semibold">Possible duplicate</p>
          <ul>
            {p.duplicates.map((d, i) => (
              <li key={i}>
                {d.why === "transaction" ? "Same transaction ID" : "Same or very similar receipt"} also uploaded for {d.name}&apos;s registration ({d.event}) · {d.atLabel}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-body-sm text-text-error">
          {error}
        </p>
      ) : null}
      {p.status === "under_review" ? (
        <div className="flex flex-wrap items-end gap-3">
          <Button type="button" size="sm" loading={pending} onClick={() => run(() => reviewPayment({ paymentId: p.id, approve: true }))} data-testid="approve-payment">
            Approve
          </Button>
          <div className="flex min-w-56 flex-1 flex-col gap-1">
            <Label htmlFor={`${id}-reason`}>Reason to reject</Label>
            <Input id={`${id}-reason`} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder="Amount doesn't match" />
          </div>
          <Button type="button" size="sm" variant="ghost" loading={pending} onClick={() => run(() => reviewPayment({ paymentId: p.id, approve: false, reason }))}>
            Reject
          </Button>
        </div>
      ) : null}
      {p.refundStatus === "requested" || p.refundStatus === "disputed" ? (
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-56 flex-1 flex-col gap-1">
            <Label htmlFor={`${id}-note`}>Refund note (optional)</Label>
            <Input id={`${id}-note`} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="Sent by JazzCash, 12 Nov" />
          </div>
          <Button type="button" size="sm" variant="secondary" loading={pending} onClick={() => run(() => markRefundSent({ paymentId: p.id, note }))}>
            Mark refund sent
          </Button>
        </div>
      ) : null}
    </li>
  );
}
