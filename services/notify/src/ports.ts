import type { CallOptions } from "@connectrpc/connect";
import { CommunityService } from "@skilient/contracts/community/v1/community_pb";
import { ContentService } from "@skilient/contracts/content/v1/content_pb";
import { CredentialsService } from "@skilient/contracts/credentials/v1/credentials_pb";
import { IdentityService } from "@skilient/contracts/identity/v1/identity_pb";
import { MessagingService } from "@skilient/contracts/messaging/v1/messaging_pb";
import { PeopleService } from "@skilient/contracts/people/v1/people_pb";
import { RankingService } from "@skilient/contracts/ranking/v1/ranking_pb";
import { WorkService } from "@skilient/contracts/work/v1/work_pb";
import type { ClientFactory } from "@skilient/platform";

/** What people's ProfileCards says about an actor or a reader. */
export interface Card {
  name: string;
  username: string;
  avatarPath: string;
  universityId: string;
  visibility: string;
}

/** Work's facts for notices (NoticeFacts). */
export interface WorkFacts {
  ventures: Map<string, { title: string; ownerId: string; memberIds: string[] }>;
  skills: Map<string, string>;
  credentials: Map<string, { title: string; reviewReason: string | null }>;
  attempts: Map<string, { title: string; skill: string }>;
  sessions: Map<string, { swapId: string; when: string; place: string; proposedBy: string }>;
}
export interface WorkWants {
  ventureIds: Set<string>;
  skillIds: Set<string>;
  credentialIds: Set<string>;
  attemptIds: Set<string>;
  sessionIds: Set<string>;
}

/** Community's facts for notices (NoticeFacts). */
export interface CommunityFacts {
  societies: Map<string, { name: string; slug: string; statusReason: string | null }>;
  events: Map<string, { title: string; startsAt: string; cancelReason: string | null; societyId: string }>;
  rounds: Map<string, { title: string; deadline: string }>;
  applications: Map<string, { team: string | null; note: string | null }>;
  payments: Map<string, { referenceCode: string; rejectReason: string | null }>;
  messages: Map<string, string>;
  invites: Map<string, string>;
  terms: Map<string, string>;
  registrations: Map<string, { paid: boolean; position: number | null }>;
  officers: Map<string, string[]>;
  audiences: Map<string, string[]>;
  registrants: Map<string, { userIds: string[]; paid: Set<string> }>;
}
export interface CommunityWants {
  societyIds: Set<string>;
  eventIds: Set<string>;
  roundIds: Set<string>;
  applicationIds: Set<string>;
  paymentIds: Set<string>;
  messageIds: Set<string>;
  inviteIds: Set<string>;
  registrationIds: Set<string>;
  officerSocietyIds: Set<string>;
  audienceSocietyIds: Set<string>;
  registrantEventIds: Set<string>;
  termIds: Set<string>;
}

/** Credentials' facts for notices (NoticeFacts). */
export interface CredentialsFacts {
  entries: Map<string, { kind: string; title: string; issuer: string; code: string; date: string; corrected: boolean; revokeReason: string | null; issuerId: string | null }>;
  corrections: Map<string, string>;
  records: Map<string, { code: string; version: number }>;
}

/**
 * Notify's calls to other services: one batch call each, never one per person or notice (CLAUDE.md, "Never");
 * `call` carries a request on (depth 2) or is a root call from a consumer or a job (`startCall`). A decoration that
 * fails never fails a notification: the consumers catch and write the notice without it.
 */
