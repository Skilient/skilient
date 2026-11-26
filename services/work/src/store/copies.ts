import { appendEvents, createConsumer, type Consumer, type LoggedEvent, type Logger } from "@skilient/platform";
import type postgres from "postgres";
import { z } from "zod";
import type { Tx } from "./db";
import { memberChanged } from "./publish";
import { swapsOnBlock } from "./swaps";
import { dropTokens } from "./github";
import { recomputeUserSkills } from "./skills";

/**
 * Work's event-fed copies (one consumer, `work.copies`). Each event type has one owning producer role; anything
 * else is logged and dropped. Idempotent throughout.
 *
 * | Event (v1)          | From     | Effect                                                                     |
 * | ------------------- | -------- | -------------------------------------------------------------------------- |
 * | user.created        | identity | a members row (role, university, onboarding)                               |
 * | profile.updated     | people   | university, visibility, status (graduate guard), onboarding (require_user) |
 * | friendship.changed  | people   | can_view_profile on team lists                                             |
 * | block.changed       | people   | blocked owners, hidden members, refused invites and endorsements           |
 * | user.deleted        | identity | the user's rows, as the stack's cascades did; user.deletion_confirmed      |
 * | tier.changed        | ranking  | work.ranking_tiers (compute_paths' seniors)                                |
 * | ranking_flag.changed| ranking  | work.ranking_flags (the proof-task peer-review check)                      |
 */
export const COPIES_CONSUMER = "work.copies";
export const COPY_EVENTS = ["user.created", "profile.updated", "friendship.changed", "block.changed", "user.deleted", "tier.changed", "ranking_flag.changed"] as const;

const OWNER: Record<(typeof COPY_EVENTS)[number], readonly string[]> = {
  "user.created": ["svc_identity"],
  "profile.updated": ["svc_people"],
  "friendship.changed": ["svc_people"],
  "block.changed": ["svc_people"],
  "user.deleted": ["svc_identity"],
  "tier.changed": ["svc_ranking"],
  "ranking_flag.changed": ["svc_ranking"],
};

const id = z.uuid();
const nid = id.nullable();
const S = {
  created: z.object({ role: z.string().max(40), university_id: nid, onboarding_complete: z.boolean().optional() }),
  profile: z.object({
    user_id: id,
    role: z.string().max(40),
    university_id: nid,
    department_id: nid.optional(),
    department_hash: z.string().max(80).nullable().optional(),
    graduation_year: z.number().int().nullable().optional(),
    visibility: z.enum(["friends", "university", "global"]),
    status: z.string().max(40),
    onboarding_complete: z.boolean(),
  }),
  friendship: z.object({ user_a: id, user_b: id, friends: z.boolean() }),
  block: z.object({ blocker_id: id, blocked_id: id, blocked: z.boolean() }),
  tier: z.object({ user_id: id, tier: z.enum(["raw", "spark", "flare", "shine", "radiant", "luminary"]).nullable(), ranked: z.boolean() }),
  flag: z.object({ flag_id: id, kind: z.string().max(40), members: z.array(id).max(50), status: z.enum(["open", "cleared", "upheld"]) }),
};

export type CopyOutcome = "applied" | "ignored" | "wrong_producer" | "invalid_payload" | "unknown_type";

