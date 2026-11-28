import { refuse, type Refusal, type RefusalKind } from "@skilient/platform";

/**
 * Every refusal media gives: a short reason (x-refusal), its kind, and the wording web shows (W13). The stack's
 * storage policies refused with a row-level security violation (42501) and its bucket limits with Storage API
 * errors; the reasons here name which rule refused.
 */
export const REFUSALS = {
  not_signed_in: { kind: "not_signed_in", text: "sign in first" },
  invalid_input: { kind: "invalid_input", text: "invalid input" },
  unknown_bucket: { kind: "invalid_input", text: "unknown bucket" },
  file_type: { kind: "invalid_input", text: "that type of file isn't allowed here" },
  file_size: { kind: "invalid_input", text: "that file is too large" },
  not_your_folder: { kind: "not_allowed", text: "upload into your own folder" },
  folder_needed: { kind: "invalid_input", text: "say which chat, event, society or organisation the file is for" },
  too_many_files: { kind: "too_many", text: "too many files here: remove one first" },
  path_taken: { kind: "precondition", text: "that file already exists" },
  staff_only: { kind: "not_allowed", text: "staff only, with two-factor on" },
} as const satisfies Record<string, { kind: RefusalKind; text: string }>;

export type RefusalReason = keyof typeof REFUSALS;

export function refused(reason: RefusalReason): Refusal {
  return refuse(REFUSALS[reason].kind, reason);
}
