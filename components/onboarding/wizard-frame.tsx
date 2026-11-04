import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Stepper } from "@/components/ui";
import { onboardingPath, ONBOARDING_STEPS } from "@/lib/auth/gate";

/** Step names as people read them (the stepper says what is left). */
const STEP_NAMES = ["University", "Profile", "GitHub", "Skills", "Looking for", "People"];

/**
 * One step per screen (PRD 5.27, phase 14): numbered levels with the work left said plainly
 * ("2 steps left: Looking for, People"); Back always works.
 */
export function WizardFrame({
  step,
  title,
  why,
  children,
}: {
  step: number;
  title: string;
  why: string;
  children: ReactNode;
}) {
  const total = ONBOARDING_STEPS.length;
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-[var(--page-gutter)] py-8 sm:py-12">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between text-body-sm text-text-secondary">
          {step > 1 ? (
            <Link href={onboardingPath(step - 1) as Route} className="neu-btn-3 text-text-primary">
              <ArrowLeft aria-hidden weight="bold" className="size-4" />
              Back
            </Link>
          ) : (
            <span />
          )}
          <span>
            Step {step} of {total}
          </span>
        </div>
        <Stepper steps={STEP_NAMES.slice(0, total)} current={step - 1} className="hidden sm:flex" />
      </div>
      <div className="neu-card p-6 sm:p-8">
        <h1 className="text-h2">{title}</h1>
        <p className="mt-2 text-body text-text-secondary">{why}</p>
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}
