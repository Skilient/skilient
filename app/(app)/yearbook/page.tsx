import type { Metadata, Route } from "next";
import Link from "next/link";
import { YearbookSearch } from "@/components/yearbook/yearbook-search";
import { Avatar, Badge, buttonClass, EmptyState } from "@/components/ui";
import { getYearbookHome } from "@/lib/data/yearbook";
import { STATE_LINES } from "@/lib/yearbook/constants";

export const metadata: Metadata = { title: "Yearbook" };

/**
 * /yearbook (PRD 5.33, screen spec 3.14): the final-year batch's pages as a grid of portraits by
 * department, with search; revealed superlatives on the winners. Not in a final-year batch: when the
 * caller's book opens. Frozen after graduation: read-only, kept forever. Signed-in only.
 */
export default async function YearbookPage({ searchParams }: PageProps<"/yearbook">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 60) : "";
  const home = await getYearbookHome(q);

  if (home.state === "none") {
    return (
      <main className="mx-auto flex w-full max-w-[680px] flex-col gap-6 px-[var(--page-gutter)] py-8" data-testid="yearbook-none">
        <h1 className="font-serif text-h1">Yearbook</h1>
        <EmptyState
          object="page"
          title="Your yearbook opens in your final year"
          description={
            home.opensLabel
              ? `The batch of ${home.batch} gets its yearbook on ${home.opensLabel}: friends, teammates and society co-members sign each other's pages, and the batch votes kind superlatives. It's kept after graduation.`
              : "Add your graduation year to your profile so we know when your batch's yearbook opens."
          }
          action={
            home.opensLabel ? undefined : (
              <Link href="/settings/profile" className={buttonClass("secondary")}>
                Add your graduation year
              </Link>
            )
          }
        />
      </main>
    );
  }

  const total = home.departments.reduce((n, d) => n + d.pages.length, 0);
  return (
    <main className="mx-auto flex w-full max-w-page flex-col gap-6 px-[var(--page-gutter)] py-8" data-testid="yearbook-home" data-state={home.state}>
      <header className="flex flex-col gap-2">
        <h1 className="font-serif text-h1">
          {home.university} · Batch of {home.batch}
        </h1>
        <p className="max-w-prose text-body text-text-secondary">{STATE_LINES[home.state](home)}</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/yearbook/me" className={buttonClass("primary", "sm")}>
            My page{home.myPending ? ` · ${home.myPending} to approve` : ""}
          </Link>
          {home.state === "voting" || home.state === "revealed" || home.state === "counting" ? (
            <Link href="/yearbook/vote" className={buttonClass("secondary", "sm")}>
              {home.state === "voting" ? "Vote superlatives" : "Superlatives"}
            </Link>
          ) : null}
        </div>
        {/* The count of notes signed is shown to the page's owner only. */}
        <p className="neu-mono text-caption text-text-secondary" data-testid="yearbook-my-count">
          {home.myNotes} {home.myNotes === 1 ? "note" : "notes"} on your page
        </p>
      </header>
      <YearbookSearch initial={q} />
      {total === 0 ? (
        <EmptyState title={q ? "No one matches" : "No pages yet"} description={q ? "Try another name or department." : "Pages appear as your batch joins Skilient."} />
      ) : (
        home.departments.map((d) => (
          <section key={d.name} aria-labelledby={`dept-${d.name}`} className="flex flex-col gap-3">
            <h2 id={`dept-${d.name}`} className="text-h3">
              {d.name}
            </h2>
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5" data-testid="yearbook-grid">
              {d.pages.map((p) => (
                <li key={p.username} className="neu-tile relative flex flex-col items-center gap-2 p-4 text-center">
                  <Avatar name={p.name} src={p.photoUrl} size="xl" />
                  <Link
                    href={`/yearbook/${p.username}` as Route}
                    className="text-body font-semibold after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-focus-ring"
                  >
                    {p.name}
                    {p.me ? <span className="sr-only"> (you)</span> : null}
                  </Link>
                  {p.quote ? <p className="line-clamp-2 text-caption text-text-secondary">“{p.quote}”</p> : null}
                  {p.awards.map((a) => (
                    <Badge key={a} tone="warning">
                      {a}
                    </Badge>
                  ))}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </main>
  );
}
