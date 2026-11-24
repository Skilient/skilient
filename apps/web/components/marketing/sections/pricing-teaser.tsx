import { ArrowRight, Check } from "@phosphor-icons/react/dist/ssr";
import type { Route } from "next";
import Link from "next/link";
import { isBuilt, pricingTeaser } from "@/content/marketing";
import { Section, SectionHeading } from "./section";

/**
 * Landing section 12 (PRD 5.1): "Free is enough to prove yourself". No price: Student Pro is priced
 * in the app only, and /pricing became /features (phase 14, decisions 2026-11-02).
 */
export function PricingTeaser() {
  return (
    <Section labelledBy="pricing-title" step="Epilogue · Features" className="epilogue">
      <div className="grid gap-10 md:grid-cols-12 md:gap-6">
        <div className="flex flex-col gap-5 md:col-span-7">
          <SectionHeading id="pricing-title" className="max-w-[18ch]">
            {pricingTeaser.heading}
          </SectionHeading>
          <p className="max-w-[48ch] text-body-lg text-text-secondary">{pricingTeaser.body}</p>
        </div>
        <div className="neu-ink flex flex-col gap-4 p-8 md:col-span-5" data-testid="pricing-teaser">
          <h3 className="text-h3">{pricingTeaser.pro}</h3>
          <ul className="flex flex-col gap-2">
            {pricingTeaser.perks.map((perk) => (
              <li key={perk} className="flex items-start gap-2 text-body">
                <Check aria-hidden weight="bold" className="mt-1 size-4 shrink-0 text-[var(--ink-accent)]" />
                {perk}
              </li>
            ))}
          </ul>
          <p className="text-body-sm text-text-secondary">{pricingTeaser.sponsored}</p>
          {isBuilt("/features") ? (
            <Link href={"/features" as Route} className="neu-btn mt-2 self-start text-body">
              {pricingTeaser.link}
              <ArrowRight aria-hidden weight="bold" className="cta-arrow size-4" />
            </Link>
          ) : null}
        </div>
      </div>
    </Section>
  );
}
