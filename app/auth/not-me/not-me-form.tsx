"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { Button } from "@/components/ui";
import { reportNotMe } from "@/lib/actions/auth";
import type { ActionError } from "@/lib/actions/result";
import { clearClientState, postAuthMessage } from "@/lib/auth/channel";

export function NotMeForm({ token }: { token: string }) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<ActionError | null>(null);
  const [pending, startTransition] = useTransition();

  if (done) {
    return (
      <FormAlert tone="success">
        Every session has been signed out. Check your university email for a link to choose a new password.
      </FormAlert>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <FormAlert requestId={error.requestId}>
          {error.message}{" "}
          <Link href="/forgot-password" className="font-semibold underline underline-offset-4">
            Reset password
          </Link>
        </FormAlert>
      ) : null}
      <Button
        type="button"
        variant="danger"
        size="lg"
        // The long label wraps inside the card instead of being clipped (design gates 2026-11-04).
        className="h-auto min-h-12 py-2 text-center whitespace-normal"
        loading={pending}
        onClick={() => {
          const form = new FormData();
          form.set("token", token);
          setError(null);
          startTransition(async () => {
            const result = await reportNotMe(form);
            if (result.ok) {
              postAuthMessage("signed-out");
              clearClientState();
              setDone(true);
            } else {
              setError(result);
            }
          });
        }}
      >
        Sign out everywhere and reset my password
      </Button>
    </div>
  );
}
