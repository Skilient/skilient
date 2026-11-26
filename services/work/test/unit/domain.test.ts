import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { openToken, sealToken } from "../../src/domain/token-crypto";
import { containsPattern, prefixQuery } from "../../src/domain/text";
import { changedFiles, isRepoName, repoFromUrl } from "../../src/harvest/stages";
import { refusalText } from "../../src/refusals";

describe("token sealing", () => {
  const key = randomBytes(32);
  it("opens what it sealed, for the same user only", () => {
    const sealed = sealToken(key, "gho_secret", "user-a");
    expect(openToken(key, sealed, "user-a")).toBe("gho_secret");
    expect(() => openToken(key, sealed, "user-b")).toThrow();
    expect(() => openToken(randomBytes(32), sealed, "user-a")).toThrow();
  });
  it("never repeats a ciphertext and refuses short keys", () => {
    expect(sealToken(key, "t", "u").equals(sealToken(key, "t", "u"))).toBe(false);
    expect(() => sealToken(randomBytes(16), "t", "u")).toThrow();
  });
});

describe("text helpers", () => {
  it("prefix queries and contains patterns as messaging's", () => {
    expect(prefixQuery("Robo ar")).toBe("'robo':* & 'ar':*");
    expect(prefixQuery("a")).toBeNull();
    expect(containsPattern(" 50%_off ")).toBe("%50\\%\\_off%");
  });
});

describe("harvest helpers", () => {
  it("repository names and search URLs", () => {
    expect(isRepoName("org/lib")).toBe(true);
    expect(isRepoName("org/..")).toBe(false);
    expect(repoFromUrl("https://api.github.com/repos/org/lib")).toBe("org/lib");
    expect(repoFromUrl("https://api.github.com/repos/org")).toBeNull();
  });
  it("changed files drop entries without a name", () => {
    expect(changedFiles([{ filename: "a.py", additions: 1, patch: "+x" }, { additions: 2 }]).map((f) => f.path)).toEqual(["a.py"]);
  });
});

describe("refusal wording with values", () => {
  it("fills each % in order", () => {
    expect(refusalText("endorse_per_month", [20])).toBe("you can give up to 20 endorsements a month");
    expect(refusalText("already_endorsed", ["React"])).toBe("you already endorsed them for React");
  });
});
