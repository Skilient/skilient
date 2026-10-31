import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { trustGap } from "@/content/marketing";
import { Section, SectionHeading } from "./section";

function Source({ text, href }: { text: string; href: string }) {
  return (
    <a href={href} rel="noopener" className="neu-mono inline-flex min-h-6 items-start gap-1 text-text-secondary underline-offset-4 hover:text-text-primary hover:underline">
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
    <div aria-hidden className="ledger">
      {Array.from({ length: 10 }, (_, i) => (
        <i key={i} data-on={i < on ? "" : undefined} />
      ))}
    </div>
  );
}

/** Landing section 3 (PRD 5.1): the trust gap, as an asymmetric stat sheet with each source. */
export function TrustGap() {
  const { lead, rest } = trustGap;
  return (
    <Section labelledBy="trust-title" step="01 · The gap">
      <SectionHeading id="trust-title" className="max-w-[22ch]">
        {trustGap.heading}
      </SectionHeading>
      <div className="mt-10 grid gap-10 md:mt-14 md:grid-cols-12 md:gap-6">
        <figure className="neu-card flex flex-col gap-5 p-8 sm:p-10 md:col-span-7">
          <p className="neu-figure font-display text-[5.5rem] leading-none tracking-[-0.04em] text-[var(--signal-ink)] sm:text-[8rem]">{lead.figure}</p>
          <Ledger figure={lead.figure} />
          <figcaption className="flex max-w-[34ch] flex-col gap-3">
            <span className="text-h3 font-semibold">{lead.text}</span>
            <Source text={lead.source} href={lead.href} />
          </figcaption>
        </figure>
        <div className="flex flex-col gap-6 md:col-span-5">
          {rest.map((s) => (
            <figure key={s.figure} className="neu-tile flex flex-col gap-3 p-6">
              <p className="neu-figure text-[2.25rem] leading-none font-semibold">{s.figure}</p>
              <Ledger figure={s.figure} />
              <figcaption className="flex flex-col gap-2">
                <span className="text-body-lg">{s.text}</span>
                <Source text={s.source} href={s.href} />
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
      <p className="mt-12 max-w-[60ch] text-body-lg text-text-secondary">{trustGap.closing}</p>
    </Section>
  );
}
