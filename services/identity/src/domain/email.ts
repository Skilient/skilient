/** `private.email_domain`: the part after the last `@`, lower-cased; null when there is none. */
export function emailDomain(email: string | null | undefined): string | null {
  if (email == null) return null;
  const m = /@([^@]+)$/.exec(email.replace(/^ +| +$/g, ""));
  const domain = m?.[1]?.toLowerCase() ?? "";
  return domain === "" ? null : domain;
}
