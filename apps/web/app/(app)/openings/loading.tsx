import { OpeningCardSkeleton } from "@/components/openings/opening-card";
import { Skeleton } from "@/components/ui";
import { cardSpan, GRID_ORDER } from "@/lib/openings/constants";

/** Every card in its loading state while the one overview call runs. */
export default function Loading() {
  return (
    <main className="mx-auto flex w-full max-w-page flex-col gap-6 px-[var(--page-gutter)] py-8" aria-busy="true">
      <h1 className="text-h1">Openings</h1>
      <Skeleton className="h-4 w-2/3" />
      <span role="status" className="sr-only">
        Loading openings…
      </span>
      <div className="@container">
        <ul className="grid grid-cols-1 gap-4 @xl:grid-cols-2 @4xl:grid-cols-3" aria-label="Opening categories">
          {GRID_ORDER.slice(0, 7).map((category, i) => (
            <li key={category} className={cardSpan(i, 7)}>
              <OpeningCardSkeleton category={category} className="h-full" />
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
