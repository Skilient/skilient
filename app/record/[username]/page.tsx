import type { Metadata, Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PublicFrame } from "@/components/cv/public-frame";
import { EmptyState, RecordEntry } from "@/components/ui";
import { getSharedRecord, groupByYear } from "@/lib/data/record";
import { KIND_LABELS } from "@/lib/record/constants";
import { formatCode } from "@/supabase/functions/_shared/cv/sign.ts";

export const metadata: Metadata = { title: "The Record", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * /record/[username]?t= (PRD 5.30): a share link opens the entries the student shows, signed-out.
 * Every entry links to its own signed verify page. An expired or revoked link says so.
 */
export default async function SharedRecordPage({ params, searchParams }: PageProps<"/record/[username]">) {
  const { username } = await params;
  const t = (await searchParams).t;
  const token = typeof t === "string" ? t : "";
  const rec = await getSharedRecord(token);
  if (rec.state !== "ok") {
    return (
      <PublicFrame>
        <EmptyState
          title="This link isn't valid"
          description="It may have expired or been revoked. Ask the student for a new link, or check an entry by its code."
          action={
            <Link href="/verify" className="text-body-sm font-semibold underline underline-offset-4">
              Check a code
            </Link>
          }
        />
      </PublicFrame>
    );
  }
  if (rec.person.username && rec.person.username !== username) redirect(`/record/${rec.person.username}?t=${encodeURIComponent(token)}` as Route);
  const years = groupByYear(rec.entries);
  return (
    <PublicFrame>
      <div className="flex flex-col gap-1" data-testid="shared-record">
        <p className="text-body-sm text-text-secondary">The Record on Skilient · link valid until {rec.expiresLabel}</p>
        <h1 className="font-serif text-h1">{rec.person.name}</h1>
        <p className="text-body text-text-secondary">
          {rec.person.university}
          {rec.person.department ? ` · ${rec.person.department}` : ""}
        </p>
      </div>
      {years.length ? (
        years.map((y) => (
          <section key={y.year} aria-labelledby={`y-${y.year}`} className="neu-card px-5 py-2">
            <h2 id={`y-${y.year}`} className="pt-3 font-mono text-body-sm font-semibold text-text-secondary">
              {y.label}
            </h2>
            <ul className="flex flex-col">
              {y.entries.map((e) => (
                <RecordEntry
                  key={e.code}
                  issuer={e.issuerName}
                  title={`${KIND_LABELS[e.kind]}: ${e.title}`}
                  date={e.dateLabel}
                  evidence={e.line ? <span>{e.line}</span> : null}
                  action={
                    <Link href={`/verify/${e.code}` as Route} className="font-mono text-body-sm font-semibold underline underline-offset-4" aria-label={`Verify ${e.title}`}>
                      {formatCode(e.code)}
                    </Link>
                  }
                />
              ))}
            </ul>
          </section>
        ))
      ) : (
        <EmptyState title="Nothing shown yet" description="The student hasn't any entries to show on this link." />
      )}
    </PublicFrame>
  );
}
