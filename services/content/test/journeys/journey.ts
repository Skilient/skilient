/**
 * The world for content's service-level journeys (W3, as people's W2 Q3 decision): each journey mirrors one
 * Playwright spec test (apps/web/tests/e2e/posts.spec.ts, comments.spec.ts, feed.spec.ts, survey.spec.ts and
 * the share test in community.spec.ts) and drives identity, people and content only through their contracts,
 * on both transports. Students sign up and onboard through identity and people (people's journey client);
 * content learns about them from the events, through its copies consumer. Purely web parts (axe, drafts in
 * the browser, image re-encoding, the new-posts pill over realtime) are `it.todo` naming the workstream that
 * owns them.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CallOptions } from "@connectrpc/connect";
import { ContentService } from "@skilient/contracts/content/v1/content_pb";
import type { ContractEnv } from "@skilient/testing";
import type postgres from "postgres";
import { journeyClient as peopleJourney } from "../../../people/test/journeys/journey";
import { NUTECH } from "../../../people/test/contract/world";
import { drainCopies, publishAs, type ContentWorld } from "../contract/world";

export function journeyClient(env: () => ContractEnv, world: () => ContentWorld) {
  const p = peopleJourney(env, world);
  const content = () => env().client(ContentService);
  /** A read: no idempotency key. */
  const read = (token: string): CallOptions => env().call({ userToken: token });

  /** `createStudent` from apps/web/tests/e2e/support.ts, and content's copy of them caught up. */
  async function createStudent(uni: typeof NUTECH, fullName: string, o: Parameters<typeof p.onboard>[1] = {}) {
    const s = await p.createStudent(uni, fullName, o);
    await drainCopies(world());
    return s;
  }

  /** A general post through the composer's call. */
  const post = (token: string, body: string, extra: Record<string, unknown> = {}) =>
    content().createPost({ type: "general", audience: "university", body, media: [], pinDays: 0, ...extra }, p.as(token));

  /** The cards a reader's feed tab would show for these ids (the page reads cards by id). */
  const cards = async (token: string, ids: string[]) => (await content().postCards({ postIds: ids }, read(token))).cards;

  /** Whether a post opens for a reader (/post/[id]: the card or "This post isn't available"). */
  const opens = async (token: string, id: string) => (await cards(token, [id])).length === 1;

  /** One page of a feed tab. */
  const feed = (token: string, audience: "university" | "global", filter = "all", cursor = "", limit = 20) =>
    content().feedPage({ audience, filter, cursor, limit, withCards: true }, p.as(token));

  /** What `promote` does in the specs: the post reaches Full and is a few hours old, so the ranked feed shows it. */
  const promote = async (ids: string[]) => {
    await world().content`update content.posts set stage = 'full', created_at = now() - interval '3 hours' where id = any(${ids}::uuid[])`;
  };

  /** Another owner's role: events are published from that service's own database role, as in production. */
  const roles = new Map<ContentWorld, Record<string, postgres.Sql>>();
  const roleOf = async (service: string) => {
    const mine = roles.get(world()) ?? {};
    roles.set(world(), mine);
    return (mine[service] ??= await world().pg.service(service, mkdtempSync(join(tmpdir(), "mig-"))));
  };
  const publish = async (service: string, type: string, subjects: string[], payload: Record<string, unknown>) => {
    await publishAs(await roleOf(service), type, subjects, payload);
    await drainCopies(world());
  };

  /** A verified society with one officer, as community would announce them. */
  async function society(officerId: string, universityId: string) {
    const id = crypto.randomUUID();
    await publish("community", "society.status_changed", [id], { society_id: id, university_id: universityId, status: "verified" });
    await publish("community", "group.member_changed", [id, officerId], { kind: "society", group_id: id, user_id: officerId, member: true, role: "officer" });
    return id;
  }

  /** Content as another caller (messaging reads VisiblePosts). */
  const contentAs = (caller: string) => env().client(ContentService, caller);

  return { ...p, content, contentAs, read, createStudent, post, cards, opens, feed, promote, publish, society, drain: () => drainCopies(world()) };
}
