"use client";

import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import { Dialog, DialogTrigger, SheetContent, TierBadge } from "@/components/ui";
import type { Tier } from "@/components/ui/tier-badge";

/**
 * "Your progress" where the feed has no room for its column (2026-11-15): one raised row above
 * the feed with the tier and the next step, opening the full card (`children`, rendered on the
 * server) in a sheet. The page hides it when the column shows.
 */
export function ProgressChip({ tier, next, todo, children }: { tier: Tier | null; next: string; todo: number; children: ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="neu-tile flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left transition-shadow duration-[140ms] ease-out active:shadow-[var(--pressed)]"
          data-tour="progress"
          data-testid="progress-chip"
        >
          <span className="shrink-0">{tier ? <TierBadge tier={tier} /> : <span className="text-body-sm font-semibold">Your progress</span>}</span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-label text-text-secondary uppercase">Next step</span>
            <span className="truncate text-body-sm font-semibold text-text-primary">{next}</span>
          </span>
          {todo > 0 ? <span className="shrink-0 font-mono text-caption text-text-secondary tabular-nums">{todo} to do</span> : null}
          <CaretRight aria-hidden weight="bold" className="size-4 shrink-0 text-text-muted" />
        </button>
      </DialogTrigger>
      <SheetContent title="Your progress">{children}</SheetContent>
    </Dialog>
  );
}
