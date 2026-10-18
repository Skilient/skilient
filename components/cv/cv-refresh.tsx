"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { showUpgrade } from "@/components/billing/upgrade-sheet";
import { Button, FieldError } from "@/components/ui";
import { refreshCv } from "@/lib/actions/cv";
import { formatCode } from "@/supabase/functions/_shared/cv/sign.ts";

/**
 * The Updates box on My CV (screen spec "My CV"): the next monthly refresh date on Free, and
 * Refresh now on Pro (entitlement cv.refresh_on_demand), which signs today's data under a new code.
 */
export function CvRefresh({ canRefresh, nextRefreshLabel }: { canRefresh: boolean; nextRefreshLabel: string }) {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-3" aria-busy={pending || undefined}>
      <p className="text-body-sm text-text-secondary">
        Your CV refreshes on {nextRefreshLabel} with the month&rsquo;s new work, if anything changed. Each refresh gets a new code; older
        codes show Superseded.
      </p>
      {canRefresh ? (
        <>
          <Button
            variant="secondary"
            loading={pending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                setDone(null);
                const result = await refreshCv();
                if (!result.ok) {
                  if (!showUpgrade(result)) setError(result.message);
                  return;
                }
                setDone(result.data.code ? `Signed with today's work. Your new code is ${formatCode(result.data.code)}.` : "Your CV is already up to date.");
              })
            }
          >
            Refresh now
          </Button>
          <p role="status" className="text-body-sm text-text-secondary">
            {pending ? "Signing your CV…" : (done ?? "")}
          </p>
        </>
      ) : (
        <p className="text-body-sm text-text-secondary" data-testid="refresh-locked">
          Want it sooner?{" "}
          <Link href="/settings/billing" className="font-semibold text-text-primary underline underline-offset-4">
            Student Pro
          </Link>{" "}
          refreshes your CV any time.
        </p>
      )}
      {error ? <FieldError>{error}</FieldError> : null}
    </div>
  );
}
