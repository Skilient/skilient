import type { CommunityFacts, CommunityWants, CredentialsFacts, WorkFacts, WorkWants } from "../ports";

/**
 * Which notices each event makes (the stack's notify triggers and the private.notify calls in its functions, now
 * fed by events; docs/azure/notify-function-bins.md names each source). Pure: `wants` says which titles a batch
 * needs from their owners, `build` turns one event and the owners' answers into operations. Payloads carry ids
 * only; titles, names, excerpts and reasons come from the owners' batch reads, snapshotted into `data` as the stack
 * snapshotted them. A missing fact (the owner unreachable or the row gone) leaves its field null, and the wording
 * falls back as it did on the stack ("a venture", "the event").
 */

export interface Event {
  type: string;
  payload: Record<string, unknown>;
  at?: string;
}

export interface Notice {
  op: "notify";
  user: string;
  actor: string | null;
  type: string;
  entityType: string;
  entityId: string;
  data: Record<string, unknown>;
}
/** A chat message: refreshes the unread notice for the thread, or makes one (notify_chat_message). */
export interface Chat {
  op: "chat";
  user: string;
  actor: string;
  threadId: string;
  data: Record<string, unknown>;
}
/** Takes back unread notices (a cancelled friend request, a revoked invite, an undone share). */
export interface Retract {
  op: "retract";
  entityType: string;
  entityId: string;
  type?: string;
  actor?: string;
  since?: string;
}
/** Marks a thread's chat notices read (mark_thread_read). */
export interface ReadThread {
  op: "read_thread";
  user: string;
  threadId: string;
}
/** A one-off email (record_claim). */
export interface Email {
  op: "email";
  kind: "record_claim";
  payload: Record<string, unknown>;
}
/** A job (university launch emails, the formula notice). */
export interface Later {
  op: "job";
  kind: "university-launch" | "formula-notice";
  payload: Record<string, unknown>;
  dedupe: string;
}
export type Op = Notice | Chat | Retract | ReadThread | Email | Later;

export interface Wants {
  comments: Set<string>;
  messages: Set<string>;
  work: WorkWants;
  community: CommunityWants;
  credentials: { entryIds: Set<string>; correctionIds: Set<string>; recordIds: Set<string> };
  cards: Set<string>;
}

export interface Facts {
  comments: Map<string, string>;
  messages: Map<string, { threadId: string; excerpt: string; ventureId: string | null }>;
  work: WorkFacts;
  community: CommunityFacts;
  credentials: CredentialsFacts;
  /** First and full names of people (people's ProfileCards). */
  names: Map<string, { name: string; username: string }>;
}

export function emptyWants(): Wants {
  const s = () => new Set<string>();
  return {
    comments: s(),
    messages: s(),
    work: { ventureIds: s(), skillIds: s(), credentialIds: s(), attemptIds: s(), sessionIds: s() },
    community: {
      societyIds: s(),
      eventIds: s(),
      roundIds: s(),
      applicationIds: s(),
      paymentIds: s(),
      messageIds: s(),
      inviteIds: s(),
      registrationIds: s(),
      officerSocietyIds: s(),
      audienceSocietyIds: s(),
      registrantEventIds: s(),
      termIds: s(),
    },
    credentials: { entryIds: s(), correctionIds: s(), recordIds: s() },
    cards: s(),
  };
}

const str = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);
const ids = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const add = (set: Set<string>, v: unknown) => {
  const s = str(v);
  if (s) set.add(s);
};

