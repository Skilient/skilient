"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, type ButtonProps } from "@/components/ui";
import type { ActionResult } from "@/lib/actions/result";

/**
 * One button, one server action with fixed arguments (follow, join, accept, publish…). The action
 * re-checks everything in SQL; a refusal is shown under the button and announced.
 */
export function ActionButton({
  action,
  args,
  children,
  variant = "secondary",
  size = "sm",
  confirm,
  done,
  testId,
  onDone,
}: {
  action: (input: unknown) => Promise<ActionResult<unknown>>;
  args: Record<string, unknown>;
  children: React.ReactNode;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  /** Ask before running (irreversible steps). */
  confirm?: string;
  /** Announced after it works. */
  done?: string;
  testId?: string;
  onDone?: (data: unknown) => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <span className="inline-flex flex-col gap-1">
      <Button
        type="button"
        variant={variant}
        size={size}
        loading={pending}
        data-testid={testId}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          setError(null);
          startTransition(async () => {
            const result = await action(args);
            if (!result.ok) {
              setError(result.message);
              return;
            }
            if (done) setMessage(done);
            onDone?.(result.data);
            router.refresh();
          });
        }}
      >
        {children}
      </Button>
      <span role="status" className="text-caption">
        {error ? <span className="text-text-error">{error}</span> : message ? <span className="text-text-secondary">{message}</span> : null}
      </span>
    </span>
  );
}
