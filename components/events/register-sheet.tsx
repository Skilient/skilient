"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { Button, Dialog, DialogContent, DialogTrigger, Input, Label, Textarea } from "@/components/ui";
import { registerForEvent } from "@/lib/actions/events";
import { pkr } from "@/lib/societies/constants";

export interface RegisterSheetProps {
  eventId: string;
  society: string;
  ticketTypes: { id: string; name: string; pricePkr: number | null; left: number }[];
  questions: { position: number; label: string; kind: string; options: string[]; required: boolean }[];
  team: { min: number; max: number } | null;
  approvalMode: string;
  refundLine: string | null;
}

/**
 * Register (PRD 5.31 flow B): pick a ticket type, answer the form, create or join a team. A full
 * ticket type puts you on its waitlist; a paid one holds the seat for 24 hours while you pay the
 * society and upload the receipt on your ticket page. SQL takes the seat lock and re-checks everything.
 */
export function RegisterSheet({ eventId, society, ticketTypes, questions, team, approvalMode, refundLine }: RegisterSheetProps) {
  const id = useId();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [ticket, setTicket] = useState(ticketTypes[0]?.id ?? "");
  const [answers, setAnswers] = useState<(string | string[])[]>(questions.map((q) => (q.kind === "multi" ? [] : "")));
  const [teamMode, setTeamMode] = useState<"create" | "join">("create");
  const [teamName, setTeamName] = useState("");
  const [teamCode, setTeamCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const chosen = ticketTypes.find((t) => t.id === ticket);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await registerForEvent({
        eventId,
        ticketTypeId: ticket,
        answers,
        team: team ? (teamMode === "create" ? { create: teamName, code: "" } : { create: "", code: teamCode }) : null,
      });
      if (!r.ok) return setError(r.message);
      setOpen(false);
      router.push(`/events/${eventId}/ticket` as Route);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" data-testid="register">
          Register
        </Button>
      </DialogTrigger>
      <DialogContent title="Register" description={approvalMode === "manual" ? `${society} approves each registration.` : undefined} className="max-h-[90dvh] overflow-y-auto">
        <form method="post" onSubmit={submit} className="flex flex-col gap-4" data-testid="register-form">
          {error ? <FormAlert>{error}</FormAlert> : null}
          <fieldset className="flex flex-col gap-2">
            <legend className="text-label text-text-secondary uppercase">Ticket</legend>
            {ticketTypes.map((t) => (
              <label key={t.id} className="neu-tile flex items-center justify-between gap-3 p-3 text-body">
                <span className="flex items-center gap-2">
                  <input type="radio" name={`${id}-ticket`} value={t.id} checked={ticket === t.id} onChange={() => setTicket(t.id)} className="size-4 accent-[var(--primary)]" />
                  {t.name}
                </span>
                <span className="neu-mono text-text-secondary">
                  {t.pricePkr ? pkr(t.pricePkr) : "Free"} · {t.left > 0 ? `${t.left} left` : "waitlist"}
                </span>
              </label>
            ))}
          </fieldset>
          {chosen?.pricePkr ? (
            <p className="text-body-sm text-text-secondary" data-testid="paid-note">
              You pay {society} directly ({pkr(chosen.pricePkr)}). Skilient doesn&apos;t handle the money. Your seat is held for 24 hours while you pay and upload the receipt.
              {refundLine ? ` ${refundLine}` : ""}
            </p>
          ) : null}
          {questions.map((q, i) => (
            <div key={q.position} className="flex flex-col gap-1.5">
              {q.kind === "single" || q.kind === "multi" ? (
                <fieldset className="flex flex-col gap-1.5">
                  <legend className="text-body font-semibold">
                    {q.label}
                    {q.required ? <span className="text-text-secondary"> (required)</span> : null}
                  </legend>
                  {q.options.map((o) => (
                    <label key={o} className="flex items-center gap-2 text-body">
                      <input
                        type={q.kind === "single" ? "radio" : "checkbox"}
                        name={`${id}-q${i}`}
                        value={o}
                        checked={q.kind === "single" ? answers[i] === o : (answers[i] as string[]).includes(o)}
                        onChange={(e) =>
                          setAnswers(
                            answers.map((a, j) =>
                              j !== i ? a : q.kind === "single" ? o : e.target.checked ? [...(a as string[]), o] : (a as string[]).filter((x) => x !== o),
                            ),
                          )
                        }
                        className="size-4 accent-[var(--primary)]"
                      />
                      {o}
                    </label>
                  ))}
                </fieldset>
              ) : (
                <>
                  <Label htmlFor={`${id}-q${i}`}>
                    {q.label}
                    {q.required ? <span className="text-text-secondary"> (required)</span> : null}
                  </Label>
                  {q.kind === "long" ? (
                    <Textarea id={`${id}-q${i}`} rows={3} maxLength={2000} value={answers[i] as string} onChange={(e) => setAnswers(answers.map((a, j) => (j === i ? e.target.value : a)))} />
                  ) : (
                    <Input id={`${id}-q${i}`} maxLength={200} value={answers[i] as string} onChange={(e) => setAnswers(answers.map((a, j) => (j === i ? e.target.value : a)))} />
                  )}
                </>
              )}
            </div>
          ))}
          {team ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="text-label text-text-secondary uppercase">
                Team ({team.min}–{team.max} people)
              </legend>
              <label className="flex items-center gap-2 text-body">
                <input type="radio" name={`${id}-team`} checked={teamMode === "create"} onChange={() => setTeamMode("create")} className="size-4 accent-[var(--primary)]" />
                Create a team (you&apos;re the captain; share its code)
              </label>
              <label className="flex items-center gap-2 text-body">
                <input type="radio" name={`${id}-team`} checked={teamMode === "join"} onChange={() => setTeamMode("join")} className="size-4 accent-[var(--primary)]" />
                Join a team with its code
              </label>
              {teamMode === "create" ? (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`${id}-tname`}>Team name</Label>
                  <Input id={`${id}-tname`} value={teamName} maxLength={60} onChange={(e) => setTeamName(e.target.value)} />
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`${id}-tcode`}>Team code</Label>
                  <Input id={`${id}-tcode`} value={teamCode} maxLength={12} onChange={(e) => setTeamCode(e.target.value.toUpperCase())} className="font-mono" />
                </div>
              )}
            </fieldset>
          ) : null}
          <Button type="submit" loading={pending} data-testid="confirm-register">
            {chosen && chosen.left <= 0 ? "Join the waitlist" : chosen?.pricePkr ? "Hold my seat" : "Register"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
