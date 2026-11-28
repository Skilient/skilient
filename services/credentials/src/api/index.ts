import type { ServiceImpl } from "@connectrpc/connect";
import type { CredentialsService } from "@skilient/contracts/credentials/v1/credentials_pb";
import { cvApi } from "./cv";
import { recordApi } from "./record";
import type { ApiDeps } from "./util";

export type { ApiDeps } from "./util";

/** Credentials' handlers, one module per area. */
export function createApi(deps: ApiDeps): ServiceImpl<typeof CredentialsService> {
  return { ...cvApi(deps), ...recordApi(deps) } as ServiceImpl<typeof CredentialsService>;
}
