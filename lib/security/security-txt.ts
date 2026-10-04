/**
 * RFC 9116 security.txt (PRD 10 "Reporting and response"). Expires must be moved forward before it lapses:
 * tests/unit/security-hardening.test.ts fails 60 days ahead, so it is bumped in an ordinary pull request.
 */
export const SECURITY_CONTACT = "mailto:security@skilient.com";
export const SECURITY_TXT_EXPIRES = "2027-09-30T00:00:00.000Z";

export function securityTxt(site: string): string {
  return [
    `Contact: ${SECURITY_CONTACT}`,
    `Expires: ${SECURITY_TXT_EXPIRES}`,
    "Preferred-Languages: en",
    `Canonical: ${site}/.well-known/security.txt`,
    "",
  ].join("\n");
}
