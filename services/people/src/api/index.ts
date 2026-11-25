import type { ServiceImpl } from "@connectrpc/connect";
import type { PeopleService } from "@skilient/contracts/people/v1/people_pb";
import type { ApiDeps } from "../deps";
import { onboardingApi } from "./onboarding";
import { profilesApi } from "./profiles";
import { shellApi } from "./shell";
import { socialApi } from "./social";
import { universitiesApi } from "./universities";

/** The people contract, joined from one module per area; a method defined twice throws at start-up. */
export function createApi(deps: ApiDeps): Partial<ServiceImpl<typeof PeopleService>> {
  const api: Record<string, unknown> = {};
  for (const part of [profilesApi(deps), onboardingApi(deps), socialApi(deps), shellApi(deps), universitiesApi(deps)]) {
    for (const [method, impl] of Object.entries(part)) {
      if (method in api) throw new Error(`people method ${method} is defined by two modules`);
      api[method] = impl;
    }
  }
  return api as Partial<ServiceImpl<typeof PeopleService>>;
}
