"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { Button, Label, Textarea } from "@/components/ui";
import { controlBase } from "@/components/ui/field";
import { applyInduction } from "@/lib/actions/societies";
import { cn } from "@/lib/cn";

/** Apply to an induction round: one role, every question answered (up to 1,000 characters each). */
export function ApplyForm({ roundId, roles, questions }: { roundId: string; roles: { id: string; title: string; open: boolean }[]; questions: string[] }) {
  const id = useId();
  const router = useRouter();
  const [roleId, setRoleId] = useState(roles.find((r) => r.open)?.id ?? "");
  const [answers, setAnswers] = useState(questions.map(() => ""));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form
      method="post"
      className="neu-card flex flex-col gap-4 p-5"
      data-testid="apply-form"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          setError(null);
          const r = await applyInduction({ roundId, roleId, answers });
          if (!r.ok) return setError(r.message);
          router.refresh();
        });
      }}
    >
      <h2 className="text-h4">Apply</h2>
      {error ? <FormAlert>{error}</FormAlert> : null}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-role`}>Role</Label>
        <select id={`${id}-role`} value={roleId} onChange={(e) => setRoleId(e.target.value)} className={cn(controlBase, "h-10")}>
          {roles.map((r) => (
            <option key={r.id} value={r.id} disabled={!r.open}>
              {r.title}
              {r.open ? "" : " (full)"}
            </option>
          ))}
        </select>
      </div>
      {questions.map((q, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-a-${i}`}>{q}</Label>
          <Textarea id={`${id}-a-${i}`} rows={3} maxLength={1000} value={answers[i]} onChange={(e) => setAnswers(answers.map((a, j) => (j === i ? e.target.value : a)))} />
        </div>
      ))}
      <Button type="submit" loading={pending} className="self-start">
        Send application
      </Button>
    </form>
  );
}
