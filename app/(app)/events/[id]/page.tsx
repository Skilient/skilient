import { CalendarBlank, GearSix, MapPin, QrCode, Ticket as TicketIcon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FeedbackForm } from "@/components/events/feedback-form";
import { RegisterSheet } from "@/components/events/register-sheet";
import { ReportButton } from "@/components/reports/report-button";
import { EventCard as UniEventCard } from "@/components/uni/event-card";
import { Avatar, Badge, buttonClass } from "@/components/ui";
import { getEventPage, type EventPageData } from "@/lib/data/events";
import { isRefusal } from "@/lib/data/rpc-json";
import { getEvent, type EventCard as UniCard } from "@/lib/data/uni";
import { EVENT_STATUS, eventTypeLabel, pkr, RECORD_KINDS, REGISTRATION_STATUS } from "@/lib/societies/constants";

export const metadata: Metadata = { title: "Event" };

/** A society event, or a university event from the phase 9 portal, or null (404). */
async function loadEvent(id: string): Promise<{ kind: "society"; e: EventPageData } | { kind: "uni"; uni: UniCard } | null> {
  try {
    return { kind: "society", e: await getEventPage(id) };
  } catch (err) {
    if (!isRefusal(err, "P0002", "42501")) throw err;
  }
  try {
    return { kind: "uni", uni: await getEvent(id) };
  } catch (err) {
    if (isRefusal(err, "P0002", "42501")) return null;
    throw err;
  }
}

function refundLine(e: EventPageData): string | null {
  if (!e.paid) return null;
  return e.refundPolicy === "until" ? `Refunds until ${e.refundDays} ${e.refundDays === 1 ? "day" : "days"} before the event, paid back by the society.` : "No refunds.";
}

/**
 * An event (PRD 5.31, screen spec 3.14): host, sessions, place, tickets and seats left, who can come,
 * what it earns on the Record, and Register. Officers get Manage and Check-in. University events from
 * the phase 9 portal keep their own card.
 */