/** Applies one event (the consumer's handler; exported for tests and replays). */
export async function applyCopyEvent(tx: Tx, event: Pick<LoggedEvent, "type" | "producer" | "payload" | "version" | "subjects">): Promise<CopyOutcome> {
  if (event.version !== 1) return "invalid_payload";
  const type = event.type as (typeof COPY_EVENTS)[number];
  if (!(type in OWNER)) return "unknown_type";
  if (!OWNER[type].includes(event.producer)) return "wrong_producer";
  const parse = <T>(schema: z.ZodType<T>): T | null => {
    const r = schema.safeParse(event.payload);
    return r.success ? r.data : null;
  };
  switch (type) {
    case "user.created": {
      const user = event.subjects[0];
      const p = parse(S.created);
      if (!p || !user || !id.safeParse(user).success) return "invalid_payload";
      await tx`
        insert into work.members (user_id, role, university_id, onboarding_complete) values (${user}, ${p.role}, ${p.university_id}, ${p.onboarding_complete ?? false})
        on conflict (user_id) do nothing`;
      return "applied";
    }
    case "profile.updated": {
      const p = parse(S.profile);
      if (!p) return "invalid_payload";
      await tx`
        insert into work.members (user_id, role, university_id, department_id, department_hash, graduation_year, visibility, status, onboarding_complete)
        values (${p.user_id}, ${p.role}, ${p.university_id}, ${p.department_id ?? null}, ${p.department_hash ?? null}, ${p.graduation_year ?? null},
                ${p.visibility}, ${p.status}, ${p.onboarding_complete})
        on conflict (user_id) do update set role = excluded.role, university_id = excluded.university_id, department_id = excluded.department_id,
          department_hash = excluded.department_hash, graduation_year = excluded.graduation_year, visibility = excluded.visibility,
          status = excluded.status, onboarding_complete = excluded.onboarding_complete, updated_at = now()`;
      return "applied";
    }
    case "friendship.changed": {
      const p = parse(S.friendship);
      if (!p) return "invalid_payload";
      const [a, b] = p.user_a < p.user_b ? [p.user_a, p.user_b] : [p.user_b, p.user_a];
      if (p.friends) await tx`insert into work.friendships (user_id_a, user_id_b) values (${a}, ${b}) on conflict do nothing`;
      else await tx`delete from work.friendships where user_id_a = ${a} and user_id_b = ${b}`;
      return "applied";
    }
    case "block.changed": {
      const p = parse(S.block);
      if (!p) return "invalid_payload";
      if (p.blocked) {
        await tx`insert into work.blocks (blocker_id, blocked_id) values (${p.blocker_id}, ${p.blocked_id}) on conflict do nothing`;
        // swaps_on_block: open requests between the two are cancelled and their swaps closed.
        await swapsOnBlock(tx, p.blocker_id, p.blocked_id);
      }
      else await tx`delete from work.blocks where blocker_id = ${p.blocker_id} and blocked_id = ${p.blocked_id}`;
      return "applied";
    }
    case "tier.changed": {
      const p = parse(S.tier);
      if (!p) return "invalid_payload";
      if (p.tier === null) await tx`delete from work.ranking_tiers where user_id = ${p.user_id}`;
      else
        await tx`
          insert into work.ranking_tiers (user_id, tier, ranked) values (${p.user_id}, ${p.tier}, ${p.ranked})
          on conflict (user_id) do update set tier = excluded.tier, ranked = excluded.ranked, updated_at = now()`;
      return "applied";
    }
    case "ranking_flag.changed": {
      const p = parse(S.flag);
      if (!p) return "invalid_payload";
      if (!["ring", "swap_ring", "swap_repeat"].includes(p.kind)) return "ignored";
      if (p.status === "cleared") await tx`delete from work.ranking_flags where flag_id = ${p.flag_id}`;
      else
        await tx`
          insert into work.ranking_flags (flag_id, kind, members, status) values (${p.flag_id}, ${p.kind}, ${p.members}::uuid[], ${p.status})
          on conflict (flag_id) do update set members = excluded.members, status = excluded.status, updated_at = now()`;
      return "applied";
    }
    case "user.deleted": {
      const user = event.subjects[0] ?? (typeof event.payload["user_id"] === "string" ? event.payload["user_id"] : null);
      if (!user || !id.safeParse(user).success) return "invalid_payload";
      await deleteUser(tx, user);
      return "applied";
    }
  }
}

/**
 * user.deleted, as the stack's cascades from auth.users: the user's memberships, applications and their messages,
 * invites, follows, updates, contributions and confirmations, and the ventures they own (today ventures.owner_id
 * is `on delete restrict`, so an account with ventures is first handed off or the ventures go with it; the
 * deletion job deletes them: their members are told by group.member_changed). Later areas add their tables.
 */
