import { fromJson, toJson, type JsonValue } from "@bufbuild/protobuf";
import { createClientFactory, startCall } from "@skilient/platform";
import { boot } from "./boot";
import { createHost, serviceNameOf } from "./host";
import { resolveUrl } from "./placement";
import { registry } from "./registry";

/**
 * The image's entry point.
 *   host.mjs                      serve the services named in SERVICES: HTTP/2 (h2c) on PORT (8080),
 *                                 HTTP/1.1 on HTTP1_PORT (8081) for probes and tools
 *   host.mjs call <service> <Method> [json] [--url <base>] [--as <caller>]
 *                                 call one method over HTTP/2 and print the reply (operator probe)
 */
async function serve() {
  const b = await boot();
  const services = (b.env["SERVICES"] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const host = await createHost({ ...b, services });
  const port = Number(b.env["PORT"] ?? 8080);
  const http1Port = Number(b.env["HTTP1_PORT"] ?? 8081);
  const server = await host.listen(port, { http1Port });
  b.logger.info("host_started", { services: services.join(","), port: server.port, http1_port: server.http1Port });

  let stopping = false;
  const stop = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    b.logger.info("host_stopping", { signal });
    await host.close();
    process.exit(0);
  };
  process.on("SIGTERM", () => void stop("SIGTERM"));
  process.on("SIGINT", () => void stop("SIGINT"));
}

async function call(args: string[]) {
  const flags = new Map<string, string>();
  const positional: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a.startsWith("--")) flags.set(a.slice(2), args[++i] ?? "");
    else positional.push(a);
  }
  const [serviceName, methodName, json = "{}"] = positional;
  const module = serviceName ? registry[serviceName] : undefined;
  const method = module?.contract.methods.find((m) => m.name === methodName || m.localName === methodName);
  if (!module || !method) {
    console.error("usage: host.mjs call <service> <Method> [json] [--url <base>] [--as <caller>]");
    process.exit(2);
  }
  // The reply is the only thing on stdout, so the probe's output can be parsed.
  const b = await boot(process.env, { logTo: "stderr" });
  const clients = createClientFactory({
    caller: flags.get("as") ?? "web",
    keys: b.keys,
    serviceName: serviceNameOf,
    resolveUrl: (name) => flags.get("url") ?? resolveUrl(name, b.env),
  });
  const client = clients.client(module.contract) as unknown as Record<string, (req: unknown, opts: unknown) => Promise<unknown>>;
  const reply = await client[method.localName]!(fromJson(method.input, JSON.parse(json) as JsonValue), startCall());
  process.stdout.write(JSON.stringify(toJson(method.output, reply as never)) + "\n");
  process.exit(0);
}

const [command, ...rest] = process.argv.slice(2);
process.on("unhandledRejection", (error) => {
  process.stderr.write(JSON.stringify({ level: "error", msg: "unhandled", error: error instanceof Error ? error.message : String(error) }) + "\n");
  process.exit(1);
});
if (command === "call") await call(rest);
else if (command === undefined || command === "serve") await serve();
else {
  console.error(`unknown command ${command}`);
  process.exit(2);
}
