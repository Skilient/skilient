"use server";

import { z } from "zod";
import { rpcAction } from "@/lib/actions/recruit-run";

/**
 * The proof-task bank (PRD 5.32), edited in /ops/config/tasks like the code-check prompts. SQL
 * (`ops_save_proof_task`) requires a trust reviewer on two-factor and writes ops_audit_log with
 * before and after. There are no student-written tasks.
 */
const schema = z.object({
  id: z.uuid().nullable(),
  skillId: z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/, "Choose a skill."),
  title: z.string().trim().min(5, "Give it a title of at least 5 characters.").max(120, "Keep the title under 120 characters."),
  difficulty: z.enum(["starter", "core", "stretch"], { message: "Choose a difficulty." }),
  brief: z.string().trim().min(40, "Write a brief of at least 40 characters.").max(4000, "Keep the brief under 4,000 characters."),
  checklist: z
    .array(z.string().trim().min(3, "Each item needs at least 3 characters.").max(200, "Keep each item under 200 characters."))
    .min(3, "Give 3 to 6 checklist items.")
    .max(6, "Give 3 to 6 checklist items."),
  active: z.boolean(),
  reason: z.string().trim().min(3, "Give a reason.").max(500, "Keep the reason under 500 characters."),
});

export async function saveProofTask(input: unknown) {
  return rpcAction<typeof schema, string>({
    name: "ops.proof_task_save",
    schema,
    input,
    fn: "ops_save_proof_task",
    args: (v) => ({
      p_id: v.id,
      p: { skill_id: v.skillId, title: v.title, difficulty: v.difficulty, brief: v.brief, checklist: v.checklist, active: v.active },
      p_reason: v.reason,
    }),
    revalidate: ["/ops/config/tasks", "/ops/audit"],
  });
}
