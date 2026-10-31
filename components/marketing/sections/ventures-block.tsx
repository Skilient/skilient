import { CheckCircle, RocketLaunch, UsersThree } from "@phosphor-icons/react/dist/ssr";
import { ventures } from "@/content/marketing";
import { captures } from "@/lib/marketing/captures";
import { CaptureImage } from "../capture-image";
import { Section, SectionHeading } from "./section";

const POINT_ICONS = [UsersThree, CheckCircle, RocketLaunch];
/** The team of the sample venture in the capture (tests/captures): the lead first. */
const TEAM = [
  { initials: "AS", tier: "flare" },
  { initials: "BA", tier: "spark" },
] as const;

/** Landing section 6 (PRD 5.1): a venture page as full-width media, with its three ideas beneath. */
export function VenturesBlock() {
  return (
    <Section labelledBy="ventures-title" step="04 · Ventures">
      <SectionHeading id="ventures-title" className="max-w-[20ch]">
        {ventures.heading}
      </SectionHeading>
      <p className="mt-5 max-w-[62ch] text-body-lg text-text-secondary">{ventures.body}</p>
      <div className="neu-card relative mt-10 p-3 md:mx-[8.33%]">
        <div className="overflow-hidden rounded-[var(--r-tile)]">
          <CaptureImage file={captures.sections.venture} alt={ventures.alt} />
        </div>
        {/* The team, overlapping with the lead in front (Synergy), and what is still open. */}
        <div aria-hidden className="neu-tile absolute -bottom-6 left-6 hidden items-center gap-3 py-2.5 pr-5 pl-3 sm:flex">
          <span className="flex -space-x-2.5">
            {TEAM.map((m, i) => (
              <span
                key={m.initials}
                className={`tier-finish tier-finish-${m.tier} inline-grid size-9 place-items-center rounded-full text-[0.75rem] font-semibold text-[#1b1b19] ring-2 ring-[var(--surface)]`}
                style={{ zIndex: TEAM.length - i }}
              >
                {m.initials}
              </span>
            ))}
            <span className="relative inline-grid size-9 place-items-center rounded-full bg-[var(--surface)] text-[0.75rem] font-semibold text-text-secondary shadow-[var(--pressed-s)] ring-2 ring-[var(--surface)]">+2</span>
          </span>
          <span className="flex flex-col">
            <span className="text-body-sm font-semibold">Ayesha Siddiqui and 3 others</span>
            <span className="neu-mono text-text-secondary">4 of 6 · 2 roles open</span>
          </span>
        </div>
      </div>
      <dl className="mt-14 grid gap-6 sm:grid-cols-3 md:mx-[8.33%]">
        {ventures.points.map((p, i) => (
          <div key={p.term} className="neu-tile flex flex-col gap-2 p-6">
            {(() => {
              const Icon = POINT_ICONS[i] ?? CheckCircle;
              return (
                <span aria-hidden className="neu-chip mb-2 inline-grid size-11 place-items-center">
                  <Icon weight="regular" className="size-5 text-[var(--signal-ink)]" />
                </span>
              );
            })()}
            <dt className="text-h4">{p.term}</dt>
            <dd className="text-body text-text-secondary">{p.detail}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}
