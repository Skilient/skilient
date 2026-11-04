"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

/** The page as a PDF keepsake: printed per request, never stored. */
export function DownloadPagePdf() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant="secondary"
        loading={busy}
        data-testid="yearbook-pdf"
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const res = await fetch("/api/yearbook/pdf", { method: "POST" });
            if (!res.ok) {
              const body = (await res.json().catch(() => null)) as { message?: string } | null;
              setError(body?.message ?? "We couldn't make the PDF. Try again.");
              return;
            }
            const url = URL.createObjectURL(await res.blob());
            const a = document.createElement("a");
            a.href = url;
            a.download = "skilient-yearbook-page.pdf";
            a.click();
            URL.revokeObjectURL(url);
          } finally {
            setBusy(false);
          }
        }}
      >
        Download my page (PDF)
      </Button>
      {error ? (
        <span role="alert" className="text-body-sm text-text-error">
          {error}
        </span>
      ) : null}
    </span>
  );
}
