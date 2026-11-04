import { cn } from "@/lib/cn";

export const TIERS = ["raw", "spark", "flare", "shine", "radiant", "luminary"] as const;
export type Tier = (typeof TIERS)[number];

export const tierLabel: Record<Tier, string> = {
  raw: "Raw",
  spark: "Spark",
  flare: "Flare",
  shine: "Shine",
  radiant: "Radiant",
  luminary: "Luminary",
};

/** The step mark every tier wears: the ladder you climb (Ascent). */
function StepMark({ size = 12 }: { size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 12 12" className="shrink-0">
      <path d="M1 11h3V8h3V5h3V1" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * The raised tier object (the brief §2 "Tier ramp"): the same step shape for all six tiers; only
 * the finish changes, foil and glow for Radiant and Luminary alone. Ink text passes on every finish.
 */
export function TierFinish({ tier, name, size = "md", className }: { tier: Tier; name?: string; size?: "sm" | "md"; className?: string }) {
  return (
    <span
      className={cn(
        "tier-finish inline-flex items-center gap-1.5 rounded-[var(--r-tag)] font-semibold text-[#1b1b19]",
        `tier-finish-${tier}`,
        size === "sm" ? "h-6 px-2 text-[0.75rem]" : "h-8 px-3 text-[0.8125rem]",
        className,
      )}
    >
      <StepMark size={size === "sm" ? 10 : 12} />
      {name}
    </span>
  );
}

/** A tier badge with its name. In /ops (.classic) it keeps the PRD 9 outlined chip. */
export function TierBadge({ tier, size = "sm", className }: { tier: Tier; size?: "sm" | "md"; className?: string }) {
  return <TierFinish tier={tier} name={tierLabel[tier]} size={size} className={className} />;
}
