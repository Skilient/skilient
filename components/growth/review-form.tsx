"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Button, Checkbox, FieldError, Label, Textarea } from "@/components/ui";
import { reviewTask } from "@/lib/actions/growth";

/** The peer's decision: tick the checklist, then Confirm (every item met) or Needs changes (a note). */
export function ReviewForm({ reviewId, checklist }: { reviewId: string; checklist: string[] }) {
  const uid = useId();
  const router = useRouter();
  const [ticks, setTicks] = useState<boolean[]>(checklist.map(() => false));
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const all = ticks.every(Boolean);
  const send = (confirm: boolean) =>
    startTransition(async () => {
      setError(null);
      const r = await reviewTask({ reviewId, confirm, note, ticks });
      if (!r.ok) return setError(r.message);
      router.refresh();
    });
  return (
    <form method="post" className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()} aria-labelledby={`${uid}-h`}>
      <h2 id={`${uid}-h`} className="text-h3">
        Check it against the list
      </h2>
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">Checklist</legend>
        {checklist.map((c, i) => (
          <div key={c} className="flex items-start gap-3">
            <Checkbox
              id={`${uid}-c${i}`}
              checked={ticks[i]}
              onCheckedChange={(v) => setTicks((t) => t.map((x, j) => (j === i ? v === true : x)))}
              data-testid="review-tick"
            />
            <Label htmlFor={`${uid}-c${i}`} className="font-normal">
              {c}
            </Label>
          </div>
        ))}
      </fieldset>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${uid}-note`}>Note {all ? "(optional)" : "(what needs to change)"}</Label>
        <Textarea id={`${uid}-note`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={4} data-testid="review-note" />
      </div>
      {error ? <FieldError>{error}</FieldError> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" loading={pending} disabled={!all} onClick={() => send(true)} data-testid="review-confirm">
          Confirm
        </Button>
        <Button type="button" variant="secondary" loading={pending} disabled={note.trim().length < 3} onClick={() => send(false)} data-testid="review-changes">
          Needs changes
        </Button>
      </div>
    </form>
  );
}
