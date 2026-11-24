import http2 from "node:http2";
import { describe, expect, it } from "vitest";
import { createHealth, startServer } from "../src/index";

async function h2Get(port: number, path: string): Promise<{ status: number; body: string }> {
  const client = http2.connect(`http://127.0.0.1:${port}`);
  try {
    const req = client.request({ ":path": path });
    let status = 0;
    let body = "";
    req.on("response", (h) => (status = Number(h[":status"])));
    req.on("data", (d: Buffer) => (body += d.toString()));
    await new Promise((resolve, reject) => {
      req.on("end", resolve);
      req.on("error", reject);
    });
    return { status, body };
  } finally {
    client.close();
  }
}

describe("server", () => {
  it("answers /livez and /readyz on both ports, and /readyz turns 503 when a check fails or it drains", async () => {
    const health = createHealth();
    let dbUp = true;
    health.add("db", async () => dbUp);
    const server = await startServer({ port: 0, http1Port: 0, host: "127.0.0.1", routes: () => {}, router: {}, health });
    try {
      expect((await h2Get(server.port, "/livez")).status).toBe(200);
      expect((await h2Get(server.port, "/readyz")).status).toBe(200);
      const h1 = `http://127.0.0.1:${server.http1Port}`;
      expect((await fetch(`${h1}/livez`)).status).toBe(200);
      expect(await (await fetch(`${h1}/readyz`)).json()).toEqual({ ok: true, checks: { draining: true, db: true } });
      expect((await fetch(`${h1}/livez`)).headers.get("x-powered-by")).toBeNull();
      dbUp = false;
      expect((await fetch(`${h1}/readyz`)).status).toBe(503);
      dbUp = true;
      health.drain();
      expect((await h2Get(server.port, "/readyz")).status).toBe(503);
    } finally {
      await server.close();
    }
  });

  it("serves HTTP/2 only when no HTTP/1.1 port is given", async () => {
    const server = await startServer({ port: 0, host: "127.0.0.1", routes: () => {}, router: {}, health: createHealth() });
    expect(server.http1Port).toBeUndefined();
    await server.close();
  });
});
