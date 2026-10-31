import { CaretDown } from "@phosphor-icons/react/dist/ssr";
import { faq } from "@/content/marketing";
import { Section, SectionHeading } from "./section";

/**
 * Landing section 13 (PRD 5.1): native details/summary, so it works and is keyboard-operable
 * without JavaScript; opening animates its height in CSS (250 ms), instantly under reduced motion.
 */
export function Faq() {
  return (
    <Section labelledBy="faq-title" step="10 · Questions">
      <div className="grid gap-8 md:grid-cols-12 md:gap-6">
        <SectionHeading id="faq-title" className="md:col-span-3">
          {faq.heading}
        </SectionHeading>
        <div className="flex flex-col gap-4 md:col-span-8 md:col-start-5">
          {faq.items.map((item, i) => (
            <details key={item.q} className="faq-item group px-6">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-h4 font-semibold [&::-webkit-details-marker]:hidden">
                <span className="flex items-baseline gap-4">
                  <span aria-hidden className="neu-mono text-[var(--signal-ink)]">
                    Q{String(i + 1).padStart(2, "0")}
                  </span>
                  {item.q}
                </span>
                <CaretDown aria-hidden weight="bold" className="faq-caret size-5 shrink-0 text-[var(--signal-ink)]" />
              </summary>
              <p className="max-w-[64ch] pb-6 text-body-lg text-text-secondary">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </Section>
  );
}
