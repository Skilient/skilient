"use client";

import { Bell, ChatCircleDots, Gear, User } from "@phosphor-icons/react/dist/ssr";
import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { useCurrentUser } from "@/components/providers/current-user-provider";
import { BadgePill } from "@/components/shell/badge-pill";
import { useNavBadges } from "@/components/shell/nav-badges";
import { Avatar, CommandMenu, ThemeToggle, Tooltip, type CommandItem } from "@/components/ui";
import { ALL_NAV } from "@/lib/nav";

/** Every place and level, for ⌘K. */
const COMMANDS: CommandItem[] = ALL_NAV.flatMap((item) => [
  { key: item.key, label: item.label, description: item.description, href: item.href, group: "Places" },
  ...(item.levels ?? [])
    .filter((l) => l.href !== item.href)
    .map((l) => ({ key: `${item.key}-${l.href}`, label: l.label, description: item.label, href: l.href, group: item.label, keywords: l.group ? [...(l.keywords ?? []), l.group.toLowerCase()] : l.keywords })),
]);

/** The account menu, top right (Jakob's law): profile, settings, theme, sign out. */
function AccountMenu() {
  const user = useCurrentUser();
  const pathname = usePathname();
  // Open on the page it was opened on: navigating closes it without an effect.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (next: boolean | ((o: boolean) => boolean)) =>
    setOpenOn((typeof next === "function" ? next(open) : next) ? pathname : null);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpenOn(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenOn(null);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  if (!user) return null;
  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label="Account menu"
        title={user.fullName}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex size-11 items-center justify-center rounded-full"
        data-testid="account-menu"
      >
        <Avatar name={user.fullName} src={user.avatarUrl} size="sm" decorative />
      </button>
      {open ? (
        <div id={id} className="absolute top-13 right-0 z-40 flex w-64 flex-col gap-1 rounded-lg bg-bg-elevated p-2 shadow-[var(--raised-l)]">
          <p className="truncate px-3 pt-2 pb-1 text-body font-semibold">{user.fullName}</p>
          <Link href={(user.username ? `/profile/${user.username}` : "/me") as Route} className="flex min-h-11 items-center gap-2 rounded-md px-3 hover:bg-bg-subtle">
            <User aria-hidden weight="bold" className="size-5" /> Your profile
          </Link>
          <Link href="/settings" className="flex min-h-11 items-center gap-2 rounded-md px-3 hover:bg-bg-subtle">
            <Gear aria-hidden weight="bold" className="size-5" /> Settings
          </Link>
          <Link href="/feedback" className="flex min-h-11 items-center gap-2 rounded-md px-3 hover:bg-bg-subtle">
            <ChatCircleDots aria-hidden weight="bold" className="size-5" /> Feedback
          </Link>
          <div className="flex items-center justify-between gap-2 border-t border-border-muted px-1 pt-2">
            <ThemeToggle />
            <SignOutButton variant="ghost" size="sm" />
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The header (the brief §3 "Shell", phase 14): the search well with ⌘K on the left, notifications
 * and the account menu on the right. On a phone the logo leads and the search well shrinks.
 */
export function TopBar() {
  const { notifications } = useNavBadges();
  return (
    <header className="sticky top-0 z-20 bg-bg-page/90 backdrop-blur-md md:static md:bg-transparent md:backdrop-blur-none">
      <div className="flex h-16 items-center gap-3 px-[var(--page-gutter)]">
        <Link href="/feed" aria-label="Skilient home" className="shrink-0 rounded-full md:hidden">
          <Image src="/brand/skilient-icon.svg" alt="" width={28} height={28} className="size-7 dark:hidden" />
          <Image src="/brand/skilient-icon-white.svg" alt="" width={28} height={28} className="hidden size-7 dark:block" />
        </Link>
        <div className="min-w-0 flex-1 md:max-w-md">
          <CommandMenu items={COMMANDS} tourAnchor="nav-explore" />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Tooltip label="Notifications" description="What happened since you were last here." placement="bottom">
            <Link
              href="/notifications"
              aria-label={notifications > 0 ? `Notifications, ${notifications} unread` : "Notifications"}
              data-tour="nav-notifications"
              data-testid="notification-bell-small"
              className="neu-icon-btn relative md:hidden"
            >
              <Bell aria-hidden weight="bold" className="size-5" />
              <BadgePill count={notifications} className="absolute -top-1 -right-1" />
            </Link>
          </Tooltip>
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
