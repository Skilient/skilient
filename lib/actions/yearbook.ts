"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { actionContext } from "@/lib/actions/context";
import { rpcAction } from "@/lib/actions/recruit-run";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { NO_SESSION, sentence, signedIn } from "@/lib/actions/rpc";
import { getNominees } from "@/lib/data/yearbook";
import { IMAGE_SPECS, ImageRejected, reencodeImage } from "@/lib/images/reencode";
import { rateLimit } from "@/lib/security/rate-limit";

/**
 * The digital yearbook (PRD 5.33). Every action: Zod input, getUser(), one SQL function that
 * re-checks the caller's batch, the signing rule, the vote window, the freeze and every limit, a typed
 * result and a JSON log line with the request id. Nothing here trusts a user id.
 */

const username = z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,30}$/, "That username isn't valid.");
const titleKey = z.string().regex(/^[a-z][a-z0-9_]{2,40}$/, "That title isn't valid.");
const YEARBOOK = ["/yearbook", "/yearbook/me", "/yearbook/vote"];

export async function saveYearbookPage(input: unknown) {
  return rpcAction({
    name: "yearbook.save_page",
    schema: z.object({
      quote: z.string().max(280, "Your quote is too long.").optional(),
      highlights: z.array(z.uuid()).max(5),
      visible: z.boolean(),
      clearPhoto: z.boolean().optional(),
    }),
    input,
    fn: "save_yearbook_page",
    args: (v) => ({ p_quote: v.quote ?? null, p_highlights: v.highlights, p_visible: v.visible, p_photo: null, p_clear_photo: v.clearPhoto ?? false }),
    revalidate: YEARBOOK,
  });
}

/** A separate yearbook photo: re-encoded to a 512 px WebP with no metadata, stored privately for the batch. */
export async function uploadYearbookPhoto(form: FormData): Promise<ActionResult> {
  const ctx = await actionContext("yearbook.photo");
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    ctx.done("refused", { error_code: "invalid_input" });
    return fail("invalid_input", "Choose an image to upload.");
  }
  if (file.size > IMAGE_SPECS.avatar.maxBytes) {
    ctx.done("refused", { error_code: "too_large" });
    return fail("too_large", "Images must be under 5 MB.");
  }
  const session = await signedIn(ctx);
  if (!session) return NO_SESSION;
  if (!(await rateLimit(session.supabase, "yearbook_photo", session.userId, 20, 3600))) {
    ctx.done("refused", { error_code: "rate_limited", user_id: session.userId });
    return fail("rate_limited", "Too many uploads. Try again in an hour.");
  }
  let webp: Buffer;
  try {
    webp = await reencodeImage(Buffer.from(await file.arrayBuffer()), "avatar");
  } catch (err) {
    const reason = err instanceof ImageRejected ? err.reason : "not_an_image";
    ctx.done("refused", { error_code: reason, user_id: session.userId });
    return fail(reason, reason === "too_large" ? "That image is too big (max 6,000 × 6,000 pixels)." : "That file isn't an image we can read. Try a JPEG or PNG.");
  }
  const bucket = session.supabase.storage.from("yearbook-photos");
  const path = `${session.userId}/${randomUUID()}.webp`;
  const upload = await bucket.upload(path, webp, { contentType: "image/webp", upsert: false });
  if (upload.error) {
    ctx.done("refused", { error_code: "upload_refused", user_id: session.userId });
    return fail("forbidden", "Only students in a final-year batch can add a yearbook photo.");
  }
  // The page keeps its quote, highlights and visibility; only the photo changes. The old one goes to storage-cleanup.
  const { data: page, error: readError } = await session.supabase
    .from("yearbook_pages")
    .select("quote, highlights, visible")
    .eq("user_id", session.userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (readError || !page) {
    await bucket.remove([path]);
    ctx.done("error", { error_code: readError?.code ?? "no_page", user_id: session.userId });
    return fail("unavailable", "Couldn't save your photo. Try again.", { requestId: ctx.requestId });
  }
  const { error } = await session.supabase.rpc("save_yearbook_page", {
    p_quote: page.quote ?? "",
    p_highlights: page.highlights,
    p_visible: page.visible,
    p_photo: path,
    p_clear_photo: false,
  });
  if (error) {
    await bucket.remove([path]);
    const refused = ["55000", "42501", "22023", "P0002"].includes(error.code ?? "");
    ctx.done(refused ? "refused" : "error", { error_code: error.code, user_id: session.userId });
    return refused ? fail("refused", sentence(error.message)) : fail("unavailable", "Couldn't save your photo. Try again.", { requestId: ctx.requestId });
  }
  ctx.done("ok", { user_id: session.userId });
  return ok(null);
}

export async function signYearbook(input: unknown) {
  return rpcAction<z.ZodObject<{ username: typeof username; body: z.ZodString }>, string>({
    name: "yearbook.sign",
    schema: z.object({ username, body: z.string().trim().min(1, "Write a note.").max(1000, "Your note is too long.") }),
    input,
    fn: "sign_yearbook",
    args: (v) => ({ p_username: v.username, p_body: v.body }),
    revalidate: ["/yearbook"],
  });
}

export async function decideYearbookNote(input: unknown) {
  return rpcAction({
    name: "yearbook.decide_note",
    schema: z.object({ noteId: z.uuid(), approve: z.boolean() }),
    input,
    fn: "decide_yearbook_note",
    args: (v) => ({ p_note: v.noteId, p_approve: v.approve }),
    revalidate: YEARBOOK,
  });
}

export async function castYearbookVote(input: unknown) {
  return rpcAction({
    name: "yearbook.vote",
    schema: z.object({ title: titleKey, username: username.nullable() }),
    input,
    fn: "cast_yearbook_vote",
    args: (v) => ({ p_title: v.title, p_username: v.username }),
    revalidate: ["/yearbook/vote"],
  });
}

export async function declineYearbookAward(input: unknown) {
  return rpcAction({
    name: "yearbook.decline",
    schema: z.object({ title: titleKey }),
    input,
    fn: "decline_yearbook_award",
    args: (v) => ({ p_title: v.title }),
    revalidate: YEARBOOK,
  });
}

export async function setSuperlativesOptOut(input: unknown) {
  return rpcAction({
    name: "yearbook.opt_out",
    schema: z.object({ on: z.boolean() }),
    input,
    fn: "set_superlatives_opt_out",
    args: (v) => ({ p_on: v.on }),
    revalidate: ["/settings/privacy", "/yearbook/vote"],
  });
}

export async function searchNominees(input: { q: string }): Promise<ActionResult<{ username: string; name: string }[]>> {
  const ctx = await actionContext("yearbook.nominees");
  const parsed = z.object({ q: z.string().trim().max(60) }).safeParse(input);
  if (!parsed.success) {
    ctx.done("refused", { error_code: "invalid_input" });
    return fail("invalid_input", "Search is up to 60 characters.");
  }
  const session = await signedIn(ctx);
  if (!session) return NO_SESSION;
  try {
    const list = await getNominees(parsed.data.q);
    ctx.done("ok", { user_id: session.userId });
    return ok(list);
  } catch {
    ctx.done("error", { error_code: "nominees", user_id: session.userId });
    return fail("unavailable", "Couldn't search your department. Try again.", { requestId: ctx.requestId });
  }
}
