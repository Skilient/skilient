import type { Metadata, Route } from "next";
import Link from "next/link";
import { VerifyColumn } from "@/components/marketing/verify-column";
import { verifyAllowed, verifyTranscript } from "@/lib/data/record";
import { formatCode } from "@/supabase/functions/_shared/cv/sign.ts";

export const metadata: Metadata = { title: "Verify a Record transcript", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = {
  sealed: "Valid",
  superseded: "Superseded (corrected later)",
  revoked: "Revoked",
  not_found: "Not found",
};

/**
 * /verify/transcript/[id] (PRD 5.30): the transcript PDF's QR. Lists every entry printed on it with
 * its status today; each code opens its own signed entry. Revoked entries show only their code.
 */
export default async function VerifyTranscriptPage({ params }: PageProps<"/verify/transcript/[id]">) {
  const { id } = await params;
  if (!(await verifyAllowed())) {
    return (
      <VerifyColumn>
        <section className="rounded-lg border border-border-strong bg-bg-surface p-6" role="alert">
          <h1 className="font-display text-h2">Too many checks</h1>
          <p className="mt-2 text-body">You can check up to 30 codes a minute. Try again in a minute.</p>
        </section>
      </VerifyColumn>
    );
  }
  const t = await verifyTranscript(id);
  if (!t) {
    return (
      <VerifyColumn>
        <section className="rounded-lg border-2 border-border-strong bg-bg-subtle p-6" data-testid="verify-status" data-status="not_found">
          <h1 className="font-display text-h2">Not found</h1>
          <p className="mt-2 text-body">No transcript or certificate was issued under this link. Check each entry by its code instead.</p>
          <p className="mt-4 text-body-sm">
            <Link href="/verify" className="font-semibold underline underline-offset-4">
              Enter a code
            </Link>
          </p>
        </section>
      </VerifyColumn>
    );
  }
  const allValid = t.entries.every((e) => e.status === "sealed");
  return (
    <VerifyColumn>
      <section
        aria-labelledby="status-h"
        className={`rounded-lg border-2 p-6 ${allValid ? "border-verified bg-verified-subtle" : "border-border-strong bg-bg-subtle"}`}
        data-testid="verify-status"
        data-status={allValid ? "valid" : "changed"}
      >
        <h1 id="status-h" className="font-display text-h2">
          {allValid ? "Every entry is valid" : "Some entries changed since"}
        </h1>
        <p className="mt-2 text-body">
          A Record {t.kind} for {t.holderName}, printed by Skilient on {t.createdLabel}. Each entry below is checked today.
        </p>
        <ul className="mt-4 flex flex-col divide-y divide-border-muted" data-testid="transcript-entries">
          {t.entries.map((e) => (
            <li key={e.code} className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-body-sm" data-status={e.status}>
              <span>
                {e.title ? <span className="font-semibold">{e.title}</span> : null}
                {e.issuerName ? <span className="text-text-secondary"> · {e.issuerName}</span> : null}
                {e.dateLabel ? <span className="text-text-secondary"> · {e.dateLabel}</span> : null}
              </span>
              <span className="flex gap-3">
                <span>{STATUS[e.status] ?? e.status}</span>
                <Link href={`/verify/${e.code}` as Route} className="font-mono underline underline-offset-4">
                  {formatCode(e.code)}
                </Link>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 font-mono text-caption break-all text-text-secondary">SHA-256 of the PDF: {t.pdfHash}</p>
      </section>
    </VerifyColumn>
  );
}
