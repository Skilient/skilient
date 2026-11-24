import "server-only";

import { dayLabel, eventTime, futureTime } from "@/lib/format/time";
import { rpcJson } from "@/lib/data/rpc-json";
import { publicImageUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

/**
 * Societies (PRD 5.31). Every read is one SQL function (supabase/migrations/20261111000001_societies.sql)
 * that decides who may see what; this module only shapes the jsonb for pages and formats dates on the
 * server (ICU differs between Node and browsers).
 */

type Raw = Record<string, unknown>;
const str = (v: unknown) => (v == null ? null : String(v));
const num = (v: unknown) => Number(v ?? 0);

export interface SocietyCard {
  id: string;
  slug: string;
  name: string;
  category: string;
  about: string;
  logoUrl: string | null;
  coverUrl: string | null;
  status: string;
  membershipMode: string;
  university: string;
  members: number;
  followers: number;
  openRounds: number;
}

export function mapSocietyCard(r: Raw): SocietyCard {
  return {
    id: String(r.id),
    slug: String(r.slug),
    name: String(r.name),
    category: String(r.category),
    about: String(r.about ?? ""),
    logoUrl: publicImageUrl("society-media", str(r.logo_path)),
    coverUrl: publicImageUrl("society-media", str(r.cover_path)),
    status: String(r.status),
    membershipMode: String(r.membership_mode),
    university: String(r.university ?? ""),
    members: num(r.members),
    followers: num(r.followers),
    openRounds: num(r.open_rounds),
  };
}

export interface MyRequest {
  societyId: string;
  slug: string;
  name: string;
  status: string;
  reason: string | null;
  createdLabel: string;
  reviewDays: number;
}

function mapRequest(r: Raw): MyRequest {
  return {
    societyId: String(r.society_id),
    slug: String(r.slug),
    name: String(r.name),
    status: String(r.status),
    reason: str(r.reason),
    createdLabel: dayLabel(String(r.created_at)),
    reviewDays: num(r.review_days) || 3,
  };
}

export interface Directory {
  university: string | null;
  items: (SocietyCard & { following: boolean; member: boolean; own: boolean })[];
  mine: MyRequest[];
}

export async function getDirectory(query: string, category: string): Promise<Directory> {
  const d = await rpcJson<{ university: string | null; items: Raw[]; mine: Raw[] }>("societies_directory", {
    p_query: query || null,
    p_category: category || null,
  });
  return {
    university: d.university,
    items: d.items.map((r) => ({ ...mapSocietyCard(r), following: Boolean(r.following), member: Boolean(r.member), own: r.university === d.university })),
    mine: d.mine.map(mapRequest),
  };
}

export async function getMyRequests(): Promise<MyRequest[]> {
  return (await rpcJson<Raw[]>("my_society_requests")).map(mapRequest);
}

export interface SocietyPage extends SocietyCard {
  statusReason: string | null;
  officer: boolean;
  president: boolean;
  myRole: "president" | "officer" | "member" | null;
  following: boolean;
  joinRequested: boolean;
  rollCall: { userId: string; name: string; username: string | null; avatarUrl: string | null; role: string; title: string }[];
  former: { name: string; username: string | null; title: string; termLabel: string }[];
  rounds: { id: string; title: string; deadlineLabel: string; status: string; seats: number }[];
  checklist: { logo: boolean; officers: boolean; mode: boolean; event: boolean } | null;
}

export async function getSocietyPage(slug: string): Promise<SocietyPage> {
  const r = await rpcJson<Raw>("society_page", { p_slug: slug });
  return {
    ...mapSocietyCard(r),
    statusReason: str(r.status_reason),
    officer: Boolean(r.officer),
    president: Boolean(r.president),
    myRole: (r.my_role as SocietyPage["myRole"]) ?? null,
    following: Boolean(r.following),
    joinRequested: Boolean(r.join_requested),
    rollCall: ((r.roll_call ?? []) as Raw[]).map((m) => ({
      userId: String(m.user_id),
      name: String(m.name),
      username: str(m.username),
      avatarUrl: publicImageUrl("avatars", str(m.avatar_path)),
      role: String(m.role),
      title: String(m.title),
    })),
    former: ((r.former ?? []) as Raw[]).map((m) => ({
      name: String(m.name),
      username: str(m.username),
      title: String(m.title),
      termLabel: `${dayLabel(String(m.term_start))} – ${dayLabel(String(m.term_end))}`,
    })),
    rounds: ((r.rounds ?? []) as Raw[]).map((x) => ({
      id: String(x.id),
      title: String(x.title),
      deadlineLabel: futureTime(String(x.deadline)),
      status: String(x.status),
      seats: num(x.seats),
    })),
    checklist: r.checklist ? (r.checklist as SocietyPage["checklist"]) : null,
  };
}

export interface SocietyManage extends Omit<SocietyCard, "members"> {
  memberCount: number;
  president: boolean;
  paidPaused: boolean;
  members: { userId: string; name: string; username: string | null; role: string; title: string | null; joinedLabel: string }[];
  joinRequests: { userId: string; name: string; username: string | null; createdLabel: string }[];
  invites: { id: string; kind: string; name: string; title: string | null; termLabel: string | null }[];
  terms: {
    id: string;
    userId: string;
    name: string;
    role: string;
    title: string;
    termLabel: string;
    ended: boolean;
    confirmed: boolean;
    due: boolean;
    canConfirm: boolean;
  }[];
}

export async function getSocietyManage(societyId: string): Promise<SocietyManage> {
  const r = await rpcJson<Raw>("society_manage", { p_society: societyId });
  const { members: memberCount, ...card } = mapSocietyCard(r);
  return {
    ...card,
    memberCount,
    members: ((r.members ?? []) as Raw[]).map((m) => ({
      userId: String(m.user_id),
      name: String(m.name),
      username: str(m.username),
      role: String(m.role),
      title: str(m.title),
      joinedLabel: dayLabel(String(m.joined_at)),
    })),
    president: Boolean(r.president),
    paidPaused: Boolean(r.paid_paused),
    joinRequests: ((r.join_requests ?? []) as Raw[]).map((m) => ({
      userId: String(m.user_id),
      name: String(m.name),
      username: str(m.username),
      createdLabel: dayLabel(String(m.created_at)),
    })),
    invites: ((r.invites ?? []) as Raw[]).map((m) => ({
      id: String(m.id),
      kind: String(m.kind),
      name: String(m.name),
      title: str(m.title),
      termLabel: m.term_start ? `${dayLabel(String(m.term_start))} – ${dayLabel(String(m.term_end))}` : null,
    })),
    terms: ((r.terms ?? []) as Raw[]).map((t) => ({
      id: String(t.id),
      userId: String(t.user_id),
      name: String(t.name),
      role: String(t.role),
      title: String(t.title),
      termLabel: `${dayLabel(String(t.term_start))} – ${dayLabel(String(t.term_end))}`,
      ended: t.ended_at != null,
      confirmed: t.confirmed_at != null,
      due: Boolean(t.due),
      canConfirm: Boolean(t.can_confirm),
    })),
  };
}

/** The society id behind a slug for its officers, or null (pages answer 404). */
export async function officerSociety(slug: string): Promise<SocietyPage | null> {
  try {
    const page = await getSocietyPage(slug);
    return page.officer ? page : null;
  } catch {
    return null;
  }
}

export interface MyInvite {
  id: string;
  kind: string;
  title: string | null;
  society: string;
  slug: string;
  termLabel: string | null;
}

export async function getMyInvites(): Promise<MyInvite[]> {
  const rows = await rpcJson<Raw[]>("my_society_invites");
  return rows.map((r) => ({
    id: String(r.id),
    kind: String(r.kind),
    title: str(r.title),
    society: String(r.society),
    slug: String(r.slug),
    termLabel: r.term_start ? `${dayLabel(String(r.term_start))} – ${dayLabel(String(r.term_end))}` : null,
  }));
}

export async function getMyOfficerSocieties(): Promise<{ id: string; name: string; slug: string; logoUrl: string | null }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_officer_societies");
  if (error) return [];
  return ((data ?? []) as Raw[]).map((r) => ({ id: String(r.id), name: String(r.name), slug: String(r.slug), logoUrl: publicImageUrl("society-media", str(r.logo_path)) }));
}

