import { ArrowRight, Check, SealCheck } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { story } from "@/content/marketing";
import { Chapter } from "./chapters";
import { ObjectImage } from "./object-image";
import { Record, SignRow } from "./record";

const { signed, found } = story;

/** The recruiter's contact request (sample company from the product captures), arriving over the record. */
function RequestCard({ className }: { className?: string }) {
  const q = found.request;
  return (
    <div className={`request-card neu-card ${className ?? ""}`}>
      <span className="neu-mono text-text-secondary">{q.label}</span>
      <span className="text-body font-semibold">{q.role}</span>
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body-sm">
        <span className="font-semibold">{q.company}</span>
        <span className="request-verified neu-mono">
          <SealCheck aria-hidden weight="fill" className="size-3.5" />
          {q.verified}
        </span>
      </span>
      <span className="neu-mono text-text-secondary">{q.meta}</span>
      <span className="mt-2 flex items-center gap-2">
        <span className="request-accept">
          <span className="request-accept-idle">{q.accept}</span>
          <span className="request-accept-done">
            <Check aria-hidden weight="bold" className="size-3.5" />
            Accepted · 14:32
          </span>
        </span>
        <span className="request-decline">{q.decline}</span>
      </span>
    </div>
  );
}

/**
 * Chapters 6 and 7. The finished record pins again; the seal falls onto its last empty row and
 * stamps it (the page's one moment of light), then a recruiter's contact request slides in over
 * it and is accepted. Driven by `--story-b` (app/(marketing)/story.css).
 */
export function StorySignedFound() {
  return (
    <section aria-label="Ayesha’s story, chapters 6 and 7" className="story story-b">
      <div className="story-grid mx-auto max-w-page px-[var(--page-gutter)]">
        <div className="story-text">
          <Chapter
            id="signed"
            number={6}
            kicker={signed.kicker}
            title={signed.title}
            body={
              <>
                {signed.body}
                <span className="mt-5 flex flex-wrap gap-2">
                  {signed.chips.map((c) => (
                    <span key={c} className="neu-mono neu-well-s rounded-full px-3 py-1.5 text-text-secondary">
                      {c}
                    </span>
                  ))}
                </span>
                <Link href="/verify" className="neu-btn-2 mt-6 text-body">
                  {signed.link}
                  <ArrowRight aria-hidden weight="bold" className="cta-arrow size-4" />
                </Link>
              </>
            }
            visual={
              <div className="inline-visual">
                <div className="inline-object inline-seal">
                  <ObjectImage name="seal" />
                </div>
                <div className="inline-card neu-card">
                  <SignRow />
                </div>
              </div>
            }
          />
          <Chapter
            id="found"
            number={7}
            kicker={found.kicker}
            title={found.title}
            body={
              <>
                {found.body}
                <span className="mt-5 flex flex-wrap gap-2">
                  {found.chips.map((c) => (
                    <span key={c} className="neu-mono neu-well-s rounded-full px-3 py-1.5 text-text-secondary">
                      {c}
                    </span>
                  ))}
                </span>
              </>
            }
            visual={<RequestCard className="request-inline" />}
          />
        </div>
        <div aria-hidden className="story-stage">
          <div className="stage-inner">
            <Record part="b">
              <span className="stamp">
                <span className="stamp-ring" />
              </span>
              <span className="stamp-big">
                <ObjectImage name="seal" />
              </span>
              <RequestCard className="request-stage" />
            </Record>
          </div>
        </div>
      </div>
    </section>
  );
}
