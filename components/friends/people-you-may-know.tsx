"use client";

import { X } from "@phosphor-icons/react";
import type { Route } from "next";
import Link from "next/link";
import { useState, useTransition } from "react";
import { AddFriendButton } from "@/components/explore/add-friend-button";
import { Avatar } from "@/components/ui";
import { dismissSuggestion } from "@/lib/actions/community";

export interface SuggestionView {
  username: string;
  name: string;
  avatarUrl: string | null;
  meta: string;
  reason: string;
}

/**
 * People you may know (PRD 5.34, screen spec 3.14): cards with the reason they're suggested, Add friend
 * and Dismiss. A dismissed person never comes back. Empty: one line, nothing else.
 */
export function PeopleYouMayKnow({ initial, headingLevel = 2 }: { initial: SuggestionView[]; headingLevel?: 2 | 3 }) {
  const [people, setPeople] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <section aria-labelledby="pymk-h" className="flex flex-col gap-3" data-testid="pymk">
      <Heading id="pymk-h" className="text-h3">
        People you may know
      </Heading>
      {people.length === 0 ? (
        <p className="text-body-sm text-text-secondary" data-testid="pymk-empty">
          No suggestions right now. They come from your batch, mutual friends, ventures and societies.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {people.map((p) => (
            <li key={p.username} className="neu-tile flex items-start gap-3 p-4" data-testid="pymk-card">
              <Avatar name={p.name} src={p.avatarUrl} size="md" />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <Link href={`/profile/${p.username}` as Route} className="truncate text-body font-semibold underline-offset-4 hover:underline">
                  {p.name}
                </Link>
                {p.meta ? <p className="truncate text-caption text-text-secondary">{p.meta}</p> : null}
                <p className="text-caption font-semibold text-[var(--signal-ink)]" data-testid="pymk-reason">
                  {p.reason}
                </p>
                <div className="mt-1">
                  <AddFriendButton username={p.username} name={p.name} />
                </div>
              </div>
              <button
                type="button"
                className="neu-icon-btn size-11 shrink-0 text-text-secondary hover:text-text-primary"
                aria-label={`Dismiss ${p.name}`}
                data-testid="pymk-dismiss"
                onClick={() =>
                  startTransition(async () => {
                    setError(null);
                    const r = await dismissSuggestion({ username: p.username });
                    if (r.ok) setPeople((list) => list.filter((x) => x.username !== p.username));
                    else setError(r.message);
                  })
                }
              >
                <X aria-hidden weight="bold" className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {error ? (
        <p role="alert" className="text-body-sm text-text-error">
          {error}
        </p>
      ) : null}
    </section>
  );
}
