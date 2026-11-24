"use client";

import type { Route } from "next";
import Link from "next/link";
import { useEffect, useId, useState, useTransition } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { Button, Checkbox, FieldError, HelperText, Input, Label, Stepper, Textarea } from "@/components/ui";
import { controlBase } from "@/components/ui/field";
import { checkSocietyName, requestSociety } from "@/lib/actions/societies";
import { cn } from "@/lib/cn";
import { categoryLabel, SOCIETY_CATEGORIES } from "@/lib/societies/constants";

const STEPS = ["Name", "About", "Proof", "Review"];
const MAX = 5 * 1024 * 1024;

/**
 * Request a society (PRD 5.31): four steps, the remaining work always said. The name is checked live
 * against societies already on Skilient at your university; proof is a document (PDF or image, up to
 * 5 MB, private to you and Skilient's reviewers) or an official link. Everything is checked again on
 * the server.
 */
export function RequestStepper({ reviewDays }: { reviewDays: number }) {
  const id = useId();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [about, setAbout] = useState("");
  const [logo, setLogo] = useState<File | null>(null);
  const [proof, setProof] = useState<File | null>(null);
  const [proofUrl, setProofUrl] = useState("");
  const [bearer, setBearer] = useState(false);
  const [nameState, setNameState] = useState<{ for: string; taken: string | null } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ slug: string | null; note: string | null } | null>(null);
  const [pending, startTransition] = useTransition();

  // The live name check, after typing pauses.
  useEffect(() => {
    const value = name.trim();
    if (value.length < 3) return;
    const t = setTimeout(() => {
      void checkSocietyName(value).then((r) => {
        if (r.ok) setNameState({ for: value, taken: r.data.available ? null : `${r.data.name} is already on Skilient at ${r.data.university}.` });
      });
    }, 400);
    return () => clearTimeout(t);
  }, [name]);
  const taken = nameState && nameState.for === name.trim() ? nameState.taken : null;

  function validate(i: number): boolean {
    const e: Record<string, string> = {};
    if (i === 0) {
      if (name.trim().length < 3) e.name = "Give the society's full name.";
      else if (taken) e.name = taken;
      if (!category) e.category = "Pick a category.";
    }
    if (i === 1) {
      if (about.trim().length < 20) e.about = "Write at least 20 characters about the society.";
      if (logo && logo.size > MAX) e.logo = "Images can be up to 5 MB.";
    }
    if (i === 2) {
      if (!proof && !proofUrl.trim()) e.proof = "Add a proof document or an official link.";
      if (proof && proof.size > MAX) e.proof = "Files can be up to 5 MB.";
      if (proofUrl.trim() && !/^https:\/\/\S+$/.test(proofUrl.trim())) e.proofUrl = "Use a full https:// link.";
      if (!bearer) e.bearer = "Confirm that you are an office bearer of this society.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function next() {
    if (validate(step)) setStep(step + 1);
  }

  function submit() {
    if (![0, 1, 2].every((i) => validate(i))) return;
    setError(null);
    const form = new FormData();
    form.set("data", JSON.stringify({ name: name.trim(), category, about: about.trim(), officeBearer: bearer, proofUrl: proofUrl.trim() }));
    if (proof) form.set("proof", proof);
    if (logo) form.set("logo", logo);
    startTransition(async () => {
      const r = await requestSociety(form);
      if (!r.ok) {
        setError(r.message);
        if (r.fields) setErrors(r.fields);
        return;
      }
      setSent({ slug: r.data.slug, note: r.data.imageNote });
    });
  }

  if (sent) {
    return (
      <section className="neu-card flex flex-col gap-3 p-5" role="status" data-testid="request-sent">
        <h2 className="text-h3">Request sent</h2>
        <p className="text-body">Skilient reviews requests within {reviewDays} working days. We&apos;ll notify you either way, and you can follow it under Your requests.</p>
        {sent.note ? <p className="text-body-sm text-text-secondary">{sent.note}</p> : null}
        <Link href={"/societies" as Route} className="font-semibold underline underline-offset-4">
          Back to Societies
        </Link>
      </section>
    );
  }

  return (
    <form method="post" className="flex flex-col gap-5" noValidate onSubmit={(e) => e.preventDefault()} aria-label="Request a society" data-testid="request-stepper">
      <Stepper steps={STEPS} current={step} />
      {error ? <FormAlert>{error}</FormAlert> : null}

      {step === 0 ? (
        <fieldset className="neu-card flex flex-col gap-4 p-5">
          <legend className="sr-only">Name and category</legend>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-name`}>Society name</Label>
            <Input id={`${id}-name`} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} aria-invalid={Boolean(errors.name || taken)} aria-describedby={`${id}-name-help`} />
            {errors.name || taken ? (
              <FieldError id={`${id}-name-help`}>{errors.name ?? taken}</FieldError>
            ) : (
              <HelperText id={`${id}-name-help`}>The full name, as your university lists it.</HelperText>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-cat`}>Category</Label>
            <select id={`${id}-cat`} value={category} onChange={(e) => setCategory(e.target.value)} className={cn(controlBase, "h-10")} aria-invalid={Boolean(errors.category)}>
              <option value="">Choose one</option>
              {SOCIETY_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            {errors.category ? <FieldError>{errors.category}</FieldError> : null}
          </div>
        </fieldset>
      ) : null}

      {step === 1 ? (
        <fieldset className="neu-card flex flex-col gap-4 p-5">
          <legend className="sr-only">About the society</legend>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-about`}>What the society does</Label>
            <Textarea id={`${id}-about`} rows={5} value={about} maxLength={1000} onChange={(e) => setAbout(e.target.value)} aria-invalid={Boolean(errors.about)} aria-describedby={`${id}-about-count`} />
            <div className="flex justify-between gap-2">
              {errors.about ? <FieldError>{errors.about}</FieldError> : <span />}
              <span id={`${id}-about-count`} className="neu-mono text-text-secondary">
                {about.length}/1,000
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-logo`}>Logo (optional)</Label>
            <input id={`${id}-logo`} type="file" accept="image/jpeg,image/png,image/webp" className="text-body-sm" onChange={(e) => setLogo(e.target.files?.[0] ?? null)} />
            {errors.logo ? <FieldError>{errors.logo}</FieldError> : <HelperText>JPEG, PNG or WebP up to 5 MB. You can add it later.</HelperText>}
          </div>
        </fieldset>
      ) : null}

      {step === 2 ? (
        <fieldset className="neu-card flex flex-col gap-4 p-5">
          <legend className="sr-only">Proof</legend>
          <p className="text-body-sm text-text-secondary">
            Show that the society is real and that you run it: a notification or letter from your university, or a link to the society on your university&apos;s website. Only you and
            Skilient&apos;s reviewers can open the file.
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-proof`}>Proof document</Label>
            <input
              id={`${id}-proof`}
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              className="text-body-sm"
              onChange={(e) => setProof(e.target.files?.[0] ?? null)}
              data-testid="proof-file"
            />
            {errors.proof ? <FieldError>{errors.proof}</FieldError> : <HelperText>PDF or image, up to 5 MB.</HelperText>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-url`}>Or an official link</Label>
            <Input id={`${id}-url`} type="url" inputMode="url" placeholder="https://" value={proofUrl} onChange={(e) => setProofUrl(e.target.value)} aria-invalid={Boolean(errors.proofUrl)} />
            {errors.proofUrl ? <FieldError>{errors.proofUrl}</FieldError> : null}
          </div>
          <div className="flex flex-col gap-1">
            <label className="flex items-start gap-2 text-body">
              <Checkbox checked={bearer} onCheckedChange={(v) => setBearer(v === true)} aria-invalid={Boolean(errors.bearer)} />
              I am an office bearer of this society and may represent it.
            </label>
            {errors.bearer ? <FieldError>{errors.bearer}</FieldError> : null}
          </div>
        </fieldset>
      ) : null}

      {step === 3 ? (
        <section className="neu-card flex flex-col gap-3 p-5" aria-label="Review">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-body-sm">
            <dt className="text-text-secondary">Name</dt>
            <dd className="font-semibold">{name.trim()}</dd>
            <dt className="text-text-secondary">Category</dt>
            <dd>{categoryLabel(category)}</dd>
            <dt className="text-text-secondary">About</dt>
            <dd className="whitespace-pre-line">{about.trim()}</dd>
            <dt className="text-text-secondary">Logo</dt>
            <dd>{logo ? logo.name : "None yet"}</dd>
            <dt className="text-text-secondary">Proof</dt>
            <dd className="break-all">{[proof?.name, proofUrl.trim()].filter(Boolean).join(" · ")}</dd>
          </dl>
          <p className="text-caption text-text-secondary">Once approved you become its President. Skilient reviews within {reviewDays} working days.</p>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {step > 0 ? (
          <Button type="button" variant="ghost" onClick={() => setStep(step - 1)}>
            Back
          </Button>
        ) : null}
        {step < STEPS.length - 1 ? (
          <Button type="button" onClick={next}>
            Continue
          </Button>
        ) : (
          <Button type="button" onClick={submit} loading={pending} data-testid="submit-request">
            Send request
          </Button>
        )}
      </div>
    </form>
  );
}
