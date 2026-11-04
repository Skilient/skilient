import "server-only";

import { dayLabel, eventTime, futureTime, shortTime } from "@/lib/format/time";
import { rpcJson } from "@/lib/data/rpc-json";
import { publicImageUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

/**
 * Society events (PRD 5.31). One SQL function per read (supabase/migrations/20261111000002_society_events.sql
 * and ..03_paid_tickets.sql) decides who sees what; this shapes the jsonb and formats dates on the server.
 */

type Raw = Record<string, unknown>;
const str = (v: unknown) => (v == null ? null : String(v));
const num = (v: unknown) => Number(v ?? 0);

export interface EventCardData {
  id: string;
  title: string;
  type: string;
  status: string;
  startsAt: string;
  startsLabel: string;
  endsAt: string;
  location: string | null;
  link: string | null;
  coverUrl: string | null;
  society: { id: string; name: string; slug: string; logoUrl: string | null } | null;
  university: string;
  ownUniversity: boolean;
  seatsLeft: number;
  paid: boolean;
  friendsGoing: number;
  myStatus: string | null;
}

export function mapEventCard(r: Raw): EventCardData {
  const s = r.society as Raw | null;
  return {
    id: String(r.id),
    title: String(r.title),
    type: String(r.type),
    status: String(r.status),
    startsAt: String(r.starts_at),
    startsLabel: eventTime(String(r.starts_at)),
    endsAt: String(r.ends_at),
    location: str(r.location),
    link: str(r.link),
    coverUrl: publicImageUrl("society-media", str(r.cover_path)),
    society: s ? { id: String(s.id), name: String(s.name), slug: String(s.slug), logoUrl: publicImageUrl("society-media", str(s.logo_path)) } : null,
    university: String(r.university ?? ""),
    ownUniversity: Boolean(r.own_university),
    seatsLeft: num(r.seats_left),
    paid: Boolean(r.paid),
    friendsGoing: num(r.friends_going),
    myStatus: str(r.my_status),
  };
}

export async function getSocietyEvents(when: "upcoming" | "past" | "mine", type: string | null): Promise<EventCardData[]> {
  return (await rpcJson<Raw[]>("society_events", { p_when: when, p_type: type })).map(mapEventCard);
}

export async function getSocietyEventList(societyId: string): Promise<EventCardData[]> {
  return (await rpcJson<Raw[]>("society_event_list", { p_society: societyId })).map(mapEventCard);
}

export interface Session {
  id: string;
  title: string | null;
  startsAt: string;
  label: string;
}

const mapSessions = (rows: unknown): Session[] =>
  ((rows ?? []) as Raw[]).map((x) => ({ id: String(x.id), title: str(x.title), startsAt: String(x.starts_at), label: eventTime(String(x.starts_at)) }));

export interface EventPageData extends EventCardData {
  description: string | null;
  eligibility: { scope: string; departments?: string[]; batches?: number[] };
  approvalMode: string;
  registrationOpensLabel: string | null;
  registrationClosesLabel: string | null;
  recordKinds: string[];
  completedMin: number | null;
  volunteerHours: boolean;
  team: { min: number; max: number } | null;
  refundPolicy: string;
  refundDays: number | null;
  cancelReason: string | null;
  officer: boolean;
  staff: boolean;
  blockReason: string | null;
  cohosts: { name: string; slug: string }[];
  sessions: Session[];
  ticketTypes: { id: string; name: string; capacity: number; pricePkr: number | null; left: number }[];
  questions: { position: number; label: string; kind: string; options: string[]; required: boolean }[];
  registration: {
    id: string;
    status: string;
    waitlistPosition: number | null;
    ticketTypeId: string | null;
    holdExpiresLabel: string | null;
    team: { name: string; code: string; members: number } | null;
  } | null;
  feedbackOpen: boolean;
}

export async function getEventPage(id: string): Promise<EventPageData> {
  const r = await rpcJson<Raw>("event_page", { p_event: id });
  const reg = r.registration as Raw | null;
  const team = r.team as Raw | null;
  return {
    ...mapEventCard(r),
    description: str(r.description),
    eligibility: (r.eligibility ?? { scope: "university" }) as EventPageData["eligibility"],
    approvalMode: String(r.approval_mode),
    registrationOpensLabel: r.registration_opens_at ? eventTime(String(r.registration_opens_at)) : null,
    registrationClosesLabel: r.registration_closes_at ? eventTime(String(r.registration_closes_at)) : null,
    recordKinds: (r.record_kinds ?? []) as string[],
    completedMin: r.completed_min == null ? null : num(r.completed_min),
    volunteerHours: Boolean(r.volunteer_hours),
    team: team ? { min: num(team.min), max: num(team.max) } : null,
    refundPolicy: String(r.refund_policy ?? "none"),
    refundDays: r.refund_days == null ? null : num(r.refund_days),
    cancelReason: str(r.cancel_reason),
    officer: Boolean(r.officer),
    staff: Boolean(r.staff),
    blockReason: str(r.block_reason),
    cohosts: (r.cohosts ?? []) as { name: string; slug: string }[],
    sessions: mapSessions(r.sessions),
    ticketTypes: ((r.ticket_types ?? []) as Raw[]).map((t) => ({
      id: String(t.id),
      name: String(t.name),
      capacity: num(t.capacity),
      pricePkr: t.price_pkr == null ? null : num(t.price_pkr),
      left: num(t.left),
    })),
    questions: ((r.questions ?? []) as Raw[]).map((q) => ({
      position: num(q.position),
      label: String(q.label),
      kind: String(q.kind),
      options: (q.options ?? []) as string[],
      required: Boolean(q.required),
    })),
    registration: reg
      ? {
          id: String(reg.id),
          status: String(reg.status),
          waitlistPosition: reg.waitlist_position == null ? null : num(reg.waitlist_position),
          ticketTypeId: str(reg.ticket_type_id),
          holdExpiresLabel: reg.hold_expires_at ? futureTime(String(reg.hold_expires_at)) : null,
          team: reg.team ? { name: String((reg.team as Raw).name), code: String((reg.team as Raw).code), members: num((reg.team as Raw).members) } : null,
        }
      : null,
    feedbackOpen: Boolean(r.feedback_open),
  };
}

export interface TicketData extends EventCardData {
  registrationId: string;
  regStatus: string;
  waitlistPosition: number | null;
  holdExpiresLabel: string | null;
  ticketType: { name: string; pricePkr: number | null } | null;
  payload: string | null;
  code: string;
  name: string;
  refundPolicy: string;
  refundDays: number | null;
  canCancel: boolean;
  checkedIn: { sessionId: string; atLabel: string }[];
  sessions: Session[];
}

export async function getTicket(eventId: string): Promise<TicketData> {
  const r = await rpcJson<Raw>("event_ticket", { p_event: eventId });
  const tt = r.ticket_type as Raw | null;
  return {
    ...mapEventCard(r),
    registrationId: String(r.registration_id),
    regStatus: String(r.status),
    waitlistPosition: r.waitlist_position == null ? null : num(r.waitlist_position),
    holdExpiresLabel: r.hold_expires_at ? futureTime(String(r.hold_expires_at)) : null,
    ticketType: tt ? { name: String(tt.name), pricePkr: tt.price_pkr == null ? null : num(tt.price_pkr) } : null,
    payload: str(r.payload),
    code: String(r.code),
    name: String(r.name ?? ""),
    refundPolicy: String(r.refund_policy ?? "none"),
    refundDays: r.refund_days == null ? null : num(r.refund_days),
    canCancel: Boolean(r.can_cancel),
    checkedIn: ((r.checked_in ?? []) as Raw[]).map((c) => ({ sessionId: String(c.session_id), atLabel: futureTime(String(c.at)) })),
    sessions: mapSessions(r.sessions),
  };
}

export interface TicketPaymentData {
  paymentId: string;
  registrationId: string;
  amountPkr: number;
  referenceCode: string;
  status: string;
  rejectReason: string | null;
  uploadedLabel: string | null;
  holdExpiresLabel: string | null;
  registrationStatus: string;
  refundStatus: string | null;
  refundNote: string | null;
  hasReceipt: boolean;
  issueRaised: boolean;
  /** Under review: the student can chase the society; 72 hours without an answer opens a report case. */
  canRaise: boolean;
  society: { name: string; slug: string } | null;
  methods: { kind: string; bankName: string | null; accountTitle: string; accountNumber: string; updatedLabel: string }[];
}

export async function getTicketPayment(eventId: string): Promise<TicketPaymentData | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ticket_payment" as never, { p_event: eventId } as never);
  if (error) {
    if (error.code === "P0002") return null;
    throw new Error(`ticket_payment failed: ${error.code}`);
  }
  const r = data as unknown as Raw;
  const uploaded = str(r.uploaded_at);
  return {
    paymentId: String(r.payment_id),
    registrationId: String(r.registration_id),
    amountPkr: num(r.amount_pkr),
    referenceCode: String(r.reference_code),
    status: String(r.status),
    rejectReason: str(r.reject_reason),
    uploadedLabel: uploaded ? futureTime(uploaded) : null,
    holdExpiresLabel: r.hold_expires_at ? futureTime(String(r.hold_expires_at)) : null,
    registrationStatus: String(r.registration_status),
    refundStatus: str(r.refund_status),
    refundNote: str(r.refund_note),
    hasReceipt: Boolean(r.has_receipt),
    issueRaised: r.issue_raised_at != null,
    canRaise: r.status === "under_review",
    society: (r.society as { name: string; slug: string } | null) ?? null,
    methods: ((r.methods ?? []) as Raw[]).map((m) => ({
      kind: String(m.kind),
      bankName: str(m.bank_name),
      accountTitle: String(m.account_title),
      accountNumber: String(m.account_number),
      updatedLabel: m.updated_at ? dayLabel(String(m.updated_at)) : "",
    })),
  };
}

