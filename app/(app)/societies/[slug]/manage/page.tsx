import { ArrowLeft, Bank, CalendarPlus } from "@phosphor-icons/react/dist/ssr";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EventCard } from "@/components/events/event-card";
import { ActionButton } from "@/components/societies/action-button";
import { SocietyImagesForm } from "@/components/societies/images-form";
import { DataTable, PageTitle, Section } from "@/components/uni/page-parts";
import { RpcForm } from "@/components/uni/rpc-form";
import { Badge, buttonClass } from "@/components/ui";
import {
  confirmTerm,
  decideJoinRequest,
  inviteOfficer,
  offerHandover,
  removeOfficer,
  setMembershipMode,
  updateSociety,
} from "@/lib/actions/societies";
import { getSocietyEventList } from "@/lib/data/events";
import { getSocietyManage, officerSociety } from "@/lib/data/societies";
import { defaultTerm, MEMBERSHIP_MODES, SOCIETY_CATEGORIES } from "@/lib/societies/constants";

export const metadata: Metadata = { title: "Manage society" };

/**
 * /societies/[slug]/manage (PRD 5.31): officers only. Details, images, how members join, join requests,
 * officers with terms and the handover, term-end confirmations (stored now; The Record issues from them
 * in phase 16), and links to payment details, events and induction rounds.
 */
