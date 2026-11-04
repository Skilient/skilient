"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";
import { Button, Input } from "@/components/ui";
import { castYearbookVote, searchNominees } from "@/lib/actions/yearbook";

interface Person {
  username: string;
  name: string;
}

/**
 * One title on the superlative ballot (PRD 5.33): the caller's own secret vote, changeable until the
 * close, for someone in their department. Nobody else ever sees it; only the winner is shown.
 */
export function BallotTitle({ titleKey, title, vote, open }: { titleKey: string; title: string; vote: Person | null; open: boolean }) {
  const router = useRouter();
  const id = useId();
  const [picking, setPicking] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Person[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!picking) return;
    const timer = setTimeout(async () => {
      const r = await searchNominees({ q });
      if (r.ok) setResults(r.data);
      else setError(r.message);
    }, 200);
    return () => clearTimeout(timer);
  }, [q, picking]);

  const choose = (username: string | null) =>
    startTransition(async () => {
      setError(null);
      const r = await castYearbookVote({ title: titleKey, username });
      if (r.ok) {
        setPicking(false);
        router.refresh();
      } else setError(r.message);
    });

  return (
    <li className="neu-tile flex flex-col gap-3 p-4" data-testid={`ballot-${titleKey}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-serif text-h4">{title}</h2>
        <p className="text-body-sm text-text-secondary" data-testid="ballot-choice">
          {vote ? (
            <>
              Your vote: <span className="font-semibold text-text-primary">{vote.name}</span>
            </>
          ) : (
            "No vote yet"
          )}
        </p>
      </div>
      {open ? (
        picking ? (
          <div className="flex flex-col gap-2">
            <label htmlFor={id} className="text-body-sm font-semibold">
              Search your department
            </label>
            <Input id={id} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or username" autoFocus />
            <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto" aria-label="People you can vote for">
              {results.map((p) => (
                <li key={p.username}>
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center rounded-md px-3 text-left text-body-sm hover:bg-bg-subtle focus-visible:outline-2 focus-visible:outline-focus-ring"
                    onClick={() => choose(p.username)}
                    disabled={pending}
                  >
                    {p.name} <span className="ml-2 text-text-secondary">@{p.username}</span>
                  </button>
                </li>
              ))}
              {results.length === 0 ? <li className="text-body-sm text-text-secondary">No one in your department matches.</li> : null}
            </ul>
            <div>
              <Button size="sm" variant="ghost" onClick={() => setPicking(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => setPicking(true)}>
              {vote ? "Change vote" : "Vote"}
            </Button>
            {vote ? (
              <Button size="sm" variant="ghost" onClick={() => choose(null)} loading={pending}>
                Take back
              </Button>
            ) : null}
          </div>
        )
      ) : null}
      {error ? (
        <p role="alert" className="text-body-sm text-text-error">
          {error}
        </p>
      ) : null}
    </li>
  );
}
