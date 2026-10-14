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
