import "server-only";

import { getPostCards } from "@/lib/data/posts";

/**
 * Share-to-chat (PRD 5.34): a shared post's card, built for the reader by post_cards, which only
 * returns posts the reader may see (can_view_post). A post that isn't returned (another university's
 * university post, a block, a removal, a deletion) renders as "This post isn't available".
 */
export type SharedPreview =
  | { available: true; postId: string; authorName: string; authorUsername: string | null; excerpt: string; timeLabel: string; imageCount: number }
  | { available: false };

export async function getSharedPreviews(ids: string[]): Promise<Map<string, SharedPreview>> {
  const unique = [...new Set(ids)];
  const out = new Map<string, SharedPreview>(unique.map((id) => [id, { available: false }]));
  if (!unique.length) return out;
  const cards = await getPostCards(unique);
  for (const c of cards) {
    const text = c.body.replace(/\s+/g, " ").trim();
    out.set(c.id, {
      available: true,
      postId: c.id,
      authorName: c.society?.name ?? c.author.name,
      authorUsername: c.society ? null : c.author.username,
      excerpt: text.length > 220 ? `${text.slice(0, 219).trimEnd()}…` : text || (c.event ? "An event" : c.poll ? "A poll" : "A post"),
      timeLabel: c.timeLabel,
      imageCount: c.images.length,
    });
  }
  return out;
}