export interface MyTickets {
  upcoming: (EventCardData & { registrationStatus: string; waitlistPosition: number | null })[];
  past: (EventCardData & { registrationStatus: string })[];
}

export async function getMyTickets(): Promise<MyTickets> {
  const r = await rpcJson<{ upcoming: Raw[]; past: Raw[] }>("my_tickets");
  return {
    upcoming: r.upcoming.map((x) => ({
      ...mapEventCard(x),
      registrationStatus: String(x.registration_status),
      waitlistPosition: x.waitlist_position == null ? null : num(x.waitlist_position),
    })),
    past: r.past.map((x) => ({ ...mapEventCard(x), registrationStatus: String(x.registration_status) })),
  };
}

export interface ManageData extends EventCardData {
  approvalMode: string;
  team: { min: number; max: number } | null;
  stats: { registered: number; pending: number; waitlist: number; capacity: number; checkedIn: number };
  questions: string[];
  registrations: {
    userId: string;
    name: string;
    username: string | null;
    department: string | null;
    batch: number | null;
    status: string;
    ticket: string | null;
    answers: unknown[];
    waitlistPosition: number | null;
    team: string | null;
    registeredLabel: string;
  }[];
  staff: { userId: string; name: string; username: string | null }[];
  messages: { body: string; atLabel: string }[];
  feedback: { count: number; average?: number; ratings?: Record<string, number>; suppressed?: boolean };
}

