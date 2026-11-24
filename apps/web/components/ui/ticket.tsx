import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Seal } from "./seal";

export type TicketStatus = "valid" | "checked_in" | "cancelled" | "waitlisted";

const STATUS: Record<TicketStatus, string> = {
  valid: "Valid",
  checked_in: "Checked in",
  cancelled: "Cancelled",
  waitlisted: "Waitlisted",
};

/**
 * A ticket object (screen spec §3.14 "Ticket"): the event and host on the stub, the date, sessions
 * and code in mono, a signed QR slot, and a perforation between them. Status is a word, never only
 * a colour. Phase 15 fills it with signed tickets; the object is shared now.
 */
export function Ticket({
  title,
  host,
  when,
  where,
  type,
  code,
  status = "valid",
  qr,
  className,
}: {
  title: string;
  host: string;
  /** Already formatted, e.g. "Sat 14 Nov · 16:00". */
  when: string;
  where?: string;
  type?: string;
  code: string;
  status?: TicketStatus;
  qr?: ReactNode;
  className?: string;
}) {
  return (
    <article className={cn("neu-card flex flex-col overflow-hidden sm:flex-row", status === "cancelled" && "opacity-80", className)} data-testid="ticket">
      <div className="flex flex-1 flex-col gap-3 p-5">
        <p className="flex items-center gap-2 text-body-sm font-semibold text-text-secondary">
          <Seal size={18} />
          {host}
        </p>
        <h3 className="text-h3 text-text-primary">{title}</h3>
        <dl className="neu-mono grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-text-secondary">
          <dt>When</dt>
          <dd className="text-text-primary">{when}</dd>
          {where ? (
            <>
              <dt>Where</dt>
              <dd className="text-text-primary">{where}</dd>
            </>
          ) : null}
          {type ? (
            <>
              <dt>Ticket</dt>
              <dd className="text-text-primary">{type}</dd>
            </>
          ) : null}
        </dl>
      </div>
      <div
        aria-hidden
        className="mx-5 border-t-2 border-dashed border-border-strong sm:mx-0 sm:my-5 sm:border-t-0 sm:border-l-2"
      />
      <div className="flex flex-col items-center justify-center gap-2 p-5 sm:w-44">
        <div className="neu-well-s flex size-28 items-center justify-center p-2">{qr ?? <span className="neu-mono text-text-secondary">QR</span>}</div>
        <p className="neu-mono text-text-primary">{code}</p>
        <p className={cn("text-body-sm font-semibold", status === "cancelled" ? "text-text-error" : "text-text-primary")}>{STATUS[status]}</p>
      </div>
    </article>
  );
}
