"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { actionContext } from "@/lib/actions/context";
import { rpcAction } from "@/lib/actions/recruit-run";
import { fail, fieldErrors, ok, type ActionResult } from "@/lib/actions/result";
import { call, NO_SESSION, signedIn, type Supabase } from "@/lib/actions/rpc";
import { ImageRejected, reencodeToFit } from "@/lib/images/reencode";
import { prepareProof, PROOF_MESSAGES, ProofRejected } from "@/lib/images/proof-file";
import { SOCIETY_CATEGORIES } from "@/lib/societies/constants";

/**
 * Societies (PRD 5.31). Each action: Zod input, getUser(), one SQL function that re-checks the
 * caller (officer, president, requester), every limit and ownership, a typed result and a JSON log
 * line with the request id. Files are checked here (sharp re-encode or `%PDF-`) and uploaded as the
 * user, so storage policies apply too.
 */

const uuid = z.uuid();
const categories = SOCIETY_CATEGORIES.map((c) => c.value) as [string, ...string[]];
const https = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^https:\/\/[^\s]+$/.test(v), "Use a full https:// link.");
const about = z.string().trim().min(20, "Write at least 20 characters about the society.").max(1000, "Keep it under 1,000 characters.");
const name = z.string().trim().min(3, "Give the society's full name.").max(80, "Keep the name under 80 characters.");

export async function checkSocietyName(input: unknown) {
  return rpcAction<z.ZodString, { available: boolean; name: string | null; university: string | null }>({
    name: "societies.name_check",
    schema: z.string().trim().min(3).max(80),
    input,
    fn: "society_name_check",
    args: (v) => ({ p_name: v }),
  });
}

async function storeProof(supabase: Supabase, userId: string, file: File): Promise<{ path: string } | { error: string }> {
  let proof;
  try {
    proof = await prepareProof(file);
  } catch (err) {
    return { error: err instanceof ProofRejected ? PROOF_MESSAGES[err.reason] : PROOF_MESSAGES.unreadable };
  }
  const path = `${userId}/${randomUUID()}.${proof.ext}`;
  const { error } = await supabase.storage.from("society-documents").upload(path, proof.data, { contentType: proof.contentType, upsert: false });
  return error ? { error: "Couldn't upload the proof. Try again." } : { path };
}

async function storeImage(supabase: Supabase, societyId: string, file: File, maxSide: number): Promise<{ path: string } | { error: string }> {
  let image: Buffer;
  try {
    image = (await reencodeToFit(Buffer.from(await file.arrayBuffer()), maxSide)).data;
  } catch (err) {
    return { error: err instanceof ImageRejected && err.reason === "too_large" ? "That image is too big (max 6,000 × 6,000 pixels)." : "Use a JPEG, PNG or WebP image." };
  }
  const path = `${societyId}/${randomUUID()}.webp`;
  const { error } = await supabase.storage.from("society-media").upload(path, image, { contentType: "image/webp", upsert: false });
  return error ? { error: "Couldn't upload the image. Try again." } : { path };
}

const fileOf = (form: FormData, key: string) => {
  const f = form.get(key);
  return f instanceof File && f.size > 0 ? f : null;
};

const requestSchema = z
  .object({
    name,
    category: z.enum(categories, "Pick a category."),
    about,
    officeBearer: z.literal(true, "Confirm that you are an office bearer of this society."),
    proofUrl: https,
  })
  .strict();

