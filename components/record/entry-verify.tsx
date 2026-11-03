import { CheckCircle, ClockCounterClockwise, Prohibit, Warning } from "@phosphor-icons/react/dist/ssr";
import type { Route } from "next";
import Link from "next/link";
import { cn } from "@/lib/cn";
import type { EntryVerify } from "@/lib/data/record";
import { KIND_LABELS, revokeCategoryLabel } from "@/lib/record/constants";
import { formatCode } from "@/supabase/functions/_shared/cv/sign.ts";

const TEXT = {
  valid: { title: "Valid", body: "This Record entry was signed by Skilient and hasn't changed since.", Icon: CheckCircle, tone: "border-verified bg-verified-subtle" },
  superseded: { title: "Superseded", body: "This entry is genuine, but the issuer corrected it. The newer entry is the one that counts.", Icon: ClockCounterClockwise, tone: "border-border-strong bg-bg-subtle" },
  altered: { title: "Altered", body: "The stored entry doesn't match its signature. Don't rely on it.", Icon: Warning, tone: "border-error bg-bg-surface" },
  revoked: { title: "Revoked", body: "This Record entry has been withdrawn and is no longer valid.", Icon: Prohibit, tone: "border-error bg-bg-surface" },
} as const;

/** /verify/[code] for a Record entry (PRD 5.30): the entry, issuer, date, evidence, signature check and status. */
export function EntryVerifyCard({ result }: { result: Exclude<EntryVerify, { status: "rate_limited" | "not_found" }> }) {
  const t = TEXT[result.status];
  return (
    <section aria-labelledby="status-h" className={cn("rounded-lg border-2 p-6", t.tone)} data-testid="verify-status" data-status={result.status} data-kind="record_entry">
      <div className="flex items-center gap-3">
        <t.Icon aria-hidden size={28} weight="fill" />
        <h1 id="status-h" className="font-display text-h2">
          {t.title}
        </h1>
      </div>
      <p className="mt-2 text-body">{t.body}</p>
      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-body-sm">
        <dt className="text-text-secondary">Code</dt>
        <dd className="font-mono">{formatCode(result.code)}</dd>
        {result.status === "revoked" ? (
          <>
            <dt className="text-text-secondary">Sealed</dt>
            <dd>{result.sealedLabel}</dd>
            <dt className="text-text-secondary">Revoked</dt>
            <dd data-testid="revoked-on">
              {result.revokedLabel} · {revokeCategoryLabel(result.category)}
            </dd>
          </>
        ) : (
          <>
            <dt className="text-text-secondary">Record entry</dt>
            <dd className="font-semibold" data-testid="entry-title">
              {KIND_LABELS[result.entry.kind]}: {result.entry.title}
            </dd>
            <dt className="text-text-secondary">Student</dt>
            <dd>
              {result.entry.holder.name} · {result.entry.holder.university}
            </dd>
            <dt className="text-text-secondary">Issued by</dt>
            <dd>
              {result.entry.issuer.name}
              {result.entry.issuer.type === "society" ? " (a verified society)" : ""}
            </dd>
            <dt className="text-text-secondary">Date</dt>
            <dd>{result.entry.date}</dd>
            {result.entry.evidence.line ? (
              <>
                <dt className="text-text-secondary">Evidence</dt>
                <dd>{result.entry.evidence.line}</dd>
              </>
            ) : null}
            <dt className="text-text-secondary">Sealed</dt>
            <dd>{result.sealedLabel}</dd>
            {result.entry.supersedes ? (
              <>
                <dt className="text-text-secondary">Corrects</dt>
                <dd className="font-mono">{formatCode(result.entry.supersedes)}</dd>
              </>
            ) : null}
            {result.supersededByCode ? (
              <>
                <dt className="text-text-secondary">Superseded by</dt>
                <dd>
                  <Link href={`/verify/${result.supersededByCode}` as Route} className="font-mono font-semibold underline underline-offset-4" data-testid="superseded-by">
                    {formatCode(result.supersededByCode)}
                  </Link>
                </dd>
              </>
            ) : null}
            <dt className="text-text-secondary">Signature</dt>
            <dd>
              {result.signatureValid ? "Ed25519, checked" : "doesn't match the entry"} · key <span className="font-mono">{result.keyId}</span>
            </dd>
          </>
        )}
      </dl>
    </section>
  );
}
