import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClaimSocietyButton } from "@/components/ops/society-forms";
import { Badge, EmptyState } from "@/components/ui";
import { cn } from "@/lib/cn";
import { staffRoles } from "@/lib/data/ops-trust";
import { getOpsSocieties } from "@/lib/data/societies";
import { categoryLabel, REQUEST_STATUS } from "@/lib/societies/constants";

export const metadata: Metadata = { title: "Societies" };

const TABS = [
  { key: "open", label: "Waiting" },
  { key: "more_info", label: "More information" },
  { key: "decided", label: "Decided" },
] as const;

/** /ops/societies (PRD 5.31): society requests for trust reviewers, oldest first, reviewed within 3 working days. */
export default async function OpsSocietiesPage({ searchParams }: PageProps<"/ops/societies">) {
  const roles = await staffRoles();
  if (!roles.has("trust_reviewer")) notFound();
  const sp = await searchParams;
  const tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as (typeof TABS)[number]["key"]) : "open";
  const rows = await getOpsSocieties(tab);
  return (
    <main className="flex flex-col gap-6">
      <h1 className="font-display text-h1">Societies</h1>
      <p className="max-w-prose text-body text-text-secondary">
        Check the proof against the university&apos;s own records before approving. Approving makes the requester the President. Every decision is audited.
      </p>
      <nav aria-label="Request status" className="border-b border-border-default">
        <ul className="-mb-px flex gap-1">
          {TABS.map((t) => (
            <li key={t.key}>
              <Link
                href={(t.key === "open" ? "/ops/societies" : `/ops/societies?tab=${t.key}`) as Route}
                aria-current={tab === t.key ? "page" : undefined}
                className={cn("inline-flex h-11 items-center border-b-2 px-3 text-body font-semibold", tab === t.key ? "border-primary text-text-primary" : "border-transparent text-text-secondary hover:text-text-primary")}
              >
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {rows.length === 0 ? (
        <EmptyState title="Nothing here" description="Students request societies from Societies → Request a society." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border-default bg-bg-surface">
          <table className="w-full min-w-[760px] text-left text-body-sm" data-testid="society-queue">
            <thead className="border-b border-border-default bg-bg-subtle text-caption text-text-secondary">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold">Society</th>
                <th scope="col" className="px-3 py-2 font-semibold">University</th>
                <th scope="col" className="px-3 py-2 font-semibold">Requested by</th>
                <th scope="col" className="px-3 py-2 font-semibold">Waiting</th>
                <th scope="col" className="px-3 py-2 font-semibold">Status</th>
                <th scope="col" className="px-3 py-2 font-semibold">Claim</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-muted">
              {rows.map((r) => (
                <tr key={r.societyId}>
                  <td className="px-3 py-2">
                    <Link href={`/ops/societies/${r.societyId}` as Route} className="font-semibold underline underline-offset-4">
                      {r.name}
                    </Link>
                    <span className="block text-caption text-text-secondary">{categoryLabel(r.category)}</span>
                  </td>
                  <td className="px-3 py-2">{r.university}</td>
                  <td className="px-3 py-2">{r.requester}</td>
                  <td className={cn("px-3 py-2 font-mono", r.ageHours > 72 && r.requestStatus === "pending" && "text-text-error")}>{r.ageHours} h</td>
                  <td className="px-3 py-2">
                    <Badge tone={r.requestStatus === "approved" ? "success" : r.requestStatus === "rejected" ? "error" : "info"}>{REQUEST_STATUS[r.requestStatus] ?? r.requestStatus}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    {r.requestStatus === "pending" ? (
                      r.claimedBy && !r.mine ? (
                        <span className="text-caption text-text-secondary">{r.claimedBy}</span>
                      ) : (
                        <ClaimSocietyButton societyId={r.societyId} claimed={r.mine} />
                      )
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
