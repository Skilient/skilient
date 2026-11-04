"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { Button, HelperText, Label } from "@/components/ui";
import { setSocietyImages } from "@/lib/actions/societies";

/** Logo and cover: re-encoded on the server (EXIF and GPS dropped) and stored in the society's folder. */
export function SocietyImagesForm({ societyId }: { societyId: string }) {
  const id = useId();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <form
      method="post"
      className="flex flex-col gap-3"
      data-testid="society-images"
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        form.set("societyId", societyId);
        startTransition(async () => {
          setError(null);
          setDone(false);
          const r = await setSocietyImages(form);
          if (!r.ok) return setError(r.message);
          setDone(true);
          router.refresh();
        });
      }}
    >
      {error ? <FormAlert>{error}</FormAlert> : null}
      {done ? <FormAlert tone="success">Saved.</FormAlert> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-logo`}>Logo</Label>
          <input id={`${id}-logo`} name="logo" type="file" accept="image/jpeg,image/png,image/webp" className="text-body-sm" />
          <HelperText>Square works best.</HelperText>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-cover`}>Cover</Label>
          <input id={`${id}-cover`} name="cover" type="file" accept="image/jpeg,image/png,image/webp" className="text-body-sm" />
          <HelperText>Wide, at least 1200 px across.</HelperText>
        </div>
      </div>
      <Button type="submit" variant="secondary" loading={pending} className="self-start">
        Upload images
      </Button>
    </form>
  );
}
