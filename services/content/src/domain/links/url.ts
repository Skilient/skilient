import { createHash } from "node:crypto";

/**
 * The post's link (the `posts_link_url` trigger): the first http(s) URL in the text, without trailing
 * punctuation, at most 2,000 characters; and `url_hash`, the preview cache's key (sha256, hex).
 */
export function extractLink(body: string): string | null {
  const m = /(https?:\/\/[^\s<>"']+)/.exec(body);
  if (!m) return null;
  const url = m[1]!.replace(/[.,;:!?)\]]+$/, "").slice(0, 2000);
  return url === "" ? null : url;
}

export const urlHash = (url: string): string => createHash("sha256").update(url, "utf8").digest("hex");
