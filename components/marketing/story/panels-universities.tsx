import { Check, Eye, Ticket } from "@phosphor-icons/react/dist/ssr";
import { pricingTeaser, universitiesPage } from "@/content/marketing";
import { cn } from "@/lib/cn";

const st = universitiesPage.stage;

function Head({ title }: { title: string }) {
  return (
    <div className="panel-head">
      <span className="neu-mono text-text-secondary">{title}</span>
      <span className="panel-sample neu-mono">{st.sample}</span>
    </div>
  );
}

/** A toggle as the brief draws it: an inset track, a raised knob, the track orange when on. */
function Toggle({ on = true }: { on?: boolean }) {
  return (
    <span aria-hidden className={cn("panel-toggle", on && "panel-toggle-on")}>
      <span className="panel-knob" />
    </span>
  );
}

/** Chapter 1: the university's own space, modules switched on. */
export function EcospherePanel() {
  return (
    <div className="panel">
      <Head title="Ecosphere" />
      <div className="panel-brand">
        <span className="panel-crest">NUT</span>
        <span className="text-body font-semibold">{st.name}</span>
      </div>
      <ul className="flex flex-col gap-2">
        {st.modules.map((m) => (
          <li key={m} className="panel-row neu-tile justify-between">
            <span className="text-body-sm">{m}</span>
            <Toggle />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Chapter 2: proven skills by department, in countable cells; small groups never shown. */
export function DashboardPanel() {
  const d = st.dashboard;
  return (
    <div className="panel">
      <Head title="Dashboard" />
      <span className="text-body-sm font-semibold">{d.heading}</span>
      <ul className="flex flex-col gap-2.5">
        {d.rows.map((row) => {
          const cells = Math.round(row.students / 5);
          return (
            <li key={row.skill} className="panel-bar">
              <span className="text-body-sm">{row.skill}</span>
              <span className="panel-cells">
                {Array.from({ length: 9 }, (_, i) => (
                  <i key={i} data-on={i < cells ? "" : undefined} />
                ))}
              </span>
              <span className="neu-mono tabular-nums">{row.students}</span>
            </li>
          );
        })}
      </ul>
      <span className="neu-mono text-text-secondary">{d.hidden}</span>
    </div>
  );
}

/** Chapter 3: a student record opened, and the line it leaves in the log. */
export function RecordsPanel() {
  const r = st.record;
  return (
    <div className="panel">
      <Head title="Student record" />
      <div className="flex items-center gap-3">
        <span className="panel-avatar tier-finish tier-finish-flare">AK</span>
        <span className="text-body font-semibold">{r.person}</span>
      </div>
      <div className="panel-row neu-well-s">
        <Eye aria-hidden weight="bold" className="size-4 shrink-0 text-[var(--signal-ink)]" />
        <span className="flex flex-col">
          <span className="text-body-sm font-semibold">
            {r.note} · {r.viewer}
          </span>
          <span className="neu-mono text-text-secondary">{r.when}</span>
        </span>
      </div>
      <span className="neu-mono text-text-secondary">On Student Pro she sees who viewed it, and when.</span>
    </div>
  );
}

/** Chapter 4: the fair, booths and their queues. */
export function FairPanel() {
  const f = st.fair;
  return (
    <div className="panel">
      <Head title="Job fair" />
      <span className="text-body font-semibold">{f.heading}</span>
      <ul className="flex flex-col gap-2">
        {f.booths.map((b) => (
          <li key={b.name} className={cn("panel-row justify-between", b.queue === "You’re next" ? "neu-tile" : "neu-well-s")}>
            <span className="neu-mono">{b.name}</span>
            <span className={cn("neu-mono", b.queue === "You’re next" ? "text-[var(--signal-ink)]" : "text-text-secondary")}>{b.queue}</span>
          </li>
        ))}
      </ul>
      <span className="panel-chip neu-mono inline-flex items-center gap-1.5 self-start">
        <Ticket aria-hidden weight="bold" className="size-3.5" />
        Check-in by code
      </span>
    </div>
  );
}

/** Chapter 5: Student Pro, sponsored by the university. */
export function ProPanel() {
  return (
    <div className="panel">
      <Head title="Student Pro" />
      <span className="text-h4 font-semibold">{st.pro.line}</span>
      <span className="neu-mono text-text-secondary">{st.pro.who}</span>
      <ul className="flex flex-col gap-2">
        {pricingTeaser.perks.map((perk) => (
          <li key={perk} className="panel-row neu-tile">
            <Check aria-hidden weight="bold" className="size-4 shrink-0 text-[var(--signal-ink)]" />
            <span className="text-body-sm">{perk}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
