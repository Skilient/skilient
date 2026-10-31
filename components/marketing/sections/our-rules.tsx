import { rules } from "@/content/marketing";

/**
 * Landing section 10 (PRD 5.1): the rules, numbered, on the page's one ink object (orange stays
 * with the hero and the primary action; app/(marketing)/CLAUDE.md).
 */
export function OurRules() {
  return (
    <section aria-labelledby="rules-title" data-testid="our-rules">
      <div className="mx-auto max-w-page px-[var(--page-gutter)] py-16 sm:py-20">
        <div className="neu-ink px-6 py-12 sm:px-12 sm:py-16">
          <h2 id="rules-title" className="neu-mono mb-8 text-text-secondary">
            {rules.heading}
          </h2>
          <ol className="flex flex-col">
            {rules.lines.map((line, i) => (
              <li
                key={line}
                className="flex items-baseline gap-5 border-t border-[color-mix(in_srgb,var(--on-ink)_18%,transparent)] py-5 font-display text-[2rem] leading-[1.1] tracking-[-0.02em] first:border-t-0 first:pt-0 sm:text-[3rem]"
              >
                <span aria-hidden className="neu-mono shrink-0 text-[var(--ink-accent)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {line}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
