/**
 * The published agreement body holds the user agreement and the privacy notice, one after the
 * other (docs/legal/user-agreement-and-privacy-notice.md). /terms shows the first part and
 * /privacy the second, so Google's privacy policy page is its own URL with its own text.
 */
export const PRIVACY_HEADING = "## Privacy notice";

export interface AgreementParts {
  /** The user agreement (headings 1 to 14). */
  agreement: string;
  /** The privacy notice (P1 onwards), or null when the body has no privacy part yet. */
  privacy: string | null;
}

export function splitAgreement(body: string): AgreementParts {
  const marker = `\n${PRIVACY_HEADING}\n`;
  const at = body.indexOf(marker);
  if (at === -1) return { agreement: body.trim(), privacy: null };
  return {
    agreement: body.slice(0, at).trim(),
    privacy: body.slice(at + marker.length).trim(),
  };
}
