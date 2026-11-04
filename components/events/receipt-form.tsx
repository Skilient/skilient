"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { Button, FieldError, HelperText, Input, Label } from "@/components/ui";
import { submitReceipt } from "@/lib/actions/event-payments";

const MAX = 5 * 1024 * 1024;

/**
 * The receipt (PRD 5.31): a screenshot (re-encoded on the server, EXIF and GPS dropped) or a PDF, up to
 * 5 MB, and the transaction ID if the app shows one. Only you, the society's officers and, if it is
 * reported, Skilient's moderators can open it; it's deleted 90 days after the event.
 */
export function ReceiptForm({ eventId, registrationId }: { eventId: string; registrationId: string }) {
  const id = useId();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form
      method="post"
      className="flex flex-col gap-3"
      data-testid="receipt-form"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        const file = data.get("receipt");
        setError(null);
        setFieldError(null);
        if (!(file instanceof File) || file.size === 0) return setFieldError("Choose the receipt (a screenshot or a PDF).");
        if (file.size > MAX) return setFieldError("Files can be up to 5 MB.");
        data.set("eventId", eventId);
        data.set("registrationId", registrationId);
        startTransition(async () => {
          const r = await submitReceipt(data);
          if (!r.ok) {
            if (r.fields?.receipt) setFieldError(r.fields.receipt);
            else setError(r.message);
            return;
          }
          router.refresh();
        });
      }}
    >
      {error ? <FormAlert>{error}</FormAlert> : null}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-file`}>Receipt</Label>
        <input id={`${id}-file`} name="receipt" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="text-body-sm" aria-describedby={`${id}-help`} data-testid="receipt-file" />
        {fieldError ? <FieldError id={`${id}-help`}>{fieldError}</FieldError> : <HelperText id={`${id}-help`}>A screenshot or PDF, up to 5 MB.</HelperText>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-tx`}>Transaction ID (optional)</Label>
        <Input id={`${id}-tx`} name="transactionId" maxLength={60} className="font-mono" />
      </div>
      <Button type="submit" loading={pending} className="self-start" data-testid="upload-receipt">
        Upload receipt
      </Button>
    </form>
  );
}
