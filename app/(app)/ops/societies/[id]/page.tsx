import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClaimSocietyButton, DecideSocietyForm } from "@/components/ops/society-forms";
import { Badge } from "@/components/ui";
import { staffRoles } from "@/lib/data/ops-trust";
import { isRefusal } from "@/lib/data/rpc-json";
import { getOpsSocietyCase, proofLink, type OpsSocietyCase } from "@/lib/data/societies";
import { categoryLabel, REQUEST_STATUS, SOCIETY_STATUS } from "@/lib/societies/constants";

export const metadata: Metadata = { title: "Society request" };

/** One society request (PRD 5.31): the details, the requester, the proof (a 5-minute link), and the decision. */
export default async function OpsSocietyCasePage({ params }: PageProps<"/ops/societies/[id]">) {
  const roles = await staffRoles();
  if (!roles.has("trust_reviewer")) notFound();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  let c: OpsSocietyCase;
  try {
    c = await getOpsSocietyCase(id);
  } catch (err) {
    if (isRefusal(err, "P0002", "42501")) notFound();
    throw err;
  }
  const proof = await proofLink(c.proofPath);
  const status = SOCIETY_STATUS[c.status];
  const pending = c.requestStatus === "pending";
  const actions: ("approve" | "more_info" | "reject" | "suspend" | "reinstate" | "pause_paid" | "resume_paid")[] = pending
    ? ["approve", "more_info", "reject"]
    : c.status === "verified"
      ? ["suspend", "pause_paid", "resume_paid"]
      : c.status === "suspended"
        ? ["reinstate"]
        : [];

  return (
    <main className="flex flex-col gap-6" data-testid="ops-society-case">
      <Link href={"/ops/societies" as Route} className="text-body-sm font-semibold underline underline-offset-4">
        All society requests
      </Link>
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-h1">{c.name}</h1>
        <p className="flex flex-wrap items-center gap-2 text-body-sm text-text-secondary">
          {categoryLabel(c.category)} · {c.university}
          {status ? <Badge tone={status.tone}>{status.label}</Badge> : null}
          <Badge tone="neutral">Request: {REQUEST_STATUS[c.requestStatus] ?? c.requestStatus}</Badge>
        </p>
      </div>
      <section className="grid gap-4 rounded-lg border border-border-default bg-bg-surface p-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <h2 className="text-h4">About</h2>
          <p className="text-body-sm whitespace-pre-line">{c.about}</p>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-body-sm">
          <dt className="text-text-secondary">Requested by</dt>
          <dd>
            {c.requester?.name}
            {c.requester?.department ? `, ${c.requester.department}` : ""}
            {c.requester?.graduationYear ? ` (${c.requester.graduationYear})` : ""}
          </dd>
          <dt className="text-text-secondary">Office bearer</dt>
          <dd>{c.officeBearer ? "Confirmed by the requester" : "Not confirmed"}</dd>
          <dt className="text-text-secondary">Sent</dt>
          <dd className="font-mono">{c.createdLabel}</dd>
          <dt className="text-text-secondary">Proof</dt>
          <dd className="flex flex-col gap-1 break-all">
            {proof ? (
              <a href={proof} target="_blank" rel="noreferrer noopener" className="font-semibold underline underline-offset-4" data-testid="proof-link">
                Open the document (link works for 5 minutes)
              </a>
            ) : null}
            {c.proofUrl ? (
              <a href={c.proofUrl} target="_blank" rel="noreferrer noopener nofollow" className="underline underline-offset-4">
                {c.proofUrl}
              </a>
            ) : null}
          </dd>
          {c.statusReason ? (
            <>
              <dt className="text-text-secondary">Last note</dt>
              <dd className="whitespace-pre-line">{c.statusReason}</dd>
            </>
          ) : null}
        </dl>
      </section>
      <section className="flex flex-col gap-3 rounded-lg border border-border-default bg-bg-surface p-4">
        <h2 className="text-h4">Decision</h2>
        {pending && !c.mine ? (
          c.claimedBy ? (
            <p className="text-body-sm">{c.claimedBy} is reviewing this.</p>
          ) : (
            <>
              <p className="text-body-sm text-text-secondary">Claim the request so nobody else reviews it at the same time.</p>
              <ClaimSocietyButton societyId={c.id} claimed={false} />
            </>
          )
        ) : actions.length ? (
          <>
            {pending ? <ClaimSocietyButton societyId={c.id} claimed /> : null}
            <DecideSocietyForm societyId={c.id} actions={actions} />
          </>
        ) : (
          <p className="text-body-sm text-text-secondary">Nothing to decide.</p>
        )}
      </section>
    </main>
  );
}
