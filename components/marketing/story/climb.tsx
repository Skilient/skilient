import type { CSSProperties } from "react";
import { story, tiers } from "@/content/marketing";
import { cn } from "@/lib/cn";
import { objects } from "@/lib/marketing/objects";
import { Kicker } from "./chapters";
import { ObjectImage } from "./object-image";

const HERE = "flare";
/** Where in the pinned scroll (%) each step's medallion rises: when the view reaches that step on a 16:9 screen. */
const RISE = [0, 3, 20, 42, 64, 84];

/**
 * Chapter 5, the climb: six clay terraces, one per tier, rising left to right. On a large screen
 * the scene pins and the view climbs diagonally up the steps as you scroll, each tier's medallion
 * rising out of its step as the view reaches it. On phones and without motion it is the picture
 * with the six tiers listed under it.
 */
export function Climb() {
  const t = objects.terraces;
  const points = t.points ?? {};
  const at = tiers.ladder.findIndex((l) => l.id === HERE);
  return (
    <section aria-labelledby="climb-title" className="climb">
      <div className="climb-pin">
        <div className="climb-head neu-card">
          <Kicker>Chapter 5 · {story.climb.kicker}</Kicker>
          <h2 id="climb-title" className="chapter-title">
            {story.climb.title}
          </h2>
          <p className="chapter-body">{story.climb.body}</p>
        </div>
        <div className="climb-track" style={{ "--ar": `${t.w} / ${t.h}` } as CSSProperties}>
          <div className="climb-terraces">
            <ObjectImage name="terraces" alt={story.climb.alt} sizes="(min-width: 1024px) 250vh, 100vw" />
          </div>
          <ol className="climb-stops">
            {tiers.ladder.map((l, i) => {
              const [x, y] = (l.id === HERE ? points.marker : points[l.id]) ?? [(i + 0.5) / 6, 0.7 - i * 0.1];
              const state = i < at ? "done" : i === at ? "here" : "ahead";
              const start = RISE[i] ?? i * 15;
              return (
                <li
                  key={l.id}
                  className={cn("climb-stop", `climb-stop-${state}`, `tier-glow-${l.id}`)}
                  style={{ "--sx": x, "--sy": y, "--a": `${start}%`, "--b": `${start + 12}%` } as CSSProperties}
                >
                  <span aria-hidden className="climb-medal">
                    <ObjectImage name={`medallion-${l.id}`} />
                  </span>
                  <span className="climb-label neu-tile">
                    <span className="flex items-center justify-between gap-3">
                      <span className="text-h4 font-semibold">{l.name}</span>
                      <span className={cn("neu-mono climb-state", `climb-state-${state}`)}>
                        {state === "here" ? story.climb.here : state === "ahead" ? story.climb.ahead : "Done"}
                      </span>
                    </span>
                    <span className="text-body-sm text-text-secondary">{l.meaning}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
