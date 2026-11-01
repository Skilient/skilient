import { Plant } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { Seal } from "@/components/marketing/neu";
import { CtaLink } from "@/components/marketing/org-parts";
import { Orbit } from "@/components/marketing/story/orbit";
import { LitLines } from "@/components/marketing/story/rules";
import { aboutPage as copy, nav } from "@/content/marketing";
import { getViewer } from "@/lib/data/marketing";

export const metadata: Metadata = { title: copy.title, description: copy.description, alternates: { canonical: "/about" } };

/** The story, one sentence per lit line. */
const SENTENCES = copy.story.flatMap((p) => p.split(/(?<=\.)\s+/));

/**
 * /about (PRD 5.1; decisions 2026-11-01): the statement over chai on a charpai, the manifesto lit
 * a sentence at a time, the team as a roll call (portraits are two-colour traces of photos Ahmed
 * supplied, decisions 2026-10-03), where Skilient is incubated, and the values stamped like seals.
 */
export default async function AboutPage() {
  const viewer = await getViewer();
  return (
    <article aria-labelledby="page-title">
      <header className="hero about-hero">
        <div className="mx-auto grid max-w-page gap-8 px-[var(--page-gutter)] pt-10 sm:pt-14 lg:grid-cols-12 lg:items-center lg:gap-6">
          <h1 id="page-title" className="hero-copy text-hero max-w-[16ch] text-text-primary lg:col-span-6">
            {copy.headline}
          </h1>
          <div className="lg:col-span-6">
            <Orbit id="about-orbit" items={[{ name: "chai", x: 2, y: 8, w: 96, d: 0.5, r: 0, eager: true }]} alt={copy.sceneAlt} className="orbit-scene" />
          </div>
        </div>
      </header>

      <LitLines id="manifesto-title" heading={copy.manifesto} lines={SENTENCES} prose />

      <section aria-labelledby="team-title" className="mx-auto max-w-page px-[var(--page-gutter)] py-16 sm:py-20">
        <h2 id="team-title" className="neu-h2 reveal">
          {copy.team.heading}
        </h2>
        <ul className="roll-call mt-10 grid gap-10 sm:grid-cols-3 sm:gap-6" data-testid="about-team">
          {copy.team.people.map((p, i) => (
            <li key={p.slug} className="roll-call-item" style={{ "--i": i } as CSSProperties}>
              <figure className="flex flex-col gap-4">
                <figcaption className="order-2 flex flex-col gap-0.5">
                  <span className="text-h3 font-semibold">{p.name}</span>
                  <span className="text-body text-text-secondary">{p.role}</span>
                </figcaption>
                {/* eslint-disable-next-line @next/next/no-img-element -- static SVG trace, no optimisation needed */}
                <img
                  src={`/marketing/team/${p.slug}.svg`}
                  alt={p.name}
                  width={720}
                  height={720}
                  loading="lazy"
                  decoding="async"
                  className="order-1 aspect-square w-full max-w-[20rem] rounded-[var(--r-tile)] shadow-[var(--raised-m)]"
                />
              </figure>
            </li>
          ))}
        </ul>
        <p className="neu-tile reveal mt-12 flex items-center gap-3 p-6 text-body-lg" data-testid="about-incubation">
          <Plant aria-hidden className="size-6 shrink-0 text-[var(--signal-ink)]" />
          <span>
            {copy.incubation.label} <strong className="font-semibold">{copy.incubation.name}</strong>, the {copy.incubation.full}.
          </span>
        </p>
      </section>

      <section aria-labelledby="values-title">
        <div className="mx-auto grid max-w-page gap-10 px-[var(--page-gutter)] py-16 sm:py-20 md:grid-cols-12 md:gap-6">
          <h2 id="values-title" className="neu-h2 reveal md:col-span-4">
            {copy.values.heading}
          </h2>
          <dl className="grid gap-6 sm:grid-cols-2 md:col-span-8">
            {copy.values.items.map((v, i) => (
              <div key={v.term} className="value-tile neu-tile flex flex-col gap-2 p-6" style={{ "--i": i } as CSSProperties}>
                <span aria-hidden className="value-seal">
                  <Seal size={34} />
                </span>
                <dt className="text-h4 font-semibold">{v.term}</dt>
                <dd className="text-body text-text-secondary">{v.detail}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <div className="mx-auto flex max-w-page justify-center px-[var(--page-gutter)] py-16 sm:py-20">
        <CtaLink href={viewer ? viewer.home : nav.join.href} track={viewer ? "open_app" : "join"}>
          {viewer ? nav.open : nav.join.label}
        </CtaLink>
      </div>
    </article>
  );
}
