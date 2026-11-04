import type { Metadata } from "next";
import { CtaLink, OrgHero } from "@/components/marketing/org-parts";
import { Section, SectionHeading } from "@/components/marketing/sections/section";
import type { OrbitItem } from "@/components/marketing/story/orbit";
import { ContactPanel, EvidencePanel, HirePanel, SearchPanel, TrustPanel } from "@/components/marketing/story/panels-recruiters";
import { PinnedStory } from "@/components/marketing/story/pinned-story";
import { LitLines } from "@/components/marketing/story/rules";
import { TalkToUsForm } from "@/components/marketing/talk-to-us-form";
import { recruitersPage as copy } from "@/content/marketing";
import { turnstileSiteKey } from "@/lib/security/turnstile";

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
 * the rules of contact, then "Talk to us": recruiter accounts aren't open yet (phase 14, the portal
 * is off by flag), so the page ends on a sales lead in /ops/leads instead of plans and a signup.
 */
export default function RecruitersPage() {
  const cta = (
    <CtaLink href={copy.cta.href} testId="org-cta" track="talk_to_us">
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

      <Section id="talk" labelledBy="talk-title" className="epilogue" step="Epilogue · Talk to us">
        <div className="grid gap-10 md:grid-cols-12 md:gap-6">
          <div className="flex flex-col gap-4 md:col-span-4">
            <SectionHeading id="talk-title">{copy.talk.heading}</SectionHeading>
            <p className="text-body-lg text-text-secondary">{copy.talk.text}</p>
          </div>
          <div className="md:col-span-7 md:col-start-6">
            <TalkToUsForm siteKey={turnstileSiteKey()} kind="recruiter" />
          </div>
        </div>
      </Section>
    </>
  );
}
