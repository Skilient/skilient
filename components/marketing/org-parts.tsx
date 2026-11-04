import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Orbit, type OrbitItem } from "./story/orbit";

/**
 * Parts shared by /recruiters, /universities, /faculty, /features and /about
 * (docs/marketing-design-plan.md B7). Each page composes its own layout from these.
 */

/** The page's one call to action: a raised signal-orange pill (an anchor on the same page or a route). */
export const ctaClass = "neu-btn text-body-lg";

/**
 * An organisation page's call to action. `track` names it in the `org_cta_click` analytics event
 * (PRD 5.1), sent by AnalyticsLoader's click listener, so this stays a server component.
 */
export function CtaLink({
  href,
  children,
  testId,
  className,
  track,
}: {
  href: string;
  children: ReactNode;
  testId?: string;
  className?: string;
  track: string;
}) {
  const body = (
    <>
      {children}
      <ArrowRight aria-hidden weight="bold" className="cta-arrow size-5" />
    </>
  );
  const tracking = { "data-track": "org_cta_click", "data-track-cta": track };
  return href.startsWith("#") ? (
    <a href={href} className={cn(ctaClass, className)} data-testid={testId} {...tracking}>
      {body}
    </a>
  ) : (
    <Link href={href as Route} className={cn(ctaClass, className)} data-testid={testId} {...tracking}>
      {body}
    </Link>
  );
}

/**
 * An organisation page's opening (decisions 2026-11-01): the headline and one CTA in 7 columns,
 * the page's proof objects in orbit in 5, gathering away as the story starts.
 */
export function OrgHero({
  headline,
  intro,
  orbit,
  orbitAlt,
  cta,
  aside,
}: {
  headline: string;
  intro: string;
  orbit: OrbitItem[];
  orbitAlt: string;
  cta: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section aria-labelledby="page-title" className="hero">
      <div className="mx-auto grid max-w-page gap-8 px-[var(--page-gutter)] pt-8 pb-4 sm:pt-12 lg:grid-cols-12 lg:gap-6 lg:pt-10">
        <div className="hero-copy flex flex-col gap-6 lg:col-span-7 lg:self-center lg:pb-16">
          <h1 id="page-title" className="text-hero max-w-[16ch] text-text-primary">
            {headline}
          </h1>
          <p className="max-w-[56ch] text-body-lg text-text-secondary">{intro}</p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            {cta}
            {aside}
          </div>
        </div>
        <div className="lg:col-span-5">
          <Orbit id="org-orbit" items={orbit} alt={orbitAlt} testId="org-orbit" />
        </div>
      </div>
    </section>
  );
}
