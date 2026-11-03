import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckInConsole } from "@/components/events/check-in-console";
import { CheckinScreen } from "@/components/uni/checkin-screen";
import { PageTitle } from "@/components/uni/page-parts";
import { getEventPage, getHeadcount, type EventPageData } from "@/lib/data/events";
import { isRefusal } from "@/lib/data/rpc-json";
import { getEvent, type EventCard as UniCard } from "@/lib/data/uni";

export const metadata: Metadata = { title: "Check-in" };
export const dynamic = "force-dynamic";

/**
 * /events/[id]/check-in: for a society event, the door console (PRD 5.31) for its officers and staff;
 * for a university event (PRD 5.23), the rotating code on the organiser's screen.
 */
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

export default async function CheckinPage({ params }: PageProps<"/events/[id]/check-in">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const loaded = await loadEvent(id);
  if (!loaded) notFound();
  if (loaded.kind === "uni") {
    if (!loaded.uni.can_organise) notFound();
    return (
      <main className="mx-auto flex w-full max-w-prose flex-col items-center gap-6 px-[var(--page-gutter)] py-6 text-center">
        <PageTitle title={loaded.uni.title}>Point your phone camera at the code to check in.</PageTitle>
        <CheckinScreen eventId={id} />
      </main>
    );
  }
  const e = loaded.e;
  if (!e.staff) notFound();
  if (e.status === "draft" || e.status === "cancelled") notFound();
  const head = await getHeadcount(id, null);
  return (
    <main className="mx-auto flex w-full max-w-page flex-col gap-6 px-[var(--page-gutter)] py-6">
      <Link href={(e.officer ? `/events/${id}/manage` : `/events/${id}`) as Route} className="inline-flex items-center gap-1 text-body-sm font-semibold underline-offset-4 hover:underline">
        <ArrowLeft aria-hidden weight="bold" className="size-4" />
        {e.title}
      </Link>
      <PageTitle title="Check-in">Opens 2 hours before the first session. Scanning works with the ticket&apos;s signed code; a forged or copied code shows red.</PageTitle>
      <CheckInConsole eventId={id} sessions={head.sessions.map((s) => ({ id: s.id, title: s.title, label: s.label }))} initial={{ sessionId: head.sessionId, checkedIn: head.checkedIn, expected: head.expected }} />
    </main>
  );
}