/** The request stepper's final step: details, proof (file or official link), optional logo. */
export async function requestSociety(form: FormData): Promise<ActionResult<{ id: string; slug: string | null; imageNote: string | null }>> {
  const ctx = await actionContext("societies.request");
  let raw: unknown = null;
  try {
    raw = JSON.parse(String(form.get("data") ?? ""));
  } catch {
    /* refused below */
  }
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) {
    ctx.done("refused", { error_code: "invalid_input" });
    return fail("invalid_input", parsed.error.issues[0]?.message ?? "Check the highlighted fields.", { fields: fieldErrors(parsed.error.issues) });
  }
  const proofFile = fileOf(form, "proof");
  if (!proofFile && !parsed.data.proofUrl) {
    ctx.done("refused", { error_code: "invalid_input" });
    return fail("invalid_input", "Add a proof document or an official link.", { fields: { proof: "Add a proof document or an official link." } });
  }
  const session = await signedIn(ctx);
  if (!session) return NO_SESSION;
  const { supabase, userId } = session;
  let proofPath: string | null = null;
  if (proofFile) {
    const stored = await storeProof(supabase, userId, proofFile);
    if ("error" in stored) {
      ctx.done("refused", { error_code: "invalid_file", user_id: userId });
      return fail("invalid_file", stored.error, { fields: { proof: stored.error } });
    }
    proofPath = stored.path;
  }
  const result = await call<string>(ctx, supabase, userId, "request_society", {
    p: { name: parsed.data.name, category: parsed.data.category, about: parsed.data.about, office_bearer: true, proof_path: proofPath, proof_url: parsed.data.proofUrl || null },
  });
  if (!result.ok) {
    if (proofPath) await supabase.storage.from("society-documents").remove([proofPath]);
    return result;
  }
  // The logo is optional and goes in once the society exists (its folder is the society id).
  let imageNote: string | null = null;
  const logo = fileOf(form, "logo");
  if (logo) {
    const stored = await storeImage(supabase, result.data, logo, 512);
    if ("error" in stored) imageNote = `Your request is in, but the logo didn't upload: ${stored.error}`;
    else {
      const { error } = await supabase.rpc("set_society_images", { p_society: result.data, p_logo: stored.path, p_cover: null as never });
      if (error) imageNote = "Your request is in, but the logo didn't save. Add it from the society page.";
    }
  }
  const { data: mine } = await supabase.rpc("my_society_requests");
  const slug = ((mine ?? []) as { society_id: string; slug: string }[]).find((r) => r.society_id === result.data)?.slug ?? null;
  return ok({ id: result.data, slug, imageNote });
}

/** After "More information needed": new proof and/or details, back into the queue. */
export async function resubmitSociety(form: FormData): Promise<ActionResult> {
  const ctx = await actionContext("societies.resubmit");
  let raw: unknown = null;
  try {
    raw = JSON.parse(String(form.get("data") ?? ""));
  } catch {
    /* refused below */
  }
  const parsed = z
    .object({ societyId: uuid, about: z.union([about, z.literal("")]), proofUrl: https })
    .strict()
    .safeParse(raw);
  if (!parsed.success) {
    ctx.done("refused", { error_code: "invalid_input" });
    return fail("invalid_input", parsed.error.issues[0]?.message ?? "Check the highlighted fields.", { fields: fieldErrors(parsed.error.issues) });
  }
  const session = await signedIn(ctx);
  if (!session) return NO_SESSION;
  let proofPath: string | null = null;
  const proofFile = fileOf(form, "proof");
  if (proofFile) {
    const stored = await storeProof(session.supabase, session.userId, proofFile);
    if ("error" in stored) {
      ctx.done("refused", { error_code: "invalid_file", user_id: session.userId });
      return fail("invalid_file", stored.error, { fields: { proof: stored.error } });
    }
    proofPath = stored.path;
  }
  const result = await call(ctx, session.supabase, session.userId, "resubmit_society", {
    p_society: parsed.data.societyId,
    p: { about: parsed.data.about, proof_path: proofPath, proof_url: parsed.data.proofUrl || null },
  }, ["/societies"]);
  if (!result.ok && proofPath) await session.supabase.storage.from("society-documents").remove([proofPath]);
  return result;
}

