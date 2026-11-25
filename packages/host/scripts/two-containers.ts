// W0 done-when (docs/azure/prd.md, build plan): the sample runs co-hosted and
// standalone from one image, and an HTTP/2 call between two containers succeeds.
//
//   echo    SERVICES=sample                      standalone
//   relay   SERVICES=sample-relay                calls echo over HTTP/2 (h2c), container to container
//   cohost  SERVICES=sample,sample-relay         both in one process, in memory
//
// Run: pnpm services:image && pnpm services:smoke   (IMAGE overrides the tag)
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createClientFactory, serviceKeysFrom, startCall } from "@skilient/platform";
import { SampleRelayService } from "@skilient/contracts/sample_relay/v1/sample_relay_pb";
import { serviceNameOf } from "../src/host";

const image = process.env["IMAGE"] ?? "skilient/services:dev";
const id = randomBytes(3).toString("hex");
const net = `skl-smoke-${id}`;
const serviceKey = randomBytes(32).toString("base64url");
const secrets = ["-e", `SECRET_SERVICE_TOKEN_KEY=${serviceKey}`, "-e", `SECRET_LOG_HASH_KEY=${randomBytes(16).toString("hex")}`];
const names = { echo: `skl-echo-${id}`, relay: `skl-relay-${id}`, cohost: `skl-cohost-${id}` };

const docker = (...args: string[]) => execFileSync("docker", args, { encoding: "utf8" }).trim();
const fail = (msg: string): never => {
  throw new Error(msg);
};

function run(name: string, hostname: string, env: string[]) {
  docker("run", "-d", "--name", name, "--hostname", hostname, "--network", net, "-p", "127.0.0.1::8080", "-p", "127.0.0.1::8081", ...secrets, ...env.flatMap((e) => ["-e", e]), image);
}

function port(name: string, inner: number): number {
  return Number(docker("port", name, `${inner}/tcp`).split("\n")[0]!.split(":").pop());
}

async function ready(name: string) {
  const url = `http://127.0.0.1:${port(name, 8081)}/readyz`;
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(url)).status === 200) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  fail(`${name} never became ready:\n${docker("logs", name)}`);
}

async function relay(name: string, requestId: string) {
  const clients = createClientFactory({
    caller: "web",
    keys: serviceKeysFrom(serviceKey),
    serviceName: serviceNameOf,
    resolveUrl: () => `http://127.0.0.1:${port(name, 8080)}`,
  });
  return clients.client(SampleRelayService).relay({ message: `hello ${name}` }, startCall({ requestId }));
}

async function main() {
  docker("network", "create", net);
  try {
    run(names.echo, "echo-1", ["SERVICES=sample"]);
    run(names.relay, "relay-1", ["SERVICES=sample-relay", `SERVICE_URL_SAMPLE=http://${names.echo}:8080`]);
    run(names.cohost, "cohost-1", ["SERVICES=sample,sample-relay"]);
    await Promise.all(Object.values(names).map(ready));

    const across = await relay(names.relay, `smoke-${id}-across`);
    if (across.transport !== "http2" || across.echoServedBy !== "echo-1" || across.relayServedBy !== "relay-1")
      fail(`relay across containers: ${JSON.stringify(across)}`);
    console.log(`two containers: relay-1 -> echo-1 over ${across.transport}`);

    const echoLog = docker("logs", names.echo)
      .split("\n")
      .filter((l) => l.includes(`smoke-${id}-across`))
      .map((l) => JSON.parse(l) as Record<string, unknown>);
    if (echoLog.length !== 1 || echoLog[0]!["caller"] !== "sample-relay" || echoLog[0]!["depth"] !== 2 || echoLog[0]!["code"] !== "ok")
      fail(`echo's log line for the relayed call: ${JSON.stringify(echoLog)}`);
    console.log("echo-1 logged the call: caller sample-relay, depth 2, same request id");

    const together = await relay(names.cohost, `smoke-${id}-cohost`);
    if (together.transport !== "memory" || together.echoServedBy !== "cohost-1" || together.relayServedBy !== "cohost-1")
      fail(`co-hosted relay: ${JSON.stringify(together)}`);
    console.log(`co-hosted: cohost-1 -> cohost-1 in ${together.transport}`);

    const probe = docker("exec", names.relay, "/nodejs/bin/node", "host.mjs", "call", "sample", "Echo", '{"message":"probe"}', "--url", `http://${names.echo}:8080`, "--as", "sample-relay");
    const reply = JSON.parse(probe) as { message: string; servedBy: string };
    if (reply.message !== "probe" || reply.servedBy !== "echo-1") fail(`probe: ${probe}`);
    console.log("operator probe inside relay-1 reached echo-1 over HTTP/2");

    // Password hashing must work inside the distroless image (Argon2id runs as WebAssembly, no native module).
    const check = JSON.parse(docker("run", "--rm", image, "host.mjs", "selfcheck")) as { ok: boolean; argon2id_ms: number };
    if (!check.ok) fail(`selfcheck: ${JSON.stringify(check)}`);
    console.log(`selfcheck inside the image: Argon2id hash and verify in ${check.argon2id_ms} ms`);
    console.log("smoke: ok");
  } finally {
    for (const name of Object.values(names)) {
      try {
        docker("rm", "-f", name);
      } catch {
        // already gone
      }
    }
    docker("network", "rm", net);
  }
}

await main();
