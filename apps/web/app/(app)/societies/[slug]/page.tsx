import { CalendarPlus, CheckCircle, Circle, GearSix, UsersThree } from "@phosphor-icons/react/dist/ssr";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EventCard } from "@/components/events/event-card";
import { ReportButton } from "@/components/reports/report-button";
import { ActionButton } from "@/components/societies/action-button";
import { ResubmitForm } from "@/components/societies/resubmit-form";
import { Avatar, Badge, buttonClass, EmptyState } from "@/components/ui";
import { followSociety, joinSociety, leaveSociety } from "@/lib/actions/societies";
import { getSocietyEventList } from "@/lib/data/events";
import { isRefusal } from "@/lib/data/rpc-json";
import { getSocietyPage, type SocietyPage } from "@/lib/data/societies";
import { categoryLabel, MEMBERSHIP_MODES, SOCIETY_STATUS } from "@/lib/societies/constants";

export const metadata: Metadata = { title: "Society" };

const TABS = [
  { key: "about", label: "About" },
  { key: "events", label: "Events" },
  { key: "inductions", label: "Inductions" },
] as const;

/**
 * A society (PRD 5.31, screen spec 3.14): cover and logo, follow and join (by its membership mode),
 * the officers' roll call with former officers, its events and open induction rounds. Officers see
 * the setup checklist and Manage. Signed-in only; a pending society is visible to its requester.
 */
