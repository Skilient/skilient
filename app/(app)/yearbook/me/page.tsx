import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DownloadPagePdf } from "@/components/yearbook/download-pdf";
import { DeclineAward, MyPageForm } from "@/components/yearbook/my-page-form";
import { NoteActions } from "@/components/yearbook/note-actions";
import { Badge, EmptyState } from "@/components/ui";
import { isRefusal } from "@/lib/data/rpc-json";
import { getMyYearbook, type MyYearbook } from "@/lib/data/yearbook";

export const metadata: Metadata = { title: "My yearbook page" };

const STATUS: Record<"approved" | "hidden" | "pending", string> = { approved: "Approved", hidden: "Hidden", pending: "Waiting for you" };

/**
 * /yearbook/me (PRD 5.33, screen spec 3.14): the page's settings (photo, quote, highlights, visibility)
 * and the notes inbox, where the owner approves or hides each note. A told winner may decline a title
 * before the reveal. Frozen: read-only, with the page PDF.
 */
export default async function MyYearbookPage() {
  let me: MyYearbook;
  try {
    me = await getMyYearbook();
  } catch (error) {
    if (isRefusal(error, "P0002")) notFound();
    throw error;
  }
  const frozen = me.state === "frozen";
  const told = me.awards.filter((a) => a.status === "told");
  return (
    <main className="mx-auto flex w-full max-w-[760px] flex-col gap-6 px-[var(--page-gutter)] py-8" data-testid="yearbook-me" data-state={me.state}>
      <header className="flex flex-col gap-2">
        <h1 className="font-serif text-h1">My yearbook page</h1>
        <div className="flex flex-wrap items-center gap-3">
          {me.username ? (
            <Link href={`/yearbook/${me.username}` as Route} className="text-body-sm font-semibold underline underline-offset-4">
              See my page as the batch does
            </Link>
          ) : null}
          <DownloadPagePdf />
        </div>
        {me.removed ? (
          <p role="status" className="neu-well p-3 text-body-sm text-text-error">
            Your page was removed by moderation and isn&apos;t shown to the batch.
          </p>
        ) : null}
      </header>

      {told.length ? (
        <section aria-labelledby="told-h" className="neu-card flex flex-col gap-3 p-6" data-testid="yearbook-told">
          <h2 id="told-h" className="font-serif text-h3">
            Your batch voted you…
          </h2>
          <p className="text-body-sm text-text-secondary">Only you know until {me.revealLabel}. Decline a title and it goes unawarded.</p>
          <ul className="flex flex-col gap-2">
            {told.map((a) => (
              <li key={a.titleKey} className="flex flex-wrap items-center justify-between gap-2">
                <Badge tone="warning">{a.title}</Badge>
                <DeclineAward titleKey={a.titleKey} title={a.title} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="page-h" className="neu-card flex flex-col gap-4 p-6">
        <h2 id="page-h" className="text-h3">
          Your page
        </h2>
        <MyPageForm
          name={me.name}
          photoUrl={me.photoUrl}
          ownPhoto={me.ownPhoto}
          quote={me.quote}
          visible={me.visible}
          highlights={me.highlights}
          entries={me.entries}
          limits={me.limits}
          frozen={frozen}
        />
      </section>

      <section aria-labelledby="inbox-h" className="flex flex-col gap-3">
        <h2 id="inbox-h" className="text-h3">
          Notes on your page
        </h2>
        <p className="text-body-sm text-text-secondary">Only notes you approve are shown to the batch. Hidden notes stay between you and the writer, who isn&apos;t told.</p>
        {me.notes.length === 0 ? (
          <EmptyState object="envelope" title="No notes yet" description="Friends, teammates and society co-members in your batch can sign your page." />
        ) : (
          <ul className="flex flex-col gap-3" data-testid="yearbook-inbox">
            {me.notes.map((n) => (
              <li key={n.id} className="neu-tile flex flex-col gap-2 p-4" data-status={n.status}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-body-sm font-semibold">{n.writer}</p>
                  <Badge tone={n.status === "approved" ? "success" : "neutral"}>{STATUS[n.status]}</Badge>
                </div>
                <p className="text-body whitespace-pre-wrap">{n.body}</p>
                {frozen ? null : <NoteActions noteId={n.id} status={n.status} />}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
