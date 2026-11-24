import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** Loading is a static well, not a pulse (the brief: nothing loops for its own sake). */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn("rounded-md bg-bg-surface shadow-[var(--pressed-s)]", className)} {...props} />;
}

/** Accessible loading block: skeleton lines plus a screen-reader status. */
export function LoadingState({ label = "Loading", lines = 3 }: { label?: string; lines?: number }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-3">
      <span className="sr-only">{label}…</span>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn("h-4", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}
