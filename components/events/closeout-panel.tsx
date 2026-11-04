"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Badge, Button, Input, Label } from "@/components/ui";
import { controlBase } from "@/components/ui/field";
import { fixAttendance, issueEventEntries, logVolunteerHours, setEventResult } from "@/lib/actions/events";
import type { CloseoutData } from "@/lib/data/events";
import { cn } from "@/lib/cn";

/**
 * Close-out (PRD 5.31): within 72 hours of the end, officers fix attendance (with a reason), record
 * results and volunteer hours, and see who earns what. Issuing stores that preview; The Record turns it
 * into entries in phase 16. Close-out issues by itself when the window ends.
 */
export function CloseoutPanel({ c, eventId }: { c: CloseoutData; eventId: string }) {
  const id = useId();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [fix, setFix] = useState({ userId: c.attendees[0]?.userId ?? "", sessionId: c.sessions[0]?.id ?? "", present: true, reason: "" });
  const [result, setResult] = useState({ who: c.teams.length ? `t:${c.teams[0].id}` : `u:${c.attendees[0]?.userId ?? ""}`, place: 1, label: "" });
  const [hours, setHours] = useState({ userId: c.attendees[0]?.userId ?? "", hours: c.activityHours ?? 1 });
  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    startTransition(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) return setError(r.message ?? "That didn't work.");
      router.refresh();
    });
  const editable = c.open && !c.issued;

  return (
    <div className="flex flex-col gap-6" data-testid="closeout">
      <p className="text-body-sm text-text-secondary">
        {c.issued
          ? `Issued ${c.issued.atLabel}${c.issued.auto ? " automatically" : ""}. Entries appear on attendees' Records when The Record opens.`
          : c.open
            ? `Close-out is open until ${c.closesLabel}. It issues by itself then.`
            : "Close-out opens when the last session ends."}
      </p>
      {error ? (
        <p role="alert" className="text-body-sm text-text-error">
          {error}
        </p>
      ) : null}
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5" data-testid="issue-preview">
        {(
          [
            ["Attended", c.counts.attended],
            ["Completed", c.counts.completed],
            ["Results", c.counts.results],
            ["Volunteer hours", c.counts.volunteer],
            ["Added by email", c.counts.emails],
          ] as const
        ).map(([label, n]) => (
          <div key={label} className="neu-tile flex flex-col p-3">
            <dt className="text-caption text-text-secondary">{label}</dt>
            <dd className="neu-mono text-h3">{n}</dd>
          </div>
        ))}
      </dl>

      <div className="overflow-x-auto rounded-lg">
        <table className="w-full min-w-[520px] text-left text-body-sm" data-testid="closeout-attendees">
          <thead className="text-caption text-text-secondary">
            <tr>
              <th scope="col" className="px-3 py-2">Attendee</th>
              <th scope="col" className="px-3 py-2">Sessions</th>
              <th scope="col" className="px-3 py-2">Place</th>
              <th scope="col" className="px-3 py-2">Hours</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-muted">
            {c.attendees.map((a) => (
              <tr key={a.userId}>
                <td className="px-3 py-2">{a.name}</td>
                <td className="neu-mono px-3 py-2">
                  {a.sessions}/{c.sessions.length}
                </td>
                <td className="neu-mono px-3 py-2">{a.place ?? (a.teamId ? (c.teams.find((t) => t.id === a.teamId)?.place ?? "") : "")}</td>
                <td className="neu-mono px-3 py-2">{a.hours ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editable ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <form method="post" className="neu-card flex flex-col gap-3 p-4" onSubmit={(e) => (e.preventDefault(), run(() => fixAttendance({ eventId, ...fix })))} data-testid="fix-attendance">
            <h3 className="text-h4">Fix attendance</h3>
            <div className="flex flex-col gap-1">
              <Label htmlFor={`${id}-fu`}>Attendee</Label>
              <select id={`${id}-fu`} value={fix.userId} onChange={(e) => setFix({ ...fix, userId: e.target.value })} className={cn(controlBase, "h-10")}>
                {c.attendees.map((a) => (
                  <option key={a.userId} value={a.userId}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor={`${id}-fs`}>Session</Label>
              <select id={`${id}-fs`} value={fix.sessionId} onChange={(e) => setFix({ ...fix, sessionId: e.target.value })} className={cn(controlBase, "h-10")}>
                {c.sessions.map((s, i) => (
                  <option key={s.id} value={s.id}>
                    {s.title ?? `Session ${i + 1}`} · {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-4 text-body-sm">
              <label className="flex items-center gap-2">
                <input type="radio" checked={fix.present} onChange={() => setFix({ ...fix, present: true })} className="size-4 accent-[var(--primary)]" />
                Was there
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={!fix.present} onChange={() => setFix({ ...fix, present: false })} className="size-4 accent-[var(--primary)]" />
                Wasn&apos;t there
              </label>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor={`${id}-fr`}>Reason</Label>
              <Input id={`${id}-fr`} value={fix.reason} maxLength={300} onChange={(e) => setFix({ ...fix, reason: e.target.value })} />
            </div>
            <Button type="submit" size="sm" variant="secondary" loading={pending} className="self-start">
              Save
            </Button>
          </form>
          {c.recordKinds.includes("result") ? (
            <form
              method="post"
              className="neu-card flex flex-col gap-3 p-4"
              data-testid="set-result"
              onSubmit={(e) => {
                e.preventDefault();
                const [kind, who] = result.who.split(":");
                run(() => setEventResult({ eventId, userId: kind === "u" ? who : null, teamId: kind === "t" ? who : null, place: result.place, label: result.label }));
              }}
            >
              <h3 className="text-h4">Results</h3>
              <div className="flex flex-col gap-1">
                <Label htmlFor={`${id}-rw`}>Team or person</Label>
                <select id={`${id}-rw`} value={result.who} onChange={(e) => setResult({ ...result, who: e.target.value })} className={cn(controlBase, "h-10")}>
                  {c.teams.map((t) => (
                    <option key={t.id} value={`t:${t.id}`}>
                      Team {t.name}
                    </option>
                  ))}
                  {c.attendees.map((a) => (
                    <option key={a.userId} value={`u:${a.userId}`}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <div className="flex w-24 flex-col gap-1">
                  <Label htmlFor={`${id}-rp`}>Place</Label>
                  <Input id={`${id}-rp`} type="number" min={0} max={10} value={result.place} onChange={(e) => setResult({ ...result, place: Number(e.target.value) || 0 })} />
                </div>
                <div className="flex flex-1 flex-col gap-1">
                  <Label htmlFor={`${id}-rl`}>Award (optional)</Label>
                  <Input id={`${id}-rl`} value={result.label} maxLength={60} onChange={(e) => setResult({ ...result, label: e.target.value })} placeholder="Best design" />
                </div>
              </div>
              <Button type="submit" size="sm" variant="secondary" loading={pending} className="self-start">
                Save result
              </Button>
            </form>
          ) : null}
          {c.volunteerHours ? (
            <form method="post" className="neu-card flex flex-col gap-3 p-4" onSubmit={(e) => (e.preventDefault(), run(() => logVolunteerHours({ eventId, ...hours })))} data-testid="volunteer-hours">
              <h3 className="text-h4">Volunteer hours</h3>
              <div className="flex flex-col gap-1">
                <Label htmlFor={`${id}-vu`}>Volunteer</Label>
                <select id={`${id}-vu`} value={hours.userId} onChange={(e) => setHours({ ...hours, userId: e.target.value })} className={cn(controlBase, "h-10")}>
                  {c.attendees.map((a) => (
                    <option key={a.userId} value={a.userId}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex w-32 flex-col gap-1">
                <Label htmlFor={`${id}-vh`}>Hours</Label>
                <Input id={`${id}-vh`} type="number" min={0} max={100} step={0.5} value={hours.hours} onChange={(e) => setHours({ ...hours, hours: Number(e.target.value) || 0 })} />
              </div>
              <Button type="submit" size="sm" variant="secondary" loading={pending} className="self-start">
                Save hours
              </Button>
            </form>
          ) : null}
        </div>
      ) : null}

      {c.fixes.length ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-h4">Attendance changes</h3>
          <ul className="flex flex-col gap-1 text-body-sm">
            {c.fixes.map((f, i) => (
              <li key={i}>
                <Badge tone={f.added ? "success" : "neutral"}>{f.added ? "Added" : "Removed"}</Badge> {f.name} · {f.reason} <span className="neu-mono text-text-secondary">{f.atLabel}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {editable ? (
        <Button type="button" loading={pending} className="self-start" onClick={() => run(() => issueEventEntries({ eventId }))} data-testid="issue-entries">
          Issue now
        </Button>
      ) : null}
    </div>
  );
}
