import type { ServiceImpl } from "@connectrpc/connect";
import * as C from "@skilient/contracts/community/v1/community_pb";
import { z } from "zod";
import { refused } from "../refusals";
import * as Ck from "../store/checkin";
import * as Co from "../store/closeout";
import { canListenEvent, isEventStaff } from "../store/db";
import * as E from "../store/events";
import { cancelledRefunds } from "../store/payments";
import * as R from "../store/registrations";
import { filler, id, json, meOf, onward, opt, optId, parse, restricted, staffCheck, Text, userIdsIn, write, type ApiDeps } from "./util";

const EventType = z.enum(["talk", "workshop", "hackathon", "competition", "other", "social", "volunteering"]);
const Instant = z.union([z.literal(""), z.iso.datetime({ offset: true })]);

const EventInput = z.object({
  societyId: z.uuid(),
  eventId: z.union([z.literal(""), z.uuid()]),
  type: EventType,
  title: Text(300),
  description: Text(4000),
  coverPath: Text(200),
  location: Text(300),
  link: Text(600),
  sessions: z.array(z.object({ title: Text(200), startsAt: Instant, endsAt: Instant })).max(30),
  ticketTypes: z.array(z.object({ name: Text(100), capacity: z.number().int().min(1).max(20000), pricePkr: z.number().int().min(0).max(1_000_000) })).max(10),
  eligibility: z.object({ scope: Text(20), departments: z.array(Text(200)).max(50), batches: z.array(z.number().int().min(1900).max(2200)).max(20) }).optional(),
  teamMin: z.number().int().min(0).max(6),
  teamMax: z.number().int().min(0).max(6),
  approvalMode: z.enum(["", "automatic", "manual"]),
  registrationOpensAt: Instant,
  registrationClosesAt: Instant,
  questions: z
    .array(z.object({ label: Text(400), kind: z.enum(["", "short", "long", "single", "multi"]), options: z.array(Text(200)).max(10), required: z.boolean() }))
    .max(20),
  recordKinds: z.array(z.enum(["attended", "completed", "result"])).max(3),
  completedMin: z.number().int().min(0).max(20),
  volunteerHours: z.boolean(),
  refundPolicy: z.enum(["", "none", "until"]),
  refundDays: z.number().int().min(0).max(60),
  cohosts: z.array(Text(80)).max(10),
});

