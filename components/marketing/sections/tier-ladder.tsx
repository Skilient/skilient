import { tiers } from "@/content/marketing";
import { TierBadge } from "../neu";
import { Section, SectionHeading } from "./section";

/**
 * Landing section 7 (PRD 5.1): the tier ladder as terraces. Six raised steps, each one higher than
 * the last, the same badge shape in a brighter finish (foil and glow only for Radiant and
 * Luminary). The one scroll-linked element: an orange fill rises along a pressed track as the
 * ladder passes through the viewport (CSS scroll-driven animation; without support, or with
 * reduced motion, it shows filled).
 */
export function TierLadder() {
  return (
    <Section labelledBy="tiers-title" step="05 · Tiers">
      <SectionHeading id="tiers-title" className="max-w-[22ch]">
        {tiers.heading}
      </SectionHeading>
      <p className="mt-5 max-w-[56ch] text-body-lg text-text-secondary">{tiers.body}</p>
      <div className="tier-ladder relative mt-12 pl-8 md:mt-16 md:pb-8 md:pl-0" data-testid="tier-ladder">
        <div aria-hidden className="tier-track absolute" />
        <div aria-hidden className="tier-fill absolute bg-[var(--signal)]" />
        <ol className="relative grid gap-5 md:grid-cols-6 md:items-end md:gap-4">
          {tiers.ladder.map((t, i) => (
            <li key={t.id} className="tier-step neu-tile flex flex-col gap-3 p-5" style={{ "--step": i } as React.CSSProperties}>
              <span className="neu-mono text-text-secondary">Level {String(i + 1).padStart(2, "0")}</span>
              <TierBadge tier={t.id} name={t.name} className="self-start" />
              <span className="text-body-sm text-text-secondary">{t.meaning}</span>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  );
}
