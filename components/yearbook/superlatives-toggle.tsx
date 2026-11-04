"use client";

import { useId, useState, useTransition } from "react";
import { FieldError, Switch } from "@/components/ui";
import { setSuperlativesOptOut } from "@/lib/actions/yearbook";

/** "Take part in yearbook superlatives": on by default (PRD 5.33). Off: never an option to vote for, and no voting. */
export function SuperlativesToggle({ initialOptOut }: { initialOptOut: boolean }) {
  const id = useId();
  const [on, setOn] = useState(!initialOptOut);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-2 px-5 py-4" aria-busy={pending || undefined} id="yearbook">
      <div className="flex items-start justify-between gap-4">
        <div>
          <label htmlFor={id} className="text-h4">
            Take part in yearbook superlatives
          </label>
          <p className="text-body-sm text-text-secondary" id={`${id}-desc`}>
            In your final year your department votes kind titles like &ldquo;Best teammate&rdquo;. Votes are secret and counts are never shown. Turn this off and
            you&apos;re never an option to vote for, you don&apos;t vote, and a title you were told about is declined.
          </p>
        </div>
        <Switch
          id={id}
          aria-describedby={`${id}-desc`}
          checked={on}
          disabled={pending}
          data-testid="superlatives-toggle"
          onCheckedChange={(next) => {
            setError(null);
            setSaved(false);
            startTransition(async () => {
              const r = await setSuperlativesOptOut({ on: !next });
              if (r.ok) {
                setOn(next);
                setSaved(true);
              } else setError(r.message);
            });
          }}
        />
      </div>
      <p role="status" className="text-caption text-text-secondary">
        {saved ? "Saved." : ""}
      </p>
      {error ? <FieldError>{error}</FieldError> : null}
    </div>
  );
}
