import http from "node:http";
import http2 from "node:http2";
import net from "node:net";
import type { ConnectRouter, ConnectRouterOptions } from "@connectrpc/connect";
import { expressConnectMiddleware } from "@connectrpc/connect-express";
import { connectNodeAdapter } from "@connectrpc/connect-node";
import express from "express";
import type { Health } from "../health";

export interface ServerOptions {
  /** HTTP/2 without TLS (h2c): calls between containers. */
  port: number;
  /** HTTP/1.1 (Express 5): probes, tools and curl. Omit to serve HTTP/2 only. */
  http1Port?: number;
  host?: string;
  routes: (router: ConnectRouter) => void;
  router: ConnectRouterOptions;
  health: Health;
}

export interface RunningServer {
  port: number;
  http1Port: number | undefined;
  close(): Promise<void>;
}

/**
 * Two listeners for one router. Container Apps ingress with transport http2
 * speaks h2c to `port`; Node's HTTP/2 server reads its socket natively, so it
 * cannot share a port with an HTTP/1.1 server behind a protocol sniff. HTTP/1.1
 * is Express 5 on `http1Port`. Both answer /livez and /readyz.
 */
export async function startServer(options: ServerOptions): Promise<RunningServer> {
  const host = options.host ?? "0.0.0.0";

  const health2 = async (req: http2.Http2ServerRequest, res: http2.Http2ServerResponse) => {
    if (req.url === "/livez") return void res.writeHead(200, { "content-type": "application/json" }).end('{"ok":true}');
    if (req.url === "/readyz") {
      const result = await options.health.ready();
      return void res.writeHead(result.ok ? 200 : 503, { "content-type": "application/json" }).end(JSON.stringify(result));
    }
    res.writeHead(404).end();
  };
  const h2 = http2.createServer(
    {},
    connectNodeAdapter({
      ...options.router,
      routes: options.routes,
      fallback: (req, res) => void health2(req as http2.Http2ServerRequest, res as http2.Http2ServerResponse),
    }),
  );
  const sessions = new Set<http2.ServerHttp2Session>();
  h2.on("session", (session) => {
    sessions.add(session);
    session.on("close", () => sessions.delete(session));
  });
  const port = await listen(h2, options.port, host);

  let h1: http.Server | undefined;
  let http1Port: number | undefined;
  if (options.http1Port !== undefined) {
    const app = express();
    app.disable("x-powered-by");
    app.get("/livez", (_req, res) => {
      res.status(200).json({ ok: true });
    });
    app.get("/readyz", async (_req, res) => {
      const result = await options.health.ready();
      res.status(result.ok ? 200 : 503).json(result);
    });
    app.use(expressConnectMiddleware({ ...options.router, routes: options.routes }));
    h1 = http.createServer(app);
    h1.keepAliveTimeout = 65_000;
    http1Port = await listen(h1, options.http1Port, host);
  }

  return {
    port,
    http1Port,
    async close() {
      options.health.drain();
      const closing = [
        new Promise<void>((resolve) => h2.close(() => resolve())),
        h1 ? new Promise<void>((resolve) => h1.close(() => resolve())) : Promise.resolve(),
      ];
      for (const session of sessions) session.close();
      h1?.closeIdleConnections();
      const force = new Promise<void>((resolve) =>
        setTimeout(() => {
          for (const session of sessions) session.destroy();
          h1?.closeAllConnections();
          resolve();
        }, 10_000).unref(),
      );
      await Promise.race([Promise.all(closing).then(() => undefined), force]);
    },
  };
}

async function listen(server: net.Server, port: number, host: string): Promise<number> {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => resolve());
  });
  const address = server.address();
  return typeof address === "object" && address ? address.port : port;
}
