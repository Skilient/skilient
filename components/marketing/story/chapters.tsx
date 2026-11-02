import { SealCheck } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import { story } from "@/content/marketing";
import { cn } from "@/lib/cn";
import type { ObjectName } from "@/lib/marketing/objects";
import { TierBadge } from "../neu";
import { ObjectImage } from "./object-image";
import { EndorseRow, IdentityRow, ProjectRow, Record, SkillsRow } from "./record";

/** "Chapter 2 · First commit": the story counted in chapters (Ascent). */
export function Kicker({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("story-kicker neu-mono", className)}>
      <span aria-hidden className="story-kicker-rule" />
      {children}
    </p>
  );
}

/** One chapter of the story: the words in the page, the picture on the stage (or inline on phones). */
export function Chapter({
  id,
  number,
  kicker,
  title,
  body,
  proof,
  visual,
  className,
}: {
  id: string;
  number: number;
  kicker: string;
  title: string;
  body: ReactNode;
  proof?: string;
  visual?: ReactNode;
  className?: string;
}) {
  return (
    <article id={id} aria-labelledby={`${id}-title`} className={cn("chapter", className)}>
      <div className="chapter-copy">
        <Kicker>
          Chapter {number} · {kicker}
        </Kicker>
        <h2 id={`${id}-title`} className="chapter-title">
          {title}
        </h2>
        <p className="chapter-body">{body}</p>
        {proof ? (
          <p className="proof-line neu-mono chapter-proof">
            <SealCheck aria-hidden weight="bold" className="size-4 shrink-0 text-[var(--signal-ink)]" />
            {proof}
          </p>
        ) : null}
      </div>
      {visual ? (
        <div aria-hidden className="chapter-visual">
          {visual}
        </div>
      ) : null}
    </article>
  );
}

/** On phones (and without motion) each chapter shows its object and the line it added. */
function Inline({ object, children }: { object: ObjectName; children: ReactNode }) {
  return (
    <div className="inline-visual">
      <div className="inline-object">
        <ObjectImage name={object} />
      </div>
      <div className="inline-card neu-card">{children}</div>
    </div>
  );
}

/** A proof object floating beside the record on the stage, docking into its row as the chapter ends. */
function StageObject({ name, slot }: { name: ObjectName; slot: string }) {
  return (
    <div className={cn("obj", `obj-${slot}`)}>
      <div className="obj-dock">
        <div className="obj-in">
          <ObjectImage name={name} />
        </div>
      </div>
    </div>
  );
}

const [dayOne, firstCommit, team, proof] = story.chapters;

/**
 * Chapters 1 to 4 (decisions 2026-10-31). On a large screen the record is pinned on the right
 * while the chapters scroll past on the left, and each chapter's object docks into the record:
 * the envelope into identity, the commit into skills, the tray into the project, the rosette into
 * endorsements. One scroll timeline (`--story`) drives the whole stage (app/(marketing)/story.css).
 */
export function StoryChapters() {
  return (
    <section aria-label="Ayesha’s story, chapters 1 to 4" className="story story-a">
      <div className="story-grid mx-auto max-w-page px-[var(--page-gutter)]">
        <div className="story-text">
          <Chapter
            id={dayOne.id}
            number={1}
            kicker={dayOne.kicker}
            title={dayOne.title}
            body={dayOne.body}
            proof={dayOne.proof}
            visual={
              <Inline object="envelope">
                <IdentityRow upTo="raw" />
              </Inline>
            }
          />
          <Chapter
            id={firstCommit.id}
            number={2}
            kicker={firstCommit.kicker}
            title={firstCommit.title}
            body={firstCommit.body}
            proof={firstCommit.proof}
            visual={
              <Inline object="commit">
                <SkillsRow />
                <span className="inline-tier">
                  <TierBadge tier="spark" name="Spark" size="sm" />
                  <span className="neu-mono text-text-secondary">First verified contribution</span>
                </span>
              </Inline>
            }
          />
          <Chapter
            id={team.id}
            number={3}
            kicker={team.kicker}
            title={team.title}
            body={team.body}
            proof={team.proof}
            visual={
              <Inline object="tray">
                <ProjectRow />
              </Inline>
            }
          />
          <Chapter
            id={proof.id}
            number={4}
            kicker={proof.kicker}
            title={proof.title}
            body={proof.body}
            proof={proof.proof}
            visual={
              <Inline object="rosette">
                <EndorseRow />
                <span className="inline-tier">
                  <TierBadge tier="flare" name="Flare" size="sm" />
                  <span className="neu-mono text-text-secondary">Top 18% of students</span>
                </span>
              </Inline>
            }
          />
        </div>
        <div aria-hidden className="story-stage">
          <div className="stage-inner">
            <Record part="a">
              <StageObject name="envelope" slot="envelope" />
              <StageObject name="commit" slot="commit" />
              <StageObject name="tray" slot="tray" />
              <StageObject name="rosette" slot="rosette" />
            </Record>
          </div>
        </div>
      </div>
    </section>
  );
}
