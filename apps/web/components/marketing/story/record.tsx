import { Check } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import { story, verifiedCv } from "@/content/marketing";
import { cn } from "@/lib/cn";
import type { ObjectName } from "@/lib/marketing/objects";
import { formatCode } from "@/supabase/functions/_shared/cv/sign.ts";
import { Seal, TierBadge } from "../neu";
import { ObjectImage } from "./object-image";

const r = story.record;

/** The proof object that lands in a row, small, as the row's icon. */
function RowIcon({ name }: { name: ObjectName }) {
  return (
    <span aria-hidden className="rec-icon">
      <ObjectImage name={name} />
    </span>
  );
}

/**
 * One row of Ayesha's record. On the stage it starts as a pressed well saying what it waits for
 * ("the first square to fill"), and its filled layer arrives when that chapter's object docks.
 * Without motion only the filled layer shows.
 */
export function RecordRow({
  row,
  icon,
  waiting,
  children,
  className,
}: {
  row: "identity" | "skills" | "project" | "endorse" | "sign";
  icon: ObjectName | "seal";
  waiting: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rec-row", `rec-${row}`, className)}>
      <div aria-hidden className="rec-wait neu-well-s">
        <span className="neu-mono">{waiting}</span>
      </div>
      <div className="rec-fill">
        {icon === "seal" ? (
          <span aria-hidden className="rec-icon rec-icon-seal">
            <Seal size={30} />
          </span>
        ) : (
          <RowIcon name={icon} />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">{children}</div>
      </div>
    </div>
  );
}

/** The tier on the identity row; on the stage Raw gives way to Spark, then Flare. */
function TierSwap({ upTo }: { upTo: "raw" | "spark" | "flare" }) {
  const shown = r.tiers.slice(0, r.tiers.findIndex((t) => t.id === upTo) + 1);
  return (
    <span className="rec-tiers">
      {shown.map((t) => (
        <span key={t.id} className={cn("rec-tier", `rec-tier-${t.id}`)}>
          <TierBadge tier={t.id} name={t.name} size="sm" />
          <span className="neu-mono text-text-secondary">{t.line}</span>
        </span>
      ))}
      <span aria-hidden className="rec-light" />
    </span>
  );
}

export function IdentityRow({ upTo = "flare", className }: { upTo?: "raw" | "spark" | "flare"; className?: string }) {
  return (
    <RecordRow row="identity" icon="envelope" waiting="Waiting for a university email" className={className}>
      <span className="flex items-center gap-1.5 text-body-sm font-semibold">
        <Check aria-hidden weight="bold" className="size-3.5 text-[var(--signal-ink)]" />
        University email verified
      </span>
      <TierSwap upTo={upTo} />
    </RecordRow>
  );
}

export function SkillsRow({ className }: { className?: string }) {
  return (
    <RecordRow row="skills" icon="commit" waiting="Waiting for code" className={className}>
      {r.skills.map((s) => (
        <span key={s.name} className="flex items-baseline justify-between gap-3">
          <span className="text-body-sm font-semibold">{s.name}</span>
          <span className="neu-mono text-text-secondary">{s.evidence}</span>
        </span>
      ))}
    </RecordRow>
  );
}

export function ProjectRow({ className }: { className?: string }) {
  return (
    <RecordRow row="project" icon="tray" waiting="Waiting for a team" className={className}>
      <span className="text-body-sm font-semibold">{r.project.title}</span>
      <span className="neu-mono text-text-secondary">{r.project.line}</span>
      <span className="rec-post neu-mono mt-1 inline-flex items-center gap-1.5 self-start">
        <span className="inline-grid size-4 place-items-center rounded-full bg-[var(--signal)] text-[#1b1b19]">
          <Check aria-hidden weight="bold" className="size-2.5" />
        </span>
        {r.post.informative} · {r.post.count}
      </span>
    </RecordRow>
  );
}

export function EndorseRow({ className }: { className?: string }) {
  return (
    <RecordRow row="endorse" icon="rosette" waiting="Waiting for confirmations" className={className}>
      <span className="text-body-sm font-semibold">{r.endorsement.line}</span>
      <span className="neu-mono text-text-secondary">{r.endorsement.meta}</span>
    </RecordRow>
  );
}

export function SignRow({ className }: { className?: string }) {
  return (
    <RecordRow row="sign" icon="seal" waiting="Waiting for a signature" className={className}>
      <span className="neu-mono text-body-sm font-semibold text-text-primary">{formatCode(verifiedCv.sampleCode)}</span>
      <span className="neu-mono text-text-secondary">{r.signed}</span>
    </RecordRow>
  );
}

/** The record's head: the person first (Recognition), then context, labelled a sample. */
export function RecordHead() {
  return (
    <div className="rec-head">
      <span aria-hidden className="rec-avatar tier-finish tier-finish-flare">
        {story.person.initials}
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="flex items-center gap-1.5 text-body font-semibold">
          {story.person.name}
          <span className="rec-head-seal">
            <Seal size={18} />
          </span>
        </span>
        <span className="text-[0.8125rem] leading-snug text-text-secondary">{story.person.context}</span>
      </div>
      <span className="neu-mono rec-sample">{story.sample}</span>
    </div>
  );
}

/**
 * Ayesha's whole record (the stage on desktop). Decorative: every line on it is also in the
 * chapter text, so it is hidden from assistive tech and the chapters carry the story.
 */
export function Record({ children, className, part }: { children?: ReactNode; className?: string; part: "a" | "b" }) {
  return (
    <div aria-hidden className={cn("record neu-card", `record-${part}`, className)}>
      <RecordHead />
      <IdentityRow />
      <SkillsRow />
      <ProjectRow />
      <EndorseRow />
      <SignRow />
      {children}
    </div>
  );
}
