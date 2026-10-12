import type { Metadata } from "next";
import { FaqList } from "@/components/marketing/sections/faq";
import { faq, faqPage } from "@/content/marketing";

export const metadata: Metadata = { title: faqPage.title, description: faqPage.description, alternates: { canonical: "/faq" } };

/**
 * /faq (PRD 5.1): every question from the landing, with its full answer. The landing shows the
 * first three and links here. Native details/summary, so it needs no JavaScript.
 */
export default function FaqPage() {
  return (
    <article aria-labelledby="page-title" className="mx-auto max-w-page px-[var(--page-gutter)] pt-12 pb-20 sm:pt-16">
      <h1 id="page-title" className="text-hero max-w-[18ch] text-text-primary">
        {faqPage.headline}
      </h1>
      <div className="mt-10 max-w-[60rem]">
        <FaqList items={faq.items} />
      </div>
    </article>
  );
}