export default async function ManageSocietyPage({ params }: PageProps<"/societies/[slug]/manage">) {
  const { slug } = await params;
  const page = await officerSociety(slug);
  if (!page || page.status !== "verified") notFound();
  const [m, events] = await Promise.all([getSocietyManage(page.id), getSocietyEventList(page.id)]);
  const term = defaultTerm();

  return (
    <main className="mx-auto flex w-full max-w-page flex-col gap-8 px-[var(--page-gutter)] py-6" data-testid="society-manage">
      <Link href={`/societies/${slug}` as Route} className="inline-flex items-center gap-1 text-body-sm font-semibold underline-offset-4 hover:underline">
        <ArrowLeft aria-hidden weight="bold" className="size-4" />
        {m.name}
      </Link>
      <PageTitle title="Manage">Only officers see this page. Changes to payment details need a second officer.</PageTitle>

      <div className="flex flex-wrap gap-3">
        <Link href={`/societies/${slug}/events/new` as Route} className={buttonClass("accent", "md")}>
          <CalendarPlus aria-hidden weight="bold" className="size-4" />
          Create event
        </Link>
        <Link href={`/societies/${slug}/manage/payments` as Route} className={buttonClass("secondary", "md")} data-testid="payment-details-link">
          <Bank aria-hidden weight="bold" className="size-4" />
          Payment details
        </Link>
        <Link href={`/societies/${slug}/inductions/new` as Route} className={buttonClass("secondary", "md")}>
          New induction round
        </Link>
      </div>
      {m.paidPaused ? <p className="text-body-sm text-text-error">Skilient has paused paid tickets for this society. Free events still work.</p> : null}

      <Section title="Details" id="details">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="neu-card p-5">
            <RpcForm
              action={updateSociety}
              extra={{ societyId: m.id }}
              submitLabel="Save details"
              successText="Saved."
              fields={[
                { name: "about", label: "About", type: "textarea", rows: 5, defaultValue: m.about },
                { name: "category", label: "Category", type: "select", options: SOCIETY_CATEGORIES.map((c) => ({ value: c.value, label: c.label })), defaultValue: m.category },
              ]}
            />
          </div>
          <div className="neu-card p-5">
            <SocietyImagesForm societyId={m.id} />
          </div>
        </div>
      </Section>

      <Section title="How members join" id="membership">
        <div className="neu-card p-5">
          <RpcForm
            action={setMembershipMode}
            extra={{ societyId: m.id }}
            submitLabel="Save"
            successText="Saved."
            testId="membership-form"
            fields={[
              {
                name: "mode",
                label: "Membership",
                type: "select",
                options: MEMBERSHIP_MODES.map((x) => ({ value: x.value, label: `${x.label}: ${x.hint}` })),
                defaultValue: m.membershipMode,
              },
            ]}
          />
        </div>
        {m.joinRequests.length ? (
          <DataTable
            testId="join-requests"
            head={["Student", "Asked", ""]}
            rows={m.joinRequests.map((j) => [
              j.name,
              <span key="d" className="neu-mono">
                {j.createdLabel}
              </span>,
              <span key="a" className="flex gap-2">
                <ActionButton action={decideJoinRequest} args={{ societyId: m.id, userId: j.userId, accept: true }} variant="primary">
                  Accept
                </ActionButton>
                <ActionButton action={decideJoinRequest} args={{ societyId: m.id, userId: j.userId, accept: false }} variant="ghost">
                  Decline
                </ActionButton>
              </span>,
            ])}
          />
        ) : null}
      </Section>

      <Section title="Officers and members" id="officers">
        <DataTable
          testId="members"
          head={["Name", "Role", "Since", ""]}
          rows={m.members.map((x) => [
            x.name,
            x.title ?? (x.role === "member" ? "Member" : x.role === "president" ? "President" : "Officer"),
            <span key="d" className="neu-mono">
              {x.joinedLabel}
            </span>,
            m.president && x.role === "officer" ? (
              <ActionButton key="r" action={removeOfficer} args={{ societyId: m.id, userId: x.userId }} variant="ghost" confirm={`Remove ${x.name} as an officer?`}>
                Remove as officer
              </ActionButton>
            ) : null,
          ])}
        />
        {m.invites.length ? (
          <ul className="flex flex-col gap-1 text-body-sm" data-testid="pending-invites">
            {m.invites.map((i) => (
              <li key={i.id}>
                <Badge tone="info">Invited</Badge> {i.name} {i.kind === "handover" ? "to take over as President" : `as ${i.title ?? "officer"}`}
                {i.termLabel ? <span className="neu-mono text-text-secondary"> ({i.termLabel})</span> : null}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="neu-card flex flex-col gap-3 p-5">
            <h3 className="text-h4">Invite an officer</h3>
            <RpcForm
              action={inviteOfficer}
              extra={{ societyId: m.id }}
              submitLabel="Send invitation"
              after="reset"
              testId="invite-officer"
              fields={[
                { name: "username", label: "Username", type: "text", placeholder: "@username", required: true },
                { name: "title", label: "Title", type: "text", placeholder: "General Secretary", required: true },
                { name: "termStart", label: "Term starts", type: "date", defaultValue: term.start },
                { name: "termEnd", label: "Term ends", type: "date", defaultValue: term.end },
              ]}
            />
          </div>
          {m.president ? (
            <div className="neu-card flex flex-col gap-3 p-5">
              <h3 className="text-h4">Hand over the presidency</h3>
              <p className="text-body-sm text-text-secondary">The new President accepts the handover; you stay a member, and your term ends that day.</p>
              <RpcForm
                action={offerHandover}
                extra={{ societyId: m.id }}
                submitLabel="Offer the handover"
                after="reset"
                testId="handover-form"
                fields={[{ name: "username", label: "Next President's username", type: "text", placeholder: "@username", required: true }]}
              />
            </div>
          ) : null}
        </div>
      </Section>

      <Section title="Terms" id="terms">
        <p className="text-body-sm text-text-secondary">
          When a term ends, the President (or, for the President, the next one) confirms it. Confirmed terms become Record entries when The Record opens.
        </p>
        <DataTable
          testId="terms"
          head={["Officer", "Role", "Term", "Status"]}
          rows={m.terms.map((t) => [
            t.name,
            t.title,
            <span key="t" className="neu-mono">
              {t.termLabel}
            </span>,
            t.confirmed ? (
              <Badge key="s" tone="success">
                Confirmed
              </Badge>
            ) : t.canConfirm ? (
              <ActionButton key="s" action={confirmTerm} args={{ termId: t.id }} variant="primary" testId="confirm-term">
                Confirm term
              </ActionButton>
            ) : t.due ? (
              <Badge key="s" tone="warning">
                Waiting for confirmation
              </Badge>
            ) : (
              <Badge key="s" tone="neutral">
                Current
              </Badge>
            ),
          ])}
        />
      </Section>

      <Section title="Events" id="events">
        {events.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {events.map((e) => (
              <EventCard key={e.id} e={e} href={`/events/${e.id}/manage`} />
            ))}
          </div>
        ) : (
          <p className="text-body-sm text-text-secondary">No events yet.</p>
        )}
      </Section>
    </main>
  );
}
