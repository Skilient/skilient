import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BallotTitle } from "@/components/yearbook/ballot";
import { buttonClass, EmptyState } from "@/components/ui";
import { isRefusal } from "@/lib/data/rpc-json";
import { getBallot, type Ballot } from "@/lib/data/yearbook";

export const metadata: Metadata = { title: "Superlatives" };

/**
 * /yearbook/vote (PRD 5.33, screen spec 3.14): kind superlatives from a fixed list. One secret vote
 * per title for someone in your department, changeable until the close. A winner needs 5 votes or
 * more; vote counts are never shown, only winners after the reveal. States: not open yet, closed,
 * opted out, revealed.
 */
export default async function VotePage() {
  let ballot: Ballot;
  try {
    ballot = await getBallot();
  } catch (error) {
    if (isRefusal(error, "P0002")) notFound();
    throw error;
  }
  const open = ballot.state === "voting" && !ballot.optedOut;
  const revealed = ballot.state === "revealed" || ballot.state === "frozen";
  return (
    <main className="mx-auto flex w-full max-w-[760px] flex-col gap-6 px-[var(--page-gutter)] py-8" data-testid="yearbook-vote" data-state={ballot.state}>
      <header className="flex flex-col gap-2">
        <h1 className="font-serif text-h1">Superlatives</h1>
        <p className="max-w-prose text-body text-text-secondary">
          {ballot.state === "open"
            ? `The vote opens ${ballot.voteOpensLabel}.`
            : ballot.state === "voting"
              ? `Vote for someone in ${ballot.department ?? "your department"} for each title, until ${ballot.voteClosesLabel}. Votes are secret: nobody sees who you chose, and counts are never shown.`
              : ballot.state === "counting"
                ? `The vote has closed. Winners are revealed ${ballot.revealLabel}.`
                : "The winners. Counts are never shown; a title nobody reached 5 votes for, or that its winner declined, stays unawarded."}
        </p>
      </header>
      {ballot.optedOut ? (
        <EmptyState
          title="You've opted out of superlatives"
          description="You won't be an option to vote for, and you don't vote. You can opt back in under Settings, Privacy."
          action={
            <Link href={"/settings/privacy#yearbook" as Route} className={buttonClass("secondary")}>
              Privacy settings
            </Link>
          }
        />
      ) : null}
      <ul className="flex flex-col gap-3">
        {ballot.titles.map((t) =>
          revealed ? (
            <li key={t.key} className="neu-tile flex flex-wrap items-center justify-between gap-2 p-4" data-testid={`winner-${t.key}`}>
              <h2 className="font-serif text-h4">{t.title}</h2>
              <p className="text-body-sm">
                {t.winners && t.winners.length ? (
                  t.winners.map((w, i) => (
                    <span key={w.username}>
                      {i ? ", " : null}
                      <Link href={`/yearbook/${w.username}` as Route} className="font-semibold underline underline-offset-4">
                        {w.name}
                      </Link>
                    </span>
                  ))
                ) : (
                  <span className="text-text-secondary">Not awarded</span>
                )}
              </p>
            </li>
          ) : (
            <BallotTitle key={t.key} titleKey={t.key} title={t.title} vote={t.vote} open={open} />
          ),
        )}
      </ul>
    </main>
  );
}
