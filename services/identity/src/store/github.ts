import { refuse, uuidv7 } from "@skilient/platform";
import type postgres from "postgres";

/**
 * Identity's half of linking and unlinking GitHub (decision 2026-11-25: work's writes into identity data go
 * through identity commands). `work` owns the GitHub account, tokens and installations; identity records
 * the security event the user sees in Settings, as `private.complete_github_link` and `disconnect_github`
 * did. The login is a public handle, so it may sit in the security event's meta (never in an event payload).
 */
type Tx = postgres.TransactionSql;

/** GitHub's own login rule: 1 to 39 letters, digits or single hyphens, not starting or ending with one. */
export const GITHUB_LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;

export async function recordGithubEvent(tx: Tx, input: { userId: string; login: string; kind: "github_connected" | "github_disconnected" }): Promise<void> {
  if (!GITHUB_LOGIN.test(input.login)) throw refuse("invalid_input", "invalid GitHub login");
  const [user] = await tx`select 1 from identity.users where id = ${input.userId}`;
  if (!user) throw refuse("not_found", "account not found");
  const done = await tx`
    insert into identity.security_events (id, user_id, kind, meta)
    values (${uuidv7()}, ${input.userId}, ${input.kind}, ${JSON.stringify({ login: input.login })}::text::jsonb)`;
  if (done.count !== 1) throw refuse("conflict", "security event not recorded");
}
