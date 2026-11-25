import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";

/**
 * A local stand-in for Have I Been Pwned's range API (no network in tests). Passwords listed as breached
 * are answered with their suffix and a count; every other prefix gets padding lines with count 0, as the
 * real API does with Add-Padding. Sets IDENTITY_HIBP_URL for identity's breached check.
 */
export async function startFakeHibp(breached: readonly string[]): Promise<{ server: Server; asked: string[]; stop: () => Promise<void> }> {
  const hashes = breached.map((p) => createHash("sha1").update(p, "utf8").digest("hex").toUpperCase());
  const asked: string[] = [];
  const server = createServer((req, res) => {
    const prefix = /\/range\/([0-9A-F]{5})$/.exec(req.url ?? "")?.[1];
    if (!prefix) {
      res.writeHead(400).end();
      return;
    }
    asked.push(prefix);
    const lines = hashes.filter((h) => h.startsWith(prefix)).map((h) => `${h.slice(5)}:42`);
    lines.push("0000000000000000000000000000000000A:0", "0000000000000000000000000000000000B:0");
    res.writeHead(200, { "content-type": "text/plain" }).end(lines.join("\r\n"));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  process.env["IDENTITY_HIBP_URL"] = `http://127.0.0.1:${port}/range/`;
  return { server, asked, stop: () => new Promise((resolve) => server.close(() => resolve())) };
}
