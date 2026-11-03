"use server";

import { z } from "zod";
import { rpcAction } from "@/lib/actions/recruit-run";

/**
 * Society verification in /ops (PRD 5.31, the decide_org pattern): trust reviewers claim a request,
 * then approve, ask for more information, reject, suspend, reinstate, or pause paid tickets. Each SQL
 * function re-checks the role and the two-factor session and audits before and after.
 */

const uuid = z.uuid();

export async function claimSociety(input: unknown) {
  return rpcAction({
    name: "ops.society_claim",
    schema: z.object({ societyId: uuid, claim: z.boolean().default(true) }),
    input,
    fn: "claim_society",
    args: (v) => ({ p_society: v.societyId, p_claim: v.claim }),
    revalidate: ["/ops/societies"],
  });
}

export async function decideSociety(input: unknown) {
  return rpcAction({
    name: "ops.society_decide",
    schema: z
      .object({
        societyId: uuid,
        action: z.enum(["approve", "more_info", "reject", "suspend", "reinstate", "pause_paid", "resume_paid"]),
        reason: z.string().trim().max(1000).default(""),
      })
      .refine((v) => !["more_info", "reject", "suspend", "pause_paid"].includes(v.action) || v.reason.length >= 3, {
        message: "Give a reason the society can read.",
        path: ["reason"],
      }),
    input,
    fn: "decide_society",
    args: (v) => ({ p_society: v.societyId, p_action: v.action, p_reason: v.reason || null }),
    revalidate: ["/ops/societies"],
  });
}
