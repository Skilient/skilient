import "server-only";

import { rpcJson } from "@/lib/data/rpc-json";
import { ageLabel, dayLabel, eventTime, futureTime } from "@/lib/format/time";
import { CATEGORY_META, OPENING_CATEGORIES, type OpeningCategory, type OpeningSort } from "@/lib/openings/constants";
import { getPostCards } from "@/lib/data/posts";
import type { PostCardData } from "@/lib/data/posts";

/**
 * Openings (PRD 5.34). The grid is one SQL call (`openings_overview()`); a category page is one
 * call (`openings()`); This week is one call plus the post cards (post_cards, so each post is
 * checked with can_view_post for the reader). Dates are formatted here, on the server.
 */

interface RawItem {
  id: string | null;
  kind: string;
  title: string;
  host: string | null;
  detail: string | null;
  href: string;
  deadline: string | null;
  created_at: string | null;
  matched: boolean;
}

interface RawCard {
  category: string;
  count: number;
  updated_at: string | null;
  latest: { title: string; host: string | null; deadline: string | null; href: string; detail: string | null } | null;
  new: boolean;
}

export interface OpeningCard {
  category: OpeningCategory;
  count: number;
  updatedLabel: string | null;
  isNew: boolean;
  latest: { title: string; host: string | null; deadlineLabel: string | null; href: string } | null;
}

export interface OpeningsOverview {
  university: string;
  cards: OpeningCard[];
}

const isCategory = (c: string): c is OpeningCategory => (OPENING_CATEGORIES as readonly string[]).includes(c);

/** "closes 20 Nov" for a deadline; events show their start. */
function deadlineLabel(category: OpeningCategory, deadline: string | null): string | null {
  if (!deadline) return null;
  return category === "events" ? `register by ${futureTime(deadline)}` : `closes ${dayLabel(deadline)}`;
}

export async function getOpeningsOverview(): Promise<OpeningsOverview> {
  const raw = await rpcJson<{ university: string | null; cards: RawCard[] }>("openings_overview");
  return {
    university: raw.university ?? "your university",
    cards: (raw.cards ?? [])
      .filter((c) => isCategory(c.category))
      .map((c) => {
        const category = c.category as OpeningCategory;
        return {
          category,
          count: c.count ?? 0,
          updatedLabel: c.updated_at ? `updated ${ageLabel(c.updated_at)} ago` : null,
          isNew: Boolean(c.new),
          latest: c.latest
            ? { title: c.latest.title, host: c.latest.host, deadlineLabel: deadlineLabel(category, c.latest.deadline), href: c.latest.href }
            : null,
        };
      }),
  };
}

export interface OpeningItem {
  key: string;
  kind: string;
  title: string;
  host: string | null;
  detail: string | null;
  href: string;
  deadlineLabel: string | null;
  postedLabel: string | null;
  matched: boolean;
}

export interface OpeningsPage {
  category: OpeningCategory;
  total: number;
  items: OpeningItem[];
  next: number | null;
}

export async function getOpenings(
  category: OpeningCategory,
  opts: { sort: OpeningSort; matched: boolean; q: string; after?: number },
): Promise<OpeningsPage> {
  const raw = await rpcJson<{ total: number; items: RawItem[]; next: number | null }>("openings", {
    p_category: category,
    p_sort: opts.sort,
    p_matched_only: opts.matched,
    p_q: opts.q || null,
    p_after: opts.after ?? 0,
  });
  return {
    category,
    total: raw.total ?? 0,
    next: raw.next ?? null,
    items: (raw.items ?? []).map((i, n) => ({
      key: `${i.id ?? i.href}-${n}`,
      kind: i.kind,
      title: i.title,
      host: i.host,
      detail: i.detail,
      href: i.href,
      deadlineLabel: deadlineLabel(category, i.deadline),
      postedLabel: i.created_at ? dayLabel(i.created_at) : null,
      matched: i.matched,
    })),
  };
}

export interface ThisWeek {
  builtLabel: string | null;
  posts: (PostCardData & { informative: number })[];
  events: { id: string; title: string; host: string; whenLabel: string; href: string }[];
  inductions: { id: string; title: string; host: string; deadlineLabel: string; href: string }[];
  ventures: { id: string; title: string; type: string; href: string }[];
}

export async function getThisWeek(): Promise<ThisWeek> {
  const raw = await rpcJson<{
    built_at: string | null;
    posts: { id: string; informative: number }[];
    events: { id: string; title: string; host: string; starts_at: string; href: string }[];
    inductions: { id: string; title: string; host: string; deadline: string; href: string }[];
    ventures: { id: string; title: string; type: string; href: string }[];
  }>("openings_this_week");
  const informative = new Map((raw.posts ?? []).map((p) => [p.id, p.informative]));
  const cards = informative.size ? await getPostCards([...informative.keys()]) : [];
  return {
    builtLabel: raw.built_at ? `updated ${ageLabel(raw.built_at)} ago` : null,
    posts: cards.map((c) => ({ ...c, informative: informative.get(c.id) ?? 0 })),
    events: (raw.events ?? []).map((e) => ({ id: e.id, title: e.title, host: e.host, whenLabel: eventTime(e.starts_at), href: e.href })),
    inductions: (raw.inductions ?? []).map((i) => ({ id: i.id, title: i.title, host: i.host, deadlineLabel: `closes ${dayLabel(i.deadline)}`, href: i.href })),
    ventures: raw.ventures ?? [],
  };
}

export function emptyLine(category: OpeningCategory, university: string): string {
  return CATEGORY_META[category].empty.replace("{uni}", university);
}
