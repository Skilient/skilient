import type { CSSProperties } from "react";
import { rules } from "@/content/marketing";

/**
 * Between the story and the invitation: the four rules, one at a time. On a large screen the ink
 * card pins and each rule lights up as you scroll, the ones read staying lit; elsewhere they are
 * simply there, numbered.
 */
export function Rules() {
  return (
    <section aria-labelledby="rules-title" className="rules" data-testid="our-rules">
      <div className="rules-pin">
        <div className="rules-card neu-ink">
          <div aria-hidden className="neu-weave rules-weave" />
          <h2 id="rules-title" className="neu-mono rules-title">
            {rules.heading}
          </h2>
          <ol className="rules-list">
            {rules.lines.map((line, i) => (
              <li key={line} className="rules-line" style={{ "--i": i } as CSSProperties}>
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
