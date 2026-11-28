import { describe, expect, it } from "vitest";
import { BUCKETS, pathAllowed } from "../../src/domain/buckets";
import { sasStringToSign } from "../../src/storage/azure";
import { memoryStore } from "../../src/storage/memory";

const U = "99b00000-0000-4000-8000-000000000001";
const V = "99b00000-0000-4000-8000-000000000002";

describe("media's rules", () => {
  it("paths: the storage-cleanup worker's shapes, and each bucket's types", () => {
    expect(pathAllowed("post-media", `${U}/${V}.webp`)).toBe(true);
    expect(pathAllowed("post-media", `${U}/${V}.pdf`)).toBe(false);
    expect(pathAllowed("credentials", `${U}/${V}.pdf`)).toBe(true);
    expect(pathAllowed("event-receipts", `${U}/${V}/${U}.pdf`)).toBe(true);
    expect(pathAllowed("event-receipts", `${U}/${V}.pdf`)).toBe(false);
    expect(pathAllowed("nope", `${U}/${V}.webp`)).toBe(false);
    for (const bad of [`../${V}.webp`, `${U}/${V}.webp/..`, `${U}//${V}.webp`, `${U}/${V}.WEBP`]) expect(pathAllowed("avatars", bad), bad).toBe(false);
    expect(Object.keys(BUCKETS)).toHaveLength(13);
  });

  it("signed links open their own file only, until they expire", async () => {
    let now = new Date("2026-11-28T10:00:00Z");
    const s = memoryStore(() => now);
    const up = await s.uploadLink("credentials", `${U}/${V}.pdf`, "application/pdf", new Date("2026-11-28T10:15:00Z"));
    s.upload(up.url, new Uint8Array([37, 80, 68, 70]), "application/pdf");
    const read = await s.downloadLink("credentials", `${U}/${V}.pdf`, new Date("2026-11-28T10:10:00Z"));
    expect(s.read(read)).toEqual(new Uint8Array([37, 80, 68, 70]));
    expect(s.read(read.replace(V, U))).toBeNull();
    expect(() => s.upload(read, new Uint8Array([1]), "application/pdf")).toThrow();
    now = new Date("2026-11-28T10:11:00Z");
    expect(s.read(read)).toBeNull();
  });

  it("the user-delegation SAS string-to-sign has the documented 24 fields in order", () => {
    const s = sasStringToSign({
      permissions: "r",
      start: "2026-11-28T10:00:00Z",
      expiry: "2026-11-28T10:10:00Z",
      resource: "/blob/acct/credentials/x.pdf",
      key: { oid: "o", tid: "t", start: "ks", expiry: "ke", service: "b", version: "2022-11-02" },
      version: "2022-11-02",
    });
    const f = s.split("\n");
    expect(f).toHaveLength(24);
    expect(f.slice(0, 10)).toEqual(["r", "2026-11-28T10:00:00Z", "2026-11-28T10:10:00Z", "/blob/acct/credentials/x.pdf", "o", "t", "ks", "ke", "b", "2022-11-02"]);
    expect(f.slice(14, 17)).toEqual(["https", "2022-11-02", "b"]);
  });
});
