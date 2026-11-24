"use client";

import { DotsThree, EyeSlash, SpeakerSlash } from "@phosphor-icons/react";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { ReportButton } from "@/components/reports/report-button";
import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";
import { hidePost, muteUser } from "@/lib/actions/posts";

/**
 * "Not for me", "Mute" and "Report" on someone else's post (PRD 5.28), tucked into a `⋯` menu
 * (phase 14) so Comment and Share are the card's visible actions. Hiding or muting folds the card
 * into a short notice with Undo; the feed leaves it out from then on. The menu stays mounted while
 * closed so the report dialog it opens keeps its state.
 */
export function ViewerActions({
  postId,
  authorUsername,
  authorName,
  onChange,
}: {
  postId: string;
  authorUsername: string | null;
  authorName: string;
  onChange: (state: "hidden" | "muted" | null) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const menuId = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLElement>("[data-menu-item]")?.focus();
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const run = (fn: () => ReturnType<typeof hidePost>, next: "hidden" | "muted") =>
    startTransition(async () => {
      setError(null);
      setOpen(false);
      const result = await fn();
      if (result.ok) onChange(next);
      else setError(result.message);
    });

  const first = authorName.split(" ")[0];
  return (
    <div ref={root} className="relative flex items-center gap-1">
      {error ? (
        <span role="alert" className="text-caption text-text-error">
          {error}
        </span>
      ) : null}
      <button
        ref={trigger}
        type="button"
        aria-label="More for this post"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
        className="neu-icon-btn"
        data-testid="post-more"
      >
        <DotsThree aria-hidden weight="bold" className="size-5" />
      </button>
      <div
        id={menuId}
        hidden={!open}
        className={cn("absolute right-0 bottom-12 z-20 w-56 flex-col gap-1 rounded-lg bg-bg-elevated p-2 shadow-[var(--raised-l)]", open ? "flex" : "hidden")}
      >
        <Button data-menu-item variant="ghost" size="sm" className="justify-start rounded-md" disabled={pending} onClick={() => run(() => hidePost(postId, true), "hidden")}>
          <EyeSlash aria-hidden weight="bold" className="size-4" />
          Not for me
        </Button>
        {authorUsername ? (
          <Button variant="ghost" size="sm" className="justify-start rounded-md" disabled={pending} onClick={() => run(() => muteUser(authorUsername, true), "muted")}>
            <SpeakerSlash aria-hidden weight="bold" className="size-4" />
            Mute {first}
          </Button>
        ) : null}
        <span onClickCapture={() => setOpen(false)} className="contents">
          <ReportButton targetType="post" targetId={postId} className="justify-start rounded-md" />
        </span>
      </div>
    </div>
  );
}

/** What's left of a card after hiding or muting, with Undo. */
export function FoldedPost({
  state,
  postId,
  authorUsername,
  authorName,
  onUndo,
}: {
  state: "hidden" | "muted";
  postId: string;
  authorUsername: string | null;
  authorName: string;
  onUndo: () => void;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="neu-well-s flex flex-wrap items-center justify-between gap-2 px-4 py-3" role="status">
      <p className="text-body-sm text-text-secondary">
        {state === "hidden" ? "Hidden. You'll see fewer posts like this." : `You muted ${authorName}. Their posts won't appear in your feeds.`}
      </p>
      <Button
        variant="tertiary"
        size="sm"
        loading={pending}
        onClick={() =>
          startTransition(async () => {
            const result = state === "hidden" ? await hidePost(postId, false) : await muteUser(authorUsername ?? "", false);
            if (result.ok) onUndo();
          })
        }
      >
        Undo
      </Button>
    </div>
  );
}
