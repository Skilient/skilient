"use client";

import { MagnifyingGlass } from "@phosphor-icons/react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";
import { Input } from "@/components/ui";

/** Search the batch by name, username or department (into the URL after 250 ms). */
export function YearbookSearch({ initial }: { initial: string }) {
  const router = useRouter();
  const id = useId();
  const [q, setQ] = useState(initial);
  const [, startTransition] = useTransition();
  useEffect(() => {
    if (q.trim() === initial) return;
    const t = setTimeout(() => startTransition(() => router.replace((q.trim() ? `/yearbook?q=${encodeURIComponent(q.trim())}` : "/yearbook") as Route, { scroll: false })), 250);
    return () => clearTimeout(t);
  }, [q, initial, router]);
  return (
    <form method="post" role="search" onSubmit={(e) => e.preventDefault()} className="relative max-w-md">
      <label htmlFor={id} className="sr-only">
        Search your batch
      </label>
      <MagnifyingGlass aria-hidden className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-text-secondary" />
      <Input id={id} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or department" maxLength={60} className="pl-10" />
    </form>
  );
}
