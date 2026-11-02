import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** The band colours a domain may take: steps of the one palette, never a second accent hue. */
export type DomainTone = "signal" | "jute" | "mustard" | "tint" | "ink" | "concrete";

const band: Record<DomainTone, string> = {
  signal: "bg-[var(--signal)]",
  jute: "bg-[var(--jute)]",
  mustard: "bg-[var(--mustard)]",
  tint: "bg-[var(--signal-tint)]",
  ink: "bg-[var(--ink)]",
  concrete: "bg-[var(--concrete)]",
};

export interface DomainMeta {
  label: string;
  value: string | number;
}

/**
 * One module, many domains (the brief §1 move 7 and §3 "Domain card"): a colour band, a pictogram
 * in a raised well, the name, and mono metadata (members, open roles, updated). Only the colour and
 * the pictogram change between domains. The whole card is the link when `href` is given.
 */
export function DomainCard({
  name,
  tone = "signal",
  pictogram,
  meta = [],
  updated,
  href,
  children,
  className,
  headingLevel = 3,
}: {
  name: string;
  tone?: DomainTone;
  pictogram: ReactNode;
  meta?: DomainMeta[];
  /** A recency line in mono, such as "updated 2 h ago". */
  updated?: string;
  href?: string;
  children?: ReactNode;
  className?: string;
  headingLevel?: 2 | 3 | 4;
}) {
  const Heading = `h${headingLevel}` as "h2" | "h3" | "h4";
  return (
    <article className={cn("neu-tile relative flex flex-col overflow-hidden", className)}>
      <span aria-hidden className={cn("h-2 w-full", band[tone])} />
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-center gap-3">
          <span aria-hidden className="neu-icon-btn size-12 text-[var(--signal-ink)]">
            {pictogram}
          </span>
          <Heading className="min-w-0 text-h4 text-text-primary">
            {href ? (
              <Link href={href as Route} className="after:absolute after:inset-0 after:rounded-[inherit] after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-focus-ring">
                {name}
              </Link>
            ) : (
              name
            )}
          </Heading>
        </div>
        {children}
        {meta.length || updated ? (
          <dl className="proof-line neu-mono mt-auto flex-wrap gap-x-4 gap-y-1 text-text-secondary">
            {meta.map((m) => (
              <div key={m.label} className="flex gap-1">
                <dt>{m.label}</dt>
                <dd className="text-text-primary">{m.value}</dd>
              </div>
            ))}
            {updated ? (
              <div className="ml-auto">
                <dt className="sr-only">Updated</dt>
                <dd>{updated}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}
      </div>
    </article>
  );
}
