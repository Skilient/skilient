import { appendEvents, createConsumer, uuidv7, type Consumer, type LoggedEvent, type Logger } from "@skilient/platform";
import type postgres from "postgres";
import { z } from "zod";
import { isConfigKey } from "../domain/config";
import type { Tx } from "./db";

/**
 * Content's event-fed copies and the events that change content itself (decisions 2026-11-26, W3). One
 * consumer, `content.copies`, woken by NOTIFY. Each event type has one owning producer role; anything else
 * is logged and dropped. Every handler is idempotent (absolute values, upserts and deletes).
 *
 * | Event (v1)                  | From      | Effect in content                                                    |
 * | --------------------------- | --------- | -------------------------------------------------------------------- |
 * | user.created                | identity  | member row with the account's age (survey weight)                    |
 * | profile.updated             | people    | member flags: university, department, batch, visibility, status      |
 * | friendship/block/mute.changed | people  | audience edges                                                       |
 * | group.member_changed        | work, community | venture teammates (survey weight), society officers ("post as") |
 * | venture.updated, venture.follow_changed | work (W5) | invite checks, feed relevance                       |
 * | venture.completed           | work (W5) | the Shipped post (post_shipped trigger)                              |
 * | skill.changed               | work      | shared-skills relevance                                              |
 * | society.status_changed      | community (W7) | "post as" a verified society                                    |
 * | university_seat.changed     | market (W11) | announcement reach, university hides                              |
 * | university_hide.changed     | market (W11) | a post or comment hidden by its university                        |
 * | entitlement.changed         | billing (W12) | post insights                                                    |
 * | config.changed              | trust (W10) | feed.* and survey.* settings                                       |
 * | content.removed / content.restored | trust (W10) | staff removal of a post or comment                          |
 * | post.reports_changed        | trust (W10) | open reports (the held stage)                                      |
 * | user.deleted                | identity  | every row of the user's; user.deletion_confirmed                     |
 */
export const COPIES_CONSUMER = "content.copies";
export const COPY_EVENTS = [
  "user.created",
  "user.deleted",
  "profile.updated",
  "friendship.changed",
  "block.changed",
  "mute.changed",
  "group.member_changed",
  "venture.updated",
  "venture.follow_changed",
  "venture.completed",
  "skill.changed",
  "society.status_changed",
  "university_seat.changed",
  "university_hide.changed",
  "entitlement.changed",
  "config.changed",
  "content.removed",
  "content.restored",
  "post.reports_changed",
] as const;

const OWNER: Record<(typeof COPY_EVENTS)[number], readonly string[]> = {
  "user.created": ["svc_identity"],
  "user.deleted": ["svc_identity"],
  "profile.updated": ["svc_people"],
  "friendship.changed": ["svc_people"],
  "block.changed": ["svc_people"],
  "mute.changed": ["svc_people"],
  "group.member_changed": ["svc_work", "svc_community"],
  "venture.updated": ["svc_work"],
  "venture.follow_changed": ["svc_work"],
  "venture.completed": ["svc_work"],
  "skill.changed": ["svc_work"],
  "society.status_changed": ["svc_community"],
  "university_seat.changed": ["svc_market"],
  "university_hide.changed": ["svc_market"],
  "entitlement.changed": ["svc_billing"],
  "config.changed": ["svc_trust"],
  "content.removed": ["svc_trust"],
  "content.restored": ["svc_trust"],
  "post.reports_changed": ["svc_trust"],
};

