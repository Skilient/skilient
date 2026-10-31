import type { Route } from "next";
import Link from "next/link";
import { emailField, finalCta } from "@/content/marketing";
import { UniEmailField } from "../uni-email-field";

/** Landing section 14 (PRD 5.1): the page's one centred statement, and the email field again. */
export function FinalCta({ home, siteKey }: { home: string | null; siteKey: string | null }) {
  return (
    <section aria-labelledby="final-title">
      <div className="mx-auto max-w-page px-[var(--page-gutter)] py-16 sm:py-20">
      <div className="neu-raised-l flex flex-col items-center gap-6 rounded-[var(--r-card)] px-6 py-16 text-center sm:py-20">
        <h2 id="final-title" className="font-display text-[2.5rem] leading-[1.05] tracking-[-0.025em] sm:text-[3.5rem]">
          {finalCta.heading}
        </h2>
        <p className="text-body-lg text-text-secondary">{finalCta.body}</p>
        <div className="flex w-full max-w-xl justify-center text-left">
          {home ? (
            <Link
              href={home as Route}
              className="neu-btn text-body-lg"
            >
              {emailField.signedIn}
            </Link>
          ) : (
            <UniEmailField idPrefix="final" siteKey={siteKey} />
          )}
        </div>
      </div>
      </div>
    </section>
  );
}
