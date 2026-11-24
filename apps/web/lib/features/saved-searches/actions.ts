"use server";

import { z } from "zod";
import { rpcAction } from "@/lib/actions/recruit-run";
import type { ActionResult } from "@/lib/actions/result";
import { ACTIVE_DAYS, AVAILABILITY, TIERS } from "@/lib/recruit/constants";

const uuid = z.uuid();
const skillId = z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/);
const text = (min: number, max: number, label: string) =>
  z.string().trim().min(min, `${label}: at least ${min} characters.`).max(max, `${label}: at most ${max} characters.`);
const filtersSchema = z.object({
  skills: z.array(z.object({ skill: skillId, min_level: z.number().int().min(1).max(4) })).max(10).optional(),
  code_check: z.boolean().optional(),
  universities: z.array(uuid).max(50).optional(),
  departments: z.array(z.string().max(80)).max(30).optional(),
  batch_from: z.number().int().min(1980).max(2100).optional(),
  batch_to: z.number().int().min(1980).max(2100).optional(),
  min_tier: z.enum(TIERS).optional(),
  active_days: z.union([z.literal(ACTIVE_DAYS[0]), z.literal(ACTIVE_DAYS[1]), z.literal(ACTIVE_DAYS[2])]).optional(),
  availability: z.array(z.enum(AVAILABILITY)).max(3).optional(),
  city: z.string().trim().min(2).max(60).optional(),
  remote: z.boolean().optional(),
});

export async function saveSearch(name: string, filters: z.input<typeof filtersSchema>, frequency: "daily" | "weekly"): Promise<ActionResult<string>> {
  return rpcAction<z.ZodObject<{ name: z.ZodString; filters: typeof filtersSchema; frequency: z.ZodEnum<{ daily: "daily"; weekly: "weekly" }> }>, string>({
    name: "recruit.save_search", entitlement: "recruit.saved_searches",
    schema: z.object({ name: text(1, 60, "Name"), filters: filtersSchema, frequency: z.enum(["daily", "weekly"]) }),
    input: { name, filters, frequency },
    fn: "save_search",
    args: (v) => ({ p_name: v.name, p_filters: v.filters, p_frequency: v.frequency }),
    revalidate: ["/recruit/search"],
  });
}

export async function deleteSavedSearch(id: string): Promise<ActionResult> {
  return rpcAction({ name: "recruit.delete_saved_search", schema: uuid, input: id, fn: "delete_saved_search", args: (v) => ({ p_id: v }), revalidate: ["/recruit/search"] });
}
