import type { Metadata, Route } from "next";
import Link from "next/link";
import { AgreementText } from "@/components/agreement/agreement-text";
import { legalPages } from "@/content/marketing";
import { getCurrentAgreement } from "@/lib/data/agreement";
import { logger } from "@/lib/log";
import { splitAgreement } from "@/lib/legal/parts";

const copy = legalPages.terms;

export const metadata: Metadata = { title: copy.title, description: copy.description };

/** /terms (PRD 5.1): the user agreement from the current published version, the first part of the text people accept at signup. */
export default async function TermsPage() {
  const agreement = await getCurrentAgreement().catch((err: unknown) => {
    logger.error("terms.agreement_unavailable", { action: "GET /terms", outcome: "error", error_code: String(err).slice(0, 80) });
    return null;
  });
  const text = agreement ? splitAgreement(agreement.body).agreement : null;
  return (
    <article aria-labelledby="page-title" className="mx-auto flex max-w-[44rem] flex-col gap-6 px-[var(--page-gutter)] pt-12 pb-20 sm:pt-16">
      <header className="flex flex-col gap-2">
        <h1 id="page-title" className="font-display text-h1">
          {copy.title}
        </h1>
      </header>
      {text ? <AgreementText markdown={text} /> : <p className="text-body text-text-secondary">{copy.unavailable}</p>}
      <p className="text-body text-text-secondary">
        How we collect, use and delete your personal data is in the{" "}
        <Link href={"/privacy" as Route} className="font-semibold underline underline-offset-4">
          privacy notice
        </Link>
        .
      </p>
    </article>
  );
}
