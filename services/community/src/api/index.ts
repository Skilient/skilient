import type { ServiceImpl } from "@connectrpc/connect";
import type { CommunityService } from "@skilient/contracts/community/v1/community_pb";
import { z } from "zod";
import { eventsApi } from "./events";
import { paymentsApi } from "./payments";
import { societiesApi } from "./societies";
import { parse, type ApiDeps } from "./util";

export type { ApiDeps } from "./util";

/** Community's handlers, one module per area, and the batch reads other services make. */
export function createApi(deps: ApiDeps): ServiceImpl<typeof CommunityService> {
  return {
    ...societiesApi(deps),
    ...eventsApi(deps),
    ...paymentsApi(deps),
    async societyCards(req) {
      const ids = parse(z.array(z.uuid()).max(200), req.societyIds);
      if (ids.length === 0) return { cards: [] };
      const rows = await deps.sql<{ id: string; name: string; slug: string; logo_path: string | null; status: string; university_id: string }[]>`
        select id::text, name, slug, logo_path, status, university_id::text from community.societies where id = any(${ids}::uuid[])`;
      return { cards: rows.map((r) => ({ id: r.id, name: r.name, slug: r.slug, logoPath: r.logo_path ?? "", status: r.status, universityId: r.university_id })) };
    },
  } as ServiceImpl<typeof CommunityService>;
}