export async function getEventManage(id: string): Promise<ManageData> {
  const r = await rpcJson<Raw>("event_manage", { p_event: id });
  const s = r.stats as Raw;
  const team = r.team as Raw | null;
  const now = new Date();
  return {
    ...mapEventCard(r),
    approvalMode: String(r.approval_mode),
    team: team ? { min: num(team.min), max: num(team.max) } : null,
    stats: { registered: num(s.registered), pending: num(s.pending), waitlist: num(s.waitlist), capacity: num(s.capacity), checkedIn: num(s.checked_in) },
    questions: (r.questions ?? []) as string[],
    registrations: ((r.registrations ?? []) as Raw[]).map((x) => ({
      userId: String(x.user_id),
      name: String(x.name),
      username: str(x.username),
      department: str(x.department),
      batch: x.batch == null ? null : num(x.batch),
      status: String(x.status),
      ticket: str(x.ticket),
      answers: (x.answers ?? []) as unknown[],
      waitlistPosition: x.waitlist_position == null ? null : num(x.waitlist_position),
      team: str(x.team),
      registeredLabel: x.registered_at ? shortTime(String(x.registered_at), now) : "",
    })),
    staff: ((r.staff ?? []) as Raw[]).map((x) => ({ userId: String(x.user_id), name: String(x.name), username: str(x.username) })),
    messages: ((r.messages ?? []) as Raw[]).map((m) => ({ body: String(m.body), atLabel: shortTime(String(m.created_at), now) })),
    feedback: r.feedback as ManageData["feedback"],
  };
}

export interface PaymentRow {
  id: string;
  name: string;
  username: string | null;
  amountPkr: number;
  referenceCode: string;
  transactionId: string | null;
  status: string;
  uploadedLabel: string | null;
  receiptPath: string | null;
  receiptUrl: string | null;
  rejectReason: string | null;
  refundStatus: string | null;
  refundRequestedLabel: string | null;
  issueRaised: boolean;
  duplicates: { name: string; event: string; atLabel: string; why: string }[];
}

