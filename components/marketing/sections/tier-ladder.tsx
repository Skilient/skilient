import { tiers } from "@/content/marketing";
import { TierBadge } from "../neu";
import { Streak } from "../streak";
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
    <Section labelledBy="tiers-title" decor={<Streak seed={11} />} step="05 · Tiers">
      <SectionHeading id="tiers-title" className="max-w-[22ch]">
        {tiers.heading}
      </SectionHeading>
      <p className="mt-5 max-w-[56ch] text-body-lg text-text-secondary">{tiers.body}</p>
      <div className="tier-ladder relative mt-12 pl-8 md:mt-16 md:pb-8 md:pl-0" data-testid="tier-ladder">
        <div aria-hidden className="tier-track absolute" />
        <div aria-hidden className="tier-fill absolute bg-[var(--signal)]" />
        <ol className="relative grid gap-5 md:grid-cols-6 md:items-end md:gap-4">
          {tiers.ladder.map((t, i) => (
            <li key={t.id} className="tier-step neu-tile relative flex flex-col gap-3 overflow-hidden p-5" style={{ "--step": i } as React.CSSProperties}>
              <span aria-hidden className="neu-ghost -right-1 -bottom-2 text-[5.5rem]">
                {i + 1}
              </span>
              <span className="neu-mono relative text-text-secondary">Level {String(i + 1).padStart(2, "0")}</span>
              <TierBadge tier={t.id} name={t.name} className="relative self-start" />
              <span className="relative text-body-sm text-text-secondary">{t.meaning}</span>
              <span aria-hidden className="relative mt-auto flex items-end gap-1 pt-2">
                {tiers.ladder.map((_, j) => (
                  <i
                    key={j}
                    className={j <= i ? "w-2.5 rounded-[2px] bg-[var(--signal)]" : "w-2.5 rounded-[2px] shadow-[var(--pressed-s)]"}
                    style={{ height: `${6 + j * 3}px` }}
                  />
                ))}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  );
}
