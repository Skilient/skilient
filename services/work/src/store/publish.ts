import { appendEvents, type NewEvent } from "@skilient/platform";
import type { Tx } from "./db";

/**
 * Work's events, built in one place (packages/contracts/events.json is the obligation list; payloads carry ids,
 * enums and flags only). Each write appends its events in its own transaction (withWrite).
 *
 * - `venture.updated` on create, edit, transfer and status change: content's invite checks and feed relevance,
 *   messaging's team chat and pins; notify's ownership and closing notices (W9) read previous_owner_id,
 *   previous_status and actor_id.
 * - `group.member_changed` {kind venture} when someone joins or leaves a team (people, content, messaging;
 *   notify's left/removed notice reads actor_id).
 * - `venture.follow_changed`, `venture.completed` (content's Shipped post, ranking, credentials, notify).
 * - `application.changed`, `venture.invite_changed` for notify (W9) and trust's analytics (W10).
 * - `conversation.allowed` {reason application} when an application is accepted: the two may message.
 */
export interface VentureRow {
  id: string;
  owner_id: string;
  university_id: string;
  status: string;
  visibility: string;
}

export async function ventureRow(tx: Tx, ventureId: string): Promise<VentureRow | undefined> {
  const [v] = await tx<VentureRow[]>`
    select id::text, owner_id::text, university_id::text, status, visibility from work.ventures where id = ${ventureId}`;
  return v;
}

export function ventureUpdated(v: VentureRow, extra: { previous_owner_id?: string; previous_status?: string; actor_id?: string | null } = {}): NewEvent {
  return {
    type: "venture.updated",
    subjects: [v.id, v.owner_id],
    payload: { venture_id: v.id, owner_id: v.owner_id, university_id: v.university_id, status: v.status, visibility: v.visibility, ...extra },
  };
}

export function memberChanged(ventureId: string, userId: string, member: boolean, actorId: string | null): NewEvent {
  return {
    type: "group.member_changed",
    subjects: [ventureId, userId],
    payload: { kind: "venture", group_id: ventureId, user_id: userId, member, actor_id: actorId },
  };
}

export const followChanged = (ventureId: string, userId: string, following: boolean): NewEvent => ({
  type: "venture.follow_changed",
  subjects: [ventureId, userId],
  payload: { venture_id: ventureId, user_id: userId, following },
});

export const ventureCompleted = (v: VentureRow, memberIds: readonly string[]): NewEvent => ({
  type: "venture.completed",
  subjects: [v.id, ...memberIds],
  payload: { venture_id: v.id, owner_id: v.owner_id, university_id: v.university_id, visibility: v.visibility, member_ids: [...memberIds] },
});

export const applicationChanged = (a: { id: string; venture_id: string; candidate_id: string; owner_id: string; status: string; previous_status: string | null }): NewEvent => ({
  type: "application.changed",
  subjects: [a.id, a.candidate_id, a.owner_id],
  payload: { application_id: a.id, venture_id: a.venture_id, candidate_id: a.candidate_id, owner_id: a.owner_id, status: a.status, previous_status: a.previous_status },
});

export const inviteChanged = (i: { id: string; venture_id: string; invitee_id: string; inviter_id: string; status: string; previous_status: string | null }): NewEvent => ({
  type: "venture.invite_changed",
  subjects: [i.id, i.invitee_id, i.inviter_id],
  payload: { invite_id: i.id, venture_id: i.venture_id, invitee_id: i.invitee_id, inviter_id: i.inviter_id, status: i.status, previous_status: i.previous_status },
});

export const conversationAllowed = (a: string, b: string, reason: "application" | "swap", allowed: boolean): NewEvent => ({
  type: "conversation.allowed",
  subjects: [a, b],
  payload: { user_a: a, user_b: b, reason, allowed },
});

export const publish = (tx: Tx, events: NewEvent[]) => (events.length ? appendEvents(tx, events) : Promise.resolve());