const id = z.uuid();
const nid = z.uuid().nullable();
const S = {
  created: z.object({ role: z.enum(["student", "faculty", "recruiter", "university_admin"]), university_id: nid, visibility: z.string(), status: z.string(), onboarding_complete: z.boolean() }),
  profile: z.object({
    user_id: id,
    role: z.enum(["student", "faculty", "recruiter", "university_admin"]),
    university_id: nid,
    department_id: nid,
    department_hash: z.string().regex(/^[0-9a-f]{64}$/).nullable().optional(),
    graduation_year: z.number().int().nullable(),
    visibility: z.enum(["friends", "university", "global"]),
    status: z.enum(["active", "graduate", "deleting"]),
    onboarding_complete: z.boolean(),
  }),
  friendship: z.object({ user_a: id, user_b: id, friends: z.boolean() }),
  block: z.object({ blocker_id: id, blocked_id: id, blocked: z.boolean() }),
  mute: z.object({ user_id: id, muted_id: id, muted: z.boolean() }),
  group: z.object({ kind: z.enum(["venture", "society"]), group_id: id, user_id: id, member: z.boolean(), role: z.enum(["member", "officer", "president"]).optional() }),
  venture: z.object({ venture_id: id, owner_id: id, university_id: nid, status: z.string().min(1).max(40), visibility: z.enum(["public", "university", "unlisted"]) }),
  follow: z.object({ venture_id: id, user_id: id, following: z.boolean() }),
  completed: z.object({ venture_id: id, owner_id: id, university_id: nid, visibility: z.enum(["public", "university", "unlisted"]) }),
  skill: z.object({ user_id: id, skill_id: z.string().min(1).max(80), level: z.number().int().min(0).max(5) }),
  society: z.object({ society_id: id, university_id: id, status: z.string().min(1).max(40) }),
  seat: z.object({ user_id: id, university_id: id, role: z.enum(["owner", "admin", "career", "coordinator", "comms"]).nullable() }),
  hide: z.object({ target_type: z.enum(["post", "comment"]), target_id: id, hidden: z.boolean() }),
  entitlement: z.object({ subject_id: id, key: z.string().min(1).max(80), value: z.unknown() }),
  config: z.object({ key: z.string(), version: z.number().int().min(1), value: z.unknown() }),
  removal: z.object({ target_type: z.enum(["post", "comment"]), target_id: id, staff_id: nid.optional() }),
  reports: z.object({ post_id: id, reports: z.number().int().min(0) }),
};

/** Names and titles a batch of venture.completed events needs (people's cards, work's venture block). */
export interface ShippedNames {
  owners: ReadonlyMap<string, string>;
  titles: ReadonlyMap<string, string>;
}
export const noShippedNames: ShippedNames = { owners: new Map(), titles: new Map() };

export type CopyOutcome = "applied" | "wrong_producer" | "invalid_payload" | "unknown_type" | "missing_names";