/** Society events: create, publish, cancel, pages; registrations and tickets; check-in; manage and close-out. */
export function eventsApi(deps: ApiDeps): Partial<ServiceImpl<typeof C.CommunityService>> {
  const { sql } = deps;
  return {
    async saveSocietyEvent(req, ctx) {
      const p = parse(EventInput, req);
      return write(deps, ctx, C.SaveSocietyEventRequestSchema, C.SaveSocietyEventResponseSchema, req, async (tx) => {
        const eventId = await E.saveEvent(
          tx,
          meOf(ctx),
          p.societyId,
          {
            id: opt(p.eventId),
            type: p.type,
            title: p.title,
            description: p.description,
            cover_path: opt(p.coverPath),
            location: p.location,
            link: p.link,
            sessions: p.sessions.map((s) => ({ title: s.title, starts_at: s.startsAt, ends_at: s.endsAt })),
            ticket_types: p.ticketTypes.map((t) => ({ name: t.name, capacity: t.capacity, price_pkr: t.pricePkr || null })),
            eligibility: { scope: p.eligibility?.scope || "university", departments: p.eligibility?.departments ?? [], batches: p.eligibility?.batches ?? [] },
            team: p.teamMin || p.teamMax ? { min: p.teamMin, max: p.teamMax } : null,
            approval_mode: p.approvalMode || "automatic",
            registration_opens_at: opt(p.registrationOpensAt),
            registration_closes_at: opt(p.registrationClosesAt),
            questions: p.questions.map((q) => ({ label: q.label, kind: q.kind || "short", options: q.options, required: q.required })),
            record_kinds: p.recordKinds.length ? p.recordKinds : null,
            completed_min: p.completedMin || null,
            volunteer_hours: p.volunteerHours,
            refund_policy: p.refundPolicy || "none",
            refund_days: p.refundDays || null,
            cohosts: p.cohosts,
          },
          deps.files,
          deps.tickets.seal,
        );
        return { eventId };
      });
    },
    async publishEvent(req, ctx) {
      const eventId = id(req.eventId);
      const me = meOf(ctx);
      // The checks first, then the event post (content, as the officer; idempotent per event), then the publish.
      const { event, body } = await E.publishChecks(sql, me, eventId);
      const postId = await deps.ports.eventPost({ eventId, societyId: event.society_id, body, startsAt: event.starts_at, place: event.location, url: event.link }, onward(ctx));
      return write(deps, ctx, C.PublishEventRequestSchema, C.PublishEventResponseSchema, req, async (tx) => {
        await E.markPublished(tx, me, eventId, postId);
        return { postId };
      });
    },
    async cancelSocietyEvent(req, ctx) {
      const p = parse(z.object({ eventId: z.uuid(), reason: Text(500) }), req);
      return write(deps, ctx, C.CancelSocietyEventRequestSchema, C.CancelSocietyEventResponseSchema, req, async (tx) => {
        await E.cancelEvent(tx, meOf(ctx), p.eventId, opt(p.reason), cancelledRefunds);
        return {};
      });
    },
    async eventEditPayload(req, ctx) {
      return { json: json(await E.editPayload(sql, meOf(ctx), id(req.eventId))) };
    },
    async answerCohost(req, ctx) {
      const p = parse(z.object({ eventId: z.uuid(), societyId: z.uuid() }), req);
      return write(deps, ctx, C.AnswerCohostRequestSchema, C.AnswerCohostResponseSchema, req, async (tx) => {
        await E.answerCohost(tx, meOf(ctx), p.eventId, p.societyId, req.accept);
        return {};
      });
    },
    async societyEvents(req, ctx) {
      const p = parse(z.object({ when: Text(20), type: Text(40) }), req);
      return { json: json(await filler(deps, ctx)(await E.societyEvents(sql, meOf(ctx), p.when || "upcoming", opt(p.type)))) };
    },
    async eventPage(req, ctx) {
      return { json: json(await E.eventPage(sql, meOf(ctx), id(req.eventId), filler(deps, ctx))) };
    },
    async societyEventList(req, ctx) {
      return { json: json(await filler(deps, ctx)(await E.societyEventList(sql, meOf(ctx), id(req.societyId), staffCheck(deps, ctx)))) };
    },

    async registerEvent(req, ctx) {
      const p = parse(z.object({ eventId: z.uuid(), ticketTypeId: z.union([z.literal(""), z.uuid()]), answersJson: Text(40_000), teamCreate: Text(80), teamCode: Text(20) }), req);
      let answers: unknown;
      try {
        answers = p.answersJson ? JSON.parse(p.answersJson) : [];
      } catch {
        answers = null;
      }
      if (!Array.isArray(answers)) throw refused("answer_the_form");
      const team = p.teamCreate || p.teamCode ? { create: p.teamCreate, code: p.teamCode } : null;
      return write(deps, ctx, C.RegisterEventRequestSchema, C.RegisterEventResponseSchema, req, async (tx) => {
        restricted(ctx);
        const r = await R.register(tx, meOf(ctx), p.eventId, { ticket_type_id: opt(p.ticketTypeId), answers: answers as unknown[], team });
        return { status: r.status, waitlistPosition: r.waitlist_position ?? 0, registrationId: r.registration_id };
      });
    },
    async cancelRegistration(req, ctx) {
      const eventId = id(req.eventId);
      return write(deps, ctx, C.CancelRegistrationRequestSchema, C.CancelRegistrationResponseSchema, req, async (tx) => {
        await R.cancelRegistration(tx, meOf(ctx), eventId);
        return {};
      });
    },
    async decideRegistration(req, ctx) {
      const p = parse(z.object({ eventId: z.uuid(), userId: z.uuid() }), req);
      return write(deps, ctx, C.DecideRegistrationRequestSchema, C.DecideRegistrationResponseSchema, req, async (tx) => ({
        status: await R.decideRegistration(tx, meOf(ctx), p.eventId, p.userId, req.accept),
      }));
    },
    async myTickets(_req, ctx) {
      return { json: json(await R.myTickets(sql, meOf(ctx), filler(deps, ctx))) };
    },
    async eventTicket(req, ctx) {
      return { json: json(await R.eventTicket(sql, meOf(ctx), id(req.eventId), deps.tickets, filler(deps, ctx))) };
    },

    async eventManage(req, ctx) {
      const doc = await Co.eventManage(sql, meOf(ctx), id(req.eventId), filler(deps, ctx));
      return { json: json(doc), tiers: await deps.ports.tiers(userIdsIn(doc["registrations"]), onward(ctx)) };
    },
    async addEventStaff(req, ctx) {
      const p = parse(z.object({ eventId: z.uuid(), username: Text(60) }), req);
      const name = p.username.trim().toLowerCase();
      const user = (await deps.ports.resolve([name], onward(ctx))).get(name) ?? null;
      return write(deps, ctx, C.AddEventStaffRequestSchema, C.AddEventStaffResponseSchema, req, async (tx) => {
        await Co.addStaff(tx, meOf(ctx), p.eventId, user);
        return {};
      });
    },
    async removeEventStaff(req, ctx) {
      const p = parse(z.object({ eventId: z.uuid(), userId: z.uuid() }), req);
      return write(deps, ctx, C.RemoveEventStaffRequestSchema, C.RemoveEventStaffResponseSchema, req, async (tx) => {
        await Co.removeStaff(tx, meOf(ctx), p.eventId, p.userId);
        return {};
      });
    },
    async messageRegistrants(req, ctx) {
      const p = parse(z.object({ eventId: z.uuid(), body: Text(4000) }), req);
      return write(deps, ctx, C.MessageRegistrantsRequestSchema, C.MessageRegistrantsResponseSchema, req, async (tx) => {
        restricted(ctx);
        return { sent: await Co.messageRegistrants(tx, meOf(ctx), p.eventId, p.body) };
      });
    },
    async submitEventFeedback(req, ctx) {
      const p = parse(z.object({ eventId: z.uuid(), rating: z.number().int().min(1).max(5), comment: Text(1000) }), req);
      return write(deps, ctx, C.SubmitEventFeedbackRequestSchema, C.SubmitEventFeedbackResponseSchema, req, async (tx) => {
        restricted(ctx);
        await Co.submitFeedback(tx, meOf(ctx), p.eventId, p.rating, opt(p.comment));
        return {};
      });
    },

    // Check-in replies name people: never stored with the idempotency key.
    async checkInScan(req, ctx) {
      const p = parse(z.object({ eventId: z.uuid(), sessionId: z.union([z.literal(""), z.uuid()]), payload: Text(200) }), req);
      return write(
        deps,
        ctx,
        C.CheckInScanRequestSchema,
        C.CheckInScanResponseSchema,
        req,
        async (tx) => ({ json: json(await Ck.scan(tx, meOf(ctx), p.eventId, opt(p.sessionId), p.payload.trim(), deps.tickets, filler(deps, ctx))) }),
        { storeReply: false },
      );
    },
    async checkInSearch(req, ctx) {
      const p = parse(z.object({ eventId: z.uuid(), query: Text(100) }), req);
      const rows = await Ck.search(sql, meOf(ctx), p.eventId, p.query, (ids, q, limit) => deps.ports.filterByName(ids, q, limit, onward(ctx)), filler(deps, ctx));
      return { json: json(rows) };
    },
    async checkInPerson(req, ctx) {
      const p = parse(z.object({ eventId: z.uuid(), sessionId: z.union([z.literal(""), z.uuid()]), userId: z.uuid() }), req);
      return write(
        deps,
        ctx,
        C.CheckInPersonRequestSchema,
        C.CheckInPersonResponseSchema,
        req,
        async (tx) => ({ json: json(await Ck.person(tx, meOf(ctx), p.eventId, opt(p.sessionId), p.userId, filler(deps, ctx))) }),
        { storeReply: false },
      );
    },
    async checkInEmail(req, ctx) {
      const p = parse(z.object({ eventId: z.uuid(), sessionId: z.union([z.literal(""), z.uuid()]), email: Text(300) }), req);
      const me = meOf(ctx);
      // Only staff of the event may look an address up.
      if (!(await isEventStaff(sql, p.eventId, me))) throw refused("event_not_found");
      const address = p.email.trim().toLowerCase();
      const found = await deps.ports.resolveEmail(address, onward(ctx));
      return write(
        deps,
        ctx,
        C.CheckInEmailRequestSchema,
        C.CheckInEmailResponseSchema,
        req,
        async (tx) => ({ json: json(await Ck.byEmail(tx, me, p.eventId, opt(p.sessionId), p.email, async () => found, filler(deps, ctx))) }),
        { storeReply: false },
      );
    },
    async eventHeadcount(req, ctx) {
      const p = parse(z.object({ eventId: z.uuid(), sessionId: z.union([z.literal(""), z.uuid()]) }), req);
      return { json: json(await Ck.headcountPage(sql, meOf(ctx), p.eventId, opt(p.sessionId))) };
    },
    async societyEventCode(req, ctx) {
      const c = await Ck.eventCode(sql, meOf(ctx), id(req.eventId), deps.tickets);
      return { token: c.token, changesAt: c.changes_at };
    },
    async selfCheckIn(req, ctx) {
      const p = parse(z.object({ eventId: z.uuid(), token: Text(64) }), req);
      return write(
        deps,
        ctx,
        C.SelfCheckInRequestSchema,
        C.SelfCheckInResponseSchema,
        req,
        async (tx) => ({ json: json(await Ck.selfCheckIn(tx, meOf(ctx), p.eventId, p.token, deps.tickets, filler(deps, ctx))) }),
        { storeReply: false },
      );
    },
    async closeoutPage(req, ctx) {
      const doc = await Co.closeoutPage(sql, meOf(ctx), id(req.eventId), filler(deps, ctx));
      return { json: json(doc), tiers: await deps.ports.tiers(userIdsIn(doc["attendees"]), onward(ctx)) };
    },
    async fixAttendance(req, ctx) {
      const p = parse(z.object({ eventId: z.uuid(), sessionId: z.union([z.literal(""), z.uuid()]), userId: z.uuid(), reason: Text(600) }), req);
      return write(deps, ctx, C.FixAttendanceRequestSchema, C.FixAttendanceResponseSchema, req, async (tx) => {
        await Co.fixAttendance(tx, meOf(ctx), p.eventId, opt(p.sessionId), p.userId, req.present, opt(p.reason));
        return {};
      });
    },
    async setEventResult(req, ctx) {
      const p = parse(z.object({ eventId: z.uuid(), place: z.number().int().min(0).max(50), label: Text(120) }), req);
      const user = optId(req.userId);
      const team = optId(req.teamId);
      return write(deps, ctx, C.SetEventResultRequestSchema, C.SetEventResultResponseSchema, req, async (tx) => {
        await Co.setResult(tx, meOf(ctx), p.eventId, user, team, p.place || null, opt(p.label));
        return {};
      });
    },
    async logVolunteerHours(req, ctx) {
      const p = parse(z.object({ eventId: z.uuid(), userId: z.uuid(), hours: z.number().min(0).max(336) }), req);
      return write(deps, ctx, C.LogVolunteerHoursRequestSchema, C.LogVolunteerHoursResponseSchema, req, async (tx) => {
        await Co.logHours(tx, meOf(ctx), p.eventId, p.userId, p.hours || null);
        return {};
      });
    },
    async issueEventEntries(req, ctx) {
      const eventId = id(req.eventId);
      return write(
        deps,
        ctx,
        C.IssueEventEntriesRequestSchema,
        C.IssueEventEntriesResponseSchema,
        req,
        async (tx) => ({ json: json(await Co.issueEntries(tx, meOf(ctx), eventId)) }),
        // The preview lists walk-ins' addresses: never stored with the idempotency key.
        { storeReply: false },
      );
    },
    async eventAttendeesRows(req, ctx) {
      return { json: json(await Co.attendeesRows(sql, meOf(ctx), id(req.eventId), filler(deps, ctx))) };
    },

    async canListenEvent(req) {
      const p = parse(z.object({ userId: z.uuid(), eventId: z.uuid() }), req);
      return { allowed: await canListenEvent(sql, p.eventId, p.userId) };
    },
  };
}
