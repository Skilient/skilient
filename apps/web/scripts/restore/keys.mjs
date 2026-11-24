// Prints one of a project's API keys: node keys.mjs <project-ref> secret|publishable. Masked by the workflow.
import { management, publishableKey, serviceKey } from "./lib.mjs";

const [ref, kind] = process.argv.slice(2);
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!ref || !token || !["secret", "publishable"].includes(kind)) {
  console.error("usage: SUPABASE_ACCESS_TOKEN=… node keys.mjs <ref> secret|publishable");
  process.exit(2);
}
const keys = await management(`/v1/projects/${ref}/api-keys?reveal=true`, token);
process.stdout.write(kind === "secret" ? serviceKey(keys) : publishableKey(keys));