export interface Ports {
  cards(userIds: readonly string[], call: unknown): Promise<Map<string, Card>>;
  /** Friends and blocks between a reader and others (people's Relations). */
  relations(userId: string, others: readonly string[], call: unknown): Promise<Map<string, { friends: boolean; blocked: boolean }>>;
  /** Confirmed addresses (identity's EmailsOf); none for unconfirmed or banned accounts. */
  emails(userIds: readonly string[], call: unknown): Promise<Map<string, string>>;
  commentExcerpts(ids: readonly string[], call: unknown): Promise<Map<string, string>>;
  messageExcerpts(ids: readonly string[], call: unknown): Promise<Map<string, { threadId: string; excerpt: string; ventureId: string | null }>>;
  work(w: WorkWants, call: unknown): Promise<WorkFacts>;
  community(w: CommunityWants, call: unknown): Promise<CommunityFacts>;
  credentials(q: { entryIds: readonly string[]; correctionIds: readonly string[]; recordIds: readonly string[] }, call: unknown): Promise<CredentialsFacts>;
  /** Walk-ins' addresses (community's RecordFacts), read when the claim email is sent. */
  walkInEmails(attendeeIds: readonly string[], call: unknown): Promise<Map<string, string>>;
  /** Marks and returns a live university's launch recipients (people's ClaimLaunchRecipients; a write in people). */
  launchRecipients(universityId: string, call: unknown): Promise<{ university: string; recipients: { requestId: string; email: string }[] }>;
  scoredStudents(after: string | null, limit: number, call: unknown): Promise<string[]>;
}

const opt = (call: unknown) => call as CallOptions;
const cap = (xs: Iterable<string>, n = 200) => [...new Set(xs)].slice(0, n);
const orNull = (s: string) => (s === "" ? null : s);

export const emptyWork = (): WorkFacts => ({ ventures: new Map(), skills: new Map(), credentials: new Map(), attempts: new Map(), sessions: new Map() });
export const emptyCommunity = (): CommunityFacts => ({
  societies: new Map(),
  events: new Map(),
  rounds: new Map(),
  applications: new Map(),
  payments: new Map(),
  messages: new Map(),
  invites: new Map(),
  terms: new Map(),
  registrations: new Map(),
  officers: new Map(),
  audiences: new Map(),
  registrants: new Map(),
});
export const emptyCredentials = (): CredentialsFacts => ({ entries: new Map(), corrections: new Map(), records: new Map() });

