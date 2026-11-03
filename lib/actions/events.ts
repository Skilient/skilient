"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { actionContext } from "@/lib/actions/context";
import { rpcAction } from "@/lib/actions/recruit-run";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { NO_SESSION, signedIn } from "@/lib/actions/rpc";
import { ImageRejected, reencodeToFit } from "@/lib/images/reencode";
import { EVENT_TYPES, QUESTION_KINDS } from "@/lib/societies/constants";

/**
 * Society events (PRD 5.31). Zod here, everything again in SQL: officers only, eligibility, seat
 * locks, prices within PKR 100–10,000, the registration window, check-in rules. The user id never
 * comes from the browser.
 */

const uuid = z.uuid();
const iso = z.iso.datetime({ offset: true, message: "Pick a date and time." });
const https = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^https:\/\/[^\s]+$/.test(v), "Use a full https:// link.");

const eventSchema = z
  .object({
    societyId: uuid,
    id: uuid.optional(),
    type: z.enum(EVENT_TYPES.map((t) => t.value) as [string, ...string[]]),
    title: z.string().trim().min(3, "Give the event a title.").max(120, "Keep the title under 120 characters."),
    description: z.string().trim().max(4000, "Keep the description under 4,000 characters.").default(""),
    coverPath: z
      .string()
      .regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/)
      .nullable()
      .default(null),
    location: z.string().trim().max(200).default(""),
    link: https.default(""),
    sessions: z
      .array(z.object({ title: z.string().trim().max(80).default(""), startsAt: iso, endsAt: iso }))
      .min(1, "Add a session.")
      .max(10, "Up to 10 sessions."),
    ticketTypes: z
      .array(
        z.object({
          name: z.string().trim().min(2, "Name every ticket type.").max(60),
          capacity: z.number().int().min(1, "Capacity is at least 1.").max(10000),
          pricePkr: z.number().int().min(100, "Prices are PKR 100 to 10,000.").max(10000, "Prices are PKR 100 to 10,000.").nullable(),
        }),
      )
      .min(1, "Add a ticket type.")
      .max(5, "Up to 5 ticket types."),
    eligibility: z.object({
      scope: z.enum(["university", "all", "groups"]),
      departments: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
      batches: z.array(z.number().int().min(2000).max(2100)).max(10).default([]),
    }),
    team: z.object({ min: z.number().int().min(2).max(6), max: z.number().int().min(2).max(6) }).nullable().default(null),
    approvalMode: z.enum(["automatic", "manual"]),
    registrationOpensAt: iso.nullable().default(null),
    registrationClosesAt: iso.nullable().default(null),
    questions: z
      .array(
        z.object({
          label: z.string().trim().min(3, "Write each question out.").max(200),
          kind: z.enum(QUESTION_KINDS.map((k) => k.value) as [string, ...string[]]),
          options: z.array(z.string().trim().min(1).max(80)).max(10).default([]),
          required: z.boolean(),
        }),
      )
      .max(8, "Up to 8 questions."),
    recordKinds: z.array(z.enum(["attended", "completed", "result"])).min(1, "Pick at least one Record entry.").max(3),
    completedMin: z.number().int().min(1).max(20).nullable().default(null),
    volunteerHours: z.boolean().default(false),
    refundPolicy: z.enum(["none", "until"]),
    refundDays: z.number().int().min(1).max(60).nullable().default(null),
    cohosts: z.array(z.string().trim().min(1).max(80)).max(3).default([]),
  })
  .refine((v) => v.location.length >= 2 || v.link.length > 0, { message: "Add a place or a link.", path: ["location"] })
  .refine((v) => v.sessions.every((s) => new Date(s.endsAt) > new Date(s.startsAt)), { message: "Each session ends after it starts.", path: ["sessions"] })
  .refine((v) => !v.team || v.team.min <= v.team.max, { message: "The smallest team can't be bigger than the largest.", path: ["team"] })
  .refine((v) => v.refundPolicy === "none" || v.refundDays !== null, { message: "Say how many days before the event refunds close.", path: ["refundDays"] })
  .refine((v) => v.questions.every((q) => (q.kind === "single" || q.kind === "multi" ? q.options.length >= 2 : true)), {
    message: "Choice questions need at least 2 options.",
    path: ["questions"],
  });

