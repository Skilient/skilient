import type { CallOptions } from "@connectrpc/connect";
import { CommunityService } from "@skilient/contracts/community/v1/community_pb";
import { startCall, type ClientFactory } from "@skilient/platform";
import type { GroupLabels } from "./search";

/**
 * Labels for shared groups on suggestions ("In X with you"): society names from community's SocietyCards, one
 * batch call per page (W7). Venture titles wait for work's batch read to list people as a caller (W5's hand-off).
 */
export function communityLabels(clients: ClientFactory): GroupLabels {
  return {
    async labels(kind, ids) {
      if (kind !== "society" || ids.length === 0) return new Map();
      // A label is a decoration: if community can't answer, suggestions show without it.
      const r = await (async () => clients.client(CommunityService).societyCards({ societyIds: [...ids].slice(0, 200) }, startCall() as CallOptions))().catch(() => ({
        cards: [],
      }));
      return new Map(r.cards.map((c) => [c.id, c.name]));
    },
  };
}
