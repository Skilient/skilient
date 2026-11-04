export type YearbookState = "none" | "open" | "voting" | "counting" | "revealed" | "frozen";

/** Wording for each yearbook state (PRD 5.33). Client-safe. */
export const STATE_LINES: Record<Exclude<YearbookState, "none">, (d: { voteOpensLabel: string; voteClosesLabel: string; freezesLabel: string }) => string> = {
  open: (d) => `Sign your friends' pages; approve the notes on yours. The superlative vote opens ${d.voteOpensLabel}. The book freezes on ${d.freezesLabel}.`,
  voting: (d) => `The superlative vote is open until ${d.voteClosesLabel}. Votes are secret; only winners are shown. The book freezes on ${d.freezesLabel}.`,
  counting: (d) => `The vote has closed and winners are being told; titles are revealed soon. The book freezes on ${d.freezesLabel}.`,
  revealed: (d) => `The superlatives are out. Keep signing until ${d.freezesLabel}, when the book freezes.`,
  frozen: () => "Frozen at graduation: read-only, kept for your batch forever. Download your page as a PDF from My page.",
};
