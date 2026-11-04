import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/societies/action-button";
import { DataTable, PageTitle, Section } from "@/components/uni/page-parts";
import { RpcForm } from "@/components/uni/rpc-form";
import { Badge } from "@/components/ui";
import { confirmPaymentMethod, proposePaymentMethod } from "@/lib/actions/event-payments";
import { getPaymentDetails, officerSociety } from "@/lib/data/societies";
import { PAYMENT_KINDS, paymentKindLabel } from "@/lib/societies/constants";

export const metadata: Metadata = { title: "Payment details" };

const ACTION_WORDS: Record<string, string> = { add: "Add", replace: "Replace", remove: "Remove" };

/**
 * Payment details (PRD 5.31): up to 3 accounts students pay directly. Any officer proposes a change;
 * it takes effect only after a second officer confirms it, every officer is told, and it's audited.
 * Skilient never holds the money.
 */
export default async function PaymentDetailsPage({ params }: PageProps<"/societies/[slug]/manage/payments">) {
  const { slug } = await params;
  const page = await officerSociety(slug);
  if (!page || page.status !== "verified") notFound();
  const d = await getPaymentDetails(page.id);
  const kinds = PAYMENT_KINDS.map((k) => ({ value: k.value, label: k.label }));

  return (
    <main className="mx-auto flex w-full max-w-page flex-col gap-8 px-[var(--page-gutter)] py-6" data-testid="payment-details">
      <Link href={`/societies/${slug}/manage` as Route} className="inline-flex items-center gap-1 text-body-sm font-semibold underline-offset-4 hover:underline">
        <ArrowLeft aria-hidden weight="bold" className="size-4" />
        Manage {d.society.name}
      </Link>
      <PageTitle title="Payment details">
        Students pay {d.society.name} directly for paid tickets and upload the receipt for an officer to check. Skilient never handles the money. A change takes effect only when a second
        officer confirms it.
      </PageTitle>
      {d.paidPaused ? <p className="text-body-sm text-text-error">Skilient has paused paid tickets for this society.</p> : null}

      <Section title="Active accounts" id="active">
        {d.active.length ? (
          <ul className="grid gap-3 md:grid-cols-2" data-testid="active-methods">
            {d.active.map((m) => (
              <li key={m.id} className="neu-card flex flex-col gap-2 p-4">
                <p className="text-caption font-semibold text-text-secondary">
                  {paymentKindLabel(m.kind)}
                  {m.bankName ? ` · ${m.bankName}` : ""}
                </p>
                <p className="text-body font-semibold">{m.accountTitle}</p>
                <p className="neu-mono">{m.accountNumber}</p>
                <p className="text-caption text-text-secondary">Confirmed {m.effectiveLabel}</p>
                <details className="text-body-sm">
                  <summary className="cursor-pointer font-semibold">Replace or remove</summary>
                  <div className="mt-3 flex flex-col gap-4">
                    <RpcForm
                      action={proposePaymentMethod}
                      extra={{ societyId: d.society.id, action: "replace", replacesId: m.id }}
                      submitLabel="Propose replacement"
                      fields={[
                        { name: "kind", label: "Type", type: "select", options: kinds, defaultValue: m.kind },
                        { name: "bankName", label: "Bank (for bank accounts)", type: "text", defaultValue: m.bankName ?? "" },
                        { name: "accountTitle", label: "Account title", type: "text", defaultValue: m.accountTitle },
                        { name: "accountNumber", label: "Account number or IBAN", type: "text" },
                      ]}
                    />
                    <ActionButton action={proposePaymentMethod} args={{ societyId: d.society.id, action: "remove", replacesId: m.id }} variant="ghost" confirm="Propose removing this account?">
                      Propose removing it
                    </ActionButton>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body-sm text-text-secondary">No confirmed account yet. Paid ticket types can&apos;t be published until one is confirmed.</p>
        )}
      </Section>

      <Section title="Waiting for a second officer" id="proposals">
        {d.proposals.length ? (
          <ul className="flex flex-col gap-3" data-testid="proposals">
            {d.proposals.map((p) => (
              <li key={p.id} className="neu-card flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex flex-col gap-1">
                  <p className="text-body-sm">
                    <Badge tone="warning">{ACTION_WORDS[p.action] ?? p.action}</Badge>{" "}
                    {p.action === "remove" ? (
                      "Remove an account"
                    ) : (
                      <>
                        {paymentKindLabel(p.kind)}
                        {p.bankName ? ` · ${p.bankName}` : ""} · <span className="font-semibold">{p.accountTitle}</span> · <span className="neu-mono">{p.accountNumber}</span>
                      </>
                    )}
                  </p>
                  <p className="text-caption text-text-secondary">
                    Proposed by {p.proposedBy}, {p.proposedLabel}
                  </p>
                </div>
                {p.mine ? (
                  <span className="text-caption text-text-secondary">Another officer confirms it.</span>
                ) : (
                  <span className="flex gap-2">
                    <ActionButton action={confirmPaymentMethod} args={{ methodId: p.id, accept: true }} variant="primary" testId="confirm-method">
                      Confirm
                    </ActionButton>
                    <ActionButton action={confirmPaymentMethod} args={{ methodId: p.id, accept: false }} variant="ghost">
                      Reject
                    </ActionButton>
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body-sm text-text-secondary">Nothing waiting.</p>
        )}
      </Section>

      {d.active.length + d.proposals.filter((p) => p.action !== "remove").length < 3 ? (
        <Section title="Add an account" id="add">
          <div className="neu-card max-w-xl p-5">
            <RpcForm
              action={proposePaymentMethod}
              extra={{ societyId: d.society.id, action: "add" }}
              submitLabel="Propose this account"
              after="reset"
              testId="add-method"
              fields={[
                { name: "kind", label: "Type", type: "select", options: kinds, defaultValue: "bank" },
                { name: "bankName", label: "Bank (for bank accounts)", type: "text", placeholder: "Meezan Bank" },
                { name: "accountTitle", label: "Account title", type: "text", help: "Exactly as the bank shows it." },
                { name: "accountNumber", label: "Account number or IBAN", type: "text" },
              ]}
            />
          </div>
        </Section>
      ) : null}

      <Section title="History" id="history">
        <DataTable
          head={["Change", "By", "When"]}
          empty="No changes yet."
          rows={d.history.map((h) => [
            h.action.replace("payment_method.", "").replace("_", " "),
            h.actor,
            <span key="w" className="neu-mono">
              {h.atLabel}
            </span>,
          ])}
        />
      </Section>
    </main>
  );
}
