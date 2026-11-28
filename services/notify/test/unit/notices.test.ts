import { describe, expect, it } from "vitest";
import { build, emptyWants, want, type Facts } from "../../src/domain/notices";
import { emptyCommunity, emptyCredentials, emptyWork } from "../../src/ports";

const A = "99b00000-0000-4000-8000-000000000001";
const B = "99b00000-0000-4000-8000-000000000002";
const C = "99b00000-0000-4000-8000-000000000003";
const X = "99c00000-0000-4000-8000-000000000001";
const facts = (f: Partial<Facts> = {}): Facts => ({
  comments: new Map(),
  messages: new Map(),
  work: emptyWork(),
  community: emptyCommunity(),
  credentials: emptyCredentials(),
  names: new Map(),
  ...f,
});

describe("events into notices (the stack's triggers)", () => {
  it("friend requests: sent, accepted, a cancelled one takes its unread notice back, a declined one nothing", () => {
    const e = (status: string) => ({ type: "friend_request.changed", payload: { request_id: X, sender_id: A, receiver_id: B, status } });
    expect(build(e("pending"), facts())).toEqual([{ op: "notify", user: B, actor: A, type: "friend_request", entityType: "friend_request", entityId: X, data: {} }]);
    expect(build(e("accepted"), facts())[0]).toMatchObject({ user: A, actor: B, type: "friend_accepted" });
    expect(build(e("cancelled"), facts())).toEqual([{ op: "retract", entityType: "friend_request", entityId: X, type: "friend_request" }]);
    expect(build(e("declined"), facts())).toEqual([]);
  });

  it("a comment: the post's author, the parent's author once, at most five mentions excluding both", () => {
    const comment = { comment_id: X, post_id: X, author_id: C, post_author_id: A, parent_author_id: A, mentioned_ids: [A, B, C] };
    const w = emptyWants();
    want({ type: "comment.created", payload: comment }, w);
    expect([...w.comments]).toEqual([X]);
    const ops = build({ type: "comment.created", payload: comment }, facts({ comments: new Map([[X, "Count me in"]]) }));
    expect(ops.map((o) => (o.op === "notify" ? [o.user, o.type] : o.op))).toEqual([
      [A, "comment_received"],
      [B, "comment_mention"],
    ]);
    expect(ops[0]).toMatchObject({ data: { post_id: X, comment_id: X, excerpt: "Count me in" } });
  });

  it("a missing title falls back (a decoration never fails the notice)", () => {
    const ops = build({ type: "application.changed", payload: { application_id: X, venture_id: X, candidate_id: A, owner_id: B, status: "pending", previous_status: null } }, facts());
    expect(ops).toEqual([{ op: "notify", user: B, actor: A, type: "application_received", entityType: "application", entityId: X, data: { venture_id: X, venture_title: null } }]);
  });

  it("chat: one collapsing notice per recipient, never the sender", () => {
    const ops = build(
      { type: "message.sent", payload: { message_id: X, thread_id: X, sender_id: A, recipient_ids: [A, B] } },
      facts({ messages: new Map([[X, { threadId: X, excerpt: "hi", ventureId: null }]]) }),
    );
    expect(ops).toEqual([{ op: "chat", user: B, actor: A, threadId: X, data: { thread_id: X, venture_title: null, excerpt: "hi" } }]);
  });

  it("the formula notice: a new ranking formula version starts the job; tiers make no notice", () => {
    expect(build({ type: "config.changed", payload: { key: "ranking.formula", version: 3, value: { version: 3 } } }, facts())).toEqual([
      { op: "job", kind: "formula-notice", payload: { version: 3, after: null }, dedupe: "formula:3" },
    ]);
    expect(build({ type: "tier.changed", payload: { user_id: A, tier: "spark", ranked: true, previous_tier: "raw" } }, facts())).toEqual([]);
  });

  it("Record: revoked only when it was sealed; the claim is an email", () => {
    expect(build({ type: "record.revoked", payload: { entry_id: X, user_id: A, status: "revoked", was_sealed: false } }, facts())).toEqual([]);
    expect(build({ type: "record.revoked", payload: { entry_id: X, user_id: A, status: "revoked", was_sealed: true } }, facts())[0]).toMatchObject({ type: "record_revoked" });
    expect(build({ type: "record.claim_held", payload: { claim_id: X, event_id: X, attendee_id: X } }, facts())[0]).toMatchObject({ op: "email", kind: "record_claim" });
  });
});