/** Applies one event (the consumer's handler; exported for tests and replays). */
export async function applyCopyEvent(
  tx: Tx,
  event: Pick<LoggedEvent, "type" | "producer" | "payload" | "version" | "subjects"> & { at?: string },
  names: ShippedNames = noShippedNames,
): Promise<CopyOutcome> {
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
      const p = parse(S.created);
      const user = event.subjects[0];
      if (!p || !user) return "invalid_payload";
      await tx`
        insert into content.members (user_id, role, university_id, visibility, status, onboarding_complete, account_created_at)
        values (${user}, ${p.role}, ${p.university_id}, ${p.visibility}, ${p.status}, ${p.onboarding_complete}, ${event.at ?? null}::timestamptz)
        on conflict (user_id) do update set account_created_at = coalesce(content.members.account_created_at, excluded.account_created_at)`;
      return "applied";
    }
    case "user.deleted": {
      const user = event.subjects[0] ?? (typeof event.payload["user_id"] === "string" ? event.payload["user_id"] : null);
      if (!user || !id.safeParse(user).success) return "invalid_payload";
      await deleteUser(tx, user);
      return "applied";
    }
    case "profile.updated": {
      const p = parse(S.profile);
      if (!p) return "invalid_payload";
      await tx`
        insert into content.members (user_id, role, university_id, department_id, department_hash, graduation_year, visibility, status, onboarding_complete)
        values (${p.user_id}, ${p.role}, ${p.university_id}, ${p.department_id}, ${p.department_hash ?? null}, ${p.graduation_year}, ${p.visibility}, ${p.status}, ${p.onboarding_complete})
        on conflict (user_id) do update set role = excluded.role, university_id = excluded.university_id, department_id = excluded.department_id,
          department_hash = excluded.department_hash, graduation_year = excluded.graduation_year, visibility = excluded.visibility,
          status = excluded.status, onboarding_complete = excluded.onboarding_complete, updated_at = now()`;
      return "applied";
    }
    case "friendship.changed": {
      const p = parse(S.friendship);
      if (!p) return "invalid_payload";
      const [a, b] = p.user_a < p.user_b ? [p.user_a, p.user_b] : [p.user_b, p.user_a];
      if (p.friends) await tx`insert into content.friendships (user_id_a, user_id_b) values (${a}, ${b}) on conflict do nothing`;
      else await tx`delete from content.friendships where user_id_a = ${a} and user_id_b = ${b}`;
      return "applied";
    }
    case "block.changed": {
      const p = parse(S.block);
      if (!p) return "invalid_payload";
      if (p.blocked) await tx`insert into content.blocks (blocker_id, blocked_id) values (${p.blocker_id}, ${p.blocked_id}) on conflict do nothing`;
      else await tx`delete from content.blocks where blocker_id = ${p.blocker_id} and blocked_id = ${p.blocked_id}`;
      return "applied";
    }
    case "mute.changed": {
      const p = parse(S.mute);
      if (!p) return "invalid_payload";
      if (p.muted) await tx`insert into content.mutes (user_id, muted_id) values (${p.user_id}, ${p.muted_id}) on conflict do nothing`;
      else await tx`delete from content.mutes where user_id = ${p.user_id} and muted_id = ${p.muted_id}`;
      return "applied";
    }
    case "group.member_changed": {
      const p = parse(S.group);
      if (!p) return "invalid_payload";
      if ((p.kind === "venture") !== (event.producer === "svc_work")) return "wrong_producer";
      if (p.member)
        await tx`
          insert into content.group_members (kind, group_id, user_id, role) values (${p.kind}, ${p.group_id}, ${p.user_id}, ${p.role ?? "member"})
          on conflict (kind, group_id, user_id) do update set role = excluded.role`;
      else await tx`delete from content.group_members where kind = ${p.kind} and group_id = ${p.group_id} and user_id = ${p.user_id}`;
      return "applied";
    }
    case "venture.updated": {
      const p = parse(S.venture);
      if (!p) return "invalid_payload";
      await tx`
        insert into content.ventures (venture_id, owner_id, university_id, status, visibility) values (${p.venture_id}, ${p.owner_id}, ${p.university_id}, ${p.status}, ${p.visibility})
        on conflict (venture_id) do update set owner_id = excluded.owner_id, university_id = excluded.university_id, status = excluded.status,
          visibility = excluded.visibility, updated_at = now()`;
      return "applied";
    }
    case "venture.follow_changed": {
      const p = parse(S.follow);
      if (!p) return "invalid_payload";
      if (p.following) await tx`insert into content.venture_follows (venture_id, user_id) values (${p.venture_id}, ${p.user_id}) on conflict do nothing`;
      else await tx`delete from content.venture_follows where venture_id = ${p.venture_id} and user_id = ${p.user_id}`;
      return "applied";
    }
    case "venture.completed": {
      const p = parse(S.completed);
      if (!p) return "invalid_payload";
      if (p.visibility === "unlisted") return "applied";
      const owner = names.owners.get(p.owner_id);
      const title = names.titles.get(p.venture_id);
      if (owner === undefined || title === undefined) return "missing_names";
      // post_shipped: authored by the owner, starting at Full; one per venture.
      const postId = uuidv7();
      const audience = p.visibility === "public" ? "global" : "university";
      const made = await tx`
        insert into content.posts (id, author_id, university_id, audience, type, body, venture_id, stage)
        values (${postId}, ${p.owner_id}, ${p.university_id}, ${audience}, 'shipped', ${`${owner} shipped ${title}.`.slice(0, 2000)}, ${p.venture_id}, 'full')
        on conflict do nothing`;
      if (made.count) {
        await tx`insert into content.post_stats (post_id) values (${postId})`;
        await appendEvents(tx, [
          {
            type: "post.created",
            subjects: [postId, p.owner_id],
            payload: { post_id: postId, author_id: p.owner_id, type: "shipped", audience, university_id: p.university_id, society_id: null, venture_id: p.venture_id },
          },
        ]);
      }
      return "applied";
    }
    case "skill.changed": {
      const p = parse(S.skill);
      if (!p) return "invalid_payload";
      await tx`
        insert into content.user_skills (user_id, skill_id, level) values (${p.user_id}, ${p.skill_id}, ${p.level})
        on conflict (user_id, skill_id) do update set level = excluded.level`;
      return "applied";
    }
    case "society.status_changed": {
      const p = parse(S.society);
      if (!p) return "invalid_payload";
      await tx`
        insert into content.societies (society_id, university_id, status) values (${p.society_id}, ${p.university_id}, ${p.status})
        on conflict (society_id) do update set university_id = excluded.university_id, status = excluded.status, updated_at = now()`;
      return "applied";
    }
    case "university_seat.changed": {
      const p = parse(S.seat);
      if (!p) return "invalid_payload";
      if (p.role)
        await tx`insert into content.uni_seats (user_id, university_id, role) values (${p.user_id}, ${p.university_id}, ${p.role})
                 on conflict (user_id, university_id) do update set role = excluded.role`;
      else await tx`delete from content.uni_seats where user_id = ${p.user_id} and university_id = ${p.university_id}`;
      return "applied";
    }
    case "university_hide.changed": {
      const p = parse(S.hide);
      if (!p) return "invalid_payload";
      const at = p.hidden ? tx`now()` : null;
      if (p.target_type === "post") await tx`update content.posts set hidden_by_university_at = ${at} where id = ${p.target_id}`;
      else await tx`update content.post_comments set hidden_by_university_at = ${at} where id = ${p.target_id}`;
      return "applied";
    }
    case "entitlement.changed": {
      const p = parse(S.entitlement);
      if (!p) return "invalid_payload";
      if (p.value === null || p.value === undefined || p.value === false)
        await tx`delete from content.entitlements where subject_id = ${p.subject_id} and key = ${p.key}`;
      else
        await tx`insert into content.entitlements (subject_id, key, value) values (${p.subject_id}, ${p.key}, ${JSON.stringify(p.value)}::text::jsonb)
                 on conflict (subject_id, key) do update set value = excluded.value`;
      return "applied";
    }
    case "config.changed": {
      const p = parse(S.config);
      if (!p) return "invalid_payload";
      if (!isConfigKey(p.key)) return "applied";
      await tx`
        insert into content.config (key, version, value) values (${p.key}, ${p.version}, ${JSON.stringify(p.value)}::text::jsonb)
        on conflict (key) do update set version = excluded.version, value = excluded.value, updated_at = now()
         where content.config.version < excluded.version`;
      return "applied";
    }
    case "content.removed":
    case "content.restored": {
      const p = parse(S.removal);
      if (!p) return "invalid_payload";
      const removed = type === "content.removed";
      if (p.target_type === "comment") {
        await tx`update content.post_comments set removed_by = ${removed ? (p.staff_id ?? null) : null},
                   deleted_at = case when ${removed} then coalesce(deleted_at, now()) else deleted_at end where id = ${p.target_id}`;
        return "applied";
      }
      const [post] = await tx<{ author_id: string }[]>`
        update content.posts set removed_at = ${removed ? tx`coalesce(removed_at, now())` : null}, removed_by = ${removed ? (p.staff_id ?? null) : null}
         where id = ${p.target_id} returning author_id::text`;
      if (post && removed) {
        // post_removed_cleanup: a removed post's images go.
        const media = await tx<{ path: string }[]>`delete from content.post_media where post_id = ${p.target_id} returning path`;
        await appendEvents(tx, [
          { type: "post.removed", subjects: [p.target_id, post.author_id], payload: { post_id: p.target_id, author_id: post.author_id, reason: "removed", media_paths: media.map((m) => m.path) } },
        ]);
      }
      return "applied";
    }
    case "post.reports_changed": {
      const p = parse(S.reports);
      if (!p) return "invalid_payload";
      await tx`
        insert into content.post_stats (post_id, reports) select ${p.post_id}::uuid, ${p.reports} where exists (select 1 from content.posts where id = ${p.post_id})
        on conflict (post_id) do update set reports = excluded.reports, updated_at = now()`;
      return "applied";
    }
  }
}