/** Every event type notify handles, with the role that owns it. */
export const NOTICE_EVENTS = {
  "friend_request.changed": "svc_people",
  "university.domains_changed": "svc_people",
  "post.created": "svc_content",
  "comment.created": "svc_content",
  "message.sent": "svc_messaging",
  "message.deleted": "svc_messaging",
  "thread.read": "svc_messaging",
  "application.changed": "svc_work",
  "venture.invite_changed": "svc_work",
  "venture.updated": "svc_work",
  "venture.completed": "svc_work",
  "group.member_changed": "svc_work|svc_community",
  "endorsement.given": "svc_work",
  "code_check.changed": "svc_work",
  "credential.changed": "svc_work",
  "task.completed": "svc_work",
  "task_review.changed": "svc_work",
  "swap.changed": "svc_work",
  "swap.closed": "svc_work",
  "tier.changed": "svc_ranking",
  "config.changed": "svc_trust",
  "society.status_changed": "svc_community",
  "society.invite_changed": "svc_community",
  "society.join_changed": "svc_community",
  "society.term_changed": "svc_community",
  "induction.changed": "svc_community",
  "induction_application.changed": "svc_community",
  "event.updated": "svc_community",
  "event.registered": "svc_community",
  "event.reminder_due": "svc_community",
  "event.cohost_changed": "svc_community",
  "event.staff_changed": "svc_community",
  "event.message_sent": "svc_community",
  "event.closed": "svc_community",
  "payment.changed": "svc_community",
  "payment_method.changed": "svc_community",
  "record.sealed": "svc_credentials",
  "record.revoked": "svc_credentials",
  "record.awaiting": "svc_credentials",
  "record.mistake_reported": "svc_credentials",
  "record.mistake_declined": "svc_credentials",
  "record.claim_held": "svc_credentials",
  "cv.issued": "svc_credentials",
  "cv.revoked": "svc_credentials",
} as const;
export type NoticeEvent = keyof typeof NOTICE_EVENTS;

/** Adds what one event needs from owners to the batch's wants. */
export function want(e: Event, w: Wants): void {
  const p = e.payload;
  const c = w.community;
  switch (e.type) {
    case "post.created":
      if (str(p["society_id"])) {
        add(c.societyIds, p["society_id"]);
        add(c.audienceSocietyIds, p["society_id"]);
      }
      return;
    case "comment.created":
      add(w.comments, p["comment_id"]);
      return;
    case "message.sent":
      add(w.messages, p["message_id"]);
      return;
    case "application.changed":
    case "venture.invite_changed":
    case "venture.completed":
    case "endorsement.given":
      add(w.work.ventureIds, p["venture_id"]);
      if (e.type === "endorsement.given") {
        for (const s of ids(p["skill_ids"])) w.work.skillIds.add(s);
        add(w.cards, p["endorsee_id"]);
      }
      return;
    case "venture.updated":
      add(w.work.ventureIds, p["venture_id"]);
      return;
    case "group.member_changed":
      if (p["kind"] === "venture" && p["member"] === false) add(w.work.ventureIds, p["group_id"]);
      return;
    case "code_check.changed":
      add(w.work.skillIds, p["skill_id"]);
      return;
    case "credential.changed":
      add(w.work.credentialIds, p["credential_id"]);
      return;
    case "task_review.changed":
      add(w.work.attemptIds, p["attempt_id"]);
      add(w.cards, p["student_id"]);
      return;
    case "swap.changed":
      add(w.work.skillIds, p["skill_id"]);
      add(w.work.skillIds, p["offered_skill_id"]);
      add(w.work.sessionIds, p["session_id"]);
      return;
    case "society.status_changed":
    case "society.join_changed":
      add(c.societyIds, p["society_id"]);
      if (e.type === "society.join_changed") add(c.officerSocietyIds, p["society_id"]);
      return;
    case "society.invite_changed":
      add(c.societyIds, p["society_id"]);
      add(c.inviteIds, p["invite_id"]);
      return;
    case "society.term_changed":
      add(c.societyIds, p["society_id"]);
      add(c.officerSocietyIds, p["society_id"]);
      add(c.termIds, p["term_id"]);
      return;
    case "induction.changed":
      add(c.societyIds, p["society_id"]);
      add(c.roundIds, p["round_id"]);
      add(c.audienceSocietyIds, p["society_id"]);
      return;
    case "induction_application.changed":
      add(c.societyIds, p["society_id"]);
      add(c.roundIds, p["round_id"]);
      add(c.applicationIds, p["application_id"]);
      add(c.officerSocietyIds, p["society_id"]);
      return;
    case "event.updated":
      add(c.eventIds, p["event_id"]);
      add(c.societyIds, p["society_id"]);
      if (p["change"] === "published") add(c.audienceSocietyIds, p["society_id"]);
      else add(c.registrantEventIds, p["event_id"]);
      return;
    case "event.registered":
      add(c.eventIds, p["event_id"]);
      add(c.registrationIds, p["registration_id"]);
      return;
    case "event.reminder_due":
    case "event.staff_changed":
      add(c.eventIds, p["event_id"]);
      return;
    case "event.cohost_changed":
      add(c.eventIds, p["event_id"]);
      add(c.societyIds, p["host_society_id"]);
      add(c.officerSocietyIds, p["society_id"]);
      return;
    case "event.message_sent":
      add(c.eventIds, p["event_id"]);
      add(c.messageIds, p["message_id"]);
      add(c.registrantEventIds, p["event_id"]);
      return;
    case "payment.changed":
      add(c.eventIds, p["event_id"]);
      add(c.paymentIds, p["payment_id"]);
      add(c.officerSocietyIds, p["society_id"]);
      return;
    case "payment_method.changed":
      add(c.societyIds, p["society_id"]);
      add(c.officerSocietyIds, p["society_id"]);
      return;
    case "record.sealed":
    case "record.revoked":
    case "record.awaiting":
    case "record.mistake_reported":
    case "record.mistake_declined":
      add(w.credentials.entryIds, p["entry_id"]);
      if (e.type === "record.mistake_declined") add(w.credentials.correctionIds, p["correction_id"]);
      if (e.type === "record.awaiting" || e.type === "record.mistake_reported") add(c.societyIds, p["society_id"]);
      return;
    case "record.claim_held":
      add(c.eventIds, p["event_id"]);
      return;
    case "cv.revoked":
      for (const r of ids(p["record_ids"]).slice(0, 1)) w.credentials.recordIds.add(r);
      return;
    default:
      return;
  }
}

