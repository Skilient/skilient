import type { Route } from "next";
import Link from "next/link";
import { ProfileCredentials } from "@/components/credentials/profile-credentials";
import { EndorsementList } from "@/components/endorsements/endorsement-list";
import { SkillList } from "@/components/skills/skill-list";
import { EmptyState, RecordEntry } from "@/components/ui";
import { getProfileCredentials } from "@/lib/data/credentials";
import { getEndorsements } from "@/lib/data/endorsements";
import { getAwardsFor } from "@/lib/data/uni";
import { getProfile } from "@/lib/data/profiles";
import { getProfileSkills } from "@/lib/data/skills";
import { getRecordHighlights } from "@/lib/data/record";
import { getSwapNotesFor } from "@/lib/data/growth";
import { hoursLabel } from "@/lib/growth/constants";
import { ReportButton } from "@/components/reports/report-button";
import { KIND_LABELS } from "@/lib/record/constants";
import { formatCode } from "@/supabase/functions/_shared/cv/sign.ts";
import { LOOKING_FOR, VISIBILITY } from "@/lib/profile/options";

/** Top skills on the overview; the Skills tab lists them all. */
const TOP_SKILLS = 8;

/** Overview tab: about, top skills, endorsements, credentials, studies and what they're open to. */
export default async function ProfileOverviewPage({ params }: PageProps<"/profile/[username]">) {
  const { username } = await params;
  const lookup = await getProfile(username);
  if (lookup.kind !== "full") return null;
  const p = lookup.profile;
  const [skills, endorsements, credentials, awards, highlights, swapNotes] = await Promise.all([
    getProfileSkills(p.userId, p.isOwner),
    getEndorsements(p.userId),
    getProfileCredentials(p.userId),
    getAwardsFor(p.userId).catch(() => []),
    getRecordHighlights(p.userId).catch(() => []),
    getSwapNotesFor(p.userId).catch(() => ({ minutes: 0, notes: [] })),
  ]);
  const openTo = LOOKING_FOR.filter((o) => p.lookingFor.includes(o.value)).map((o) => o.label);
  const details = [
    { label: "Programme", value: p.programme },
    { label: "Campus", value: p.campus },
  ].filter((d) => d.value);

  if (!p.bio && !details.length && !openTo.length && !skills.length && !endorsements.length && !credentials.length) {
    return (
      <EmptyState
        title={p.isOwner ? "Tell people about yourself" : "Nothing here yet"}
        description={p.isOwner ? "Add a one-line intro and your programme from Edit profile." : `${p.fullName} hasn't added an intro yet.`}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {p.bio ? (
        <section aria-labelledby="about">
          <h2 id="about" className="text-h4">
            About
          </h2>
          <p className="mt-2 text-body whitespace-pre-line text-text-primary">{p.bio}</p>
        </section>
      ) : null}
      {skills.length ? (
        <section aria-labelledby="top-skills">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 id="top-skills" className="text-h4">
              Top skills
            </h2>
            {skills.length > TOP_SKILLS ? (
              <Link
                href={`/profile/${p.username}/skills` as Route}
                className="text-body-sm font-semibold text-text-primary underline underline-offset-4"
              >
                All {skills.length} skills
              </Link>
            ) : null}
          </div>
          <SkillList
            skills={skills.slice(0, TOP_SKILLS)}
            isOwner={p.isOwner}
            ownerName={p.fullName.split(/\s+/)[0] ?? p.fullName}
            grouped={false}
          />
        </section>
      ) : null}
      {highlights.length ? (
        <section aria-labelledby="record-highlights" data-testid="record-highlights">
          <h2 id="record-highlights" className="mb-1 font-serif text-h4">
            From the Record
          </h2>
          <ul className="flex flex-col">
            {highlights.map((h) => (
              <RecordEntry
                key={h.code}
                issuer={h.issuerName}
                title={`${KIND_LABELS[h.kind]}: ${h.title}`}
                date={h.dateLabel}
                evidence={h.line ? <span>{h.line}</span> : null}
                action={
                  <span className="flex items-center gap-2">
                    <Link href={`/verify/${h.code}` as Route} className="font-mono text-body-sm underline underline-offset-4" aria-label={`Verify ${h.title}`}>
                      {formatCode(h.code)}
                    </Link>
                    {p.isOwner ? null : <ReportButton targetType="record_entry" targetId={h.id} compact />}
                  </span>
                }
              />
            ))}
          </ul>
        </section>
      ) : null}
      {swapNotes.notes.length ? (
        <section aria-labelledby="swap-notes" data-testid="swap-notes">
          <h2 id="swap-notes" className="mb-1 text-h4">
            Thank-you notes
          </h2>
          <p className="mb-2 neu-mono text-text-secondary">{hoursLabel(swapNotes.minutes)} taught in skill swaps</p>
          <ul className="flex flex-col gap-2">
            {swapNotes.notes.map((n) => (
              <li key={`${n.author}-${n.on}-${n.body}`} className="neu-well p-3">
                <p className="text-body-sm">&ldquo;{n.body}&rdquo;</p>
                <p className="text-caption text-text-secondary">
                  {n.author} · {n.skill} · {n.on}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {endorsements.length ? (
        <section aria-labelledby="endorsements" id="endorsements-section">
          <h2 id="endorsements" className="mb-3 text-h4">
            Endorsements
          </h2>
          <EndorsementList groups={endorsements} isOwner={p.isOwner} username={p.username} />
        </section>
      ) : p.isOwner && skills.length ? (
        <section aria-labelledby="endorsements" id="endorsements-section">
          <h2 id="endorsements" className="text-h4">
            Endorsements
          </h2>
          <p className="mt-2 text-body-sm text-text-secondary">
            None yet. Teammates endorse you from a venture&apos;s Team tab once it&apos;s in progress; two different teammates on a
            skill make it peer-verified.
          </p>
        </section>
      ) : null}
      {credentials.length || p.isOwner ? (
        <section aria-labelledby="credentials">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 id="credentials" className="text-h4">
              Credentials
            </h2>
            {p.isOwner ? (
              <Link href="/me/credentials" className="text-body-sm font-semibold text-text-primary underline underline-offset-4">
                {credentials.length ? "Manage" : "Add a credential"}
              </Link>
            ) : null}
          </div>
          {credentials.length ? (
            <ProfileCredentials items={credentials} />
          ) : (
            <p className="text-body-sm text-text-secondary">
              None approved yet. Certificates you add are checked by a Skilient reviewer before they show here.
            </p>
          )}
        </section>
      ) : null}
      {awards.length ? (
        <section aria-labelledby="awards" data-testid="profile-awards">
          <h2 id="awards" className="mb-3 text-h4">Awards</h2>
          <ul className="flex flex-col gap-2">
            {awards.map((a) => (
              <li key={a.id} className="text-body">
                <span className="font-semibold">{a.name}</span> <span className="text-text-secondary">awarded by {a.university}</span>
                {a.description ? <span className="block text-body-sm text-text-secondary">{a.description}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {details.length ? (
        <dl className="grid gap-4 sm:grid-cols-2">
          {details.map((d) => (
            <div key={d.label}>
              <dt className="text-label text-text-secondary uppercase">{d.label}</dt>
              <dd className="mt-1 text-body">{d.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {openTo.length ? (
        <section aria-labelledby="open-to">
          <h2 id="open-to" className="text-h4">
            Open to
          </h2>
          <p className="mt-2 text-body text-text-secondary">{openTo.join(", ")}</p>
        </section>
      ) : null}
      {p.isOwner ? (
        <p className="text-body-sm text-text-muted">
          Visible to: {VISIBILITY.find((v) => v.value === p.visibility)?.label.toLowerCase()}.
        </p>
      ) : null}
    </div>
  );
}
