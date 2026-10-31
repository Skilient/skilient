import { ventures } from "@/content/marketing";
import { captures } from "@/lib/marketing/captures";
import { CaptureImage } from "../capture-image";
import { Section, SectionHeading } from "./section";

/** Landing section 6 (PRD 5.1): a venture page as full-width media, with its three ideas beneath. */
export function VenturesBlock() {
  return (
    <Section labelledBy="ventures-title" step="04 · Ventures">
      <SectionHeading id="ventures-title" className="max-w-[20ch]">
        {ventures.heading}
      </SectionHeading>
      <p className="mt-5 max-w-[62ch] text-body-lg text-text-secondary">{ventures.body}</p>
      <div className="neu-card mt-10 p-3 md:mx-[8.33%]">
        <div className="overflow-hidden rounded-[var(--r-tile)]">
          <CaptureImage file={captures.sections.venture} alt={ventures.alt} />
        </div>
      </div>
      <dl className="mt-10 grid gap-6 sm:grid-cols-3 md:mx-[8.33%]">
        {ventures.points.map((p) => (
          <div key={p.term} className="neu-tile flex flex-col gap-1 p-6">
            <dt className="text-h4">{p.term}</dt>
            <dd className="text-body text-text-secondary">{p.detail}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}
