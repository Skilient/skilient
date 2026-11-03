import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { RecordEntry } from "@/components/ui";
import { story, theRecord } from "@/content/marketing";
import { Chapter } from "./chapters";

/**
 * The Record (phase 16, PRD 5.30) in Ayesha's story: a ledger of signed co-curricular entries
 * from a verified society. A static card, no pinned stage: the copy claims only what is live.
 */
export function StoryRecord() {
  return (
    <section aria-label="Ayesha’s story: The Record" data-testid="story-record">
      <div className="mx-auto max-w-page px-[var(--page-gutter)]">
        <Chapter
          id="the-record"
          number={8}
          kicker={theRecord.kicker}
          title={theRecord.title}
          body={
            <>
              {theRecord.body}
              <span className="mt-5 flex flex-wrap gap-2">
                {theRecord.chips.map((c) => (
                  <span key={c} className="neu-mono neu-well-s rounded-full px-3 py-1.5 text-text-secondary">
                    {c}
                  </span>
                ))}
              </span>
              <span className="mt-4 block text-body-sm text-text-secondary">{theRecord.rule}</span>
              <Link href="/verify" className="neu-btn-2 mt-6 text-body">
                {theRecord.link}
                <ArrowRight aria-hidden weight="bold" className="cta-arrow size-4" />
              </Link>
            </>
          }
          visual={
            <div className="neu-card px-5 py-3">
              <p className="flex items-baseline justify-between gap-3 pt-2">
                <span className="font-serif text-h3">{theRecord.heading}</span>
                <span className="neu-mono text-text-secondary">{story.sample}</span>
              </p>
              <ul className="flex flex-col">
                {theRecord.entries.map((e) => (
                  <RecordEntry key={e.code} issuer={e.issuer} title={e.title} date={e.date} evidence={<span>{e.line}</span>} code={e.code} />
                ))}
              </ul>
            </div>
          }
        />
      </div>
    </section>
  );
}
