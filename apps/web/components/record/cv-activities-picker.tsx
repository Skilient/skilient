"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Button, FieldError } from "@/components/ui";
import { saveCvActivities } from "@/lib/actions/record";

/**
 * "Leadership and activities" on the CV (PRD 5.30, question 4): the student picks sealed Record
 * entries. The CV prints each plainly; the evidence stays on the verify page. Applies at the next
 * version, like every CV setting.
 */
export function CvActivitiesPicker({
  entries,
  selected,
  max,
  applyLabel,
}: {
  entries: { id: string; label: string; meta: string }[];
  selected: string[];
  max: number;
  applyLabel: string;
}) {
  const id = useId();
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>(selected);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  if (!entries.length) {
    return <p className="text-body-sm text-text-secondary">Sealed entries on your Record can go on your CV. You have none yet.</p>;
  }
  return (
    <form
      method="post"
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setMessage(null);
        startTransition(async () => {
          const r = await saveCvActivities({ entryIds: picked });
          if (!r.ok) setError(r.message);
          else {
            setMessage(`Saved. Your CV shows them from the ${applyLabel} version.`);
            router.refresh();
          }
        });
      }}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-body-sm text-text-secondary">Pick up to {max}.</legend>
        {entries.map((e) => (
          <label key={e.id} htmlFor={`${id}-${e.id}`} className="flex items-start gap-3 text-body">
            <input
              id={`${id}-${e.id}`}
              type="checkbox"
              className="mt-1 size-4"
              checked={picked.includes(e.id)}
              disabled={!picked.includes(e.id) && picked.length >= max}
              onChange={(ev) => setPicked((p) => (ev.target.checked ? [...p, e.id] : p.filter((x) => x !== e.id)))}
            />
            <span>
              <span className="font-semibold">{e.label}</span>
              <span className="block text-body-sm text-text-secondary">{e.meta}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div>
        <Button type="submit" variant="secondary" loading={pending} data-testid="save-cv-activities">
          Save activities
        </Button>
      </div>
      {error ? <FieldError>{error}</FieldError> : null}
      <p role="status" className="text-body-sm text-text-secondary">
        {message}
      </p>
    </form>
  );
}
