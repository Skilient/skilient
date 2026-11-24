/**
 * Which container hosts which service at the floor (deploy/modules/apps.bicep,
 * docs/azure/prd.md "Resources at the floor"). A caller reaches a service it
 * does not host at `SERVICE_URL_<NAME>` if set, else at its container's URL.
 */
export const placement: Readonly<Record<string, "core-a" | "core-b" | "realtime">> = {
  identity: "core-a",
  people: "core-a",
  content: "core-a",
  notify: "core-a",
  trust: "core-a",
  media: "core-a",
  messaging: "core-b",
  work: "core-b",
  ranking: "core-b",
  community: "core-b",
  credentials: "core-b",
  market: "core-b",
  billing: "core-b",
  realtime: "realtime",
};

const groupEnv = { "core-a": "CORE_A_URL", "core-b": "CORE_B_URL", realtime: "REALTIME_URL" } as const;

export function serviceUrlEnv(name: string): string {
  return "SERVICE_URL_" + name.toUpperCase().replace(/-/g, "_");
}

export function resolveUrl(name: string, env: NodeJS.ProcessEnv = process.env): string | undefined {
  const explicit = env[serviceUrlEnv(name)];
  if (explicit) return explicit;
  const group = placement[name];
  return group ? env[groupEnv[group]] : undefined;
}
