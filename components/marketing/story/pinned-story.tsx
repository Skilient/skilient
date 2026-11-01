import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { ObjectName } from "@/lib/marketing/objects";
import { Chapter } from "./chapters";
import { ObjectImage } from "./object-image";

export interface PinnedChapter {
  id: string;
  kicker: string;
  title: string;
  body: ReactNode;
  proof?: string;
  /** What the chapter shows: a product window, on the stage (large screens) or inline. */
  panel: ReactNode;
  /** The proof object that floats beside it. */
  object?: ObjectName;
}

/** Chapters are 100svh each plus a 40svh tail; where chapter k sits on the pinned timeline (%). */
function centre(k: number, n: number): number {
  return (k * 100 * 100) / ((n - 1) * 100 + 40);
}

/**
 * A page's story as pinned chapters (decisions 2026-11-01): the words scroll on the left while the
 * stage on the right holds one scene per chapter, each taking over from the last as you scroll
 * (`--pin`, app/(marketing)/story.css). On phones and without motion every chapter shows its own
 * scene inline. The stage is decorative; the chapters carry the words.
 */
export function PinnedStory({ label, chapters, first = 1 }: { label: string; chapters: PinnedChapter[]; first?: number }) {
  const n = chapters.length;
  return (
    <section aria-label={label} className="story pin-story">
      <div className="story-grid mx-auto max-w-page px-[var(--page-gutter)]">
        <div className="story-text">
          {chapters.map((c, k) => (
            <Chapter
              key={c.id}
              id={c.id}
              number={first + k}
              kicker={c.kicker}
              title={c.title}
              body={c.body}
              proof={c.proof}
              visual={
                <div className="inline-visual pin-inline">
                  {c.object ? (
                    <div className="inline-object">
                      <ObjectImage name={c.object} />
                    </div>
                  ) : null}
                  <div className="inline-card neu-card">{c.panel}</div>
                </div>
              }
            />
          ))}
        </div>
        <div aria-hidden className="story-stage pin-stage">
          <div className="pin-stage-inner">
            {chapters.map((c, k) => {
              const inAt = centre(k, n);
              const outAt = k < n - 1 ? centre(k + 1, n) : null;
              return (
                <div
                  key={c.id}
                  className={cn("pin-scene", k === 0 && "pin-first", outAt === null && "pin-last")}
                  style={
                    {
                      "--in-a": `${Math.max(0, inAt - 12).toFixed(2)}%`,
                      "--in-b": `${Math.max(0, inAt - 3).toFixed(2)}%`,
                      "--out-a": `${outAt === null ? 100 : (outAt - 12).toFixed(2)}%`,
                      "--out-b": `${outAt === null ? 100 : (outAt - 3).toFixed(2)}%`,
                    } as CSSProperties
                  }
                >
                  <div className="pin-out">
                    <div className="pin-in">
                      <div className="pin-panel neu-card">{c.panel}</div>
                      {c.object ? (
                        <div className="pin-obj">
                          <ObjectImage name={c.object} />
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
