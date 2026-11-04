import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReceiptForm } from "@/components/events/receipt-form";
import { PushOffer } from "@/components/pwa/push-offer";
import { ActionButton } from "@/components/societies/action-button";
import { Badge, Ticket, type TicketStatus } from "@/components/ui";
import { confirmRefund, raisePaymentIssue } from "@/lib/actions/event-payments";
import { cancelRegistration } from "@/lib/actions/events";
import { qrDataUri } from "@/lib/cv/qr";
import { getTicket, getTicketPayment, type TicketData } from "@/lib/data/events";
import { isRefusal } from "@/lib/data/rpc-json";
import { PAYMENT_STATUS, paymentKindLabel, pkr, REFUND_STATUS, REGISTRATION_STATUS } from "@/lib/societies/constants";

export const metadata: Metadata = { title: "Ticket" };
export const dynamic = "force-dynamic";

/**
 * Your ticket (PRD 5.31): a signed QR the door scans offline-first (the signature is checked on scan),
 * the sessions you checked in to, and for a paid ticket the society's payment details, your reference
 * code, the receipt upload and the refund status. Never recorded by analytics (lib/analytics/privacy.ts).
 */
export default async function TicketPage({ params }: PageProps<"/events/[id]/ticket">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  let t: TicketData;
  try {
    t = await getTicket(id);
  } catch (err) {
    if (isRefusal(err, "P0002", "42501")) notFound();
    throw err;
  }
  const payment = await getTicketPayment(id);
  const qr = t.payload ? await qrDataUri(t.payload) : null;
  const status: TicketStatus | null =
    t.regStatus === "confirmed" ? (t.checkedIn.length ? "checked_in" : "valid") : t.regStatus === "waitlisted" ? "waitlisted" : ["cancelled", "declined"].includes(t.regStatus) ? "cancelled" : null;
  const reg = REGISTRATION_STATUS[t.regStatus];
  const host = t.society?.name ?? "The society";

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-[var(--page-gutter)] py-6" data-testid="ticket-page">
      <Link href={`/events/${t.id}` as Route} className="inline-flex items-center gap-1 text-body-sm font-semibold underline-offset-4 hover:underline">
        <ArrowLeft aria-hidden weight="bold" className="size-4" />
        {t.title}
      </Link>
      <h1 className="font-display text-h2">Your ticket</h1>
      <p className="text-caption text-text-secondary">Opened once, this ticket also shows without signal on this device.</p>
      {status ? (
        <Ticket
          title={t.title}
          host={host}
          when={t.startsLabel}
          where={t.location ?? (t.link ? "Online" : undefined)}
          type={t.ticketType?.name}
          code={t.code}
          status={status}
          qr={
            qr ? (
              // eslint-disable-next-line @next/next/no-img-element -- the signed ticket QR as a data URI
              <img src={qr} alt={`Ticket code ${t.code}`} className="size-full" data-testid="ticket-qr" />
            ) : undefined
          }
        />
      ) : (
        <section className="neu-card flex flex-col gap-2 p-5" data-testid="ticket-status">
          <p className="flex items-center gap-2">{reg ? <Badge tone={reg.tone}>{reg.label}</Badge> : null}</p>
          <p className="text-body-sm text-text-secondary">
            {t.regStatus === "pending"
              ? `${host} approves registrations. We'll tell you when they decide.`
              : t.regStatus === "held"
                ? `Your seat is held${t.holdExpiresLabel ? ` until ${t.holdExpiresLabel}` : ""}. Pay ${host} and upload the receipt below.`
                : ""}
          </p>
        </section>
      )}
      {/* PRD 5.34: push is offered after a meaningful action; registering for an event is one. */}
      <PushOffer reason="We'll remind you a day and an hour before, and tell you if the time or place changes." />
      {t.regStatus === "waitlisted" && t.waitlistPosition ? (
        <p className="neu-mono text-text-secondary" data-testid="waitlist-position">
          Number {t.waitlistPosition} on the waitlist. If a seat frees up, you&apos;re moved in automatically and told.
        </p>
      ) : null}
      {t.checkedIn.length ? (
        <p className="text-body-sm text-text-secondary">
          Checked in: {t.checkedIn.map((c) => `${t.sessions.find((s) => s.id === c.sessionId)?.title ?? "session"} at ${c.atLabel}`).join(" · ")}
        </p>
      ) : null}

      {payment ? (
        <section aria-labelledby="pay-h" className="neu-card flex flex-col gap-4 p-5" data-testid="payment-panel">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="pay-h" className="text-h3">
              Payment
            </h2>
            <Badge tone={PAYMENT_STATUS[payment.status]?.tone ?? "neutral"}>
              {PAYMENT_STATUS[payment.status]?.label ?? payment.status}
              {payment.status === "under_review" && payment.uploadedLabel ? ` · ${payment.uploadedLabel}` : ""}
            </Badge>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-body-sm">
            <dt className="text-text-secondary">Amount</dt>
            <dd className="neu-mono font-semibold">{pkr(payment.amountPkr)}</dd>
            <dt className="text-text-secondary">Reference</dt>
            <dd>
              <span className="neu-mono font-semibold" data-testid="reference-code">
                {payment.referenceCode}
              </span>{" "}
              <span className="text-text-secondary">(put it in the transfer note)</span>
            </dd>
          </dl>
          <p className="text-body-sm font-semibold">You pay {host} directly. Skilient doesn&apos;t handle the money.</p>
          {payment.methods.length ? (
            <ul className="grid gap-2 sm:grid-cols-2" data-testid="pay-methods">
              {payment.methods.map((m, i) => (
                <li key={i} className="neu-tile flex flex-col gap-0.5 p-3 text-body-sm">
                  <span className="text-caption font-semibold text-text-secondary">
                    {paymentKindLabel(m.kind)}
                    {m.bankName ? ` · ${m.bankName}` : ""}
                  </span>
                  <span className="font-semibold">{m.accountTitle}</span>
                  <span className="neu-mono">{m.accountNumber}</span>
                  <span className="text-caption text-text-secondary">Updated {m.updatedLabel}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {payment.rejectReason && payment.status === "rejected" ? (
            <p className="text-body-sm text-text-error">
              The receipt wasn&apos;t accepted: {payment.rejectReason}. Upload a new one{payment.holdExpiresLabel ? ` by ${payment.holdExpiresLabel}` : " within 24 hours"}.
            </p>
          ) : null}
          {payment.status === "awaiting" || payment.status === "rejected" ? <ReceiptForm eventId={t.id} registrationId={payment.registrationId} /> : null}
          {payment.status === "under_review" ? (
            <p className="text-body-sm text-text-secondary">
              An officer checks the receipt; your seat stays held until they decide.
              {payment.issueRaised ? " You told the society. If nobody answers within 72 hours, it goes to Skilient's moderators." : ""}
            </p>
          ) : null}
          {payment.canRaise && !payment.issueRaised ? (
            <ActionButton
              action={raisePaymentIssue}
              args={{ registrationId: payment.registrationId }}
              variant="secondary"
              done="The society's officers were told. If nobody answers within 72 hours, it goes to Skilient."
            >
              I paid but nobody has confirmed it
            </ActionButton>
          ) : null}
          {payment.refundStatus ? (
            <div className="flex flex-col gap-2 border-t border-border-muted pt-3" data-testid="refund-status">
              <p className="text-body-sm">
                <Badge tone={payment.refundStatus === "received" ? "success" : payment.refundStatus === "disputed" ? "error" : "info"}>{REFUND_STATUS[payment.refundStatus]}</Badge>
                {payment.refundNote ? <span className="text-text-secondary"> · {payment.refundNote}</span> : null}
              </p>
              {payment.refundStatus === "sent" ? (
                <span className="flex flex-wrap gap-2">
                  <ActionButton action={confirmRefund} args={{ paymentId: payment.paymentId, received: true }} variant="primary">
                    I received it
                  </ActionButton>
                  <ActionButton action={confirmRefund} args={{ paymentId: payment.paymentId, received: false }} variant="ghost" confirm="Tell the society the refund didn't arrive? If they don't sort it out within 72 hours, it goes to Skilient.">
                    Not received
                  </ActionButton>
                </span>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {t.canCancel ? (
        <section className="flex flex-col gap-2">
          <p className="text-body-sm text-text-secondary">
            {t.refundPolicy === "until" && t.ticketType?.pricePkr
              ? `Refunds until ${t.refundDays} days before the event, paid back by ${host}.`
              : t.ticketType?.pricePkr
                ? "This event doesn't refund paid tickets."
                : "Cancelling frees your seat for the next person on the waitlist."}
          </p>
          <ActionButton action={cancelRegistration} args={{ eventId: t.id }} variant="ghost" confirm="Cancel your registration?" testId="cancel-registration">
            Cancel registration
          </ActionButton>
        </section>
      ) : null}
    </main>
  );
}
