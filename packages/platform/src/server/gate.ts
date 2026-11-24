import { randomUUID } from "node:crypto";
import type { HandlerContext, Interceptor } from "@connectrpc/connect";
import { Code, ConnectError } from "@connectrpc/connect";
import { callKey, headers, MAX_DEPTH, type CallInfo } from "../context";
import { refuse } from "../errors";
import { hashUserId, type Logger } from "../log";
import { verifyServiceToken, type ServiceKeys } from "../auth/service-token";
import type { UserTokenVerifier } from "../auth/user-token";

export interface Target {
  /** Service name: the audience its service tokens must carry. */
  name: string;
  /** Method local name -> allowed callers. */
  callers: Readonly<Record<string, readonly string[]>>;
}

export interface GateOptions {
  /** By Protobuf type name, every service this router serves. */
  targets: ReadonlyMap<string, Target>;
  keys: ServiceKeys;
  users: UserTokenVerifier;
  logger: Logger;
  logHashKey: string | Uint8Array;
  transport: "memory" | "http2";
}

const REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * Runs before the request body is read: request id, call depth, the signed
 * service token and its caller list, then the user token. A refusal is logged
 * here, since the call never reaches the interceptors.
 */
export function createGate(options: GateOptions): (ctx: HandlerContext) => Promise<void> {
  return async (ctx) => {
    const startedAt = performance.now();
    const given = ctx.requestHeader.get(headers.requestId);
    const requestId = given && REQUEST_ID.test(given) ? given : randomUUID();
    ctx.responseHeader.set(headers.requestId, requestId);
    let caller = "unknown";
    try {
      const target = options.targets.get(ctx.service.typeName);
      if (!target) throw refuse("not_found", "unknown_service");

      const depth = Number(ctx.requestHeader.get(headers.depth));
      if (!Number.isInteger(depth) || depth < 1) throw refuse("not_allowed", "call_depth_missing");
      if (depth > MAX_DEPTH) throw refuse("not_allowed", "call_depth_exceeded");

      const token = ctx.requestHeader.get(headers.serviceToken);
      const verified = token ? await verifyServiceToken(options.keys, token, target.name) : null;
      if (!verified) throw refuse("not_signed_in", "service_token_invalid");
      caller = verified;
      if (!target.callers[ctx.method.localName]?.includes(caller)) throw refuse("not_allowed", "caller_not_allowed");

      const auth = ctx.requestHeader.get(headers.authorization);
      let user: CallInfo["user"] = null;
      let userToken: string | null = null;
      if (auth) {
        const match = /^Bearer (\S+)$/.exec(auth);
        user = match?.[1] ? await options.users.verify(match[1]) : null;
        if (!user) throw refuse("not_signed_in", "user_token_invalid");
        userToken = match![1]!;
      }

      ctx.values.set(callKey, { requestId, caller, user, userToken, depth, startedAt });
    } catch (error) {
      const e = ConnectError.from(error);
      options.logger.warn("rpc", {
        request_id: requestId,
        transport: options.transport,
        rpc: `${ctx.service.typeName}/${ctx.method.name}`,
        caller,
        code: Code[e.code],
        reason: e.rawMessage,
        ms: Math.round(performance.now() - startedAt),
      });
      throw error;
    }
  };
}

/** One JSON line per call that passed the gate (CLAUDE.md, "How to work" 3). */
export function logInterceptor(options: Pick<GateOptions, "logger" | "logHashKey" | "transport">): Interceptor {
  return (next) => async (req) => {
    const call = req.contextValues.get(callKey);
    let code = "ok";
    let reason: string | undefined;
    try {
      return await next(req);
    } catch (error) {
      if (!(error instanceof ConnectError)) {
        // Never send an internal message to the caller; log only the error's class.
        code = Code[Code.Internal];
        reason = error instanceof Error ? error.name : "thrown_value";
        throw new ConnectError("internal_error", Code.Internal);
      }
      code = Code[error.code];
      reason = error.rawMessage;
      throw error;
    } finally {
      const fields = {
        request_id: call?.requestId,
        transport: options.transport,
        rpc: `${req.service.typeName}/${req.method.name}`,
        caller: call?.caller,
        user: call?.user ? hashUserId(call.user.id, options.logHashKey) : null,
        depth: call?.depth,
        code,
        reason,
        ms: call ? Math.round(performance.now() - call.startedAt) : undefined,
      };
      if (code === "ok") options.logger.info("rpc", fields);
      else options.logger.warn("rpc", fields);
    }
  };
}
