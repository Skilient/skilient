import { ArrowLeft, Copy, DownloadSimple, PencilSimple, QrCode } from "@phosphor-icons/react/dist/ssr";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CloseoutPanel } from "@/components/events/closeout-panel";
import { PaymentsReview } from "@/components/events/payments-review";
import { ActionButton } from "@/components/societies/action-button";
import { DataTable } from "@/components/uni/page-parts";
import { RpcForm } from "@/components/uni/rpc-form";
import { Badge, buttonClass, StatTile } from "@/components/ui";
import { addEventStaff, cancelSocietyEvent, decideRegistration, messageRegistrants, publishEvent, removeEventStaff } from "@/lib/actions/events";
import { getCloseout, getEventManage, getPaymentsReview, type ManageData } from "@/lib/data/events";
import { isRefusal } from "@/lib/data/rpc-json";
import { cn } from "@/lib/cn";
import { EVENT_STATUS, REGISTRATION_STATUS } from "@/lib/societies/constants";

export const metadata: Metadata = { title: "Manage event" };
export const dynamic = "force-dynamic";

const TABS = [
  { key: "registrations", label: "Registrations" },
  { key: "waitlist", label: "Waitlist" },
  { key: "payments", label: "Payments" },
  { key: "staff", label: "Staff" },
  { key: "messages", label: "Messages" },
  { key: "closeout", label: "Close-out" },
  { key: "feedback", label: "Feedback" },
] as const;
type Tab = (typeof TABS)[number]["key"];

function answerText(a: unknown): string {
  if (typeof a !== "string") return "";
  if (a.startsWith("[")) {
    try {
      return (JSON.parse(a) as string[]).join(", ");
    } catch {
      return a;
    }
  }
  return a;
}

/**
 * Event manage (PRD 5.31, screen spec 3.14): the host society's officers. Stat tiles, registrations
 * (approve, decline, CSV), the waitlist, payments, staff who can check people in, messages to everyone
 * registered, close-out and feedback. Never recorded by analytics (it shows receipts).
 */
