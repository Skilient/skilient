import { badgeLabel } from "@/lib/nav";
import { cn } from "@/lib/cn";

/**
 * The count on a nav item: text as well as colour. Icon-only links say "n unread" in their own aria-label;
 * a link with a visible label passes `srSuffix` instead, so its name starts with the words people see
 * (WCAG 2.5.3, axe label-content-name-mismatch).
 */
export function BadgePill({ count, className, testId, srSuffix }: { count: number; className?: string; testId?: string; srSuffix?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn("min-w-5 rounded-full bg-primary px-1.5 text-center font-mono text-[0.6875rem] leading-5 font-medium text-text-on-primary tabular-nums", className)}
      data-testid={testId}
    >
      {badgeLabel(count)}
      {srSuffix ? <span className="sr-only"> {srSuffix}</span> : null}
    </span>
  );
}
