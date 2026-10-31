import { Briefcase, ChatCenteredText, Storefront, Trophy } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import { opportunities } from "@/content/marketing";
import { cn } from "@/lib/cn";
import { captures } from "@/lib/marketing/captures";
import { CaptureImage } from "../capture-image";
import { Streak } from "../streak";
import { Section, SectionHeading } from "./section";

function Cell({ icon, title, text, className, children }: { icon: ReactNode; title: string; text: string; className?: string; children?: ReactNode }) {
  return (
    <li className={cn("neu-card flex flex-col overflow-hidden", className)}>
      <div className="flex flex-col gap-2 p-6">
        <h3 className="flex items-center gap-3 text-h3">
          <span className="neu-chip inline-grid size-11 shrink-0 place-items-center">{icon}</span>
          {title}
        </h3>
        <p className="text-body text-text-secondary">{text}</p>
      </div>
      {children}
    </li>
  );
}

/**
 * Landing section 9 (PRD 5.1): what comes to a student, as a bento of exactly four cells. Jobs and
 * contact requests show real captures; competitions and fairs are typographic on tinted grounds.
 */
export function OpportunitiesBlock() {
  const c = opportunities.cells;
  const icon = "size-5 shrink-0 text-[var(--signal-ink)]";
  return (
    <Section labelledBy="opps-title" decor={<Streak seed={29} />} step="07 · Opportunities">
      <SectionHeading id="opps-title">{opportunities.heading}</SectionHeading>
      <ul className="mt-10 grid gap-6 md:grid-cols-12">
        <Cell icon={<Briefcase aria-hidden weight="bold" className={icon} />} title={c.jobs.title} text={c.jobs.text} className="md:col-span-6 md:row-span-2">
          <div className="mt-auto px-6">
            <div className="neu-well mx-auto max-w-[24rem] overflow-hidden rounded-b-none p-2 pb-0">
              <CaptureImage file={captures.sections.jobs} alt={c.jobs.alt} />
            </div>
          </div>
        </Cell>
        <Cell icon={<ChatCenteredText aria-hidden weight="bold" className={icon} />} title={c.requests.title} text={c.requests.text} className="md:col-span-6">
          <div className="mt-auto max-h-60 overflow-hidden px-6">
            <div className="neu-well mx-auto max-w-[24rem] overflow-hidden rounded-b-none p-2 pb-0">
              <CaptureImage file={captures.sections.contactRequest} alt={c.requests.alt} />
            </div>
          </div>
        </Cell>
        <Cell icon={<Trophy aria-hidden weight="bold" className={icon} />} title={c.competitions.title} text={c.competitions.text} className="md:col-span-3" />
        <Cell icon={<Storefront aria-hidden weight="bold" className={icon} />} title={c.fairs.title} text={c.fairs.text} className="md:col-span-3" />
      </ul>
    </Section>
  );
}