export type EventInput = z.input<typeof eventSchema>;

export async function saveSocietyEvent(input: unknown) {
  return rpcAction<typeof eventSchema, string>({
    name: "events.save",
    schema: eventSchema,
    input,
    fn: "save_society_event",
    args: (v) => ({
      p_society: v.societyId,
      p: {
        id: v.id ?? null,
        type: v.type,
        title: v.title,
        description: v.description,
        cover_path: v.coverPath,
        location: v.location,
        link: v.link,
        sessions: v.sessions.map((s) => ({ title: s.title, starts_at: s.startsAt, ends_at: s.endsAt })),
        ticket_types: v.ticketTypes.map((t) => ({ name: t.name, capacity: t.capacity, price_pkr: t.pricePkr })),
        eligibility: v.eligibility,
        team: v.team,
        approval_mode: v.approvalMode,
        registration_opens_at: v.registrationOpensAt,
        registration_closes_at: v.registrationClosesAt,
        questions: v.questions.map((q) => ({ label: q.label, kind: q.kind, options: q.kind === "single" || q.kind === "multi" ? q.options : [], required: q.required })),
        record_kinds: v.recordKinds,
        completed_min: v.recordKinds.includes("completed") ? v.completedMin : null,
        volunteer_hours: v.volunteerHours,
        refund_policy: v.refundPolicy,
        refund_days: v.refundPolicy === "until" ? v.refundDays : null,
        cohosts: v.cohosts,
      },
    }),
  });
}

/** A cover image, re-encoded and stored in the society's folder; the stepper saves its path with the event. */
export async function uploadEventCover(form: FormData): Promise<ActionResult<{ path: string }>> {
  const ctx = await actionContext("events.cover");
  const societyId = uuid.safeParse(form.get("societyId"));
  const file = form.get("cover");
  if (!societyId.success || !(file instanceof File) || file.size === 0 || file.size > 5 * 1024 * 1024) {
    ctx.done("refused", { error_code: "invalid_input" });
    return fail("invalid_input", "Choose an image up to 5 MB.");
  }
  const session = await signedIn(ctx);
  if (!session) return NO_SESSION;
  let image: Buffer;
  try {
    image = (await reencodeToFit(Buffer.from(await file.arrayBuffer()), 1600)).data;
  } catch (err) {
    ctx.done("refused", { error_code: "invalid_file", user_id: session.userId });
    return fail("invalid_file", err instanceof ImageRejected && err.reason === "too_large" ? "That image is too big (max 6,000 × 6,000 pixels)." : "Use a JPEG, PNG or WebP image.");
  }
  const path = `${societyId.data}/${randomUUID()}.webp`;
  const { error } = await session.supabase.storage.from("society-media").upload(path, image, { contentType: "image/webp", upsert: false });
  if (error) {
    ctx.done("refused", { error_code: "upload_refused", user_id: session.userId });
    return fail("forbidden", "Only the society's officers add covers.");
  }
  ctx.done("ok", { user_id: session.userId });
  return ok({ path });
}

const eventId = z.object({ eventId: uuid });

export async function publishEvent(input: unknown) {
  return rpcAction({ name: "events.publish", schema: eventId, input, fn: "publish_event", args: (v) => ({ p_event: v.eventId }) });
}

export async function cancelSocietyEvent(input: unknown) {
  return rpcAction({
    name: "events.cancel",
    schema: z.object({ eventId: uuid, reason: z.string().trim().min(5, "Tell registrants why.").max(500) }),
    input,
    fn: "cancel_society_event",
    args: (v) => ({ p_event: v.eventId, p_reason: v.reason }),
  });
}

export async function answerCohost(input: unknown) {
  return rpcAction({
    name: "events.answer_cohost",
    schema: z.object({ eventId: uuid, societyId: uuid, accept: z.boolean() }),
    input,
    fn: "answer_cohost",
    args: (v) => ({ p_event: v.eventId, p_society: v.societyId, p_accept: v.accept }),
  });
}

