import type { CallOptions } from "@connectrpc/connect";
import { ContentService } from "@skilient/contracts/content/v1/content_pb";
import { MessagingService } from "@skilient/contracts/messaging/v1/messaging_pb";
import { RealtimeService } from "@skilient/contracts/realtime/v1/realtime_pb";
import { defineService, startCall, type CallerPolicy } from "@skilient/platform";
import { createHub, type Hub } from "./hub";

let hub: Hub | undefined;

/** Stats is for /ops (trust, W10). */
export const callers: CallerPolicy<typeof RealtimeService> = { stats: ["trust"] };

/**
 * realtime (W4): one WebSocket per visible tab on GET /realtime (the HTTP/1.1 port, upgraded); it owns no
 * data. Its database role only LISTENs. Thread topics are checked with messaging's CanListen and feed topics
 * with content's CanListenFeed (one call per new user and topic, cached 60 s).
 */
export default defineService({
  name: "realtime",
  contract: RealtimeService,
  callers,
  async create(deps) {
    const messaging = deps.clients.client(MessagingService);
    const content = deps.clients.client(ContentService);
    hub = createHub({
      sql: deps.database(),
      users: deps.users,
      logger: deps.logger,
      canListenThread: async (userId, threadId) => (await messaging.canListen({ userId, threadId }, startCall() as CallOptions)).allowed,
      canListenFeed: async (userId, feedId) => (await content.canListenFeed({ userId, feedId }, startCall() as CallOptions)).allowed,
    });
    await hub.start();
    deps.http.upgrade("/realtime", (req, socket, head) => hub!.handleUpgrade(req, socket, head));
    return {
      async stats() {
        const s = hub!.stats();
        return { sockets: s.sockets, subscriptions: s.subscriptions, delivered: BigInt(s.delivered) };
      },
    };
  },
  async close() {
    await hub?.close();
    hub = undefined;
  },
});
