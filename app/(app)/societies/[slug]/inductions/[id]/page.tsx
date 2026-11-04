import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/societies/action-button";
import { ApplyForm } from "@/components/societies/apply-form";
import { PageTitle } from "@/components/uni/page-parts";
import { Badge, EmptyState } from "@/components/ui";
import { decideInductionApplication, publishInductionRound } from "@/lib/actions/societies";
import { isRefusal } from "@/lib/data/rpc-json";
import { getInductionRound, type InductionRound } from "@/lib/data/societies";
import { INDUCTION_STATUS } from "@/lib/societies/constants";

export const metadata: Metadata = { title: "Induction round" };

/** An induction round (PRD 5.31): roles and questions; students apply once, officers decide. */
export default async function InductionRoundPage({ params }: PageProps<"/societies/[slug]/inductions/[id]">) {
  const { slug, id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  let r: InductionRound;
  try {
    r = await getInductionRound(id);
  } catch (err) {
    if (isRefusal(err, "P0002", "42501")) notFound();
    throw err;
  }
  if (r.society.slug !== slug) notFound();
  const roleTitle = (rid: string) => r.roles.find((x) => x.id === rid)?.title ?? "";
  const mine = r.mine ? INDUCTION_STATUS[r.mine.status] : null;

  return (
    <main className="mx-auto flex w-full max-w-page flex-col gap-6 px-[var(--page-gutter)] py-6" data-testid="induction-round">
      <Link href={`/societies/${slug}?tab=inductions` as Route} className="inline-flex items-center gap-1 text-body-sm font-semibold underline-offset-4 hover:underline">
        <ArrowLeft aria-hidden weight="bold" className="size-4" />
        {r.society.name}
      </Link>
      <PageTitle title={r.title}>{r.description ?? undefined}</PageTitle>
      <p className="flex flex-wrap items-center gap-2 text-body-sm">
        {r.status === "draft" ? <Badge tone="neutral">Draft</Badge> : r.closed ? <Badge tone="neutral">Closed</Badge> : <Badge tone="info">Open</Badge>}
        <span className="neu-mono text-text-secondary">Closes {r.deadlineLabel}</span>
      </p>

      <section aria-labelledby="roles-h" className="flex flex-col gap-2">
        <h2 id="roles-h" className="text-h3">
          Roles
        </h2>
        <ul className="flex flex-wrap gap-2">
          {r.roles.map((x) => (
            <li key={x.id} className="neu-tile px-3 py-2 text-body-sm">
              {x.title} <span className="neu-mono text-text-secondary">{Math.max(x.seats - x.filled, 0)}/{x.seats} open</span>
            </li>
          ))}
        </ul>
      </section>

      {r.officer ? (
        <>
          {r.status === "draft" ? (
            <ActionButton action={publishInductionRound} args={{ roundId: r.id }} variant="primary" testId="publish-round">
              Publish the round
            </ActionButton>
          ) : null}
          <section aria-labelledby="apps-h" className="flex flex-col gap-3" data-testid="applications">
            <h2 id="apps-h" className="text-h3">
              Applications
            </h2>
            {r.applications?.length ? (
              <ul className="flex flex-col gap-3">
                {r.applications.map((a) => {
                  const st = INDUCTION_STATUS[a.status];
                  return (
                    <li key={a.id} className="neu-card flex flex-col gap-2 p-4" data-testid="application">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{a.name}</span>
                        <span className="text-caption text-text-secondary">for {roleTitle(a.roleId)}</span>
                        {st ? <Badge tone={st.tone}>{st.label}</Badge> : null}
                        <span className="neu-mono text-text-secondary">{a.createdLabel}</span>
                      </p>
                      <dl className="flex flex-col gap-2 text-body-sm">
                        {r.questions.map((q, i) => (
                          <div key={i}>
                            <dt className="text-text-secondary">{q}</dt>
                            <dd className="whitespace-pre-line">{a.answers[i]}</dd>
                          </div>
                        ))}
                      </dl>
                      {a.status === "pending" || a.status === "shortlisted" ? (
                        <span className="flex flex-wrap gap-2">
                          {a.status === "pending" ? (
                            <ActionButton action={decideInductionApplication} args={{ applicationId: a.id, action: "shortlist" }}>
                              Shortlist
                            </ActionButton>
                          ) : null}
                          <ActionButton action={decideInductionApplication} args={{ applicationId: a.id, action: "accept" }} variant="primary" testId="accept-application">
                            Accept
                          </ActionButton>
                          <ActionButton action={decideInductionApplication} args={{ applicationId: a.id, action: "decline" }} variant="ghost">
                            Decline
                          </ActionButton>
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState object="envelope" title="No applications yet" description="Applications show up here as students send them." />
            )}
          </section>
        </>
      ) : r.mine ? (
        <section className="neu-card flex flex-col gap-2 p-5" data-testid="my-application">
          <h2 className="text-h4">Your application</h2>
          <p className="flex items-center gap-2 text-body-sm">
            {mine ? <Badge tone={mine.tone}>{mine.label}</Badge> : null} for {roleTitle(r.mine.roleId)}
          </p>
          {r.mine.note ? <p className="text-body-sm text-text-secondary">{r.mine.note}</p> : null}
        </section>
      ) : r.closed ? (
        <p className="text-body-sm text-text-secondary">This round has closed.</p>
      ) : (
        <ApplyForm roundId={r.id} roles={r.roles.map((x) => ({ id: x.id, title: x.title, open: x.filled < x.seats }))} questions={r.questions} />
      )}
    </main>
  );
}
