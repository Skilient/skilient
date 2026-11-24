import { MagnifyingGlass, Plus } from "@phosphor-icons/react/dist/ssr";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { ActionButton } from "@/components/societies/action-button";
import { SocietyCard } from "@/components/societies/society-card";
import { PageTitle } from "@/components/uni/page-parts";
import { Badge, buttonClass, EmptyState, Input, Label } from "@/components/ui";
import { controlBase } from "@/components/ui/field";
import { answerSocietyInvite } from "@/lib/actions/societies";
import { getDirectory, getMyInvites } from "@/lib/data/societies";
import { cn } from "@/lib/cn";
import { REQUEST_STATUS, SOCIETY_CATEGORIES } from "@/lib/societies/constants";

export const metadata: Metadata = { title: "Societies" };

/**
 * /societies (PRD 5.31, screen spec 3.14): verified societies at your university first, then others;
 * your requests and invitations on top. Search and the category filter are a plain GET form.
 */
export default async function SocietiesPage({ searchParams }: PageProps<"/societies">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : "";
  const category = typeof sp.category === "string" && SOCIETY_CATEGORIES.some((c) => c.value === sp.category) ? sp.category : "";
  const [dir, invites] = await Promise.all([getDirectory(q, category), getMyInvites()]);
  const own = dir.items.filter((s) => s.own);
  const others = dir.items.filter((s) => !s.own);
  const open = dir.mine.some((r) => r.status === "pending" || r.status === "more_info");

  return (
    <main className="mx-auto flex w-full max-w-page flex-col gap-6 px-[var(--page-gutter)] py-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle title="Societies">Clubs and societies, verified by Skilient. Follow them for their posts and events, join, or apply in an induction round.</PageTitle>
        {!open ? (
          <Link href={"/societies/new" as Route} className={buttonClass("primary", "md")} data-testid="request-society">
            <Plus aria-hidden weight="bold" className="size-4" />
            Request a society
          </Link>
        ) : null}
      </div>

      {invites.length ? (
        <section aria-labelledby="invites-h" className="neu-card flex flex-col gap-3 p-4" data-testid="society-invites">
          <h2 id="invites-h" className="text-h4">
            Invitations
          </h2>
          <ul className="flex flex-col gap-3">
            {invites.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-body-sm">
                  {i.kind === "handover" ? (
                    <>
                      You&apos;re offered the presidency of <Link href={`/societies/${i.slug}` as Route} className="font-semibold underline underline-offset-4">{i.society}</Link>.
                    </>
                  ) : (
                    <>
                      <Link href={`/societies/${i.slug}` as Route} className="font-semibold underline underline-offset-4">{i.society}</Link> invites you to be {i.title ?? "an officer"}
                      {i.termLabel ? <span className="neu-mono text-text-secondary"> ({i.termLabel})</span> : null}.
                    </>
                  )}
                </p>
                <span className="flex gap-2">
                  <ActionButton action={answerSocietyInvite} args={{ inviteId: i.id, accept: true }} variant="primary" testId="accept-invite">
                    Accept
                  </ActionButton>
                  <ActionButton action={answerSocietyInvite} args={{ inviteId: i.id, accept: false }} variant="ghost">
                    Decline
                  </ActionButton>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {dir.mine.length ? (
        <section aria-labelledby="mine-h" className="flex flex-col gap-2" data-testid="my-requests">
          <h2 id="mine-h" className="text-h4">
            Your requests
          </h2>
          <ul className="flex flex-col gap-2">
            {dir.mine.map((r) => (
              <li key={r.societyId} className="neu-tile flex flex-wrap items-center justify-between gap-2 p-3">
                <span className="flex flex-col">
                  <Link href={`/societies/${r.slug}` as Route} className="font-semibold underline-offset-4 hover:underline">
                    {r.name}
                  </Link>
                  <span className="neu-mono text-text-secondary">Sent {r.createdLabel}</span>
                </span>
                <span className="flex flex-col items-end gap-1">
                  <Badge tone={r.status === "approved" ? "success" : r.status === "rejected" ? "error" : r.status === "more_info" ? "warning" : "info"}>{REQUEST_STATUS[r.status] ?? r.status}</Badge>
                  {r.status === "pending" ? <span className="text-caption text-text-secondary">Reviewed within {r.reviewDays} working days</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <form method="get" role="search" className="flex flex-wrap items-end gap-3" aria-label="Find a society">
        <div className="flex min-w-56 flex-1 flex-col gap-1.5">
          <Label htmlFor="society-q">Search</Label>
          <Input id="society-q" name="q" defaultValue={q} placeholder="Society name" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="society-cat">Category</Label>
          <select id="society-cat" name="category" defaultValue={category} className={cn(controlBase, "h-10")}>
            <option value="">All</option>
            {SOCIETY_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className={buttonClass("secondary", "md")}>
          <MagnifyingGlass aria-hidden weight="bold" className="size-4" />
          Search
        </button>
      </form>

      {dir.items.length === 0 ? (
        <EmptyState
          object="campus"
          title={q || category ? "No society matches that" : "No verified societies yet"}
          description={q || category ? "Try another name or category." : "If you run a society, request it: Skilient checks it with your university's records."}
        />
      ) : (
        <>
          {own.length ? (
            <section aria-labelledby="own-h" className="flex flex-col gap-3">
              <h2 id="own-h" className="text-h3">
                {dir.university ?? "Your university"}
              </h2>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {own.map((s) => (
                  <SocietyCard key={s.id} s={s} following={s.following} member={s.member} />
                ))}
              </div>
            </section>
          ) : null}
          {others.length ? (
            <section aria-labelledby="others-h" className="flex flex-col gap-3">
              <h2 id="others-h" className="text-h3">
                Other universities
              </h2>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {others.map((s) => (
                  <SocietyCard key={s.id} s={s} following={s.following} member={s.member} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}
