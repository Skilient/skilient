import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OpeningCard, OpeningCardError, OpeningCardSkeleton } from "@/components/openings/opening-card";
import { CATEGORY_META, OPENING_CATEGORIES } from "@/lib/openings/constants";

/** PRD 5.34 done-when: every Openings card has loading, empty and error states (and ready). */
describe("Openings cards", () => {
  for (const category of OPENING_CATEGORIES) {
    it(`${category}: loading, empty, ready and error`, () => {
      const loading = renderToStaticMarkup(<OpeningCardSkeleton category={category} />);
      expect(loading).toContain('data-state="loading"');
      expect(loading).toContain(CATEGORY_META[category].label);

      const empty = renderToStaticMarkup(
        <OpeningCard category={category} count={0} updatedLabel={null} isNew={false} latest={null} emptyLine="Nothing open at NUTECH yet." />,
      );
      expect(empty).toContain('data-state="empty"');
      expect(empty).toContain("Nothing open at NUTECH yet.");
      expect(empty).toContain(CATEGORY_META[category].action.label);

      const ready = renderToStaticMarkup(
        <OpeningCard
          category={category}
          count={12}
          updatedLabel="updated 2 h ago"
          isNew
          latest={{ title: "Design team intake", host: "CS Society", deadlineLabel: "closes 20 Nov 2026", href: "/x" }}
          emptyLine=""
        />,
      );
      expect(ready).toContain('data-state="ready"');
      expect(ready).toContain("Design team intake");
      expect(ready).toContain("closes 20 Nov 2026");
      expect(ready).toContain("updated 2 h ago");
      expect(ready).toContain("New");

      const error = renderToStaticMarkup(<OpeningCardError category={category} />);
      expect(error).toContain('data-state="error"');
      expect(error).toContain("didn&#x27;t load");
    });
  }
});
