import type { Metadata, Route } from "next";
import Link from "next/link";
import { ActionButton } from "@/components/societies/action-button";
import { RequestSwapButton, WantForm } from "@/components/growth/swap-forms";
import { Avatar, Badge, EmptyState, Tabs, TabCount, TabsContent, TabsList, TabsTrigger } from "@/components/ui";
import { cancelSwapRequest, respondSwap, saveSwapOffer, saveSwapWant } from "@/lib/actions/growth";
import { getSkillOptions, getSwapsPage } from "@/lib/data/growth";
import { hoursLabel, SWAP_STATUS_LABELS } from "@/lib/growth/constants";

export const metadata: Metadata = { title: "Skill swap" };

const TABS = ["learn", "teach", "mine"] as const;

/**
 * /swaps (PRD 5.32, screen spec §3.14 "Skill swap"): Learn (wants and the teachers at your
 * university), Teach (skills at L2 or higher you offer, and requests to you), My swaps. Learners
 * confirm sessions; confirmed hours land on the teacher's Record as a Taught entry when it closes.
 */
export default async function SwapsPage({ searchParams }: PageProps<"/swaps">) {
  const sp = await searchParams;
  const tab = TABS.find((t) => t === sp.tab) ?? "learn";
  const [p, skills] = await Promise.all([getSwapsPage(), getSkillOptions()]);
  const wanted = new Set(p.wants.map((w) => w.skillId));
  const offerable = p.teachable.map((t) => ({ id: t.skillId, name: t.name }));
  const focus = typeof sp.skill === "string" ? sp.skill : null;

  return (
    <main className="mx-auto flex w-full max-w-page flex-col gap-6 px-[var(--page-gutter)] py-6" data-testid="swaps-page">
      <header className="flex flex-col gap-1">
        <h1 className="text-h1">Skill swap</h1>
        <p className="max-w-prose text-body text-text-secondary">
          Learn from seniors at your university and teach what you&apos;ve proved. The learner confirms each session; only confirmed hours count.
        </p>
        {p.minutesTaught ? <p className="neu-mono text-text-secondary">You&apos;ve taught {hoursLabel(p.minutesTaught)}</p> : null}
      </header>

      <Tabs defaultValue={tab}>
        <TabsList aria-label="Skill swap">
          <TabsTrigger value="learn">Learn</TabsTrigger>
          <TabsTrigger value="teach">
            Teach {p.requests.length ? <TabCount>{p.requests.length}</TabCount> : null}
          </TabsTrigger>
          <TabsTrigger value="mine">My swaps</TabsTrigger>
        </TabsList>

        <TabsContent value="learn" className="mt-4 flex flex-col gap-4">
          <section className="neu-card p-5">
            <WantForm skills={skills.filter((s) => !wanted.has(s.id))} />
          </section>
          {p.wants.length ? (
            p.wants.map((w) => (
              <section key={w.skillId} aria-labelledby={`want-${w.skillId}`} className="neu-card flex flex-col gap-3 p-5" data-testid="want" data-skill={w.skillId} data-focus={focus === w.skillId || undefined}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 id={`want-${w.skillId}`} className="text-h3">
                    {w.name}
                  </h2>
                  <ActionButton action={saveSwapWant} args={{ skill: w.skillId, on: false }} variant="ghost">
                    Remove
                  </ActionButton>
                </div>
                {w.teachers.length ? (
                  <ul className="flex flex-col divide-y divide-[var(--border-muted)]">
                    {w.teachers.map((t) => (
                      <li key={t.username} className="flex flex-wrap items-center gap-3 py-3" data-testid="teacher">
                        <Avatar name={t.name} src={t.avatarUrl} size="sm" />
                        <div className="min-w-0 flex-1">
                          <Link href={`/profile/${t.username}` as Route} className="font-semibold underline-offset-4 hover:underline">
                            {t.name}
                          </Link>
                          <p className="neu-mono text-text-secondary">
                            L{t.level} {w.name}
                            {t.minutes ? ` · ${hoursLabel(t.minutes)} taught` : " · new teacher"}
                          </p>
                          {t.note ? <p className="text-body-sm">{t.note}</p> : null}
                          {t.notes.length ? (
                            <ul className="mt-1 flex flex-col gap-1">
                              {t.notes.map((n) => (
                                <li key={n} className="text-body-sm text-text-secondary">
                                  &ldquo;{n}&rdquo;
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                        {t.open ? (
                          <Badge tone="neutral">Asked</Badge>
                        ) : (
                          <RequestSwapButton teacher={t.username} teacherName={t.name} skill={w.skillId} skillName={w.name} offerable={offerable} />
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-body-sm text-text-secondary">No teachers at your university yet. We&apos;ll show them here when someone offers {w.name}.</p>
                )}
              </section>
            ))
          ) : (
            <EmptyState object="bulb" title="What do you want to learn?" description="Add a skill above to see who teaches it at your university." />
          )}
        </TabsContent>

        <TabsContent value="teach" className="mt-4 flex flex-col gap-4">
          <section aria-labelledby="requests-h" className="neu-card flex flex-col gap-3 p-5">
            <h2 id="requests-h" className="text-h3">
              Requests to you
            </h2>
            {p.requests.length ? (
              <ul className="flex flex-col divide-y divide-[var(--border-muted)]" data-testid="swap-requests">
                {p.requests.map((q) => (
                  <li key={q.id} className="flex flex-col gap-2 py-3" data-testid="swap-request">
                    <div className="flex items-center gap-3">
                      <Avatar name={q.learner} src={q.avatarUrl} size="sm" />
                      <p className="min-w-0 flex-1">
                        <span className="font-semibold">{q.learner}</span> wants to learn <span className="font-semibold">{q.skill}</span>
                        {q.offeredSkill ? <span> and offers {q.offeredSkill} back</span> : null}
                      </p>
                    </div>
                    {q.note ? <p className="text-body-sm">{q.note}</p> : null}
                    <p className="text-caption text-text-secondary">
                      {q.preferredTimes ? `${q.preferredTimes} · ` : ""}answer by {q.expiresLabel}
                    </p>
                    <div className="flex gap-2">
                      <ActionButton action={respondSwap} args={{ swapId: q.id, accept: true }} variant="primary" testId="swap-accept">
                        Accept
                      </ActionButton>
                      <ActionButton action={respondSwap} args={{ swapId: q.id, accept: false }} variant="ghost">
                        Decline
                      </ActionButton>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-body-sm text-text-secondary">No requests yet. Offer a skill below and learners at your university can ask you.</p>
            )}
          </section>
          <section aria-labelledby="teach-h" className="neu-card flex flex-col gap-3 p-5">
            <h2 id="teach-h" className="text-h3">
              I can teach
            </h2>
            {p.teachable.length ? (
              <ul className="flex flex-col divide-y divide-[var(--border-muted)]">
                {p.teachable.map((t) => (
                  <li key={t.skillId} className="flex flex-wrap items-center gap-3 py-3" data-testid="teachable" data-skill={t.skillId}>
                    <span className="min-w-0 flex-1">
                      <span className="font-semibold">{t.name}</span> <span className="neu-mono text-text-secondary">L{t.level} verified</span>
                      {t.wantedBy ? <span className="text-caption text-text-secondary"> · {t.wantedBy} want to learn it here</span> : null}
                    </span>
                    {t.offered ? <Badge tone="verified">Offered</Badge> : null}
                    <ActionButton action={saveSwapOffer} args={{ skill: t.skillId, on: !t.offered }} variant={t.offered ? "ghost" : "secondary"} testId={`offer-${t.skillId}`}>
                      {t.offered ? "Stop offering" : "Offer"}
                    </ActionButton>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-body-sm text-text-secondary">
                You can teach skills you hold at L2 or higher. <Link href="/me/paths" className="underline underline-offset-4">Your paths</Link> show what to prove next.
              </p>
            )}
          </section>
        </TabsContent>

        <TabsContent value="mine" className="mt-4">
          {p.swaps.length ? (
            <ul className="flex flex-col gap-3" data-testid="my-swaps">
              {p.swaps.map((s) => (
                <li key={s.id} className="neu-card flex flex-wrap items-center gap-3 p-4" data-testid="my-swap">
                  <Avatar name={s.other} src={s.avatarUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/swaps/${s.id}` as Route} className="font-semibold underline-offset-4 hover:underline">
                      {s.role === "teacher" ? `Teaching ${s.other} ${s.skill}` : `Learning ${s.skill} from ${s.other}`}
                    </Link>
                    <p className="text-caption text-text-secondary">
                      {s.sessions} confirmed {s.sessions === 1 ? "session" : "sessions"}
                      {s.nextSessionLabel ? ` · next ${s.nextSessionLabel}` : ""} · since {s.requestedLabel}
                    </p>
                  </div>
                  <Badge tone={s.status === "accepted" ? "success" : "neutral"}>{SWAP_STATUS_LABELS[s.status]}</Badge>
                  {s.status === "requested" && s.role === "learner" ? (
                    <ActionButton action={cancelSwapRequest} args={{ swapId: s.id }} variant="ghost">
                      Cancel
                    </ActionButton>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState object="chai" title="No swaps yet" description="Ask a teacher from the Learn tab, or offer a skill on the Teach tab." />
          )}
          {p.notesPending ? (
            <p className="mt-3 text-body-sm" data-testid="notes-pending">
              {p.notesPending} thank-you {p.notesPending === 1 ? "note waits" : "notes wait"} for your approval: open the swap to approve.
            </p>
          ) : null}
        </TabsContent>
      </Tabs>
    </main>
  );
}
