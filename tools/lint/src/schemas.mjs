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
 * A pattern matching `schema.` for any of the given schemas, not inside a
 * longer name or path, and not a file name such as `people.json`.
 */
export function foreignPattern(schemas) {
  if (schemas.length === 0) return null;
  const files = "(?:json|ts|tsx|mts|mjs|cjs|js|sql|md|proto|ya?ml|txt|csv|pdf|local)\\b";
  return new RegExp(`(?<![\\w.$/@-])"?(${schemas.join("|")})"?\\s*\\.\\s*(?!${files})"?[a-z_]`, "i");
}
