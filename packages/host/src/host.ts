import type { ConnectRouter, ConnectRouterOptions, Interceptor, ServiceImpl, Transport } from "@connectrpc/connect";
import { createRouterTransport } from "@connectrpc/connect";
import type { DescService } from "@bufbuild/protobuf";
import {
  createClientFactory,
  createGate,
  createHealth,
  logInterceptor,
  startServer,
  type ClientFactory,
  type Health,
  type Logger,
  type RunningServer,
  type Secrets,
  type ServiceKeys,
  type ServiceModule,
  type Target,
  type UserTokenVerifier,
} from "@skilient/platform";
import { registry as defaultRegistry } from "./registry";
import { resolveUrl as defaultResolveUrl } from "./placement";

export interface HostOptions {
  /** Service names to serve in this process (the SERVICES variable). */
  services: readonly string[];
  /** This replica's name, reported by the sample and in logs. */
  instance: string;
  keys: ServiceKeys;
  users: UserTokenVerifier;
  logHashKey: string;
  logger: Logger;
  secrets: Secrets;
  registry?: Readonly<Record<string, ServiceModule>>;
  resolveUrl?: (service: string) => string | undefined;
}

export interface Host {
  services: readonly string[];
  health: Health;
  /** A client factory that calls as `caller` ("web", a job, a test), in memory for services hosted here. */
  clientsFor(caller: string): ClientFactory;
  /** An in-memory transport with only the given interceptors (tests that send forged or missing headers). */
  memoryTransport(interceptors: Interceptor[]): Transport;
  /** Serves HTTP/2 (h2c) on `port` and, if given, HTTP/1.1 on `http1Port`. */
  listen(port: number, options?: { http1Port?: number; hostname?: string }): Promise<RunningServer>;
  close(): Promise<void>;
}

/** By convention the Protobuf package is `skilient.<service>.v1`; the service name uses hyphens. */
export function serviceNameOf(typeName: string): string {
  const part = typeName.split(".")[1];
  if (!part) throw new Error(`unexpected service type name ${typeName}`);
  return part.replace(/_/g, "-");
}

/** Runs one or many services in one process (docs/azure/prd.md, "Repository layout": packages/host). */
export async function createHost(options: HostOptions): Promise<Host> {
  const registry = options.registry ?? defaultRegistry;
  const resolveUrl = options.resolveUrl ?? ((name: string) => defaultResolveUrl(name));
  const names = [...new Set(options.services)];
  if (names.length === 0) throw new Error("SERVICES names no service");

  const modules = names.map((name) => {
    const module = registry[name];
    if (!module) throw new Error(`unknown service ${name}; known: ${Object.keys(registry).join(", ")}`);
    if (serviceNameOf(module.contract.typeName) !== module.name) {
      throw new Error(`service ${module.name} has contract ${module.contract.typeName}; the package must be skilient.${module.name.replace(/-/g, "_")}.v1`);
    }
    return module;
  });

  const targets = new Map<string, Target>(
    modules.map((m) => [m.contract.typeName, { name: m.name, callers: m.callers as Record<string, readonly string[]> }]),
  );
  const routerOptions = (transport: "memory" | "http2"): ConnectRouterOptions => {
    const shared = { logger: options.logger, logHashKey: options.logHashKey, transport };
    return {
      requestGate: createGate({ ...shared, targets, keys: options.keys, users: options.users }),
      interceptors: [logInterceptor(shared)],
    };
  };
  const memoryRouter = routerOptions("memory");

  const impls: [DescService, Partial<ServiceImpl<DescService>>][] = [];
  const routes = (router: ConnectRouter) => {
    for (const [contract, impl] of impls) router.service(contract, impl);
  };

  const memoryTransport = (interceptors: Interceptor[], defaultTimeoutMs?: number): Transport =>
    createRouterTransport(routes, {
      transport: { interceptors, defaultTimeoutMs, useBinaryFormat: true },
      router: memoryRouter,
    });

  const clientsFor = (caller: string): ClientFactory =>
    createClientFactory({
      caller,
      keys: options.keys,
      serviceName: serviceNameOf,
      resolveUrl,
      local: {
        serves: (typeName) => targets.has(typeName),
        transport: ({ interceptors, defaultTimeoutMs }) => memoryTransport(interceptors, defaultTimeoutMs),
      },
    });

  const health = createHealth();
  for (const module of modules) {
    const impl = await module.create({
      name: module.name,
      instance: options.instance,
      clients: clientsFor(module.name),
      logger: options.logger.child({ service: module.name }),
      secrets: options.secrets,
    });
    impls.push([module.contract, impl as Partial<ServiceImpl<DescService>>]);
    if (module.ready) health.add(module.name, module.ready);
  }

  const servers: RunningServer[] = [];
  return {
    services: names,
    health,
    clientsFor,
    memoryTransport,
    async listen(port, listenOptions = {}) {
      const server = await startServer({
        port,
        http1Port: listenOptions.http1Port,
        host: listenOptions.hostname,
        routes,
        router: routerOptions("http2"),
        health,
      });
      servers.push(server);
      return server;
    },
    async close() {
      health.drain();
      await Promise.all(servers.map((s) => s.close()));
      await Promise.all(modules.map((m) => m.close?.()));
    },
  };
}
