import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmSessionForm, ProposeSessionForm } from "@/components/growth/swap-forms";
import { ReportButton } from "@/components/reports/report-button";
import { ActionButton } from "@/components/societies/action-button";
import { Avatar, Badge, buttonClass, EmptyState } from "@/components/ui";
import { cancelSwapSession, decideSwapNote, endSwap, respondSwapSession } from "@/lib/actions/growth";
import { getSwap } from "@/lib/data/growth";
import { isRefusal } from "@/lib/data/rpc-json";
import { CLOSE_REASON_LABELS, hoursLabel, NO_SHOW_REASONS, SESSION_STATUS_LABELS, SWAP_STATUS_LABELS } from "@/lib/growth/constants";
import { formatCode } from "@/supabase/functions/_shared/cv/sign.ts";

export const metadata: Metadata = { title: "Skill swap" };

/**
 * /swaps/[id] (PRD 5.32, screen spec §3.14 "Swap"): header, sessions (propose, accept, the
 * learner's "did it happen?", thank-you notes the teacher approves), end the swap. States:
 * pending, expired, closed, no-show.
 */
export default async function SwapPage({ params }: PageProps<"/swaps/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const s = await getSwap(id).catch((err: unknown) => {
    if (isRefusal(err, "P0002", "42501", "22P02")) notFound();
    throw err;
  });
  const teacherName = s.role === "teacher" ? "you" : s.other.firstName;
  const open = s.status === "accepted" && !s.blocked;
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-[var(--page-gutter)] py-6" data-testid="swap-page">
      <nav aria-label="Breadcrumb" className="text-body-sm">
        <Link href="/swaps?tab=mine" className="underline underline-offset-4">
          Skill swap
        </Link>
      </nav>
      <header className="flex flex-wrap items-center gap-4">
        <Avatar name={s.other.name} src={s.other.avatarUrl} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-h2">
            {s.role === "teacher" ? `Teaching ${s.other.firstName} ${s.skill.name}` : `Learning ${s.skill.name} from ${s.other.firstName}`}
          </h1>
          <p className="neu-mono text-text-secondary">
            {s.teacherLevel ? `Teacher at L${s.teacherLevel}` : ""} · {s.confirmed.sessions} confirmed · {hoursLabel(s.confirmed.minutes)}
          </p>
          {s.mutual ? (
            <p className="text-body-sm">
              Mutual swap:{" "}
              <Link href={`/swaps/${s.mutual.id}` as Route} className="underline underline-offset-4">
                {s.mutual.skill} the other way
              </Link>
            </p>
          ) : null}
        </div>
        <Badge tone={s.status === "accepted" ? "success" : "neutral"} data-testid="swap-status">
          {SWAP_STATUS_LABELS[s.status]}
        </Badge>
      </header>

      {s.status === "requested" ? (
        <p className="neu-well p-4 text-body-sm" role="status">
          {s.role === "teacher" ? "Answer from the Teach tab" : `Waiting for ${s.other.firstName}`} by {s.expiresLabel}; after that the request expires.
        </p>
      ) : s.status === "expired" || s.status === "declined" || s.status === "cancelled" ? (
        <p className="neu-well p-4 text-body-sm" role="status">
          This request was {s.status}. {s.role === "learner" ? "You can ask again, or ask another teacher." : ""}
        </p>
      ) : s.status === "closed" ? (
        <div className="neu-well flex flex-col gap-1 p-4" role="status" data-testid="swap-closed">
          <p className="font-semibold">
            {s.closeReason ? CLOSE_REASON_LABELS[s.closeReason] : "Closed"} {s.closedLabel}.
          </p>
          {s.taughtCode ? (
            <p className="text-body-sm">
              {s.role === "teacher" ? "Your" : `${s.other.firstName}'s`} Record has a Taught entry for it:{" "}
              <Link href={`/verify/${s.taughtCode}` as Route} className="font-mono underline underline-offset-4">
                {formatCode(s.taughtCode)}
              </Link>
            </p>
          ) : s.confirmed.sessions ? (
            <p className="text-body-sm text-text-secondary">The Taught entry is being sealed.</p>
          ) : (
            <p className="text-body-sm text-text-secondary">No session was confirmed, so there is no Record entry.</p>
          )}
        </div>
      ) : null}

      {s.note || s.preferredTimes ? (
        <section aria-labelledby="req-h" className="neu-card flex flex-col gap-1 p-5">
          <h2 id="req-h" className="text-h4">
            The request
          </h2>
          {s.note ? <p className="text-body">{s.note}</p> : null}
          {s.preferredTimes ? <p className="text-body-sm text-text-secondary">Times: {s.preferredTimes}</p> : null}
          {s.offeredSkill ? <p className="text-body-sm text-text-secondary">Offered back: {s.offeredSkill}</p> : null}
        </section>
      ) : null}

      {open ? (
        <div className="flex flex-wrap gap-2">
          {s.threadId ? (
            <Link href={`/chat/${s.threadId}` as Route} className={buttonClass("secondary", "sm")} data-testid="swap-chat">
              Message {s.other.firstName}
            </Link>
          ) : null}
          <ActionButton action={endSwap} args={{ swapId: s.id }} variant="ghost" confirm="End this swap? Confirmed sessions stay, and the teacher's Taught entry is issued." testId="swap-end">
            End swap
          </ActionButton>
        </div>
      ) : null}

      <section aria-labelledby="sessions-h" className="neu-card flex flex-col gap-4 p-5">
        <h2 id="sessions-h" className="text-h3">
          Sessions
        </h2>
        {open ? <ProposeSessionForm swapId={s.id} /> : null}
        {s.sessions.length ? (
          <ul className="flex flex-col divide-y divide-[var(--border-muted)]" data-testid="swap-sessions">
            {s.sessions.map((x) => (
              <li key={x.id} className="flex flex-col gap-2 py-3" data-testid="swap-session">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{x.whenLabel}</span>
                  <span className="text-text-secondary">
                    · {hoursLabel(x.confirmedMinutes ?? x.minutes)} · {x.place}
                  </span>
                  <Badge tone={x.status === "confirmed" ? "success" : x.status === "no_show" ? "warning" : "neutral"}>{SESSION_STATUS_LABELS[x.status]}</Badge>
                </div>
                {x.status === "no_show" && x.noShowReason ? (
                  <p className="text-body-sm text-text-secondary">{NO_SHOW_REASONS.find((r) => r.value === x.noShowReason)?.label}</p>
                ) : null}
                {open && x.status === "proposed" && !x.proposedByMe && !x.started ? (
                  <div className="flex gap-2">
                    <ActionButton action={respondSwapSession} args={{ sessionId: x.id, accept: true }} variant="primary" testId="session-accept">
                      Accept
                    </ActionButton>
                    <ActionButton action={respondSwapSession} args={{ sessionId: x.id, accept: false }} variant="ghost">
                      Decline
                    </ActionButton>
                  </div>
                ) : null}
                {open && (x.status === "proposed" || x.status === "accepted") && !x.started ? (
                  <ActionButton action={cancelSwapSession} args={{ sessionId: x.id }} variant="ghost">
                    Cancel session
                  </ActionButton>
                ) : null}
                {open && x.status === "accepted" && x.started && s.role === "learner" ? (
                  <ConfirmSessionForm sessionId={x.id} teacher={teacherName} minutes={x.minutes} />
                ) : null}
                {x.status === "accepted" && x.started && s.role === "teacher" ? (
                  <p className="text-body-sm text-text-secondary">Waiting for {s.other.firstName} to confirm it happened.</p>
                ) : null}
                {x.note ? (
                  <div className="neu-well flex flex-col gap-2 p-3" data-testid="swap-note">
                    <p className="text-body-sm">&ldquo;{x.note.body}&rdquo;</p>
                    {s.role === "teacher" && x.note.status === "pending" ? (
                      <div className="flex gap-2">
                        <ActionButton action={decideSwapNote} args={{ noteId: x.note.id, approve: true }} variant="primary" testId="note-approve">
                          Show on my profile
                        </ActionButton>
                        <ActionButton action={decideSwapNote} args={{ noteId: x.note.id, approve: false }} variant="ghost">
                          Keep it private
                        </ActionButton>
                      </div>
                    ) : (
                      <p className="text-caption text-text-secondary">
                        {x.note.status === "approved" ? "On the profile" : x.note.status === "pending" ? "Waiting for approval" : "Kept private"}
                      </p>
                    )}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No sessions yet" description={open ? "Propose a time above; the other side accepts it and you both get a reminder." : "This swap had no sessions."} />
        )}
      </section>

      <div className="self-end">
        <ReportButton targetType="swap" targetId={s.id} compact />
      </div>
    </main>
  );
}
