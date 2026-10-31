import type { Route } from "next";
import Link from "next/link";
import { preload } from "react-dom";
import { emailField, hero, verifiedCv } from "@/content/marketing";
import { captures } from "@/lib/marketing/captures";
import { formatCode } from "@/supabase/functions/_shared/cv/sign.ts";
import { HeroFeedCapture } from "./hero-feed-capture";
import { Seal, TierBadge } from "./neu";
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
 * A verified record laid over the phone's corner (Synergy: overlapping layers). Names first, then
 * context, tier and countable proof, with the signature's time. The sample CV's own data.
 */
function RecordCard() {
  const r = hero.record;
  return (
    <figure aria-label={r.label} className="neu-tile absolute bottom-8 -left-8 z-10 hidden w-[16.5rem] flex-col gap-3 p-5 lg:flex" data-testid="hero-record">
      <div className="flex items-start gap-3">
        <span aria-hidden className="tier-finish tier-finish-flare inline-grid size-11 shrink-0 place-items-center rounded-full text-body font-semibold text-[#1b1b19]">
          AK
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="flex items-center gap-1.5 text-body font-semibold">
            {r.name}
            <Seal size={20} label="Verified" />
          </span>
          <span className="text-[0.8125rem] leading-snug text-text-secondary">{r.context}</span>
        </div>
      </div>
      <TierBadge tier="flare" name={r.tier} size="sm" className="self-start" />
      <dl className="neu-well-s grid grid-cols-3 gap-1 px-3 py-2.5">
        {r.stats.map((s) => (
          <div key={s.label} className="flex flex-col-reverse">
            <dt className="text-[0.6875rem] leading-tight text-text-secondary">{s.label}</dt>
            <dd className="neu-figure text-[1.25rem] font-semibold">{s.value}</dd>
          </div>
        ))}
      </dl>
      <figcaption className="neu-mono flex flex-col gap-0.5 text-text-secondary">
        <span>{formatCode(verifiedCv.sampleCode)}</span>
        <span>{r.signed}</span>
      </figcaption>
    </figure>
  );
}

/**
 * Landing section 1 (PRD 5.1): headline, subline and the university email field on the left,
 * the University Feed on a phone on the right, cut by the section's bottom edge, with a verified
 * record over its corner. The whole hero, field included, fits 1280×720 and 390×844 (plan B6).
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
  // The first card on the phone is the page's largest image: fetch it early, for the device theme only.
  const first = captures.hero.postB;
  preload(first.light.avif, { as: "image", type: "image/avif", media: "(prefers-color-scheme: light)", fetchPriority: "high" });
  preload(first.dark.avif, { as: "image", type: "image/avif", media: "(prefers-color-scheme: dark)", fetchPriority: "high" });
  return (
    <section aria-labelledby="hero-title">
      <div className="mx-auto grid max-w-page gap-8 px-[var(--page-gutter)] pt-8 sm:pt-12 lg:grid-cols-12 lg:gap-6 lg:pt-14">
        <div id="join" className="flex flex-col gap-4 lg:col-span-8 lg:self-center lg:pb-14">
          <p className="neu-mono hidden items-center gap-2 text-text-secondary sm:flex">
            <span aria-hidden className="size-2 rounded-full bg-[var(--signal)]" />
            Verified by university email · GitHub · peers · faculty
          </p>
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
        <div className="relative flex justify-center lg:col-span-4 lg:items-end lg:justify-end">
          <RecordCard />
          <HeroFeedCapture shots={captures.hero} />
        </div>
      </div>
    </section>
  );
}
