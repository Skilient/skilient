"use server";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { rpcAction } from "@/lib/actions/recruit-run";
import type { ActionResult } from "@/lib/actions/result";
import { sha256Hex } from "@/lib/data/recruit-public";
import { WEBHOOK_EVENTS } from "@/lib/recruit/constants";

const uuid = z.uuid();
const listName = z.string().trim().min(1, "List name: at least 1 characters.").max(60, "List name: at most 60 characters.");

export async function createApiToken(name: string): Promise<ActionResult<{ token: string }>> {
  const token = `skl_${randomBytes(32).toString("base64url")}`;
  const result = await rpcAction<typeof listName, string>({
    name: "recruit.create_token", entitlement: "api.access",
    schema: listName,
    input: name,
    fn: "create_api_token",
    args: (v) => ({ p_name: v, p_token_hash: sha256Hex(token) }),
    revalidate: ["/org/settings/api"],
  });
  return result.ok ? { ok: true, data: { token } } : result;
}
export async function revokeApiToken(id: string): Promise<ActionResult> {
  return rpcAction({ name: "recruit.revoke_token", schema: uuid, input: id, fn: "revoke_api_token", args: (v) => ({ p_id: v }), revalidate: ["/org/settings/api"] });
}
export async function createWebhook(url: string, events: string[]): Promise<ActionResult<{ id: string; secret: string }>> {
  return rpcAction<z.ZodObject<{ url: z.ZodString; events: z.ZodArray<z.ZodEnum<{ "application.created": "application.created"; "contact.accepted": "contact.accepted" }>> }>, { id: string; secret: string }>({
    name: "recruit.create_webhook", entitlement: "api.access",
    schema: z.object({
      url: z.string().trim().regex(/^https:\/\/\S+$/, "The address must start with https://").max(300),
      events: z.array(z.enum(WEBHOOK_EVENTS)).min(1, "Pick at least one event."),
    }),
    input: { url, events },
    fn: "create_webhook",
    args: (v) => ({ p_url: v.url, p_events: v.events }),
    revalidate: ["/org/settings/api"],
  });
}
export async function deleteWebhook(id: string): Promise<ActionResult> {
  return rpcAction({ name: "recruit.delete_webhook", schema: uuid, input: id, fn: "delete_webhook", args: (v) => ({ p_id: v }), revalidate: ["/org/settings/api"] });
}