/**
 * user.deleted: every row of the user's (their posts with everything on them, their comments and replies to
 * them, votes, RSVPs, hides, views, survey rows, sessions, copies), then user.deletion_confirmed. As the current
 * stack's cascades: counts others' answers left on the user's posts go with the posts.
 */
export async function deleteUser(tx: Tx, userId: string): Promise<void> {
  const media = await tx<{ post_id: string; path: string }[]>`
    select m.post_id::text, m.path from content.post_media m join content.posts p on p.id = m.post_id where p.author_id = ${userId}`;
  const touched = await tx<{ post_id: string }[]>`select distinct post_id::text from content.post_comments where author_id = ${userId}`;
  await tx`delete from content.posts where author_id = ${userId}`;
  await tx`delete from content.post_comments where author_id = ${userId}`;
  for (const table of ["poll_votes", "event_rsvps", "post_hides", "post_views", "survey_assignments", "feed_sessions"] as const)
    await tx`delete from ${tx("content." + table)} where user_id = ${userId}`;
  await tx`delete from content.members where user_id = ${userId}`;
  await tx`delete from content.friendships where user_id_a = ${userId} or user_id_b = ${userId}`;
  await tx`delete from content.blocks where blocker_id = ${userId} or blocked_id = ${userId}`;
  await tx`delete from content.mutes where user_id = ${userId} or muted_id = ${userId}`;
  for (const table of ["group_members", "venture_follows", "user_skills", "uni_seats"] as const) await tx`delete from ${tx("content." + table)} where user_id = ${userId}`;
  await tx`delete from content.entitlements where subject_id = ${userId}`;
  // stats_on_comment for the posts the user commented on.
  if (touched.length)
    await tx`
      update content.post_stats s
         set commenters = coalesce(x.n, 0), commenter_universities = coalesce(x.u, 0), updated_at = now()
        from unnest(${touched.map((t) => t.post_id)}::uuid[]) as t(post_id)
        left join lateral (
          select count(distinct c.author_id)::int as n, count(distinct m.university_id)::int as u
            from content.post_comments c join content.posts p on p.id = c.post_id left join content.members m on m.user_id = c.author_id
           where c.post_id = t.post_id and c.deleted_at is null and c.author_id <> p.author_id and char_length(c.body) >= 10) x on true
       where s.post_id = t.post_id`;
  await tx`insert into content.deleted_accounts (user_id) values (${userId}) on conflict do nothing`;
  const byPost = new Map<string, string[]>();
  for (const m of media) byPost.set(m.post_id, [...(byPost.get(m.post_id) ?? []), m.path]);
  await appendEvents(tx, [
    ...[...byPost].map(([postId, paths]) => ({
      type: "post.removed",
      subjects: [postId, userId],
      payload: { post_id: postId, author_id: userId, reason: "account_deleted", media_paths: paths },
    })),
    { type: "user.deletion_confirmed", subjects: [userId], payload: { user_id: userId } },
  ]);
}

