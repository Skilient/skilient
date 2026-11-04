import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Avatar } from "./avatar";
import type { DomainTone } from "./domain-card";
import type { Tier } from "./tier-badge";

export interface TrayMember {
  name: string;
  src?: string | null;
  tier?: Tier | null;
  role?: string | null;
}

const band: Record<DomainTone, string> = {
  signal: "bg-[var(--signal)]",
  jute: "bg-[var(--jute)]",
  mustard: "bg-[var(--mustard)]",
  tint: "bg-[var(--signal-tint)]",
  ink: "bg-[var(--ink)]",
  concrete: "bg-[var(--concrete)]",
};

/**
 * The team tray (Synergy): members overlap in one pressed tray, the lead in front, and every open
 * slot is a pressed hole you could fill. Says the count in words for screen readers.
 */
export function TeamTray({
  members,
  open = 0,
  extra = 0,
  className,
}: {
  members: TrayMember[];
  open?: number;
  /** Members on the team who aren't drawn (a list shows only the lead). */
  extra?: number;
  className?: string;
}) {
  const shown = members.slice(0, 6);
  const hidden = members.length - shown.length + extra;
  const total = members.length + extra;
  const holes = Math.min(open, 4);
  return (
    <div className={cn("neu-well-s inline-flex items-center gap-1 rounded-full p-1.5 pr-3", className)} data-testid="team-tray">
      <span className="flex items-center">
        {shown.map((m, i) => (
          <span key={`${m.name}-${i}`} className={cn("relative", i > 0 && "-ml-2")} style={{ zIndex: shown.length - i }} title={m.role ? `${m.name} · ${m.role}` : m.name}>
            <Avatar name={m.name} src={m.src} tier={m.tier} size="sm" />
          </span>
        ))}
        {hidden > 0 ? (
          <span aria-hidden className="relative -ml-2 inline-flex size-8 items-center justify-center rounded-full bg-bg-surface font-mono text-[0.6875rem] text-text-primary shadow-[var(--raised-s)]">
            +{hidden}
          </span>
        ) : null}
        {Array.from({ length: holes }, (_, i) => (
          <span key={`hole-${i}`} aria-hidden className="neu-hole ml-1 inline-block size-8 border border-dashed border-border-strong" />
        ))}
      </span>
      <span className="neu-mono ml-1 text-text-secondary">
        {total} in{open > 0 ? ` · ${open} open` : ""}
      </span>
    </div>
  );
}

/**
 * The venture card (the brief §3 "Cards"): the domain module plus a byline ("Name and N others"),
 * the team tray, a pinned highlight in a well, the last-activity time, and Join as the one primary.
 */
export function VentureCard({
  title,
  href,
  kind,
  tone = "signal",
  members,
  open = 0,
  extra = 0,
  highlight,
  lastActive,
  status,
  action,
  className,
}: {
  title: string;
  href: string;
  /** "Project", "Startup", ... */
  kind?: string;
  tone?: DomainTone;
  members: TrayMember[];
  open?: number;
  /** Team members beyond `members` (counted, not drawn). */
  extra?: number;
  highlight?: ReactNode;
  lastActive?: string;
  status?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const lead = members[0];
  const others = members.length - 1 + extra;
  const byline = lead ? (others > 0 ? `${lead.name} and ${others} ${others === 1 ? "other" : "others"}` : lead.name) : null;
  return (
    <article className={cn("neu-tile relative flex flex-col overflow-hidden", className)}>
      <span aria-hidden className={cn("h-2 w-full", band[tone])} />
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-2">
          {kind ? <span className="neu-mono text-text-secondary">{kind}</span> : null}
          {status}
        </div>
        <h3 className="text-h4 text-text-primary">
          <Link href={href as Route} className="underline-offset-4 hover:underline">
            {title}
          </Link>
        </h3>
        {byline ? <p className="text-body-sm text-text-secondary">{byline}</p> : null}
        <TeamTray members={members} open={open} extra={extra} />
        {highlight ? <div className="neu-well-s px-4 py-3 text-body-sm text-text-primary">{highlight}</div> : null}
        <div className="proof-line mt-auto justify-between">
          <span className="neu-mono text-text-secondary">{lastActive ?? ""}</span>
          {action}
        </div>
      </div>
    </article>
  );
}
