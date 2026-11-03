"use client";

import { useState, useTransition } from "react";
import { Button, type ButtonProps } from "@/components/ui";

/**
 * Downloads a certificate or the transcript (PRD 5.30): the PDF is printed for the signed-in
 * student and comes back as a file; nothing is stored. Refusals are shown under the button.
 */
export function PdfButton({
  body,
  children,
  variant = "secondary",
  size = "sm",
  testId,
  label,
}: {
  body: { kind: "certificate"; entryId: string } | { kind: "transcript" };
  children: React.ReactNode;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  testId?: string;
  label?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <span className="inline-flex flex-col gap-1">
      <Button
        type="button"
        variant={variant}
        size={size}
        loading={pending}
        data-testid={testId}
        aria-label={label}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const res = await fetch("/api/record/pdf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
            if (!res.ok) {
              const j = (await res.json().catch(() => null)) as { message?: string } | null;
              setError(j?.message ?? "We couldn't make the PDF. Try again.");
              return;
            }
            const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "skilient-record.pdf";
            const url = URL.createObjectURL(await res.blob());
            const a = document.createElement("a");
            a.href = url;
            a.download = name;
            document.body.append(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 10_000);
          })
        }
      >
        {children}
      </Button>
      <span role="status" className="text-caption text-text-error">
        {error}
      </span>
    </span>
  );
}
