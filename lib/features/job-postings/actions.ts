"use server";

import { z } from "zod";
import { rpcAction } from "@/lib/actions/recruit-run";
import type { ActionResult } from "@/lib/actions/result";
import { DESCRIPTION_LIMITS, JOB_TYPES, TIERS } from "@/lib/recruit/constants";

const uuid = z.uuid();
const skillId = z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/);
const tier = z.enum(TIERS);
const text = (min: number, max: number, label: string) =>
  z.string().trim().min(min, `${label}: at least ${min} characters.`).max(max, `${label}: at most ${max} characters.`);

const jobSchema = z
  .object({
    title: text(3, 100, "Title"),
    type: z.enum(JOB_TYPES, { error: "Pick the job type." }),
    location: z.string().trim().max(80),
    remote: z.boolean(),
    salaryMin: z.number({ error: "Add the pay range: jobs without pay aren't allowed." }).int().min(1, "Add the pay range: jobs without pay aren't allowed."),
    salaryMax: z.number({ error: "Add the pay range: jobs without pay aren't allowed." }).int().min(1, "Add the pay range: jobs without pay aren't allowed."),
    currency: z.enum(["PKR", "USD"]),
    payPeriod: z.enum(["month", "year"]),
    minTier: z.union([tier, z.literal("")]),
    skills: z.array(z.object({ skill: skillId, min_level: z.number().int().min(1).max(4) })).max(10, "Up to 10 skills."),
    openings: z.number().int().min(1, "1 to 100 openings.").max(100, "1 to 100 openings."),
    deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the deadline."),
    description: z.string().trim().min(DESCRIPTION_LIMITS.min, `Describe the role in at least ${DESCRIPTION_LIMITS.min} characters.`).max(DESCRIPTION_LIMITS.max, `Keep it under ${DESCRIPTION_LIMITS.max} characters.`),
  })
  .refine((v) => v.salaryMax >= v.salaryMin, { path: ["salaryMax"], message: "The top of the range can't be below the bottom." })
  .refine((v) => v.remote || v.location.length >= 2, { path: ["location"], message: "Add a location or mark the role remote." });
export type JobInput = z.input<typeof jobSchema>;

export async function saveJob(id: string | null, input: JobInput): Promise<ActionResult<string>> {
  return rpcAction<z.ZodObject<{ id: z.ZodNullable<z.ZodUUID>; v: typeof jobSchema }>, string>({
    name: "recruit.save_job",
    unwrap: "v",
    schema: z.object({ id: uuid.nullable(), v: jobSchema }),
    input: { id, v: input },
    fn: "save_job",
    args: ({ id: jobId, v }) => ({
      p_id: jobId,
      p: {
        title: v.title,
        type: v.type,
        location: v.location,
        remote: v.remote,
        salary_min: v.salaryMin,
        salary_max: v.salaryMax,
        currency: v.currency,
        pay_period: v.payPeriod,
        min_tier: v.minTier,
        min_skill_levels: v.skills,
        openings: v.openings,
        deadline: v.deadline,
        description: v.description,
      },
    }),
    revalidate: ["/recruit/jobs"],
  });
}

export async function publishJob(id: string): Promise<ActionResult> {
  return rpcAction({ name: "recruit.publish_job", schema: uuid, input: id, fn: "publish_job", args: (v) => ({ p_id: v }), revalidate: ["/recruit/jobs", `/recruit/jobs/${id}`, "/opportunities/jobs"] });
}

export async function closeJob(id: string): Promise<ActionResult> {
  return rpcAction({ name: "recruit.close_job", schema: uuid, input: id, fn: "close_job", args: (v) => ({ p_id: v }), revalidate: ["/recruit/jobs", `/recruit/jobs/${id}`, "/opportunities/jobs"] });
}
