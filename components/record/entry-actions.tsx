"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AppealButton } from "@/components/appeals/appeal-button";
import { Button, Dialog, DialogClose, DialogContent, DialogFooter, DialogTrigger, FieldError, Textarea } from "@/components/ui";
import { reportRecordMistake, setRecordDisplay } from "@/lib/actions/record";
import { PdfButton } from "./pdf-button";

/**
 * What a student can do with one entry (PRD 5.30): pin to the profile (3 at most), hide from the
 * profile, download its signed certificate, copy the verify link, report a mistake to the issuer,
 * and appeal a revocation.
 */
export function EntryActions({
  entry,
  siteUrl,
}: {
  entry: {
    id: string;
    title: string;
    status: string;
    code: string | null;
    pinned: boolean;
    hidden: boolean;
    issuerType: string;
    mistakeOpen: boolean;
    appealable: boolean;
  };
  siteUrl: string;
}) {
  const router = useRouter();
  const uid = useId();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  const display = (pinned: boolean, hidden: boolean) =>
    startTransition(async () => {
      setError(null);
      const r = await setRecordDisplay({ entryId: entry.id, pinned, hidden });
      if (!r.ok) setError(r.message);
      else router.refresh();
    });

  if (entry.status === "revoked") {
    return entry.appealable ? <AppealButton type="record_revocation" id={entry.id} title={`Revoked: ${entry.title}`} /> : null;
  }
  if (entry.status !== "sealed" || !entry.code) return null;
  const verify = `${siteUrl.replace(/\/$/, "")}/verify/${entry.code}`;

  return (
    <div className="flex flex-wrap items-center gap-2" aria-busy={pending || undefined}>
      <Button
        size="sm"
        variant="tertiary"
        aria-pressed={entry.pinned}
        aria-label={`${entry.pinned ? "Unpin" : "Pin"} ${entry.title} ${entry.pinned ? "from" : "to"} your profile`}
        data-testid="entry-pin"
        disabled={entry.hidden}
        onClick={() => display(!entry.pinned, false)}
      >
        {entry.pinned ? "Unpin" : "Pin"}
      </Button>
      <Button
        size="sm"
        variant="tertiary"
        aria-pressed={entry.hidden}
        aria-label={`${entry.hidden ? "Show" : "Hide"} ${entry.title} on your profile and share links`}
        data-testid="entry-hide"
        onClick={() => display(false, !entry.hidden)}
      >
        {entry.hidden ? "Show" : "Hide"}
      </Button>
      <PdfButton body={{ kind: "certificate", entryId: entry.id }} variant="tertiary" testId="entry-certificate" label={`Certificate for ${entry.title}`}>
        Certificate
      </PdfButton>
      <Button
        size="sm"
        variant="tertiary"
        aria-label={`${copied ? "Copied" : "Copy link"}: the verify link for ${entry.title}`}
        onClick={async () => {
          await navigator.clipboard?.writeText(verify).catch(() => undefined);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? "Copied" : "Copy link"}
      </Button>
      {entry.issuerType === "society" ? (
        entry.mistakeOpen ? (
          <span className="text-caption text-text-secondary">Mistake reported</span>
        ) : (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="tertiary" aria-label={`Report a mistake in ${entry.title}`} data-testid="entry-mistake">
                Report a mistake
              </Button>
            </DialogTrigger>
            <DialogContent
              title="Report a mistake"
              description="The society's officers see your note. If they correct it, a new entry replaces this one and this code reads “superseded”."
            >
              <div className="mt-4 flex flex-col gap-1">
                <label htmlFor={`${uid}-n`} className="text-body-sm font-semibold">
                  What is wrong?
                </label>
                <Textarea id={`${uid}-n`} value={note} onChange={(e) => setNote(e.target.value)} rows={4} maxLength={1000} />
              </div>
              {error ? <FieldError>{error}</FieldError> : null}
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="secondary">Cancel</Button>
                </DialogClose>
                <Button
                  loading={pending}
                  onClick={() =>
                    startTransition(async () => {
                      setError(null);
                      const r = await reportRecordMistake({ entryId: entry.id, note });
                      if (!r.ok) setError(r.message);
                      else {
                        setOpen(false);
                        router.refresh();
                      }
                    })
                  }
                >
                  Send to the society
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )
      ) : null}
      {error && !open ? (
        <span role="alert" className="w-full text-caption text-text-error">
          {error}
        </span>
      ) : null}
    </div>
  );
}
