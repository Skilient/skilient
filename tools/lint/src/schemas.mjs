import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Every service in docs/azure/prd.md ("Service catalogue"); each owns the schema of the same name. */
export const PRD_SERVICES = [
  "identity", "people", "content", "messaging", "work", "ranking", "community",
  "credentials", "notify", "trust", "market", "billing", "realtime", "media",
];

export const schemaOf = (service) => service.replace(/-/g, "_");

/** The PRD's services plus any folder under services/. */
export function serviceNames(root) {
  const dir = join(root, "services");
  const found = existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) : [];
  return [...new Set([...PRD_SERVICES, ...found])].sort();
}

/** The service that owns a file, from its path (services/<name>/...), or null. */
export function ownerOf(filename) {
  const m = /(?:^|[\\/])services[\\/]([a-z][a-z0-9-]*)[\\/]/.exec(filename);
  return m ? m[1] : null;
}

/**
 * Platform config keys that share their first part with a service's name. They are names of settings (trust's
 * config, copied by the services that read them), never tables, so the schema rule skips them (decisions.md, W9).
 */
export const CONFIG_KEYS = ["ranking.formula"];

/**
 * A pattern matching `schema.` for any of the given schemas, not inside a
 * longer name or path, and not a file name such as `people.json`. SQL names
 * here are lowercase and written with no space around the dot, so prose such as
 * "this month's work. It" is not a schema reference (decisions.md, W9).
 */
export function foreignPattern(schemas) {
  if (schemas.length === 0) return null;
  const files = "(?:json|ts|tsx|mts|mjs|cjs|js|sql|md|proto|ya?ml|txt|csv|pdf|local)\\b";
  return new RegExp(`(?<![\\w.$/@-])"?(${schemas.join("|")})"?\\.(?!${files})"?[a-z_]`, "g");
}

/** The first match of `pattern` in `text` that is not a known config key, or null. */
export function firstForeign(pattern, text) {
  pattern.lastIndex = 0;
  for (const m of text.matchAll(pattern)) {
    const word = /^[a-z_]+\.[a-z_]+/.exec(text.slice(m.index).replace(/"/g, ""))?.[0];
    if (word && CONFIG_KEYS.includes(word)) continue;
    return m;
  }
  return null;
}
