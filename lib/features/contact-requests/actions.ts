"use server";

import { z } from "zod";
import { rpcAction } from "@/lib/actions/recruit-run";
import type { ActionResult } from "@/lib/actions/result";
import { CONTACT_LIMITS } from "@/lib/recruit/constants";

// The SQL functions enforce organisation access, student ownership, limits and quotas.
// These schemas give callers fast feedback without replacing those checks.
const uuid = z.uuid();
const contactSchema = z.object({
  studentId: uuid,
  role: z.string().trim().min(2, "Role or opportunity: at least 2 characters.").max(80, "Role or opportunity: at most 80 characters."),
  message: z.string().trim()
    .min(CONTACT_LIMITS.minMessage, `Write at least ${CONTACT_LIMITS.minMessage} characters about the role.`)
    .max(CONTACT_LIMITS.maxMessage, `Keep the message under ${CONTACT_LIMITS.maxMessage} characters.`),
});

export type SendContactRequestInput = z.input<typeof contactSchema>;

export async function sendContactRequest(input: SendContactRequestInput): Promise<ActionResult<string>> {
  return rpcAction<typeof contactSchema, string>({
    name: "recruit.send_contact", entitlement: "contact.credits",
    schema: contactSchema,
    input,
    fn: "send_contact_request",
    args: (v) => ({ p_student: v.studentId, p_role: v.role, p_message: v.message }),
    revalidate: [`/recruit/candidates/${input.studentId}`, "/recruit/contacts", "/org/plan"],
  });
}

export async function respondContactRequest(id: string, accept: boolean, reason = ""): Promise<ActionResult<string | null>> {
  return rpcAction<z.ZodObject<{ id: z.ZodUUID; accept: z.ZodBoolean; reason: z.ZodString }>, string | null>({
    name: "student.respond_contact",
    schema: z.object({ id: uuid, accept: z.boolean(), reason: z.string().trim().max(500, "Keep the reason under 500 characters.") }),
    input: { id, accept, reason },
    fn: "respond_contact_request",
    args: (v) => ({ p_id: v.id, p_accept: v.accept, p_reason: v.reason || null }),
    revalidate: ["/opportunities/contact_requests", "/chat"],
  });
}

export async function closeContactChat(id: string): Promise<ActionResult> {
  return rpcAction({ name: "student.close_contact_chat", schema: uuid, input: id, fn: "close_contact_chat", args: (v) => ({ p_id: v }), revalidate: ["/chat", "/opportunities/contact_requests"] });
}
