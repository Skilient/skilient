"use server";

import { z } from "zod";
import { rpcAction } from "@/lib/actions/recruit-run";
import type { ActionResult } from "@/lib/actions/result";
import { AVAILABILITY } from "@/lib/recruit/constants";

const uuid = z.uuid();

export async function blockCompany(orgId: string): Promise<ActionResult> {
  return rpcAction({ name: "student.block_company", schema: uuid, input: orgId, fn: "block_company", args: (v) => ({ p_org: v }), revalidate: ["/settings/privacy", "/opportunities"] });
}
export async function unblockCompany(orgId: string): Promise<ActionResult> {
  return rpcAction({ name: "student.unblock_company", schema: uuid, input: orgId, fn: "unblock_company", args: (v) => ({ p_org: v }), revalidate: ["/settings/privacy", "/opportunities"] });
}

const prefsSchema = z.object({
  availability: z.array(z.enum(AVAILABILITY)).max(3),
  city: z.string().trim().max(60, "Keep the city under 60 characters.").refine((c) => c === "" || c.length >= 2, "Enter at least 2 characters."),
  remote: z.boolean(),
});
export async function saveRecruiterPrefs(input: z.input<typeof prefsSchema>): Promise<ActionResult> {
  return rpcAction({
    name: "student.save_recruiter_prefs",
    schema: prefsSchema,
    input,
    fn: "save_recruiter_prefs",
    args: (v) => ({ p_availability: v.availability, p_city: v.city || null, p_remote: v.remote }),
    revalidate: ["/settings/profile", "/settings/privacy"],
  });
}
