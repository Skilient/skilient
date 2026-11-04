import { Check } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/cn";

/**
 * Multi-step flows (the brief §4 laws 11 and 20): numbered levels, done ones ticked, the current one
 * raised, the rest pressed, and the remaining work said plainly ("2 steps left: Form, Review").
 */
export function Stepper({ steps, current, className }: { steps: string[]; current: number; className?: string }) {
  const left = steps.slice(current + 1);
  return (
    <nav aria-label="Progress" className={cn("flex flex-col gap-3", className)}>
      <ol className="flex flex-wrap items-center gap-2">
        {steps.map((label, i) => {
          const state = i < current ? "done" : i === current ? "current" : "later";
          return (
            <li key={label} className="flex items-center gap-2" aria-current={state === "current" ? "step" : undefined}>
              <span
                className={cn(
                  "inline-flex h-9 items-center gap-2 rounded-full pr-3.5 pl-1.5 text-body-sm font-semibold",
                  state === "current" ? "neu-chip text-text-primary" : state === "done" ? "text-text-primary" : "neu-well-s text-text-secondary",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "inline-flex size-6 items-center justify-center rounded-full font-mono text-[0.75rem]",
                    state === "done" ? "bg-primary text-text-on-primary" : state === "current" ? "bg-accent text-text-on-accent" : "text-text-secondary",
                  )}
                >
                  {state === "done" ? <Check weight="bold" className="size-3.5" /> : i + 1}
                </span>
                {label}
                <span className="sr-only">{state === "done" ? " (done)" : state === "current" ? " (current step)" : ""}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <p className="neu-mono text-text-secondary" data-testid="stepper-left">
        {left.length === 0 ? "Last step" : `${left.length} ${left.length === 1 ? "step" : "steps"} left: ${left.join(", ")}`}
      </p>
    </nav>
  );
}
