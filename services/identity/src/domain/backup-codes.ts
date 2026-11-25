/** `private.normalize_backup_code`: letters and digits only, lower-cased. */
export function normalizeBackupCode(code: string | null | undefined): string {
  return (code ?? "").replace(/[^0-9A-Za-z]/g, "").toLowerCase();
}
