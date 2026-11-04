import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RevokeEntryButton } from "@/components/record/officer-forms";
import { Badge, Button, EmptyState, Input, Label } from "@/components/ui";
import { isRefusal } from "@/lib/data/rpc-json";
import { getOpsRecordEntry } from "@/lib/data/record";
import { KIND_LABELS, revokeCategoryLabel, STATUS_LABELS } from "@/lib/record/constants";
import { formatCode, normaliseCode } from "@/supabase/functions/_shared/cv/sign.ts";

export const metadata: Metadata = { title: "Record entries" };

/**
 * /ops/record (PRD 5.30): trust reviewers and moderators find a Record entry by its code and can
 * revoke it with a reason (audited before and after; the student can appeal through /appeals).
 */
export default async function OpsRecordPage({ searchParams }: PageProps<"/ops/record">) {
  const sp = await searchParams;
  const raw = typeof sp.code === "string" ? sp.code.trim().slice(0, 20) : "";
  const code = raw ? normaliseCode(raw) : null;
  let entry = null;
  if (code) {
    try {
      entry = await getOpsRecordEntry(code);
    } catch (err) {
      if (isRefusal(err, "42501")) notFound();
      throw err;
    }
  }
  return (
    <main className="flex flex-col gap-5">
      <h1 className="font-display text-h1">Record entries</h1>
      <form method="get" action="/ops/record" className="flex flex-wrap items-end gap-2" role="search">
        <div className="flex flex-col gap-2">
          <Label htmlFor="record-code">Entry code</Label>
          <Input id="record-code" name="code" defaultValue={raw} autoComplete="off" maxLength={20} className="w-64 font-mono" />
        </div>
        <Button type="submit">Find</Button>
      </form>
      {raw && !code ? <EmptyState title="That isn't a code" description="Codes are 10 letters and digits, like 7RCD0-000A1." /> : null}
      {code && !entry ? <EmptyState title="No entry has this code" description="It may be a CV code: check it at /verify." /> : null}
      {entry ? (
        <section className="rounded-lg border border-border-default bg-bg-surface p-5" data-testid="ops-record-entry">
          <h2 className="text-h3">
            {KIND_LABELS[entry.kind]}: {entry.title}
          </h2>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-body-sm">
            <dt className="text-text-secondary">Code</dt>
            <dd className="font-mono">{entry.code ? formatCode(entry.code) : "not sealed"}</dd>
            <dt className="text-text-secondary">Student</dt>
            <dd>
              {entry.username ? (
                <Link href={`/profile/${entry.username}` as Route} className="underline underline-offset-4">
                  {entry.holder}
                </Link>
              ) : (
                entry.holder
              )}
            </dd>
            <dt className="text-text-secondary">Issuer</dt>
            <dd>
              {entry.issuerName}
              {entry.issuedBy ? ` · by ${entry.issuedBy}` : ""}
            </dd>
            <dt className="text-text-secondary">Date</dt>
            <dd>{entry.dateLabel}</dd>
            <dt className="text-text-secondary">Evidence</dt>
            <dd>{entry.line}</dd>
            <dt className="text-text-secondary">Status</dt>
            <dd>
              <Badge tone={entry.status === "revoked" ? "error" : "neutral"}>{STATUS_LABELS[entry.status] ?? entry.status}</Badge>
              {entry.status === "revoked" ? ` ${revokeCategoryLabel(entry.revokedCategory)} · ${entry.revokedLabel}: ${entry.revokedReason}` : ""}
            </dd>
          </dl>
          {entry.status === "sealed" || entry.status === "pending" || entry.status === "awaiting" ? (
            <div className="mt-4">
              <RevokeEntryButton entryId={entry.id} title={entry.title} />
            </div>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
