import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReviewForm } from "@/components/growth/review-form";
import { ActionButton } from "@/components/societies/action-button";
import { Badge } from "@/components/ui";
import { acceptTaskReview, declineTaskReview } from "@/lib/actions/growth";
import { getTaskReview } from "@/lib/data/growth";
import { isRefusal } from "@/lib/data/rpc-json";

export const metadata: Metadata = { title: "Review a proof task" };

const DONE: Partial<Record<string, string>> = {
  declined: "You declined this review. You won't be asked about this task again.",
  expired: "This review closed: nobody decided within 7 days, so other peers were asked.",
  withdrawn: "Someone else took this review, or the task was decided another way.",
  confirmed: "You confirmed this task. Thank you: reviews keep proof honest.",
  needs_changes: "You sent it back with a note. The student can resubmit.",
};

/**
 * /me/tasks/reviews/[id] (PRD 5.32 "Peer side"): "Can you check Hira's TypeScript task?" The brief,
 * the checklist and the repository link; accept, then Confirm or Needs changes. Reviews earn no
 * Record entry and are capped at 5 a week.
 */
export default async function TaskReviewPage({ params }: PageProps<"/me/tasks/reviews/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const r = await getTaskReview(id).catch((err: unknown) => {
    if (isRefusal(err, "P0002", "42501", "22P02")) notFound();
    throw err;
  });
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-[var(--page-gutter)] py-6" data-testid="review-page">
      <nav aria-label="Breadcrumb" className="text-body-sm">
        <Link href="/me/paths" className="underline underline-offset-4">
          Paths
        </Link>
      </nav>
      <header className="flex flex-col gap-2">
        <p className="neu-mono text-text-secondary">
          {r.skill} · {r.university ?? "Skilient"}
        </p>
        <h1 className="text-h1">
          Can you check {r.student}&apos;s {r.skill} task?
        </h1>
        <p className="text-body-sm text-text-secondary">You hold {r.skill} at L2 or higher. {r.reviewsLeft} reviews left this week.</p>
      </header>

      <section aria-labelledby="brief-h" className="neu-card flex flex-col gap-3 p-5">
        <h2 id="brief-h" className="text-h3">
          {r.task.title}
        </h2>
        <p className="text-body whitespace-pre-line">{r.task.brief}</p>
        {r.repo ? (
          <p className="text-body-sm">
            Repository:{" "}
            <a href={`https://github.com/${r.repo}`} className="font-mono underline underline-offset-4" target="_blank" rel="noreferrer noopener" data-testid="review-repo">
              {r.repo}
            </a>
            {r.submittedLabel ? <span className="text-text-secondary"> · submitted {r.submittedLabel}</span> : null}
          </p>
        ) : null}
      </section>

      {r.status === "offered" ? (
        <section aria-labelledby="decide-h" className="neu-card flex flex-col gap-3 p-5">
          <h2 id="decide-h" className="text-h3">
            Will you review it?
          </h2>
          <p className="text-body-sm text-text-secondary">The first of the peers asked to accept reviews it. Declining is fine; you won&apos;t be asked about this task again.</p>
          <div className="flex flex-wrap gap-2">
            <ActionButton action={acceptTaskReview} args={{ reviewId: r.id }} variant="primary" testId="review-accept">
              Accept
            </ActionButton>
            <ActionButton action={declineTaskReview} args={{ reviewId: r.id }} variant="ghost" testId="review-decline">
              Decline
            </ActionButton>
          </div>
        </section>
      ) : r.status === "accepted" ? (
        <section className="neu-card p-5">
          <ReviewForm reviewId={r.id} checklist={r.task.checklist} />
        </section>
      ) : (
        <p className="neu-well p-4 text-body-sm" role="status" data-testid="review-closed">
          <Badge tone="neutral">{r.status.replace("_", " ")}</Badge> {DONE[r.status]}
        </p>
      )}
    </main>
  );
}
