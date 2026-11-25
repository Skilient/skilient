import { z } from "zod";

/**
 * Auth import (prd.md, "tools/cutover": auth import; "At cutover"): Supabase `auth.users` rows, exported
 * under two-person review (setup checklist section 5), become identity users with their password hashes
 * kept exactly as they are. Nothing here reads production: the export is a file handed to this tool.
 *
 * Export format: one JSON object per line with the columns below, as `auth.users` stores them.
 */
export const ExportedUser = z.object({
  id: z.uuid(),
  email: z.string().min(3),
  encrypted_password: z.string().nullable(),
  email_confirmed_at: z.string().nullable(),
  created_at: z.string(),
  last_sign_in_at: z.string().nullable(),
  banned_until: z.string().nullable(),
});
export type ExportedUser = z.infer<typeof ExportedUser>;

export function parseExport(jsonl: string): ExportedUser[] {
  return jsonl
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line, i) => {
      const parsed = ExportedUser.safeParse(JSON.parse(line));
      if (!parsed.success) throw new Error(`export line ${i + 1}: ${parsed.error.issues[0]?.message ?? "invalid"}`);
      return parsed.data;
    });
}

/**
 * Supabase `auth.mfa_factors` rows, exported the same way (one JSON object per line). The TOTP secret is
 * base32 text as Supabase stores it; identity encrypts it on import (prd.md, "Two-factor").
 */
export const ExportedFactor = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  factor_type: z.string().min(1),
  status: z.string().min(1),
  secret: z.string().nullable(),
});
export type ExportedFactor = z.infer<typeof ExportedFactor>;

export function parseFactorExport(jsonl: string): ExportedFactor[] {
  return parseLines(jsonl, ExportedFactor, "factor export");
}

function parseLines<T>(jsonl: string, schema: z.ZodType<T>, what: string): T[] {
  return jsonl
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line, i) => {
      const parsed = schema.safeParse(JSON.parse(line));
      // The message names the field only, never its value (a secret).
      if (!parsed.success) throw new Error(`${what} line ${i + 1}: ${parsed.error.issues[0]?.path.join(".") ?? ""} ${parsed.error.issues[0]?.code ?? "invalid"}`);
      return parsed.data;
    });
}

/** Supabase `public.personal_email_domains` rows, one JSON object per line: `{"domain": "gmail.com"}`. */
export const ExportedPersonalDomain = z.object({ domain: z.string().min(3).max(253) });
export type ExportedPersonalDomain = z.infer<typeof ExportedPersonalDomain>;

export function parsePersonalDomainExport(jsonl: string): string[] {
  return parseLines(jsonl, ExportedPersonalDomain, "personal domain export").map((r) => r.domain);
}

/** Identity owns the writes to its schema; the cutover tool only hands it the parsed export. */
export { importPersonalDomains, importTotpFactors, importUsers, type ImportReport, type TotpImportReport } from "@skilient/identity/store/import";

/** Supabase `public.sanctions` rows; identity keeps the user ones (`importSanctionMarks`). */
export const ExportedSanction = z.object({
  id: z.uuid(),
  user_id: z.uuid().nullable(),
  kind: z.string(),
  until: z.string().nullable(),
  reason: z.string(),
  staff_id: z.uuid(),
  created_at: z.string(),
  lifted_at: z.string().nullable(),
  lifted_by: z.uuid().nullable(),
  lift_reason: z.string().nullable(),
});
export type ExportedSanction = z.infer<typeof ExportedSanction>;

export function parseSanctionExport(jsonl: string): ExportedSanction[] {
  return jsonl
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line, i) => {
      const parsed = ExportedSanction.safeParse(JSON.parse(line));
      if (!parsed.success) throw new Error(`sanctions line ${i + 1}: ${parsed.error.issues[0]?.message ?? "invalid"}`);
      return parsed.data;
    });
}

export { importSanctionMarks } from "@skilient/identity/store/import";
