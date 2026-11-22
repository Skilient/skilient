import { CheckCircle, Hammer, SealCheck } from "@phosphor-icons/react/dist/ssr";
import type { CSSProperties, ReactNode } from "react";

/** A CSS custom property on an element (the timeline's delays). */
const at = (seconds: number): CSSProperties => ({ "--d": `${seconds}s` }) as CSSProperties;

type Puff = readonly [cx: number, cy: number, r: number];

/** A small seeded generator, so the server and the browser draw the same clouds. */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The puffs along a bank's inner edge, in a 600 × 1000 box: a row of large ones that covers the
 * body's edge, then smaller ones further in that break up the outline, drawn back to front.
 */
function puffs(seed: number): Puff[] {
  const rnd = seeded(seed);
  const big: Puff[] = [];
  for (let y = -40; y < 1080; y += 105 + rnd() * 40) big.push([395 + rnd() * 50, y, 105 + rnd() * 30]);
  const small: Puff[] = [];
  for (let y = 20; y < 1000; y += 110 + rnd() * 80) small.push([452 + rnd() * 30, y, 64 + rnd() * 24]);
  return [...big, ...small];
}

/**
 * One cloud bank: a body that reaches in from the screen's edge, with an inner edge of soft puffs.
 * Every puff fades out at its rim (so the outline is fluffy, with no filter), is lit from the top
 * left and shaded a little underneath. Drawn for the left; the right side is mirrored in CSS.
 */
function Bank({ depth, seed }: { depth: "far" | "mid" | "near"; seed: number }) {
  const id = `w-${depth}-${seed}`;
  return (
    <svg className={`welcome-bank welcome-bank-${depth}`} viewBox="0 0 600 1000" preserveAspectRatio="none" aria-hidden focusable="false">
      <defs>
        <radialGradient id={`${id}-puff`}>
          <stop offset="0.7" stopColor="currentColor" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-lit`} cx="0.36" cy="0.24" r="0.6">
          <stop offset="0" style={{ stopColor: "var(--w-lit)" }} />
          <stop offset="1" style={{ stopColor: "var(--w-lit)", stopOpacity: 0 }} />
        </radialGradient>
        <radialGradient id={`${id}-shade`} cx="0.6" cy="0.86" r="0.55">
          <stop offset="0" style={{ stopColor: "var(--w-shade)" }} />
          <stop offset="1" style={{ stopColor: "var(--w-shade)", stopOpacity: 0 }} />
        </radialGradient>
      </defs>
      <rect x="-40" y="-20" width="420" height="1040" fill="currentColor" />
      {puffs(seed).map(([cx, cy, r], i) => (
        <g key={i}>
          <circle cx={cx} cy={cy} r={r} fill={`url(#${id}-puff)`} />
          {/* Only the large puffs carry a shadow underneath: on the small ones it read as a ball. */}
          {r > 100 ? <circle cx={cx} cy={cy} r={r * 0.9} fill={`url(#${id}-shade)`} /> : null}
          <circle cx={cx} cy={cy} r={r * 0.9} fill={`url(#${id}-lit)`} />
        </g>
      ))}
    </svg>
  );
}

/** The Skilient mark (public/brand/skilient-icon.svg), in parts, so it can assemble: centre, nodes, links. */
function Mark() {
  const link = { fill: "none", stroke: "var(--w-red)", strokeWidth: 28, pathLength: 1 } as const;
  return (
    <svg className="welcome-mark" viewBox="137 137 980 980" aria-hidden focusable="false">
      <circle data-pulse style={at(2.0)} fill="var(--w-red)" cx="627" cy="627" r="57" />
      <path
        data-pop
        style={at(2.15)}
        fill="var(--w-ink)"
        d="M662.45 278.03 A68 68 0 1 0 591.55 278.03 A26 26 0 0 1 604.00 300.22 L604.00 406.78 A26 26 0 0 1 591.55 428.97 A68 68 0 1 0 662.45 428.97 A26 26 0 0 1 650.00 406.78 L650.00 300.22 A26 26 0 0 1 662.45 278.03Z"
      />
      <path
        data-pop
        style={at(2.25)}
        fill="var(--w-ink)"
        d="M662.45 825.03 A68 68 0 1 0 591.55 825.03 A26 26 0 0 1 604.00 847.22 L604.00 953.78 A26 26 0 0 1 591.55 975.97 A68 68 0 1 0 662.45 975.97 A26 26 0 0 1 650.00 953.78 L650.00 847.22 A26 26 0 0 1 662.45 825.03Z"
      />
      <circle data-pop style={at(2.35)} fill="var(--w-ink)" cx="247" cy="627" r="60" />
      <circle data-pop style={at(2.45)} fill="var(--w-ink)" cx="1007" cy="627" r="60" />
      <path
        data-draw
        style={at(2.5)}
        {...link}
        d="M463.46 660.89 A54 54 0 1 0 406.54 660.89 A20 20 0 0 1 416.00 677.89 L416.00 776.11 A20 20 0 0 1 406.54 793.11 A54 54 0 1 0 463.46 793.11 A20 20 0 0 1 454.00 776.11 L454.00 677.89 A20 20 0 0 1 463.46 660.89Z"
      />
      <path
        data-draw
        style={at(2.6)}
        {...link}
        d="M847.46 460.89 A54 54 0 1 0 790.54 460.89 A20 20 0 0 1 800.00 477.89 L800.00 576.11 A20 20 0 0 1 790.54 593.11 A54 54 0 1 0 847.46 593.11 A20 20 0 0 1 838.00 576.11 L838.00 477.89 A20 20 0 0 1 847.46 460.89Z"
      />
      <circle data-draw style={at(2.7)} {...link} cx="435" cy="412" r="59" />
      <circle data-draw style={at(2.8)} {...link} cx="819" cy="842" r="59" />
    </svg>
  );
}

