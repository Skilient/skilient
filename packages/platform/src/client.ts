import { randomUUID } from "node:crypto";
import type { DescService } from "@bufbuild/protobuf";
import { MethodOptions_IdempotencyLevel } from "@bufbuild/protobuf/wkt";
import {
  Code,
  ConnectError,
  createClient,
  createContextValues,
  type CallOptions,
  type Client,
  type HandlerContext,
  type Interceptor,
  type Transport,
} from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-node";
import { callKey, headers, type CallInfo } from "./context";
import { createServiceSigner, type ServiceKeys } from "./auth/service-token";

/** docs/azure/prd.md, "Typed calls": the rules every call follows. */
export const CALL_RULES = {
  deadlineMs: 2_000,
  retryJitterMs: [20, 120] as const,
  breakerFailures: 5,
  breakerWindowMs: 10_000,
  breakerOpenMs: 10_000,
} as const;

export interface ClientFactoryOptions {
  /** Who is calling: "web" or this process's service name for service-to-service calls. */
  caller: string;
  keys: ServiceKeys;
  /** Service name for a Protobuf service type name (the token audience). */
  serviceName(typeName: string): string;
  /** The services hosted in this process, reached through an in-memory transport. */
  local?: LocalRoutes;
  /** Base URL of the replica set that hosts a service, for calls over HTTP/2. */
  resolveUrl(serviceName: string): string | undefined;
}

export interface LocalRoutes {
  serves(typeName: string): boolean;
  /** An in-memory transport to this process's router, with the caller's interceptors. */
  transport(options: { interceptors: Interceptor[]; defaultTimeoutMs: number }): Transport;
}

export interface ClientFactory {
  client<S extends DescService>(service: S): Client<S>;
  transportOf(service: DescService): "memory" | "http2";
}

/** Call options that carry the incoming call (request id, user, depth) on to the next service. */
export function from(ctx: HandlerContext, options: CallOptions = {}): CallOptions {
  return { signal: ctx.signal, ...options, contextValues: ctx.values };
}

/** Call options for a call that starts outside any handler (web, jobs, tests). */
export function startCall(call: Partial<Pick<CallInfo, "requestId" | "userToken" | "depth">> = {}, options: CallOptions = {}): CallOptions {
  const values = createContextValues();
  values.set(callKey, {
    requestId: call.requestId ?? randomUUID(),
    caller: "",
    user: null,
    userToken: call.userToken ?? null,
    depth: call.depth ?? 0,
    startedAt: performance.now(),
  });
  return { ...options, contextValues: values };
}

function propagate(options: ClientFactoryOptions): Interceptor {
  const sign = createServiceSigner(options.keys, options.caller);
  return (next) => async (req) => {
    const call = req.contextValues.get(callKey);
    req.header.set(headers.requestId, call?.requestId ?? randomUUID());
    req.header.set(headers.depth, String((call?.depth ?? 0) + 1));
    req.header.set(headers.serviceToken, await sign(options.serviceName(req.service.typeName)));
    if (call?.userToken) req.header.set(headers.authorization, `Bearer ${call.userToken}`);
    return next(req);
  };
}

/** One retry, with jitter, on reads only, and only when the callee was unavailable. */
export const retryReads: Interceptor = (next) => async (req) => {
  try {
    return await next(req);
  } catch (error) {
    const read = req.method.idempotency === MethodOptions_IdempotencyLevel.NO_SIDE_EFFECTS;
    if (!read || req.stream || ConnectError.from(error).code !== Code.Unavailable || req.signal.aborted) throw error;
    const [min, max] = CALL_RULES.retryJitterMs;
    await new Promise((resolve) => setTimeout(resolve, min + Math.random() * (max - min)));
    return next(req);
  }
};

/** Opens after 5 failures in 10 s; fails fast for 10 s, then lets calls through again. */
export function createBreaker(now: () => number = Date.now): Interceptor {
  const failures = new Map<string, number[]>();
  const openUntil = new Map<string, number>();
  const infra = new Set([Code.Unavailable, Code.DeadlineExceeded, Code.Internal, Code.Unknown]);
  return (next) => async (req) => {
    const key = req.service.typeName;
    if ((openUntil.get(key) ?? 0) > now()) throw new ConnectError("circuit_open", Code.Unavailable);
    try {
      return await next(req);
    } catch (error) {
      if (infra.has(ConnectError.from(error).code)) {
        const t = now();
        const recent = (failures.get(key) ?? []).filter((at) => at > t - CALL_RULES.breakerWindowMs);
        recent.push(t);
        failures.set(key, recent);
        if (recent.length >= CALL_RULES.breakerFailures) {
          openUntil.set(key, t + CALL_RULES.breakerOpenMs);
          failures.set(key, []);
        }
      }
      throw error;
    }
  };
}

export function createClientFactory(options: ClientFactoryOptions): ClientFactory {
  const interceptors = [createBreaker(), retryReads, propagate(options)];
  const remote = new Map<string, Transport>();
  const clients = new Map<string, Client<DescService>>();
  let local: Transport | undefined;
  const isLocal = (service: DescService) => options.local?.serves(service.typeName) ?? false;

  const transportFor = (service: DescService): Transport => {
    if (isLocal(service)) {
      local ??= options.local!.transport({ interceptors, defaultTimeoutMs: CALL_RULES.deadlineMs });
      return local;
    }
    const name = options.serviceName(service.typeName);
    const baseUrl = options.resolveUrl(name);
    if (!baseUrl) throw new ConnectError(`no_route:${name}`, Code.Unavailable);
    let transport = remote.get(baseUrl);
    if (!transport) {
      transport = createConnectTransport({
        httpVersion: "2",
        baseUrl,
        useBinaryFormat: true,
        defaultTimeoutMs: CALL_RULES.deadlineMs,
        interceptors,
      });
      remote.set(baseUrl, transport);
    }
    return transport;
  };

  return {
    client<S extends DescService>(service: S): Client<S> {
      let client = clients.get(service.typeName);
      if (!client) {
        client = createClient(service, transportFor(service)) as unknown as Client<DescService>;
        clients.set(service.typeName, client);
      }
      return client as unknown as Client<S>;
    },
    transportOf: (service) => (isLocal(service) ? "memory" : "http2"),
  };
}
