import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarkOpeningsSeen } from "@/components/openings/mark-seen";
import { OpeningIcon } from "@/components/openings/opening-card";
import { OpeningsFilters } from "@/components/openings/openings-filters";
import { PostCard } from "@/components/posts/post-card";
import { Badge, buttonClass, EmptyState } from "@/components/ui";
import { isRefusal } from "@/lib/data/rpc-json";
import { getOpenings, getThisWeek } from "@/lib/data/openings";
import { CATEGORY_META, categoryFromSlug, categoryHref, parseOpeningFilters, type OpeningCategory } from "@/lib/openings/constants";

export async function generateMetadata({ params }: PageProps<"/openings/[category]">): Promise<Metadata> {
  const category = categoryFromSlug((await params).category);
  return { title: category ? CATEGORY_META[category].label : "Openings" };
}

/** Kinds whose items can match the student's skills (venture roles, inductions, ideas). */
const MATCHABLE: OpeningCategory[] = ["venture_roles", "inductions", "ideas"];

/**
 * /openings/[category] (PRD 5.34, screen spec 3.14): every opening of one kind, with search, sort by
 * newest or deadline soonest, and "Matches my skills". Items matching the student's skills and paths
 * come first; nothing is ordered by payment. /openings/this-week is the campus pulse, rebuilt nightly.
 */
export default async function OpeningsCategoryPage({ params, searchParams }: PageProps<"/openings/[category]">) {
  const category = categoryFromSlug((await params).category);
  if (!category) notFound();
  const meta = CATEGORY_META[category];

  const back = (
    <Link href="/openings" className="inline-flex items-center gap-1.5 text-body-sm font-semibold text-text-secondary hover:text-text-primary">
      <ArrowLeft aria-hidden weight="bold" className="size-4" />
      All openings
    </Link>
  );
  const heading = (
    <header className="flex flex-col gap-2">
      {back}
      <div className="flex items-center gap-3">
        <span aria-hidden className="neu-icon-btn size-12 text-[var(--signal-ink)]">
          <OpeningIcon category={category} />
        </span>
        <h1 className="text-h1">{meta.label}</h1>
      </div>
      <p className="max-w-prose text-body text-text-secondary">{meta.blurb}</p>
    </header>
  );

  if (category === "this_week") {
    const week = await getThisWeek();
    const quiet = !week.posts.length && !week.events.length && !week.inductions.length && !week.ventures.length;
    return (
      <main className="mx-auto flex w-full max-w-[760px] flex-col gap-6 px-[var(--page-gutter)] py-8" data-testid="this-week">
        {heading}
        {week.builtLabel ? <p className="neu-mono text-caption text-text-secondary">{week.builtLabel}</p> : null}
        {quiet ? (
          <EmptyState
            object="page"
            title="A quiet week"
            description="Nothing new this week yet: no informative posts, upcoming events, inductions or new ventures. It's rebuilt every night."
            action={<Link href="/feed" className={buttonClass("secondary")}>Post something useful</Link>}
          />
        ) : (
          <>
            <WeekSection title="Most informative posts" empty="No post was marked informative by 3 or more people this week.">
              {week.posts.map((p) => (
                <li key={p.id} className="flex flex-col gap-1">
                  <p className="neu-mono text-caption text-text-secondary">{p.informative} found this informative</p>
                  <PostCard post={p} headingLevel={3} />
                </li>
              ))}
            </WeekSection>
            <WeekSection title="Upcoming events" empty="No society events in the next 7 days.">
              {week.events.map((e) => (
                <li key={e.id} className="neu-tile p-4">
                  <Link href={e.href as Route} className="text-h4 underline-offset-4 hover:underline">{e.title}</Link>
                  <p className="text-body-sm text-text-secondary">{e.host}</p>
                  <p className="neu-mono text-caption text-text-secondary">{e.whenLabel}</p>
                </li>
              ))}
            </WeekSection>
            <WeekSection title="New inductions" empty="No society opened inductions this week.">
              {week.inductions.map((i) => (
                <li key={i.id} className="neu-tile p-4">
                  <Link href={i.href as Route} className="text-h4 underline-offset-4 hover:underline">{i.title}</Link>
                  <p className="text-body-sm text-text-secondary">{i.host}</p>
                  <p className="neu-mono text-caption text-text-secondary">{i.deadlineLabel}</p>
                </li>
              ))}
            </WeekSection>
            <WeekSection title="Newly started ventures" empty="No new ventures this week.">
              {week.ventures.map((v) => (
                <li key={v.id} className="neu-tile p-4">
                  <Link href={v.href as Route} className="text-h4 underline-offset-4 hover:underline">{v.title}</Link>
                  <p className="text-body-sm text-text-secondary capitalize">{v.type.replace(/_/g, " ")}</p>
                </li>
              ))}
            </WeekSection>
          </>
        )}
        <MarkOpeningsSeen category={category} />
      </main>
    );
  }

  const filters = parseOpeningFilters(await searchParams);
  let data;
  try {
    data = await getOpenings(category, filters);
  } catch (error) {
    if (isRefusal(error, "22023")) notFound(); // a portal card while its portal is off
    throw error;
  }
  const filtered = filters.q !== "" || filters.matched;

  return (
    <main className="mx-auto flex w-full max-w-[760px] flex-col gap-5 px-[var(--page-gutter)] py-8" data-testid="openings-category">
      {heading}
      {data.total > 0 || filtered ? <OpeningsFilters base={categoryHref(category)} state={filters} showMatch={MATCHABLE.includes(category)} /> : null}
      {data.items.length === 0 ? (
        filtered ? (
          <EmptyState
            title="No matches"
            description="Nothing here matches your search or your proved skills. Clear the filters to see everything open."
            action={<Link href={categoryHref(category) as Route} className={buttonClass("secondary")}>Clear filters</Link>}
          />
        ) : (
          <EmptyState
            title={`No ${meta.label.toLowerCase()} open`}
            description={meta.empty.replace("{uni}", "your university")}
            action={<Link href={meta.action.href as Route} className={buttonClass("secondary")}>{meta.action.label}</Link>}
          />
        )
      ) : (
        <>
          <p className="text-body-sm text-text-secondary" aria-live="polite">
            {data.total} open
          </p>
          <ul className="flex flex-col gap-3" data-testid="opening-list">
            {data.items.map((o) => (
              <li key={o.key} className="neu-tile flex flex-col gap-1 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={o.href as Route} className="text-h4 underline-offset-4 hover:underline">
                    {o.title}
                  </Link>
                  {o.matched && MATCHABLE.includes(category) ? <Badge tone="success">Matches your skills</Badge> : null}
                </div>
                {o.host ? <p className="text-body-sm text-text-secondary">{o.host}</p> : null}
                {o.detail ? <p className="text-body-sm text-text-secondary">{o.detail}</p> : null}
                {o.deadlineLabel ? <p className="neu-mono text-caption text-text-secondary">{o.deadlineLabel}</p> : null}
              </li>
            ))}
          </ul>
          {data.next !== null ? (
            <p className="text-body-sm text-text-secondary">Showing the first {data.items.length}. Search or filter to narrow the list.</p>
          ) : null}
        </>
      )}
      <MarkOpeningsSeen category={category} />
    </main>
  );
}

function WeekSection({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  const id = title.toLowerCase().replace(/[^a-z]+/g, "-");
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="text-h3">
        {title}
      </h2>
      {children.length ? <ul className="flex flex-col gap-3">{children}</ul> : <p className="text-body-sm text-text-secondary">{empty}</p>}
    </section>
  );
}
