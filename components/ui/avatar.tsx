"use client";

import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn } from "@/lib/cn";
import { Seal } from "./seal";
import type { Tier } from "./tier-badge";

const sizes = {
  xs: { box: "size-7 text-[0.6875rem]", seal: 12 },
  sm: { box: "size-8 text-caption", seal: 14 },
  md: { box: "size-10 text-body-sm", seal: 16 },
  lg: { box: "size-16 text-h4", seal: 24 },
  xl: { box: "size-24 text-h2", seal: 28 },
} as const;

/** Ring and initials ground per tier (the brief: initials use the tier colour, never grey). */
const tierRing: Record<Tier, string> = {
  raw: "ring-tier-raw bg-[#e3cfa9]",
  spark: "ring-tier-spark bg-[#f2cdbd]",
  flare: "ring-tier-flare bg-[#f3b59c]",
  shine: "ring-tier-shine bg-[#ecd48a]",
  radiant: "ring-tier-radiant bg-[#f3d1ac]",
  luminary: "ring-tier-luminary bg-[#ddc7f0]",
};

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

/**
 * A person, raised (the brief §3 "Avatar"): a tier ring and a corner seal when verified. Teams
 * overlap with the lead in front (`AvatarStack`).
 */
export function Avatar({
  name,
  src,
  size = "md",
  tier,
  verified = false,
  className,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof sizes;
  tier?: Tier | null;
  verified?: boolean;
  className?: string;
}) {
  const s = sizes[size];
  return (
    <span className={cn("relative inline-flex shrink-0 align-middle", className)}>
      <AvatarPrimitive.Root
        className={cn(
          "inline-flex items-center justify-center overflow-hidden rounded-full bg-bg-muted shadow-[var(--chip-shadow)]",
          tier ? cn("ring-2 ring-offset-2 ring-offset-[var(--surface)]", tierRing[tier]) : "border border-[var(--card-border)]",
          s.box,
        )}
      >
        {src ? <AvatarPrimitive.Image src={src} alt={name} className="size-full object-cover" /> : null}
        <AvatarPrimitive.Fallback delayMs={src ? 300 : 0} className={cn("font-semibold", tier ? "text-[#1b1b19]" : "text-text-secondary")} aria-label={name}>
          {initials(name)}
        </AvatarPrimitive.Fallback>
      </AvatarPrimitive.Root>
      {verified ? <Seal size={s.seal} label="Verified" className="absolute -right-1 -bottom-1" /> : null}
    </span>
  );
}

/** Overlapping team avatars, the lead in front (Synergy). */
export function AvatarStack({
  people,
  max = 4,
  size = "sm",
  className,
}: {
  people: { name: string; src?: string | null; tier?: Tier | null }[];
  max?: number;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <span className={cn("flex items-center", className)}>
      {shown.map((p, i) => (
        <span key={`${p.name}-${i}`} className={cn("relative", i > 0 && "-ml-2.5")} style={{ zIndex: shown.length - i }}>
          <Avatar name={p.name} src={p.src} tier={p.tier} size={size} />
        </span>
      ))}
      {extra > 0 ? (
        <span className={cn("neu-hole -ml-2.5 inline-flex items-center justify-center font-semibold text-text-secondary", sizes[size].box)}>+{extra}</span>
      ) : null}
    </span>
  );
}