export default async function ManageEventPage({ params, searchParams }: PageProps<"/events/[id]/manage">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const sp = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as Tab) : "registrations";
  let m: ManageData;
  try {
    m = await getEventManage(id);
  } catch (err) {
    if (isRefusal(err, "P0002", "42501")) notFound();
    throw err;
  }
  const [payments, closeout] = await Promise.all([
    tab === "payments" ? getPaymentsReview(id) : Promise.resolve([]),
    tab === "closeout" ? getCloseout(id) : Promise.resolve(null),
  ]);
  const status = EVENT_STATUS[m.status];
  const slug = m.society?.slug ?? "";
  const active = m.status !== "cancelled" && m.status !== "ended";
  const regs = tab === "waitlist" ? m.registrations.filter((r) => r.status === "waitlisted") : m.registrations.filter((r) => r.status !== "waitlisted");

  return (
    <main className="mx-auto flex w-full max-w-page flex-col gap-6 px-[var(--page-gutter)] py-6" data-testid="event-manage">
      <Link href={`/events/${m.id}` as Route} className="inline-flex items-center gap-1 text-body-sm font-semibold underline-offset-4 hover:underline">
        <ArrowLeft aria-hidden weight="bold" className="size-4" />
        Event page
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-caption font-semibold text-text-secondary">{m.society?.name}</p>
          <h1 className="font-display text-h1">{m.title}</h1>
          <p className="flex flex-wrap items-center gap-2 text-body-sm text-text-secondary">
            {status ? <Badge tone={status.tone}>{status.label}</Badge> : null}
            <span className="neu-mono">{m.startsLabel}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {m.status === "draft" ? (
            <ActionButton action={publishEvent} args={{ eventId: m.id }} variant="primary" size="md" testId="publish-draft" done="Published.">
              Publish
            </ActionButton>
          ) : null}
          {active ? (
            <Link href={`/societies/${slug}/events/new?edit=${m.id}` as Route} className={buttonClass("secondary", "md")}>
              <PencilSimple aria-hidden weight="bold" className="size-4" />
              Edit
            </Link>
          ) : null}
          <Link href={`/societies/${slug}/events/new?from=${m.id}` as Route} className={buttonClass("secondary", "md")}>
            <Copy aria-hidden weight="bold" className="size-4" />
            Duplicate
          </Link>
          {m.status !== "draft" && m.status !== "cancelled" ? (
            <Link href={`/events/${m.id}/check-in` as Route} className={buttonClass("accent", "md")} data-testid="open-check-in">
              <QrCode aria-hidden weight="bold" className="size-4" />
              Check-in
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5" data-testid="event-stats">
        <StatTile label="Registered" value={m.stats.registered} hint={`of ${m.stats.capacity} seats`} />
        <StatTile label="Waiting" value={m.stats.pending} hint="approval or payment" />
        <StatTile label="Waitlist" value={m.stats.waitlist} />
        <StatTile label="Checked in" value={m.stats.checkedIn} />
        <StatTile label="Feedback" value={m.feedback.count} hint={m.feedback.average ? `${m.feedback.average} / 5` : undefined} />
      </div>

      <nav aria-label="Manage event" className="overflow-x-auto">
        <div className="neu-track">
          {TABS.filter((t) => t.key !== "payments" || m.paid).map((t) => (
            <Link key={t.key} href={`/events/${m.id}/manage${t.key === "registrations" ? "" : `?tab=${t.key}`}` as Route} aria-current={tab === t.key ? "page" : undefined}>
              {t.label}
            </Link>
          ))}
        </div>
      </nav>

      {tab === "registrations" || tab === "waitlist" ? (
        <section className="flex flex-col gap-3">
          {tab === "registrations" ? (
            <a href={`/api/events/${m.id}/export`} className={cn(buttonClass("secondary", "sm"), "self-start")} data-testid="export-csv" download>
              <DownloadSimple aria-hidden weight="bold" className="size-4" />
              Export CSV
            </a>
          ) : null}
          <DataTable
            testId="registrations"
            empty={tab === "waitlist" ? "Nobody is waiting." : "No registrations yet."}
            head={["Name", "Ticket", "Status", ...(m.team ? ["Team"] : []), ...m.questions, ""]}
            rows={regs.map((r) => [
              <span key="n" className="flex flex-col">
                <span className="font-semibold">{r.name}</span>
                <span className="text-caption text-text-secondary">
                  {[r.department, r.batch].filter(Boolean).join(" · ")}
                </span>
              </span>,
              r.ticket ?? "",
              <Badge key="s" tone={REGISTRATION_STATUS[r.status]?.tone ?? "neutral"}>
                {r.status === "waitlisted" && r.waitlistPosition ? `Waitlist #${r.waitlistPosition}` : (REGISTRATION_STATUS[r.status]?.label ?? r.status)}
              </Badge>,
              ...(m.team ? [r.team ?? ""] : []),
              ...m.questions.map((_, i) => answerText(r.answers[i])),
              r.status === "pending" ? (
                <span key="a" className="flex gap-2">
                  <ActionButton action={decideRegistration} args={{ eventId: m.id, userId: r.userId, accept: true }} variant="primary" testId="approve-registration">
                    Approve
                  </ActionButton>
                  <ActionButton action={decideRegistration} args={{ eventId: m.id, userId: r.userId, accept: false }} variant="ghost">
                    Decline
                  </ActionButton>
                </span>
              ) : null,
            ])}
          />
        </section>
      ) : null}

      {tab === "payments" ? <PaymentsReview rows={payments} /> : null}

      {tab === "staff" ? (
        <section className="flex flex-col gap-4">
          <p className="text-body-sm text-text-secondary">Staff can check people in at the door. Officers already can.</p>
          <DataTable
            testId="event-staff"
            empty="No extra staff."
            head={["Name", ""]}
            rows={m.staff.map((s) => [
              s.name,
              <ActionButton key="r" action={removeEventStaff} args={{ eventId: m.id, userId: s.userId }} variant="ghost">
                Remove
              </ActionButton>,
            ])}
          />
          <div className="neu-card max-w-md p-5">
            <RpcForm action={addEventStaff} extra={{ eventId: m.id }} submitLabel="Add staff" after="reset" fields={[{ name: "username", label: "Username", type: "text", placeholder: "@username", required: true }]} />
          </div>
        </section>
      ) : null}

      {tab === "messages" ? (
        <section className="flex flex-col gap-4">
          <div className="neu-card max-w-xl p-5">
            <RpcForm
              action={messageRegistrants}
              extra={{ eventId: m.id }}
              submitLabel="Send to everyone registered"
              after="reset"
              testId="message-form"
              fields={[{ name: "body", label: "Message", type: "textarea", rows: 4, help: "Goes to everyone confirmed, waiting or on the waitlist, as a notification." }]}
            />
          </div>
          <ul className="flex flex-col gap-2">
            {m.messages.map((x, i) => (
              <li key={i} className="neu-tile p-3 text-body-sm">
                <p className="whitespace-pre-line">{x.body}</p>
                <p className="neu-mono text-text-secondary">{x.atLabel}</p>
              </li>
            ))}
          </ul>
          {active ? (
            <details className="neu-card max-w-xl p-5">
              <summary className="cursor-pointer font-semibold text-text-error">Cancel the event</summary>
              <div className="mt-3">
                <RpcForm
                  action={cancelSocietyEvent}
                  extra={{ eventId: m.id }}
                  submitLabel="Cancel the event"
                  testId="cancel-event"
                  fields={[{ name: "reason", label: "Why (everyone registered reads this)", type: "textarea", rows: 3 }]}
                />
              </div>
            </details>
          ) : null}
        </section>
      ) : null}

      {tab === "closeout" && closeout ? <CloseoutPanel c={closeout} eventId={m.id} /> : null}

      {tab === "feedback" ? (
        <section className="flex flex-col gap-2" data-testid="feedback-summary">
          {m.feedback.suppressed ? (
            <p className="text-body-sm text-text-secondary">
              {m.feedback.count} {m.feedback.count === 1 ? "answer" : "answers"} so far. Totals show from 5 answers so nobody can be picked out.
            </p>
          ) : (
            <>
              <p className="text-body">
                Average <span className="neu-mono font-semibold">{m.feedback.average}</span> / 5 from {m.feedback.count} answers.
              </p>
              <ul className="flex flex-col gap-1 text-body-sm">
                {Object.entries(m.feedback.ratings ?? {})
                  .sort(([a], [b]) => Number(b) - Number(a))
                  .map(([r, n]) => (
                    <li key={r} className="neu-mono">
                      {r} / 5: {n}
                    </li>
                  ))}
              </ul>
            </>
          )}
        </section>
      ) : null}
    </main>
  );
}
