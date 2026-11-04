"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import { Avatar, Button, Checkbox, FieldError, Switch, Textarea } from "@/components/ui";
import { declineYearbookAward, saveYearbookPage, uploadYearbookPhoto } from "@/lib/actions/yearbook";

/**
 * /yearbook/me settings (PRD 5.33): photo (the avatar, or a separate yearbook photo), a quote up to
 * the limit, up to 3 Record highlights, and whether the page shows at all (a hidden page can't be
 * signed or voted for).
 */
export function MyPageForm({
  name,
  photoUrl,
  ownPhoto,
  quote,
  visible,
  highlights,
  entries,
  limits,
  frozen,
}: {
  name: string;
  photoUrl: string | null;
  ownPhoto: boolean;
  quote: string | null;
  visible: boolean;
  highlights: string[];
  entries: { id: string; title: string; issuer: string; dateLabel: string }[];
  limits: { quote: number; highlights: number };
  frozen: boolean;
}) {
  const router = useRouter();
  const ids = { quote: useId(), visible: useId(), photo: useId(), highlights: useId() };
  const file = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState(quote ?? "");
  const [show, setShow] = useState(visible);
  const [picked, setPicked] = useState<string[]>(highlights);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = (extra: { clearPhoto?: boolean } = {}) =>
    startTransition(async () => {
      setError(null);
      setStatus(null);
      const r = await saveYearbookPage({ quote: q.trim() || undefined, highlights: picked, visible: show, ...extra });
      if (r.ok) {
        setStatus("Saved.");
        router.refresh();
      } else setError(r.message);
    });

  const upload = (f: File) =>
    startTransition(async () => {
      setError(null);
      setStatus(null);
      const form = new FormData();
      form.set("file", f);
      const r = await uploadYearbookPhoto(form);
      if (r.ok) {
        setStatus("Photo updated.");
        router.refresh();
      } else setError(r.message);
    });

  return (
    <form
      method="post"
      className="flex flex-col gap-5"
      data-testid="yearbook-my-page"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <fieldset disabled={frozen || pending} className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={name} src={photoUrl} size="xl" />
          <div className="flex flex-col gap-2">
            <label htmlFor={ids.photo} className="text-body font-semibold">
              Photo
            </label>
            <p className="text-body-sm text-text-secondary">{ownPhoto ? "Your yearbook photo." : "Your profile photo, unless you add a yearbook one."}</p>
            <input
              ref={file}
              id={ids.photo}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
                e.target.value = "";
              }}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={() => file.current?.click()}>
                {ownPhoto ? "Change photo" : "Add a yearbook photo"}
              </Button>
              {ownPhoto ? (
                <Button type="button" size="sm" variant="ghost" onClick={() => save({ clearPhoto: true })}>
                  Use my profile photo
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor={ids.quote} className="text-body font-semibold">
            Your quote
          </label>
          <Textarea id={ids.quote} value={q} onChange={(e) => setQ(e.target.value)} rows={2} maxLength={limits.quote} aria-describedby={`${ids.quote}-n`} />
          <p id={`${ids.quote}-n`} className="text-caption text-text-secondary">
            {q.length}/{limits.quote}
          </p>
        </div>

        <fieldset className="flex flex-col gap-2" aria-describedby={`${ids.highlights}-help`}>
          <legend className="text-body font-semibold">Record highlights</legend>
          <p id={`${ids.highlights}-help`} className="text-body-sm text-text-secondary">
            Up to {limits.highlights} sealed entries from your Record, shown on your page.
          </p>
          {entries.length === 0 ? (
            <p className="text-body-sm text-text-secondary">Your Record has no sealed entries yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {entries.map((e) => {
                const on = picked.includes(e.id);
                const id = `${ids.highlights}-${e.id}`;
                return (
                  <li key={e.id} className="flex items-start gap-3">
                    <Checkbox
                      id={id}
                      checked={on}
                      disabled={!on && picked.length >= limits.highlights}
                      onCheckedChange={(v) => setPicked((p) => (v === true ? [...p, e.id] : p.filter((x) => x !== e.id)))}
                    />
                    <label htmlFor={id} className="text-body-sm">
                      <span className="font-semibold">{e.title}</span> · {e.issuer} · <span className="neu-mono">{e.dateLabel}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </fieldset>

        <div className="flex items-center justify-between gap-4">
          <div>
            <label htmlFor={ids.visible} className="text-body font-semibold">
              Show my page
            </label>
            <p id={`${ids.visible}-help`} className="text-body-sm text-text-secondary">
              A hidden page isn&apos;t in the batch&apos;s book, can&apos;t be signed and can&apos;t be voted for.
            </p>
          </div>
          <Switch id={ids.visible} checked={show} onCheckedChange={setShow} aria-describedby={`${ids.visible}-help`} data-testid="yearbook-visible" />
        </div>
      </fieldset>

      {error ? <FieldError>{error}</FieldError> : null}
      {status ? (
        <p role="status" className="text-body-sm text-text-secondary">
          {status}
        </p>
      ) : null}
      {frozen ? null : (
        <div>
          <Button type="submit" loading={pending}>
            Save my page
          </Button>
        </div>
      )}
    </form>
  );
}

/** A winner, told before the reveal, may decline: the title then goes unawarded. */
export function DeclineAward({ titleKey, title }: { titleKey: string; title: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant="secondary"
        loading={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await declineYearbookAward({ title: titleKey });
            if (r.ok) router.refresh();
            else setError(r.message);
          })
        }
        aria-label={`Decline "${title}"`}
      >
        Decline
      </Button>
      {error ? (
        <p role="alert" className="text-body-sm text-text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
