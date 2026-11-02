"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface CommandItem {
  key: string;
  label: string;
  /** One line under the label (the nav tooltip text). */
  description?: string;
  href: string;
  group: string;
  icon?: ReactNode;
  /** Extra words that should match ("cv", "rank"). */
  keywords?: string[];
}

const noop = () => () => {};

function matches(item: CommandItem, query: string): boolean {
  if (!query) return true;
  const haystack = [item.label, item.description ?? "", item.group, ...(item.keywords ?? [])].join(" ").toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

/**
 * The command menu (the brief §3 "Overlays", §4 law 18): ⌘K or Ctrl+K from anywhere, or the search
 * well in the header. Type to filter, arrows to move, Enter to go. A Radix dialog, so focus is
 * trapped and Escape closes it. Explore holds the real search; the menu's last row hands off to it.
 */
export function CommandMenu({ items, searchHref = "/explore", className }: { items: CommandItem[]; searchHref?: string; className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const isMac = useSyncExternalStore(
    noop,
    () => /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent),
    () => true,
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    // A label that starts with the words beats one that contains them, which beats a description match.
    const rank = (i: CommandItem) => (!q ? 0 : i.label.toLowerCase().startsWith(q) ? 0 : i.label.toLowerCase().includes(q) ? 1 : 2);
    const found = items
      .filter((i) => matches(i, q))
      .map((item, index) => ({ item, index, r: rank(item) }))
      .sort((a, b) => a.r - b.r || a.index - b.index)
      .map((x) => x.item);
    const search: CommandItem[] = query.trim()
      ? [{ key: "search", label: `Search for “${query.trim()}”`, description: "People, ventures and skills in Explore", href: `${searchHref}?q=${encodeURIComponent(query.trim())}`, group: "Search" }]
      : [];
    return [...found, ...search];
  }, [items, query, searchHref]);

  const go = (item: CommandItem | undefined) => {
    if (!item) return;
    setOpen(false);
    setQuery("");
    router.push(item.href as Route);
  };

  // Grouped by place while browsing; one ranked list while searching, so the arrows follow what you see.
  const searching = query.trim().length > 0;
  const groups = results.reduce<Record<string, { item: CommandItem; index: number }[]>>((acc, item, index) => {
    (acc[searching ? "Results" : item.group] ??= []).push({ item, index });
    return acc;
  }, {});

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery("");
        setActive(0);
      }}
    >
      <DialogPrimitive.Trigger
        className={cn(
          "neu-well flex h-11 w-full min-w-0 items-center gap-2 rounded-full px-4 text-left text-body text-text-secondary",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
          className,
        )}
        data-testid="command-trigger"
      >
        <MagnifyingGlass aria-hidden weight="bold" className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">Search or jump to…</span>
        <kbd className="neu-mono hidden rounded-[6px] px-1.5 py-0.5 shadow-[var(--raised-s)] sm:inline">{isMac ? "⌘K" : "Ctrl K"}</kbd>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[var(--scrim)] backdrop-blur-[6px]" />
        <DialogPrimitive.Content
          className="fixed top-[12dvh] left-1/2 z-50 flex max-h-[70dvh] w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 flex-col overflow-hidden rounded-xl bg-bg-elevated shadow-4"
          aria-describedby={undefined}
          data-testid="command-menu"
        >
          <DialogPrimitive.Title className="sr-only">Go to</DialogPrimitive.Title>
          <div className="p-4">
            <label htmlFor={`${listId}-input`} className="sr-only">
              Search or jump to
            </label>
            <div className="neu-well flex h-12 items-center gap-2 rounded-full px-4">
              <MagnifyingGlass aria-hidden weight="bold" className="size-4 shrink-0 text-text-secondary" />
              <input
                id={`${listId}-input`}
                role="combobox"
                aria-expanded="true"
                aria-controls={listId}
                aria-activedescendant={results[active] ? `${listId}-${results[active].key}` : undefined}
                autoComplete="off"
                value={query}
                placeholder="Search or jump to…"
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActive((a) => Math.min(a + 1, results.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActive((a) => Math.max(a - 1, 0));
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    go(results[active]);
                  }
                }}
                className="h-full min-w-0 flex-1 bg-transparent text-body text-text-primary outline-none placeholder:text-text-secondary"
              />
            </div>
          </div>
          {results.length === 0 ? (
            <p role="status" className="px-3 py-6 text-center text-body-sm text-text-secondary">
              Nothing matches. Try another word.
            </p>
          ) : null}
          <div id={listId} role="listbox" aria-label="Places" className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
            {Object.entries(groups).map(([group, rows]) => (
                <div key={group} role="group" aria-label={group}>
                  <p aria-hidden className="neu-mono px-3 pt-3 pb-1 text-text-secondary">
                    {group}
                  </p>
                  {rows.map(({ item, index }) => (
                    <div
                      key={item.key}
                      id={`${listId}-${item.key}`}
                      role="option"
                      aria-selected={index === active}
                      tabIndex={-1}
                      onMouseMove={() => setActive(index)}
                      onClick={() => go(item)}
                      className={cn(
                        "flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-3 py-2",
                        index === active ? "bg-bg-surface text-text-primary shadow-[var(--raised-s)]" : "text-text-primary",
                      )}
                    >
                      {item.icon ? <span aria-hidden className="text-text-secondary">{item.icon}</span> : null}
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{item.label}</span>
                        {item.description ? <span className="block truncate text-body-sm text-text-secondary">{item.description}</span> : null}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
