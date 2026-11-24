"use client";

import { PaperPlaneTilt } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useId, useState, useTransition } from "react";
import { Avatar, Button, Checkbox, Dialog, DialogFooter, DialogTrigger, FieldError, Input, SheetContent, Textarea } from "@/components/ui";
import { clockTime } from "@/lib/format/time";
import { loadShareTargets, sharePost, undoShare, type ShareTarget } from "@/lib/actions/community";

const MAX = 5;

/**
 * Share to chat (PRD 5.34): a sheet of the student's recent DMs and venture chats, with search. Pick up
 * to 5, add an optional note, Send, then "Sent to Hira · 14:02 · Undo" beside the button for 10 seconds (inline,
 * so no app-wide toast provider is needed). The
 * recipient sees the post only if they may (can_view_post); shares are never counted on the post.
 */
export function ShareSheet({ postId }: { postId: string }) {
  const ids = { q: useId(), note: useId(), list: useId() };
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [targets, setTargets] = useState<ShareTarget[] | null>(null);
  const [picked, setPicked] = useState<ShareTarget[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState<{ label: string; at: string; ids: string[] } | null>(null);
  const [note2, setNote2] = useState<string | null>(null);

  useEffect(() => {
    if (!sent) return;
    const t = setTimeout(() => setSent(null), 10_000);
    return () => clearTimeout(t);
  }, [sent]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    const timer = setTimeout(async () => {
      const r = await loadShareTargets({ q });
      if (!alive) return;
      if (r.ok) setTargets(r.data);
      else setError(r.message);
    }, q ? 200 : 0);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [open, q]);

  const reset = () => {
    setPicked([]);
    setNote("");
    setQ("");
    setError(null);
  };

  const send = () =>
    startTransition(async () => {
      setError(null);
      const r = await sharePost({ postId, threads: picked.map((t) => t.id), note: note.trim() || undefined });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      const names = picked.map((t) => t.title);
      setOpen(false);
      reset();
      setNote2(null);
      setSent({
        label: `Sent to ${names.length > 2 ? `${names[0]} and ${names.length - 1} others` : names.join(" and ")}`,
        at: clockTime(new Date().toISOString()),
        ids: r.data,
      });
    });

  const undo = () =>
    startTransition(async () => {
      if (!sent) return;
      const u = await undoShare({ messages: sent.ids });
      setSent(null);
      setNote2(u.ok ? "Share taken back." : u.message);
    });

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-body-sm font-semibold text-text-primary shadow-[var(--raised-s)] active:shadow-[var(--pressed-s)]"
          data-testid="post-share"
        >
          <PaperPlaneTilt aria-hidden weight="bold" className="size-4" />
          Share
        </button>
      </DialogTrigger>
      <SheetContent title="Share to a chat" description="Send this post to up to 5 of your DMs or venture chats. Nobody sees a share count.">
        <div className="flex flex-col gap-4" data-testid="share-sheet">
          <div className="flex flex-col gap-2">
            <label htmlFor={ids.q} className="text-body-sm font-semibold">
              Search your chats
            </label>
            <Input id={ids.q} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or venture" maxLength={80} />
          </div>
          {targets === null ? (
            <p role="status" className="text-body-sm text-text-secondary">
              Loading your chats…
            </p>
          ) : targets.length === 0 ? (
            <div className="neu-well flex flex-col items-start gap-2 p-4" data-testid="share-empty">
              <p className="text-body-sm">{q ? "No chat matches." : "No chats yet. Message a friend or join a venture first."}</p>
              {q ? null : (
                <Link href="/friends" className="text-body-sm font-semibold underline underline-offset-4">
                  Find friends
                </Link>
              )}
            </div>
          ) : (
            <fieldset className="flex flex-col gap-1" aria-describedby={`${ids.list}-n`}>
              <legend className="sr-only">Chats</legend>
              <p id={`${ids.list}-n`} className="text-caption text-text-secondary">
                {picked.length}/{MAX} picked
              </p>
              <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
                {targets.map((t) => {
                  const on = picked.some((p) => p.id === t.id);
                  const id = `${ids.list}-${t.id}`;
                  return (
                    <li key={t.id} className="flex min-h-12 items-center gap-3 rounded-md px-2">
                      <Checkbox
                        id={id}
                        checked={on}
                        disabled={!on && picked.length >= MAX}
                        onCheckedChange={(v) => setPicked((p) => (v === true ? [...p, t] : p.filter((x) => x.id !== t.id)))}
                      />
                      <Avatar name={t.title} src={t.avatarUrl} size="sm" />
                      <label htmlFor={id} className="flex-1 text-body-sm">
                        {t.title}
                        <span className="ml-2 text-caption text-text-secondary">{t.type === "dm" ? "DM" : "Venture chat"}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          )}
          <div className="flex flex-col gap-2">
            <label htmlFor={ids.note} className="text-body-sm font-semibold">
              Add a note (optional)
            </label>
            <Textarea id={ids.note} value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000} />
          </div>
          {error ? <FieldError>{error}</FieldError> : null}
          <DialogFooter>
            <Button onClick={send} loading={pending} disabled={picked.length === 0} data-testid="share-send">
              Send
            </Button>
          </DialogFooter>
        </div>
      </SheetContent>
    </Dialog>
      <span role="status" aria-live="polite" className="inline-flex items-center gap-2 text-body-sm" data-testid="share-status">
        {sent ? (
          <>
            <span>
              {sent.label} · <span className="neu-mono">{sent.at}</span>
            </span>
            <Button size="sm" variant="ghost" onClick={undo} disabled={pending}>
              Undo
            </Button>
          </>
        ) : note2 ? (
          <span className="text-text-secondary">{note2}</span>
        ) : null}
      </span>
    </span>
  );
}
