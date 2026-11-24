import { Badge } from "@/components/ui";
import type { CvSnapshotV1 } from "@/lib/cv/types";
import { CATEGORY_NAMES, LEVELS, type ShownLevel, type SkillCategory } from "@/lib/skills/levels";

/**
 * The evidence behind a signed CV (decisions 2026-10-19): the CV itself reads like any CV, and
 * this section, under it on /verify/[code] and share links, shows what Skilient checked for each
 * item. Built from the same signed snapshot; sections the student left off the CV stay off here.
 */

const TIER_ORDER = ["raw", "spark", "flare", "shine", "radiant", "luminary"];
const ORDINALS = ["first", "second", "third", "fourth", "fifth", "sixth"];

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

function counts(parts: (string | false | 0)[]): string {
  return parts.filter(Boolean).join(" · ");
}

function levelName(level: number): string {
  return LEVELS[Math.min(4, Math.max(2, level)) as ShownLevel].other;
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6 first-of-type:mt-5">
      <h3 className="text-h4">{title}</h3>
      {children}
    </div>
  );
}

export function CvEvidence({ snapshot: s }: { snapshot: CvSnapshotV1 }) {
  const shown = new Set(s.sections);
  const skills = shown.has("skills") ? s.skills : [];
  const projects = shown.has("projects") ? s.projects : [];
  const levels = [...new Set(skills.map((k) => Math.min(4, Math.max(2, k.level))))].sort((a, b) => b - a) as ShownLevel[];
  const tier = s.standing.tier;
  const activities = shown.has("activities") ? (s.activities ?? []) : [];
  const others = (["open_source", "endorsements", "credentials"] as const).some((k) => shown.has(k) && s[k].length > 0);
  if (!tier && !projects.length && !skills.length && !others && !activities.length) return null;

  return (
    <section aria-labelledby="evidence-h" className="rounded-lg border border-border-default bg-bg-surface p-5 sm:p-6" data-testid="cv-evidence">
      <h2 id="evidence-h" className="font-display text-h3">
        Evidence behind this CV
      </h2>
      <p className="mt-1 text-body-sm text-text-secondary">What Skilient checked for each item on the CV above, from the same signed record.</p>

      {tier ? (
        <Block title="Standing">
          <p className="mt-2 text-body-sm">
            {tier.charAt(0).toUpperCase() + tier.slice(1)} is the {ORDINALS[TIER_ORDER.indexOf(tier)] ?? ""} of six Skilient tiers.
            {s.standing.top_percent ? ` Their score is in the top ${s.standing.top_percent}% of students on Skilient.` : ""} Scores come from
            verified work, skills, endorsements and credentials; rank can&rsquo;t be bought.
          </p>
        </Block>
      ) : null}

      {projects.length ? (
        <Block title="Projects">
          <ul className="mt-2 divide-y divide-border-default rounded-md border border-border-default">
            {projects.map((p) => (
              <li key={p.id} className="flex flex-col gap-1 px-4 py-3" data-testid="evidence-project">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{p.title}</span>
                  {p.faculty_reviewed ? <Badge tone="verified">Reviewed by faculty</Badge> : null}
                  {p.ai_assisted ? <Badge>AI-assisted</Badge> : null}
                </div>
                <p className="text-body-sm text-text-secondary">
                  {counts([
                    p.verified_entries > 0 && plural(p.verified_entries, "verified contribution"),
                    p.faculty_confirmed > 0 && `${plural(p.faculty_confirmed, "entry", "entries")} confirmed by faculty`,
                    p.deliverables > 0 && plural(p.deliverables, "verified deliverable"),
                    p.repository ? `Code: ${p.repository}` : 0,
                  ]) || "Member of the team"}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-body-sm text-text-secondary">
            A verified contribution is one a teammate confirmed, or a commit to the project&rsquo;s repository that counted. The bullets on
            the CV are the student&rsquo;s own notes on contributions a teammate confirmed.
          </p>
          {projects.some((p) => p.ai_assisted) ? (
            <p className="mt-2 text-body-sm text-text-secondary">
              AI-assisted: most of the student&rsquo;s code on that project was written by an AI coding agent through pull requests they
              opened. Skilient allows this and says so.
            </p>
          ) : null}
        </Block>
      ) : null}

      {skills.length ? (
        <Block title="Skills">
          <dl className="mt-2 grid gap-x-4 gap-y-1 text-body-sm sm:grid-cols-[auto_1fr]">
            {levels.map((l) => (
              <div key={l} className="contents">
                <dt className="font-semibold">{LEVELS[l].other}</dt>
                <dd className="text-text-secondary">{LEVELS[l].rule}</dd>
              </div>
            ))}
          </dl>
          <ul className="mt-3 divide-y divide-border-default rounded-md border border-border-default">
            {skills.map((k) => (
              <li key={k.id} className="flex flex-col gap-1 px-4 py-3" data-testid="evidence-skill">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{k.name}</span>
                  {k.category && k.category in CATEGORY_NAMES ? (
                    <span className="text-caption text-text-secondary">{CATEGORY_NAMES[k.category as SkillCategory]}</span>
                  ) : null}
                  <Badge tone="verified">{levelName(k.level)}</Badge>
                  {k.ai_assisted ? <Badge>AI-assisted</Badge> : null}
                </div>
                <p className="text-body-sm text-text-secondary">
                  {counts([
                    k.evidence.repos > 0 && plural(k.evidence.repos, "repository", "repositories"),
                    k.evidence.active_days > 0 && plural(k.evidence.active_days, "active day"),
                    k.evidence.pull_requests > 0 && plural(k.evidence.pull_requests, "merged pull request"),
                    k.evidence.entries > 0 && plural(k.evidence.entries, "confirmed contribution"),
                    k.evidence.endorsements > 0 && plural(k.evidence.endorsements, "endorsement"),
                  ])}
                </p>
              </li>
            ))}
          </ul>
          {skills.some((k) => k.ai_assisted) ? (
            <p className="mt-2 text-body-sm text-text-secondary">
              AI-assisted: most of the code behind the skill was written by an AI coding agent. A passed Skilient code check removes the
              label.
            </p>
          ) : null}
        </Block>
      ) : null}

      {shown.has("open_source") && s.open_source.length ? (
        <Block title="Open-source work">
          <p className="mt-2 text-body-sm">
            Each pull request was merged into a repository the student doesn&rsquo;t own, and merged or approved by another developer.
          </p>
        </Block>
      ) : null}

      {shown.has("endorsements") && s.endorsements.length ? (
        <Block title="Endorsements">
          <p className="mt-2 text-body-sm">Each endorsement comes from someone on that project and is tied to one of the student&rsquo;s confirmed contributions.</p>
        </Block>
      ) : null}

      {activities.length ? (
        <Block title="Leadership and activities">
          <p className="mt-2 text-body-sm">Each is a signed entry on the student&rsquo;s Record, issued by a verified society or by Skilient. Its code opens the entry.</p>
          <ul className="mt-2 flex flex-col gap-1 text-body-sm" data-testid="activities-evidence">
            {activities.map((a) => (
              <li key={a.code}>
                <span className="font-semibold">{a.label}</span>
                {a.line ? ` · ${a.line}` : ""} ·{" "}
                <a href={`/verify/${a.code}`} className="font-mono underline underline-offset-4">
                  {a.code.slice(0, 5)}-{a.code.slice(5)}
                </a>
              </li>
            ))}
          </ul>
        </Block>
      ) : null}

      {shown.has("credentials") && s.credentials.length ? (
        <Block title="Credentials">
          <p className="mt-2 text-body-sm">Each credential was checked by a Skilient reviewer against the certificate the student uploaded.</p>
        </Block>
      ) : null}
    </section>
  );
}
