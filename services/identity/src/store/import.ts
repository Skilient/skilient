import type postgres from "postgres";
import { hashAlgorithm } from "../domain/password";
import { base32Decode, encryptTotpSecret } from "../domain/totp";

/**
 * Identity's side of the auth import (prd.md, "At cutover"; tools/cutover parses the export and calls this).
 * Users and their password hashes are written exactly as Supabase stored them. An unknown hash format stops
 * the whole import before anything is written, so no account is left unable to sign in.
 */
export interface ImportedUser {
  id: string;
  email: string;
  encrypted_password: string | null;
  email_confirmed_at: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  banned_until: string | null;
}

export interface ImportReport {
  users: number;
  passwords: number;
  /** Accounts with no password (Google sign-in only). */
  withoutPassword: number;
  unknownHashes: string[];
}

export async function importUsers(sql: postgres.Sql, users: readonly ImportedUser[]): Promise<ImportReport> {
  const unknownHashes = users.filter((u) => u.encrypted_password && !hashAlgorithm(u.encrypted_password)).map((u) => u.id);
  const report: ImportReport = { users: 0, passwords: 0, withoutPassword: 0, unknownHashes };
  if (unknownHashes.length) return report;
  await sql.begin(async (tx) => {
    for (const u of users) {
      const inserted = await tx`
        insert into identity.users (id, email, email_confirmed_at, created_at, last_sign_in_at, banned_until)
        values (${u.id}, ${u.email.trim().toLowerCase()}, ${u.email_confirmed_at}, ${u.created_at}, ${u.last_sign_in_at}, ${u.banned_until})
        on conflict (id) do nothing`;
      report.users += inserted.count;
      if (!u.encrypted_password) {
        report.withoutPassword++;
        continue;
      }
      const stored = await tx`
        insert into identity.password_credentials (user_id, hash, algorithm, imported)
        values (${u.id}, ${u.encrypted_password}, ${hashAlgorithm(u.encrypted_password)!}, true)
        on conflict (user_id) do nothing`;
      report.passwords += stored.count;
    }
  });
  return report;
}

/**
 * Supabase `auth.mfa_factors` rows (prd.md, "Two-factor": existing authenticator secrets are imported so
 * nobody re-enrols). Supabase keeps the TOTP secret as base32 text; identity stores it encrypted with
 * `identity-totp-key` (decision Q10). Only verified TOTP factors come across (an unfinished set-up is
 * dropped). A secret that is not plain base32 (for example one Supabase encrypted itself) stops the whole
 * import before anything is written. Run after `importUsers`; a factor whose account is missing is skipped
 * and reported.
 */
export interface ImportedTotpFactor {
  id: string;
  user_id: string;
  factor_type: string;
  status: string;
  secret: string | null;
}

export interface TotpImportReport {
  factors: number;
  /** Not verified TOTP factors (unverified, or another factor type): not imported. */
  skipped: number;
  /** Factors whose account is not in identity: not imported. */
  orphans: string[];
  /** Factors whose secret is not base32: nothing was imported. */
  unknownSecrets: string[];
}

export async function importTotpFactors(sql: postgres.Sql, totpKey: Buffer, factors: readonly ImportedTotpFactor[]): Promise<TotpImportReport> {
  const wanted = factors.filter((f) => f.factor_type === "totp" && f.status === "verified");
  const report: TotpImportReport = { factors: 0, skipped: factors.length - wanted.length, orphans: [], unknownSecrets: [] };
  const secrets = new Map<string, Buffer>();
  for (const f of wanted) {
    const bytes = f.secret && /^[A-Za-z2-7]+=*$/.test(f.secret) ? base32Decode(f.secret) : null;
    if (!bytes || bytes.length < 10) report.unknownSecrets.push(f.id);
    else secrets.set(f.id, bytes);
  }
  if (report.unknownSecrets.length) return report;
  await sql.begin(async (tx) => {
    const known = new Set(
      (await tx<{ id: string }[]>`select id::text from identity.users where id = any(${wanted.map((f) => f.user_id)}::uuid[])`).map((r) => r.id),
    );
    for (const f of wanted) {
      if (!known.has(f.user_id.toLowerCase())) {
        report.orphans.push(f.id);
        continue;
      }
      const stored = await tx`
        insert into identity.totp_factors (id, user_id, secret_ciphertext, status, verified_at)
        values (${f.id}, ${f.user_id}, ${encryptTotpSecret(totpKey, secrets.get(f.id)!, f.id)}, 'verified', now())
        on conflict (id) do nothing`;
      report.factors += stored.count;
    }
  });
  return report;
}

/**
 * Supabase `public.personal_email_domains` rows (W1 follow-up closed in W2, decision 2026-11-25): the public
 * email providers' domains the signup gate refuses. Only tests seeded the list before; production fills it
 * here at cutover. Domains are lower-cased; existing rows are kept. Returns how many were added.
 */
export async function importPersonalDomains(sql: postgres.Sql, domains: readonly string[]): Promise<number> {
  const clean = [...new Set(domains.map((d) => d.trim().toLowerCase()))];
  const bad = clean.filter((d) => !/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/.test(d));
  if (bad.length) throw new Error(`personal domain import: ${bad.length} malformed domain(s); nothing imported`);
  if (clean.length === 0) return 0;
  const done = await sql`
    insert into identity.personal_email_domains (domain) select unnest(${clean}::text[]) on conflict (domain) do nothing`;
  return done.count;
}
