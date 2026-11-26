import { rateLimit, uuidv7 } from "@skilient/platform";
import { refused, type RefusalReason } from "../refusals";
import { blockedBetween, canViewVenture, requireUser, type Tx } from "./db";
import { applicationChanged, conversationAllowed, followChanged, inviteChanged, publish } from "./publish";
import { refreshVentureShell } from "./shell";
import { addVentureMember, graduateGuard, lockOwnedVenture, MAX_MEMBERS, requireOpen } from "./ventures";

/** Applications, invites, follows and updates, ported from _ventures.sql and _posts.sql (update images). */

/** `apply_to_venture(venture, role, message, answers)`. */
export async function applyToVenture(tx: Tx, meId: string | null, ventureId: string, roleId: string | null, message: string, answers: string[]): Promise<string> {
  const me = await requireUser(tx, meId);
  if (!(await rateLimit(tx, `venture_apply:${me.id}`, 20, 86_400))) throw refused("rate_limited");
  const [v] = await tx<{ owner_id: string; status: string; visibility: string; university_id: string; visible: boolean; member: boolean }[]>`
    select v.owner_id::text, v.status, v.visibility, v.university_id::text, ${canViewVenture(tx, me.id)} as visible,
           exists (select 1 from work.venture_members m where m.venture_id = v.id and m.user_id = ${me.id}) as member
      from work.ventures v where v.id = ${ventureId}`;
  if (!v || !v.visible) throw refused("venture_not_found");
  requireOpen(v);
  if (v.visibility === "unlisted") throw refused("invite_only");
  if (v.visibility === "university" && v.university_id !== me.university_id) throw refused("university_only");
  if (v.member) throw refused("already_member");
  const [n] = await tx<{ n: number }[]>`select count(*)::int as n from work.venture_members where venture_id = ${ventureId}`;
  if (n!.n >= MAX_MEMBERS) throw refused("team_full");
  if (roleId) {
    const [r] = await tx<{ filled: number; slots: number }[]>`select filled, slots from work.venture_roles where id = ${roleId} and venture_id = ${ventureId}`;
    if (!r) throw refused("role_not_found");
    if (r.filled >= r.slots) throw refused("role_filled");
  }
  const questions = await tx<{ position: number; body: string }[]>`select position, body from work.venture_questions where venture_id = ${ventureId} order by position`;
  if (answers.length !== questions.length || answers.some((a) => a.trim().length < 1 || a.trim().length > 500)) throw refused("answer_questions");
  // Triggers today: application_threads_graduate_guard, then the insert.
  await graduateGuard(tx, v.visibility, me.id);
  const id = uuidv7();
  const answerJson = questions.map((q, i) => ({ position: q.position, question: q.body, answer: answers[i]!.trim() }));
  const inserted = await tx`
    insert into work.applications (id, venture_id, role_id, candidate_id, owner_id, message, answers)
    values (${id}, ${ventureId}, ${roleId}, ${me.id}, ${v.owner_id}, ${message.trim()}, ${JSON.stringify(answerJson)}::text::jsonb)
    on conflict (candidate_id, venture_id) where status = 'pending' do nothing returning 1`;
  if (!inserted.length) throw refused("already_applied");
  await publish(tx, [applicationChanged({ id, venture_id: ventureId, candidate_id: me.id, owner_id: v.owner_id, status: "pending", previous_status: null })]);
  await refreshVentureShell(tx, [v.owner_id]);
  return id;
}

/** `decide_application(application, accept)`. Accepting adds the candidate and lets the two message. */
export async function decideApplication(tx: Tx, me: string | null, applicationId: string, accept: boolean): Promise<string> {
  if (!me) throw refused("not_signed_in");
  const [a0] = await tx<{ venture_id: string }[]>`select venture_id::text from work.applications where id = ${applicationId}`;
  if (!a0) throw refused("application_not_found");
  const v = await lockOwnedVenture(tx, me, a0.venture_id);
  const [a] = await tx<{ status: string; candidate_id: string; owner_id: string; role_id: string | null }[]>`
    select status, candidate_id::text, owner_id::text, role_id::text from work.applications where id = ${applicationId} for update`;
  if (a!.status !== "pending") throw refused(`application_${a!.status}` as RefusalReason);
  const decided = (status: string) =>
    applicationChanged({ id: applicationId, venture_id: v.id, candidate_id: a!.candidate_id, owner_id: a!.owner_id, status, previous_status: "pending" });
  if (!accept) {
    await tx`update work.applications set status = 'declined', decided_at = now() where id = ${applicationId}`;
    await publish(tx, [decided("declined")]);
    await refreshVentureShell(tx, [a!.owner_id]);
    return "declined";
  }
  requireOpen(v);
  if (await blockedBetween(tx, me, a!.candidate_id)) throw refused("cant_add_person");
  await addVentureMember(tx, v.id, a!.candidate_id, a!.role_id, me);
  await tx`update work.applications set status = 'accepted', decided_at = now() where id = ${applicationId}`;
  await publish(tx, [decided("accepted"), conversationAllowed(me, a!.candidate_id, "application", true)]);
  await refreshVentureShell(tx, [a!.owner_id]);
  return "accepted";
}

