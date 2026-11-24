import type { Route } from "next";
import Link from "next/link";
import { emailField, hero } from "@/content/marketing";
import { Orbit, type OrbitItem } from "./story/orbit";
import { UniEmailField, type InitialEmailState } from "./uni-email-field";

/** The headline with its italic turn (app/(marketing)/CLAUDE.md: serif for belief, one italic turn). */
function Headline() {
  const { headline, headlineTurn } = hero;
  const at = headline.endsWith(headlineTurn) ? headline.length - headlineTurn.length : -1;
  if (at < 0) return <>{headline}</>;
  return (
    <>
      {headline.slice(0, at)}
      <em>{headlineTurn}</em>
    </>
  );
}

/**
 * The proof objects in orbit: where each sits (percent of the orbit box), how wide it is, how
 * near it is (depth drives the pointer parallax) and its tilt. Front objects are larger.
 */
const ORBIT: OrbitItem[] = [
  { name: "rosette", x: 4, y: 6, w: 27, d: 0.35, r: 9 },
  { name: "medallion-flare", x: 58, y: 2, w: 33, d: 0.6, r: -7 },
  { name: "seal", x: 16, y: 34, w: 46, d: 1, r: -5, eager: true },
  { name: "commit", x: 66, y: 42, w: 30, d: 0.7, r: 11 },
  { name: "envelope", x: 38, y: 72, w: 37, d: 0.5, r: -9 },
];

/**
 * Landing section 1 (PRD 5.1): headline, subline and the university email field, with the proof
 * objects of a verified record in orbit beside them. On scroll the orbit gathers toward the
 * story; each object comes back in its own chapter. The field and Join fit 1280×720 and 390×844.
 */
export function Hero({
  home,
  siteKey,
  defaultEmail,
  initialState,
}: {
  home: string | null;
  siteKey: string | null;
  defaultEmail: string;
  initialState: InitialEmailState;
}) {
  return (
    <section aria-labelledby="hero-title" className="hero">
      <div className="mx-auto grid max-w-page gap-6 px-[var(--page-gutter)] pt-8 sm:pt-12 lg:grid-cols-12 lg:gap-6 lg:pt-10">
        <div id="join" className="hero-copy flex flex-col gap-4 lg:col-span-8 lg:self-center lg:pb-16">
          <h1 id="hero-title" className="text-hero text-text-primary">
            <Headline />
          </h1>
          <p className="max-w-[54ch] text-body-lg text-text-secondary">{hero.subline}</p>
          <div className="mt-2 sm:mt-3">
            {home ? (
              <Link href={home as Route} className="neu-btn text-body-lg" data-testid="hero-open">
                {emailField.signedIn}
              </Link>
            ) : (
              <UniEmailField idPrefix="hero" siteKey={siteKey} defaultEmail={defaultEmail} initialState={initialState} />
            )}
          </div>
        </div>
        <div className="lg:col-span-4">
          <Orbit id="orbit" items={ORBIT} alt={hero.orbitAlt} testId="hero-orbit" />
        </div>
      </div>
    </section>
  );
}
