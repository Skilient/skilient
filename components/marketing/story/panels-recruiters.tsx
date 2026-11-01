import { Check, LockSimple, MagnifyingGlass, SealCheck, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import { opportunities, recruitersPage } from "@/content/marketing";
import { captures } from "@/lib/marketing/captures";
import { CaptureImage } from "../capture-image";
import { Seal, TierBadge } from "../neu";

const st = recruitersPage.stage;

/** A panel's head: what the window is, labelled a sample. */
export function PanelHead({ title }: { title: string }) {
  return (
    <div className="panel-head">
      <span className="neu-mono text-text-secondary">{title}</span>
      <span className="panel-sample neu-mono">{st.sample}</span>
    </div>
  );
}

/** Chapter 1: the search, names hidden, every skill with its proof. */
export function SearchPanel() {
  const c = st.candidate;
  return (
    <div className="panel">
      <PanelHead title="Talent search" />
      <div className="panel-search neu-well-s">
        <MagnifyingGlass aria-hidden weight="bold" className="size-4 text-text-secondary" />
        <span className="font-semibold">{st.search.query}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {st.search.filters.map((f) => (
          <span key={f} className="panel-chip neu-mono">
            {f}
          </span>
        ))}
      </div>
      <span className="neu-mono text-text-secondary">{st.search.results} results</span>
      <div className="panel-candidate neu-tile">
        <div className="flex items-center gap-3">
          <span className="panel-avatar tier-finish tier-finish-flare">
            <LockSimple aria-hidden weight="bold" className="size-4" />
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="text-body-sm font-semibold">{st.search.hidden}</span>
            <span className="text-[0.8125rem] text-text-secondary">{c.context}</span>
          </div>
          <TierBadge tier="flare" name={c.tier} size="sm" className="ml-auto" />
        </div>
        {c.skills.map((s) => (
          <span key={s.name} className="panel-skill">
            <span className="text-body-sm font-semibold">{s.name}</span>
            <span className="panel-level neu-mono">{s.level}</span>
            <span className="neu-mono ml-auto text-text-secondary">{s.evidence}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Chapter 2: one skill opened on its evidence. */
export function EvidencePanel() {
  return (
    <div className="panel">
      <PanelHead title="Evidence" />
      <div className="flex items-center gap-2">
        <span className="text-h4 font-semibold">{st.evidence.skill}</span>
        <span className="panel-level neu-mono">Level 4</span>
      </div>
      <ul className="flex flex-col gap-2">
        {st.evidence.items.map((item) => (
          <li key={item} className="panel-row neu-tile">
            <SealCheck aria-hidden weight="bold" className="size-4 shrink-0 text-[var(--signal-ink)]" />
            <span className="text-body-sm">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Chapter 3: the real contact request a student sees (product capture, sample content). */
export function ContactPanel() {
  return (
    <div className="panel">
      <PanelHead title="What she sees" />
      <div className="panel-capture panel-capture-short neu-well">
        <CaptureImage file={captures.sections.contactRequest} alt={opportunities.cells.requests.alt} />
      </div>
    </div>
  );
}

/** Chapter 4: the Jobs tab, every post with its pay (product capture, sample content). */
export function HirePanel() {
  return (
    <div className="panel">
      <PanelHead title="Opportunities · Jobs" />
      <div className="panel-capture neu-well">
        <CaptureImage file={captures.sections.jobs} alt={opportunities.cells.jobs.alt} />
      </div>
    </div>
  );
}

/** Chapter 5: the company, verified, as students see it before they answer. */
export function TrustPanel() {
  const co = st.company;
  return (
    <div className="panel">
      <PanelHead title="Company page" />
      <div className="flex items-center gap-3">
        <Seal size={40} />
        <div className="flex flex-col">
          <span className="text-h4 font-semibold">{co.name}</span>
          <span className="neu-mono text-text-secondary">{co.meta}</span>
        </div>
      </div>
      <span className="panel-verified neu-mono">
        <ShieldCheck aria-hidden weight="fill" className="size-4" />
        {co.verified}
      </span>
      <ul className="flex flex-col gap-2">
        {[co.domain, "Two-factor on every seat", "Checked before seeing any student"].map((line) => (
          <li key={line} className="panel-row neu-tile">
            <Check aria-hidden weight="bold" className="size-4 shrink-0 text-[var(--signal-ink)]" />
            <span className="text-body-sm">{line}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
