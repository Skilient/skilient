import type postgres from "postgres";

/**
 * Identity's side of importing Supabase `auth.identities` at cutover (decision 2026-11-25: the 8 Google-only
 * accounts, and the one linked account, keep signing in with Google). tools/cutover parses the export and
 * hands the rows here. Rows of other providers (`email`) are counted and skipped. If any Google identity
 * names an account that was not imported, nothing is written, so no account is left half-mapped.
 */
export interface ImportedIdentity {
  provider: string;
  /** Google's subject (`sub`), from `auth.identities.provider_id`. */
  providerUserId: string;
  userId: string;
  email: string | null;
}

export interface IdentityImportReport {
  identities: number;
  /** Rows of other providers (email), not imported. */
  skipped: number;
  /** User ids the Google rows name that identity does not have; non-empty means nothing was written. */
  missingUsers: string[];
}

export async function importIdentities(sql: postgres.Sql, rows: readonly ImportedIdentity[]): Promise<IdentityImportReport> {
  const google = rows.filter((r) => r.provider === "google");
  const report: IdentityImportReport = { identities: 0, skipped: rows.length - google.length, missingUsers: [] };
  if (google.length === 0) return report;
  await sql.begin(async (tx) => {
    const wanted = [...new Set(google.map((r) => r.userId))];
    const found = await tx<{ id: string }[]>`select id::text from identity.users where id = any(${wanted}::uuid[])`;
    const have = new Set(found.map((r) => r.id));
    report.missingUsers = wanted.filter((id) => !have.has(id));
    if (report.missingUsers.length) return;
    for (const r of google) {
      const done = await tx`
        insert into identity.identities (provider, provider_user_id, user_id, email_at_link)
        values ('google', ${r.providerUserId}, ${r.userId}, ${r.email?.trim().toLowerCase() ?? null})
        on conflict do nothing`;
      report.identities += done.count;
    }
  });
  return report;
}
