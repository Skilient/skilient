import { Briefcase, EnvelopeSimple, GithubLogo, SealCheck } from "@phosphor-icons/react/dist/ssr";
import { howItWorks } from "@/content/marketing";
import { Streak } from "../streak";
import { Section, SectionHeading } from "./section";

const ICONS = { email: EnvelopeSimple, github: GithubLogo, verified: SealCheck, recognised: Briefcase } as const;

/**
 * Landing section 4 (PRD 5.1): four counted steps in a horizontal scroll-snap rail of raised tiles.
 * Each tile leads with its icon in a pressed well, carries its step number as the panel's one big
 * numeral, and ends with a proof line saying what that step checks. Native scrolling, no
 * animation; the rail takes focus so the arrow keys scroll it.
 */
export function HowItWorks() {
  const total = String(howItWorks.steps.length).padStart(2, "0");
  return (
    <Section labelledBy="how-title" decor={<Streak seed={3} />} step="02 · How it works">
      <SectionHeading id="how-title">{howItWorks.heading}</SectionHeading>
      <ol
        tabIndex={0}
        aria-labelledby="how-title"
        className="how-rail -mx-[var(--page-gutter)] mt-8 flex snap-x snap-mandatory gap-6 overflow-x-auto px-[var(--page-gutter)] pt-4 pb-10 focus-visible:outline-offset-[-2px]"
        data-testid="how-rail"
      >
        {howItWorks.steps.map((step, i) => {
          const Icon = ICONS[step.icon];
          const n = String(i + 1).padStart(2, "0");
          return (
            <li key={step.title} className="neu-tile relative flex w-[80%] shrink-0 snap-start flex-col gap-4 overflow-hidden p-6 sm:w-[46%] lg:w-[calc((100%-4.5rem)/4)]">
              <span aria-hidden className="neu-ghost -right-1 -bottom-2 text-[5.5rem]">
                {n}
              </span>
              <div className="relative flex items-center justify-between">
                <span className="neu-well-s inline-grid size-12 place-items-center rounded-full">
                  <Icon aria-hidden weight="regular" className="size-6 text-[var(--signal-ink)]" />
                </span>
                <span className="neu-mono text-text-secondary">
                  Step {n}/{total}
                </span>
              </div>
              <h3 className="relative text-[1.25rem] leading-[1.2] font-semibold tracking-[-0.01em]">{step.title}</h3>
              <p className="relative text-body text-text-secondary">{step.text}</p>
              <p className="proof-line neu-mono relative mt-auto pr-14 text-text-secondary">
                <SealCheck aria-hidden weight="bold" className="size-4 shrink-0 text-[var(--signal-ink)]" />
                {step.proof}
              </p>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}
