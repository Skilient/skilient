/**
 * Event obligations (packages/contracts/events.json). Every service in services/ declares what it publishes
 * and handles in src/events.ts; this keeps the declarations, the registry and the code in step:
 *   - a service publishes or handles only event types the registry lists for it;
 *   - once a service exists, it publishes and handles everything the registry says it owes (so W3-W12 cannot
 *     land without the events identity and people already wait for);
 *   - every `type: "noun.verb"` literal in a service's code is in its declared `publishes`.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PRD_SERVICES } from "../src/schemas.mjs";

const root = join(import.meta.dirname, "../../..");
const registry = JSON.parse(readFileSync(join(root, "packages/contracts/events.json"), "utf8")) as {
  events: Record<string, { producers: string[]; consumers: string[] }>;
};
const services = readdirSync(join(root, "services")).filter((d) => existsSync(join(root, "services", d, "src")));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? sourceFiles(p) : p.endsWith(".ts") && !p.endsWith("events.ts") ? [p] : [];
  });
}

describe("event registry", () => {
  it("names only services the PRD defines", () => {
    for (const [type, e] of Object.entries(registry.events))
      for (const s of [...e.producers, ...e.consumers]) expect(PRD_SERVICES, `${type}: ${s}`).toContain(s);
  });

  it("every service declares its events in src/events.ts", () => {
    for (const s of services) expect(existsSync(join(root, "services", s, "src/events.ts")), s).toBe(true);
  });
});

// Loading a service's events.ts pulls in its store modules; allow for a loaded machine.
describe.each(services)("%s", { timeout: 30_000 }, (service) => {
  const load = async () =>
    ((await import(join(root, "services", service, "src/events.ts"))) as { events: { publishes: readonly string[]; handles: readonly string[] } }).events;

  it("publishes and handles only what the registry lists for it", async () => {
    const { publishes, handles } = await load();
    for (const t of publishes) expect(registry.events[t]?.producers ?? [], `${service} publishes ${t}`).toContain(service);
    for (const t of handles) expect(registry.events[t]?.consumers ?? [], `${service} handles ${t}`).toContain(service);
  });

  it("publishes and handles everything it owes", async () => {
    const { publishes, handles } = await load();
    for (const [t, e] of Object.entries(registry.events)) {
      if (e.producers.includes(service)) expect(publishes, `${service} owes publishing ${t}`).toContain(t);
      if (e.consumers.includes(service)) expect(handles, `${service} owes handling ${t}`).toContain(t);
    }
  });

  it("declares every event type its code writes", async () => {
    const { publishes } = await load();
    for (const file of sourceFiles(join(root, "services", service, "src")))
      for (const m of readFileSync(file, "utf8").matchAll(/type:\s*"([a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+)"/g))
        expect(publishes, `${file.slice(root.length + 1)} writes ${m[1]}`).toContain(m[1]);
  });
});
