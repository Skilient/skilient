import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import type { CSSProperties } from "react";
import { story, trustGap } from "@/content/marketing";
import { Kicker } from "./chapters";

function Source({ text, href }: { text: string; href: string }) {
  return (
    <a href={href} rel="noopener" className="prologue-source neu-mono">
      <span>{text}</span>
      <ArrowUpRight aria-hidden weight="bold" className="mt-0.5 size-3.5 shrink-0" />
    </a>
  );
}

/** The share a figure states, out of 10: "70%" → 7, "5,000 of 25,000" → 2. Null when it isn't a share. */
export function tenths(figure: string): number | null {
  const pct = figure.match(/^([\d.]+)\s*%$/);
  if (pct) return Math.round(Number(pct[1]) / 10);
  const of = figure.match(/^([\d,]+)\s+of\s+([\d,]+)$/);
  if (of) return Math.round((Number(of[1].replace(/,/g, "")) / Number(of[2].replace(/,/g, ""))) * 10);
  return null;
}

/** Ten countable cells with the figure's share filled: the figure drawn, never inflated. */
function Ledger({ figure }: { figure: string }) {
  const on = tenths(figure);
  if (on === null) return null;
  return (
    <div aria-hidden className="ledger prologue-ledger">
      {Array.from({ length: 10 }, (_, i) => (
        <i key={i} data-on={i < on ? "" : undefined} style={{ "--i": i } as CSSProperties} />
      ))}
    </div>
  );
}

/**
 * Before the story: the problem, in the dark. The ink scene opens out of a card to fill the
 * screen, the 70% counts up and its ledger fills, then the other two figures and the bridge into
 * Ayesha's story. Every figure keeps its source.
 */
export function Prologue() {
  const { lead, rest } = trustGap;
  const pct = Number(lead.figure.replace("%", ""));
  return (
    <section aria-labelledby="trust-title" className="prologue">
      <div className="prologue-pin">
        <div className="prologue-card neu-ink">
          <div aria-hidden className="neu-weave prologue-weave" />
          <div className="prologue-inner mx-auto max-w-page px-[var(--page-gutter)]">
            <Kicker className="prologue-kicker">{story.prologue.kicker} · The problem</Kicker>
            <h2 id="trust-title" className="prologue-title">
              {trustGap.heading}
            </h2>
            <div className="prologue-grid">
              <figure className="prologue-lead">
                <p className="prologue-figure">
                  <span className="prologue-figure-text">{lead.figure}</span>
                  <span aria-hidden className="prologue-count" style={{ "--to": pct } as CSSProperties} />
                </p>
                <Ledger figure={lead.figure} />
                <figcaption className="flex max-w-[34ch] flex-col gap-3">
                  <span className="text-h3 font-semibold">{lead.text}</span>
                  <Source text={lead.source} href={lead.href} />
                </figcaption>
              </figure>
              <div className="prologue-rest">
                {rest.map((s) => (
                  <figure key={s.figure} className="prologue-stat">
                    <p className="neu-figure text-[2rem] leading-none font-semibold">{s.figure}</p>
                    <Ledger figure={s.figure} />
                    <figcaption className="flex flex-col gap-2">
                      <span className="text-body-lg">{s.text}</span>
                      <Source text={s.source} href={s.href} />
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
            <p className="prologue-bridge">
              {trustGap.closing} <em>{story.prologue.bridge}</em>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
