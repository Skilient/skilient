import { ChatCircle, Check, Code, SealCheck } from "@phosphor-icons/react/dist/ssr";
import type { CSSProperties } from "react";
import { facultyPage } from "@/content/marketing";

const st = facultyPage.stage;
/** The sample scores, one per rubric part (1 to 5). */
const SCORES = [4, 5, 4, 4, 5];

function Head({ title }: { title: string }) {
  return (
    <div className="panel-head">
      <span className="neu-mono text-text-secondary">{title}</span>
      <span className="panel-sample neu-mono">{st.sample}</span>
    </div>
  );
}

/** Chapter 1: the brief students start ventures from. */
export function IdeaPanel() {
  const i = st.idea;
  return (
    <div className="panel">
      <Head title="Project idea" />
      <span className="text-h4 font-semibold">{i.title}</span>
      <div className="flex flex-wrap gap-1.5">
        {i.skills.map((s) => (
          <span key={s} className="panel-chip neu-mono">
            {s}
          </span>
        ))}
      </div>
      <div className="panel-row neu-well-s justify-between">
        <span className="neu-mono">{i.team}</span>
        <span className="neu-mono">{i.deliverables}</span>
      </div>
      <span className="neu-mono text-text-secondary">Closes when its teams are full</span>
    </div>
  );
}

/** Chapter 2: the supervisor thread, apart from the team's chat. */
export function ThreadPanel() {
  return (
    <div className="panel">
      <Head title="Supervisor thread" />
      <ul className="flex flex-col gap-2.5">
        {st.thread.map((m, k) => (
          <li key={k} className={k === 0 ? "panel-bubble panel-bubble-me neu-well-s" : "panel-bubble neu-tile"}>
            <span className="neu-mono text-text-secondary">{m.who}</span>
            <span className="text-body-sm">{m.text}</span>
          </li>
        ))}
      </ul>
      <span className="neu-mono inline-flex items-center gap-1.5 text-text-secondary">
        <ChatCircle aria-hidden weight="bold" className="size-3.5" />
        Separate from the team’s chat
      </span>
    </div>
  );
}

/** Chapter 3: a contribution, confirmed. */
export function ConfirmPanel() {
  const c = st.confirm;
  return (
    <div className="panel">
      <Head title="Contribution" />
      <div className="panel-row neu-tile">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-body-sm font-semibold">{c.line}</span>
          <span className="neu-mono text-text-secondary">{c.who}</span>
        </span>
        <span className="panel-done neu-mono">
          <Check aria-hidden weight="bold" className="size-3.5" />
          {c.done}
        </span>
      </div>
      <span className="neu-mono text-text-secondary">Shows on her verified CV</span>
    </div>
  );
}

/** Chapter 4: the rubric, five parts scored 1 to 5, each with a comment. */
export function ReviewPanel() {
  return (
    <div className="panel">
      <Head title="Review" />
      <ul className="flex flex-col gap-2">
        {st.rubric.map((part, k) => (
          <li key={part} className="panel-bar">
            <span className="text-body-sm">{part}</span>
            <span className="panel-pips" style={{ "--score": SCORES[k] } as CSSProperties}>
              {Array.from({ length: 5 }, (_, i) => (
                <i key={i} data-on={i < SCORES[k] ? "" : undefined} />
              ))}
            </span>
          </li>
        ))}
      </ul>
      <span className="neu-mono text-text-secondary">Her CV shows the badge, never the scores</span>
    </div>
  );
}

/** Chapter 5: an endorsement, and a code check graded. */
export function EndorsePanel() {
  return (
    <div className="panel">
      <Head title="Endorse and grade" />
      <div className="panel-row neu-tile">
        <SealCheck aria-hidden weight="bold" className="size-4 shrink-0 text-[var(--signal-ink)]" />
        <span className="flex flex-col">
          <span className="text-body-sm font-semibold">{st.endorse.line}</span>
          <span className="neu-mono text-text-secondary">{st.endorse.meta}</span>
        </span>
      </div>
      <div className="panel-row neu-tile">
        <Code aria-hidden weight="bold" className="size-4 shrink-0 text-[var(--signal-ink)]" />
        <span className="flex flex-col">
          <span className="text-body-sm font-semibold">{st.grade.line}</span>
          <span className="neu-mono text-text-secondary">{st.grade.meta}</span>
        </span>
      </div>
    </div>
  );
}