const registerSchema = z.object({
  eventId: uuid,
  ticketTypeId: uuid,
  answers: z.array(z.union([z.string().max(2000), z.array(z.string().max(200)).max(10)])).max(8),
  team: z.object({ create: z.string().trim().max(60).default(""), code: z.string().trim().max(12).default("") }).nullable().default(null),
});

export async function registerForEvent(input: unknown) {
  return rpcAction<typeof registerSchema, { status: string; waitlist_position: number | null; registration_id: string }>({
    name: "events.register",
    schema: registerSchema,
    input,
    fn: "register_event",
    args: (v) => ({
      p_event: v.eventId,
      p: {
        ticket_type_id: v.ticketTypeId,
        answers: v.answers.map((a) => (Array.isArray(a) ? JSON.stringify(a) : a)),
        team: v.team ? { create: v.team.create, code: v.team.code.toUpperCase() } : null,
      },
    }),
  });
}

export async function cancelRegistration(input: unknown) {
  return rpcAction({ name: "events.cancel_registration", schema: eventId, input, fn: "cancel_registration", args: (v) => ({ p_event: v.eventId }) });
}

export async function decideRegistration(input: unknown) {
  return rpcAction({
    name: "events.decide_registration",
    schema: z.object({ eventId: uuid, userId: uuid, accept: z.boolean() }),
    input,
    fn: "decide_registration",
    args: (v) => ({ p_event: v.eventId, p_user: v.userId, p_accept: v.accept }),
  });
}

export async function addEventStaff(input: unknown) {
  return rpcAction({
    name: "events.add_staff",
    schema: z.object({ eventId: uuid, username: z.string().trim().transform((v) => v.replace(/^@/, "")).pipe(z.string().min(3, "Enter their username.").max(30)) }),
    input,
    fn: "add_event_staff",
    args: (v) => ({ p_event: v.eventId, p_username: v.username }),
  });
}

export async function removeEventStaff(input: unknown) {
  return rpcAction({
    name: "events.remove_staff",
    schema: z.object({ eventId: uuid, userId: uuid }),
    input,
    fn: "remove_event_staff",
    args: (v) => ({ p_event: v.eventId, p_user: v.userId }),
  });
}

export async function messageRegistrants(input: unknown) {
  return rpcAction({
    name: "events.message",
    schema: z.object({ eventId: uuid, body: z.string().trim().min(5, "Write the message.").max(1000, "Keep it under 1,000 characters.") }),
    input,
    fn: "message_registrants",
    args: (v) => ({ p_event: v.eventId, p_body: v.body }),
  });
}

export async function submitEventFeedback(input: unknown) {
  return rpcAction({
    name: "events.feedback",
    schema: z.object({ eventId: uuid, rating: z.number().int().min(1, "Pick a rating.").max(5), comment: z.string().trim().max(1000).default("") }),
    input,
    fn: "submit_event_feedback",
    args: (v) => ({ p_event: v.eventId, p_rating: v.rating, p_comment: v.comment || null }),
  });
}

// ---------------------------------------------------------------------------
// Check-in (event staff)
// ---------------------------------------------------------------------------
type CheckinResult = { result: "green" | "amber" | "red"; name?: string; message?: string; first_at?: string; at?: string; claim?: boolean };

export async function checkInScan(input: unknown) {
  return rpcAction<z.ZodObject<{ eventId: typeof uuid; sessionId: z.ZodNullable<typeof uuid>; payload: z.ZodString }>, CheckinResult>({
    name: "events.check_in_scan",
    schema: z.object({ eventId: uuid, sessionId: uuid.nullable(), payload: z.string().trim().max(200) }),
    input,
    fn: "check_in_scan",
    args: (v) => ({ p_event: v.eventId, p_session: v.sessionId, p_payload: v.payload }),
  });
}

export async function checkInSearch(input: unknown) {
  return rpcAction<
    z.ZodObject<{ eventId: typeof uuid; query: z.ZodString }>,
    { user_id: string; name: string; username: string | null; status: string; checked_in: boolean }[]
  >({
    name: "events.check_in_search",
    schema: z.object({ eventId: uuid, query: z.string().trim().max(80) }),
    input,
    fn: "check_in_search",
    args: (v) => ({ p_event: v.eventId, p_query: v.query }),
  });
}

