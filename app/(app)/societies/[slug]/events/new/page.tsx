import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EventStepper } from "@/components/events/event-stepper";
import { PageTitle } from "@/components/uni/page-parts";
import { getEventEditPayload } from "@/lib/data/events";
import { getPaymentDetails, officerSociety } from "@/lib/data/societies";
import { publicImageUrl } from "@/lib/storage";

export const metadata: Metadata = { title: "Event" };

/**
 * /societies/[slug]/events/new (PRD 5.31): the create stepper; `?edit=<id>` edits an event, `?from=<id>`
 * starts a copy of one (dates cleared). Officers of a verified society only.
 */
export default async function NewEventPage({ params, searchParams }: PageProps<"/societies/[slug]/events/new">) {
  const { slug } = await params;
  const sp = await searchParams;
  const s = await officerSociety(slug);
  if (!s || s.status !== "verified") notFound();
  const edit = typeof sp.edit === "string" && /^[0-9a-f-]{36}$/.test(sp.edit) ? sp.edit : null;
  const from = typeof sp.from === "string" && /^[0-9a-f-]{36}$/.test(sp.from) ? sp.from : null;
  const source = edit ?? from;
  let payload: Record<string, unknown> | null = null;
  if (source) {
    try {
      payload = await getEventEditPayload(source);
    } catch {
      notFound();
    }
    if (payload.society_id !== s.id) notFound();
  }
  const details = await getPaymentDetails(s.id);
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-[var(--page-gutter)] py-6">
      <Link href={`/societies/${slug}` as Route} className="inline-flex items-center gap-1 text-body-sm font-semibold underline-offset-4 hover:underline">
        <ArrowLeft aria-hidden weight="bold" className="size-4" />
        {s.name}
      </Link>
      <PageTitle title={edit ? "Edit event" : from ? "Duplicate event" : "Create an event"}>
        {edit ? "Changes to the time or place notify everyone registered." : `Hosted by ${s.name}. It stays a draft until you publish it.`}
      </PageTitle>
      <EventStepper
        societyId={s.id}
        slug={slug}
        payload={payload}
        duplicate={Boolean(from && !edit)}
        coverUrl={payload ? publicImageUrl("society-media", (payload.cover_path as string | null) ?? null) : null}
        hasPaymentDetails={details.active.length > 0}
      />
    </main>
  );
}
