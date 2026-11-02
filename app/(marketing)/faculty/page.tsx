import type { Metadata } from "next";
import { CtaLink, OrgHero } from "@/components/marketing/org-parts";
import { Section, SectionHeading } from "@/components/marketing/sections/section";
import type { OrbitItem } from "@/components/marketing/story/orbit";
import { ConfirmPanel, EndorsePanel, IdeaPanel, ReviewPanel, ThreadPanel } from "@/components/marketing/story/panels-faculty";
import { PinnedStory } from "@/components/marketing/story/pinned-story";
import { facultyPage as copy, nav } from "@/content/marketing";
import { getViewer } from "@/lib/data/marketing";
import type { ObjectName } from "@/lib/marketing/objects";

export const metadata: Metadata = { title: copy.title, description: copy.description, alternates: { canonical: "/faculty" } };

const ORBIT: OrbitItem[] = [
  { name: "bulb", x: 8, y: 2, w: 30, d: 0.5, r: -6 },
  { name: "page", x: 52, y: 6, w: 38, d: 0.6, r: 8 },
  { name: "pen", x: 4, y: 40, w: 64, d: 1, r: -4, eager: true },
  { name: "seal", x: 62, y: 60, w: 28, d: 0.75, r: -10 },
];

const PANELS = {
  ideas: <IdeaPanel />,
  supervise: <ThreadPanel />,
  confirm: <ConfirmPanel />,
  review: <ReviewPanel />,
  endorse: <EndorsePanel />,
} as const;
const OBJECTS: Record<keyof typeof PANELS, ObjectName> = { ideas: "bulb", supervise: "pen", confirm: "seal", review: "page", endorse: "rosette" };

/** /faculty (PRD 5.1, 5.21; decisions 2026-11-01): the reader teaches at Ayesha's university; five pinned chapters, free for faculty. */
export default async function FacultyPage() {
  const viewer = await getViewer();
  const cta = viewer ? (
    <CtaLink href={viewer.home} testId="org-cta" track="open_app">
      {nav.open}
    </CtaLink>
  ) : (
    <CtaLink href={copy.cta.href} testId="org-cta" track="faculty_signup">
      {copy.cta.label}
    </CtaLink>
  );
  const text = (feature: string) => copy.features.find((f) => f.icon === feature)?.text ?? "";
  return (
    <>
      <OrgHero
        headline={copy.headline}
        intro={copy.intro}
        orbit={ORBIT}
        orbitAlt={copy.orbitAlt}
        cta={cta}
        aside={<span className="text-body font-semibold text-text-secondary">{copy.free}</span>}
      />

      <PinnedStory
        label="Your work as faculty, in five chapters"
        chapters={copy.chapters.map((c) => ({
          id: c.id,
          kicker: c.kicker,
          title: c.title,
          body: c.feature === "endorse" ? `${text("endorse")} ${text("grade")}` : text(c.feature),
          proof: c.proof,
          panel: PANELS[c.feature],
          object: OBJECTS[c.feature],
        }))}
      />

      <Section labelledBy="join-title" className="epilogue" step="Epilogue · How you join">
        <div className="flex max-w-[62ch] flex-col gap-5">
          <SectionHeading id="join-title">{copy.join.heading}</SectionHeading>
          <p className="text-body-lg text-text-secondary">{copy.join.text}</p>
          <div>{cta}</div>
        </div>
      </Section>
    </>
  );
}
