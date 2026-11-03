import type { Metadata, Route } from "next";
import Link from "next/link";
import { EventCard } from "@/components/events/event-card";
import { PageTitle } from "@/components/uni/page-parts";
import { buttonClass, EmptyState } from "@/components/ui";
import { getMyTickets } from "@/lib/data/events";

export const metadata: Metadata = { title: "Tickets" };

/** /me/tickets (PRD 5.31): upcoming tickets first (with waitlist places and holds), then past ones. */
export default async function MyTicketsPage() {
  const t = await getMyTickets();
  return (
    <main className="mx-auto flex w-full max-w-page flex-col gap-6 px-[var(--page-gutter)] py-6" data-testid="my-tickets">
      <PageTitle title="Tickets">Your society event tickets. Open one to show its code at the door.</PageTitle>
      <section aria-labelledby="up-h" className="flex flex-col gap-3">
        <h2 id="up-h" className="text-h3">
          Upcoming
        </h2>
        {t.upcoming.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {t.upcoming.map((e) => (
              <EventCard key={e.id} e={{ ...e, myStatus: e.registrationStatus }} href={`/events/${e.id}/ticket`} />
            ))}
          </div>
        ) : (
          <EmptyState
            object="ticket"
            title="No upcoming tickets"
            description="Register for an event and its ticket lands here."
            action={
              <Link href={"/events" as Route} className={buttonClass("secondary", "md")}>
                Find events
              </Link>
            }
          />
        )}
      </section>
      {t.past.length ? (
        <section aria-labelledby="past-h" className="flex flex-col gap-3">
          <h2 id="past-h" className="text-h3">
            Past and cancelled
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {t.past.map((e) => (
              <EventCard key={e.id} e={{ ...e, myStatus: e.registrationStatus }} href={`/events/${e.id}`} />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