/** Names for a batch's venture.completed events: owners' names (people) and venture titles (work). */
export type ShippedNamesPort = (owners: readonly string[], ventures: readonly string[]) => Promise<ShippedNames>;

export function copiesConsumer(options: { sql: postgres.Sql; names: ShippedNamesPort; logger?: Logger; pollMs?: number }): Consumer {
  return createConsumer<ShippedNames>({
    sql: options.sql,
    name: COPIES_CONSUMER,
    types: COPY_EVENTS,
    pollMs: options.pollMs,
    logger: options.logger,
    prepare: async (events) => {
      const done = events.filter((e) => e.type === "venture.completed" && e.producer === "svc_work");
      if (done.length === 0) return noShippedNames;
      const owners = [...new Set(done.map((e) => String(e.payload["owner_id"] ?? "")).filter((x) => id.safeParse(x).success))];
      const ventures = [...new Set(done.map((e) => String(e.payload["venture_id"] ?? "")).filter((x) => id.safeParse(x).success))];
      return options.names(owners, ventures);
    },
    handle: async (tx, event, names) => {
      const outcome = await applyCopyEvent(tx, event, names);
      if (outcome !== "applied") options.logger?.warn("copies.skipped", { action: `consume.${event.type}`, outcome: "skipped", error_code: outcome });
    },
  });
}
