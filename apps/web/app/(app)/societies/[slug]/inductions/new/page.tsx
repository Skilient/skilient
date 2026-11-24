import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InductionForm } from "@/components/societies/induction-form";
import { PageTitle } from "@/components/uni/page-parts";
import { officerSociety } from "@/lib/data/societies";

export const metadata: Metadata = { title: "New induction round" };

export default async function NewInductionPage({ params }: PageProps<"/societies/[slug]/inductions/new">) {
  const { slug } = await params;
  const s = await officerSociety(slug);
  if (!s || s.status !== "verified") notFound();
  return (
    <main className="mx-auto flex w-full max-w-prose flex-col gap-6 px-[var(--page-gutter)] py-6">
      <Link href={`/societies/${slug}?tab=inductions` as Route} className="inline-flex items-center gap-1 text-body-sm font-semibold underline-offset-4 hover:underline">
        <ArrowLeft aria-hidden weight="bold" className="size-4" />
        {s.name}
      </Link>
      <PageTitle title="New induction round">Students at your university apply for a role and answer your questions. You shortlist, accept or decline; accepted applicants become members.</PageTitle>
      <InductionForm societyId={s.id} slug={slug} />
    </main>
  );
}
