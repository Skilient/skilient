import { ArrowLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";
import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Stepper } from "@/components/ui";
import { onboardingPath, ONBOARDING_STEPS } from "@/lib/auth/gate";
import { cn } from "@/lib/cn";

/** Step names as people read them (the stepper says what is left). */
const STEP_NAMES = ["University", "Profile", "GitHub", "Skills", "Looking for", "People"];

/** Rough minutes each step takes, for "about n min left" (GitHub is the long one; skills only explains). */
const STEP_MINUTES = [1, 1, 2, 0.5, 0.5, 1];

/** "about 3 min left", counting the step you are on. */
export function minutesLeft(step: number): string {
  const left = Math.max(1, Math.ceil(STEP_MINUTES.slice(step - 1).reduce((a, b) => a + b, 0)));
  return `about ${left} min left`;
}

/**
 * One step per screen (PRD 5.27, phase 14): numbered levels with the work left said plainly
 * ("2 steps left: Looking for, People") and how long it takes; Back always works. Since 2026-11-15
 * the profile the student is building shows beside the step (`preview`): a column on wide screens,
 * a fold-out strip above the step on narrow ones.
 */
export function WizardFrame({
  step,
  title,
  why,
  preview,
  children,
}: {
  step: number;
  title: string;
  why: string;
  preview?: ReactNode;
  children: ReactNode;
}) {
  const total = ONBOARDING_STEPS.length;
  return (
    <main className={cn("mx-auto flex w-full flex-col gap-6 px-[var(--page-gutter)] py-8 sm:py-12", preview ? "max-w-5xl" : "max-w-2xl")}>
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
          <span data-testid="wizard-progress">
            Step {step} of {total} <span aria-hidden>·</span> {minutesLeft(step)}
          </span>
        </div>
        <Stepper steps={STEP_NAMES.slice(0, total)} current={step - 1} className="hidden sm:flex" />
      </div>
      <div className={cn("flex flex-col gap-6", preview && "lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start")}>
        {preview ? (
          <details className="group neu-flat lg:hidden" data-testid="preview-strip">
            <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-2 px-4 text-body-sm font-semibold">
              See your profile so far
              <CaretRight aria-hidden weight="bold" className="size-4 text-text-muted transition-transform group-open:rotate-90 motion-reduce:transition-none" />
            </summary>
            <div className="px-1 pb-1 [&>section]:shadow-none">{preview}</div>
          </details>
        ) : null}
        {/* Keyed by step so each one rises in; no motion when the person prefers less. */}
        <div key={step} className="neu-card neu-rise p-6 sm:p-8">
          <h1 className="text-h2">{title}</h1>
          <p className="mt-2 text-body text-text-secondary">{why}</p>
          <div className="mt-6">{children}</div>
        </div>
        {preview ? <div className="hidden lg:sticky lg:top-6 lg:block">{preview}</div> : null}
      </div>
    </main>
  );
}
