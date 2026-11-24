"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Button, Dialog, DialogClose, DialogContent, DialogFooter, DialogTrigger, FieldError, Input, Label, Textarea } from "@/components/ui";
import { correctRecordEntry, declineRecordMistake, revokeRecordEntry } from "@/lib/actions/record";
import { REVOKE_CATEGORIES } from "@/lib/record/constants";

/** Revoke one entry with a reason the student sees (PRD 5.30). Officers of the issuing society, or staff. */
export function RevokeEntryButton({ entryId, title }: { entryId: string; title: string }) {
  const uid = useId();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string>("issued_in_error");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="tertiary" aria-label={`Revoke ${title}`} data-testid="revoke-entry">
          Revoke
        </Button>
      </DialogTrigger>
      <DialogContent title="Revoke this entry" description={`${title}. Its code will read “revoked” at /verify, the student is told why, and they can appeal.`}>
        <fieldset className="mt-4 flex flex-col gap-2">
          <legend className="mb-1 text-body-sm font-semibold">Why</legend>
          {REVOKE_CATEGORIES.map((c) => (
            <label key={c.value} className="flex items-center gap-2 text-body">
              <input type="radio" name={`${uid}-cat`} value={c.value} checked={category === c.value} onChange={() => setCategory(c.value)} className="size-4" />
              {c.label}
            </label>
          ))}
        </fieldset>
        <div className="mt-3 flex flex-col gap-1">
          <Label htmlFor={`${uid}-r`}>Reason the student sees</Label>
          <Textarea id={`${uid}-r`} value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} />
        </div>
        {error ? <FieldError>{error}</FieldError> : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <Button
            variant="danger"
            loading={pending}
            data-testid="revoke-confirm"
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const r = await revokeRecordEntry({ entryId, category, reason });
                if (!r.ok) setError(r.message);
                else {
                  setOpen(false);
                  router.refresh();
                }
              })
            }
          >
            Revoke entry
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Answer a "Report a mistake": correct it (a new entry that supersedes this one) or keep it with a note. */
export function MistakeForm({
  mistake,
}: {
  mistake: { id: string; entryId: string; kind: string; title: string; line: string; place: number | null; hours: number | null };
}) {
  const uid = useId();
  const router = useRouter();
  const [title, setTitle] = useState(mistake.title);
  const [line, setLine] = useState("");
  const [place, setPlace] = useState(mistake.place ? String(mistake.place) : "");
  const [hours, setHours] = useState(mistake.hours ? String(mistake.hours) : "");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    startTransition(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.message ?? "That didn't work.");
      else router.refresh();
    });
  return (
    <form method="post" className="flex flex-col gap-3" onSubmit={(e) => e.preventDefault()} aria-busy={pending || undefined}>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${uid}-t`}>Title</Label>
        <Input id={`${uid}-t`} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
      </div>
      {mistake.kind === "result" ? (
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${uid}-p`}>Place</Label>
          <Input id={`${uid}-p`} inputMode="numeric" value={place} onChange={(e) => setPlace(e.target.value)} />
        </div>
      ) : null}
      {mistake.kind === "volunteer" ? (
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${uid}-h`}>Hours</Label>
          <Input id={`${uid}-h`} inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} />
        </div>
      ) : null}
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${uid}-l`}>Evidence line (optional)</Label>
        <Input id={`${uid}-l`} value={line} maxLength={140} placeholder={mistake.line} onChange={(e) => setLine(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${uid}-n`}>Note to the student</Label>
        <Input id={`${uid}-n`} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
      </div>
      {error ? <FieldError>{error}</FieldError> : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          loading={pending}
          data-testid="correct-entry"
          onClick={() =>
            run(() =>
              correctRecordEntry({
                entryId: mistake.entryId,
                title: title !== mistake.title ? title : undefined,
                line: line || undefined,
                place: mistake.kind === "result" && place && Number(place) !== mistake.place ? place : undefined,
                hours: mistake.kind === "volunteer" && hours && Number(hours) !== mistake.hours ? hours : undefined,
                note: note || undefined,
              }),
            )
          }
        >
          Correct it
        </Button>
        <Button type="button" variant="secondary" loading={pending} onClick={() => run(() => declineRecordMistake({ correctionId: mistake.id, note }))}>
          Keep it as it is
        </Button>
      </div>
    </form>
  );
}
