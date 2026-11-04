"use server";

import { z } from "zod";
import { actionContext } from "@/lib/actions/context";
import { rpcAction } from "@/lib/actions/recruit-run";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { NO_SESSION, sentence, signedIn } from "@/lib/actions/rpc";
import { shapeDrawer, type RawDrawer, type SkillDrawer } from "@/lib/data/growth";

/**
 * Paths, proof tasks and the skill swap (PRD 5.32). Every action: Zod input, getUser(), one SQL
 * function that re-checks the caller (owner, reviewer, swap side), every limit and the friend rule,
 * a typed result and a JSON log line with the request id. Nothing here trusts a user id.
 */

const uuid = z.uuid();
const skill = z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/, "That skill isn't recognised.");
const role = z.string().regex(/^[a-z][a-z0-9-]{1,30}$/, "That path isn't recognised.");
const PATHS = ["/me/paths", "/me"];
const SWAPS = ["/swaps"];

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

export async function followPath(input: unknown) {
  return rpcAction({
    name: "paths.follow",
    schema: z.object({ role, follow: z.boolean() }),
    input,
    fn: "follow_path",
    args: (v) => ({ p_role: v.role, p_follow: v.follow }),
    revalidate: PATHS,
  });
}

/** The skill drawer, loaded when a square opens. */
export async function loadSkillDrawer(input: { skill: string; role?: string | null }): Promise<ActionResult<SkillDrawer>> {
  const ctx = await actionContext("paths.drawer");
  const parsed = z.object({ skill, role: role.nullish() }).safeParse(input);
  if (!parsed.success) {
    ctx.done("refused", { error_code: "invalid_input" });
    return fail("invalid_input", "That skill isn't recognised. Refresh the page.");
  }
  const session = await signedIn(ctx);
  if (!session) return NO_SESSION;
  const { data, error } = await session.supabase.rpc("path_skill_drawer", { p_skill: parsed.data.skill, p_role: parsed.data.role ?? undefined });
  if (error) {
    ctx.done(error.code === "P0002" ? "refused" : "error", { error_code: error.code, user_id: session.userId });
    return error.code === "P0002"
      ? fail("not_found", sentence(error.message))
      : fail("unavailable", "Couldn't load this skill. Try again.", { requestId: ctx.requestId });
  }
  ctx.done("ok", { user_id: session.userId });
  return ok(shapeDrawer(data as unknown as RawDrawer));
}

// ---------------------------------------------------------------------------
// Proof tasks
// ---------------------------------------------------------------------------

export async function startTask(input: unknown) {
  return rpcAction<z.ZodObject<{ taskId: typeof uuid }>, string>({
    name: "tasks.start",
    schema: z.object({ taskId: uuid }),
    input,
    fn: "start_task",
    args: (v) => ({ p_task: v.taskId }),
    revalidate: PATHS,
  });
}

export async function linkTaskRepo(input: unknown) {
  return rpcAction({
    name: "tasks.link_repo",
    schema: z.object({ attemptId: uuid, repoId: z.coerce.number().int().positive("Pick a repository.") }),
    input,
    fn: "link_task_repo",
    args: (v) => ({ p_attempt: v.attemptId, p_repo: v.repoId }),
    revalidate: PATHS,
  });
}

export async function submitTask(input: unknown) {
  return rpcAction<z.ZodObject<{ attemptId: typeof uuid }>, string>({
    name: "tasks.submit",
    schema: z.object({ attemptId: uuid }),
    input,
    fn: "submit_task",
    args: (v) => ({ p_attempt: v.attemptId }),
    revalidate: PATHS,
  });
}

export async function abandonTask(input: unknown) {
  return rpcAction({
    name: "tasks.abandon",
    schema: z.object({ attemptId: uuid }),
    input,
    fn: "abandon_task",
    args: (v) => ({ p_attempt: v.attemptId }),
    revalidate: PATHS,
  });
}

export async function chooseTaskCodeCheck(input: unknown) {
  return rpcAction<z.ZodObject<{ attemptId: typeof uuid }>, string>({
    name: "tasks.code_check",
    schema: z.object({ attemptId: uuid }),
    input,
    fn: "choose_task_code_check",
    args: (v) => ({ p_attempt: v.attemptId }),
    revalidate: PATHS,
  });
}

export async function acceptTaskReview(input: unknown) {
  return rpcAction({
    name: "tasks.review_accept",
    schema: z.object({ reviewId: uuid }),
    input,
    fn: "accept_task_review",
    args: (v) => ({ p_review: v.reviewId }),
    revalidate: PATHS,
  });
}

export async function declineTaskReview(input: unknown) {
  return rpcAction({
    name: "tasks.review_decline",
    schema: z.object({ reviewId: uuid }),
    input,
    fn: "decline_task_review",
    args: (v) => ({ p_review: v.reviewId }),
    revalidate: PATHS,
  });
}

export async function reviewTask(input: unknown) {
  return rpcAction({
    name: "tasks.review",
    schema: z
      .object({
        reviewId: uuid,
        confirm: z.boolean(),
        note: z.string().trim().max(1000, "Keep the note under 1,000 characters."),
        ticks: z.array(z.boolean()).min(3).max(6),
      })
      .refine((v) => v.confirm || v.note.length >= 3, { message: "Say what needs to change.", path: ["note"] })
      .refine((v) => !v.confirm || v.ticks.every(Boolean), { message: "Confirm only when every item is met.", path: ["ticks"] }),
    input,
    fn: "review_task",
    args: (v) => ({ p_review: v.reviewId, p_confirm: v.confirm, p_note: v.note || null, p_ticks: v.ticks }),
    revalidate: PATHS,
  });
}

