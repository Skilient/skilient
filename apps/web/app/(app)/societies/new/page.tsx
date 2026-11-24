import type { Metadata, Route } from "next";
import Link from "next/link";
import { RequestStepper } from "@/components/societies/request-stepper";
import { PageTitle } from "@/components/uni/page-parts";
import { getMyRequests } from "@/lib/data/societies";

export const metadata: Metadata = { title: "Request a society" };

/** /societies/new (PRD 5.31): one open request per student; the stepper sends it to /ops/societies. */
export default async function NewSocietyPage() {
  const mine = await getMyRequests();
  const open = mine.find((r) => r.status === "pending" || r.status === "more_info");
  return (
    <main className="mx-auto flex w-full max-w-prose flex-col gap-6 px-[var(--page-gutter)] py-6">
      <PageTitle title="Request a society">Bring your society to Skilient. Once it&apos;s verified, you post as the society, run events and induction rounds, and hand over at the end of your term.</PageTitle>
      {open ? (
        <section className="neu-card flex flex-col gap-2 p-5" data-testid="request-open">
          <h2 className="text-h4">You already have a request waiting</h2>
          <p className="text-body-sm text-text-secondary">
            {open.name} is {open.status === "more_info" ? "waiting for more information from you" : "under review"}. One request at a time.
          </p>
          <Link href={`/societies/${open.slug}` as Route} className="font-semibold underline underline-offset-4">
            Open {open.name}
          </Link>
        </section>
      ) : (
        <RequestStepper reviewDays={mine[0]?.reviewDays ?? 3} />
      )}
    </main>
  );
}
