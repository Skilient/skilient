import type { Metadata, Route } from "next";
import Link from "next/link";
import { ClaimCard } from "@/components/record/claim-card";
import { EntryActions } from "@/components/record/entry-actions";
import { RecordShare } from "@/components/record/record-share";
import { buttonClass, EmptyState, RecordEntry, StatTile } from "@/components/ui";
import { cn } from "@/lib/cn";
import { siteUrl } from "@/lib/cv/site";
import { getMyRecord, groupByYear, type RecordEntry as Entry } from "@/lib/data/record";
import { KIND_LABELS, revokeCategoryLabel } from "@/lib/record/constants";
import type { RecordKind } from "@/lib/record/types";
import { formatCode } from "@/supabase/functions/_shared/cv/sign.ts";

export const metadata: Metadata = { title: "Your Record" };

function rowStatus(e: Entry): "sealed" | "signing" | "revoked" | "superseded" {
  if (e.status === "sealed") return "sealed";
  if (e.status === "revoked") return "revoked";
  if (e.status === "superseded") return "superseded";
  return "signing";
}

/**
 * /me/record (PRD 5.30, screen spec §3.14 "My Record"): the ledger. A Spectral heading, stat tiles
 * by kind in tabular mono, rows by academic year, filters by kind (and revoked), pin and hide,
 * certificates, the transcript and share links. Empty: the next event the student can register for.
 */
export default async function MyRecordPage({ searchParams }: PageProps<"/me/record">) {
  const sp = await searchParams;
  const kind = typeof sp.kind === "string" && sp.kind in KIND_LABELS ? (sp.kind as RecordKind) : null;
  const revokedOnly = sp.status === "revoked";
  const r = await getMyRecord();
  const site = siteUrl();
  const shown = r.entries.filter((e) => (kind ? e.kind === kind : true) && (revokedOnly ? e.status === "revoked" : true));
  const years = groupByYear(shown);
  const sealed = r.entries.filter((e) => e.status === "sealed").length;
  const kinds = [...new Set(r.entries.map((e) => e.kind))];

  return (
    <main className="mx-auto flex w-full max-w-page flex-col gap-6 px-[var(--page-gutter)] py-6" data-testid="my-record">
      <div className="flex flex-col gap-1">
        <h1 className="font-serif text-h1">Your Record</h1>
        <p className="max-w-prose text-body text-text-secondary">
          Every event, office, result and hour a verified society or Skilient signed for you. Anyone can check an entry by its code at /verify.
        </p>
      </div>

      <ClaimCard waiting={r.waiting} />

      {r.entries.length === 0 ? (
        <EmptyState
          object="page"
          title="Your first entry is one event away"
          description={
            r.nextEvent
              ? `${r.nextEvent.society} runs ${r.nextEvent.title} on ${r.nextEvent.whenLabel}. Check in there and your Attended entry is signed here.`
              : "Check in at a verified society's event, hold an office or volunteer, and the society signs an entry onto your Record."
          }
          action={
            <Link href={(r.nextEvent ? `/events/${r.nextEvent.id}` : "/events") as Route} className={buttonClass("secondary", "md")}>
              {r.nextEvent ? "See the event" : "Find events"}
            </Link>
          }
        />
      ) : (
        <>
          <section aria-label="Entries by kind" className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="record-stats">
            <StatTile label="Sealed entries" value={sealed} />
            {r.counts.slice(0, 3).map((c) => (
              <StatTile key={c.kind} label={KIND_LABELS[c.kind]} value={c.count} />
            ))}
          </section>

          <nav aria-label="Filter the Record" className="flex flex-wrap gap-2">
            {[{ href: "/me/record", label: "All", active: !kind && !revokedOnly }, ...kinds.map((k) => ({ href: `/me/record?kind=${k}`, label: KIND_LABELS[k], active: kind === k }))]
              .concat(r.entries.some((e) => e.status === "revoked") ? [{ href: "/me/record?status=revoked", label: "Revoked", active: revokedOnly }] : [])
              .map((f) => (
                <Link
                  key={f.href}
                  href={f.href as Route}
                  aria-current={f.active ? "page" : undefined}
                  className={cn(buttonClass(f.active ? "primary" : "secondary", "sm"))}
                >
                  {f.label}
                </Link>
              ))}
          </nav>

          {years.length ? (
            years.map((y) => (
              <section key={y.year} aria-labelledby={`y-${y.year}`} className="neu-card px-5 py-2">
                <h2 id={`y-${y.year}`} className="pt-3 font-mono text-body-sm font-semibold text-text-secondary">
                  {y.label}
                </h2>
                <ul className="flex flex-col">
                  {y.entries.map((e) => (
                    <RecordEntry
                      key={e.id}
                      issuer={e.issuerName}
                      title={`${KIND_LABELS[e.kind]}: ${e.title}`}
                      date={e.dateLabel}
                      status={rowStatus(e)}
                      code={e.code ? formatCode(e.code) : undefined}
                      evidence={
                        <>
                          {e.line ? <span>{e.line}</span> : null}
                          {e.sealedLabel && e.status === "sealed" ? <span className="neu-mono">{e.sealedLabel}</span> : null}
                          {e.status === "awaiting" ? <span>Waiting for a second officer</span> : null}
                          {e.pinned ? <span className="font-semibold">Pinned</span> : null}
                          {e.hidden ? <span className="font-semibold">Hidden from your profile</span> : null}
                          {e.status === "revoked" ? (
                            <span>
                              {revokeCategoryLabel(e.revokedCategory)} · {e.revokedLabel}: {e.revokedReason}
                            </span>
                          ) : null}
                        </>
                      }
                      action={<EntryActions entry={e} siteUrl={site} />}
                    />
                  ))}
                </ul>
              </section>
            ))
          ) : (
            <p className="text-body text-text-secondary">No entries match this filter.</p>
          )}

          {r.superseded.length ? (
            <details className="neu-card px-5 py-3">
              <summary className="cursor-pointer text-body-sm font-semibold">Corrected entries ({r.superseded.length})</summary>
              <ul className="flex flex-col">
                {r.superseded.map((e) => (
                  <RecordEntry
                    key={e.id}
                    issuer={e.issuerName}
                    title={`${KIND_LABELS[e.kind]}: ${e.title}`}
                    date={e.dateLabel}
                    status="superseded"
                    code={e.code ? formatCode(e.code) : undefined}
                    evidence={e.supersededByCode ? <span>Superseded by {formatCode(e.supersededByCode)}</span> : null}
                  />
                ))}
              </ul>
            </details>
          ) : null}

          <section aria-labelledby="share-h" className="neu-card flex flex-col gap-3 p-5">
            <h2 id="share-h" className="text-h3">
              Share your Record
            </h2>
            <RecordShare links={r.links} canPrint={sealed > 0} />
            <p className="text-body-sm text-text-secondary">
              To put entries on your CV, pick them under{" "}
              <Link href={"/me/cv#activities" as Route} className="font-semibold underline underline-offset-4">
                Leadership and activities
              </Link>
              .
            </p>
          </section>
        </>
      )}
    </main>
  );
}
