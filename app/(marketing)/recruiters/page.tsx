import type { Metadata, Route } from "next";
import Link from "next/link";
import { CtaLink, OrgHero } from "@/components/marketing/org-parts";
import { PlanTable } from "@/components/marketing/plan-table";
import { Section, SectionHeading } from "@/components/marketing/sections/section";
import type { OrbitItem } from "@/components/marketing/story/orbit";
import { ContactPanel, EvidencePanel, HirePanel, SearchPanel, TrustPanel } from "@/components/marketing/story/panels-recruiters";
import { PinnedStory } from "@/components/marketing/story/pinned-story";
import { LitLines } from "@/components/marketing/story/rules";
import { nav, pricingPage, recruitersPage as copy } from "@/content/marketing";
import { getPublicPlans, getViewer } from "@/lib/data/marketing";

export const metadata: Metadata = { title: copy.title, description: copy.description, alternates: { canonical: "/recruiters" } };

const ORBIT: OrbitItem[] = [
  { name: "rosette", x: 6, y: 4, w: 25, d: 0.35, r: 8 },
  { name: "letter", x: 58, y: 2, w: 34, d: 0.55, r: 9 },
  { name: "loupe", x: 12, y: 30, w: 52, d: 1, r: -6, eager: true },
  { name: "seal", x: 62, y: 56, w: 30, d: 0.7, r: -10 },
];

const PANELS = [<SearchPanel key="s" />, <EvidencePanel key="e" />, <ContactPanel key="c" />, <HirePanel key="h" />, <TrustPanel key="t" />];
const OBJECTS = ["loupe", "rosette", "letter", "booth", "seal"] as const;

/**
 * /recruiters (PRD 5.1, 5.20; decisions 2026-11-01): the reader is a recruiter at the sample
 * company meeting Ayesha's record. Search, evidence, contact, hire and trust as pinned chapters,
 * the rules of contact, then the recruiter plans from `plans`.
 */
export default async function RecruitersPage() {
  const [viewer, plans] = await Promise.all([getViewer(), getPublicPlans()]);
  const cta = viewer ? (
    <CtaLink href={viewer.home} testId="org-cta" track="open_app">
      {viewer.role === "recruiter" ? copy.signedIn : nav.open}
    </CtaLink>
  ) : (
    <CtaLink href={copy.cta.href} testId="org-cta" track="recruiter_signup">
      {copy.cta.label}
    </CtaLink>
  );
  return (
    <>
      <OrgHero headline={copy.headline} intro={copy.intro} orbit={ORBIT} orbitAlt={copy.orbitAlt} cta={cta} />

      <PinnedStory
        label="A recruiter’s story, in five chapters"
        chapters={copy.chapters.map((c, i) => ({ ...c, panel: PANELS[i], object: OBJECTS[i] }))}
      />

      <LitLines id="contact-rules-title" heading={copy.rules.heading} lines={copy.rules.lines} />

      <Section id="plans" labelledBy="plans-title" className="epilogue" step="Epilogue · Plans">
        <div className="flex flex-col gap-3">
          <SectionHeading id="plans-title">{copy.plans.heading}</SectionHeading>
          <p className="max-w-[62ch] text-body-lg text-text-secondary">{copy.plans.text}</p>
        </div>
        <div className="mt-10">
          <PlanTable id="recruiters" plans={plans.filter((p) => p.audience === "org")} free={pricingPage.recruiters.explore} pinned="growth" />
        </div>
        <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3">
          {cta}
          <Link href={"/pricing#recruiters" as Route} className="neu-btn-3 text-body">
            {copy.plans.link}
          </Link>
        </div>
      </Section>
    </>
  );
}
