import { ArrowRight, CaretRight, CheckCircle, Circle } from "@phosphor-icons/react/dist/ssr";
import type { Route } from "next";
import Link from "next/link";
import { DismissCardButton, DismissChecklistButton } from "@/components/home/progress-card-controls";
import { Button, TierBadge } from "@/components/ui";
import type { ProgressCard as ProgressCardData } from "@/lib/data/portal";
import { points } from "@/lib/ranking/labels";

function todoLine(t: ProgressCardData["todo"]): string {
  const parts: string[] = [];
  if (t.applications) parts.push(`${t.applications} join ${t.applications === 1 ? "request" : "requests"}`);
  if (t.invites) parts.push(`${t.invites} ${t.invites === 1 ? "invite" : "invites"}`);
  if (t.requests) parts.push(`${t.requests} friend ${t.requests === 1 ? "request" : "requests"}`);
  if (t.confirm) parts.push(`${t.confirm} ${t.confirm === 1 ? "contribution" : "contributions"} to confirm`);
  if (t.endorse) parts.push(`${t.endorse} ${t.endorse === 1 ? "venture" : "ventures"} to endorse`);
  return parts.join(", ");
}

/**
 * The Home progress card (PRD 5.25): tier and points, the single most valuable next step,
 * what is waiting on you, and the getting-started checklist (PRD 5.27) until it is done or
 * dismissed. Dismissible for the day. Everything is computed by SQL from existing tables.
 *
 * Since 2026-11-15 it sits in a column to the right of the feed when there is room ("column"),
 * and behind a one-line chip that opens it in a sheet when there isn't ("sheet", see
 * `ProgressChip`). It is grouped content, not a control, so it is a flat tile, not a raised card.
 */
export function ProgressCard({ card, variant = "column" }: { card: ProgressCardData; variant?: "column" | "sheet" }) {
  if (card.dismissed) return null;
  const { todo, checklist } = card;
  const showChecklist = !checklist.dismissed && checklist.done < checklist.total;
  const sheet = variant === "sheet";
  return (
    <section
      aria-labelledby={sheet ? undefined : "progress-h"}
      aria-label={sheet ? "Your progress" : undefined}
      className={sheet ? "flex flex-col gap-4" : "neu-flat flex flex-col gap-4 p-4"}
      data-testid={sheet ? "progress-sheet" : "progress-card"}
      // The tour's "Your progress" step lights the column; on narrow screens it lights the chip.
      data-tour={sheet ? undefined : "progress"}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          {sheet ? null : (
            <h2 id="progress-h" className="text-h4">
              Your progress
            </h2>
          )}
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body">
            {card.tier ? <TierBadge tier={card.tier} /> : <span className="font-semibold">Not ranked yet</span>}
            {card.scored ? <span className="text-body-sm text-text-secondary tabular-nums">{points(card.points)} points, only you see this</span> : null}
          </p>
        </div>
        {sheet ? null : <DismissCardButton />}
      </div>

      <div className="neu-well flex flex-col gap-2 p-3" data-testid="next-step">
        <p className="text-label text-text-secondary uppercase">Next step</p>
        <p className="text-h4">{card.action.title}</p>
        <p className="text-body-sm text-text-secondary">{card.action.body}</p>
        <div>
          <Button asChild size="sm">
            <Link href={card.action.href as Route}>
              Take this step <ArrowRight aria-hidden weight="bold" className="size-4" />
            </Link>
          </Button>
        </div>
      </div>

      {todo.total > 0 ? (
        <p className="text-body-sm" data-testid="todo-count">
          <Link href="/requests" className="font-semibold underline underline-offset-4">
            {todo.total} to do
          </Link>
          <span className="text-text-secondary">: {todoLine(todo)}</span>
        </p>
      ) : (
        <p className="text-body-sm text-text-secondary">You&apos;re all caught up: nothing is waiting on you.</p>
      )}

      {showChecklist ? (
        // Open in the column: there is room, and the list is the point of it.
        <details className="group" open={sheet ? undefined : true} data-testid="checklist">
          <summary className="flex cursor-pointer flex-col gap-2 rounded-md py-1 text-body-sm font-semibold">
            <span className="flex items-center justify-between gap-2">
              <span>
                Getting started: {checklist.done} of {checklist.total}
              </span>
              <CaretRight aria-hidden weight="bold" className="size-4 text-text-muted transition-transform group-open:rotate-90 motion-reduce:transition-none" />
            </span>
            {/* Progress fills, never spins (the brief). */}
            <span aria-hidden className="neu-well-s block h-2 overflow-hidden rounded-full">
              <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.round((checklist.done / Math.max(checklist.total, 1)) * 100)}%` }} />
            </span>
          </summary>
          <ul className="flex flex-col gap-2 pt-3">
            {checklist.items.map((item) => (
              <li key={item.key} className="flex items-start gap-2 text-body-sm">
                {item.done ? (
                  <CheckCircle aria-hidden weight="fill" className="mt-0.5 size-5 shrink-0 text-success" />
                ) : (
                  <Circle aria-hidden weight="bold" className="mt-0.5 size-5 shrink-0 text-text-muted" />
                )}
                <span className="flex min-w-0 flex-1 flex-col">
                  <Link href={item.href as Route} className={item.done ? "text-text-secondary line-through" : "underline-offset-4 hover:underline"}>
                    {item.label}
                  </Link>
                  <span className="sr-only">{item.done ? "(done)" : "(to do)"}</span>
                  {item.points !== null && !item.done ? (
                    <span className="text-caption text-text-secondary tabular-nums">
                      +{points(item.points)}
                      {item.note ? ` ${item.note}` : ""}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
          <div className="pt-2">
            <DismissChecklistButton />
          </div>
        </details>
      ) : null}
      {sheet ? (
        <div className="border-t border-border-muted pt-3">
          <DismissCardButton label />
        </div>
      ) : null}
    </section>
  );
}
