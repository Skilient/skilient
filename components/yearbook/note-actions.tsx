"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { decideYearbookNote } from "@/lib/actions/yearbook";

/** Approve (shown to the batch) or hide (shown to nobody else; the writer isn't told). */
export function NoteActions({ noteId, status }: { noteId: string; status: "approved" | "hidden" | "pending" }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const decide = (approve: boolean) =>
    startTransition(async () => {
      setError(null);
      const r = await decideYearbookNote({ noteId, approve });
      if (r.ok) router.refresh();
      else setError(r.message);
    });
  return (
    <div className="flex flex-wrap items-center gap-2">
      {status !== "approved" ? (
        <Button size="sm" onClick={() => decide(true)} loading={pending} data-testid="note-approve">
          Approve
        </Button>
      ) : null}
      {status !== "hidden" ? (
        <Button size="sm" variant="secondary" onClick={() => decide(false)} disabled={pending} data-testid="note-hide">
          Hide
        </Button>
      ) : null}
      {error ? (
        <p role="alert" className="text-body-sm text-text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
