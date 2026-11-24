import {
  Bell,
  CalendarBlank,
  ChatCircleDots,
  ChatsCircle,
  Compass,
  House,
  MagnifyingGlass,
  Medal,
  RocketLaunch,
  Swap,
  UserCircle,
  UsersFour,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";

/**
 * The student shell's navigation (PRD 5.25, screen spec 2, phase 14 "Shell"): one config for the
 * two-tier sidebar (a rail of places plus the levels inside the current one), the phone dock, the
 * command menu and the tooltips (label plus a one-line description, PRD 5.27). `data-tour` ids tie
 * each place to its coach mark. Client-safe: no server code.
 *
 * Opportunities became Openings (decisions 2026-11-02) at /openings in phase 18; /opportunities/*
 * redirects there (next.config.ts).
 */
export type BadgeKey = "chat" | "notifications" | "friends" | "ventures" | "openings";
export type NavBadges = Record<BadgeKey, number>;
export const NO_BADGES: NavBadges = { chat: 0, notifications: 0, friends: 0, ventures: 0, openings: 0 };

/** A level inside a place: the second tier of the sidebar and a row in the command menu. */
export interface NavLevel {
  label: string;
  href: string;
  /** Path prefixes that count as being on this level (defaults to href). */
  match?: string[];
  /** Extra words the command menu matches. */
  keywords?: string[];
  /** A live count shown on the level's row (the same counts as the rail). */
  badge?: BadgeKey;
  /** The heading this level sits under in the sidebar. A place groups all of its levels or none. */
  group?: string;
}

export interface NavItem {
  key: string;
  label: string;
  /** The tooltip's one line (also read by screen readers through aria-describedby). */
  description: string;
  href: string;
  icon: Icon;
  badge?: BadgeKey;
  /** Path prefixes that count as being on this place. */
  match: string[];
  /** The levels inside the place, shown in the sidebar's second tier. */
  levels?: NavLevel[];
}

/** The five places: the phone dock and the top of the rail. Me last (serial position). */
export const PRIMARY_NAV: NavItem[] = [
  {
    key: "home",
    label: "Home",
    description: "Your feed, your progress and the composer.",
    href: "/feed",
    icon: House,
    match: ["/feed", "/post"],
    levels: [
      { label: "Feed", href: "/feed", match: ["/feed", "/post"] },
      { label: "Leaderboard", href: "/leaderboard", keywords: ["rank"] },
    ],
  },
  {
    key: "openings",
    label: "Openings",
    description: "Venture roles, inductions, events, ideas and more, each card with its newest opening.",
    href: "/openings",
    icon: Compass,
    badge: "openings",
    match: ["/openings", "/competitions", "/ideas"],
    levels: [
      { label: "All openings", href: "/openings", keywords: ["opportunities"], group: "Overview", badge: "openings" },
      { label: "This week", href: "/openings/this-week", keywords: ["campus pulse"], group: "Overview" },
      { label: "Venture roles", href: "/openings/venture-roles", keywords: ["roles", "teams"], group: "Build" },
      { label: "Project ideas", href: "/openings/ideas", match: ["/openings/ideas", "/ideas"], group: "Build" },
      { label: "Inductions", href: "/openings/inductions", keywords: ["societies", "recruitment"], group: "Join" },
      { label: "Events", href: "/openings/events", match: ["/openings/events"], group: "Join" },
      // Every Openings card has its row, so its page never highlights "All openings" (design gates 2026-11-04).
      { label: "Paths", href: "/openings/paths", keywords: ["what to learn"], group: "Grow" },
      { label: "Skill swaps", href: "/openings/swaps", keywords: ["learn", "teach"], group: "Grow" },
    ],
  },
  {
    key: "ventures",
    label: "Ventures",
    description: "Projects you build with others.",
    href: "/ventures",
    icon: RocketLaunch,
    badge: "ventures",
    match: ["/ventures", "/requests"],
    levels: [
      { label: "All ventures", href: "/ventures", match: ["/ventures"] },
      { label: "Requests", href: "/requests", keywords: ["applications", "invites"], badge: "ventures" },
      { label: "New venture", href: "/ventures/new", match: [], keywords: ["start", "project", "startup"] },
    ],
  },
  {
    key: "chat",
    label: "Chat",
    description: "Messages with friends and teammates.",
    href: "/chat",
    icon: ChatsCircle,
    badge: "chat",
    match: ["/chat"],
    levels: [
      { label: "Messages", href: "/chat", badge: "chat" },
      { label: "Chat settings", href: "/settings/chat", match: [] },
    ],
  },
  {
    key: "me",
    label: "Me",
    description: "Your profile, Record, skills, CV and score.",
    href: "/me",
    icon: UserCircle,
    match: ["/me", "/profile", "/settings", "/appeals", "/billing"],
    levels: [
      { label: "Overview", href: "/me", match: ["/me", "/profile"], group: "You" },
      { label: "Skills", href: "/me/skills", group: "You" },
      { label: "Work", href: "/me/work", group: "You" },
      { label: "Record", href: "/me/record", keywords: ["transcript", "certificates", "entries", "activities"], group: "Proof" },
      { label: "Credentials", href: "/me/credentials", keywords: ["certificates"], group: "Proof" },
      { label: "Score", href: "/me/score", keywords: ["rank", "tier"], group: "Proof" },
      { label: "CV", href: "/me/cv", keywords: ["resume", "verified"], group: "Career" },
      { label: "Paths", href: "/me/paths", match: ["/me/paths", "/me/tasks"], keywords: ["roadmap", "what to learn", "proof tasks", "ladder"], group: "Career" },
      { label: "Tickets", href: "/me/tickets", keywords: ["events", "registrations", "qr"], group: "Account" },
      { label: "Settings", href: "/settings", keywords: ["account", "privacy", "security"], group: "Account" },
    ],
  },
];

/** Below the places on the rail; on a phone they live in the header, the command menu or Me. */
export const SECONDARY_NAV: NavItem[] = [
  { key: "societies", label: "Societies", description: "Clubs and societies: follow, join, apply.", href: "/societies", icon: UsersFour, match: ["/societies"] },
  { key: "events", label: "Events", description: "Society talks, workshops, hackathons and socials.", href: "/events", icon: CalendarBlank, match: ["/events", "/u"] },
  { key: "swaps", label: "Skill swap", description: "Teach what you know, learn from seniors at your university.", href: "/swaps", icon: Swap, match: ["/swaps"] },
  { key: "explore", label: "Explore", description: "Find people, ventures and skills.", href: "/explore", icon: MagnifyingGlass, match: ["/explore"] },
  { key: "leaderboard", label: "Leaderboard", description: "Where you stand at your university and overall.", href: "/leaderboard", icon: Medal, match: ["/leaderboard"] },
  { key: "friends", label: "Friends", description: "Your friends and their requests.", href: "/friends", icon: UsersThree, badge: "friends", match: ["/friends"] },
  { key: "notifications", label: "Notifications", description: "What happened since you were last here.", href: "/notifications", icon: Bell, badge: "notifications", match: ["/notifications"] },
  { key: "feedback", label: "Feedback", description: "Tell us what is confusing or broken.", href: "/feedback", icon: ChatCircleDots, match: ["/feedback"] },
];

export const ALL_NAV: NavItem[] = [...PRIMARY_NAV, ...SECONDARY_NAV];

export function isActive(item: NavItem, pathname: string): boolean {
  // Feedback and the leaderboard have their own rail items: the more specific wins.
  if (item.key === "me" && pathname.startsWith("/feedback")) return false;
  if (item.key === "home" && pathname.startsWith("/leaderboard")) return false;
  return item.match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
}

/** The level the path is on inside a place: the longest matching prefix wins ("/me/cv" over "/me"). */
export function activeLevel(place: NavItem, pathname: string): NavLevel | null {
  let best: NavLevel | null = null;
  let bestLength = -1;
  for (const level of place.levels ?? []) {
    for (const m of level.match ?? [level.href]) {
      if ((pathname === m || pathname.startsWith(`${m}/`)) && m.length > bestLength) {
        best = level;
        bestLength = m.length;
      }
    }
  }
  return best;
}

/** A place's levels under their headings, in order. Ungrouped places come back as one group with no heading. */
export function levelGroups(place: NavItem): { heading: string | null; levels: NavLevel[] }[] {
  const out: { heading: string | null; levels: NavLevel[] }[] = [];
  for (const level of place.levels ?? []) {
    const heading = level.group ?? null;
    const last = out[out.length - 1];
    if (last && last.heading === heading) last.levels.push(level);
    else out.push({ heading, levels: [level] });
  }
  return out;
}

/** The place the path is in (for the second tier), or null. */
export function currentPlace(pathname: string): NavItem | null {
  return ALL_NAV.find((item) => isActive(item, pathname)) ?? null;
}

export function badgeLabel(count: number): string {
  return count > 99 ? "99+" : String(count);
}
