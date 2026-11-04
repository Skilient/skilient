import { createClient } from "@supabase/supabase-js";

/**
 * The recruiter and university portals are off by flag since phase 14 (platform_config
 * `portals.enabled`). Their own specs are tagged @portals and run in a second pass
 * (`pnpm test:e2e:portals`) with the flag switched on here and back off in the teardown, so the
 * main pass never sees it flip. platform_config is append-only: each switch is a new version.
 */
export async function setPortals(open: boolean) {
  const url = process.env.E2E_SUPABASE_URL ?? "http://127.0.0.1:54321";
  const key = process.env.E2E_SUPABASE_SECRET_KEY;
  if (!key) throw new Error("E2E_SUPABASE_SECRET_KEY is needed to switch the portals flag");
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await db.from("platform_config").select("version").eq("key", "portals.enabled").order("version", { ascending: false }).limit(1);
  if (error) throw new Error(`portals flag: ${error.message}`);
  const version = (data?.[0]?.version ?? 0) + 1;
  const value = { recruiter: open, university: open, faculty: true };
  const { error: insertError } = await db
    .from("platform_config")
    .insert({ key: "portals.enabled", version, value, reason: open ? "E2E: @portals pass" : "E2E: @portals pass finished" });
  if (insertError) throw new Error(`portals flag: ${insertError.message}`);
}

export default async function globalSetup() {
  if (process.env.E2E_PORTALS === "1") await setPortals(true);
}
