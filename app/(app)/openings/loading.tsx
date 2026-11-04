import { cardSpan, OpeningCardSkeleton } from "@/components/openings/opening-card";
import { Skeleton } from "@/components/ui";
import { OPENING_CATEGORIES } from "@/lib/openings/constants";

/** Every card in its loading state while the one overview call runs. */
export default function Loading() {
  return (
    <main className="mx-auto flex w-full max-w-page flex-col gap-6 px-[var(--page-gutter)] py-8" aria-busy="true">
      <h1 className="text-h1">Openings</h1>
      <Skeleton className="h-4 w-2/3" />
      <span role="status" className="sr-only">
        Loading openings…
      </span>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Opening categories">
        {OPENING_CATEGORIES.slice(0, 7).map((category, i) => (
          <li key={category} className={cardSpan(i)}>
            <OpeningCardSkeleton category={category} className="h-full" />
          </li>
        ))}
      </ul>
    </main>
  );
}
