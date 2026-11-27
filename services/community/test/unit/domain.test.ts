import { createHmac, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { nameKey, pktShort, referenceCode, slugBase, teamCode, ticketCode } from "../../src/domain/names";
import { fill, wanted } from "../../src/domain/people";
import { eventCode, newSecret, openSecret, payloadMatches, sealSecret, ticketPayload, windowOf } from "../../src/domain/ticket";
import { REFUSALS, refusalText } from "../../src/refusals";

describe("society names (society_name_key, society_slug)", () => {
  it("treats 'CS Society', 'The CS Club' and 'cs  society!' as one name", () => {
    expect(["CS Society", "The CS Club", "cs  society!", "the cs soc", "CS"].map(nameKey)).toEqual(["cs", "cs", "cs", "cs", "cs"]);
    expect(nameKey("The Wren Robotics Club!")).toBe("wren robotics");
    expect(nameKey("wren  debating society")).toBe("wren debating");
    expect(nameKey("Society of Clubs")).toBe("society of clubs");
    expect(nameKey(null)).toBe("");
  });

  it("makes slugs of letters and digits, 'society' when too short", () => {
    expect(slugBase("  Wren Printmakers  ")).toBe("wren-printmakers");
    expect(slugBase("C++ & Rust!")).toBe("c-rust");
    expect(slugBase("AI")).toBe("society");
    expect(slugBase("x".repeat(80))).toHaveLength(50);
  });

  it("codes: teams of 6 without look-alikes, references SKL-XXXX, a ticket's short code", () => {
    expect(teamCode()).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(referenceCode()).toMatch(/^SKL-[A-HJ-NP-Z2-9]{4}$/);
    expect(ticketCode("97e00000-0000-4000-8000-000000000001")).toBe("97E00000");
  });

  it("shows times in Pakistan time as 'DD Mon · HH:MM'", () => {
    expect(pktShort(new Date("2026-11-28T09:00:00Z"))).toBe("28 Nov · 14:00");
  });
});

describe("signed tickets", () => {
  const key = randomBytes(32);
  const event = "97e00000-0000-4000-8000-000000000001";
  const reg = "97e00000-0000-4000-8000-0000000000a1";
  const user = "97b00000-0000-4000-8000-000000000004";

  it("seals each event's secret under the ticket key, bound to the event", () => {
    const secret = newSecret();
    const sealed = sealSecret(key, secret, event);
    expect(openSecret(key, sealed, event).equals(secret)).toBe(true);
    expect(() => openSecret(key, sealed, reg)).toThrow();
    expect(() => openSecret(randomBytes(32), sealed, event)).toThrow();
  });

  it("signs SKT1.<registration>.<24 hex> exactly as private.ticket_payload did", () => {
    const secret = newSecret();
    const want = createHmac("sha256", secret).update(`ticket:${event}:${reg}:${user}`).digest("hex").slice(0, 24);
    const payload = ticketPayload(secret, event, reg, user);
    expect(payload).toBe(`SKT1.${reg}.${want}`);
    expect(payloadMatches(secret, event, reg, user, payload)).toBe(true);
    expect(payloadMatches(secret, event, reg, user, `${payload.slice(0, -4)}0000`)).toBe(false);
    expect(payloadMatches(secret, event, reg, event, payload)).toBe(false);
  });

  it("rotates the self check-in code every 30 seconds (private.event_code)", () => {
    const secret = newSecret();
    const w = windowOf(new Date("2026-11-28T09:00:10Z"));
    expect(windowOf(new Date("2026-11-28T09:00:29Z"))).toBe(w);
    expect(windowOf(new Date("2026-11-28T09:00:30Z"))).toBe(w + 1);
    expect(eventCode(secret, event, w)).toBe(createHmac("sha256", secret).update(`${event}:${w}`).digest("hex").slice(0, 24));
    expect(eventCode(secret, event, w)).not.toBe(eventCode(secret, event, w + 1));
  });
});

describe("people placeholders", () => {
  const u = "97b00000-0000-4000-8000-000000000001";
  const uni = "97a00000-0000-4000-8000-00000000000a";
  const lookup = {
    person: (id: string) => (id === u ? { name: "Priya Wren", username: "cm_priya", avatar_path: null, department: "Computer Science", batch: 2027 } : undefined),
    university: (id: string) => (id === uni ? "Community Golden University A" : undefined),
  };

  it("lists what a document asks for, and fills it (alone, inside text, unknown)", () => {
    const doc = { a: `$name:${u}`, b: [{ batch: `$batch:${u}`, x: `For students at $university:${uni} only.` }], c: "$name:97b00000-0000-4000-8000-0000000000ff", d: 3 };
    expect(wanted(doc)).toEqual({ users: [u, "97b00000-0000-4000-8000-0000000000ff"], universities: [uni] });
    expect(fill(doc, lookup)).toEqual({ a: "Priya Wren", b: [{ batch: 2027, x: "For students at Community Golden University A only." }], c: null, d: 3 });
  });
});

describe("refusals", () => {
  it("carry today's wording, with values where the stack put them", () => {
    expect(refusalText("max_officers", [15])).toBe("a society has at most 15 officers");
    expect(refusalText("society_cant", ["pending"])).toBe("this society is pending and can't do that");
    expect(refusalText("ticket_prices", [100, 10000])).toBe("ticket prices are PKR 100 to 10000");
    for (const r of Object.values(REFUSALS)) expect(r.sqlstate).toMatch(/^[0-9A-Z]{5}$/);
  });
});