export interface InductionRound {
  id: string;
  title: string;
  description: string | null;
  deadlineLabel: string;
  deadline: string;
  status: string;
  closed: boolean;
  society: SocietyCard;
  officer: boolean;
  roles: { id: string; title: string; seats: number; filled: number }[];
  questions: string[];
  mine: { id: string; status: string; note: string | null; roleId: string } | null;
  applications:
    | { id: string; name: string; username: string | null; roleId: string; answers: string[]; status: string; note: string | null; createdLabel: string }[]
    | null;
}

export async function getInductionRound(id: string): Promise<InductionRound> {
  const r = await rpcJson<Raw>("induction_round_page", { p_round: id });
  const mine = r.mine as Raw | null;
  return {
    id: String(r.id),
    title: String(r.title),
    description: str(r.description),
    deadline: String(r.deadline),
    deadlineLabel: eventTime(String(r.deadline)),
    status: String(r.status),
    closed: Boolean(r.closed),
    society: mapSocietyCard(r.society as Raw),
    officer: Boolean(r.officer),
    roles: ((r.roles ?? []) as Raw[]).map((x) => ({ id: String(x.id), title: String(x.title), seats: num(x.seats), filled: num(x.filled) })),
    questions: (r.questions ?? []) as string[],
    mine: mine ? { id: String(mine.id), status: String(mine.status), note: str(mine.note), roleId: String(mine.role_id) } : null,
    applications: r.applications
      ? ((r.applications as Raw[]).map((a) => ({
          id: String(a.id),
          name: String(a.name),
          username: str(a.username),
          roleId: String(a.role_id),
          answers: (a.answers ?? []) as string[],
          status: String(a.status),
          note: str(a.note),
          createdLabel: dayLabel(String(a.created_at)),
        })) as InductionRound["applications"])
      : null,
  };
}

