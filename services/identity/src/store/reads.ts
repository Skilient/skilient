import type postgres from "postgres";

/** The newest published agreement version, or 0 (`private.current_agreement_version`). */
export async function currentAgreementVersion(db: postgres.Sql | postgres.TransactionSql): Promise<number> {
  const [row] = await db<{ v: number | null }[]>`
    select max(version) as v from identity.agreement_versions where published_at is not null and published_at <= now()`;
  return row?.v ?? 0;
}

/** Staff roles for many users in one round trip (`private.staff_roles_of`, batched). */
export async function staffRolesOf(db: postgres.Sql, userIds: readonly string[]): Promise<Map<string, string[]>> {
  const rows = await db<{ user_id: string; roles: string[] }[]>`
    select user_id::text, array_agg(role order by role) as roles from identity.staff_roles
     where user_id = any(${[...userIds]}::uuid[]) group by user_id`;
  return new Map(rows.map((r) => [r.user_id, r.roles]));
}

/** `private.mfa_backup_codes_remaining`. */
export async function backupCodesRemaining(db: postgres.Sql, userId: string): Promise<number> {
  const [row] = await db<{ n: number }[]>`
    select count(*)::int as n from identity.mfa_backup_codes where user_id = ${userId} and used_at is null`;
  return row!.n;
}

/** The user's recent security events for Settings → Security: newest first, at most 20, no IP hashes. */
export async function recentSecurityEvents(db: postgres.Sql, userId: string) {
  return db<{ kind: string; at: string; user_agent: string | null; method: string | null; new_device: boolean }[]>`
    select kind, created_at::text as at, user_agent, meta ->> 'method' as method, coalesce((meta ->> 'new_device')::boolean, false) as new_device
      from identity.security_events where user_id = ${userId} order by created_at desc limit 20`;
}

/** The user's verified authenticators (never the secrets). */
export async function verifiedAuthenticators(db: postgres.Sql, userId: string) {
  return db<{ id: string; created_at: string; verified_at: string | null }[]>`
    select id::text, created_at::text, verified_at::text from identity.totp_factors
     where user_id = ${userId} and status = 'verified' order by created_at`;
}
