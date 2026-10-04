// Prints a project's session-pooler connection string: node db-url.mjs <project-ref> <password-env-var>.
// The workflow masks the output before using it.
import { management, poolerUrl } from "./lib.mjs";

const [ref, passwordVar] = process.argv.slice(2);
const token = process.env.SUPABASE_ACCESS_TOKEN;
const password = process.env[passwordVar ?? ""];
if (!ref || !token || !password) {
  console.error("usage: SUPABASE_ACCESS_TOKEN=… <PASSWORD_VAR>=… node db-url.mjs <ref> <PASSWORD_VAR>");
  process.exit(2);
}
process.stdout.write(poolerUrl(await management(`/v1/projects/${ref}/config/database/pooler`, token), password));