export interface PaymentDetails {
  society: SocietyCard;
  paidPaused: boolean;
  active: { id: string; kind: string; bankName: string | null; accountTitle: string; accountNumber: string; effectiveLabel: string }[];
  proposals: {
    id: string;
    action: string;
    replacesId: string | null;
    kind: string;
    bankName: string | null;
    accountTitle: string;
    accountNumber: string;
    proposedBy: string;
    proposedLabel: string;
    mine: boolean;
  }[];
  history: { action: string; actor: string; atLabel: string }[];
}

export async function getPaymentDetails(societyId: string): Promise<PaymentDetails> {
  const r = await rpcJson<Raw>("payment_details_page", { p_society: societyId });
  return {
    society: mapSocietyCard(r.society as Raw),
    paidPaused: Boolean(r.paid_paused),
    active: ((r.active ?? []) as Raw[]).map((m) => ({
      id: String(m.id),
      kind: String(m.kind),
      bankName: str(m.bank_name),
      accountTitle: String(m.account_title),
      accountNumber: String(m.account_number),
      effectiveLabel: m.effective_at ? dayLabel(String(m.effective_at)) : "",
    })),
    proposals: ((r.proposals ?? []) as Raw[]).map((m) => ({
      id: String(m.id),
      action: String(m.action),
      replacesId: str(m.replaces_id),
      kind: String(m.kind),
      bankName: str(m.bank_name),
      accountTitle: String(m.account_title ?? ""),
      accountNumber: String(m.account_number ?? ""),
      proposedBy: String(m.proposed_by ?? ""),
      proposedLabel: dayLabel(String(m.proposed_at)),
      mine: Boolean(m.mine),
    })),
    history: ((r.history ?? []) as Raw[]).map((h) => ({ action: String(h.action), actor: String(h.actor ?? ""), atLabel: futureTime(String(h.at)) })),
  };
}

// ---------------------------------------------------------------------------
// /ops/societies (trust reviewers)
// ---------------------------------------------------------------------------
export interface OpsSocietyRow {
  societyId: string;
  name: string;
  slug: string;
  category: string;
  university: string;
  status: string;
  requestStatus: string;
  requester: string;
  ageHours: number;
  claimedBy: string | null;
  mine: boolean;
}

export async function getOpsSocieties(status: string): Promise<OpsSocietyRow[]> {
  const rows = await rpcJson<Raw[]>("ops_societies", { p_status: status });
  return rows.map((r) => ({
    societyId: String(r.society_id),
    name: String(r.name),
    slug: String(r.slug),
    category: String(r.category),
    university: String(r.university),
    status: String(r.status),
    requestStatus: String(r.request_status),
    requester: String(r.requester),
    ageHours: num(r.age_hours),
    claimedBy: str(r.claimed_by),
    mine: Boolean(r.mine),
  }));
}

export interface OpsSocietyCase extends SocietyCard {
  requestId: string;
  requestStatus: string;
  proofPath: string | null;
  proofUrl: string | null;
  officeBearer: boolean;
  staffNote: string | null;
  createdLabel: string;
  claimedBy: string | null;
  mine: boolean;
  requester: { name: string; username: string | null; department: string | null; graduationYear: number | null } | null;
  statusReason: string | null;
  paidPaused?: boolean;
}

export async function getOpsSocietyCase(id: string): Promise<OpsSocietyCase> {
  const r = await rpcJson<Raw>("ops_society_case", { p_society: id });
  const q = r.requester as Raw | null;
  return {
    ...mapSocietyCard(r),
    requestId: String(r.request_id),
    requestStatus: String(r.request_status),
    proofPath: str(r.proof_path),
    proofUrl: str(r.proof_url),
    officeBearer: Boolean(r.office_bearer),
    staffNote: str(r.staff_note),
    createdLabel: dayLabel(String(r.created_at)),
    claimedBy: str(r.claimed_by),
    mine: Boolean(r.mine),
    requester: q ? { name: String(q.name), username: str(q.username), department: str(q.department), graduationYear: q.graduation_year == null ? null : num(q.graduation_year) } : null,
    statusReason: str(r.status_reason),
  };
}

/** A short-lived link to the proof document for the reviewer (the bucket is private; RLS lets trust staff read). */
export async function proofLink(path: string | null): Promise<string | null> {
  if (!path) return null;
  const supabase = await createClient();
  const { data } = await supabase.storage.from("society-documents").createSignedUrl(path, 300);
  return data?.signedUrl ?? null;
}
