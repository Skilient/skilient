import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportButton } from "@/components/reports/report-button";
import { SignForm } from "@/components/yearbook/sign-form";
import { Avatar, Badge, EmptyState } from "@/components/ui";
import { isRefusal } from "@/lib/data/rpc-json";
import { getYearbookPage, type YearbookPage } from "@/lib/data/yearbook";

export const metadata: Metadata = { title: "Yearbook page" };

const NOTE_MAX = 500;

/**
 * /yearbook/[username] (PRD 5.33): the book page. Photo, quote, Record highlights, revealed titles and
 * the notes the owner approved. Sign it if you're a friend, venture teammate or society co-member in
 * the same batch. States: hidden page, already signed (edit until approved), frozen.
 */
export default async function YearbookPersonPage({ params }: PageProps<"/yearbook/[username]">) {
  const { username } = await params;
  let page: YearbookPage;
  try {
    page = await getYearbookPage(username);
  } catch (error) {
    if (isRefusal(error, "P0002")) notFound();
    throw error;
  }
  const back = (
    <Link href="/yearbook" className="inline-flex items-center gap-1.5 text-body-sm font-semibold text-text-secondary hover:text-text-primary">
      <ArrowLeft aria-hidden weight="bold" className="size-4" />
      The yearbook
    </Link>
  );
  if (page.hidden) {
    return (
      <main className="mx-auto flex w-full max-w-[680px] flex-col gap-6 px-[var(--page-gutter)] py-8" data-testid="yearbook-page-hidden">
        {back}
        <h1 className="font-serif text-h1">{page.name}</h1>
        <EmptyState title="This page is hidden" description={`${page.name} chose not to show a yearbook page. It can't be signed or voted for.`} />
      </main>
    );
  }
  const frozen = page.state === "frozen";
  return (
    <main className="mx-auto flex w-full max-w-[760px] flex-col gap-6 px-[var(--page-gutter)] py-8" data-testid="yearbook-page" data-state={page.state}>
      {back}
      <article className="neu-card flex flex-col gap-5 p-6">
        <header className="flex flex-wrap items-center gap-5">
          <Avatar name={page.name} src={page.photoUrl} size="xl" />
          <div className="flex flex-col gap-1">
            <h1 className="font-serif text-h1">{page.name}</h1>
            <p className="text-body-sm text-text-secondary">
              {[page.department, `Batch of ${page.batch}`, page.university].filter(Boolean).join(" · ")}
            </p>
            {page.awards.length ? (
              <ul className="flex flex-wrap gap-2" aria-label="Superlatives">
                {page.awards.map((a) => (
                  <li key={a}>
                    <Badge tone="warning">{a}</Badge>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </header>
        {page.quote ? <blockquote className="font-serif text-h3 italic">“{page.quote}”</blockquote> : null}
        {page.highlights.length ? (
          <section aria-labelledby="hl-h" className="flex flex-col gap-2">
            <h2 id="hl-h" className="text-h4">
              From the Record
            </h2>
            <ul className="flex flex-col gap-2">
              {page.highlights.map((h) => (
                <li key={h.id} className="neu-well-s flex flex-wrap items-baseline justify-between gap-2 p-3">
                  <span className="text-body-sm">
                    <span className="font-semibold">{h.title}</span> · {h.issuer}
                  </span>
                  <Link href={`/verify/${h.code}` as Route} className="neu-mono text-caption underline underline-offset-4">
                    {h.dateLabel} · verify
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <section aria-labelledby="notes-h" className="flex flex-col gap-3">
          <h2 id="notes-h" className="text-h4">
            Notes
          </h2>
          {page.notes.length === 0 ? (
            <p className="text-body-sm text-text-secondary">{page.isOwner ? "No approved notes yet. Approve them on My page." : "No notes yet."}</p>
          ) : (
            <ul className="flex flex-col gap-3" data-testid="yearbook-notes">
              {page.notes.map((n) => (
                <li key={n.id} className="neu-tile flex flex-col gap-2 p-4">
                  <p className="text-body whitespace-pre-wrap">{n.body}</p>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-caption text-text-secondary">
                      {n.writer} · <span className="neu-mono">{n.atLabel}</span>
                    </p>
                    {page.isOwner ? null : <ReportButton targetType="yearbook_note" targetId={n.id} compact />}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </article>

      {page.isOwner ? (
        <p className="text-body-sm text-text-secondary">
          This is your page. <Link href="/yearbook/me" className="font-semibold underline underline-offset-4">Edit it and approve notes</Link>.
        </p>
      ) : frozen ? (
        <p className="neu-well p-4 text-body-sm text-text-secondary" data-testid="yearbook-frozen">
          The yearbook froze at graduation: it&apos;s read-only now.
        </p>
      ) : page.myNote?.status === "approved" ? (
        <p className="neu-well p-4 text-body-sm text-text-secondary" data-testid="yearbook-signed">
          You signed this page, and {page.name.split(" ")[0]} approved your note.
        </p>
      ) : page.canSign ? (
        <section className="neu-card p-6">
          {page.myNote ? (
            <p className="mb-3 text-body-sm text-text-secondary" data-testid="yearbook-note-pending">
              Your note is waiting for approval. You can edit it until then.
            </p>
          ) : null}
          <SignForm username={page.username} ownerName={page.name} initial={page.myNote?.body ?? null} max={NOTE_MAX} />
        </section>
      ) : (
        <p className="neu-well p-4 text-body-sm text-text-secondary" data-testid="yearbook-cant-sign">
          Friends, venture teammates and society co-members in your batch can sign this page.
        </p>
      )}
      {page.isOwner ? null : (
        <div>
          <ReportButton targetType="yearbook_page" targetId={page.id} />
        </div>
      )}
    </main>
  );
}
