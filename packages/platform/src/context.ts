import { Code, ConnectError, createContextKey, type HandlerContext } from "@connectrpc/connect";

export interface User {
  id: string;
  /** Authentication assurance level from the access token: aal2 after two-factor. */
  aal: "aal1" | "aal2";
}

/** What the platform verified about one call, before the handler runs. */
export interface CallInfo {
  requestId: string;
  /** The service named in the signed service token; "web" for the web app. */
  caller: string;
  user: User | null;
  /** The raw user access token, passed on to at most one more service. */
  userToken: string | null;
  /** 1 when web calls a service, 2 when that service calls another. */
  depth: number;
  startedAt: number;
}

export const callKey = createContextKey<CallInfo | undefined>(undefined, { description: "skilient call" });

export function callOf(ctx: HandlerContext): CallInfo {
  const call = ctx.values.get(callKey);
  if (!call) throw new ConnectError("call_context_missing", Code.Internal);
  return call;
}

export const headers = {
  requestId: "x-request-id",
  depth: "x-skilient-depth",
  serviceToken: "x-skilient-service",
  authorization: "authorization",
} as const;

export const MAX_DEPTH = 2;
