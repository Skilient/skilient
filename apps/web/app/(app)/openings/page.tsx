import type { Metadata } from "next";
import { FirstVisitTip } from "@/components/learn/first-visit-tip";
import { MarkOpeningsSeen } from "@/components/openings/mark-seen";
import { OpeningCard, OpeningCardError } from "@/components/openings/opening-card";
import { emptyLine, getOpeningsOverview, type OpeningsOverview } from "@/lib/data/openings";
import { getPortals } from "@/lib/data/portals";
import { logger } from "@/lib/log";
import { cardSpan, GRID_ORDER, gridOrder, visibleCategories } from "@/lib/openings/constants";

export const metadata: Metadata = { title: "Openings" };

/**
 * /openings (PRD 5.34, screen spec 3.14): one page of category cards (a bento grid, no carousels),
 * each featuring its latest opening, read in one SQL call (`openings_overview()`). This week leads as a
 * full-width banner; the rest follow the sidebar's groups. Cards for the
 * recruiter and university portals appear only while those portals are on. Nothing is ordered by
 * payment. Loading is `loading.tsx`; if the one call fails, every card shows its error state.
 */
export default async function OpeningsPage() {
  let overview: OpeningsOverview | null = null;
  try {
    overview = await getOpeningsOverview();
  } catch (error) {
    logger.error("openings.overview", { outcome: "error", error_code: error instanceof Error ? error.message : "unknown" });
  }
  const failed = overview === null;
  const visible = failed ? visibleCategories(await getPortals()) : [];
  const categories = GRID_ORDER.filter((c) => visible.includes(c));
  const cards = overview ? gridOrder(overview.cards) : [];

  return (
    <main className="mx-auto flex w-full max-w-page flex-col gap-6 px-[var(--page-gutter)] py-8" data-testid="openings-page">
      <header className="flex flex-col gap-1">
        <h1 className="text-h1">Openings</h1>
        <p className="max-w-prose text-body text-text-secondary">
          Everything you can join or apply to{overview ? ` at ${overview.university}` : ""}, one card per kind. Each shows its newest opening; open a card for the full list.
        </p>
      </header>
      <FirstVisitTip id="opportunities" />
      {overview && overview.cards.every((c) => c.count === 0) ? (
        <p className="neu-well p-4 text-body-sm text-text-secondary" data-testid="openings-all-empty">
          Nothing is open right now. Each card below says what would show up there and one thing you can do meanwhile.
        </p>
      ) : null}
      {/* Sized by the grid's own width, not the window's: the sidebar takes 284 px of it (2026-11-15). */}
      <div className="@container">
        <ul className="grid grid-cols-1 gap-4 @xl:grid-cols-2 @4xl:grid-cols-3" aria-label="Opening categories" data-testid="openings-grid">
          {failed
            ? categories.map((category, i) => (
                <li key={category} className={cardSpan(i, categories.length)}>
                  <OpeningCardError category={category} className="h-full" />
                </li>
              ))
            : cards.map((card, i) => (
                <li key={card.category} className={cardSpan(i, cards.length)} data-tour={i === 0 ? "openings-this-week" : i === 1 ? "openings-card" : undefined}>
                  <OpeningCard {...card} emptyLine={emptyLine(card.category, overview!.university)} wide={i === 0} className="h-full" />
                </li>
              ))}
        </ul>
      </div>
      {failed ? null : <MarkOpeningsSeen category="overview" />}
    </main>
  );
}
