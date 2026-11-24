"use client";

import { MagnifyingGlass } from "@phosphor-icons/react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";
import { Input } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { OpeningSort } from "@/lib/openings/constants";

function href(base: string, s: { sort: OpeningSort; matched: boolean; q: string }): string {
  const p = new URLSearchParams();
  if (s.sort !== "newest") p.set("sort", s.sort);
  if (s.matched) p.set("match", "1");
  if (s.q) p.set("q", s.q);
  const qs = p.toString();
  return qs ? `${base}?${qs}` : base;
}

const pill = (on: boolean) =>
  cn(
    "inline-flex h-10 items-center rounded-full px-4 text-body-sm font-semibold whitespace-nowrap transition-shadow duration-[140ms] ease-out",
    on ? "bg-bg-surface text-text-primary shadow-[var(--pressed-s)]" : "text-text-secondary shadow-[var(--raised-s)] hover:text-text-primary",
  );

/**
 * Category filters (PRD 5.34): search (250 ms after typing, into the URL so Back works), sort by
 * newest or deadline soonest, and "Matches my skills". Matches always come first either way.
 */
export function OpeningsFilters({ base, state, showMatch }: { base: string; state: { sort: OpeningSort; matched: boolean; q: string }; showMatch: boolean }) {
  const router = useRouter();
  const id = useId();
  const [q, setQ] = useState(state.q);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (q.trim() === state.q) return;
    const timer = setTimeout(() => {
      startTransition(() => router.replace(href(base, { ...state, q: q.trim() }) as Route, { scroll: false }));
    }, 250);
    return () => clearTimeout(timer);
  }, [q, state, base, router]);

  return (
    <div className="flex flex-col gap-3" data-testid="openings-filters">
      <form method="post" role="search" onSubmit={(e) => e.preventDefault()} className="relative">
        <label htmlFor={id} className="sr-only">
          Search these openings
        </label>
        <MagnifyingGlass aria-hidden className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-text-secondary" />
        <Input id={id} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title or host" maxLength={80} className="pl-10" />
      </form>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-body-sm text-text-secondary" id={`${id}-sort`}>
          Sort
        </span>
        <ul className="flex gap-2" aria-labelledby={`${id}-sort`}>
          <li>
            <Link href={href(base, { ...state, sort: "newest" }) as Route} aria-current={state.sort === "newest" ? "true" : undefined} className={pill(state.sort === "newest")} replace scroll={false}>
              Newest
            </Link>
          </li>
          <li>
            <Link href={href(base, { ...state, sort: "deadline" }) as Route} aria-current={state.sort === "deadline" ? "true" : undefined} className={pill(state.sort === "deadline")} replace scroll={false}>
              Deadline soonest
            </Link>
          </li>
        </ul>
        {showMatch ? (
          <Link
            href={href(base, { ...state, matched: !state.matched }) as Route}
            aria-pressed={state.matched}
            role="button"
            className={pill(state.matched)}
            replace
            scroll={false}
            data-testid="openings-match"
          >
            Matches my skills
          </Link>
        ) : null}
      </div>
    </div>
  );
}
