"use client";

import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { useCurrentUser } from "@/components/providers/current-user-provider";
import { BadgePill } from "@/components/shell/badge-pill";
import { useNavBadges } from "@/components/shell/nav-badges";
import { Avatar, Tooltip } from "@/components/ui";
import { cn } from "@/lib/cn";
import { activeLevel, currentPlace, isActive, levelGroups, PRIMARY_NAV, SECONDARY_NAV, type NavItem, type NavLevel } from "@/lib/nav";

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
            "relative flex size-12 flex-col items-center [@media(max-height:880px)]:size-10 justify-center rounded-[14px] transition-shadow duration-[140ms] ease-out",
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

/** One group of levels under its heading (or a bare list when the place has no groups). */
function LevelGroup({ id, heading, levels, active }: { id: string; heading: string | null; levels: NavLevel[]; active: NavLevel | null }) {
  const badges = useNavBadges();
  return (
    <div className="flex flex-col gap-1">
      {heading ? (
        <p id={id} className="px-3 pt-1 text-label text-text-secondary uppercase">
          {heading}
        </p>
      ) : null}
      <ul aria-labelledby={heading ? id : undefined} className="flex flex-col gap-0.5">
        {levels.map((l) => {
          const on = l === active;
          const count = l.badge ? badges[l.badge] : 0;
          return (
            <li key={l.href + l.label}>
              <Link
                href={l.href as Route}
                aria-current={on ? "page" : undefined}
                className={cn(
                  // Short laptop screens get tighter rows, so Me's ten levels fit without scrolling the panel.
                  "flex min-h-10 items-center gap-2 rounded-[12px] px-3 text-body-sm font-semibold transition-shadow duration-[140ms] ease-out [@media(max-height:880px)]:min-h-8",
                  on ? "bg-bg-surface text-text-primary shadow-[var(--pressed-s)]" : "text-text-secondary hover:text-text-primary hover:shadow-[var(--raised-s)]",
                )}
              >
                {on ? <span aria-hidden className="h-4 w-1 shrink-0 rounded-full bg-primary" /> : null}
                <span className="min-w-0 flex-1 truncate">{l.label}</span>
                <BadgePill count={count} srSuffix={l.badge === "chat" ? "unread" : l.badge === "openings" ? "new" : "waiting"} />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
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
      {/* Short laptop screens (≤ 880 px tall) get 40 px buttons and tighter gaps, so all 13 fit without a cut-off
          last item (design gates 2026-11-04); the list still scrolls below that. */}
      <div className="flex w-[76px] flex-col items-center gap-4 bg-bg-surface py-4 [@media(max-height:880px)]:gap-2 [@media(max-height:880px)]:py-3 shadow-[var(--raised-m)]">
        <Link href="/feed" aria-label="Skilient home" className="flex size-11 items-center justify-center rounded-full">
          <Image src="/brand/skilient-icon.svg" alt="" width={28} height={28} className="size-7 dark:hidden" />
          <Image src="/brand/skilient-icon-white.svg" alt="" width={28} height={28} className="hidden size-7 dark:block" />
        </Link>
        <nav aria-label="Main" className="flex min-h-0 flex-1 flex-col items-center gap-4 overflow-y-auto [@media(max-height:880px)]:gap-2 px-2 pt-1 pb-2">
          <ul className="flex flex-col gap-3 [@media(max-height:880px)]:gap-2">
            {PRIMARY_NAV.map((item) => (
              <RailLink key={item.key} item={item} pathname={pathname} />
            ))}
          </ul>
          <span aria-hidden className="neu-hole h-1 w-8 shrink-0" />
          <ul className="flex flex-col gap-3 [@media(max-height:880px)]:gap-2">
            {SECONDARY_NAV.map((item) => (
              <RailLink key={item.key} item={item} pathname={pathname} />
            ))}
          </ul>
        </nav>
      </div>
      <div className="hidden w-[208px] flex-col gap-4 px-3 py-4 lg:flex" data-testid="sidebar-levels">
        {place ? (
          // One panel for the place you are in: its name, what it is for, then its levels under
          // headings (2026-11-15: a bare list beside the rail read as stranded).
          <div className="neu-flat flex min-h-0 flex-col gap-3 overflow-y-auto p-3" data-tour="sidebar-levels">
            <div className="flex flex-col gap-1 px-2 pt-1">
              <p className="text-h4 text-text-primary">{place.label}</p>
              <p className="text-caption text-text-secondary">{place.description}</p>
            </div>
            {place.levels?.length ? (
              <nav aria-label={`${place.label} sections`} className="flex flex-col gap-3 [@media(max-height:880px)]:gap-1.5">
                {levelGroups(place).map((group, i) => (
                  <LevelGroup key={group.heading ?? i} id={`levels-${place.key}-${i}`} heading={group.heading} levels={group.levels} active={level} />
                ))}
              </nav>
            ) : null}
          </div>
        ) : null}
        {user ? (
          <div className="mt-auto flex flex-col gap-1">
            <Link
              href={(user.username ? `/profile/${user.username}` : "/me") as Route}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-[14px] p-2 hover:shadow-[var(--raised-s)]"
              aria-label={`${user.fullName}, your profile`}
            >
              <Avatar name={user.fullName} src={user.avatarUrl} size="sm" decorative />
              <span className="truncate text-body-sm font-semibold" data-testid="current-user-name">
                {user.fullName}
              </span>
            </Link>
            <SignOutButton variant="ghost" size="sm" icon className="justify-start" />
          </div>
        ) : null}
      </div>
    </aside>
  );
}
