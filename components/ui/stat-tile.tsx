import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * A dashboard stat (the brief §3 "Shell"): one big number per tile in tabular mono, its label above
 * and its evidence below (source, date or change). Never rounded up (Proof).
 */
export function StatTile({
  label,
  value,
  unit,
  hint,
  icon,
  className,
  testId,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  /** The evidence or the change, in mono: "+3 this week", "from GitHub · 12 Oct". */
  hint?: ReactNode;
  icon?: ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <div className={cn("neu-tile flex flex-col gap-2 p-4 sm:p-5", className)} data-testid={testId}>
      <p className="flex items-center gap-2 text-body-sm font-semibold text-text-secondary">
        {icon ? <span aria-hidden className="text-[var(--signal-ink)]">{icon}</span> : null}
        {label}
      </p>
      <p className="flex items-baseline gap-1.5">
        <span className="font-mono text-[1.75rem] leading-none font-medium text-text-primary tabular-nums">{value}</span>
        {unit ? <span className="text-body-sm text-text-secondary">{unit}</span> : null}
      </p>
      {hint ? <p className="neu-mono text-text-secondary">{hint}</p> : null}
    </div>
  );
}