const EXPECT = [
  { icon: Hammer, label: "Build real work" },
  { icon: SealCheck, label: "Get it verified" },
  { icon: CheckCircle, label: "Carry the proof" },
] as const;

/**
 * Welcome to Skilient (replaces "You're in", 2026-11-15): the clouds part, the mark assembles, the
 * title and wordmark arrive, then what this place is and what to expect, then the way in. All of it
 * is in the page from the first byte; the timeline in welcome.css only reveals it. `claim` is the
 * "entries waiting" card (PRD 5.30) and `actions` the buttons, both placed by the page.
 */
export function WelcomeScene({ firstName, claim, actions }: { firstName: string | null; claim?: ReactNode; actions: ReactNode }) {
  return (
    <>
      <div className="welcome-sky" aria-hidden>
        <div className="welcome-glow" />
        <div className="welcome-side">
          <Bank depth="far" seed={11} />
          <Bank depth="mid" seed={23} />
          <Bank depth="near" seed={37} />
        </div>
        <div className="welcome-side welcome-side-right">
          <Bank depth="far" seed={41} />
          <Bank depth="mid" seed={53} />
          <Bank depth="near" seed={67} />
        </div>
      </div>
      <div className="welcome-stage">
        <Mark />
        <h1 className="flex flex-col items-center gap-3">
          <span data-in style={at(2.8)} className="font-serif text-[clamp(1.5rem,1rem+2vw,2.25rem)] leading-tight font-medium text-text-primary">
            Welcome to
          </span>
          <span className="sr-only"> Skilient{firstName ? `, ${firstName}` : ""}</span>
          {/* The wordmark as drawn (Montserrat lives only inside it); the words above are its name. */}
          <span className="welcome-wordmark" style={at(3.0)} aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element -- a 2 KB local SVG; next/image adds nothing here */}
            <img src="/brand/skilient-wordmark.svg" alt="" width={400} height={100} className="h-auto w-full dark:hidden" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/skilient-wordmark-reversed.svg" alt="" width={400} height={100} className="hidden h-auto w-full dark:block" />
          </span>
        </h1>
        <p data-in style={at(3.6)} className="max-w-xl font-serif text-[clamp(1.0625rem,0.95rem+0.5vw,1.25rem)] leading-relaxed text-text-primary" data-testid="welcome-description">
          This is where students prove what they can do. You build real projects with classmates, get your work verified, and get a CV that recruiters trust. Join the network made for your campus.
        </p>
        <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2" aria-label="What to expect">
          {EXPECT.map((e, i) => (
            <li key={e.label} data-in style={at(4.6 + i * 0.2)} className="flex items-center gap-2 text-body font-semibold text-text-primary">
              <e.icon aria-hidden weight="bold" className="size-5 text-[var(--signal-ink)]" />
              {e.label}
            </li>
          ))}
        </ul>
        <p data-in style={at(5.2)} className="max-w-md text-body-sm text-text-secondary">
          Proof takes real work, so nothing here is instant. The tour takes about a minute.
        </p>
        {claim ? (
          <div data-in style={at(5.3)} className="w-full max-w-md text-left empty:hidden">
            {claim}
          </div>
        ) : null}
        {actions}
      </div>
    </>
  );
}
