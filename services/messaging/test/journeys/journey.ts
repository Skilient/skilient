/**
 * The world for messaging's journeys (W4, as people's W2 Q3 decision): each journey mirrors one Playwright spec
 * test (apps/web/tests/e2e/chat.spec.ts, chat-extras.spec.ts, and the W4 to-dos other journeys left: the share
 * sheet's chat half, the new-posts pill, the live Friends badge) through identity, people, content, messaging
 * and realtime's contracts on both transports, with live delivery over realtime's socket. Purely web parts
 * (axe, the composer, typing indicators drawn by the page) are `it.todo` for W13.
 */
import type { CallOptions } from "@connectrpc/connect";
import { MessagingService } from "@skilient/contracts/messaging/v1/messaging_pb";
import { PeopleService } from "@skilient/contracts/people/v1/people_pb";
import type { ContractEnv } from "@skilient/testing";
import { journeyClient as contentJourney } from "../../../content/test/journeys/journey";
import { connect, drainCopies, type MessagingWorld } from "../contract/world";

export function journeyClient(env: () => ContractEnv, world: () => MessagingWorld) {
  const c = contentJourney(env, world);
  const messaging = () => env().client(MessagingService);
  const read = (token: string): CallOptions => env().call({ userToken: token });
  let http1: string | undefined;
  /** The HTTP/1.1 address realtime's sockets use (started on the memory transport's host when needed). */
  const socketUrl = async () => (http1 ??= env().http1Url ?? `http://127.0.0.1:${(await env().host.listen(0, { http1Port: 0, hostname: "127.0.0.1" })).http1Port}`);

  /** `createStudent`, with messaging's copy caught up too. */
  async function createStudent(...args: Parameters<typeof c.createStudent>) {
    const s = await c.createStudent(...args);
    await drainCopies(world());
    return s;
  }

  /** Two students become friends through people's contract (a request and its acceptance). */
  async function befriend(a: { token: string }, b: { token: string; username: string }) {
    const people = env().client(PeopleService);
    const { requestId } = await people.sendFriendRequest({ username: b.username }, c.as(a.token));
    await people.respondFriendRequest({ requestId, accept: true }, c.as(b.token));
    await drainCopies(world());
  }

  /** A tab: a realtime socket for a signed-in user. */
  const tab = async (token: string) => connect(await socketUrl(), token);

  /** The message write a composer makes. */
  const say = (token: string, threadId: string, body: string, replyToId = "") => messaging().sendMessage({ threadId, body, replyToId }, c.as(token));

  return { ...c, messaging, read, createStudent, befriend, tab, say, drain: () => drainCopies(world()) };
}