/** today's venture_data(): {venture_id, venture_title}; the title as it is now. */
function venture(f: Facts, id: unknown): Record<string, unknown> {
  const v = str(id);
  return v ? { venture_id: v, venture_title: f.work.ventures.get(v)?.title ?? null } : {};
}
function society(f: Facts, id: unknown): { society: string | null; slug: string | null } {
  const s = f.community.societies.get(str(id) ?? "");
  return { society: s?.name ?? null, slug: s?.slug ?? null };
}
const eventTitle = (f: Facts, id: unknown) => f.community.events.get(str(id) ?? "")?.title ?? null;
const skill = (f: Facts, id: unknown) => f.work.skills.get(str(id) ?? "") ?? null;
const firstName = (f: Facts, id: unknown) => {
  const n = f.names.get(str(id) ?? "")?.name;
  return n ? n.split(" ")[0]! : null;
};

/** The stack's date formats: `FMDy DD Mon, HH24:MI` for swap sessions (Pakistan time). */
function notice(user: unknown, actor: unknown, type: string, entityType: string, entityId: unknown, data: Record<string, unknown> = {}): Notice[] {
  const u = str(user);
  const id = str(entityId);
  if (!u || !id) return [];
  return [{ op: "notify", user: u, actor: str(actor), type, entityType, entityId: id, data }];
}
const each = (users: readonly string[], f: (u: string) => Notice[]) => users.flatMap(f);

