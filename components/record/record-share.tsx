"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Button, FieldError, Input, Label } from "@/components/ui";
import { createRecordShareLink, revokeRecordShareLink } from "@/lib/actions/record";
import { PdfButton } from "./pdf-button";

const EXPIRY = [7, 30, 90] as const;

/**
 * Share the whole Record (PRD 5.30): a link that always expires and can be revoked (only its hash
 * is kept, so it is shown once), or the signed transcript PDF of every entry the student shows.
 */
export function RecordShare({
  links,
  canPrint,
}: {
  links: { id: string; label: string | null; expiresLabel: string; viewCount: number; createdLabel: string }[];
  canPrint: boolean;
}) {
  const id = useId();
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [days, setDays] = useState<(typeof EXPIRY)[number]>(30);
  const [made, setMade] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-5" aria-busy={pending || undefined}>
      <div className="flex flex-col gap-2">
        <h3 className="text-body font-semibold">Transcript</h3>
        <p className="text-body-sm text-text-secondary">One signed PDF of every entry you show, with a QR code that checks each one.</p>
        <div>
          {canPrint ? (
            <PdfButton body={{ kind: "transcript" }} testId="transcript-pdf">
              Download transcript PDF
            </PdfButton>
          ) : (
            <p className="text-body-sm text-text-secondary">Your first sealed entry makes a transcript possible.</p>
          )}
        </div>
      </div>
      <form
        method="post"
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setMade(null);
          startTransition(async () => {
            const r = await createRecordShareLink({ label: label.trim() || undefined, days });
            if (r.ok) {
              setMade(r.data.url);
              setLabel("");
              router.refresh();
            } else setError(r.message);
          });
        }}
      >
        <h3 className="text-body font-semibold">Share link</h3>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-label`}>Label (optional)</Label>
          <Input id={`${id}-label`} value={label} maxLength={60} placeholder="Scholarship application" onChange={(e) => setLabel(e.target.value)} />
        </div>
        <fieldset className="flex flex-wrap gap-x-4 gap-y-2">
          <legend className="mb-1 text-body-sm font-semibold">Expires after</legend>
          {EXPIRY.map((d) => (
            <label key={d} className="flex items-center gap-2 text-body">
              <input type="radio" name={`${id}-days`} value={d} checked={days === d} onChange={() => setDays(d)} className="size-4" />
              {d} days
            </label>
          ))}
        </fieldset>
        <div>
          <Button type="submit" variant="secondary" loading={pending} data-testid="record-share-create">
            Make a share link
          </Button>
        </div>
        {error ? <FieldError>{error}</FieldError> : null}
      </form>
      {made ? (
        <div className="neu-well flex flex-col gap-2 p-3" data-testid="record-new-link">
          <p className="text-body-sm font-semibold">Copy your link now: it won&rsquo;t be shown again.</p>
          <code className="font-mono text-caption break-all" data-testid="record-new-link-url">
            {made}
          </code>
          <div>
            <Button type="button" size="sm" variant="secondary" onClick={() => navigator.clipboard?.writeText(made).catch(() => undefined)}>
              Copy link
            </Button>
          </div>
        </div>
      ) : null}
      {links.length ? (
        <ul className="flex flex-col divide-y divide-border-muted" aria-label="Active share links">
          {links.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-body-sm">
              <span>
                <span className="font-semibold">{l.label ?? "Share link"}</span>
                <span className="text-text-secondary">
                  {" "}
                  · made {l.createdLabel} · expires {l.expiresLabel} · {l.viewCount} {l.viewCount === 1 ? "view" : "views"}
                </span>
              </span>
              <Button
                type="button"
                size="sm"
                variant="tertiary"
                aria-label={`Revoke ${l.label ?? "share link"}`}
                onClick={() =>
                  startTransition(async () => {
                    const r = await revokeRecordShareLink({ id: l.id });
                    if (!r.ok) setError(r.message);
                    else router.refresh();
                  })
                }
              >
                Revoke
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
