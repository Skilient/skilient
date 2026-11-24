"use server";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { actionContext } from "@/lib/actions/context";
import { rpcAction } from "@/lib/actions/recruit-run";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { call, NO_SESSION, signedIn } from "@/lib/actions/rpc";
import { siteUrl } from "@/lib/cv/site";
import { REVOKE_CATEGORIES } from "@/lib/record/constants";
import { sha256Hex } from "@/lib/security/hash";

/**
 * The Record (PRD 5.30). Every action: Zod input, getUser(), one SQL function that re-checks the
 * caller (owner, officer of the issuing society, staff), a typed result and a JSON log line with
 * the request id. Entries are never written here: SQL issues them and cv-sign seals them.
 */

const uuid = z.uuid();
const RECORD = ["/me/record"];

export async function setRecordDisplay(input: unknown) {
  return rpcAction({
    name: "record.display",
    schema: z.object({ entryId: uuid, pinned: z.boolean(), hidden: z.boolean() }),
    input,
    fn: "set_record_display",
    args: (v) => ({ p_entry: v.entryId, p_pinned: v.pinned, p_hidden: v.hidden }),
    revalidate: RECORD,
  });
}

export async function reportRecordMistake(input: unknown) {
  return rpcAction({
    name: "record.report_mistake",
    schema: z.object({
      entryId: uuid,
      note: z.string().trim().min(10, "Say what is wrong in at least 10 characters.").max(1000, "Keep it under 1,000 characters."),
    }),
    input,
    fn: "report_record_mistake",
    args: (v) => ({ p_entry: v.entryId, p_note: v.note }),
    revalidate: RECORD,
  });
}

export async function claimRecordEntries(input: unknown = {}) {
  return rpcAction<z.ZodObject<Record<string, never>>, number>({
    name: "record.claim",
    schema: z.object({}),
    input,
    fn: "claim_record_entries",
    args: () => ({}),
    revalidate: RECORD,
  });
}

export async function saveCvActivities(input: unknown) {
  return rpcAction({
    name: "record.cv_activities",
    schema: z.object({ entryIds: z.array(uuid).max(20, "Pick at most 8 entries.") }),
    input,
    fn: "save_cv_activities",
    args: (v) => ({ p_entries: v.entryIds }),
    revalidate: ["/me/cv", ...RECORD],
  });
}

const linkSchema = z.object({
  label: z.string().trim().max(60, "Keep the label under 60 characters.").optional(),
  days: z.union([z.literal(7), z.literal(30), z.literal(90)], { message: "Choose how long the link lasts." }),
});

export async function createRecordShareLink(input: z.input<typeof linkSchema>): Promise<ActionResult<{ url: string }>> {
  const ctx = await actionContext("record.share_link_create");
  const parsed = linkSchema.safeParse(input);
  if (!parsed.success) {
    ctx.done("refused", { error_code: "invalid_input" });
    return fail("invalid_input", parsed.error.issues[0]?.message ?? "Choose how long the link lasts.");
  }
  const session = await signedIn(ctx);
  if (!session) return NO_SESSION;
  // The token is shown once; only its hash is stored.
  const token = randomBytes(32).toString("base64url");
  const created = await call<string>(ctx, session.supabase, session.userId, "create_record_share_link", {
    p_token_hash: sha256Hex(token),
    p_label: parsed.data.label ?? "",
    p_days: parsed.data.days,
  }, RECORD);
  if (!created.ok) return created;
  const { data: profile } = await session.supabase.from("profiles").select("username").eq("user_id", session.userId).single();
  return ok({ url: `${siteUrl()}/record/${profile?.username ?? "me"}?t=${token}` });
}

export async function revokeRecordShareLink(input: unknown) {
  return rpcAction({
    name: "record.share_link_revoke",
    schema: z.object({ id: uuid }),
    input,
    fn: "revoke_record_share_link",
    args: (v) => ({ p_id: v.id }),
    revalidate: RECORD,
  });
}

// Officers of the issuing society (and staff for revocation).

export async function confirmRecordEntry(input: unknown) {
  return rpcAction({
    name: "record.confirm",
    schema: z.object({ entryId: uuid }),
    input,
    fn: "confirm_record_entry",
    args: (v) => ({ p_entry: v.entryId }),
  });
}

export async function correctRecordEntry(input: unknown) {
  return rpcAction({
    name: "record.correct",
    schema: z.object({
      entryId: uuid,
      title: z.string().trim().max(120, "Keep the title under 120 characters.").optional(),
      line: z.string().trim().max(140, "Keep the evidence line under 140 characters.").optional(),
      place: z.coerce.number().int().min(1).max(50).optional(),
      hours: z.coerce.number().positive().max(336).optional(),
      note: z.string().trim().max(500).optional(),
    }),
    input,
    fn: "correct_record_entry",
    args: (v) => ({
      p_entry: v.entryId,
      p: Object.fromEntries(Object.entries({ title: v.title, line: v.line, place: v.place, hours: v.hours }).filter(([, x]) => x !== undefined && x !== "")),
      p_note: v.note ?? "",
    }),
  });
}

export async function declineRecordMistake(input: unknown) {
  return rpcAction({
    name: "record.decline_mistake",
    schema: z.object({ correctionId: uuid, note: z.string().trim().min(3, "Say why the entry stays as it is.").max(500) }),
    input,
    fn: "decline_record_mistake",
    args: (v) => ({ p_correction: v.correctionId, p_note: v.note }),
  });
}

export async function revokeRecordEntry(input: unknown) {
  return rpcAction({
    name: "record.revoke",
    schema: z.object({
      entryId: uuid,
      category: z.enum(REVOKE_CATEGORIES.map((c) => c.value) as [string, ...string[]], { message: "Choose why it is revoked." }),
      reason: z.string().trim().min(3, "Give the reason the student will see.").max(500, "Keep the reason under 500 characters."),
    }),
    input,
    fn: "revoke_record_entry",
    args: (v) => ({ p_entry: v.entryId, p_category: v.category, p_reason: v.reason }),
  });
}
