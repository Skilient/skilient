"use server";

import { z } from "zod";
import { rpcAction } from "@/lib/actions/recruit-run";
import { actionContext } from "@/lib/actions/context";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { NO_SESSION, signedIn } from "@/lib/actions/rpc";
import { getSharedPreviews, type SharedPreview } from "@/lib/data/share";
import { OPENING_CATEGORIES } from "@/lib/openings/constants";
import { publicImageUrl } from "@/lib/storage";

/**
 * Phase 18 (PRD 5.34): Openings seen, share-to-chat, people you may know and web push. Every action:
 * Zod input, getUser(), one SQL function that re-checks the caller (thread membership, can_view_post,
 * blocks, limits), a typed result and a JSON log line with the request id. Nothing trusts a user id.
 */

const uuid = z.uuid();
const username = z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,30}$/, "That username isn't valid.");

// ---------------------------------------------------------------------------
// Openings
// ---------------------------------------------------------------------------

export async function markOpeningsSeen(input: unknown) {
  return rpcAction({
    name: "openings.seen",
    schema: z.object({ category: z.enum(["overview", ...OPENING_CATEGORIES]) }),
    input,
    fn: "mark_openings_seen",
    args: (v) => ({ p_category: v.category }),
  });
}

// ---------------------------------------------------------------------------
// Share-to-chat
// ---------------------------------------------------------------------------

export interface ShareTarget {
  id: string;
  type: "dm" | "group";
  title: string;
  avatarUrl: string | null;
}

export async function loadShareTargets(input: { q?: string }): Promise<ActionResult<ShareTarget[]>> {
  const ctx = await actionContext("share.targets");
  const parsed = z.object({ q: z.string().trim().max(80).optional() }).safeParse(input);
  if (!parsed.success) {
    ctx.done("refused", { error_code: "invalid_input" });
    return fail("invalid_input", "Search is up to 80 characters.");
  }
  const session = await signedIn(ctx);
  if (!session) return NO_SESSION;
  const { data, error } = await session.supabase.rpc("share_targets", { p_q: parsed.data.q || undefined });
  if (error) {
    ctx.done("error", { error_code: error.code, user_id: session.userId });
    return fail("unavailable", "Couldn't load your chats. Try again.", { requestId: ctx.requestId });
  }
  ctx.done("ok", { user_id: session.userId });
  const rows = (data ?? []) as unknown as { id: string; type: "dm" | "group"; title: string | null; avatar_path: string | null }[];
  return ok(rows.map((r) => ({ id: r.id, type: r.type, title: r.title ?? "Chat", avatarUrl: publicImageUrl("avatars", r.avatar_path) })));
}

export async function sharePost(input: unknown) {
  return rpcAction<z.ZodObject<{ postId: typeof uuid; threads: z.ZodArray<typeof uuid>; note: z.ZodOptional<z.ZodString> }>, string[]>({
    name: "share.post",
    schema: z.object({
      postId: uuid,
      threads: z.array(uuid).min(1, "Pick a chat.").max(5, "Share to up to 5 chats at once."),
      note: z.string().max(1000, "Notes are up to 1,000 characters.").optional(),
    }),
    input,
    fn: "share_post",
    args: (v) => ({ p_post: v.postId, p_threads: v.threads, p_note: v.note ?? null }),
  });
}

export async function undoShare(input: unknown) {
  return rpcAction<z.ZodObject<{ messages: z.ZodArray<typeof uuid> }>, number>({
    name: "share.undo",
    schema: z.object({ messages: z.array(uuid).min(1).max(5) }),
    input,
    fn: "undo_share",
    args: (v) => ({ p_messages: v.messages }),
  });
}

/** A shared post's card for the reader, when a share arrives over Realtime. */
export async function loadSharedPreviews(input: { ids: string[] }): Promise<ActionResult<Record<string, SharedPreview>>> {
  const ctx = await actionContext("share.previews");
  const parsed = z.object({ ids: z.array(uuid).max(20) }).safeParse(input);
  if (!parsed.success) {
    ctx.done("refused", { error_code: "invalid_input" });
    return fail("invalid_input", "That post isn't valid.");
  }
  const session = await signedIn(ctx);
  if (!session) return NO_SESSION;
  try {
    const previews = await getSharedPreviews(parsed.data.ids);
    ctx.done("ok", { user_id: session.userId });
    return ok(Object.fromEntries(previews));
  } catch {
    ctx.done("error", { error_code: "post_cards", user_id: session.userId });
    return fail("unavailable", "Couldn't load the shared post.", { requestId: ctx.requestId });
  }
}

// ---------------------------------------------------------------------------
// People you may know
// ---------------------------------------------------------------------------

export async function dismissSuggestion(input: unknown) {
  return rpcAction({
    name: "pymk.dismiss",
    schema: z.object({ username }),
    input,
    fn: "dismiss_suggestion",
    args: (v) => ({ p_username: v.username }),
  });
}

// ---------------------------------------------------------------------------
// Web push
// ---------------------------------------------------------------------------

const b64url = (min: number, max: number) => z.string().regex(new RegExp(`^[A-Za-z0-9_-]{${min},${max}}$`), "That subscription isn't valid.");

export async function getPushKey(): Promise<ActionResult<string>> {
  const ctx = await actionContext("push.key");
  const session = await signedIn(ctx);
  if (!session) return NO_SESSION;
  const { data, error } = await session.supabase.rpc("push_public_key");
  if (error || !data) {
    ctx.done(error ? "error" : "refused", { error_code: error?.code ?? "not_configured", user_id: session.userId });
    return fail("not_configured", "Phone notifications aren't set up yet.");
  }
  ctx.done("ok", { user_id: session.userId });
  return ok(data);
}

export async function savePushSubscription(input: unknown) {
  return rpcAction({
    name: "push.subscribe",
    schema: z.object({
      endpoint: z.url({ protocol: /^https$/ }).max(1000),
      p256dh: b64url(80, 100),
      auth: b64url(16, 30),
      userAgent: z.string().max(200).optional(),
    }),
    input,
    fn: "save_push_subscription",
    args: (v) => ({ p_endpoint: v.endpoint, p_p256dh: v.p256dh, p_auth: v.auth, p_user_agent: v.userAgent ?? null }),
    revalidate: ["/settings/notifications"],
  });
}

export async function deletePushSubscription(input: unknown) {
  return rpcAction({
    name: "push.unsubscribe",
    schema: z.object({ endpoint: z.url().max(1000).nullable() }),
    input,
    fn: "delete_push_subscription",
    args: (v) => ({ p_endpoint: v.endpoint }),
    revalidate: ["/settings/notifications"],
  });
}

export async function setPushPref(input: unknown) {
  return rpcAction({
    name: "push.pref",
    schema: z.object({ category: z.string().regex(/^[a-z_]{2,40}$/), on: z.boolean() }),
    input,
    fn: "set_push_pref",
    args: (v) => ({ p_category: v.category, p_on: v.on }),
    revalidate: ["/settings/notifications"],
  });
}
