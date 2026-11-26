/**
 * Content's pure rules: settings, the feed's quality, score, stages, two-step pool and ordering, the survey's
 * dimension choice and weights, the post link, and the SSRF guard every preview fetch passes.
 */
import { describe, expect, it } from "vitest";
import { resolveConfig } from "../../src/domain/config";
import { computeStage, inSeedAudience, orderFeed, parseCursor, quality, score, scorePool, type FeedPost, type Reader } from "../../src/domain/feed";
import { checkUrl, isPrivateAddress, PreviewRefused } from "../../src/domain/links/ssrf";
import { extractLink, urlHash } from "../../src/domain/links/url";
import { chooseDimension, responseWeight } from "../../src/domain/survey";

const c = resolveConfig({});
const now = new Date("2026-11-26T12:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);
const post = (o: Partial<FeedPost> = {}): FeedPost => ({
  id: "p",
  author_id: "a",
  university_id: "u",
  audience: "university",
  type: "general",
  venture_id: null,
  society_id: null,
  stage: "limited",
  created_at: hoursAgo(5),
  author: { university_id: "u", department_hash: "d", graduation_year: 2027 },
  author_skills: [],
  quality_pos: 0,
  quality_total: 0,
  credible_ticks: 0,
  credible_crosses: 0,
  commenters: [],
  answers: 0,
  positives: 0,
  talk_commenters: 0,
  ...o,
});
const reader = (o: Partial<Reader> = {}): Reader => ({
  id: "r",
  university_id: "u",
  department_hash: "x",
  graduation_year: 2028,
  friends: new Set(),
  follows: new Set(),
  skills: new Set(),
  seen: new Set(),
  ...o,
});

describe("settings", () => {
  it("merge a stored value over the launch defaults and ignore one its schema refuses", () => {
    const r = resolveConfig({ "feed.window": { candidates: 50 }, "survey.public_min": "three" });
    expect(r["feed.window"]).toMatchObject({ candidates: 50, max_age_days: 7 });
    expect(r["survey.public_min"]).toBe(3);
  });
});

describe("feed", () => {
  it("quality is the platform mean with no answers and falls with Credible crosses", () => {
    expect(quality(post(), c)).toBeCloseTo(0.6);
    expect(quality(post({ credible_ticks: 5, credible_crosses: 5 }), c)).toBeCloseTo(0.6 * (1 - 0.8));
  });

  it("score: friends, programme and batch raise it; seen, age and demotion lower it; relevance is capped", () => {
    const full = (o: Partial<FeedPost> = {}) => post({ stage: "full", ...o });
    const base = score(full(), reader(), now, c);
    expect(score(full(), reader({ friends: new Set(["a"]) }), now, c)).toBeCloseTo(base * 1.4);
    expect(score(full(), reader({ department_hash: "d", graduation_year: 2027 }), now, c)).toBeCloseTo(base * 1.2 * 1.1);
    expect(score(full(), reader({ seen: new Set(["p"]) }), now, c)).toBeCloseTo(base * 0.3);
    expect(score(full({ created_at: hoursAgo(20) }), reader(), now, c)).toBeLessThan(base);
    expect(score(post({ stage: "demoted" }), reader(), now, c)).toBeCloseTo(score(post({ stage: "full" }), reader(), now, c) * 0.3);
    const all = reader({ friends: new Set(["a"]), department_hash: "d", graduation_year: 2027, skills: new Set(["s1", "s2", "s3"]) });
    expect(score(full({ author_skills: ["s1", "s2", "s3"] }), all, now, c) / base).toBeCloseTo(2.0);
  });

  it("a limited post scores less outside its seed audience", () => {
    const p = post({ audience: "global", author: { university_id: "other", department_hash: null, graduation_year: null } });
    expect(inSeedAudience(p, reader())).toBe(false);
    const inside = score(p, reader({ friends: new Set(["a"]) }), now, c) / 1.4;
    expect(score(p, reader(), now, c)).toBeCloseTo(inside * 0.4);
  });

  it("stages: held, demoted, boosted, full, seed, limited", () => {
    const s = (o: Partial<Parameters<typeof computeStage>[0]>) =>
      computeStage(
        {
          stage: "seed",
          type: "general",
          audience: "university",
          created_at: hoursAgo(5),
          reports: 0,
          views: 0,
          hides: 0,
          answers: 0,
          positives: 0,
          commenters: 0,
          commenter_universities: 0,
          credible_ticks: 0,
          credible_crosses: 0,
          nonfriend_commenters: 0,
          ...o,
        },
        now,
        c,
      );
    expect(s({ reports: 3, answers: 10, positives: 10 })).toBe("held");
    expect(s({ views: 10, hides: 3 })).toBe("demoted");
    expect(s({ audience: "global", answers: 10, positives: 6 })).toBe("global_boost");
    expect(s({ audience: "university", answers: 10, positives: 9 })).toBe("full");
    expect(s({ nonfriend_commenters: 3 })).toBe("full");
    expect(s({ created_at: hoursAgo(1) })).toBe("seed");
    expect(s({ created_at: hoursAgo(1), views: 30 })).toBe("limited");
  });

  it("the two-step pool keeps near posts and the newest and most-discussed halves", () => {
    const posts = Array.from({ length: 10 }, (_, i) => post({ id: `p${i}`, author_id: i === 9 ? "friend" : `a${i}`, created_at: hoursAgo(i), answers: i === 8 ? 50 : 0 }));
    const kept = scorePool(posts, reader({ friends: new Set(["friend"]) }), 4).map((p) => p.id);
    expect(kept.sort()).toEqual(["p0", "p1", "p8", "p9"]);
    expect(scorePool(posts, reader(), 100)).toHaveLength(10);
  });

  it("ordering avoids the same author twice in a row and puts exploration in every fifth slot", () => {
    const at = hoursAgo(1);
    const order = orderFeed(
      [
        { id: "a1", author_id: "a", score: 10, created_at: at },
        { id: "a2", author_id: "a", score: 9, created_at: at },
        { id: "b1", author_id: "b", score: 1, created_at: at },
        { id: "c1", author_id: "c", score: 0.5, created_at: at },
      ],
      ["x1"],
      c,
    );
    expect(order).toEqual(["a1", "b1", "a2", "c1", "x1"]);
  });

  it("cursors are session:offset", () => {
    expect(parseCursor("9b000000-0000-4000-8000-000000000001:20")).toEqual({ session: "9b000000-0000-4000-8000-000000000001", offset: 20 });
    expect(parseCursor("not-a-cursor")).toBeNull();
    expect(parseCursor("9b000000-0000-4000-8000-000000000001:abc")).toBeNull();
  });
});

describe("survey", () => {
  const dims = [
    { dimension: "informative", post_types: ["general"], tie_priority: 0, questions: [1] },
    { dimension: "interesting", post_types: ["general"], tie_priority: 0, questions: [3] },
    { dimension: "credible", post_types: ["general"], tie_priority: 2, questions: [7] },
    { dimension: "useful", post_types: ["general"], tie_priority: 0, questions: [] },
  ];
  it("asks the dimension furthest behind its share; safety signals win ties; no question, no dimension", () => {
    expect(chooseDimension("general", {}, dims, c, () => 0)?.dimension).toBe("credible");
    expect(chooseDimension("general", { informative: 1 }, dims, c, () => 0)?.dimension).toBe("credible");
    expect(chooseDimension("general", { credible: 5 }, dims, c, () => 0)?.dimension).toBe("informative");
    expect(chooseDimension("poll", {}, dims, c, () => 0)).toBeNull();
  });
  it("weighs friends, new accounts and straight-liners, rounded to 3 places", () => {
    expect(responseWeight({ friendOrTeammate: false, newAccount: false, prior: 0, variation: false }, c)).toBe(1);
    expect(responseWeight({ friendOrTeammate: true, newAccount: true, prior: 0, variation: false }, c)).toBe(0.25);
    expect(responseWeight({ friendOrTeammate: false, newAccount: false, prior: 20, variation: false }, c)).toBe(0.3);
    expect(responseWeight({ friendOrTeammate: false, newAccount: false, prior: 20, variation: true }, c)).toBe(1);
  });
});

describe("links", () => {
  it("the post's link is the first http(s) URL without trailing punctuation", () => {
    expect(extractLink("see https://example.test/a, and more")).toBe("https://example.test/a");
    expect(extractLink("(http://plain.example.test/path).")).toBe("http://plain.example.test/path");
    expect(extractLink("not http ftp://files.example.test/f")).toBeNull();
    expect(extractLink(`https://long.test/${"x".repeat(3000)}`)).toHaveLength(2000);
    expect(urlHash("https://example.test/a")).toMatch(/^[0-9a-f]{64}$/);
  });
  it("the SSRF guard refuses private addresses and non-https or odd URLs", () => {
    for (const ip of ["10.0.0.1", "127.0.0.1", "169.254.169.254", "192.168.1.1", "::1", "fd00::1"]) expect(isPrivateAddress(ip)).toBe(true);
    expect(isPrivateAddress("93.184.216.34")).toBe(false);
    expect(() => checkUrl("http://user:pw@example.test/")).toThrow(PreviewRefused);
  });
});
