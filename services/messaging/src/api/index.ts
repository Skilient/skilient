import type { ServiceImpl } from "@connectrpc/connect";
import type { MessagingService } from "@skilient/contracts/messaging/v1/messaging_pb";
import type { ApiDeps } from "../deps";
import { messagesApi } from "./messages";
import { shareApi } from "./share";
import { threadsApi } from "./threads";

/** The messaging contract, joined from one module per area; a method defined twice throws at start-up. */
export function createApi(deps: ApiDeps): Partial<ServiceImpl<typeof MessagingService>> {
  const api: Record<string, unknown> = {};
  for (const part of [threadsApi(deps), messagesApi(deps), shareApi(deps)]) {
    for (const [method, impl] of Object.entries(part)) {
      if (method in api) throw new Error(`messaging method ${method} is defined by two modules`);
      api[method] = impl;
    }
  }
  return api as Partial<ServiceImpl<typeof MessagingService>>;
}
