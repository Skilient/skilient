"use client";

import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCurrentUser } from "@/components/providers/current-user-provider";
import { BadgePill } from "@/components/shell/badge-pill";
import { useNavBadges } from "@/components/shell/nav-badges";
import { Avatar, Tooltip } from "@/components/ui";
import { cn } from "@/lib/cn";
import { activeLevel, currentPlace, isActive, PRIMARY_NAV, SECONDARY_NAV, type NavItem } from "@/lib/nav";

/** One place on the rail: raised at rest, pressed in when you are there (with a filled icon and a label change). */
function RailLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const badges = useNavBadges();
  const count = item.badge ? badges[item.badge] : 0;
  const active = isActive(item, pathname);
  const Icon = item.icon;
  return (
    <li>
      <Tooltip label={item.label} description={item.description} placement="right" className="block">
        <Link
          href={item.href as Route}
          aria-current={active ? "page" : undefined}
          aria-label={count > 0 ? `${item.label}, ${count} ${item.badge === "notifications" || item.badge === "chat" ? "unread" : "waiting"}` : item.label}
          data-tour={`nav-${item.key}`}
          data-testid={`nav-${item.key}`}
          className={cn(
            "relative flex size-12 flex-col items-center justify-center rounded-[14px] transition-shadow duration-[140ms] ease-out",
            active ? "bg-bg-surface text-[var(--signal-ink)] shadow-[var(--pressed)]" : "text-text-secondary shadow-[var(--raised-s)] hover:text-text-primary",
          )}
        >
          <Icon aria-hidden weight={active ? "fill" : "bold"} className="size-6 shrink-0" />
          <BadgePill
            count={count}
            className="absolute -top-1.5 -right-1.5"
            testId={item.key === "notifications" ? "notification-count" : `${item.key}-badge`}
          />
        </Link>
      </Tooltip>
    </li>
  );
}

/**
 * The two-tier sidebar (the brief §3 "Shell", phase 14): a raised rail of places (72 px, also the
 * tablet's whole sidebar) plus, from 1024 px, the levels inside the place you are in. Hidden on
 * phones, which get the dock.
 */
export function Sidebar() {
  const user = useCurrentUser();
  const pathname = usePathname();
  const place = currentPlace(pathname);
  const level = place ? activeLevel(place, pathname) : null;
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden md:flex" aria-label="Sidebar">
      <div className="flex w-[76px] flex-col items-center gap-4 bg-bg-surface py-4 shadow-[var(--raised-m)]">
        <Link href="/feed" aria-label="Skilient home" className="flex size-11 items-center justify-center rounded-full">
          <Image src="/brand/skilient-icon.svg" alt="" width={28} height={28} className="size-7 dark:hidden" />
          <Image src="/brand/skilient-icon-white.svg" alt="" width={28} height={28} className="hidden size-7 dark:block" />
        </Link>
        <nav aria-label="Main" className="flex min-h-0 flex-1 flex-col items-center gap-4 overflow-y-auto px-2 pt-1 pb-2">
          <ul className="flex flex-col gap-3">
            {PRIMARY_NAV.map((item) => (
              <RailLink key={item.key} item={item} pathname={pathname} />
            ))}
          </ul>
          <span aria-hidden className="neu-hole h-1 w-8 shrink-0" />
          <ul className="flex flex-col gap-3">
            {SECONDARY_NAV.map((item) => (
              <RailLink key={item.key} item={item} pathname={pathname} />
            ))}
          </ul>
        </nav>
      </div>
      <div className="hidden w-[208px] flex-col gap-4 px-4 py-5 lg:flex" data-testid="sidebar-levels">
        {place ? (
          <>
            <p className="px-2 text-h4 text-text-primary">{place.label}</p>
            {place.levels?.length ? (
              <nav aria-label={`${place.label} sections`}>
                <ul className="flex flex-col gap-1">
                  {place.levels.map((l) => {
                    const on = l === level;
                    return (
                      <li key={l.href + l.label}>
                        <Link
                          href={l.href as Route}
                          aria-current={on ? "page" : undefined}
                          className={cn(
                            "flex min-h-11 items-center rounded-[12px] px-3 text-body font-semibold transition-shadow duration-[140ms] ease-out",
                            on ? "bg-bg-surface text-text-primary shadow-[var(--pressed-s)]" : "text-text-secondary hover:text-text-primary hover:shadow-[var(--raised-s)]",
                          )}
                        >
                          {on ? <span aria-hidden className="mr-2 h-4 w-1 rounded-full bg-primary" /> : null}
                          {l.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            ) : (
              <p className="px-2 text-body-sm text-text-secondary">{place.description}</p>
            )}
          </>
        ) : null}
        {user ? (
          <Link
            href={(user.username ? `/profile/${user.username}` : "/me") as Route}
            className="mt-auto flex items-center gap-2 rounded-[14px] p-2 hover:shadow-[var(--raised-s)]"
            aria-label={`${user.fullName}, your profile`}
          >
            <Avatar name={user.fullName} src={user.avatarUrl} size="sm" />
            <span className="max-w-[14ch] truncate text-body-sm font-semibold" data-testid="current-user-name">
              {user.fullName}
            </span>
          </Link>
        ) : null}
      </div>
    </aside>
  );
}
