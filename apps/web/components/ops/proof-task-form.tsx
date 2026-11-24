"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { Button, Checkbox, controlBase, FieldError, Input, Label, Textarea } from "@/components/ui";
import { saveProofTask } from "@/lib/actions/ops/proof-tasks";
import { cn } from "@/lib/cn";
import type { BankTask } from "@/lib/data/growth";

/** Add or edit one proof task: skill, title, difficulty, brief, 3–6 checklist lines, active, and the reason for the audit log. */
export function ProofTaskForm({ task, skills }: { task?: BankTask; skills: { id: string; name: string }[] }) {
  const uid = useId();
  const router = useRouter();
  const [skillId, setSkillId] = useState(task?.skillId ?? "");
  const [title, setTitle] = useState(task?.title ?? "");
  const [difficulty, setDifficulty] = useState<string>(task?.difficulty ?? "core");
  const [brief, setBrief] = useState(task?.brief ?? "");
  const [checklist, setChecklist] = useState((task?.checklist ?? []).join("\n"));
  const [active, setActive] = useState(task?.active ?? true);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form
      method="post"
      aria-labelledby={`${uid}-h`}
      className="flex flex-col gap-3 rounded-lg border border-border-default bg-bg-surface p-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setDone(null);
        startTransition(async () => {
          const r = await saveProofTask({
            id: task?.id ?? null,
            skillId,
            title,
            difficulty,
            brief,
            checklist: checklist.split("\n").map((l) => l.trim()).filter(Boolean),
            active,
            reason,
          });
          if (!r.ok) return setError(r.message);
          setDone(task ? "Saved." : `${title} added.`);
          setReason("");
          if (!task) {
            setTitle("");
            setBrief("");
            setChecklist("");
          }
          router.refresh();
        });
      }}
    >
      <h2 id={`${uid}-h`} className="text-h3">
        {task ? `Edit "${task.title}"` : "Add a task"}
      </h2>
      {error ? <FormAlert>{error}</FormAlert> : null}
      {done ? <FormAlert tone="success">{done}</FormAlert> : null}
      <div className="grid gap-3 md:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${uid}-skill`}>Skill</Label>
          <select id={`${uid}-skill`} className={cn(controlBase, "h-10")} value={skillId} onChange={(e) => setSkillId(e.target.value)} required>
            <option value="">Choose</option>
            {skills.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${uid}-title`}>Title</Label>
          <Input id={`${uid}-title`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${uid}-diff`}>Difficulty</Label>
          <select id={`${uid}-diff`} className={cn(controlBase, "h-10")} value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
            <option value="starter">Starter</option>
            <option value="core">Core</option>
            <option value="stretch">Stretch</option>
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${uid}-brief`}>Brief</Label>
        <Textarea id={`${uid}-brief`} value={brief} onChange={(e) => setBrief(e.target.value)} rows={3} maxLength={4000} required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${uid}-list`}>Acceptance checklist (one item per line, 3 to 6)</Label>
        <Textarea id={`${uid}-list`} value={checklist} onChange={(e) => setChecklist(e.target.value)} rows={4} required />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id={`${uid}-active`} checked={active} onCheckedChange={(v) => setActive(v === true)} />
        <Label htmlFor={`${uid}-active`} className="font-normal">
          Offered to students
        </Label>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${uid}-why`}>Reason (for the audit log)</Label>
        <Input id={`${uid}-why`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} required />
      </div>
      {error ? <FieldError>{error}</FieldError> : null}
      <Button type="submit" loading={pending} className="self-start">
        {task ? "Save" : "Add task"}
      </Button>
    </form>
  );
}