/** Logo (512 px) and cover (1600 px), re-encoded with sharp and uploaded as the officer. */
export async function setSocietyImages(form: FormData): Promise<ActionResult> {
  const ctx = await actionContext("societies.images");
  const societyId = uuid.safeParse(form.get("societyId"));
  const logo = fileOf(form, "logo");
  const cover = fileOf(form, "cover");
  if (!societyId.success || (!logo && !cover)) {
    ctx.done("refused", { error_code: "invalid_input" });
    return fail("invalid_input", "Choose a logo or a cover image.");
  }
  if ((logo && logo.size > 5 * 1024 * 1024) || (cover && cover.size > 5 * 1024 * 1024)) {
    ctx.done("refused", { error_code: "invalid_file" });
    return fail("invalid_file", "Images can be up to 5 MB.");
  }
  const session = await signedIn(ctx);
  if (!session) return NO_SESSION;
  const paths: { logo: string | null; cover: string | null } = { logo: null, cover: null };
  for (const [key, file, side] of [["logo", logo, 512], ["cover", cover, 1600]] as const) {
    if (!file) continue;
    const stored = await storeImage(session.supabase, societyId.data, file, side);
    if ("error" in stored) {
      ctx.done("refused", { error_code: "invalid_file", user_id: session.userId });
      return fail("invalid_file", stored.error);
    }
    paths[key] = stored.path;
  }
  const result = await call(ctx, session.supabase, session.userId, "set_society_images", { p_society: societyId.data, p_logo: paths.logo, p_cover: paths.cover });
  if (!result.ok) {
    const orphans = [paths.logo, paths.cover].filter((p): p is string => Boolean(p));
    if (orphans.length) await session.supabase.storage.from("society-media").remove(orphans);
  }
  return result;
}

export async function updateSociety(input: unknown) {
  return rpcAction({
    name: "societies.update",
    schema: z.object({ societyId: uuid, about, category: z.enum(categories) }),
    input,
    fn: "update_society",
    args: (v) => ({ p_society: v.societyId, p: { about: v.about, category: v.category } }),
  });
}

export async function setMembershipMode(input: unknown) {
  return rpcAction({
    name: "societies.membership_mode",
    schema: z.object({ societyId: uuid, mode: z.enum(["open", "request", "inductions"]) }),
    input,
    fn: "set_membership_mode",
    args: (v) => ({ p_society: v.societyId, p_mode: v.mode }),
  });
}

export async function followSociety(input: unknown) {
  return rpcAction({
    name: "societies.follow",
    schema: z.object({ societyId: uuid, on: z.boolean() }),
    input,
    fn: "follow_society",
    args: (v) => ({ p_society: v.societyId, p_on: v.on }),
  });
}

export async function joinSociety(input: unknown) {
  return rpcAction<z.ZodObject<{ societyId: typeof uuid }>, string>({
    name: "societies.join",
    schema: z.object({ societyId: uuid }),
    input,
    fn: "join_society",
    args: (v) => ({ p_society: v.societyId }),
  });
}

export async function leaveSociety(input: unknown) {
  return rpcAction({
    name: "societies.leave",
    schema: z.object({ societyId: uuid }),
    input,
    fn: "leave_society",
    args: (v) => ({ p_society: v.societyId }),
  });
}

export async function decideJoinRequest(input: unknown) {
  return rpcAction({
    name: "societies.decide_join",
    schema: z.object({ societyId: uuid, userId: uuid, accept: z.boolean() }),
    input,
    fn: "decide_join_request",
    args: (v) => ({ p_society: v.societyId, p_user: v.userId, p_accept: v.accept }),
  });
}

const username = z
  .string()
  .trim()
  .transform((v) => v.replace(/^@/, ""))
  .pipe(z.string().min(3, "Enter their username.").max(30));
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date.");

