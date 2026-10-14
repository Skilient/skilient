import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PRIVACY_HEADING, splitAgreement } from "@/lib/legal/parts";

describe("splitAgreement", () => {
  it("splits the agreement from the privacy notice at the privacy heading", () => {
    const body = "Intro paragraph.\n\n## 1. Who we are\n\nText.\n\n## Privacy notice\n\n## P1. Who\n\nPrivacy text.";
    expect(splitAgreement(body)).toEqual({
      agreement: "Intro paragraph.\n\n## 1. Who we are\n\nText.",
      privacy: "## P1. Who\n\nPrivacy text.",
    });
  });

  it("returns no privacy part when the body has none", () => {
    expect(splitAgreement("## 1. Who\n\n[To be written]")).toEqual({ agreement: "## 1. Who\n\n[To be written]", privacy: null });
  });

  it("does not split on the heading text inside a paragraph", () => {
    const body = "Read the ## Privacy notice section below.\n\n## 2. Eligibility";
    expect(splitAgreement(body).privacy).toBeNull();
  });

  it("uses the heading the agreement text is written with", () => {
    expect(PRIVACY_HEADING).toBe("## Privacy notice");
  });
});

describe("the published agreement text", () => {
  // docs/legal is the source the migration copies; the pages need its privacy marker to split correctly.
  const source = readFileSync(join(process.cwd(), "docs/legal/user-agreement-and-privacy-notice.md"), "utf-8");
  const body = source.slice(source.indexOf("This agreement is between you"));

  it("has the privacy marker exactly once, with the notice after it", () => {
    expect(body.split(`\n${PRIVACY_HEADING}\n`)).toHaveLength(2);
    expect(splitAgreement(body).privacy).toMatch(/^## P1\. /);
  });

  it("leaves no placeholders for the pages to show", () => {
    expect(body).not.toMatch(/\[[A-Z][A-Za-z ]+\]/);
  });
});
