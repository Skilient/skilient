"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { Button, Label, Textarea } from "@/components/ui";
import { claimSociety, decideSociety } from "@/lib/actions/ops/societies";

export function ClaimSocietyButton({ societyId, claimed }: { societyId: string; claimed: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <span className="flex flex-col gap-1">
      <Button
        type="button"
        variant={claimed ? "ghost" : "secondary"}
        size="sm"
        loading={pending}
        data-testid="claim-society"
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const r = await claimSociety({ societyId, claim: !claimed });
            if (!r.ok) return setError(r.message);
            router.refresh();
          })
        }
      >
        {claimed ? "Release" : "Claim"}
      </Button>
      {error ? <span role="alert" className="text-caption text-text-error">{error}</span> : null}
    </span>
  );
}

const ACTIONS: Record<string, { label: string; needsReason: boolean; variant: "primary" | "secondary" | "danger" }> = {
  approve: { label: "Approve", needsReason: false, variant: "primary" },
  more_info: { label: "Ask for more information", needsReason: true, variant: "secondary" },
  reject: { label: "Reject", needsReason: true, variant: "danger" },
  suspend: { label: "Suspend", needsReason: true, variant: "danger" },
  reinstate: { label: "Reinstate", needsReason: false, variant: "primary" },
  pause_paid: { label: "Pause paid tickets", needsReason: true, variant: "secondary" },
  resume_paid: { label: "Resume paid tickets", needsReason: false, variant: "secondary" },
};

/**
 * The decision (PRD 5.31, the decide_org pattern): a reason the society reads for anything but
 * approve, reinstate and resume. SQL checks the state and audits before and after.
 */
export function DecideSocietyForm({ societyId, actions }: { societyId: string; actions: (keyof typeof ACTIONS)[] }) {
  const id = useId();
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form method="post" className="flex flex-col gap-3" onSubmit={(e) => e.preventDefault()} data-testid="decide-society">
      {error ? <FormAlert>{error}</FormAlert> : null}
      {done ? <FormAlert tone="success">{done}</FormAlert> : null}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-reason`}>Reason (the society reads it)</Label>
        <Textarea id={`${id}-reason`} rows={3} value={reason} maxLength={1000} onChange={(e) => setReason(e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <Button
            key={a}
            type="button"
            variant={ACTIONS[a].variant}
            size="sm"
            loading={pending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                setDone(null);
                const r = await decideSociety({ societyId, action: a, reason });
                if (!r.ok) return setError(r.message);
                setDone(`${ACTIONS[a].label}: done.`);
                router.refresh();
              })
            }
          >
            {ACTIONS[a].label}
          </Button>
        ))}
      </div>
    </form>
  );
}
