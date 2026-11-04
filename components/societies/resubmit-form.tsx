"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { Button, FieldError, HelperText, Input, Label, Textarea } from "@/components/ui";
import { resubmitSociety } from "@/lib/actions/societies";

/** After "More information needed": a new proof, a link, or a better description; it goes back to the queue. */
export function ResubmitForm({ societyId, about }: { societyId: string; about: string }) {
  const id = useId();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  return (
    <form
      method="post"
      className="flex flex-col gap-3"
      data-testid="resubmit-form"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        const form = new FormData();
        form.set("data", JSON.stringify({ societyId, about: String(data.get("about") ?? "").trim(), proofUrl: String(data.get("proofUrl") ?? "").trim() }));
        const file = data.get("proof");
        if (file instanceof File && file.size > 0) form.set("proof", file);
        startTransition(async () => {
          setError(null);
          const r = await resubmitSociety(form);
          if (!r.ok) {
            setError(r.message);
            setFields(r.fields ?? {});
            return;
          }
          router.refresh();
        });
      }}
    >
      {error ? <FormAlert>{error}</FormAlert> : null}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-about`}>About the society</Label>
        <Textarea id={`${id}-about`} name="about" rows={4} defaultValue={about} maxLength={1000} />
        {fields.about ? <FieldError>{fields.about}</FieldError> : null}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-proof`}>New proof document</Label>
        <input id={`${id}-proof`} name="proof" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="text-body-sm" />
        {fields.proof ? <FieldError>{fields.proof}</FieldError> : <HelperText>PDF or image, up to 5 MB.</HelperText>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-url`}>Or an official link</Label>
        <Input id={`${id}-url`} name="proofUrl" type="url" inputMode="url" placeholder="https://" />
        {fields.proofUrl ? <FieldError>{fields.proofUrl}</FieldError> : null}
      </div>
      <Button type="submit" loading={pending} className="self-start">
        Send it back for review
      </Button>
    </form>
  );
}
