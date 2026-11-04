"use client";

import { Plus, X } from "@phosphor-icons/react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { Button, HelperText, Input, Label, Textarea } from "@/components/ui";
import { saveInductionRound } from "@/lib/actions/societies";

/**
 * An induction round (PRD 5.31, the venture roles and questions pattern): up to 10 roles with seats,
 * up to 3 questions, a deadline within 30 days. Saved as a draft; Publish opens it.
 */
export function InductionForm({ societyId, slug }: { societyId: string; slug: string }) {
  const id = useId();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [roles, setRoles] = useState([{ title: "", seats: 1 }]);
  const [questions, setQuestions] = useState<string[]>([""]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      method="post"
      className="neu-card flex flex-col gap-5 p-5"
      data-testid="induction-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const when = deadline ? new Date(deadline) : null;
        startTransition(async () => {
          setError(null);
          const r = await saveInductionRound({
            societyId,
            title,
            description,
            deadline: when && !Number.isNaN(when.getTime()) ? when.toISOString() : "",
            roles,
            questions: questions.map((q) => q.trim()).filter(Boolean),
          });
          if (!r.ok) return setError(r.message);
          router.push(`/societies/${slug}/inductions/${r.data}` as Route);
        });
      }}
    >
      {error ? <FormAlert>{error}</FormAlert> : null}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-title`}>Round title</Label>
        <Input id={`${id}-title`} value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="Fall inductions 2026" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-desc`}>What applicants should know (optional)</Label>
        <Textarea id={`${id}-desc`} rows={3} value={description} maxLength={1000} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-deadline`}>Applications close</Label>
        <Input id={`${id}-deadline`} type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        <HelperText>Within the next 30 days. Undecided applications are declined 14 days after the deadline.</HelperText>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-label text-text-secondary uppercase">Roles</legend>
        {roles.map((r, i) => (
          <div key={i} className="flex flex-wrap items-end gap-2">
            <div className="flex min-w-48 flex-1 flex-col gap-1">
              <Label htmlFor={`${id}-role-${i}`}>Role {i + 1}</Label>
              <Input id={`${id}-role-${i}`} value={r.title} maxLength={60} onChange={(e) => setRoles(roles.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
            </div>
            <div className="flex w-24 flex-col gap-1">
              <Label htmlFor={`${id}-seats-${i}`}>Seats</Label>
              <Input
                id={`${id}-seats-${i}`}
                type="number"
                min={1}
                max={50}
                value={r.seats}
                onChange={(e) => setRoles(roles.map((x, j) => (j === i ? { ...x, seats: Number(e.target.value) || 1 } : x)))}
              />
            </div>
            {roles.length > 1 ? (
              <Button type="button" variant="ghost" size="sm" aria-label={`Remove role ${i + 1}`} onClick={() => setRoles(roles.filter((_, j) => j !== i))}>
                <X aria-hidden weight="bold" className="size-4" />
              </Button>
            ) : null}
          </div>
        ))}
        {roles.length < 10 ? (
          <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => setRoles([...roles, { title: "", seats: 1 }])}>
            <Plus aria-hidden weight="bold" className="size-4" />
            Add a role
          </Button>
        ) : null}
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-label text-text-secondary uppercase">Questions (up to 3)</legend>
        {questions.map((q, i) => (
          <div key={i} className="flex items-end gap-2">
            <div className="flex flex-1 flex-col gap-1">
              <Label htmlFor={`${id}-q-${i}`}>Question {i + 1}</Label>
              <Input id={`${id}-q-${i}`} value={q} maxLength={300} onChange={(e) => setQuestions(questions.map((x, j) => (j === i ? e.target.value : x)))} />
            </div>
            <Button type="button" variant="ghost" size="sm" aria-label={`Remove question ${i + 1}`} onClick={() => setQuestions(questions.filter((_, j) => j !== i))}>
              <X aria-hidden weight="bold" className="size-4" />
            </Button>
          </div>
        ))}
        {questions.length < 3 ? (
          <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => setQuestions([...questions, ""])}>
            <Plus aria-hidden weight="bold" className="size-4" />
            Add a question
          </Button>
        ) : null}
      </fieldset>
      <Button type="submit" loading={pending} className="self-start">
        Save draft
      </Button>
    </form>
  );
}
