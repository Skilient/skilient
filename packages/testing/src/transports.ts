import { randomBytes } from "node:crypto";
import type { DescService } from "@bufbuild/protobuf";
import { createClient, type CallOptions, type Client, type Interceptor } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-node";
import { createClientFactory, createLogger, createSecrets, startCall, type RunningServer } from "@skilient/platform";
import { createHost, serviceNameOf, type Host } from "@skilient/host";
import { afterAll, beforeAll, describe } from "vitest";
import { testKeys, type TestKeys } from "./keys";

export type TransportName = "memory" | "http2";

export interface ContractEnv {
  transport: TransportName;
  keys: TestKeys;
  host: Host;
  /** Base URL of the HTTP/2 server (http2 only). */
  url: string | undefined;
  /** Base URL of the HTTP/1.1 server (http2 only). */
  http1Url: string | undefined;
  /** JSON log lines the host wrote during the test file. */
  logs: Record<string, unknown>[];
  /** A client calling as `as` (default "web"); pass a user token to call signed in. */
  client<S extends DescService>(service: S, as?: string): Client<S>;
  call(options?: { userToken?: string; requestId?: string; depth?: number }): CallOptions;
  /** A client that sends exactly these headers and nothing the platform would add (refusal tests). */
  raw<S extends DescService>(service: S, headers: Record<string, string>): Client<S>;
}

/**
 * Runs the same contract tests against both transports (docs/azure/prd.md,
 * "Typed calls": "The contract tests run against both on every pull request").
 * `memory` calls through ConnectRPC's in-memory transport, as co-hosted services
 * do; `http2` starts a real server on a free port and calls it over h2c.
 */
export function describeTransports(services: string[], body: (env: () => ContractEnv) => void): void {
  for (const transport of ["memory", "http2"] as const) {
    describe(`over ${transport}`, () => {
      let env: ContractEnv | undefined;
      beforeAll(async () => {
        const keys = await testKeys();
        const logs: Record<string, unknown>[] = [];
        const logger = createLogger({ level: "debug", write: (line) => logs.push(JSON.parse(line) as Record<string, unknown>) });
        let url: string | undefined;
        let http1Url: string | undefined;
        const host = await createHost({
          services,
          instance: `test-${transport}`,
          keys: keys.keys,
          users: keys.users,
          logHashKey: randomBytes(16).toString("hex"),
          logger,
          secrets: createSecrets({ env: {} }),
          resolveUrl: () => url,
        });
        if (transport === "http2") {
          const server: RunningServer = await host.listen(0, { http1Port: 0, hostname: "127.0.0.1" });
          url = `http://127.0.0.1:${server.port}`;
          http1Url = `http://127.0.0.1:${server.http1Port}`;
        }
        env = {
          transport,
          keys,
          host,
          url,
          http1Url,
          logs,
          client: (service, as = "web") =>
            transport === "memory"
              ? host.clientsFor(as).client(service)
              : createClientFactory({ caller: as, keys: keys.keys, serviceName: serviceNameOf, resolveUrl: () => url }).client(service),
          call: (options = {}) => startCall(options),
          raw: (service, headers) => {
            const set: Interceptor = (next) => (req) => {
              for (const [k, v] of Object.entries(headers)) req.header.set(k, v);
              return next(req);
            };
            const t =
              transport === "memory"
                ? host.memoryTransport([set])
                : createConnectTransport({ httpVersion: "2", baseUrl: url!, useBinaryFormat: true, interceptors: [set] });
            return createClient(service, t);
          },
        };
      });
      afterAll(async () => {
        await env?.host.close();
      });
      body(() => {
        if (!env) throw new Error("contract env used outside a test");
        return env;
      });
    });
  }
}
