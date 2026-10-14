import type { Metadata } from "next";
import { AgreementText } from "@/components/agreement/agreement-text";
import { legalPages } from "@/content/marketing";
import { getCurrentAgreement } from "@/lib/data/agreement";
import { logger } from "@/lib/log";
import { splitAgreement } from "@/lib/legal/parts";

const copy = legalPages.privacy;

export const metadata: Metadata = { title: copy.title, description: copy.description };

/** /privacy (PRD 5.1): the privacy notice from the current agreement, on its own URL for Google's policy requirements. */
export default async function PrivacyPage() {
  const agreement = await getCurrentAgreement().catch((err: unknown) => {
    logger.error("privacy.agreement_unavailable", { action: "GET /privacy", outcome: "error", error_code: String(err).slice(0, 80) });
    return null;
  });
  const privacy = agreement ? splitAgreement(agreement.body).privacy : null;
  return (
    <article aria-labelledby="page-title" className="mx-auto flex max-w-[44rem] flex-col gap-6 px-[var(--page-gutter)] pt-12 pb-20 sm:pt-16">
      <header className="flex flex-col gap-2">
        <h1 id="page-title" className="font-display text-h1">
          {copy.title}
        </h1>
        {agreement && privacy ? <p className="text-body-sm text-text-muted">{copy.version.replace("{version}", String(agreement.version))}</p> : null}
      </header>
      {privacy ? <AgreementText markdown={privacy} /> : <p className="text-body text-text-secondary">{copy.unavailable}</p>}
    </article>
  );
}
