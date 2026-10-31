import { ArrowRight, Buildings, ChalkboardTeacher, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { forOrgs, isBuilt } from "@/content/marketing";
import Link from "next/link";
import { Section, SectionHeading } from "./section";

/** One module, many domains: only the colour band and the pictogram change (app/(marketing)/CLAUDE.md). */
const DOMAIN: Record<string, { band: string; Icon: typeof Buildings }> = {
  Recruiters: { band: "var(--signal-tint)", Icon: MagnifyingGlass },
  Universities: { band: "var(--jute)", Icon: Buildings },
  Faculty: { band: "var(--mustard)", Icon: ChalkboardTeacher },
};

/**
 * Landing section 11 (PRD 5.1): recruiters, universities and faculty as full-width domain rows
 * (not three equal cards; decisions 2026-10-02). A row links to its page once that page ships.
 */
export function ForOrgs() {
  return (
    <Section labelledBy="orgs-title" step="08 · For organisations">
      <SectionHeading id="orgs-title">{forOrgs.heading}</SectionHeading>
      <ul className="mt-8 flex flex-col gap-5">
        {forOrgs.rows.map((row) => {
          const d = DOMAIN[row.label] ?? DOMAIN.Recruiters;
          return (
            <li key={row.label}>
              <Link
                href={isBuilt(row.page) ? row.page : row.fallback}
                className="org-row neu-tile group relative grid items-center gap-4 overflow-hidden py-5 pr-6 pl-8 transition-shadow duration-[140ms] ease-out active:shadow-[var(--pressed)] sm:grid-cols-12 sm:gap-6"
              >
                <span aria-hidden className="absolute inset-y-0 left-0 w-2" style={{ background: d.band }} />
                <span className="flex items-center gap-4 sm:col-span-4">
                  <span aria-hidden className="neu-chip inline-grid size-12 shrink-0 place-items-center">
                    <d.Icon weight="regular" className="size-6 text-text-primary" />
                  </span>
                  <span className="text-h3 font-semibold">{row.label}</span>
                </span>
                <span className="text-body-lg text-text-secondary sm:col-span-7">{row.text}</span>
                <ArrowRight aria-hidden weight="bold" className="cta-arrow hidden size-6 justify-self-end text-[var(--signal-ink)] sm:col-span-1 sm:block" />
              </Link>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