// ---------------------------------------------------------------------------
// Skill swap
// ---------------------------------------------------------------------------

const note280 = z.string().trim().max(280, "Keep it under 280 characters.");

export async function saveSwapOffer(input: unknown) {
  return rpcAction({
    name: "swaps.offer",
    schema: z.object({ skill, note: note280.optional(), on: z.boolean() }),
    input,
    fn: "save_swap_offer",
    args: (v) => ({ p_skill: v.skill, p_note: v.note || null, p_on: v.on }),
    revalidate: SWAPS,
  });
}

export async function saveSwapWant(input: unknown) {
  return rpcAction({
    name: "swaps.want",
    schema: z.object({ skill, note: note280.optional(), on: z.boolean() }),
    input,
    fn: "save_swap_want",
    args: (v) => ({ p_skill: v.skill, p_note: v.note || null, p_on: v.on }),
    revalidate: SWAPS,
  });
}

const requestSchema = z.object({
  teacher: z.string().regex(/^[a-z0-9_]{3,30}$/, "That teacher isn't recognised."),
  skill,
  note: z.string().trim().max(500, "Keep the note under 500 characters.").optional(),
  times: z.string().trim().max(200, "Keep the times under 200 characters.").optional(),
  offer: z.union([skill, z.literal("")]).optional(),
});

export async function requestSwap(input: unknown) {
  return rpcAction<typeof requestSchema, string>({
    name: "swaps.request",
    schema: requestSchema,
    input,
    fn: "request_swap",
    args: (v) => ({ p_teacher: v.teacher, p_skill: v.skill, p_note: v.note || null, p_times: v.times || null, p_offer: v.offer || null }),
    revalidate: SWAPS,
  });
}

export async function respondSwap(input: unknown) {
  return rpcAction({
    name: "swaps.respond",
    schema: z.object({ swapId: uuid, accept: z.boolean() }),
    input,
    fn: "respond_swap",
    args: (v) => ({ p_swap: v.swapId, p_accept: v.accept }),
    revalidate: [...SWAPS, "/chat"],
  });
}

export async function cancelSwapRequest(input: unknown) {
  return rpcAction({
    name: "swaps.cancel",
    schema: z.object({ swapId: uuid }),
    input,
    fn: "cancel_swap_request",
    args: (v) => ({ p_swap: v.swapId }),
    revalidate: SWAPS,
  });
}

export async function endSwap(input: unknown) {
  return rpcAction({
    name: "swaps.end",
    schema: z.object({ swapId: uuid }),
    input,
    fn: "end_swap",
    args: (v) => ({ p_swap: v.swapId }),
    revalidate: [...SWAPS, "/me/record"],
  });
}

export async function proposeSwapSession(input: unknown) {
  return rpcAction<z.ZodType<{ swapId: string; startsAt: string; minutes: number; place: string }>, string>({
    name: "swaps.session_propose",
    schema: z.object({
      swapId: uuid,
      // A datetime-local value in Pakistan time ("2026-11-20T17:30").
      startsAt: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Pick a date and time.")
        .transform((s) => `${s}:00+05:00`),
      minutes: z.coerce.number().int().min(15, "At least 15 minutes.").max(240, "At most 4 hours."),
      place: z.string().trim().min(2, "Say where, or paste a link.").max(200, "Keep it under 200 characters."),
    }),
    input,
    fn: "propose_swap_session",
    args: (v) => ({ p_swap: v.swapId, p_starts_at: v.startsAt, p_minutes: v.minutes, p_place: v.place }),
    revalidate: SWAPS,
  });
}

export async function respondSwapSession(input: unknown) {
  return rpcAction({
    name: "swaps.session_respond",
    schema: z.object({ sessionId: uuid, accept: z.boolean() }),
    input,
    fn: "respond_swap_session",
    args: (v) => ({ p_session: v.sessionId, p_accept: v.accept }),
    revalidate: SWAPS,
  });
}

export async function cancelSwapSession(input: unknown) {
  return rpcAction({
    name: "swaps.session_cancel",
    schema: z.object({ sessionId: uuid }),
    input,
    fn: "cancel_swap_session",
    args: (v) => ({ p_session: v.sessionId }),
    revalidate: SWAPS,
  });
}

export async function confirmSwapSession(input: unknown) {
  return rpcAction({
    name: "swaps.session_confirm",
    schema: z
      .object({
        sessionId: uuid,
        happened: z.boolean(),
        minutes: z.coerce.number().int().min(15, "At least 15 minutes.").max(240, "At most 4 hours.").optional(),
        reason: z.enum(["teacher_absent", "learner_absent", "rescheduled", "other"]).optional(),
        note: note280.optional(),
      })
      .refine((v) => (v.happened ? v.minutes !== undefined : v.reason !== undefined), {
        message: "Say how long it was, or why it didn't happen.",
        path: ["minutes"],
      }),
    input,
    fn: "confirm_swap_session",
    args: (v) => ({ p_session: v.sessionId, p_happened: v.happened, p_minutes: v.minutes ?? null, p_reason: v.reason ?? null, p_note: v.note || null }),
    revalidate: SWAPS,
  });
}

export async function decideSwapNote(input: unknown) {
  return rpcAction({
    name: "swaps.note_decide",
    schema: z.object({ noteId: uuid, approve: z.boolean() }),
    input,
    fn: "decide_swap_note",
    args: (v) => ({ p_note: v.noteId, p_approve: v.approve }),
    revalidate: SWAPS,
  });
}
