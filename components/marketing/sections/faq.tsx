import { ArrowRight, CaretDown } from "@phosphor-icons/react/dist/ssr";
import type { Route } from "next";
import Link from "next/link";
import { faq, faqPage } from "@/content/marketing";
import { Section, SectionHeading } from "./section";

/** How many questions the landing shows before the link to /faq. */
const LANDING_QUESTIONS = 3;

/**
 * Native details/summary, so it works and is keyboard-operable without JavaScript; opening
 * animates its height in CSS (250 ms), instantly under reduced motion. Shared by the landing
 * section and /faq.
 */
export function FaqList({ items }: { items: readonly { q: string; a: string }[] }) {
  return (
    <div className="border-t border-border-default">
      {items.map((item) => (
        <details key={item.q} className="faq-item group border-b border-border-default">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-h4 [&::-webkit-details-marker]:hidden">
            {item.q}
            <CaretDown aria-hidden weight="bold" className="faq-caret size-5 shrink-0 text-text-secondary" />
          </summary>
          <p className="max-w-[64ch] pb-6 text-body-lg text-text-secondary">{item.a}</p>
        </details>
      ))}
    </div>
  );
}

/** Landing section 13 (PRD 5.1): the first questions, then a link to the full list on /faq. */
export function Faq() {
  return (
    <Section labelledBy="faq-title" className="border-b border-border-muted">
      <div className="grid gap-8 md:grid-cols-12 md:gap-6">
        <SectionHeading id="faq-title" className="md:col-span-3">
          {faq.heading}
        </SectionHeading>
        <div className="flex flex-col items-start gap-6 md:col-span-8 md:col-start-5">
          <div className="w-full">
            <FaqList items={faq.items.slice(0, LANDING_QUESTIONS)} />
          </div>
          <Link
            href={"/faq" as Route}
            className="inline-flex h-12 items-center gap-2 text-body-lg font-semibold text-text-primary underline underline-offset-4 hover:text-primary"
          >
            {faqPage.all}
            <ArrowRight aria-hidden weight="bold" className="size-4" />
          </Link>
        </div>
      </div>
    </Section>
  );
}
