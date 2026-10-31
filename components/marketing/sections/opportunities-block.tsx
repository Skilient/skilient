import { Briefcase, ChatCenteredText, Storefront, Trophy } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import { opportunities } from "@/content/marketing";
import { cn } from "@/lib/cn";
import { captures } from "@/lib/marketing/captures";
import { CaptureImage } from "../capture-image";
import { Streak } from "../streak";
import { TierBadge } from "../neu";
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

/** Competitions: a podium of three raised steps, the winner highest and brightest. Decorative. */
function Podium() {
  const places = [
    { place: "2", h: "h-14", tier: "shine" },
    { place: "1", h: "h-20", tier: "radiant" },
    { place: "3", h: "h-10", tier: "flare" },
  ] as const;
  return (
    <div aria-hidden className="mt-auto flex items-end justify-center gap-2 px-6 pb-6">
      {places.map((p) => (
        <div key={p.place} className="flex w-16 flex-col items-center gap-2">
          <TierBadge tier={p.tier} size="sm" className="px-2" />
          <div className={cn("neu-tile grid w-full place-items-center rounded-[12px] font-display text-h3", p.h)}>{p.place}</div>
        </div>
      ))}
    </div>
  );
}

/** Job fairs: a booth queue as tickets in pressed wells, the next one up raised. Decorative. */
function Queue() {
  const tickets = [
    { booth: "Booth 04", state: "You're next", up: true },
    { booth: "Booth 11", state: "3 ahead", up: false },
    { booth: "Booth 07", state: "Slot 14:30", up: false },
  ];
  return (
    <ul aria-hidden className="mt-auto flex flex-col gap-2 px-6 pb-6">
      {tickets.map((t) => (
        <li
          key={t.booth}
          className={cn("neu-mono flex items-center justify-between rounded-[12px] px-3 py-2", t.up ? "neu-tile text-text-primary" : "neu-well-s text-text-secondary")}
        >
          <span>{t.booth}</span>
          <span className={t.up ? "text-[var(--signal-ink)]" : undefined}>{t.state}</span>
        </li>
      ))}
    </ul>
  );
}

const JOB_FACTS = ["PKR 40,000–60,000 a month", "Internship", "Islamabad", "Closes 23 Oct"];

/**
 * Landing section 9 (PRD 5.1): what comes to a student, as a bento of exactly four cells. Jobs and
 * contact requests show real captures; competitions and fairs show the shape of the thing (a
 * podium, a booth queue) as decoration.
 */
export function OpportunitiesBlock() {
  const c = opportunities.cells;
  const icon = "size-5 shrink-0 text-[var(--signal-ink)]";
  return (
    <Section labelledBy="opps-title" decor={<Streak seed={29} />} step="07 · Opportunities">
      <SectionHeading id="opps-title">{opportunities.heading}</SectionHeading>
      <ul className="mt-10 grid gap-6 md:grid-cols-12">
        <Cell icon={<Briefcase aria-hidden weight="bold" className={icon} />} title={c.jobs.title} text={c.jobs.text} className="md:col-span-6 md:row-span-2">
          {/* The first post in the capture, as proof lines: pay first, then type, place and closing date. */}
          <ul aria-hidden className="flex flex-wrap gap-2 px-6">
            {JOB_FACTS.map((f, i) => (
              <li key={f} className={cn("neu-mono rounded-full px-3 py-1.5", i === 0 ? "neu-tile text-text-primary" : "neu-well-s text-text-secondary")}>
                {f}
              </li>
            ))}
          </ul>
          <div className="mt-auto px-6 pt-6">
            <div className="neu-well mx-auto max-w-[29rem] overflow-hidden rounded-b-none p-2 pb-0">
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
        <Cell icon={<Trophy aria-hidden weight="bold" className={icon} />} title={c.competitions.title} text={c.competitions.text} className="md:col-span-3">
          <Podium />
        </Cell>
        <Cell icon={<Storefront aria-hidden weight="bold" className={icon} />} title={c.fairs.title} text={c.fairs.text} className="md:col-span-3">
          <Queue />
        </Cell>
      </ul>
    </Section>
  );
}