export default async function EventPage({ params }: PageProps<"/events/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const loaded = await loadEvent(id);
  if (!loaded) notFound();
  if (loaded.kind === "uni") {
    return (
      <main className="mx-auto flex w-full max-w-prose flex-col gap-6 px-[var(--page-gutter)] py-6">
        <UniEventCard e={loaded.uni} detail />
      </main>
    );
  }
  const e = loaded.e;
  const reg = e.registration && !["cancelled", "declined"].includes(e.registration.status) ? e.registration : null;
  const regStatus = reg ? REGISTRATION_STATUS[reg.status] : null;
  const status = e.status !== "published" ? EVENT_STATUS[e.status] : null;

  return (
    <main className="mx-auto flex w-full max-w-page flex-col gap-6 px-[var(--page-gutter)] py-6" data-testid="event-page">
      <article className="neu-card flex flex-col overflow-hidden">
        {e.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- event cover from the public bucket
          <img src={e.coverUrl} alt="" className="h-44 w-full object-cover sm:h-64" />
        ) : null}
        <div className="flex flex-col gap-4 p-5">
          {e.society ? (
            <Link href={`/societies/${e.society.slug}` as Route} className="flex items-center gap-2 text-body-sm font-semibold underline-offset-4 hover:underline">
              <Avatar name={e.society.name} src={e.society.logoUrl} size="xs" />
              {e.society.name}
              {e.cohosts.length ? <span className="font-normal text-text-secondary">with {e.cohosts.map((c) => c.name).join(", ")}</span> : null}
            </Link>
          ) : null}
          <div className="flex flex-col gap-1">
            <p className="text-caption font-semibold text-text-secondary">
              {eventTypeLabel(e.type)} · {e.university}
            </p>
            <h1 className="font-display text-h1">{e.title}</h1>
            <p className="flex flex-wrap gap-2">
              {status ? <Badge tone={status.tone}>{status.label}</Badge> : null}
              {regStatus ? <Badge tone={regStatus.tone}>{regStatus.label}</Badge> : null}
            </p>
          </div>
          {e.status === "cancelled" ? (
            <p className="text-body text-text-error" data-testid="cancelled-note">
              Cancelled{e.cancelReason ? `: ${e.cancelReason}` : "."}
              {e.paid ? ` ${e.society?.name ?? "The society"} will refund paid tickets.` : ""}
            </p>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <section aria-labelledby="when-h" className="flex flex-col gap-2">
              <h2 id="when-h" className="flex items-center gap-1.5 text-h4">
                <CalendarBlank aria-hidden weight="bold" className="size-5" />
                When
              </h2>
              <ul className="neu-mono flex flex-col gap-1">
                {e.sessions.map((s) => (
                  <li key={s.id}>
                    {s.title ? `${s.title}: ` : ""}
                    {s.label}
                  </li>
                ))}
              </ul>
            </section>
            <section aria-labelledby="where-h" className="flex flex-col gap-2">
              <h2 id="where-h" className="flex items-center gap-1.5 text-h4">
                <MapPin aria-hidden weight="bold" className="size-5" />
                Where
              </h2>
              <p className="text-body">{e.location ?? "Online"}</p>
              {e.link ? (
                <a href={e.link} target="_blank" rel="noopener noreferrer nofollow" className="text-body-sm break-all underline underline-offset-4">
                  {e.link}
                </a>
              ) : null}
            </section>
          </div>
          {e.description ? <p className="text-body whitespace-pre-line">{e.description}</p> : null}
          <section aria-labelledby="tickets-h" className="flex flex-col gap-2">
            <h2 id="tickets-h" className="flex items-center gap-1.5 text-h4">
              <TicketIcon aria-hidden weight="bold" className="size-5" />
              Tickets
            </h2>
            <ul className="flex flex-wrap gap-2">
              {e.ticketTypes.map((t) => (
                <li key={t.id} className="neu-tile px-3 py-2 text-body-sm">
                  {t.name} · {t.pricePkr ? pkr(t.pricePkr) : "Free"} · <span className="neu-mono">{t.left > 0 ? `${t.left} left` : "full, waitlist open"}</span>
                </li>
              ))}
            </ul>
            <p className="text-body-sm text-text-secondary">
              {e.eligibility.scope === "all"
                ? "Open to students at any university on Skilient."
                : e.eligibility.scope === "groups"
                  ? `For ${[...(e.eligibility.departments ?? []), ...(e.eligibility.batches ?? []).map(String)].join(", ")} at ${e.university}.`
                  : `For students at ${e.university}.`}
              {e.approvalMode === "manual" ? " An officer approves each registration." : ""}
              {e.team ? ` Register as a team of ${e.team.min}–${e.team.max}.` : ""}
              {e.registrationClosesLabel ? ` Registration closes ${e.registrationClosesLabel}.` : ""}
            </p>
            {e.paid ? <p className="text-body-sm text-text-secondary">{refundLine(e)} Paid tickets are paid to the society directly; Skilient doesn&apos;t handle the money.</p> : null}
            <p className="text-body-sm text-text-secondary">
              On your Record after the event: {e.recordKinds.map((k) => RECORD_KINDS.find((x) => x.value === k)?.label ?? k).join(", ")}
              {e.volunteerHours ? ", volunteer hours" : ""}. Attendance never adds rank.
            </p>
          </section>

          <div className="flex flex-wrap items-start gap-3 border-t border-border-muted pt-4">
            {reg ? (
              <>
                <Link href={`/events/${e.id}/ticket` as Route} className={buttonClass("primary", "lg")} data-testid="open-ticket">
                  <QrCode aria-hidden weight="bold" className="size-5" />
                  {reg.status === "held" ? "Pay and upload the receipt" : "Your ticket"}
                </Link>
                {reg.status === "waitlisted" && reg.waitlistPosition ? <p className="neu-mono self-center text-text-secondary">Number {reg.waitlistPosition} on the waitlist</p> : null}
                {reg.team ? (
                  <p className="self-center text-body-sm">
                    Team {reg.team.name} · code <span className="neu-mono font-semibold">{reg.team.code}</span> · {reg.team.members} {reg.team.members === 1 ? "member" : "members"}
                  </p>
                ) : null}
              </>
            ) : e.blockReason ? (
              <p className="text-body text-text-secondary" data-testid="block-reason">
                {e.blockReason}
              </p>
            ) : (
              <RegisterSheet
                eventId={e.id}
                society={e.society?.name ?? "The society"}
                ticketTypes={e.ticketTypes.map((t) => ({ id: t.id, name: t.name, pricePkr: t.pricePkr, left: t.left }))}
                questions={e.questions}
                team={e.team}
                approvalMode={e.approvalMode}
                refundLine={refundLine(e)}
              />
            )}
            {e.officer ? (
              <Link href={`/events/${e.id}/manage` as Route} className={buttonClass("secondary", "lg")} data-testid="manage-event">
                <GearSix aria-hidden weight="bold" className="size-5" />
                Manage
              </Link>
            ) : null}
            {e.staff ? (
              <Link href={`/events/${e.id}/check-in` as Route} className={buttonClass("secondary", "lg")}>
                Check-in
              </Link>
            ) : null}
            {!e.officer ? <ReportButton targetType="event" targetId={e.id} compact className="ml-auto" /> : null}
          </div>
        </div>
      </article>
      {e.feedbackOpen ? <FeedbackForm eventId={e.id} /> : null}
    </main>
  );
}
