import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { CvPaper } from "@/components/cv/cv-paper";
import { verifiedCv } from "@/content/marketing";
import { formatCode } from "@/supabase/functions/_shared/cv/sign.ts";
import { FULL_SNAPSHOT } from "@/lib/cv/sample";
import { siteUrl } from "@/lib/cv/site";
import { Seal } from "../neu";
import { Section, SectionHeading } from "./section";

/** What the signature carries (lib/cv, supabase/functions/_shared/cv). */
const PROOF = ["Ed25519 signature", "Issued 1 Sep 2026", "QR + 10-character code"];

/**
 * Landing section 8 (PRD 5.1): the verified CV as a document specimen. The real CV component
 * renders the sample snapshot (lib/cv/sample.ts), labelled as a sample; beside it the verify code
 * and the Verified Stamp's end state (no motion here: the hero has the page's one moment).
 */
export function CvPreview() {
  return (
    <Section labelledBy="cv-title" step="06 · Verified CV">
      <div className="grid gap-10 md:grid-cols-12 md:gap-6">
        <div className="flex flex-col gap-5 md:col-span-4">
          <SectionHeading id="cv-title">{verifiedCv.heading}</SectionHeading>
          <p className="text-body-lg text-text-secondary">{verifiedCv.body}</p>
          <div className="neu-tile flex items-center gap-4 px-5 py-4">
            <Seal size={40} />
            <div className="flex min-w-0 flex-col">
              <span className="text-body font-semibold">{verifiedCv.status}</span>
              <span className="neu-mono text-text-secondary">{formatCode(verifiedCv.sampleCode)}</span>
            </div>
          </div>
          <ul className="flex flex-wrap gap-2">
            {PROOF.map((p) => (
              <li key={p} className="neu-mono neu-well-s rounded-full px-3 py-1.5 text-text-secondary">
                {p}
              </li>
            ))}
          </ul>
          <Link href="/verify" className="neu-btn-2 self-start text-body">
            {verifiedCv.link}
            <ArrowRight aria-hidden weight="bold" className="cta-arrow size-4" />
          </Link>
        </div>
        <figure className="md:col-span-8 md:col-start-6">
          {/* An illustration of the document: one labelled image for assistive tech, so its own h1 isn't the page's. */}
          <div className="neu-well p-3 sm:p-5">
          <div role="img" aria-label={verifiedCv.alt} className="cv-specimen relative max-h-[34rem] overflow-hidden md:max-h-[40rem]">
            <CvPaper snapshot={FULL_SNAPSHOT} code={verifiedCv.sampleCode} issuedAt="2026-09-01T09:00:00Z" siteUrl={siteUrl()} className="overflow-hidden" />
          </div>
          </div>
          <figcaption className="neu-mono mt-4 text-text-secondary">{verifiedCv.caption}</figcaption>
        </figure>
      </div>
    </Section>
  );
}