export function ports(clients: ClientFactory): Ports {
  const people = () => clients.client(PeopleService);
  return {
    async cards(userIds, call) {
      if (userIds.length === 0) return new Map();
      const r = await people().profileCards({ userIds: cap(userIds, 500) }, opt(call));
      return new Map(r.users.map((u) => [u.userId, { name: u.fullName, username: u.username, avatarPath: u.avatarPath, universityId: u.universityId, visibility: u.visibility }]));
    },
    async relations(userId, others, call) {
      if (others.length === 0) return new Map();
      const r = await people().relations({ userId, otherIds: cap(others, 500) }, opt(call));
      return new Map(r.others.map((o) => [o.otherId, { friends: o.friends, blocked: o.blocked }]));
    },
    async emails(userIds, call) {
      if (userIds.length === 0) return new Map();
      const r = await clients.client(IdentityService).emailsOf({ userIds: cap(userIds, 500) }, opt(call));
      return new Map(r.users.filter((u) => u.confirmed && !u.banned && u.email).map((u) => [u.userId, u.email]));
    },
    async commentExcerpts(ids, call) {
      if (ids.length === 0) return new Map();
      const r = await clients.client(ContentService).commentExcerpts({ commentIds: cap(ids) }, opt(call));
      return new Map(r.comments.map((c) => [c.commentId, c.excerpt]));
    },
    async messageExcerpts(ids, call) {
      if (ids.length === 0) return new Map();
      const r = await clients.client(MessagingService).messageExcerpts({ messageIds: cap(ids) }, opt(call));
      return new Map(r.messages.map((m) => [m.messageId, { threadId: m.threadId, excerpt: m.excerpt, ventureId: orNull(m.ventureId) }]));
    },
    async work(w, call) {
      const r = await clients.client(WorkService).noticeFacts(
        { ventureIds: cap(w.ventureIds), skillIds: cap(w.skillIds), credentialIds: cap(w.credentialIds), attemptIds: cap(w.attemptIds), sessionIds: cap(w.sessionIds) },
        opt(call),
      );
      return {
        ventures: new Map(r.ventures.map((v) => [v.id, { title: v.title, ownerId: v.ownerId, memberIds: v.memberIds }])),
        skills: new Map(r.skills.map((s) => [s.id, s.name])),
        credentials: new Map(r.credentials.map((c) => [c.id, { title: c.title, reviewReason: orNull(c.reviewReason) }])),
        attempts: new Map(r.attempts.map((a) => [a.id, { title: a.title, skill: a.skill }])),
        sessions: new Map(r.sessions.map((s) => [s.id, { swapId: s.swapId, when: s.when, place: s.place, proposedBy: s.proposedBy }])),
      };
    },
    async community(w, call) {
      const r = await clients.client(CommunityService).noticeFacts(
        {
          societyIds: cap(w.societyIds),
          eventIds: cap(w.eventIds),
          roundIds: cap(w.roundIds),
          applicationIds: cap(w.applicationIds),
          paymentIds: cap(w.paymentIds),
          messageIds: cap(w.messageIds),
          inviteIds: cap(w.inviteIds),
          registrationIds: cap(w.registrationIds),
          officerSocietyIds: cap(w.officerSocietyIds),
          audienceSocietyIds: cap(w.audienceSocietyIds),
          registrantEventIds: cap(w.registrantEventIds),
          termIds: cap(w.termIds),
        },
        opt(call),
      );
      return {
        societies: new Map(r.societies.map((s) => [s.id, { name: s.name, slug: s.slug, statusReason: orNull(s.statusReason) }])),
        events: new Map(r.events.map((e) => [e.id, { title: e.title, startsAt: e.startsAt, cancelReason: orNull(e.cancelReason), societyId: e.societyId }])),
        rounds: new Map(r.rounds.map((x) => [x.id, { title: x.title, deadline: x.deadline }])),
        applications: new Map(r.applications.map((a) => [a.id, { team: orNull(a.team), note: orNull(a.note) }])),
        payments: new Map(r.payments.map((p) => [p.id, { referenceCode: p.referenceCode, rejectReason: orNull(p.rejectReason) }])),
        messages: new Map(r.messages.map((m) => [m.id, m.text])),
        invites: new Map(r.invites.map((m) => [m.id, m.text])),
        terms: new Map(r.terms.map((m) => [m.id, m.text])),
        registrations: new Map(r.registrations.map((x) => [x.id, { paid: x.paid, position: x.waitlistPosition || null }])),
        officers: new Map(r.officers.map((o) => [o.societyId, o.userIds])),
        audiences: new Map(r.audiences.map((o) => [o.societyId, o.userIds])),
        registrants: new Map(r.registrants.map((x) => [x.eventId, { userIds: x.userIds, paid: new Set(x.paidUserIds) }])),
      };
    },
    async credentials(q, call) {
      const r = await clients.client(CredentialsService).noticeFacts({ entryIds: cap(q.entryIds), correctionIds: cap(q.correctionIds), recordIds: cap(q.recordIds) }, opt(call));
      return {
        entries: new Map(
          r.entries.map((e) => [
            e.id,
            { kind: e.kind, title: e.title, issuer: e.issuer, code: e.code, date: e.date, corrected: e.corrected, revokeReason: orNull(e.revokeReason), issuerId: orNull(e.issuerId) },
          ]),
        ),
        corrections: new Map(r.corrections.map((c) => [c.id, c.note])),
        records: new Map(r.records.map((c) => [c.id, { code: c.code, version: c.version }])),
      };
    },
    async walkInEmails(attendeeIds, call) {
      if (attendeeIds.length === 0) return new Map();
      const r = await clients.client(CommunityService).recordFacts({ eventIds: [], attendeeIds: cap(attendeeIds), termIds: [], societyIds: [] }, opt(call));
      return new Map(r.walkIns.map((w) => [w.attendeeId, w.email]));
    },
    async launchRecipients(universityId, call) {
      const r = await people().claimLaunchRecipients({ universityId }, opt(call));
      return { university: r.universityName, recipients: r.recipients.map((x) => ({ requestId: x.requestId, email: x.email })) };
    },
    async scoredStudents(after, limit, call) {
      const r = await clients.client(RankingService).scoredStudents({ afterUserId: after ?? "", limit }, opt(call));
      return r.userIds;
    },
  };
}
