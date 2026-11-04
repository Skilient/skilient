import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TaskPanel } from "@/components/growth/task-panel";
import { Badge, Stepper } from "@/components/ui";
import { getMyTask } from "@/lib/data/growth";
import { isRefusal } from "@/lib/data/rpc-json";
import { DIFFICULTY_LABELS, TASK_STATUS_LABELS, TASK_STEPS, taskStep, VERIFIED_BY_LABELS } from "@/lib/growth/constants";
import { formatCode } from "@/supabase/functions/_shared/cv/sign.ts";

export const metadata: Metadata = { title: "Proof task" };

const STATUS_TEXT: Partial<Record<string, string>> = {
  verifying: "We're rescanning your repository. If commits since you started show the skill, the task is done without a peer.",
  awaiting_peer: "GitHub didn't show it yet, so 3 students with the skill at L2 were asked to check it. A new 3 are asked after 7 days.",
  in_review: "A peer is checking your work against the list.",
  code_check: "A code check about your own code will decide it.",
};

/**
 * /me/tasks/[id] (PRD 5.32, screen spec §3.14 "Proof task"): the brief, the acceptance checklist,
 * status steps (Submitted → Verifying → Awaiting peer → Done), the repository link, the peer's
 * note. States: verifying, awaiting peer, needs changes, done.
 */
export default async function TaskPage({ params }: PageProps<"/me/tasks/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const task = await getMyTask(id).catch((err: unknown) => {
    if (isRefusal(err, "P0002", "42501", "22P02")) notFound();
    throw err;
  });
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-[var(--page-gutter)] py-6" data-testid="task-page">
      <nav aria-label="Breadcrumb" className="text-body-sm">
        <Link href={`/me/paths` as Route} className="underline underline-offset-4">
          Paths
        </Link>
      </nav>
      <header className="flex flex-col gap-2">
        <p className="neu-mono text-text-secondary">
          {task.skill.name} · {DIFFICULTY_LABELS[task.task.difficulty]}
        </p>
        <h1 className="text-h1">{task.task.title}</h1>
        <p>
          <Badge tone={task.status === "done" ? "success" : task.status === "needs_changes" ? "warning" : "neutral"} data-testid="task-status">
            {TASK_STATUS_LABELS[task.status]}
          </Badge>
        </p>
      </header>

      {task.status !== "abandoned" ? <Stepper steps={[...TASK_STEPS]} current={task.status === "done" ? TASK_STEPS.length : taskStep(task.status)} /> : null}

      {task.status === "done" ? (
        <div className="neu-well flex flex-col gap-1 p-4" data-testid="task-done">
          <p className="font-semibold">
            Done {task.doneLabel}, verified by {task.verifiedBy ? VERIFIED_BY_LABELS[task.verifiedBy] : "Skilient"}.
          </p>
          <p className="text-body-sm text-text-secondary">
            It is evidence for {task.skill.name} and a Proof task entry on{" "}
            <Link href="/me/record" className="underline underline-offset-4">
              your Record
            </Link>
            {task.recordCode ? (
              <>
                {" "}(
                <Link href={`/verify/${task.recordCode}` as Route} className="font-mono underline underline-offset-4">
                  {formatCode(task.recordCode)}
                </Link>
                )
              </>
            ) : " once it is sealed"}
            .
          </p>
        </div>
      ) : STATUS_TEXT[task.status] ? (
        <p className="neu-well p-4 text-body-sm" role="status">
          {STATUS_TEXT[task.status]}
          {task.status === "awaiting_peer" && task.peers.offered === 0 ? " No eligible peer is free right now; we keep asking." : ""}
        </p>
      ) : null}

      {task.status === "needs_changes" && task.note ? (
        <section aria-labelledby="note-h" className="neu-card flex flex-col gap-1 p-4" data-testid="task-note">
          <h2 id="note-h" className="text-h4">
            What to change
          </h2>
          <p className="text-body whitespace-pre-line">{task.note}</p>
        </section>
      ) : null}

      <section aria-labelledby="brief-h" className="neu-card flex flex-col gap-3 p-5">
        <h2 id="brief-h" className="text-h3">
          The brief
        </h2>
        <p className="text-body whitespace-pre-line">{task.task.brief}</p>
        <h3 className="text-h4">Done when</h3>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-body">
          {task.task.checklist.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="repo-h" className="neu-card flex flex-col gap-3 p-5">
        <h2 id="repo-h" className="text-h3">
          Your work
        </h2>
        {task.repo ? (
          <p className="text-body-sm">
            Repository:{" "}
            <a href={`https://github.com/${task.repo.fullName}`} className="font-mono underline underline-offset-4" target="_blank" rel="noreferrer noopener">
              {task.repo.fullName}
            </a>
            {task.submittedLabel ? <span className="text-text-secondary"> · submitted {task.submittedLabel}</span> : null}
          </p>
        ) : null}
        <TaskPanel task={task} />
      </section>
    </main>
  );
}
