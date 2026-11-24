import type { Metadata, Route } from "next";
import Link from "next/link";
import { PathCards } from "@/components/growth/path-cards";
import { PathLadder } from "@/components/growth/path-ladder";
import { Pictogram } from "@/components/growth/pictogram";
import { Badge, buttonClass, EmptyState } from "@/components/ui";
import { getMyPaths, getPathView } from "@/lib/data/growth";
import { TASK_STATUS_LABELS } from "@/lib/growth/constants";

export const metadata: Metadata = { title: "Paths" };

/**
 * /me/paths (PRD 5.32, screen spec §3.14 "Paths"): role cards, then the ladder of the chosen path
 * (a followed one first). Squares open the skill drawer. Open tasks and reviews asked of you sit
 * beside it. States: starter path, no GitHub, all proved.
 */
export default async function PathsPage({ searchParams }: PageProps<"/me/paths">) {
  const sp = await searchParams;
  const mine = await getMyPaths();
  const asked = typeof sp.role === "string" && mine.roles.some((r) => r.role === sp.role) ? sp.role : null;
  const role = asked ?? mine.roles.find((r) => r.following)?.role ?? null;
  const view = role ? await getPathView(role) : null;
  const skill = typeof sp.skill === "string" ? sp.skill : null;

  return (
    <main className="mx-auto flex w-full max-w-page flex-col gap-6 px-[var(--page-gutter)] py-6" data-testid="paths-page">
      <header className="flex flex-col gap-1">
        <h1 className="text-h1">Paths</h1>
        <p className="max-w-prose text-body text-text-secondary">
          The skills seniors proved, in the order they proved them. Follow up to {mine.maxFollows} paths; each next square has a task that becomes evidence.
        </p>
      </header>

      {!mine.githubConnected ? (
        <div className="neu-well flex flex-wrap items-center justify-between gap-3 p-4" data-testid="paths-no-github">
          <p className="text-body-sm">Connect GitHub so your commits prove skills and tasks can be checked against your repositories.</p>
          <Link href="/settings/github" className={buttonClass("secondary", "sm")}>
            Connect GitHub
          </Link>
        </div>
      ) : null}

      <section aria-labelledby="roles-h">
        <h2 id="roles-h" className="sr-only">
          Roles
        </h2>
        <PathCards roles={mine.roles} current={role} maxFollows={mine.maxFollows} />
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section aria-labelledby="ladder-h" className="neu-card flex flex-col gap-4 p-5">
          {view ? (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <span className="neu-icon-btn size-11 text-text-primary">
                  <Pictogram name={view.pictogram} className="size-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 id="ladder-h" className="text-h2">
                    {view.name}
                  </h2>
                  <p className="text-body-sm text-text-secondary" data-testid="path-source">
                    {view.source === "data"
                      ? `Based on ${view.seniors} seniors' records, updated weekly`
                      : `Starter path: the order switches to seniors' records once ${mine.minSeniors} of them qualify`}
                  </p>
                </div>
                {view.following ? <Badge tone="verified">Following</Badge> : null}
              </div>
              {view.proved === view.total ? (
                <EmptyState
                  object="medallion-shine"
                  title={`Every ${view.name} square is proved`}
                  description="Teach what you know in a skill swap, or follow a second path."
                  action={<Link href="/swaps?tab=teach" className={buttonClass("secondary", "sm")}>Teach in a swap</Link>}
                />
              ) : null}
              <PathLadder role={view.role} steps={view.steps} initialSkill={skill} />
              <p className="neu-mono text-text-secondary" data-testid="path-footer">
                {view.proved} of {view.total} proved{view.next ? ` · next: ${view.next.name}` : ""}
              </p>
            </>
          ) : (
            <EmptyState
              title="Pick a path"
              description="Follow a role above to see its ladder: what to prove next, and a task for it."
            />
          )}
        </section>

        <aside className="flex flex-col gap-4">
          <section aria-labelledby="tasks-h" className="neu-card flex flex-col gap-2 p-5">
            <h2 id="tasks-h" className="text-h4">
              Your open tasks
            </h2>
            {mine.tasks.length ? (
              <ul className="flex flex-col gap-2" data-testid="open-tasks">
                {mine.tasks.map((t) => (
                  <li key={t.id} className="flex flex-col">
                    <Link href={`/me/tasks/${t.id}` as Route} className="font-semibold underline-offset-4 hover:underline">
                      {t.title}
                    </Link>
                    <span className="text-caption text-text-secondary">
                      {t.skill} · {TASK_STATUS_LABELS[t.status]} · since {t.startedLabel}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-body-sm text-text-secondary">None open. Start one from a square&apos;s drawer.</p>
            )}
          </section>
          <section aria-labelledby="reviews-h" className="neu-card flex flex-col gap-2 p-5">
            <h2 id="reviews-h" className="text-h4">
              Reviews asked of you
            </h2>
            {mine.reviews.length ? (
              <ul className="flex flex-col gap-2" data-testid="review-offers">
                {mine.reviews.map((v) => (
                  <li key={v.id} className="flex flex-col">
                    <Link href={`/me/tasks/reviews/${v.id}` as Route} className="font-semibold underline-offset-4 hover:underline">
                      {v.student}&apos;s {v.skill} task
                    </Link>
                    <span className="text-caption text-text-secondary">
                      {v.title} · {v.status === "accepted" ? "you're reviewing" : `asked ${v.offeredLabel}`}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-body-sm text-text-secondary">
                None right now. Students with a skill at L2 are asked to check others&apos; tasks ({mine.reviewsLeft} left this week).
              </p>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}