export async function deleteUser(tx: Tx, userId: string): Promise<void> {
  const owned = await tx<{ id: string }[]>`select id::text from work.ventures where owner_id = ${userId}`;
  const teams = await tx<{ venture_id: string; user_id: string }[]>`
    select venture_id::text, user_id::text from work.venture_members
     where user_id = ${userId} or venture_id = any(${owned.map((v) => v.id)}::uuid[])`;
  await tx`delete from work.ventures where owner_id = ${userId}`;
  await tx`delete from work.venture_members where user_id = ${userId}`;
  await tx`delete from work.applications where candidate_id = ${userId} or owner_id = ${userId}`;
  await tx`delete from work.application_messages where sender_id = ${userId}`;
  await tx`delete from work.venture_invites where invitee_id = ${userId} or inviter_id = ${userId}`;
  await tx`delete from work.venture_follows where user_id = ${userId}`;
  await tx`delete from work.venture_updates where author_id = ${userId}`;
  await tx`update work.venture_deliverables set added_by = null where added_by = ${userId}`;
  await tx`delete from work.contribution_confirmations where confirmer_id = ${userId}`;
  await tx`delete from work.contributions where user_id = ${userId}`;
  await tx`delete from work.venture_completion_members where user_id = ${userId}`;
  // GitHub: the grant is revoked at GitHub (the harvest job's `revoke` stage), the evidence goes.
  await dropTokens(tx, userId);
  await tx`delete from work.github_user_repos where user_id = ${userId}`;
  await tx`delete from work.github_user_installations where user_id = ${userId}`;
  await tx`delete from work.github_accounts where user_id = ${userId}`;
  await tx`delete from work.github_repos r where not exists (select 1 from work.github_user_repos ur where ur.repo_id = r.repo_id)`;
  await tx`delete from work.github_sync_jobs where user_id = ${userId}`;
  await tx`delete from work.github_link_clashes where user_id = ${userId} or linked_user_id = ${userId}`;
  await tx`delete from work.skill_evidence where user_id = ${userId}`;
  await tx`delete from work.github_commit_blobs where user_id = ${userId}`;
  await tx`delete from work.review_flags where user_id = ${userId}`;
  await tx`delete from work.github_commits where user_id = ${userId}`;
  await tx`delete from work.github_pull_requests where user_id = ${userId}`;
  await tx`delete from work.user_skills where user_id = ${userId}`;
  // Evidence: endorsements either way, credentials (their files are media's), code checks, tasks, paths, swaps.
  const endorsees = await tx<{ id: string }[]>`delete from work.endorsements where endorser_id = ${userId} or endorsee_id = ${userId} returning endorsee_id::text as id`;
  const files = await tx<{ id: string; file_path: string }[]>`delete from work.credentials where user_id = ${userId} returning id::text, file_path`;
  await tx`delete from work.code_checks where user_id = ${userId}`;
  await tx`delete from work.task_reviews where reviewer_id = ${userId}`;
  await tx`delete from work.task_attempts where user_id = ${userId}`;
  await tx`delete from work.path_follows where user_id = ${userId}`;
  await tx`delete from work.swap_offers where user_id = ${userId}`;
  await tx`delete from work.swap_wants where user_id = ${userId}`;
  await tx`delete from work.swaps where teacher_id = ${userId} or learner_id = ${userId}`;
  await tx`delete from work.competition_awards where student_id = ${userId}`;
  await tx`delete from work.ranking_tiers where user_id = ${userId}`;
  const others = [...new Set(endorsees.map((e) => e.id).filter((id) => id !== userId))];
  if (others.length) await recomputeUserSkills(tx, others);
  if (files.length)
    await appendEvents(
      tx,
      files.map((f) => ({ type: "credential.changed", subjects: [f.id, userId], payload: { credential_id: f.id, user_id: userId, status: "deleted", file_path: f.file_path } })),
    );
  await tx`delete from work.members where user_id = ${userId}`;
  await tx`delete from work.friendships where user_id_a = ${userId} or user_id_b = ${userId}`;
  await tx`delete from work.blocks where blocker_id = ${userId} or blocked_id = ${userId}`;
  await appendEvents(tx, [
    ...teams.map((t) => memberChanged(t.venture_id, t.user_id, false, null)),
    { type: "user.deletion_confirmed", subjects: [userId], payload: { user_id: userId } },
  ]);
}

export function copiesConsumer(options: { sql: postgres.Sql; logger?: Logger; pollMs?: number }): Consumer {
  return createConsumer({
    sql: options.sql,
    name: COPIES_CONSUMER,
    types: COPY_EVENTS,
    pollMs: options.pollMs,
    logger: options.logger,
    handle: async (tx, event) => {
      const outcome = await applyCopyEvent(tx, event);
      if (outcome !== "applied" && outcome !== "ignored") options.logger?.warn("copies.skipped", { action: `consume.${event.type}`, outcome: "skipped", error_code: outcome });
    },
  });
}
