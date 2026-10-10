"use server";

import { z } from "zod";
import { rpcAction } from "@/lib/actions/recruit-run";
import type { ActionResult } from "@/lib/actions/result";
import { STAGES } from "@/lib/recruit/constants";

// SQL checks student ownership, organisation membership and allowed stage transitions.
const uuid = z.uuid();
const stage = z.enum(STAGES);
const reason = z.enum(["skills_gap", "position_filled", "other"]).nullable();

export async function applyToJob(jobId: string, note: string): Promise<ActionResult<string>> {
  return rpcAction<z.ZodObject<{ jobId: z.ZodUUID; note: z.ZodString }>, string>({
    name: "student.apply_to_job",
    schema: z.object({ jobId: uuid, note: z.string().trim().max(300, "Keep the note under 300 characters.") }),
    input: { jobId, note },
    fn: "apply_to_job",
    args: (v) => ({ p_job: v.jobId, p_note: v.note || null }),
    revalidate: ["/opportunities/applications", `/opportunities/jobs/${jobId}`],
  });
}

export async function withdrawJobApplication(id: string): Promise<ActionResult> {
  return rpcAction({ name: "student.withdraw_job_application", schema: uuid, input: id, fn: "withdraw_job_application", args: (v) => ({ p_id: v }), revalidate: ["/opportunities/applications", `/opportunities/applications/${id}`] });
}

export async function moveApplication(jobId: string, applicationId: string, to: (typeof STAGES)[number], why: string | null = null): Promise<ActionResult> {
  return rpcAction({
    name: "recruit.move_application",
    schema: z.object({ applicationId: uuid, to: stage, why: reason }),
    input: { applicationId, to, why },
    fn: "move_application",
    args: (v) => ({ p_id: v.applicationId, p_stage: v.to, p_reason: v.why }),
    revalidate: [`/recruit/jobs/${jobId}/applicants`],
  });
}

export async function bulkMoveApplications(jobId: string, ids: string[], to: (typeof STAGES)[number], why: string | null = null): Promise<ActionResult<number>> {
  return rpcAction<z.ZodObject<{ ids: z.ZodArray<z.ZodUUID>; to: typeof stage; why: typeof reason }>, number>({
    name: "recruit.bulk_move",
    schema: z.object({ ids: z.array(uuid).min(1, "Pick at least one applicant.").max(100), to: stage, why: reason }),
    input: { ids, to, why },
    fn: "bulk_move_applications",
    args: (v) => ({ p_ids: v.ids, p_stage: v.to, p_reason: v.why }),
    revalidate: [`/recruit/jobs/${jobId}/applicants`],
  });
}

export async function inviteToApply(jobId: string, studentIds: string[]): Promise<ActionResult<number>> {
  return rpcAction<z.ZodObject<{ jobId: z.ZodUUID; studentIds: z.ZodArray<z.ZodUUID> }>, number>({
    name: "recruit.invite_to_apply",
    schema: z.object({ jobId: uuid, studentIds: z.array(uuid).min(1, "Pick at least one person.").max(50) }),
    input: { jobId, studentIds },
    fn: "invite_to_apply",
    args: (v) => ({ p_job: v.jobId, p_students: v.studentIds }),
    revalidate: ["/recruit/shortlists"],
  });
}
