import type { Route } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { emailField, finalCta, story } from "@/content/marketing";
import type { ObjectName } from "@/lib/marketing/objects";
import { UniEmailField } from "../uni-email-field";
import { Kicker } from "./chapters";
import { ObjectImage } from "./object-image";

const RETURN: { name: ObjectName; cls: string }[] = [
  { name: "seal", cls: "finale-obj-seal" },
  { name: "medallion-flare", cls: "finale-obj-medal" },
  { name: "commit", cls: "finale-obj-commit" },
];

/**
 * The finale, in the reader's voice: Ayesha's record was a sample, yours starts here. The email
 * field again, with three of the proof objects come back around it.
 */
export function Finale({ home, siteKey }: { home: string | null; siteKey: string | null }) {
  return (
    <section aria-labelledby="final-title" className="finale">
      <div className="relative mx-auto max-w-page px-[var(--page-gutter)] py-16 sm:py-24">
        <div aria-hidden className="neu-weave pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_70%_75%_at_50%_50%,#000_30%,transparent_80%)]" />
        <div className="finale-card neu-raised-l reveal">
          {RETURN.map((o, i) => (
            <span key={o.name} aria-hidden className={`finale-obj ${o.cls}`} style={{ "--i": i } as CSSProperties}>
              <ObjectImage name={o.name} />
            </span>
          ))}
          <Kicker className="justify-center">{story.finale.kicker}</Kicker>
          <h2 id="final-title" className="finale-title">
            {finalCta.heading}
          </h2>
          <p className="text-body-lg text-text-secondary">{story.finale.body}</p>
          <div className="flex w-full max-w-xl justify-center text-left">
            {home ? (
              <Link href={home as Route} className="neu-btn text-body-lg">
                {emailField.signedIn}
              </Link>
            ) : (
              <UniEmailField idPrefix="final" siteKey={siteKey} />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
