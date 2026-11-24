"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { claimRecordEntries } from "@/lib/actions/record";

/**
 * "N entries waiting" (PRD 5.30 claim flow): entries a society held for this verified university
 * email. Claiming moves them onto the Record, where they are signed.
 */
export function ClaimCard({ waiting, onDone }: { waiting: number; onDone?: string }) {
  const router = useRouter();
  const [claimed, setClaimed] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  if (waiting <= 0 && claimed === null) return null;
  return (
    <section aria-labelledby="claim-h" className="neu-card flex flex-col gap-3 p-5" data-testid="claim-card">
      <h2 id="claim-h" className="font-serif text-h3">
        {claimed !== null ? `${claimed} ${claimed === 1 ? "entry" : "entries"} added to your Record` : `${waiting} ${waiting === 1 ? "entry" : "entries"} waiting`}
      </h2>
      <p className="text-body text-text-secondary">
        {claimed !== null
          ? "They're being signed now and appear on your Record in a minute."
          : "A society checked you in with this university email before you joined. Claim them onto your Record."}
      </p>
      {claimed === null ? (
        <div>
          <Button
            loading={pending}
            data-testid="claim-entries"
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const r = await claimRecordEntries({});
                if (!r.ok) setError(r.message);
                else {
                  setClaimed(Number(r.data ?? 0));
                  router.refresh();
                  if (onDone) router.push(onDone as never);
                }
              })
            }
          >
            Claim
          </Button>
        </div>
      ) : null}
      <p role="status" className="text-caption text-text-error">
        {error}
      </p>
    </section>
  );
}
