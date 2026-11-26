/**
 * A message's link (the `chat_messages_link_url` trigger, the same rule as posts): the first http(s) URL in
 * the text, without trailing punctuation, at most 2,000 characters.
 */
export function extractLink(body: string): string | null {
  const m = /(https?:\/\/[^\s<>"']+)/.exec(body);
  if (!m) return null;
  const url = m[1]!.replace(/[.,;:!?)\]]+$/, "").slice(0, 2000);
  return url === "" ? null : url;
}

/** The chat list's and reply preview's line for a message. */
export function excerpt(m: { deleted: boolean; body: string; shared: boolean }, chars = 140): string {
  if (m.deleted) return "Message deleted";
  if (m.body === "" && m.shared) return "Shared a post";
  if (m.body === "") return "Image";
  return m.body.slice(0, chars);
}
