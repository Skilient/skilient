"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Button, FieldError, Textarea } from "@/components/ui";
import { signYearbook } from "@/lib/actions/yearbook";

/**
 * Sign a yearbook page (PRD 5.33): one note per writer per page, editable until the owner approves it.
 * Only approved notes are shown to the batch; the writer sees their own as "Waiting for approval".
 */
export function SignForm({ username, ownerName, initial, max }: { username: string; ownerName: string; initial: string | null; max: number }) {
  const router = useRouter();
  const id = useId();
  const [body, setBody] = useState(initial ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <form
      method="post"
      className="flex flex-col gap-3"
      data-testid="yearbook-sign"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const r = await signYearbook({ username, body });
          if (r.ok) {
            setSaved(true);
            router.refresh();
          } else setError(r.message);
        });
      }}
    >
      <label htmlFor={id} className="text-body font-semibold">
        {initial ? "Edit your note" : `Sign ${ownerName.split(" ")[0]}'s page`}
      </label>
      <Textarea
        id={id}
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          setSaved(false);
        }}
        rows={4}
        maxLength={max}
        aria-describedby={`${id}-help${error ? ` ${id}-error` : ""}`}
        aria-invalid={error ? true : undefined}
      />
      <p id={`${id}-help`} className="text-caption text-text-secondary">
        {body.length}/{max}. {ownerName.split(" ")[0]} approves notes before the batch sees them.
      </p>
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending} disabled={!body.trim()}>
          {initial ? "Save note" : "Sign"}
        </Button>
        {saved ? (
          <p role="status" className="text-body-sm text-text-secondary">
            Sent. It shows once approved.
          </p>
        ) : null}
      </div>
    </form>
  );
}