/** Officers' review list, with short-lived links to each receipt (private bucket; RLS lets the event's officers read). */
export async function getPaymentsReview(eventId: string): Promise<PaymentRow[]> {
  const rows = await rpcJson<Raw[]>("payments_review", { p_event: eventId });
  const supabase = await createClient();
  const paths = rows.map((r) => str(r.receipt_path)).filter((p): p is string => Boolean(p));
  const signed = paths.length ? (await supabase.storage.from("event-receipts").createSignedUrls(paths, 600)).data ?? [] : [];
  const urlFor = new Map(signed.map((s) => [s.path, s.signedUrl]));
  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    username: str(r.username),
    amountPkr: num(r.amount_pkr),
    referenceCode: String(r.reference_code),
    transactionId: str(r.transaction_id),
    status: String(r.status),
    uploadedLabel: r.uploaded_at ? futureTime(String(r.uploaded_at)) : null,
    receiptPath: str(r.receipt_path),
    receiptUrl: r.receipt_path ? (urlFor.get(String(r.receipt_path)) ?? null) : null,
    rejectReason: str(r.reject_reason),
    refundStatus: str(r.refund_status),
    refundRequestedLabel: r.refund_requested_at ? futureTime(String(r.refund_requested_at)) : null,
    issueRaised: r.issue_raised_at != null,
    duplicates: ((r.duplicates ?? []) as Raw[]).map((d) => ({ name: String(d.name), event: String(d.event), atLabel: d.at ? futureTime(String(d.at)) : "", why: String(d.why) })),
  }));
}

export interface CloseoutData extends EventCardData {
  open: boolean;
  closesLabel: string;
  recordKinds: string[];
  volunteerHours: boolean;
  activityHours: number | null;
  issued: { atLabel: string; auto: boolean; status: string } | null;
  counts: { attended: number; completed: number; results: number; volunteer: number; emails: number };
  attendees: { userId: string; name: string; username: string | null; sessions: number; teamId: string | null; place: number | null; hours: number | null }[];
  teams: { id: string; name: string; place: number | null }[];
  sessions: Session[];
  fixes: { name: string; added: boolean; reason: string | null; atLabel: string }[];
}

export async function getCloseout(id: string): Promise<CloseoutData> {
  const r = await rpcJson<Raw>("closeout_page", { p_event: id });
  const issued = r.issued as Raw | null;
  const c = r.counts as Raw;
  return {
    ...mapEventCard(r),
    open: Boolean(r.open),
    closesLabel: futureTime(String(r.closes_at)),
    recordKinds: (r.record_kinds ?? []) as string[],
    volunteerHours: Boolean(r.volunteer_hours),
    activityHours: r.activity_hours == null ? null : num(r.activity_hours),
    issued: issued ? { atLabel: issued.at ? futureTime(String(issued.at)) : "", auto: Boolean(issued.auto), status: String(issued.status) } : null,
    counts: { attended: num(c.attended), completed: num(c.completed), results: num(c.results), volunteer: num(c.volunteer), emails: num(c.emails) },
    attendees: ((r.attendees ?? []) as Raw[]).map((a) => ({
      userId: String(a.user_id),
      name: String(a.name),
      username: str(a.username),
      sessions: num(a.sessions),
      teamId: str(a.team_id),
      place: a.place == null ? null : num(a.place),
      hours: a.hours == null ? null : num(a.hours),
    })),
    teams: ((r.teams ?? []) as Raw[]).map((t) => ({ id: String(t.id), name: String(t.name), place: t.place == null ? null : num(t.place) })),
    sessions: mapSessions(r.sessions),
    fixes: ((r.fixes ?? []) as Raw[]).map((f) => ({ name: String(f.name), added: Boolean(f.added), reason: str(f.reason), atLabel: f.at ? futureTime(String(f.at)) : "" })),
  };
}

export interface HeadcountData {
  sessionId: string;
  checkedIn: number;
  expected: number;
  sessions: Session[];
}

export async function getHeadcount(eventId: string, sessionId: string | null): Promise<HeadcountData> {
  const r = await rpcJson<Raw>("event_headcount", { p_event: eventId, p_session: sessionId });
  return { sessionId: String(r.session_id), checkedIn: num(r.checked_in), expected: num(r.expected), sessions: mapSessions(r.sessions) };
}

/** The stepper's saved values for editing (officers) or duplicating an event. */
export async function getEventEditPayload(id: string): Promise<Raw> {
  return rpcJson<Raw>("event_edit_payload", { p_event: id });
}

export async function getAttendeeRows(id: string): Promise<Raw[]> {
  return rpcJson<Raw[]>("event_attendees_rows", { p_event: id });
}
