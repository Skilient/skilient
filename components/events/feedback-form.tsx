"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { Button, Label, Textarea } from "@/components/ui";
import { submitEventFeedback } from "@/lib/actions/events";
import { cn } from "@/lib/cn";

/** Feedback for 7 days after the event (PRD 5.31): a 1–5 rating and an optional comment. Officers see totals only from 5 answers. */
export function FeedbackForm({ eventId }: { eventId: string }) {
  const id = useId();
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form
      method="post"
      className="neu-card flex flex-col gap-3 p-5"
      data-testid="feedback-form"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          setError(null);
          const r = await submitEventFeedback({ eventId, rating, comment });
          if (!r.ok) return setError(r.message);
          router.refresh();
        });
      }}
    >
      <h2 className="text-h4">How was it?</h2>
      {error ? <FormAlert>{error}</FormAlert> : null}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-body-sm text-text-secondary">Your rating (the society sees totals, not who said what)</legend>
        <div role="radiogroup" aria-label="Rating" className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} out of 5`}
              onClick={() => setRating(n)}
              className={cn("neu-mono inline-flex size-11 items-center justify-center rounded-full", rating === n ? "neu-chip text-text-primary" : "neu-well-s text-text-secondary")}
            >
              {n}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-c`}>Anything to add (optional)</Label>
        <Textarea id={`${id}-c`} rows={3} maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} />
      </div>
      <Button type="submit" loading={pending} className="self-start">
        Send feedback
      </Button>
    </form>
  );
}
