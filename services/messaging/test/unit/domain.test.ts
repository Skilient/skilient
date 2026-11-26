/** Messaging's pure rules: the chat search query, a message's link, the list line, the realtime payload guard. */
import { publishRealtime, REALTIME_MAX_BYTES } from "@skilient/platform";
import type postgres from "postgres";
import { describe, expect, it } from "vitest";
import { excerpt, extractLink } from "../../src/domain/text";
import { prefixQuery } from "../../src/store/messages";

describe("chat search query (prefix_tsquery)", () => {
  it("keeps words of letters and digits, 2+ characters, at most 8, each a prefix, lower-cased", () => {
    expect(prefixQuery("  PLANS!! ")).toBe("'plans':*");
    expect(prefixQuery("world plans")).toBe("'world':* & 'plans':*");
    expect(prefixQuery("w")).toBeNull();
    expect(prefixQuery("!!! ???")).toBeNull();
    expect(prefixQuery("a1 b2 c3 d4 e5 f6 g7 h8 i9")!.split(" & ")).toHaveLength(8);
    expect(prefixQuery("it's")).toBe("'it':*");
  });
});

describe("text", () => {
  it("a message's link is the first http(s) URL without trailing punctuation", () => {
    expect(extractLink("see https://example.com/page now")).toBe("https://example.com/page");
    expect(extractLink("(http://a.test/x).")).toBe("http://a.test/x");
    expect(extractLink("no link")).toBeNull();
  });
  it("the list line", () => {
    expect(excerpt({ deleted: true, body: "x", shared: false })).toBe("Message deleted");
    expect(excerpt({ deleted: false, body: "", shared: true })).toBe("Shared a post");
    expect(excerpt({ deleted: false, body: "", shared: false })).toBe("Image");
    expect(excerpt({ deleted: false, body: "y".repeat(200), shared: false })).toHaveLength(140);
  });
});

describe("realtime payloads", () => {
  it("refuses a malformed topic and sends an over-large payload as a reference", async () => {
    const sent: string[] = [];
    const tx = ((_s: TemplateStringsArray, _channel: string, text: string) => (sent.push(text), Promise.resolve([]))) as unknown as postgres.TransactionSql;
    await expect(publishRealtime(tx, { topic: "room:1", event: "x", payload: {} })).rejects.toThrow(/topic/);
    await publishRealtime(tx, { topic: "thread:33333333-3333-4333-8333-333333333333", event: "message.sent", payload: { body: "z".repeat(REALTIME_MAX_BYTES) } }, { id: "m1" });
    expect(JSON.parse(sent[0]!)).toMatchObject({ payload: { too_large: true, id: "m1" } });
  });
});
