import { cn } from "@/lib/cn";

/**
 * Earned objects for the marketing pages (app/(marketing)/CLAUDE.md): the verified seal and the
 * tier badge. Decorative by default; pass `label` where the object carries meaning on its own.
 */

/** 18 points, notched: the outer radius alternates with a shallow inner one. */
const SEAL_PATH = (() => {
  const points: string[] = [];
  for (let i = 0; i < 36; i++) {
    const r = i % 2 === 0 ? 12 : 10.6;
    const a = (Math.PI * i) / 18 - Math.PI / 2;
    points.push(`${(12 + r * Math.cos(a)).toFixed(2)},${(12 + r * Math.sin(a)).toFixed(2)}`);
  }
  return `M${points.join("L")}Z`;
})();

export function Seal({ size = 28, label, className }: { size?: number; label?: string; className?: string }) {
  return (
    <span className={cn("neu-seal", className)} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <svg width={size} height={size} viewBox="0 0 24 24">
        <path d={SEAL_PATH} fill="var(--ink)" />
        <path d="M7.6 12.3l2.9 2.9 5.9-6" fill="none" stroke="var(--surface)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export type TierId = "raw" | "spark" | "flare" | "shine" | "radiant" | "luminary";

/** The same raised step-shape for all six tiers; only the finish changes. Ink text passes on every finish. */
export function TierBadge({ tier, name, size = "md", className }: { tier: TierId; name?: string; size?: "sm" | "md"; className?: string }) {
  return (
    <span
      className={cn(
        "tier-finish inline-flex items-center gap-1.5 rounded-[var(--r-tag)] font-semibold text-[#1b1b19]",
        `tier-finish-${tier}`,
        size === "sm" ? "h-7 px-2.5 text-[0.75rem]" : "h-9 px-3.5 text-[0.875rem]",
        className,
      )}
    >
      <svg aria-hidden width="12" height="12" viewBox="0 0 12 12" className="shrink-0">
        <path d="M1 11h3V8h3V5h3V1" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {name}
    </span>
  );
}
