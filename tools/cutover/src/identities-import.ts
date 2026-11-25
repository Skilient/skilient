import { z } from "zod";

/**
 * Google identities import (decision 2026-11-25: 8 Google-only accounts and 1 linked account are mapped to
 * their provider identities at cutover). Supabase `auth.identities` rows, exported under the same two-person
 * review as `auth.users`, one JSON object per line:
 *   { "provider": "google", "provider_id": "<Google sub>", "user_id": "<uuid>", "email": "<address or null>" }
 * `identity_data` may be present and is ignored (it holds names). Nothing here reads production.
 * The writes are identity's (`services/identity/src/store/import-identities.ts`).
 */
export const ExportedIdentity = z.object({
  provider: z.string().min(1).max(40),
  provider_id: z.string().min(1).max(255),
  user_id: z.uuid(),
  email: z.string().max(320).nullable().optional(),
});
export type ExportedIdentity = z.infer<typeof ExportedIdentity>;

export interface ParsedIdentity {
  provider: string;
  providerUserId: string;
  userId: string;
  email: string | null;
}

export function parseIdentities(jsonl: string): ParsedIdentity[] {
  const out: ParsedIdentity[] = [];
  const seen = new Set<string>();
  for (const [i, line] of jsonl.split("\n").entries()) {
    if (line.trim() === "") continue;
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      throw new Error(`identities line ${i + 1}: not JSON`);
    }
    const parsed = ExportedIdentity.safeParse(value);
    if (!parsed.success) throw new Error(`identities line ${i + 1}: ${parsed.error.issues[0]?.path.join(".") ?? "invalid"}`);
    const key = `${parsed.data.provider}:${parsed.data.provider_id}`;
    if (seen.has(key)) throw new Error(`identities line ${i + 1}: duplicate ${parsed.data.provider} identity`);
    seen.add(key);
    out.push({ provider: parsed.data.provider, providerUserId: parsed.data.provider_id, userId: parsed.data.user_id, email: parsed.data.email ?? null });
  }
  return out;
}

/** Google rows per account: an account with two Google identities would be refused by identity, so it is caught here. */
export function googleAccounts(rows: readonly ParsedIdentity[]): { accounts: number; duplicates: string[] } {
  const per = new Map<string, number>();
  for (const r of rows) if (r.provider === "google") per.set(r.userId, (per.get(r.userId) ?? 0) + 1);
  return { accounts: per.size, duplicates: [...per].filter(([, n]) => n > 1).map(([id]) => id) };
}
