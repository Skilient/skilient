import { Briefcase, EnvelopeSimple, GithubLogo, SealCheck } from "@phosphor-icons/react/dist/ssr";
import { howItWorks } from "@/content/marketing";
import { Section, SectionHeading } from "./section";

const ICONS = { email: EnvelopeSimple, github: GithubLogo, verified: SealCheck, recognised: Briefcase } as const;

/**
 * Landing section 4 (PRD 5.1): four counted steps in a horizontal scroll-snap rail of raised tiles,
 * each icon in a pressed well. Native scrolling, no animation; the rail takes focus so the arrow
 * keys scroll it.
 */
export function HowItWorks() {
  const total = String(howItWorks.steps.length).padStart(2, "0");
  return (
    <Section labelledBy="how-title" step="02 · How it works">
      <SectionHeading id="how-title">{howItWorks.heading}</SectionHeading>
      <ol
        tabIndex={0}
        aria-labelledby="how-title"
        className="how-rail -mx-[var(--page-gutter)] mt-8 flex snap-x snap-mandatory gap-6 overflow-x-auto px-[var(--page-gutter)] pt-4 pb-10 focus-visible:outline-offset-[-2px]"
        data-testid="how-rail"
      >
        {howItWorks.steps.map((step, i) => {
          const Icon = ICONS[step.icon];
          return (
            <li key={step.title} className="neu-tile flex w-[80%] shrink-0 snap-start flex-col gap-4 p-6 sm:w-[46%] lg:w-[calc((100%-4.5rem)/4)]">
              <div className="flex items-center justify-between">
                <span className="neu-well-s inline-grid size-12 place-items-center rounded-full">
                  <Icon aria-hidden weight="regular" className="size-6 text-[var(--signal-ink)]" />
                </span>
                <span className="neu-mono text-text-secondary">
                  Step {String(i + 1).padStart(2, "0")}/{total}
                </span>
              </div>
              <h3 className="text-[1.25rem] leading-[1.2] font-semibold tracking-[-0.01em]">{step.title}</h3>
              <p className="text-body text-text-secondary">{step.text}</p>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}