export async function inviteOfficer(input: unknown) {
  return rpcAction({
    name: "societies.invite_officer",
    schema: z
      .object({ societyId: uuid, username, title: z.string().trim().min(2, "Give the role a title.").max(60), termStart: isoDate, termEnd: isoDate })
      .refine((v) => v.termEnd > v.termStart, { message: "The term ends after it starts.", path: ["termEnd"] }),
    input,
    fn: "invite_officer",
    args: (v) => ({ p_society: v.societyId, p_username: v.username, p_title: v.title, p_term_start: v.termStart, p_term_end: v.termEnd }),
  });
}

export async function offerHandover(input: unknown) {
  return rpcAction({
    name: "societies.handover",
    schema: z.object({ societyId: uuid, username }),
    input,
    fn: "offer_handover",
    args: (v) => ({ p_society: v.societyId, p_username: v.username }),
  });
}

export async function answerSocietyInvite(input: unknown) {
  return rpcAction({
    name: "societies.answer_invite",
    schema: z.object({ inviteId: uuid, accept: z.boolean() }),
    input,
    fn: "answer_society_invite",
    args: (v) => ({ p_invite: v.inviteId, p_accept: v.accept }),
  });
}

export async function removeOfficer(input: unknown) {
  return rpcAction({
    name: "societies.remove_officer",
    schema: z.object({ societyId: uuid, userId: uuid }),
    input,
    fn: "remove_officer",
    args: (v) => ({ p_society: v.societyId, p_user: v.userId }),
  });
}

/** Term-end confirmation (stored now; The Record issues from it in phase 16). */
export async function confirmTerm(input: unknown) {
  return rpcAction({
    name: "societies.confirm_term",
    schema: z.object({ termId: uuid }),
    input,
    fn: "confirm_term",
    args: (v) => ({ p_term: v.termId }),
  });
}

const roundSchema = z.object({
  societyId: uuid,
  id: uuid.optional(),
  title: z.string().trim().min(3, "Give the round a title.").max(80),
  description: z.string().trim().max(1000).optional().default(""),
  deadline: z.iso.datetime({ offset: true, message: "Pick a deadline." }),
  roles: z
    .array(z.object({ title: z.string().trim().min(2, "Name every role.").max(60), seats: z.number().int().min(1).max(50) }))
    .min(1, "Add at least one role.")
    .max(10, "Up to 10 roles."),
  questions: z.array(z.string().trim().min(5, "Write each question out.").max(300)).max(3, "Up to 3 questions."),
});

export async function saveInductionRound(input: unknown) {
  return rpcAction<typeof roundSchema, string>({
    name: "societies.save_round",
    schema: roundSchema,
    input,
    fn: "save_induction_round",
    args: (v) => ({ p_society: v.societyId, p: { id: v.id ?? null, title: v.title, description: v.description, deadline: v.deadline, roles: v.roles, questions: v.questions } }),
  });
}

export async function publishInductionRound(input: unknown) {
  return rpcAction({
    name: "societies.publish_round",
    schema: z.object({ roundId: uuid }),
    input,
    fn: "publish_induction_round",
    args: (v) => ({ p_round: v.roundId }),
  });
}

export async function applyInduction(input: unknown) {
  return rpcAction({
    name: "societies.apply_induction",
    schema: z.object({ roundId: uuid, roleId: uuid, answers: z.array(z.string().trim().min(1, "Answer every question.").max(1000, "Keep answers under 1,000 characters.")) }),
    input,
    fn: "apply_induction",
    args: (v) => ({ p_round: v.roundId, p: { role_id: v.roleId, answers: v.answers } }),
  });
}

export async function decideInductionApplication(input: unknown) {
  return rpcAction({
    name: "societies.decide_application",
    schema: z.object({ applicationId: uuid, action: z.enum(["shortlist", "accept", "decline"]), note: z.string().trim().max(500).optional().default("") }),
    input,
    fn: "decide_induction_application",
    args: (v) => ({ p_application: v.applicationId, p_action: v.action, p_note: v.note || null }),
  });
}