/** `withdraw_application(application)`: the candidate's pending application. */
export async function withdrawApplication(tx: Tx, me: string | null, applicationId: string): Promise<boolean> {
  const r = await tx<{ venture_id: string; candidate_id: string; owner_id: string }[]>`
    update work.applications set status = 'withdrawn', decided_at = now()
     where id = ${applicationId} and candidate_id = ${me}::uuid and status = 'pending'
    returning venture_id::text, candidate_id::text, owner_id::text`;
  if (!r.length) return false;
  await publish(tx, [applicationChanged({ id: applicationId, ...r[0]!, status: "withdrawn", previous_status: "pending" })]);
  await refreshVentureShell(tx, [r[0]!.owner_id]);
  return true;
}

/** `add_application_message(application, body)`: either side of a pending application; 30 an hour. */
export async function addApplicationMessage(tx: Tx, me: string | null, applicationId: string, body: string): Promise<string> {
  const [a] = await tx`
    select 1 from work.applications where id = ${applicationId} and status = 'pending' and (candidate_id = ${me}::uuid or owner_id = ${me}::uuid)`;
  if (!a) throw refused("application_not_found");
  if (!(await rateLimit(tx, `application_message:${me}`, 30, 3_600))) throw refused("rate_limited");
  const [m] = await tx<{ id: string }[]>`
    insert into work.application_messages (application_id, sender_id, body) values (${applicationId}, ${me}, ${body.trim()}) returning id::text`;
  return m!.id;
}

/** `invite_to_venture(venture, username)`: the invitee's id comes from people (resolved before the transaction). */
export async function inviteToVenture(tx: Tx, me: string | null, ventureId: string, invitee: string | null): Promise<string> {
  const v = await lockOwnedVenture(tx, me, ventureId);
  requireOpen(v);
  if (!(await rateLimit(tx, `venture_invite:${v.owner_id}`, 30, 86_400))) throw refused("rate_limited");
  const [p] = invitee ? await tx<{ university_id: string | null }[]>`select university_id::text from work.members where user_id = ${invitee} and onboarding_complete` : [];
  if (!invitee || !p || (await blockedBetween(tx, me!, invitee))) throw refused("no_such_student");
  if (v.visibility === "university" && p.university_id !== v.university_id) throw refused("university_only");
  const [m] = await tx`select 1 from work.venture_members where venture_id = ${ventureId} and user_id = ${invitee}`;
  if (m) throw refused("already_member");
  const [n] = await tx<{ n: number }[]>`select count(*)::int as n from work.venture_members where venture_id = ${ventureId}`;
  if (n!.n >= MAX_MEMBERS) throw refused("team_full");
  const id = uuidv7();
  const r = await tx`
    insert into work.venture_invites (id, venture_id, invitee_id, inviter_id) values (${id}, ${ventureId}, ${invitee}, ${v.owner_id})
    on conflict (venture_id, invitee_id) where status = 'pending' do nothing returning 1`;
  if (!r.length) throw refused("already_invited");
  await publish(tx, [inviteChanged({ id, venture_id: ventureId, invitee_id: invitee, inviter_id: v.owner_id, status: "pending", previous_status: null })]);
  await refreshVentureShell(tx, [invitee]);
  return id;
}

/** `respond_invite(invite, accept)`: accepting joins the team and closes the invitee's pending application. */
export async function respondInvite(tx: Tx, me: string | null, inviteId: string, accept: boolean): Promise<string> {
  const [i0] = await tx<{ venture_id: string }[]>`select venture_id::text from work.venture_invites where id = ${inviteId} and invitee_id = ${me}::uuid`;
  if (!i0) throw refused("invite_not_found");
  const [v] = await tx<{ status: string }[]>`select status from work.ventures where id = ${i0.venture_id} for update`;
  const [i] = await tx<{ status: string; inviter_id: string }[]>`select status, inviter_id::text from work.venture_invites where id = ${inviteId} for update`;
  if (i!.status !== "pending") throw refused(`invite_${i!.status}` as RefusalReason);
  const answered = (status: string) => inviteChanged({ id: inviteId, venture_id: i0.venture_id, invitee_id: me!, inviter_id: i!.inviter_id, status, previous_status: "pending" });
  if (!accept) {
    await tx`update work.venture_invites set status = 'declined', responded_at = now() where id = ${inviteId}`;
    await publish(tx, [answered("declined")]);
    await refreshVentureShell(tx, [me]);
    return "declined";
  }
  await requireUser(tx, me);
  requireOpen(v!);
  await addVentureMember(tx, i0.venture_id, me!, null, me);
  await tx`update work.venture_invites set status = 'accepted', responded_at = now() where id = ${inviteId}`;
  const closed = await tx<{ id: string; owner_id: string }[]>`
    update work.applications set status = 'closed', decided_at = now()
     where venture_id = ${i0.venture_id} and candidate_id = ${me} and status = 'pending' returning id::text, owner_id::text`;
  await publish(tx, [
    answered("accepted"),
    ...closed.map((a) => applicationChanged({ id: a.id, venture_id: i0.venture_id, candidate_id: me!, owner_id: a.owner_id, status: "closed", previous_status: "pending" })),
  ]);
  await refreshVentureShell(tx, [me, ...closed.map((a) => a.owner_id)]);
  return "accepted";
}

