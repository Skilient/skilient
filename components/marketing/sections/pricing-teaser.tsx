import { ArrowRight, Check } from "@phosphor-icons/react/dist/ssr";
import type { Route } from "next";
import Link from "next/link";
import { isBuilt, pricingTeaser } from "@/content/marketing";
import type { PublicPlan } from "@/lib/data/marketing";
import { Section, SectionHeading } from "./section";

const pkr = (n: number) => `PKR ${n.toLocaleString("en-PK")}`;

/**
 * Landing section 12 (PRD 5.1): "Free is enough to prove yourself", with Student Pro's price read
 * from `plans`. If the plans can't be read, the price line is left out and the rest still stands.
 */
export function PricingTeaser({ plans }: { plans: PublicPlan[] }) {
  const monthly = plans.find((p) => p.id === "student_pro_monthly")?.price_pkr ?? null;
  const yearly = plans.find((p) => p.id === "student_pro_yearly")?.price_pkr ?? null;
  return (
    <Section labelledBy="pricing-title" step="Epilogue · Pricing" className="epilogue">
      <div className="grid gap-10 md:grid-cols-12 md:gap-6">
        <div className="flex flex-col gap-5 md:col-span-7">
          <SectionHeading id="pricing-title" className="max-w-[18ch]">
            {pricingTeaser.heading}
          </SectionHeading>
          <p className="max-w-[48ch] text-body-lg text-text-secondary">{pricingTeaser.body}</p>
        </div>
        <div className="neu-ink flex flex-col gap-4 p-8 md:col-span-5" data-testid="pricing-teaser">
          <h3 className="text-h3">{pricingTeaser.pro}</h3>
          {monthly ? (
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="neu-figure text-[2.25rem] leading-none font-semibold">{pkr(monthly)}</span>
              <span className="text-body text-text-secondary">a month{yearly ? ` or ${pkr(yearly)} a year` : ""}</span>
            </p>
          ) : null}
          <ul className="flex flex-col gap-2">
            {pricingTeaser.perks.map((perk) => (
              <li key={perk} className="flex items-start gap-2 text-body">
                <Check aria-hidden weight="bold" className="mt-1 size-4 shrink-0 text-[var(--ink-accent)]" />
                {perk}
              </li>
            ))}
          </ul>
          <p className="text-body-sm text-text-secondary">{pricingTeaser.sponsored}</p>
          {isBuilt("/pricing") ? (
            <Link href={"/pricing" as Route} className="neu-btn mt-2 self-start text-body">
              {pricingTeaser.link}
              <ArrowRight aria-hidden weight="bold" className="cta-arrow size-4" />
            </Link>
          ) : null}
        </div>
      </div>
    </Section>
  );
}
