import { badgeLabel } from "@/lib/nav";
import { cn } from "@/lib/cn";

/** The count on a nav item: text as well as colour. The link's own aria-label says "n unread". */
export function BadgePill({ count, className, testId, decorative = false }: { count: number; className?: string; testId?: string; decorative?: boolean }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn("min-w-5 rounded-full bg-primary px-1.5 text-center font-mono text-[0.6875rem] leading-5 font-medium text-text-on-primary tabular-nums", className)}
      data-testid={testId}
      aria-hidden={decorative || undefined}
    >
      {badgeLabel(count)}
    </span>
  );
}