/** `revoke_invite(invite)`: the owner's pending invite. */
export async function revokeInvite(tx: Tx, me: string | null, inviteId: string): Promise<boolean> {
  const [i] = await tx<{ venture_id: string }[]>`select venture_id::text from work.venture_invites where id = ${inviteId}`;
  if (!i) throw refused("invite_not_found");
  await lockOwnedVenture(tx, me, i.venture_id);
  const r = await tx<{ invitee_id: string; inviter_id: string }[]>`
    update work.venture_invites set status = 'revoked', responded_at = now() where id = ${inviteId} and status = 'pending'
    returning invitee_id::text, inviter_id::text`;
  if (r.length) {
    await publish(tx, [inviteChanged({ id: inviteId, venture_id: i.venture_id, ...r[0]!, status: "revoked", previous_status: "pending" })]);
    await refreshVentureShell(tx, [r[0]!.invitee_id]);
  }
  return r.length > 0;
}

/** `follow_venture(venture, follow)`: public ventures the reader can see. */
export async function followVenture(tx: Tx, meId: string | null, ventureId: string, follow: boolean): Promise<boolean> {
  const me = await requireUser(tx, meId);
  if (follow) {
    const [v] = await tx<{ ok: boolean }[]>`select v.visibility = 'public' and ${canViewVenture(tx, me.id)} as ok from work.ventures v where v.id = ${ventureId}`;
    if (!v?.ok) throw refused("follow_public_only");
    const r = await tx`insert into work.venture_follows (venture_id, user_id) values (${ventureId}, ${me.id}) on conflict do nothing returning 1`;
    if (r.length) await publish(tx, [followChanged(ventureId, me.id, true)]);
  } else {
    const r = await tx`delete from work.venture_follows where venture_id = ${ventureId} and user_id = ${me.id} returning 1`;
    if (r.length) await publish(tx, [followChanged(ventureId, me.id, false)]);
  }
  return follow;
}

export interface UpdateImage {
  path: string;
  width: number;
  height: number;
}

/**
 * `post_venture_update_media(venture, body, media)` (`check_media`, then `post_venture_update`): members of a
 * venture that isn't abandoned, 20 a day, up to 4 images each in the poster's own folder. Whether the files
 * exist is media's (W9): `missing` returns the paths it hasn't recorded.
 */
export async function postVentureUpdate(
  tx: Tx,
  me: string | null,
  ventureId: string,
  body: string,
  media: unknown,
  missing: (paths: string[]) => Promise<string[]>,
): Promise<string> {
  if (!Array.isArray(media)) throw refused("media_not_list");
  if (media.length > 4) throw refused("too_many_images");
  const images = (media as Partial<UpdateImage>[]).map((m) => ({ path: typeof m.path === "string" ? m.path : "", width: Number(m.width), height: Number(m.height) }));
  if (images.some((m) => m.path.split("/")[0] !== me)) throw refused("image_missing");
  if (images.length && (await missing(images.map((m) => m.path))).length) throw refused("image_missing");
  const [m] = me ? await tx`select 1 from work.venture_members where venture_id = ${ventureId} and user_id = ${me}` : [];
  if (!m) throw refused("members_only");
  const [ab] = await tx`select 1 from work.ventures where id = ${ventureId} and status = 'abandoned'`;
  if (ab) throw refused("venture_abandoned");
  if (!(await rateLimit(tx, `venture_update:${me}`, 20, 86_400))) throw refused("rate_limited");
  const id = uuidv7();
  await tx`insert into work.venture_updates (id, venture_id, author_id, body) values (${id}, ${ventureId}, ${me}, ${body.trim()})`;
  for (const [i, img] of images.entries())
    await tx`insert into work.venture_update_media (update_id, position, path, width, height) values (${id}, ${i + 1}, ${img.path}, ${img.width}, ${img.height})`;
  return id;
}

/** `delete_venture_update(update)`: its author or the venture's owner. */
export async function deleteVentureUpdate(tx: Tx, me: string | null, updateId: string): Promise<boolean> {
  const r = await tx<{ path: string | null }[]>`
    delete from work.venture_updates u
     where u.id = ${updateId}
       and (u.author_id = ${me}::uuid or exists (select 1 from work.ventures v where v.id = u.venture_id and v.owner_id = ${me}::uuid))
    returning 1`;
  return r.length > 0;
}
