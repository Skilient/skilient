import type { Metadata, Route } from "next";
import Link from "next/link";
import { EventCard } from "@/components/events/event-card";
import { EventCard as UniEventCard } from "@/components/uni/event-card";
import { PageTitle } from "@/components/uni/page-parts";
import { buttonClass, EmptyState } from "@/components/ui";
import { getSocietyEvents } from "@/lib/data/events";
import { getEvents } from "@/lib/data/uni";
import { cn } from "@/lib/cn";
import { EVENT_TYPES } from "@/lib/societies/constants";

export const metadata: Metadata = { title: "Events" };

const TABS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "mine", label: "Registered" },
  { key: "past", label: "Past" },
] as const;

/**
 * /events (PRD 5.31, screen spec 3.14): society events at your university first, then ones open to
 * every university; filter by type. University-run events (the phase 9 portal) follow when there are any.
 */
export default async function EventsPage({ searchParams }: PageProps<"/events">) {
  const sp = await searchParams;
  const when = TABS.some((t) => t.key === sp.when) ? (sp.when as (typeof TABS)[number]["key"]) : "upcoming";
  const type = typeof sp.type === "string" && EVENT_TYPES.some((t) => t.value === sp.type) ? sp.type : "";
  const [events, uniEvents] = await Promise.all([getSocietyEvents(when, type || null), getEvents(when).catch(() => [])]);
  const href = (w: string, t: string) => {
    const q = new URLSearchParams();
    if (w !== "upcoming") q.set("when", w);
    if (t) q.set("type", t);
    const s = q.toString();
    return (s ? `/events?${s}` : "/events") as Route;
  };
  return (
    <main className="mx-auto flex w-full max-w-page flex-col gap-6 px-[var(--page-gutter)] py-6" data-testid="events-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle title="Events">Talks, workshops, hackathons and socials run by societies. Register, show your ticket at the door, and it goes on your Record.</PageTitle>
        <Link href={"/me/tickets" as Route} className={buttonClass("secondary", "md")}>
          Your tickets
        </Link>
      </div>
      <nav aria-label="Events">
        <div className="neu-track">
          {TABS.map((t) => (
            <Link key={t.key} href={href(t.key, type)} aria-current={t.key === when ? "page" : undefined}>
              {t.label}
            </Link>
          ))}
        </div>
      </nav>
      <nav aria-label="Event type" className="flex flex-wrap gap-2">
        {[{ value: "", label: "All" }, ...EVENT_TYPES].map((t) => (
          <Link
            key={t.value || "all"}
            href={href(when, t.value)}
            aria-current={type === t.value ? "true" : undefined}
            className={cn("inline-flex h-9 items-center rounded-full px-3.5 text-body-sm font-semibold", type === t.value ? "neu-chip text-text-primary" : "neu-well-s text-text-secondary")}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {events.length === 0 ? (
        <EmptyState
          object="ticket"
          title={when === "mine" ? "You haven't registered for anything" : when === "past" ? "No past events" : "No upcoming events"}
          description="Follow societies to hear when they post one."
          action={
            <Link href={"/societies" as Route} className={buttonClass("secondary", "md")}>
              Browse societies
            </Link>
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {events.map((e) => (
            <EventCard key={e.id} e={e} />
          ))}
        </div>
      )}
      {uniEvents.length ? (
        <section aria-labelledby="uni-events-h" className="flex flex-col gap-3">
          <h2 id="uni-events-h" className="text-h3">
            University events
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {uniEvents.map((e) => (
              <UniEventCard key={e.id} e={e} />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
