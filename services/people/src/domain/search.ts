/** Search helpers, pure (ported from `private.prefix_tsquery` and `private.contains_pattern`). */

/**
 * The text of the prefix query `prefix_tsquery` built: up to 8 words of at least 2 letters or digits from
 * the first 100 characters, each as a quoted prefix, joined with &. Null when there are none. Passed to
 * `to_tsquery('simple', ...)` by the store.
 */
export function prefixQuery(q: string | null | undefined): string | null {
  const words = (q ?? "")
    .slice(0, 100)
    .split(/[^\p{L}\p{N}]+/u)
    .map((w) => w.toLowerCase())
    .filter((w) => [...w].length >= 2)
    .slice(0, 8);
  if (words.length === 0) return null;
  return words.map((w) => `'${w.replace(/'/g, "''")}':*`).join(" & ");
}

/** `contains_pattern`: an ILIKE pattern that matches the trimmed text anywhere, with \ % _ escaped. */
export function containsPattern(q: string | null | undefined): string {
  const t = (q ?? "").replace(/^ +| +$/g, "");
  return `%${t.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
}

/** `btrim(coalesce(q, ''))` as search_people read it. */
export function trimmed(q: string | null | undefined): string {
  return (q ?? "").replace(/^ +| +$/g, "");
}
