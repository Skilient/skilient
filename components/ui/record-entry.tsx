import { WarningCircle } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Seal } from "./seal";

export type RecordEntryStatus = "sealed" | "signing" | "revoked" | "superseded";

/**
 * One line of The Record (PRD 5.30, screen spec §3.14 "My Record"): the issuer first, then what
 * happened, the date and the evidence, and the verify code in mono. A ledger row with hairlines:
 * sealed entries wear the seal; revoked and superseded say so in words. Phase 16 issues them.
 */
export function RecordEntry({
  issuer,
  title,
  date,
  evidence,
  code,
  status = "sealed",
  action,
  className,
}: {
  issuer: string;
  title: string;
  /** Already formatted. */
  date: string;
  evidence?: ReactNode;
  code?: string;
  status?: RecordEntryStatus;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <li className={cn("grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 border-b border-border-muted py-4 last:border-b-0", className)} data-testid="record-entry">
      <span className="row-span-3 pt-0.5">
        {status === "sealed" ? (
          <Seal size={28} label="Sealed" />
        ) : status === "revoked" ? (
          <WarningCircle aria-label="Revoked" role="img" weight="bold" className="size-7 text-error" />
        ) : (
          <span aria-hidden className="neu-hole inline-block size-7" />
        )}
      </span>
      <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-body-sm font-semibold text-text-secondary">
        {issuer}
        <time className="neu-mono">{date}</time>
      </p>
      <p className={cn("text-body font-semibold text-text-primary", status === "revoked" && "line-through decoration-1")}>{title}</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-text-secondary">
        {evidence}
        {code ? <span className="neu-mono">{code}</span> : null}
        {status === "signing" ? <span className="neu-mono">Signing…</span> : null}
        {status === "revoked" ? <span className="font-semibold text-text-error">Revoked</span> : null}
        {status === "superseded" ? <span className="font-semibold">Superseded</span> : null}
        {action ? <span className="ml-auto">{action}</span> : null}
      </div>
    </li>
  );
}
