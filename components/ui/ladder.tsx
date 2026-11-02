import { Check } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type LadderState = "done" | "current" | "next" | "later";

export interface LadderStep {
  key: string;
  label: string;
  /** Mono evidence: "since 12 Oct", "3 of 5". */
  meta?: ReactNode;
  state: LadderState;
}

const STATE_LABEL: Record<LadderState, string> = { done: "done", current: "you are here", next: "next", later: "later" };

/**
 * Ascent drawn as countable steps (the brief §1 move 2, "Steps / terraces"): done squares are
 * filled, the current one is raised, the next is outlined in orange, later ones are pressed holes.
 * Each step says its state in words too, so nothing rests on depth or colour alone.
 */
export function Ladder({ steps, label, className }: { steps: LadderStep[]; label: string; className?: string }) {
  const done = steps.filter((s) => s.state === "done").length;
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <p className="neu-mono text-text-secondary">
        {done} of {steps.length} {label}
      </p>
      <ol className="flex flex-col-reverse gap-2" aria-label={label}>
        {steps.map((s, i) => (
          <li
            key={s.key}
            className={cn(
              "flex min-h-12 items-center gap-3 rounded-md px-3",
              s.state === "current" ? "neu-tile" : s.state === "later" ? "neu-well-s" : "border border-transparent",
            )}
            style={{ marginInlineStart: `${i * 0.75}rem` }}
            aria-current={s.state === "current" ? "step" : undefined}
          >
            <span
              aria-hidden
              className={cn(
                "inline-flex size-7 shrink-0 items-center justify-center rounded-[7px] font-mono text-[0.75rem]",
                s.state === "done" && "bg-primary text-text-on-primary",
                s.state === "current" && "bg-accent text-text-on-accent shadow-[var(--raised-s)]",
                s.state === "next" && "border-2 border-[var(--signal-ink)] text-[var(--signal-ink)]",
                s.state === "later" && "neu-well-s text-text-secondary",
              )}
            >
              {s.state === "done" ? <Check weight="bold" className="size-4" /> : i + 1}
            </span>
            <span className={cn("min-w-0 flex-1 font-semibold", s.state === "later" ? "text-text-secondary" : "text-text-primary")}>{s.label}</span>
            {s.meta ? <span className="neu-mono text-text-secondary">{s.meta}</span> : null}
            <span className="sr-only">({STATE_LABEL[s.state]})</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