export async function checkInPerson(input: unknown) {
  return rpcAction<z.ZodObject<{ eventId: typeof uuid; sessionId: z.ZodNullable<typeof uuid>; userId: typeof uuid }>, CheckinResult>({
    name: "events.check_in_person",
    schema: z.object({ eventId: uuid, sessionId: uuid.nullable(), userId: uuid }),
    input,
    fn: "check_in_person",
    args: (v) => ({ p_event: v.eventId, p_session: v.sessionId, p_user: v.userId }),
  });
}

/** Add by university email: an account is checked in; anyone else is recorded for a claim later (phase 16). */
export async function checkInEmail(input: unknown) {
  return rpcAction<z.ZodObject<{ eventId: typeof uuid; sessionId: z.ZodNullable<typeof uuid>; email: z.ZodEmail }>, CheckinResult>({
    name: "events.check_in_email",
    schema: z.object({ eventId: uuid, sessionId: uuid.nullable(), email: z.email("Enter a university email address.").max(254) }),
    input,
    fn: "check_in_email",
    args: (v) => ({ p_event: v.eventId, p_session: v.sessionId, p_email: v.email }),
  });
}

export async function eventHeadcount(input: unknown) {
  return rpcAction<z.ZodObject<{ eventId: typeof uuid; sessionId: z.ZodNullable<typeof uuid> }>, { session_id: string; checked_in: number; expected: number }>({
    name: "events.headcount",
    schema: z.object({ eventId: uuid, sessionId: uuid.nullable() }),
    input,
    fn: "event_headcount",
    args: (v) => ({ p_event: v.eventId, p_session: v.sessionId }),
  });
}

export async function selfCheckIn(input: unknown) {
  return rpcAction<z.ZodObject<{ eventId: typeof uuid; token: z.ZodString }>, CheckinResult>({
    name: "events.self_check_in",
    schema: z.object({ eventId: uuid, token: z.string().trim().max(200) }),
    input,
    fn: "self_check_in",
    args: (v) => ({ p_event: v.eventId, p_token: v.token }),
  });
}

export async function societyEventCode(input: unknown) {
  return rpcAction<typeof eventId, { token: string; changes_at: string }>({
    name: "events.code",
    schema: eventId,
    input,
    fn: "society_event_code",
    args: (v) => ({ p_event: v.eventId }),
  });
}

// ---------------------------------------------------------------------------
// Close-out (officers, within 72 hours of the end)
// ---------------------------------------------------------------------------
export async function fixAttendance(input: unknown) {
  return rpcAction({
    name: "events.fix_attendance",
    schema: z.object({ eventId: uuid, sessionId: uuid, userId: uuid, present: z.boolean(), reason: z.string().trim().min(5, "Give a reason.").max(300) }),
    input,
    fn: "fix_attendance",
    args: (v) => ({ p_event: v.eventId, p_session: v.sessionId, p_user: v.userId, p_present: v.present, p_reason: v.reason }),
  });
}

export async function setEventResult(input: unknown) {
  return rpcAction({
    name: "events.result",
    schema: z
      .object({
        eventId: uuid,
        userId: uuid.nullable().default(null),
        teamId: uuid.nullable().default(null),
        place: z.number().int().min(0).max(10),
        label: z.string().trim().max(60).default(""),
      })
      .refine((v) => (v.userId === null) !== (v.teamId === null), { message: "Pick a person or a team." }),
    input,
    fn: "set_event_result",
    args: (v) => ({ p_event: v.eventId, p_user: v.userId, p_team: v.teamId, p_place: v.place, p_label: v.label || null }),
  });
}

export async function logVolunteerHours(input: unknown) {
  return rpcAction({
    name: "events.volunteer_hours",
    schema: z.object({ eventId: uuid, userId: uuid, hours: z.number().min(0).max(100) }),
    input,
    fn: "log_volunteer_hours",
    args: (v) => ({ p_event: v.eventId, p_user: v.userId, p_hours: v.hours }),
  });
}

/** Stores the issue preview (phase 16 issues Record entries from it). */
export async function issueEventEntries(input: unknown) {
  return rpcAction({ name: "events.issue", schema: eventId, input, fn: "issue_event_entries", args: (v) => ({ p_event: v.eventId }) });
}
