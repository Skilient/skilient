/**
 * `prefix_tsquery(q)` as messaging ported it (services/messaging/src/store/messages.ts): up to 8 words of 2+
 * letters or digits, each a prefix match, all required. Null when nothing is left.
 */
export function prefixQuery(q: string): string | null {
  const words = q
    .slice(0, 100)
    .split(/[^\p{L}\p{N}]+/u)
    .map((w) => w.toLowerCase())
    .filter((w) => w.length >= 2)
    .slice(0, 8);
  return words.length ? words.map((w) => `'${w.replace(/'/g, "''")}':*`).join(" & ") : null;
}

/** `contains_pattern(q)`: an ILIKE pattern for q anywhere, with \, % and _ escaped. */
export const containsPattern = (q: string) => `%${q.trim().replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
