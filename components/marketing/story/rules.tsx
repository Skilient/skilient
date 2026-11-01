import type { CSSProperties } from "react";
import { rules } from "@/content/marketing";
import { cn } from "@/lib/cn";

/**
 * Lines on the ink card that light one at a time as you scroll, the ones read staying lit (on a
 * large screen the card pins; elsewhere the lines are simply there, numbered). Used for the
 * landing's rules, the recruiters' rules of contact and the about manifesto.
 */
export function LitLines({
  id,
  heading,
  lines,
  testId,
  prose = false,
  className,
}: {
  id: string;
  heading: string;
  lines: readonly string[];
  testId?: string;
  /** Sentences rather than slogans: a smaller serif. */
  prose?: boolean;
  className?: string;
}) {
  return (
    <section aria-labelledby={id} className={cn("rules", prose && "rules-prose", className)} style={{ "--n": lines.length } as CSSProperties} data-testid={testId}>
      <div className="rules-pin">
        <div className="rules-card neu-ink">
          <div aria-hidden className="neu-weave rules-weave" />
          <h2 id={id} className="neu-mono rules-title">
            {heading}
          </h2>
          <ol className="rules-list">
            {lines.map((line, i) => (
              <li key={line} className="rules-line" style={{ "--i": i, "--n": lines.length } as CSSProperties}>
                <span aria-hidden className="neu-mono rules-n">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/** The landing's interlude: the four rules. */
export function Rules() {
  return <LitLines id="rules-title" heading={rules.heading} lines={rules.lines} testId="our-rules" />;
}