/** The operations one event makes. */
export function build(e: Event, f: Facts): Op[] {
  const p = e.payload;
  switch (e.type) {
    // ---- people ----
    case "friend_request.changed": {
      const status = p["status"];
      if (status === "pending") return notice(p["receiver_id"], p["sender_id"], "friend_request", "friend_request", p["request_id"]);
      if (status === "accepted") return notice(p["sender_id"], p["receiver_id"], "friend_accepted", "friend_request", p["request_id"]);
      if (status === "cancelled") return [{ op: "retract", entityType: "friend_request", entityId: String(p["request_id"]), type: "friend_request" }];
      return [];
    }
    case "university.domains_changed": {
      const live = str(p["live_at"]);
      const uni = str(p["university_id"]);
      return live && uni ? [{ op: "job", kind: "university-launch", payload: { university_id: uni }, dedupe: `launch:${uni}:${live}` }] : [];
    }

    // ---- content ----
    case "post.created": {
      const soc = str(p["society_id"]);
      if (!soc) return [];
      const audience = f.community.audiences.get(soc) ?? [];
      return each(audience, (u) => notice(u, p["author_id"], "society_post", "post", p["post_id"], society(f, soc)));
    }
    case "comment.created": {
      const data = { post_id: p["post_id"], comment_id: p["comment_id"], excerpt: f.comments.get(String(p["comment_id"])) ?? null };
      const author = str(p["author_id"]);
      const postAuthor = str(p["post_author_id"]);
      const parent = str(p["parent_author_id"]);
      const out = notice(postAuthor, author, "comment_received", "post", p["post_id"], data);
      if (parent && parent !== postAuthor) out.push(...notice(parent, author, "comment_reply", "post", p["post_id"], data));
      const skip = new Set([author, postAuthor, parent ?? author]);
      for (const m of ids(p["mentioned_ids"]).filter((m) => !skip.has(m)).slice(0, 5)) out.push(...notice(m, author, "comment_mention", "post", p["post_id"], data));
      return out;
    }

    // ---- messaging ----
    case "message.sent": {
      const m = f.messages.get(String(p["message_id"]));
      const thread = str(p["thread_id"]);
      const sender = str(p["sender_id"]);
      if (!thread || !sender) return [];
      const data = {
        thread_id: thread,
        venture_title: m?.ventureId ? (f.work.ventures.get(m.ventureId)?.title ?? null) : null,
        excerpt: m?.excerpt ?? null,
      };
      return ids(p["recipient_ids"]).filter((u) => u !== sender).map((u) => ({ op: "chat", user: u, actor: sender, threadId: thread, data }) as Chat);
    }
    case "thread.read":
      return str(p["user_id"]) && str(p["thread_id"]) ? [{ op: "read_thread", user: String(p["user_id"]), threadId: String(p["thread_id"]) }] : [];
    case "message.deleted":
      return p["undone_share"] === true && str(p["thread_id"]) && str(p["sender_id"])
        ? [{ op: "retract", entityType: "chat_thread", entityId: String(p["thread_id"]), type: "chat_message", actor: String(p["sender_id"]), ...(e.at ? { since: e.at } : {}) }]
        : [];

    // ---- work ----
    case "application.changed": {
      const status = p["status"];
      const prev = p["previous_status"] ?? null;
      const v = venture(f, p["venture_id"]);
      if (prev === null && status === "pending") return notice(p["owner_id"], p["candidate_id"], "application_received", "application", p["application_id"], v);
      if (prev === "pending" && (status === "accepted" || status === "declined" || status === "closed"))
        return notice(p["candidate_id"], status === "closed" ? null : p["owner_id"], "application_decided", "application", p["application_id"], { ...v, status });
      if (prev === "pending" && status === "withdrawn") return notice(p["owner_id"], p["candidate_id"], "application_withdrawn", "application", p["application_id"], v);
      return [];
    }
    case "venture.invite_changed": {
      const status = p["status"];
      const prev = p["previous_status"] ?? null;
      const v = venture(f, p["venture_id"]);
      if (prev === null && status === "pending") return notice(p["invitee_id"], p["inviter_id"], "invite_received", "venture_invite", p["invite_id"], v);
      if (prev === "pending" && (status === "accepted" || status === "declined"))
        return notice(p["inviter_id"], p["invitee_id"], "invite_answered", "venture_invite", p["invite_id"], { ...v, status });
      if (prev === "pending" && status === "revoked") return [{ op: "retract", entityType: "venture_invite", entityId: String(p["invite_id"]) }];
      return [];
    }
    case "venture.updated": {
      const out: Op[] = [];
      const id = p["venture_id"];
      const actor = str(p["actor_id"]);
      const prevOwner = str(p["previous_owner_id"]);
      if (prevOwner && prevOwner !== p["owner_id"]) {
        out.push(...notice(p["owner_id"], actor ?? prevOwner, "ownership_transferred", "venture", id, { ...venture(f, id), role: "new_owner" }));
        out.push(...notice(prevOwner, actor, "ownership_transferred", "venture", id, { ...venture(f, id), role: "old_owner" }));
      }
      if (p["status"] === "abandoned" && p["previous_status"] !== "abandoned") {
        const members = f.work.ventures.get(String(id))?.memberIds ?? [];
        out.push(...each(members, (u) => notice(u, actor, "venture_abandoned", "venture", id, venture(f, id))));
      }
      return out;
    }
    case "venture.completed": {
      const id = p["venture_id"];
      const members = ids(p["member_ids"]);
      return [
        ...each(members, (u) => notice(u, p["owner_id"], "venture_completed", "venture", id, venture(f, id))),
        ...each(members, (u) => notice(u, null, "endorse_teammates", "venture", id, venture(f, id))),
      ];
    }
    case "group.member_changed": {
      if (p["kind"] !== "venture" || p["member"] !== false) return [];
      const v = f.work.ventures.get(String(p["group_id"]));
      if (!v) return []; // the venture itself is going
      const user = str(p["user_id"]);
      const actor = str(p["actor_id"]);
      if (actor === user) return notice(v.ownerId, user, "member_left", "venture", p["group_id"], venture(f, p["group_id"]));
      return notice(user, actor, "member_removed", "venture", p["group_id"], venture(f, p["group_id"]));
    }
    case "endorsement.given": {
      const first = ids(p["endorsement_ids"])[0];
      return notice(p["endorsee_id"], p["endorser_id"], "endorsement_received", "endorsement", first, {
        ...venture(f, p["venture_id"]),
        skills: ids(p["skill_ids"]).map((s) => f.work.skills.get(s) ?? s),
        username: f.names.get(String(p["endorsee_id"]))?.username ?? null,
      });
    }
    case "code_check.changed": {
      const s = p["status"];
      const data = { skill: skill(f, p["skill_id"]) };
      if (s === "ready") return notice(p["user_id"], null, "code_check_ready", "code_check", p["check_id"], data);
      if (s === "passed" || s === "failed") return notice(p["user_id"], null, "code_check_graded", "code_check", p["check_id"], { ...data, passed: s === "passed" });
      return [];
    }
    case "credential.changed": {
      const c = f.work.credentials.get(String(p["credential_id"]));
      const s = p["status"];
      if (s === "approved" || s === "rejected")
        return notice(p["user_id"], null, "credential_reviewed", "credential", p["credential_id"], {
          title: c?.title ?? null,
          approved: s === "approved",
          reason: c?.reviewReason ? c.reviewReason.trim().slice(0, 280) : null,
        });
      if (s === "expired") return notice(p["user_id"], null, "credential_expired", "credential", p["credential_id"], { title: c?.title ?? null });
      return [];
    }
    case "task.completed":
      return notice(p["user_id"], null, "task_done", "task_attempt", p["attempt_id"], { title: p["task_title"] ?? null, skill: p["skill_label"] ?? null, by: p["verified_by"] ?? null });
    case "task_review.changed": {
      const a = f.work.attempts.get(String(p["attempt_id"]));
      if (p["status"] === "offered")
        return notice(p["reviewer_id"], null, "task_review_offer", "task_review", p["review_id"], { student: firstName(f, p["student_id"]), skill: a?.skill ?? null, title: a?.title ?? null });
      if (p["status"] === "needs_changes") return notice(p["student_id"], null, "task_needs_changes", "task_attempt", p["attempt_id"], { title: a?.title ?? null, skill: a?.skill ?? null });
      return [];
    }
    case "swap.changed": {
      const t = p["teacher_id"];
      const l = p["learner_id"];
      const sk = skill(f, p["skill_id"]);
      const ses = f.work.sessions.get(String(p["session_id"] ?? ""));
      const id = p["swap_id"];
      switch (p["status"]) {
        case "requested":
          return notice(t, l, "swap_request", "swap", id, { skill: sk, offered: skill(f, p["offered_skill_id"]) });
        case "declined":
          return notice(l, p["actor_id"], "swap_declined", "swap", id, { skill: sk });
        case "expired":
          return notice(l, null, "swap_declined", "swap", id, { skill: sk, expired: true });
        case "accepted":
          return notice(l, p["actor_id"], "swap_accepted", "swap", id, { skill: sk, mutual: p["mutual"] === true });
        case "session_proposed":
          return notice(p["actor_id"] === t ? l : t, p["actor_id"], "swap_session_proposed", "swap", id, { skill: sk, when: ses?.when ?? null });
        case "session_accepted":
          return notice(ses?.proposedBy ?? null, p["actor_id"], "swap_session_accepted", "swap", id, { skill: sk, when: ses?.when ?? null });
        case "session_reminder":
          return [t, l].flatMap((u) => notice(u, null, "swap_session_reminder", "swap", id, { skill: sk, place: ses?.place ?? null, when: ses?.when ?? null }));
        case "session_ask":
          return notice(l, t, "swap_session_ask", "swap", id, { skill: sk });
        case "note_written":
          return notice(t, l, "swap_note", "swap", id, { skill: sk });
        case "closed": {
          const sessions = typeof p["sessions"] === "number" ? p["sessions"] : 0;
          return [t, l].flatMap((u) => notice(u, p["actor_id"], "swap_closed", "swap", id, { skill: sk, reason: p["reason"] ?? null, sessions, taught: u === t && sessions > 0 }));
        }
        default:
          return [];
      }
    }
    // Their notices come from swap.changed {closed} and from record.sealed (the close-out's Record entries).
    case "swap.closed":
    case "event.closed":
      return [];

    // ---- ranking and trust ----
    case "tier.changed":
      // The stack has no tier-up notice (no type, no wording): docs/azure/notify-status.md, Q2.
      return [];
    case "config.changed": {
      if (p["key"] !== "ranking.formula") return [];
      const v = Number((p["value"] as Record<string, unknown> | null)?.["version"] ?? p["version"]);
      return Number.isInteger(v) && v > 1 ? [{ op: "job", kind: "formula-notice", payload: { version: v, after: null }, dedupe: `formula:${v}` }] : [];
    }

    // ---- community ----
    case "society.status_changed": {
      const prev = p["previous_status"] ?? null;
      if (prev === null || prev === p["status"] || p["status"] === "pending") return [];
      const s = f.community.societies.get(String(p["society_id"]));
      return notice(p["requester_id"], null, "society_decided", "society", p["society_id"], { ...society(f, p["society_id"]), status: p["status"], reason: s?.statusReason ?? null }).filter(
        (n) => n.user !== p["actor_id"],
      );
    }
    case "society.invite_changed": {
      const status = p["status"];
      const kind = p["kind"];
      if (status === "pending")
        return notice(p["invitee_id"], p["invited_by"], "society_invite", "society", p["society_id"], {
          ...society(f, p["society_id"]),
          kind,
          ...(kind === "officer" ? { title: f.community.invites.get(String(p["invite_id"])) ?? null } : {}),
          invite_id: p["invite_id"],
        });
      if (status === "accepted" || status === "declined")
        return notice(p["invited_by"], p["invitee_id"], "society_invite_answered", "society", p["society_id"], { ...society(f, p["society_id"]), kind, accepted: status === "accepted" });
      return [];
    }
    case "society.join_changed": {
      const soc = p["society_id"];
      if (p["status"] === "requested") return each(officersBut(f, soc, p["user_id"]), (u) => notice(u, p["user_id"], "society_join_request", "society", soc, society(f, soc)));
      if (p["status"] === "accepted" && p["actor_id"] !== p["user_id"]) return notice(p["user_id"], p["actor_id"], "society_joined", "society", soc, society(f, soc));
      return [];
    }
    case "society.term_changed": {
      if (p["status"] !== "ended") return [];
      const soc = p["society_id"];
      return each(f.community.officers.get(String(soc)) ?? [], (u) =>
        notice(u, null, "term_ended", "society", soc, { ...society(f, soc), title: f.community.terms.get(String(p["term_id"])) ?? null, term_id: p["term_id"] }),
      );
    }
    case "induction.changed": {
      if (p["status"] !== "open" || !str(p["actor_id"])) return [];
      const soc = p["society_id"];
      const r = f.community.rounds.get(String(p["round_id"]));
      return each(f.community.audiences.get(String(soc)) ?? [], (u) =>
        notice(u, p["actor_id"], "induction_published", "induction_round", p["round_id"], { ...society(f, soc), round: r?.title ?? null, deadline: r?.deadline ?? p["deadline"] ?? null }),
      );
    }
    case "induction_application.changed": {
      const soc = p["society_id"];
      const r = f.community.rounds.get(String(p["round_id"]));
      const base = { ...society(f, soc), round: r?.title ?? null };
      if (p["status"] === "pending")
        return each(officersBut(f, soc, p["applicant_id"]), (u) => notice(u, p["applicant_id"], "induction_applied", "induction_round", p["round_id"], { ...base, round_id: p["round_id"] }));
      if (p["expired"] === true) return notice(p["applicant_id"], null, "induction_decided", "induction_round", p["round_id"], { ...base, accepted: false, expired: true });
      if (p["status"] === "accepted" || p["status"] === "declined") {
        const a = f.community.applications.get(String(p["application_id"]));
        return notice(p["applicant_id"], p["actor_id"], "induction_decided", "induction_round", p["round_id"], { ...base, accepted: p["status"] === "accepted", team: a?.team ?? null, note: a?.note ?? null });
      }
      return [];
    }
    case "event.updated": {
      const ev = f.community.events.get(String(p["event_id"]));
      const id = p["event_id"];
      if (p["change"] === "published")
        return each(f.community.audiences.get(String(p["society_id"])) ?? [], (u) =>
          notice(u, p["actor_id"], "event_published", "event", id, { event: ev?.title ?? null, society: society(f, p["society_id"]).society, starts_at: ev?.startsAt ?? p["starts_at"] ?? null }),
        );
      const reg = f.community.registrants.get(String(id));
      if (p["change"] === "details") return each(reg?.userIds ?? [], (u) => notice(u, p["actor_id"], "event_changed", "event", id, { event: ev?.title ?? null, starts_at: p["starts_at"] ?? null }));
      if (p["change"] === "cancelled")
        return each(reg?.userIds ?? [], (u) => notice(u, p["actor_id"], "event_cancelled", "event", id, { event: ev?.title ?? null, reason: ev?.cancelReason ?? null, paid: reg!.paid.has(u) }));
      return [];
    }
    case "event.registered": {
      const ev = eventTitle(f, p["event_id"]);
      const r = f.community.registrations.get(String(p["registration_id"]));
      const position = typeof p["waitlist_position"] === "number" ? p["waitlist_position"] : null;
      switch (p["reason"]) {
        case "registered":
          return notice(p["user_id"], null, "event_registration", "event", p["event_id"], { event: ev, status: p["status"], position });
        case "promoted":
          return notice(p["user_id"], null, "event_promoted", "event", p["event_id"], { event: ev, paid: r?.paid ?? p["paid"] === true });
        case "decided":
          return notice(p["user_id"], p["actor_id"], "event_decided", "event", p["event_id"], { event: ev, status: p["status"], position });
        case "hold_expired":
          return notice(p["user_id"], null, "hold_expired", "event", p["event_id"], { event: ev });
        default:
          return [];
      }
    }
    case "event.reminder_due": {
      const ev = f.community.events.get(String(p["event_id"]));
      return each(ids(p["user_ids"]), (u) => notice(u, null, "event_reminder", "event", p["event_id"], { event: ev?.title ?? null, starts_at: ev?.startsAt ?? p["starts_at"] ?? null, when: p["when"] }));
    }
    case "event.cohost_changed": {
      if (p["status"] !== "pending") return [];
      return each(officersBut(f, p["society_id"], p["actor_id"]), (u) =>
        notice(u, p["actor_id"], "event_cohost", "event", p["event_id"], { event: eventTitle(f, p["event_id"]), society: society(f, p["host_society_id"]).society }),
      );
    }
    case "event.staff_changed":
      return p["staff"] === true ? notice(p["user_id"], p["actor_id"], "event_staff_added", "event", p["event_id"], { event: eventTitle(f, p["event_id"]) }) : [];
    case "event.message_sent": {
      const body = f.community.messages.get(String(p["message_id"])) ?? null;
      return each(f.community.registrants.get(String(p["event_id"]))?.userIds ?? [], (u) =>
        notice(u, p["sender_id"], "event_message", "event", p["event_id"], { event: eventTitle(f, p["event_id"]), body }),
      );
    }
    case "payment.changed": {
      const pay = f.community.payments.get(String(p["payment_id"]));
      const ref = pay?.referenceCode ?? null;
      const ev = eventTitle(f, p["event_id"]);
      const officers = officersBut(f, p["society_id"], p["user_id"]);
      const id = p["event_id"];
      switch (p["change"]) {
        case "submitted":
          return each(officers, (u) => notice(u, p["user_id"], "payment_review", "event", id, { event: ev, reference_code: ref }));
        case "issue":
          return each(officers, (u) => notice(u, p["user_id"], "payment_review", "event", id, { reference_code: ref, issue: true }));
        case "approved":
        case "rejected":
          return notice(p["user_id"], p["actor_id"], "payment_decided", "event", id, { event: ev, approved: p["change"] === "approved", reason: p["change"] === "rejected" ? (pay?.rejectReason ?? null) : null });
        case "refund_requested":
          return each(officers, (u) => notice(u, p["user_id"], "refund_requested", "event", id, { event: ev, reference_code: ref }));
        case "refund_sent":
          return notice(p["user_id"], p["actor_id"], "refund_sent", "event", id, { event: ev, reference_code: ref });
        case "refund_received":
        case "refund_disputed":
          return each(officers, (u) => notice(u, p["user_id"], "refund_answered", "event", id, { reference_code: ref, received: p["change"] === "refund_received" }));
        default:
          return [];
      }
    }
    case "payment_method.changed": {
      const soc = p["society_id"];
      if (p["status"] === "proposed")
        return each(officersBut(f, soc, p["actor_id"]), (u) => notice(u, p["actor_id"], "payment_details_proposed", "society", soc, { ...society(f, soc), action: p["action"] }));
      if (p["status"] === "active" || p["status"] === "rejected")
        return each(f.community.officers.get(String(soc)) ?? [], (u) =>
          notice(u, null, "payment_details_confirmed", "society", soc, { ...society(f, soc), accepted: p["status"] === "active", action: p["action"] }),
        );
      return [];
    }

    // ---- credentials ----
    case "record.sealed": {
      const x = f.credentials.entries.get(String(p["entry_id"]));
      return notice(p["user_id"], null, "record_entry", "record_entry", p["entry_id"], {
        kind: x?.kind ?? p["kind"] ?? null,
        title: x?.title ?? null,
        issuer: x?.issuer ?? null,
        code: x?.code ?? null,
        date: x?.date ?? null,
        corrected: x?.corrected ?? p["corrected"] === true,
      });
    }
    case "record.revoked": {
      if (p["status"] !== "revoked" || p["was_sealed"] !== true) return [];
      const x = f.credentials.entries.get(String(p["entry_id"]));
      return notice(p["user_id"], null, "record_revoked", "record_entry", p["entry_id"], { title: x?.title ?? null, issuer: x?.issuer ?? null, code: x?.code ?? null, reason: x?.revokeReason ?? null });
    }
    case "record.awaiting": {
      const x = f.credentials.entries.get(String(p["entry_id"]));
      return each(ids(p["officer_ids"]), (u) =>
        notice(u, null, "record_confirm", "record_entry", p["entry_id"], { title: x?.title ?? null, society: x?.issuer ?? null, slug: society(f, p["society_id"]).slug }),
      );
    }
    case "record.mistake_reported": {
      const x = f.credentials.entries.get(String(p["entry_id"]));
      return each(ids(p["officer_ids"]), (u) =>
        notice(u, p["user_id"], "record_mistake", "record_entry", p["entry_id"], { title: x?.title ?? null, society: x?.issuer ?? null, slug: society(f, p["society_id"]).slug }),
      );
    }
    case "record.mistake_declined": {
      const x = f.credentials.entries.get(String(p["entry_id"]));
      return notice(p["user_id"], null, "record_mistake_declined", "record_entry", p["entry_id"], {
        title: x?.title ?? null,
        issuer: x?.issuer ?? null,
        note: f.credentials.corrections.get(String(p["correction_id"]))?.trim() ?? null,
      });
    }
    case "record.claim_held": {
      const ev = f.community.events.get(String(p["event_id"]));
      if (!str(p["claim_id"]) || !str(p["attendee_id"])) return [];
      return [
        {
          op: "email",
          kind: "record_claim",
          payload: { claim_id: p["claim_id"], attendee_id: p["attendee_id"], event_title: ev?.title ?? null, society: ev ? (f.community.societies.get(ev.societyId)?.name ?? null) : null },
        },
      ];
    }
    case "cv.issued":
      return p["source"] === "monthly" ? notice(p["user_id"], null, "cv_refreshed", "cv", p["record_id"], { version: p["version"] }) : [];
    case "cv.revoked": {
      if (p["reason"] !== "staff") return [];
      const rec = ids(p["record_ids"])[0];
      return notice(p["user_id"], null, "cv_revoked", "cv", rec, { count: p["count"] ?? ids(p["record_ids"]).length, code: f.credentials.records.get(rec ?? "")?.code ?? null });
    }
    default:
      return [];
  }
}

function officersBut(f: Facts, society: unknown, except: unknown): string[] {
  return (f.community.officers.get(String(society)) ?? []).filter((u) => u !== except);
}

/** Every user id a batch's names come from (task review offers name the student). */
export function wantsCards(w: Wants): string[] {
  return [...w.cards];
}
