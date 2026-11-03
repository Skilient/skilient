import type { RecordKind } from "./types";

/** Wording for the Record (PRD 5.30). Client-safe. */
export const KIND_LABELS: Record<RecordKind, string> = {
  attended: "Attended",
  completed: "Completed",
  result: "Result",
  office_bearer: "Office bearer",
  volunteer: "Volunteer",
  venture_completed: "Venture completed",
  taught: "Taught",
  proof_task: "Proof task",
};

/** The kinds the ledger can be filtered by, in the stat tiles' order. */
export const KIND_ORDER: RecordKind[] = ["office_bearer", "result", "volunteer", "completed", "attended", "venture_completed", "taught", "proof_task"];

export const REVOKE_CATEGORIES = [
  { value: "issued_in_error", label: "Issued in error" },
  { value: "not_earned", label: "Not earned" },
  { value: "misconduct", label: "Misconduct" },
  { value: "other", label: "Other" },
] as const;

export function revokeCategoryLabel(value: string | null | undefined): string {
  return REVOKE_CATEGORIES.find((c) => c.value === value)?.label ?? "Other";
}

/** Academic years run September to August: 2026 is "2026–27". */
export function academicYearLabel(year: number): string {
  return `${year}–${String((year + 1) % 100).padStart(2, "0")}`;
}

export function academicYearOf(isoDate: string): number {
  const [y, m] = isoDate.split("-").map(Number);
  return m >= 9 ? y : y - 1;
}

export const STATUS_LABELS: Record<string, string> = {
  awaiting: "Waiting for a second officer",
  pending: "Signing…",
  sealed: "Sealed",
  revoked: "Revoked",
  superseded: "Superseded",
};

/** Merit kinds that can add rank (formula v2); attendance never does. */
export const RANKED_KINDS: RecordKind[] = ["office_bearer", "result", "volunteer"];
