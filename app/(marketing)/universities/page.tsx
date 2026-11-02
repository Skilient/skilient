import type { Metadata } from "next";
import { CtaLink, OrgHero } from "@/components/marketing/org-parts";
import { PlanTable } from "@/components/marketing/plan-table";
import { Section, SectionHeading } from "@/components/marketing/sections/section";
import type { OrbitItem } from "@/components/marketing/story/orbit";
import { DashboardPanel, EcospherePanel, FairPanel, ProPanel, RecordsPanel } from "@/components/marketing/story/panels-universities";
import { PinnedStory } from "@/components/marketing/story/pinned-story";
import { TalkToUsForm } from "@/components/marketing/talk-to-us-form";
import { pricingPage, universitiesPage as copy } from "@/content/marketing";
import { getPublicPlans } from "@/lib/data/marketing";
import type { ObjectName } from "@/lib/marketing/objects";
import { turnstileSiteKey } from "@/lib/security/turnstile";

export const metadata: Metadata = { title: copy.title, description: copy.description, alternates: { canonical: "/universities" } };

const ORBIT: OrbitItem[] = [
  { name: "ticket", x: 4, y: 6, w: 34, d: 0.4, r: -8 },
  { name: "campus", x: 18, y: 28, w: 56, d: 1, r: -3, eager: true },
  { name: "booth", x: 60, y: 54, w: 36, d: 0.7, r: 6 },
];

type Id = (typeof copy.sections)[number]["id"];
const PANELS: Record<Id, React.ReactNode> = {
  ecosphere: <EcospherePanel />,
  dashboards: <DashboardPanel />,
  records: <RecordsPanel />,
  events: <FairPanel />,
  pro: <ProPanel />,
};
const OBJECTS: Partial<Record<Id, ObjectName>> = { ecosphere: "campus", dashboards: "commit", records: "seal", events: "booth" };

/**
 * /universities (PRD 5.1, 5.23; decisions 2026-11-01): the reader runs careers at Ayesha's
 * university (a sample). Ecosphere, dashboards, records, fairs and Student Pro as pinned chapters,
 * then the licences from `plans` and "Talk to us" (a sales lead in /ops/leads).
 */
export default async function UniversitiesPage() {
  const plans = await getPublicPlans();
  return (
    <>
      <OrgHero
        headline={copy.headline}
        intro={copy.intro}
        orbit={ORBIT}
        orbitAlt={copy.orbitAlt}
        cta={
          <CtaLink href={copy.cta.href} testId="org-cta" track="talk_to_us">
            {copy.cta.label}
          </CtaLink>
        }
      />

      <PinnedStory
        label="Your campus on Skilient, in five chapters"
        chapters={copy.sections.map((s) => ({
          id: s.id,
          kicker: copy.kickers[s.id],
          title: copy.titles[s.id],
          body: s.text,
          proof: copy.proofs[s.id],
          panel: PANELS[s.id],
          object: OBJECTS[s.id],
        }))}
      />

      <Section id="plans" labelledBy="plans-title" className="epilogue" step="Epilogue · Licences">
        <div className="flex flex-col gap-3">
          <SectionHeading id="plans-title">{copy.plans.heading}</SectionHeading>
          <p className="max-w-[62ch] text-body-lg text-text-secondary">{copy.plans.text}</p>
        </div>
        <div className="mt-10">
          <PlanTable id="universities" plans={plans.filter((p) => p.audience === "university")} free={pricingPage.universities.free} pinned="growth" />
        </div>
      </Section>

      <Section id="talk" labelledBy="talk-title" className="epilogue" step="Epilogue · Talk to us">
        <div className="grid gap-10 md:grid-cols-12 md:gap-6">
          <div className="flex flex-col gap-4 md:col-span-4">
            <SectionHeading id="talk-title">{copy.talk.heading}</SectionHeading>
            <p className="text-body-lg text-text-secondary">{copy.talk.text}</p>
          </div>
          <div className="md:col-span-7 md:col-start-6">
            <TalkToUsForm siteKey={turnstileSiteKey()} />
          </div>
        </div>
      </Section>
    </>
  );
}
