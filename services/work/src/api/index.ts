import type { ServiceImpl } from "@connectrpc/connect";
import type { WorkService } from "@skilient/contracts/work/v1/work_pb";
import type { ApiDeps } from "../deps";
import { contributionsApi } from "./contributions";
import { evidenceApi } from "./evidence";
import { githubApi, skillsApi } from "./github";
import { growthApi } from "./growth";
import { venturesApi } from "./ventures";

/** Work's handlers, one module per area. */
export function createApi(deps: ApiDeps): ServiceImpl<typeof WorkService> {
  return { ...venturesApi(deps), ...contributionsApi(deps), ...githubApi(deps), ...skillsApi(deps), ...evidenceApi(deps), ...growthApi(deps) } as ServiceImpl<typeof WorkService>;
}
