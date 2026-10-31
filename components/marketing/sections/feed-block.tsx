import { feed } from "@/content/marketing";
import { captures } from "@/lib/marketing/captures";
import { CaptureImage } from "../capture-image";
import { Section, SectionHeading } from "./section";

/**
 * Landing section 5 (PRD 5.1): the survey strip and the public line, in two real post captures
 * set as an offset pair; copy on the right. Phone: copy first.
 */
export function FeedBlock() {
  const { postABefore, postB } = captures.hero;
  return (
    <Section labelledBy="feed-title" step="03 · The feed">
      <div className="grid items-center gap-10 md:grid-cols-12 md:gap-6">
        <div role="img" aria-label={feed.alt} className="order-2 mx-auto grid w-full max-w-[34rem] grid-cols-6 md:order-1 md:col-span-7">
          <div className="neu-tile col-span-5 overflow-hidden p-2"><div className="overflow-hidden rounded-[18px]">
            <CaptureImage file={postABefore} alt="" />
          </div></div>
          <div className="neu-tile relative col-span-5 col-start-2 -mt-[18%] overflow-hidden p-2 shadow-[var(--raised-l)]"><div className="overflow-hidden rounded-[18px]">
            <CaptureImage file={postB} alt="" />
          </div></div>
        </div>
        <div className="order-1 flex flex-col gap-5 md:order-2 md:col-span-5">
          <SectionHeading id="feed-title">{feed.heading}</SectionHeading>
          <p className="max-w-[46ch] text-body-lg text-text-secondary">{feed.body}</p>
        </div>
      </div>
    </Section>
  );
}
