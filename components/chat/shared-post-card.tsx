import type { Route } from "next";
import Link from "next/link";
import type { SharedPreview } from "@/lib/data/share";

/**
 * A post shared into a chat (PRD 5.34), as the reader may see it: post_cards checks can_view_post for
 * them, so another university's university post, a block, a removal or a deletion shows as unavailable.
 * No counts of any kind.
 */
export function SharedPostCard({ shared }: { shared: SharedPreview }) {
  if (!shared.available) {
    return (
      <p className="mt-1 rounded-md bg-bg-subtle px-3 py-2 text-body-sm text-text-secondary italic" data-testid="shared-post-unavailable">
        This post isn&apos;t available
      </p>
    );
  }
  return (
    <Link
      href={`/post/${shared.postId}` as Route}
      className="neu-well-s mt-1 flex flex-col gap-1 rounded-md p-3 text-left hover:text-text-primary focus-visible:outline-2 focus-visible:outline-focus-ring"
      data-testid="shared-post"
    >
      <span className="text-caption text-text-secondary">
        Post by <span className="font-semibold text-text-primary">{shared.authorName}</span> · {shared.timeLabel}
      </span>
      <span className="line-clamp-4 text-body-sm whitespace-pre-wrap">{shared.excerpt}</span>
      {shared.imageCount ? <span className="text-caption text-text-secondary">{shared.imageCount === 1 ? "1 image" : `${shared.imageCount} images`}</span> : null}
    </Link>
  );
}
