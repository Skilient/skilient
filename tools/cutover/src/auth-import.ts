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

/** Identity owns the writes to its schema; the cutover tool only hands it the parsed export. */
export { importTotpFactors, importUsers, type ImportReport, type TotpImportReport } from "@skilient/identity/store/import";
