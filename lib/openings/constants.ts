import type { DomainTone } from "@/components/ui/domain-card";

/**
 * Openings (PRD 5.34): the categories, their URL slugs, card colours, pictograms and the honest
 * empty line. Client-safe. The SQL keys use underscores (`openings_overview()`), the URLs hyphens.
 * Jobs, contact requests, applications, competitions and job fairs only appear while their portal
 * is on (the SQL leaves them out otherwise).
 */
export const OPENING_CATEGORIES = [
  "venture_roles",
  "inductions",
  "events",
  "ideas",
  "paths",
  "swaps",
  "this_week",
  "jobs",
  "contact_requests",
  "applications",
  "competitions",
  "job_fairs",
] as const;
export type OpeningCategory = (typeof OPENING_CATEGORIES)[number];

export type Pictogram = "rocket" | "flag" | "calendar" | "bulb" | "path" | "swap" | "pulse" | "briefcase" | "envelope" | "list" | "trophy" | "booth";

export interface CategoryMeta {
  label: string;
  /** One line under the heading on the category page. */
  blurb: string;
  tone: DomainTone;
  pictogram: Pictogram;
  /** The empty card: one honest line ({uni} is the student's university) and one action. */
  empty: string;
  action: { label: string; href: string };
}

export const CATEGORY_META: Record<OpeningCategory, CategoryMeta> = {
  venture_roles: {
    label: "Venture roles",
    blurb: "Open seats on ventures you can join. Roles that need skills you've proved come first.",
    tone: "signal",
    pictogram: "rocket",
    empty: "No open venture roles at {uni} right now.",
    action: { label: "Start a venture", href: "/ventures/new" },
  },
  inductions: {
    label: "Society inductions",
    blurb: "Societies recruiting members and teams, with their deadlines.",
    tone: "mustard",
    pictogram: "flag",
    empty: "No inductions open at {uni} yet.",
    action: { label: "Request a society", href: "/societies/new" },
  },
  events: {
    label: "Events",
    blurb: "Society events open for registration.",
    tone: "jute",
    pictogram: "calendar",
    empty: "No society events open for registration at {uni}.",
    action: { label: "Browse societies", href: "/societies" },
  },
  ideas: {
    label: "Project ideas",
    blurb: "Ideas from faculty that you can start a venture from.",
    tone: "tint",
    pictogram: "bulb",
    empty: "No project ideas from faculty at {uni} yet.",
    action: { label: "Start your own venture", href: "/ventures/new" },
  },
  paths: {
    label: "Paths",
    blurb: "The next square on each path you follow.",
    tone: "ink",
    pictogram: "path",
    empty: "You're not following a path yet.",
    action: { label: "Choose a path", href: "/me/paths" },
  },
  swaps: {
    label: "Skill swaps",
    blurb: "Students at your university who teach what you want to learn.",
    tone: "concrete",
    pictogram: "swap",
    empty: "No teachers yet for what you want to learn.",
    action: { label: "Say what you want to learn", href: "/swaps" },
  },
  this_week: {
    label: "This week",
    blurb: "The campus pulse: the week's most informative posts, upcoming events, new inductions and new ventures.",
    tone: "signal",
    pictogram: "pulse",
    empty: "A quiet week at {uni} so far.",
    action: { label: "Post something useful", href: "/feed" },
  },
  jobs: {
    label: "Jobs",
    blurb: "Open roles at recruiters on Skilient, with their salary range.",
    tone: "ink",
    pictogram: "briefcase",
    empty: "No open roles yet.",
    action: { label: "Build your CV meanwhile", href: "/me/cv" },
  },
  contact_requests: {
    label: "Contact requests",
    blurb: "Companies asking to talk to you.",
    tone: "jute",
    pictogram: "envelope",
    empty: "No requests from recruiters.",
    action: { label: "Review who can find you", href: "/settings/privacy" },
  },
  applications: {
    label: "Applications",
    blurb: "Where each application you sent stands.",
    tone: "concrete",
    pictogram: "list",
    empty: "You haven't applied to anything.",
    action: { label: "Browse jobs", href: "/openings/jobs" },
  },
  competitions: {
    label: "Competitions",
    blurb: "Competitions and hackathons you can enter.",
    tone: "mustard",
    pictogram: "trophy",
    empty: "No competitions or hackathons open.",
    action: { label: "Start a venture in the meantime", href: "/ventures/new" },
  },
  job_fairs: {
    label: "Job fairs",
    blurb: "Fairs at your university with their booths and the live queue.",
    tone: "tint",
    pictogram: "booth",
    empty: "No job fairs coming up.",
    action: { label: "Explore your university", href: "/explore" },
  },
};

export function categorySlug(category: OpeningCategory): string {
  return category.replace(/_/g, "-");
}

export function categoryFromSlug(slug: string): OpeningCategory | null {
  const key = slug.replace(/-/g, "_");
  return (OPENING_CATEGORIES as readonly string[]).includes(key) && !slug.includes("_") ? (key as OpeningCategory) : null;
}

export function categoryHref(category: OpeningCategory): string {
  return `/openings/${categorySlug(category)}`;
}

export const OPENING_SORTS = ["newest", "deadline"] as const;
export type OpeningSort = (typeof OPENING_SORTS)[number];

/** The URL state of a category page: ?sort=deadline&match=1&q=… */
export function parseOpeningFilters(search: Record<string, string | string[] | undefined>): { sort: OpeningSort; matched: boolean; q: string } {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const sort = one(search.sort) === "deadline" ? "deadline" : "newest";
  return { sort, matched: one(search.match) === "1", q: one(search.q).trim().slice(0, 80) };
}

/** The categories shown with these portals open (mirrors private.openings_categories()). */
export function visibleCategories(portals: { recruiter: boolean; university: boolean }): OpeningCategory[] {
  return OPENING_CATEGORIES.filter((c) => {
    if (c === "jobs" || c === "contact_requests" || c === "applications") return portals.recruiter;
    if (c === "competitions") return portals.recruiter || portals.university;
    if (c === "job_fairs") return portals.recruiter && portals.university;
    return true;
  });
}

/**
 * The grid's reading order (2026-11-15): This week leads as a full-width banner, then the cards
 * follow the sidebar's groups (Build, Join, Grow), then the portal cards. Never by payment.
 */
export const GRID_ORDER: readonly OpeningCategory[] = [
  "this_week",
  "venture_roles",
  "ideas",
  "inductions",
  "events",
  "paths",
  "swaps",
  "jobs",
  "applications",
  "contact_requests",
  "competitions",
  "job_fairs",
];

export function gridOrder<T extends { category: OpeningCategory }>(cards: readonly T[]): T[] {
  return [...cards].sort((a, b) => GRID_ORDER.indexOf(a.category) - GRID_ORDER.indexOf(b.category));
}

/**
 * How wide a card is in the Openings grid (one column on a phone, two from 36rem of grid width,
 * three from 56rem). The first card is the banner; the last card widens so no row ends with a gap.
 * `total` counts the banner. Class names are whole literals so Tailwind sees them.
 */
export function cardSpan(index: number, total: number): string {
  if (index === 0) return "col-span-full";
  if (index !== total - 1) return "";
  const cards = total - 1;
  const two = cards % 2 === 1 ? "@xl:col-span-2" : "";
  const rest = cards % 3;
  const three = rest === 1 ? "@4xl:col-span-3" : rest === 2 ? "@4xl:col-span-2" : two ? "@4xl:col-span-1" : "";
  return [two, three].filter(Boolean).join(" ");
}
