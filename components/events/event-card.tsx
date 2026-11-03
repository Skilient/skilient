import { CalendarBlank, MapPin, Ticket as TicketIcon, UsersThree } from "@phosphor-icons/react/dist/ssr";
import type { Route } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui";
import type { EventCardData } from "@/lib/data/events";
import { EVENT_STATUS, eventTypeLabel, REGISTRATION_STATUS } from "@/lib/societies/constants";

/** One society event in a list (screen spec 3.14 "Events"): the host, when, where, seats and your status. */
export function EventCard({ e, href }: { e: EventCardData; href?: string }) {
  const reg = e.myStatus ? REGISTRATION_STATUS[e.myStatus] : null;
  const status = e.status !== "published" && e.status !== "live" ? EVENT_STATUS[e.status] : null;
  return (
    <article className="neu-card flex flex-col gap-2 p-4" data-testid="event-card">
      <p className="text-caption font-semibold text-text-secondary">
        {eventTypeLabel(e.type)}
        {e.society ? ` · ${e.society.name}` : ""}
        {!e.ownUniversity ? ` · ${e.university}` : ""}
      </p>
      <h3 className="text-h4">
        <Link href={(href ?? `/events/${e.id}`) as Route} className="underline-offset-4 hover:underline">
          {e.title}
        </Link>
      </h3>
      <p className="neu-mono flex items-center gap-1.5 text-text-secondary">
        <CalendarBlank aria-hidden weight="bold" className="size-4" />
        {e.startsLabel}
      </p>
      {e.location ? (
        <p className="flex items-center gap-1.5 text-body-sm text-text-secondary">
          <MapPin aria-hidden weight="bold" className="size-4" />
          {e.location}
        </p>
      ) : null}
      <p className="flex flex-wrap items-center gap-2 text-caption text-text-secondary">
        {status ? <Badge tone={status.tone}>{status.label}</Badge> : null}
        {reg ? <Badge tone={reg.tone}>{reg.label}</Badge> : null}
        {e.status !== "cancelled" && e.status !== "ended" ? (
          <span className="neu-mono inline-flex items-center gap-1">
            <TicketIcon aria-hidden weight="bold" className="size-3.5" />
            {e.seatsLeft > 0 ? `${e.seatsLeft} ${e.seatsLeft === 1 ? "seat" : "seats"} left` : "Full: waitlist open"}
            {e.paid ? " · Paid" : " · Free"}
          </span>
        ) : null}
        {e.friendsGoing > 0 ? (
          <span className="inline-flex items-center gap-1">
            <UsersThree aria-hidden weight="bold" className="size-3.5" />
            {e.friendsGoing} {e.friendsGoing === 1 ? "friend" : "friends"} going
          </span>
        ) : null}
      </p>
    </article>
  );
}
