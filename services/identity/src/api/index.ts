import type { ServiceImpl } from "@connectrpc/connect";
import type { IdentityService } from "@skilient/contracts/identity/v1/identity_pb";
import type { ApiDeps } from "../deps";
import { coreApi } from "./core";
import { securityApi } from "./security";
import { sessionsApi } from "./sessions";
import { signupApi } from "./signup";
import { staffApi } from "./staff";

/**
 * The identity contract, joined from one module per area. Each area owns its methods; a method defined
 * twice is a mistake, so it throws at start-up. Methods no module defines answer Unimplemented.
 */
export function createApi(deps: ApiDeps): Partial<ServiceImpl<typeof IdentityService>> {
  const api: Record<string, unknown> = {};
  for (const part of [coreApi(deps), sessionsApi(deps), signupApi(deps), securityApi(deps), staffApi(deps)]) {
    for (const [method, impl] of Object.entries(part)) {
      if (method in api) throw new Error(`identity method ${method} is defined by two modules`);
      api[method] = impl;
    }
  }
  return api as Partial<ServiceImpl<typeof IdentityService>>;
}