export default async function SocietyPageRoute({ params, searchParams }: PageProps<"/societies/[slug]">) {
  const { slug } = await params;
  const sp = await searchParams;
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) notFound();
  let s: SocietyPage;
  try {
    s = await getSocietyPage(slug);
  } catch (err) {
    if (isRefusal(err, "P0002", "42501")) notFound();
    throw err;
  }
  const tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as (typeof TABS)[number]["key"]) : "about";
  const verified = s.status === "verified";
  const events = verified && tab === "events" ? await getSocietyEventList(s.id) : [];
  const status = SOCIETY_STATUS[s.status];
  const mode = MEMBERSHIP_MODES.find((m) => m.value === s.membershipMode);

  return (
    <main className="mx-auto flex w-full max-w-page flex-col gap-6 px-[var(--page-gutter)] py-6" data-testid="society-page">
      <header className="neu-card flex flex-col overflow-hidden">
        {/* No cover, no placeholder: an empty well read as a blank field (design gates 2026-11-04). */}
        {s.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- society cover from the public bucket
          <img src={s.coverUrl} alt="" className="h-40 w-full object-cover sm:h-56" />
        ) : null}
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-start gap-4">
            <Avatar name={s.name} src={s.logoUrl} size="xl" />
            <div className="flex flex-col gap-1">
              <h1 className="font-display text-h1">{s.name}</h1>
              <p className="text-body-sm text-text-secondary">
                {categoryLabel(s.category)} · {s.university}
              </p>
              <p className="flex flex-wrap items-center gap-2 text-caption text-text-secondary">
                {status ? <Badge tone={status.tone}>{status.label}</Badge> : null}
                <span className="neu-mono inline-flex items-center gap-1">
                  <UsersThree aria-hidden weight="bold" className="size-3.5" />
                  {s.members} members · {s.followers} followers
                </span>
              </p>
            </div>
          </div>
          {verified ? (
            <div className="flex flex-wrap items-start gap-2">
              <ActionButton action={followSociety} args={{ societyId: s.id, on: !s.following }} variant={s.following ? "ghost" : "secondary"} testId="follow-society">
                {s.following ? "Following" : "Follow"}
              </ActionButton>
              {s.myRole ? (
                s.myRole === "member" ? (
                  <ActionButton action={leaveSociety} args={{ societyId: s.id }} variant="ghost" confirm={`Leave ${s.name}?`}>
                    Leave
                  </ActionButton>
                ) : null
              ) : s.joinRequested ? (
                <Badge tone="info">Join request sent</Badge>
              ) : s.membershipMode === "inductions" ? (
                <Link href={`/societies/${s.slug}?tab=inductions` as Route} className={buttonClass("primary", "sm")}>
                  Apply in a round
                </Link>
              ) : (
                <ActionButton action={joinSociety} args={{ societyId: s.id }} variant="primary" testId="join-society">
                  {s.membershipMode === "open" ? "Join" : "Ask to join"}
                </ActionButton>
              )}
              {s.officer ? (
                <>
                  <Link href={`/societies/${s.slug}/manage` as Route} className={buttonClass("secondary", "sm")} data-testid="manage-society">
                    <GearSix aria-hidden weight="bold" className="size-4" />
                    Manage
                  </Link>
                  <Link href={`/societies/${s.slug}/events/new` as Route} className={buttonClass("accent", "sm")} data-testid="create-event">
                    <CalendarPlus aria-hidden weight="bold" className="size-4" />
                    Create event
                  </Link>
                </>
              ) : (
                <ReportButton targetType="society" targetId={s.id} compact />
              )}
            </div>
          ) : null}
        </div>
      </header>

      {!verified && s.statusReason ? (
        <section className="neu-card flex flex-col gap-2 p-5" data-testid="status-reason">
          <h2 className="text-h4">{s.status === "more_info" ? "Skilient needs more information" : "Note from Skilient"}</h2>
          <p className="text-body-sm whitespace-pre-line">{s.statusReason}</p>
        </section>
      ) : null}
      {s.status === "more_info" ? (
        <section className="neu-card flex flex-col gap-3 p-5">
          <h2 className="text-h4">Answer and send it back</h2>
          <ResubmitForm societyId={s.id} about={s.about} />
        </section>
      ) : null}
      {s.status === "pending" ? (
        <p className="text-body-sm text-text-secondary" data-testid="pending-note">
          Skilient is reviewing this request. Nobody else can see the society until it&apos;s verified.
        </p>
      ) : null}

      {verified && s.checklist ? (
        <section aria-labelledby="setup-h" className="neu-card flex flex-col gap-3 p-5" data-testid="setup-checklist">
          <h2 id="setup-h" className="text-h4">
            Set up your society
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ["logo", "Add a logo and cover", `/societies/${s.slug}/manage`],
                ["officers", "Invite your officers", `/societies/${s.slug}/manage#officers`],
                ["mode", "Choose how members join", `/societies/${s.slug}/manage#membership`],
                ["event", "Create your first event", `/societies/${s.slug}/events/new`],
              ] as const
            ).map(([key, label, href]) => (
              <li key={key} className="flex items-center gap-2 text-body-sm">
                {s.checklist![key] ? <CheckCircle aria-hidden weight="fill" className="size-5 text-success" /> : <Circle aria-hidden weight="bold" className="size-5 text-text-secondary" />}
                <Link href={href as Route} className="underline-offset-4 hover:underline">
                  {label}
                </Link>
                <span className="sr-only">{s.checklist![key] ? "(done)" : "(to do)"}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {verified ? (
        <>
          <nav aria-label="Society">
            <div className="neu-track">
              {TABS.map((t) => (
                <Link key={t.key} href={`/societies/${s.slug}${t.key === "about" ? "" : `?tab=${t.key}`}` as Route} aria-current={tab === t.key ? "page" : undefined}>
                  {t.label}
                  {t.key === "inductions" && s.openRounds > 0 ? ` (${s.openRounds})` : ""}
                </Link>
              ))}
            </div>
          </nav>

          {tab === "about" ? (
            <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
              <section aria-labelledby="about-h" className="flex flex-col gap-3">
                <h2 id="about-h" className="text-h3">
                  About
                </h2>
                <p className="text-body whitespace-pre-line">{s.about}</p>
                {mode ? (
                  <p className="text-body-sm text-text-secondary">
                    Membership: <span className="font-semibold text-text-primary">{mode.label}</span>. {mode.hint}
                  </p>
                ) : null}
              </section>
              <section aria-labelledby="roll-h" className="flex flex-col gap-3" data-testid="roll-call">
                <h2 id="roll-h" className="text-h3">
                  Officers
                </h2>
                <ul className="flex flex-col gap-2">
                  {s.rollCall.map((m) => (
                    <li key={m.userId} className="flex items-center gap-3">
                      <Avatar name={m.name} src={m.avatarUrl} size="sm" />
                      <span className="flex flex-col">
                        {m.username ? (
                          <Link href={`/profile/${m.username}` as Route} className="text-body-sm font-semibold underline-offset-4 hover:underline">
                            {m.name}
                          </Link>
                        ) : (
                          <span className="text-body-sm font-semibold">{m.name}</span>
                        )}
                        <span className="text-caption text-text-secondary">{m.title}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                {s.former.length ? (
                  <>
                    <h3 className="text-h4">Former officers</h3>
                    <ul className="flex flex-col gap-1">
                      {s.former.map((f, i) => (
                        <li key={i} className="text-body-sm">
                          {f.name} <span className="text-text-secondary">· {f.title}</span> <span className="neu-mono text-text-secondary">{f.termLabel}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </section>
            </div>
          ) : null}

          {tab === "events" ? (
            events.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {events.map((e) => (
                  <EventCard key={e.id} e={e} href={s.officer && e.status === "draft" ? `/events/${e.id}/manage` : undefined} />
                ))}
              </div>
            ) : (
              <EmptyState object="ticket" title="No events yet" description={s.officer ? "Create the society's first event." : "Follow the society to hear when it posts one."} />
            )
          ) : null}

          {tab === "inductions" ? (
            <section className="flex flex-col gap-3" data-testid="rounds">
              {s.officer ? (
                <Link href={`/societies/${s.slug}/inductions/new` as Route} className={buttonClass("secondary", "sm", "self-start")}>
                  New induction round
                </Link>
              ) : null}
              {s.rounds.length ? (
                <ul className="grid gap-3 md:grid-cols-2">
                  {s.rounds.map((r) => (
                    <li key={r.id} className="neu-card flex flex-col gap-1 p-4">
                      <Link href={`/societies/${s.slug}/inductions/${r.id}` as Route} className="text-h4 underline-offset-4 hover:underline">
                        {r.title}
                      </Link>
                      <p className="neu-mono text-text-secondary">Closes {r.deadlineLabel}</p>
                      <p className="flex items-center gap-2 text-caption text-text-secondary">
                        {r.status === "draft" ? <Badge tone="neutral">Draft</Badge> : <Badge tone="info">Open</Badge>}
                        {r.seats} {r.seats === 1 ? "seat" : "seats"} open
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState object="letter" title="No open induction rounds" description="When the society opens a round, its roles and questions show up here." />
              )}
            </section>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
