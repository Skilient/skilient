"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { Badge, Button, Dialog, Ladder, LoadingState, SheetContent, type LadderStep } from "@/components/ui";
import { loadSkillDrawer, startTask } from "@/lib/actions/growth";
import type { PathStep, SkillDrawer } from "@/lib/data/growth";
import { afterLabel, DIFFICULTY_LABELS, hoursLabel, TASK_STATUS_LABELS } from "@/lib/growth/constants";

const LADDER_STATE = { proved: "done", in_progress: "current", next: "next", later: "later" } as const;

/**
 * A path as a ladder of squares (PRD 5.32): proved (ticked, with the date L2 was reached), in
 * progress, the one next square, and later. A square opens the skill drawer. `?skill=` opens one.
 */
export function PathLadder({ role, steps, initialSkill }: { role: string; steps: PathStep[]; initialSkill: string | null }) {
  const [open, setOpen] = useState<string | null>(initialSkill && steps.some((s) => s.skillId === initialSkill) ? initialSkill : null);
  const ladder: LadderStep[] = steps.map((s) => ({
    key: s.skillId,
    label: s.name,
    state: LADDER_STATE[s.state],
    meta: s.state === "proved" ? s.provedOn : s.state === "in_progress" && s.attemptStatus ? TASK_STATUS_LABELS[s.attemptStatus] : undefined,
    action: (
      <button
        type="button"
        onClick={() => setOpen(s.skillId)}
        className="w-full text-left font-semibold text-text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
        data-testid="path-square"
        data-skill={s.skillId}
        data-state={s.state}
      >
        {s.name}
      </button>
    ),
  }));
  const current = steps.find((s) => s.skillId === open) ?? null;
  return (
    <>
      <Ladder steps={ladder} label="proved" />
      <Dialog open={open !== null} onOpenChange={(v) => !v && setOpen(null)}>
        {current ? (
          <SheetContent title={current.name} description="Why it's here, your evidence, tasks and who can teach it.">
            <DrawerBody skill={current.skillId} role={role} />
          </SheetContent>
        ) : null}
      </Dialog>
    </>
  );
}

function DrawerBody({ skill, role }: { skill: string; role: string | null }) {
  const router = useRouter();
  const [data, setData] = useState<SkillDrawer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fetchDrawer = useCallback(
    () =>
      loadSkillDrawer({ skill, role }).then((r) => {
        if (r.ok) {
          setError(null);
          setData(r.data);
        } else setError(r.message);
      }),
    [skill, role],
  );
  useEffect(() => {
    void fetchDrawer();
  }, [fetchDrawer]);
  const load = () => void fetchDrawer();

  if (error) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3">
        <p className="text-body-sm text-text-error">{error}</p>
        <Button variant="secondary" size="sm" onClick={load}>
          Try again
        </Button>
      </div>
    );
  }
  if (!data) return <LoadingState label="Loading the skill" lines={4} />;
  const why = data.why;
  return (
    <div className="flex flex-col gap-6" data-testid="skill-drawer">
      <section aria-labelledby="drawer-why">
        <h3 id="drawer-why" className="text-h4">
          Why it&apos;s here
        </h3>
        <p className="mt-1 text-body-sm text-text-secondary">
          {why
            ? why.source === "data"
              ? (afterLabel(why.prev, why.afterDays) ?? `Seniors on the ${why.path} path proved it first.`) + ` (${why.seniors} seniors' records).`
              : `Square ${why.position} of the ${why.path} starter path. It switches to the order seniors proved it in once enough of them have.`
            : "A skill you can prove with a task."}
        </p>
      </section>

      <section aria-labelledby="drawer-evidence">
        <h3 id="drawer-evidence" className="text-h4">
          Your evidence
        </h3>
        {data.level ? <p className="mt-1 neu-mono text-text-secondary">L{data.level} · {data.commits} commits found</p> : null}
        {data.evidence.length ? (
          <ul className="mt-2 flex flex-col gap-1 text-body-sm">
            {data.evidence.map((e, i) => (
              <li key={i}>
                <span className="font-semibold">{e.title}</span> {e.detail ? <span className="text-text-secondary">· {e.detail}</span> : null}
                {e.on ? <span className="text-text-secondary"> · {e.on}</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-body-sm text-text-secondary">Nothing yet. A proof task is the quickest way to show it.</p>
        )}
      </section>

      <section aria-labelledby="drawer-tasks">
        <h3 id="drawer-tasks" className="text-h4">
          Proof tasks
        </h3>
        {data.tasks.length ? (
          <ul className="mt-2 flex flex-col gap-2">
            {data.tasks.slice(0, 3).map((t) => (
              <li key={t.id} className="neu-tile flex flex-wrap items-center justify-between gap-2 p-3" data-testid="drawer-task">
                <span className="min-w-0">
                  <span className="font-semibold">{t.title}</span>{" "}
                  <Badge tone="neutral">{DIFFICULTY_LABELS[t.difficulty]}</Badge>
                </span>
                {t.attemptId ? (
                  <Link href={`/me/tasks/${t.attemptId}` as Route} className="text-body-sm font-semibold underline underline-offset-4">
                    {t.attemptStatus ? TASK_STATUS_LABELS[t.attemptStatus] : "Open"}
                  </Link>
                ) : (
                  <Button
                    size="sm"
                    loading={pending}
                    data-testid="start-task"
                    onClick={() =>
                      startTransition(async () => {
                        const r = await startTask({ taskId: t.id });
                        if (r.ok) router.push(`/me/tasks/${r.data}` as Route);
                        else setError(r.message);
                      })
                    }
                  >
                    Start
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-body-sm text-text-secondary">No tasks for this skill yet. GitHub work and skill swaps still prove it.</p>
        )}
      </section>

      <section aria-labelledby="drawer-teachers">
        <h3 id="drawer-teachers" className="text-h4">
          Learn it in a skill swap
        </h3>
        {data.teachers.length ? (
          <p className="mt-1 text-body-sm">
            <Link href={`/swaps?tab=learn&skill=${data.skill.id}` as Route} className="font-semibold underline underline-offset-4" data-testid="drawer-teachers">
              {data.teachers.length} {data.teachers.length === 1 ? "senior teaches" : "seniors teach"} {data.skill.name} in swaps
            </Link>
            <span className="text-text-secondary"> · {data.teachers.map((t) => `${t.name} (L${t.level}${t.minutes ? `, ${hoursLabel(t.minutes)} taught` : ""})`).join(", ")}</span>
          </p>
        ) : (
          <p className="mt-1 text-body-sm text-text-secondary">Nobody at your university teaches it yet. Add it to your wants on the skill swap.</p>
        )}
      </section>

      {data.openings.length ? (
        <section aria-labelledby="drawer-openings">
          <h3 id="drawer-openings" className="text-h4">
            Openings that need it
          </h3>
          <ul className="mt-1 flex flex-col gap-1 text-body-sm">
            {data.openings.map((o) => (
              <li key={o.ventureId}>
                <Link href={`/ventures/${o.ventureId}` as Route} className="font-semibold underline underline-offset-4">
                  {o.title}
                </Link>{" "}
                <span className="text-text-secondary">· {o.role}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
