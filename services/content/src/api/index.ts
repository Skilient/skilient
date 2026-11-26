import type { ServiceImpl } from "@connectrpc/connect";
import type { ContentService } from "@skilient/contracts/content/v1/content_pb";
import type { ApiDeps } from "../deps";
import { commentsApi } from "./comments";
import { feedApi } from "./feed";
import { postsApi } from "./posts";
import { surveyApi } from "./survey";

/** The content contract, joined from one module per area; a method defined twice throws at start-up. */
export function createApi(deps: ApiDeps): Partial<ServiceImpl<typeof ContentService>> {
  const api: Record<string, unknown> = {};
  for (const part of [postsApi(deps), commentsApi(deps), surveyApi(deps), feedApi(deps)]) {
    for (const [method, impl] of Object.entries(part)) {
      if (method in api) throw new Error(`content method ${method} is defined by two modules`);
      api[method] = impl;
    }
  }
  return api as Partial<ServiceImpl<typeof ContentService>>;
}
