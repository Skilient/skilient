"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { ActionButton } from "@/components/societies/action-button";
import { Button, buttonClass, controlBase, FieldError, Label } from "@/components/ui";
import { abandonTask, chooseTaskCodeCheck, linkTaskRepo, submitTask } from "@/lib/actions/growth";
import { cn } from "@/lib/cn";
import type { MyTask } from "@/lib/data/growth";

/**
 * The student's controls on /me/tasks/[id]: link a repository (GitHub first when it isn't
 * connected), submit, a code check where the skill has prompts, and drop the task.
 */
export function TaskPanel({ task }: { task: MyTask }) {
  const uid = useId();
  const router = useRouter();
  const [repo, setRepo] = useState<string>(task.repo ? String(task.repo.id) : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const editable = task.status === "started" || task.status === "needs_changes";
  const open = !["done", "abandoned"].includes(task.status);

  return (
    <div className="flex flex-col gap-4">
      {editable ? (
        !task.githubConnected ? (
          <div className="neu-well flex flex-col gap-2 p-4" data-testid="task-connect-github">
            <p className="text-body-sm">Connect GitHub first: the task is checked against one of your repositories.</p>
            <Link href="/settings/github" className={buttonClass("primary", "sm", "self-start")}>
              Connect GitHub
            </Link>
          </div>
        ) : (
          <form
            method="post"
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              startTransition(async () => {
                if (!task.repo || String(task.repo.id) !== repo) {
                  const linked = await linkTaskRepo({ attemptId: task.id, repoId: repo });
                  if (!linked.ok) return setError(linked.message);
                }
                const r = await submitTask({ attemptId: task.id });
                if (!r.ok) return setError(r.message);
                router.refresh();
              });
            }}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${uid}-repo`}>Link repository</Label>
              <select
                id={`${uid}-repo`}
                className={cn(controlBase, "h-11")}
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                required
                aria-describedby={error ? `${uid}-err` : undefined}
                data-testid="task-repo"
              >
                <option value="">Choose one of your repositories</option>
                {task.repos.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.fullName}
                  </option>
                ))}
              </select>
              {task.repos.length === 0 ? (
                <p className="text-caption text-text-secondary">No repositories yet. Share one with Skilient from Settings → GitHub.</p>
              ) : null}
            </div>
            {error ? <FieldError id={`${uid}-err`}>{error}</FieldError> : null}
            <Button type="submit" loading={pending} disabled={!repo} className="self-start" data-testid="task-submit">
              {task.status === "needs_changes" ? "Resubmit" : "Submit"}
            </Button>
          </form>
        )
      ) : null}

      {open && task.codeCheck.blocker === null && task.status !== "code_check" && task.status !== "in_review" ? (
        <div className="flex flex-col gap-1">
          <p className="text-body-sm text-text-secondary">Rather not wait for a peer? A code check about your own code decides it instead.</p>
          <ActionButton action={chooseTaskCodeCheck} args={{ attemptId: task.id }} testId="task-code-check">
            Take a code check instead
          </ActionButton>
        </div>
      ) : null}
      {task.status === "code_check" && task.codeCheck.id ? (
        <Link href={`/me/code-checks/${task.codeCheck.id}` as Route} className={buttonClass("secondary", "sm", "self-start")}>
          Open the code check
        </Link>
      ) : null}

      {open ? (
        <ActionButton action={abandonTask} args={{ attemptId: task.id }} variant="ghost" confirm="Drop this task? You can start it again later." testId="task-abandon">
          Drop this task
        </ActionButton>
      ) : null}
    </div>
  );
}
