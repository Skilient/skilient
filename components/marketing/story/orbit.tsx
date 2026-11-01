import type { CSSProperties } from "react";
import type { ObjectName } from "@/lib/marketing/objects";
import { ObjectImage } from "./object-image";
import { OrbitParallax } from "./orbit-parallax";

/** One object in an orbit: where it sits (percent of the box), its width, its depth (pointer parallax) and tilt. */
export interface OrbitItem {
  name: ObjectName;
  x: number;
  y: number;
  w: number;
  d: number;
  r: number;
  eager?: boolean;
}

/**
 * Proof objects in orbit (app/(marketing)/story.css): two dashed rings, a warm glow, the objects
 * arriving once on load, following the pointer by depth and gathering away as the hero leaves.
 * Decorative but described: one labelled image for assistive tech.
 */
export function Orbit({ id, items, alt, testId, className }: { id: string; items: OrbitItem[]; alt: string; testId?: string; className?: string }) {
  return (
    <>
      <div id={id} role="img" aria-label={alt} className={`orbit ${className ?? ""}`} data-testid={testId}>
        <div aria-hidden className="hero-backdrop orbit-glow" />
        <svg aria-hidden className="orbit-rings" viewBox="0 0 100 100" preserveAspectRatio="none">
          <ellipse cx="50" cy="52" rx="46" ry="30" pathLength={1} />
          <ellipse cx="50" cy="52" rx="34" ry="21" pathLength={1} />
        </svg>
        {items.map((o, i) => (
          <div
            key={o.name}
            className="orbit-obj"
            style={{ "--x": o.x, "--y": o.y, "--w": o.w, "--d": o.d, "--r": `${o.r}deg`, "--i": i, zIndex: Math.round(o.d * 10) } as CSSProperties}
          >
            <div className="orbit-par">
              <div className="orbit-in">
                <ObjectImage name={o.name} eager={o.eager} priority={o.eager} />
              </div>
            </div>
          </div>
        ))}
      </div>
      <OrbitParallax targetId={id} />
    </>
  );
}
