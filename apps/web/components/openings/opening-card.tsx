import {
  Briefcase,
  CalendarBlank,
  EnvelopeSimple,
  Flag,
  Lightbulb,
  ListChecks,
  Path,
  Pulse,
  RocketLaunch,
  Storefront,
  Swap,
  Trophy,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ObjectImage } from "@/components/marketing/story/object-image";
import { buttonClass, DomainCard, Skeleton } from "@/components/ui";
import type { ObjectName } from "@/lib/marketing/objects";
import { CATEGORY_META, categoryHref, type OpeningCategory, type Pictogram } from "@/lib/openings/constants";

const ICONS: Record<Pictogram, ReactNode> = {
  rocket: <RocketLaunch weight="bold" className="size-6" />,
  flag: <Flag weight="bold" className="size-6" />,
  calendar: <CalendarBlank weight="bold" className="size-6" />,
  bulb: <Lightbulb weight="bold" className="size-6" />,
  path: <Path weight="bold" className="size-6" />,
  swap: <Swap weight="bold" className="size-6" />,
  pulse: <Pulse weight="bold" className="size-6" />,
  briefcase: <Briefcase weight="bold" className="size-6" />,
  envelope: <EnvelopeSimple weight="bold" className="size-6" />,
  list: <ListChecks weight="bold" className="size-6" />,
  trophy: <Trophy weight="bold" className="size-6" />,
  booth: <Storefront weight="bold" className="size-6" />,
};

/** The render an empty card shows (earned moments only; never in navigation). */
const RENDERS: Record<OpeningCategory, ObjectName> = {
  venture_roles: "tray",
  inductions: "campus",
  events: "ticket",
  ideas: "bulb",
  paths: "terraces",
  swaps: "chai",
  this_week: "page",
  jobs: "letter",
  contact_requests: "envelope",
  applications: "page",
  competitions: "medallion-flare",
  job_fairs: "booth",
};

/** A card action: never wider than its card, and a long label wraps instead of being cut off. */
const ACTION = "relative z-10 h-auto min-h-10 max-w-full shrink self-start py-2 text-left whitespace-normal";

export function OpeningIcon({ category }: { category: OpeningCategory }) {
  return <>{ICONS[CATEGORY_META[category].pictogram]}</>;
}

/**
 * One Openings card (PRD 5.34, screen spec 3.14): colour band, pictogram, the latest opening (title,
 * host, deadline in mono), the count, when it last changed, and a dot when something is new since the
 * student last opened the category. Empty: a render, one honest line and one action.
 */
export function OpeningCard({
  category,
  count,
  updatedLabel,
  isNew,
  latest,
  emptyLine,
  wide = false,
  className,
}: {
  category: OpeningCategory;
  count: number;
  updatedLabel: string | null;
  isNew: boolean;
  latest: { title: string; host: string | null; deadlineLabel: string | null; href: string } | null;
  emptyLine: string;
  /** The full-width banner (This week): the action sits beside the line when there is room. */
  wide?: boolean;
  className?: string;
}) {
  const meta = CATEGORY_META[category];
  const href = categoryHref(category);
  const empty = count === 0 || !latest;
  return (
    <div className={className} data-testid={`opening-card-${category}`} data-state={empty ? "empty" : "ready"}>
      <DomainCard
        name={meta.label}
        tone={meta.tone}
        pictogram={ICONS[meta.pictogram]}
        href={href}
        className="h-full"
        meta={empty ? [] : [{ label: category === "this_week" ? "items" : "open", value: count }]}
        updated={empty ? undefined : (updatedLabel ?? undefined)}
      >
        {isNew && !empty ? (
          <span className="absolute top-5 right-5 flex items-center gap-1.5 text-caption font-semibold text-[var(--signal-ink)]" data-testid="opening-new">
            <span aria-hidden className="size-2 rounded-full bg-[var(--signal)]" />
            New
          </span>
        ) : null}
        {empty ? (
          // The line may wrap and the action sits on its own row: a nowrap button beside the text
          // pushed the column wider than the card and got cut off (2026-11-15).
          <div className={wide ? "flex flex-wrap items-center gap-x-6 gap-y-3" : "flex flex-col gap-3"}>
            <div className={wide ? "flex min-w-0 flex-1 basis-64 items-center gap-3" : "flex min-w-0 items-center gap-3"}>
              <span className="block w-14 shrink-0" aria-hidden>
                <ObjectImage name={RENDERS[category]} sizes="56px" />
              </span>
              <p className="min-w-0 flex-1 text-body-sm text-text-secondary" data-testid="opening-empty">
                {emptyLine}
              </p>
            </div>
            {/* Above the card's stretched link so it stays its own target. */}
            <Link href={meta.action.href as Route} className={buttonClass("secondary", "sm", ACTION)}>
              {meta.action.label}
            </Link>
          </div>
        ) : (
          <div className="flex min-w-0 flex-col gap-1">
            <p className="line-clamp-2 text-body font-semibold break-words text-text-primary" data-testid="opening-latest">
              {latest.title}
            </p>
            {latest.host ? <p className="truncate text-body-sm text-text-secondary">{latest.host}</p> : null}
            {latest.deadlineLabel ? <p className="neu-mono text-caption text-text-secondary">{latest.deadlineLabel}</p> : null}
          </div>
        )}
      </DomainCard>
    </div>
  );
}

/** Loading: the same card shape with static wells. */
export function OpeningCardSkeleton({ category, className }: { category: OpeningCategory; className?: string }) {
  const meta = CATEGORY_META[category];
  return (
    <div className={className} data-testid={`opening-card-${category}`} data-state="loading">
      <DomainCard name={meta.label} tone={meta.tone} pictogram={ICONS[meta.pictogram]} className="h-full">
        <div className="flex flex-col gap-2" aria-hidden>
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </DomainCard>
    </div>
  );
}

/** Error: what failed, and a way to retry (the category page loads on its own). */
export function OpeningCardError({ category, className }: { category: OpeningCategory; className?: string }) {
  const meta = CATEGORY_META[category];
  return (
    <div className={className} data-testid={`opening-card-${category}`} data-state="error">
      <DomainCard name={meta.label} tone={meta.tone} pictogram={ICONS[meta.pictogram]} className="h-full">
        <div className="flex flex-col items-start gap-2">
          <p className="flex items-center gap-2 text-body-sm text-text-error">
            <WarningCircle aria-hidden weight="bold" className="size-4" />
            This card didn&apos;t load.
          </p>
          <Link href={categoryHref(category) as Route} className={buttonClass("secondary", "sm", ACTION)}>
            Open {meta.label}
          </Link>
        </div>
      </DomainCard>
    </div>
  );
}
