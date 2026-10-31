import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** One landing section: the page's grid, its rhythm (80 px, 64 on dense sections) and a labelled region. */
export function Section({
  id,
  labelledBy,
  children,
  className,
  inner,
  dense = false,
  step,
}: {
  id?: string;
  labelledBy: string;
  children: ReactNode;
  className?: string;
  inner?: string;
  dense?: boolean;
  /** A mono ledger line above the content ("03 · Proof"): the page counted in steps. */
  step?: string;
}) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={className}>
      <div className={cn("mx-auto max-w-page px-[var(--page-gutter)]", dense ? "py-16" : "py-16 sm:py-20", inner)}>
        {step ? (
          <p aria-hidden className="neu-mono mb-5 flex items-center gap-3 text-text-secondary">
            <span className="h-px w-8 bg-border-strong" />
            {step}
          </p>
        ) : null}
        {children}
      </div>
    </section>
  );
}

/** A section heading: Grotesk (serif is kept for belief moments), the 36 px step of the scale. */
export function SectionHeading({ id, children, className }: { id: string; children: ReactNode; className?: string }) {
  return (
    <h2 id={id} className={cn("neu-h2 text-text-primary", className)}>
      {children}
    </h2>
  );
}
