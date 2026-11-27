import type postgres from "postgres";
import { refused } from "../refusals";

export type Tx = postgres.TransactionSql;
export type Db = postgres.Sql | Tx;
export type Row = Record<string, unknown>;

/** Fills a document's people and university placeholders (src/domain/people.ts): people's batch reads, or the fixture. */
export type Filler = <T>(doc: T) => Promise<T>;
/** Whether the reader holds a staff role that sees pending societies (trust reviewer, moderator); asked only when needed. */
export type StaffCheck = () => Promise<boolean>;
export const noStaff: StaffCheck = async () => false;

export interface Me {
  id: string;
  university_id: string | null;
  role: string;
  status: string | null;
}

/** `require_user()`: signed in and onboarded (people's copy). */
export async function requireUser(db: Db, me: string | null): Promise<Me> {
  if (!me) throw refused("not_signed_in");
  const [m] = await db<{ university_id: string | null; role: string; status: string | null }[]>`
    select university_id::text, role, status from community.members where user_id = ${me} and onboarding_complete`;
  if (!m) throw refused("finish_onboarding");
  return { id: me, ...m };
}

/** The reader's university (`current_university_id()`), or null. */
export async function universityOf(db: Db, me: string | null): Promise<string | null> {
  if (!me) return null;
  const [m] = await db<{ u: string | null }[]>`select university_id::text as u from community.members where user_id = ${me}`;
  return m?.u ?? null;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
export interface SocietyLimits {
  max_officers: number;
  induction_questions: number;
  induction_max_days: number;
  undecided_decline_days: number;
  review_days: number;
}
export interface EventLimits {
  min_pkr: number;
  max_pkr: number;
  hold_hours: number;
  max_ticket_types: number;
  max_sessions: number;
  max_questions: number;
  closeout_hours: number;
  feedback_days: number;
  receipt_delete_days: number;
  dispute_hours: number;
  refund_flag_days: number;
  feedback_min_group: number;
}

export async function societyLimits(db: Db): Promise<SocietyLimits> {
  const [r] = await db<{ value: SocietyLimits }[]>`select value from community.config where key = 'societies.limits'`;
  return r!.value;
}
export async function eventLimits(db: Db): Promise<EventLimits> {
  const [r] = await db<{ value: EventLimits }[]>`select value from community.config where key = 'events.ticket_limits'`;
  return r!.value;
}

// ---------------------------------------------------------------------------
// Societies
// ---------------------------------------------------------------------------
export interface Society {
  id: string;
  university_id: string;
  slug: string;
  name: string;
  name_key: string;
  category: string;
  about: string;
  logo_path: string | null;
  cover_path: string | null;
  status: string;
  status_reason: string | null;
  membership_mode: string;
  paid_paused: boolean;
  created_by: string | null;
  verified_by: string | null;
  verified_at: Date | null;
  created_at: Date;
  updated_at: Date;
}
const SOCIETY = (db: Db) => db`id::text, university_id::text, slug, name, name_key, category, about, logo_path, cover_path, status, status_reason,
  membership_mode, paid_paused, created_by::text, verified_by::text, verified_at, created_at, updated_at`;

export async function society(db: Db, id: string, lock = false): Promise<Society | undefined> {
  const [s] = lock
    ? await db<Society[]>`select ${SOCIETY(db)} from community.societies where id = ${id} for update`
    : await db<Society[]>`select ${SOCIETY(db)} from community.societies where id = ${id}`;
  return s;
}
export async function societyBySlug(db: Db, slug: string): Promise<Society | undefined> {
  const [s] = await db<Society[]>`select ${SOCIETY(db)} from community.societies where slug = ${slug}`;
  return s;
}

/** `is_society_officer(society, user)`: president or officer. */
export async function isOfficer(db: Db, societyId: string, user: string | null): Promise<boolean> {
  if (!user) return false;
  const [r] = await db<{ x: boolean }[]>`
    select exists (select 1 from community.society_members where society_id = ${societyId} and user_id = ${user} and role in ('president', 'officer')) as x`;
  return r!.x;
}
export async function isPresident(db: Db, societyId: string, user: string | null): Promise<boolean> {
  if (!user) return false;
  const [r] = await db<{ x: boolean }[]>`
    select exists (select 1 from community.society_members where society_id = ${societyId} and user_id = ${user} and role = 'president') as x`;
  return r!.x;
}

/**
 * `can_see_society`: verified ones for any signed-in student not being deleted; pending ones only the requester,
 * its officers and trust staff (and moderators).
 */
export async function canSeeSociety(db: Db, s: Society | undefined, me: string | null, staff: StaffCheck): Promise<boolean> {
  if (!s || !me) return false;
  if (s.status === "verified") {
    const [v] = await db<{ x: boolean }[]>`select exists (select 1 from community.members where user_id = ${me} and status is distinct from 'deleting') as x`;
    if (v!.x) return true;
  }
  if (s.created_by === me || (await isOfficer(db, s.id, me))) return true;
  return staff();
}

/** `require_society_officer(society, president)`: an officer (the president when asked), not suspended. */
export async function requireOfficer(db: Db, societyId: string, me: string | null, president = false, lock = false): Promise<Society> {
  const s = await society(db, societyId, lock);
  if (!s || !(await isOfficer(db, societyId, me))) throw refused("society_not_found");
  if (president && !(await isPresident(db, societyId, me))) throw refused("president_only");
  if (s.status === "suspended") throw refused("society_suspended");
  return s;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
export interface Event {
  id: string;
  university_id: string;
  society_id: string;
  created_by: string | null;
  type: string;
  scope: string;
  title: string;
  description: string | null;
  starts_at: Date;
  ends_at: Date;
  location: string | null;
  link: string | null;
  cancelled_at: Date | null;
  status: string;
  record_kinds: string[];
  completed_min: number | null;
  volunteer_hours: boolean;
  team_min: number | null;
  team_max: number | null;
  approval_mode: string;
  registration_opens_at: Date | null;
  registration_closes_at: Date | null;
  eligibility: { scope: string; departments?: string[]; batches?: number[] };
  cover_path: string | null;
  refund_policy: string;
  refund_days: number | null;
  post_id: string | null;
  published_at: Date | null;
  cancel_reason: string | null;
  created_at: Date;
}
const EVENT = (db: Db) => db`id::text, university_id::text, society_id::text, created_by::text, type, scope, title, description, starts_at, ends_at,
  location, link, cancelled_at, status, record_kinds, completed_min, volunteer_hours, team_min, team_max, approval_mode, registration_opens_at,
  registration_closes_at, eligibility, cover_path, refund_policy, refund_days, post_id::text, published_at, cancel_reason, created_at`;

export async function event(db: Db, id: string, lock = false): Promise<Event | undefined> {
  const [e] = lock
    ? await db<Event[]>`select ${EVENT(db)} from community.events where id = ${id} for update`
    : await db<Event[]>`select ${EVENT(db)} from community.events where id = ${id}`;
  return e;
}

/** `is_event_officer(event, user)`: officers of the host or of an accepted co-host. */
export async function isEventOfficer(db: Db, eventId: string, user: string | null): Promise<boolean> {
  if (!user) return false;
  const [r] = await db<{ x: boolean }[]>`
    select exists (select 1 from community.events e
                    where e.id = ${eventId}
                      and (exists (select 1 from community.society_members m where m.society_id = e.society_id and m.user_id = ${user} and m.role in ('president', 'officer'))
                           or exists (select 1 from community.event_cohosts c join community.society_members m on m.society_id = c.society_id
                                       where c.event_id = e.id and c.status = 'accepted' and m.user_id = ${user} and m.role in ('president', 'officer')))) as x`;
  return r!.x;
}

/** `is_event_staff`: an event officer or one of its staff. */
export async function isEventStaff(db: Db, eventId: string, user: string | null): Promise<boolean> {
  if (!user) return false;
  if (await isEventOfficer(db, eventId, user)) return true;
  const [r] = await db<{ x: boolean }[]>`select exists (select 1 from community.event_staff where event_id = ${eventId} and user_id = ${user}) as x`;
  return r!.x;
}

/** `event_topic_staff`: officers of the host or an accepted co-host, or event staff, in one query (realtime's event: topic). */
export async function canListenEvent(db: Db, eventId: string, user: string): Promise<boolean> {
  const [r] = await db<{ x: boolean }[]>`
    select exists (select 1 from community.events e
                    where e.id = ${eventId}
                      and (exists (select 1 from community.society_members m where m.society_id = e.society_id and m.user_id = ${user} and m.role in ('president', 'officer'))
                           or exists (select 1 from community.event_cohosts c join community.society_members m on m.society_id = c.society_id
                                       where c.event_id = e.id and c.status = 'accepted' and m.user_id = ${user} and m.role in ('president', 'officer'))
                           or exists (select 1 from community.event_staff s where s.event_id = e.id and s.user_id = ${user}))) as x`;
  return r!.x;
}

export async function requireEventOfficer(db: Db, eventId: string, me: string | null, lock = false): Promise<Event> {
  const e = await event(db, eventId, lock);
  if (!e || !(await isEventOfficer(db, eventId, me))) throw refused("event_not_found");
  return e;
}
export async function requireEventStaff(db: Db, eventId: string, me: string | null): Promise<Event> {
  const e = await event(db, eventId);
  if (!e || !(await isEventStaff(db, eventId, me))) throw refused("event_not_found");
  return e;
}

/** Times as the stack's JSON wrote them (timestamptz to_json: ISO with the offset). */
export const iso = (d: Date | string | null | undefined) => (d == null ? null : new Date(d).toISOString());
