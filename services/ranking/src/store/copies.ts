import { appendEvents, createConsumer, uuidv7, type Consumer, type LoggedEvent, type Logger } from "@skilient/platform";
import type postgres from "postgres";
import { z } from "zod";
import type { Tx } from "./db";
import { recordSwapFlag } from "./flags";

/**
 * Ranking's event-fed copies (one consumer, `ranking.copies`): every fact the score reads, so the nightly run
 * reads only ranking's own schema (docs/azure/prd.md, "Reading another service's data"). Each event type has one
 * owning producer role; anything else is logged and dropped. Idempotent throughout (the consumer records
 * applied event ids; upserts and deletes are safe to repeat). Times missing from a payload are the event's own
 * time (the moment its owner wrote it).
 *
 * | Event (v1)                                   | From        | Effect                                              |
 * | -------------------------------------------- | ----------- | --------------------------------------------------- |
 * | profile.updated                              | people      | cohort, status (graduated_at), opt-out, onboarding  |
 * | friendship.changed, block.changed            | people      | non-friend answers; blocks on boards and tiers      |
 * | user.deleted                                 | identity    | the user's rows; user.deletion_confirmed            |
 * | venture.updated, venture.completed           | work        | venture status; the completion, frozen              |
 * | contribution.logged, contribution.confirmed  | work        | the contribution log                                |
 * | pull_request.recorded                        | work        | merged pull requests (counted or not)               |
 * | application.changed                          | work        | join requests answered (citizenship, decay)         |
 * | skill.changed                                | work        | levels, categories and labels                       |
 * | endorsement.given, endorsement.hidden        | work        | endorsements                                        |
 * | credential.changed                           | work        | credentials                                         |
 * | swap.flagged                                 | work        | swap_repeat and swap_ring flags                     |
 * | post.created, post.removed, survey.answered  | content     | posts and their micro-survey answers                |
 * | record.sealed, record.revoked                | credentials | Record entries (W8)                                 |
 * | society.status_changed                       | community   | societies' verification (W7)                        |
 * | case.resolved, case.overturned               | trust       | penalties by severity, removed on appeal (W10)      |
 * | config.changed                               | trust       | ranking.formula versions, feed.score, teacher.limits |
 */
export const COPIES_CONSUMER = "ranking.copies";
const OWNER = {
  "profile.updated": "svc_people",
  "friendship.changed": "svc_people",
  "block.changed": "svc_people",
  "user.deleted": "svc_identity",
  "venture.updated": "svc_work",
  "venture.completed": "svc_work",
  "contribution.logged": "svc_work",
  "contribution.confirmed": "svc_work",
  "pull_request.recorded": "svc_work",
  "application.changed": "svc_work",
  "skill.changed": "svc_work",
  "endorsement.given": "svc_work",
  "endorsement.hidden": "svc_work",
  "credential.changed": "svc_work",
  "swap.flagged": "svc_work",
  "post.created": "svc_content",
  "post.removed": "svc_content",
  "survey.answered": "svc_content",
  "record.sealed": "svc_credentials",
  "record.revoked": "svc_credentials",
  "society.status_changed": "svc_community",
  "case.resolved": "svc_trust",
  "case.overturned": "svc_trust",
  "config.changed": "svc_trust",
} as const;
export type CopyEvent = keyof typeof OWNER;
export const COPY_EVENTS = Object.keys(OWNER) as CopyEvent[];

const id = z.uuid();
const nid = id.nullable();
const time = z.iso.datetime({ offset: true });
const date = z.iso.date();
const count = z.number().int().min(0);
const S = {
  profile: z.object({
    user_id: id,
    role: z.string().max(40),
    university_id: nid,
    department_hash: z.string().max(80).nullable().optional(),
    graduation_year: z.number().int().nullable().optional(),
    status: z.string().max(40),
    graduated_at: time.nullable().optional(),
    leaderboard_opt_out: z.boolean().optional(),
    onboarding_complete: z.boolean(),
  }),
  friendship: z.object({ user_a: id, user_b: id, friends: z.boolean() }),
  block: z.object({ blocker_id: id, blocked_id: id, blocked: z.boolean() }),
  venture: z.object({ venture_id: id, owner_id: nid.optional(), status: z.string().max(40) }),
  completed: z.object({
    venture_id: id,
    owner_id: nid,
    completion: z
      .object({
        completed_at: time,
        team_size: z.number().int().min(0).max(6),
        weeks: z.number().min(0),
        skill_tags: count,
        deliverables: count,
        verified_members: count,
        members: z.array(z.object({ user_id: id, github_days: count, verified_entries: count, unconfirmed_entries: count })).max(6),
      })
      .optional(),
  }),
  logged: z.object({
    contribution_id: id,
    venture_id: id,
    user_id: id,
    source: z.enum(["manual", "github"]),
    before_venture: z.boolean().optional(),
    corrects_id: nid.optional(),
    created_at: time.optional(),
  }),
  confirmed: z.object({ contribution_id: id, confirmer_id: id, confirmed_at: time.optional() }),
  pr: z.object({ user_id: id, repo_id: z.number().int(), number: z.number().int(), repo: z.string().max(200), merged_at: time, counted: z.boolean() }),
  application: z.object({ application_id: id, owner_id: id, status: z.string().max(20), created_at: time.optional(), decided_at: time.nullable().optional() }),
  skill: z.object({ user_id: id, skill_id: z.string().max(80), skill_label: z.string().max(80).optional(), level: z.number().int().min(0).max(4), category: z.string().max(40).nullable().optional() }),
  given: z.object({
    endorsement_ids: z.array(id).max(20),
    endorser_id: id,
    endorsee_id: id,
    venture_id: id,
    skill_ids: z.array(z.string().max(80)).max(20),
    endorser_kind: z.enum(["student", "teacher"]).optional(),
    created_at: time.optional(),
  }),
  hidden: z.object({ endorsement_id: id, hidden: z.boolean() }),
  credential: z.object({
    credential_id: id,
    user_id: id,
    status: z.string().max(20),
    expires_on: date.nullable().optional(),
    recognised: z.boolean().optional(),
    created_at: time.optional(),
  }),
  swap: z.object({ kind: z.enum(["swap_repeat", "swap_ring"]), members: z.array(id).min(2).max(3) }).loose(),
  post: z.object({ post_id: id, author_id: id, created_at: time.optional() }),
  removed: z.object({ post_id: id, author_id: id, reason: z.string().max(40).optional() }),
  answer: z.object({ post_id: id, user_id: id, dimension: z.string().max(40), answer: z.boolean(), weight: z.number().min(0).max(10).optional() }),
  sealed: z.object({
    entry_id: id,
    user_id: id,
    kind: z.string().max(40),
    issuer_type: z.string().max(20),
    issuer_id: nid,
    occurred_on: date,
    signed_at: time,
    evidence: z.object({ role: z.string().max(40).optional(), place: z.number().int().optional(), entrants: z.number().int().optional(), minutes: z.number().optional() }).optional(),
  }),
  revoked: z.object({ entry_id: id, status: z.enum(["revoked", "superseded"]).optional() }),
  society: z.object({ society_id: id, status: z.string().max(40), verified_at: time.nullable().optional() }),
  resolved: z.object({ case_id: id, owner_id: nid, severity: z.enum(["low", "medium", "high"]).nullable(), staff_id: nid.optional(), resolved_at: time.optional() }),
  overturned: z.object({ case_id: id }),
  config: z.object({ key: z.string().max(80), version: z.number().int().min(1), value: z.record(z.string(), z.unknown()), effective_at: time.optional() }),
};

export type CopyOutcome = "applied" | "ignored" | "wrong_producer" | "invalid_payload" | "unknown_type";
type Event = Pick<LoggedEvent, "type" | "producer" | "payload" | "version" | "subjects"> & { at?: string | Date };

/** Applies one event (the consumer's handler; exported for tests and replays). */
export async function applyCopyEvent(tx: Tx, event: Event): Promise<CopyOutcome> {
  if (event.version !== 1) return "invalid_payload";
  const type = event.type as CopyEvent;
  if (!(type in OWNER)) return "unknown_type";
  if (OWNER[type] !== event.producer) return "wrong_producer";
  const parse = <T>(schema: z.ZodType<T>): T | null => {
    const r = schema.safeParse(event.payload);
    return r.success ? r.data : null;
  };
  const at = event.at ? new Date(event.at) : new Date();
  switch (type) {
    case "profile.updated": {
      const p = parse(S.profile);
      if (!p) return "invalid_payload";
      const graduated = p.graduated_at !== undefined ? p.graduated_at : null;
      await tx`
        insert into ranking.members (user_id, role, university_id, department_hash, graduation_year, status, graduated_at, onboarding_complete, leaderboard_opt_out)
        values (${p.user_id}, ${p.role}, ${p.university_id}, ${p.department_hash ?? null}, ${p.graduation_year ?? null}, ${p.status},
                case when ${p.status} = 'graduate' then coalesce(${graduated}::timestamptz, ${at}) end, ${p.onboarding_complete}, ${p.leaderboard_opt_out ?? false})
        on conflict (user_id) do update set role = excluded.role, university_id = excluded.university_id, department_hash = excluded.department_hash,
          graduation_year = excluded.graduation_year, status = excluded.status, onboarding_complete = excluded.onboarding_complete,
          leaderboard_opt_out = excluded.leaderboard_opt_out,
          graduated_at = case when excluded.status <> 'graduate' then null
                              when ${graduated}::timestamptz is not null then ${graduated}::timestamptz
                              else coalesce(ranking.members.graduated_at, excluded.graduated_at) end,
          updated_at = now()`;
      return "applied";
    }
    case "friendship.changed": {
      const p = parse(S.friendship);
      if (!p) return "invalid_payload";
      const [a, b] = p.user_a < p.user_b ? [p.user_a, p.user_b] : [p.user_b, p.user_a];
      if (p.friends) await tx`insert into ranking.friendships (user_id_a, user_id_b) values (${a}, ${b}) on conflict do nothing`;
      else await tx`delete from ranking.friendships where user_id_a = ${a} and user_id_b = ${b}`;
      return "applied";
    }
    case "block.changed": {
      const p = parse(S.block);
      if (!p) return "invalid_payload";
      if (p.blocked) await tx`insert into ranking.blocks (blocker_id, blocked_id) values (${p.blocker_id}, ${p.blocked_id}) on conflict do nothing`;
      else await tx`delete from ranking.blocks where blocker_id = ${p.blocker_id} and blocked_id = ${p.blocked_id}`;
      return "applied";
    }
    case "user.deleted": {
      const user = event.subjects[0] ?? (typeof event.payload["user_id"] === "string" ? event.payload["user_id"] : null);
      if (!user || !id.safeParse(user).success) return "invalid_payload";
      await deleteUser(tx, user);
      return "applied";
    }
    case "venture.updated": {
      const p = parse(S.venture);
      if (!p) return "invalid_payload";
      await tx`
        insert into ranking.ventures (venture_id, owner_id, status) values (${p.venture_id}, ${p.owner_id ?? null}, ${p.status})
        on conflict (venture_id) do update set owner_id = coalesce(excluded.owner_id, ranking.ventures.owner_id), status = excluded.status, updated_at = now()`;
      return "applied";
    }
    case "venture.completed": {
      const p = parse(S.completed);
      if (!p) return "invalid_payload";
      await tx`
        insert into ranking.ventures (venture_id, owner_id, status) values (${p.venture_id}, ${p.owner_id}, 'completed')
        on conflict (venture_id) do update set status = 'completed', updated_at = now()`;
      const c = p.completion;
      if (!c) return "applied";
      const inserted = await tx`
        insert into ranking.venture_completions (venture_id, owner_id, completed_at, team_size, weeks, skill_tags, deliverables, verified_members)
        values (${p.venture_id}, ${p.owner_id}, ${c.completed_at}, ${c.team_size}, ${c.weeks}, ${c.skill_tags}, ${c.deliverables}, ${c.verified_members})
        on conflict (venture_id) do nothing returning 1`;
      if (inserted.length && c.members.length)
        await tx`
          insert into ranking.venture_completion_members (venture_id, user_id, github_days, verified_entries, unconfirmed_entries)
          select ${p.venture_id}, m.user_id, m.github_days, m.verified_entries, m.unconfirmed_entries
            from json_to_recordset(${JSON.stringify(c.members)}::text::json) as m(user_id uuid, github_days int, verified_entries int, unconfirmed_entries int)`;
      return "applied";
    }
    case "contribution.logged": {
      const p = parse(S.logged);
      if (!p) return "invalid_payload";
      await tx`
        insert into ranking.contributions (id, venture_id, user_id, source, before_venture, corrects_id, created_at)
        values (${p.contribution_id}, ${p.venture_id}, ${p.user_id}, ${p.source}, ${p.before_venture ?? false}, ${p.corrects_id ?? null}, ${p.created_at ?? at})
        on conflict (id) do nothing`;
      return "applied";
    }
    case "contribution.confirmed": {
      const p = parse(S.confirmed);
      if (!p) return "invalid_payload";
      await tx`
        insert into ranking.confirmations (contribution_id, confirmer_id, created_at) values (${p.contribution_id}, ${p.confirmer_id}, ${p.confirmed_at ?? at})
        on conflict do nothing`;
      return "applied";
    }
    case "pull_request.recorded": {
      const p = parse(S.pr);
      if (!p) return "invalid_payload";
      await tx`
        insert into ranking.pull_requests (user_id, repo_id, number, repo, merged_at, counted) values (${p.user_id}, ${p.repo_id}, ${p.number}, ${p.repo}, ${p.merged_at}, ${p.counted})
        on conflict (user_id, repo_id, number) do update set repo = excluded.repo, merged_at = excluded.merged_at, counted = excluded.counted`;
      return "applied";
    }
    case "application.changed": {
      const p = parse(S.application);
      if (!p) return "invalid_payload";
      const decided = p.decided_at !== undefined ? p.decided_at : p.status === "pending" ? null : at.toISOString();
      await tx`
        insert into ranking.applications (id, owner_id, status, created_at, decided_at)
        values (${p.application_id}, ${p.owner_id}, ${p.status}, ${p.created_at ?? at}, ${decided})
        on conflict (id) do update set status = excluded.status, owner_id = excluded.owner_id,
          created_at = coalesce(${p.created_at ?? null}::timestamptz, ranking.applications.created_at),
          decided_at = excluded.decided_at`;
      return "applied";
    }
    case "skill.changed": {
      const p = parse(S.skill);
      if (!p) return "invalid_payload";
      if (p.level === 0) await tx`delete from ranking.user_skills where user_id = ${p.user_id} and skill_id = ${p.skill_id}`;
      else
        await tx`
          insert into ranking.user_skills (user_id, skill_id, level, category, label) values (${p.user_id}, ${p.skill_id}, ${p.level}, ${p.category ?? null}, ${p.skill_label ?? null})
          on conflict (user_id, skill_id) do update set level = excluded.level, category = coalesce(excluded.category, ranking.user_skills.category),
            label = coalesce(excluded.label, ranking.user_skills.label)`;
      return "applied";
    }
    case "endorsement.given": {
      const p = parse(S.given);
      if (!p || p.endorsement_ids.length !== p.skill_ids.length) return "invalid_payload";
      const rows = p.endorsement_ids.map((eid, i) => ({ id: eid, skill_id: p.skill_ids[i]! }));
      await tx`
        insert into ranking.endorsements (id, endorser_id, endorsee_id, venture_id, skill_id, endorser_kind, created_at)
        select r.id, ${p.endorser_id}, ${p.endorsee_id}, ${p.venture_id}, r.skill_id, ${p.endorser_kind ?? "student"}, ${p.created_at ?? at}
          from json_to_recordset(${JSON.stringify(rows)}::text::json) as r(id uuid, skill_id text)
        on conflict (id) do nothing`;
      return "applied";
    }
    case "endorsement.hidden": {
      const p = parse(S.hidden);
      if (!p) return "invalid_payload";
      await tx`update ranking.endorsements set hidden = ${p.hidden} where id = ${p.endorsement_id}`;
      return "applied";
    }
    case "credential.changed": {
      const p = parse(S.credential);
      if (!p) return "invalid_payload";
      if (p.status === "deleted") await tx`delete from ranking.credentials where id = ${p.credential_id}`;
      else
        await tx`
          insert into ranking.credentials (id, user_id, status, expires_on, recognised, created_at)
          values (${p.credential_id}, ${p.user_id}, ${p.status}, ${p.expires_on ?? null}, ${p.recognised ?? false}, ${p.created_at ?? at})
          on conflict (id) do update set status = excluded.status,
            expires_on = case when ${p.expires_on !== undefined} then excluded.expires_on else ranking.credentials.expires_on end,
            recognised = case when ${p.recognised !== undefined} then excluded.recognised else ranking.credentials.recognised end`;
      return "applied";
    }
    case "swap.flagged": {
      const p = parse(S.swap);
      if (!p) return "invalid_payload";
      const { kind, members, ...rest } = p as { kind: "swap_repeat" | "swap_ring"; members: string[] } & Record<string, unknown>;
      const detail = Object.fromEntries(Object.entries(rest).filter(([k]) => ["swap_ids", "confirmations", "hours", "window_days"].includes(k)));
      await recordSwapFlag(tx, kind, members, detail);
      return "applied";
    }
    case "post.created": {
      const p = parse(S.post);
      if (!p) return "invalid_payload";
      await tx`insert into ranking.posts (id, author_id, created_at) values (${p.post_id}, ${p.author_id}, ${p.created_at ?? at}) on conflict (id) do nothing`;
      return "applied";
    }
    case "post.removed": {
      const p = parse(S.removed);
      if (!p) return "invalid_payload";
      await tx`
        insert into ranking.posts (id, author_id, created_at, removed) values (${p.post_id}, ${p.author_id}, ${at}, true)
        on conflict (id) do update set removed = true`;
      return "applied";
    }
    case "survey.answered": {
      const p = parse(S.answer);
      if (!p) return "invalid_payload";
      await tx`
        insert into ranking.survey_responses (post_id, user_id, dimension, answer, weight, created_at)
        values (${p.post_id}, ${p.user_id}, ${p.dimension}, ${p.answer}, ${p.weight ?? 1}, ${at})
        on conflict (post_id, user_id) do update set answer = excluded.answer, dimension = excluded.dimension,
          weight = case when ${p.weight !== undefined} then excluded.weight else ranking.survey_responses.weight end`;
      return "applied";
    }
    case "record.sealed": {
      const p = parse(S.sealed);
      if (!p) return "invalid_payload";
      await tx`
        insert into ranking.record_entries (id, user_id, kind, issuer_type, issuer_id, occurred_on, signed_at, status, evidence)
        values (${p.entry_id}, ${p.user_id}, ${p.kind}, ${p.issuer_type}, ${p.issuer_id}, ${p.occurred_on}, ${p.signed_at}, 'sealed', ${JSON.stringify(p.evidence ?? {})}::text::jsonb)
        on conflict (id) do nothing`;
      return "applied";
    }
    case "record.revoked": {
      const p = parse(S.revoked);
      if (!p) return "invalid_payload";
      await tx`update ranking.record_entries set status = ${p.status ?? "revoked"} where id = ${p.entry_id}`;
      return "applied";
    }
    case "society.status_changed": {
      const p = parse(S.society);
      if (!p) return "invalid_payload";
      const verified = p.verified_at !== undefined ? p.verified_at : p.status === "verified" ? at.toISOString() : null;
      await tx`
        insert into ranking.societies (society_id, status, verified_at) values (${p.society_id}, ${p.status}, ${verified})
        on conflict (society_id) do update set status = excluded.status,
          verified_at = case when ${p.verified_at !== undefined} then excluded.verified_at
                             else coalesce(ranking.societies.verified_at, excluded.verified_at) end`;
      return "applied";
    }
    case "case.resolved": {
      const p = parse(S.resolved);
      if (!p) return "invalid_payload";
      if (!p.severity || !p.owner_id) return "ignored";
      await tx`
        insert into ranking.ranking_adjustments (id, user_id, kind, severity, case_id, staff_id, created_at)
        values (${uuidv7()}, ${p.owner_id}, 'penalty', ${p.severity}, ${p.case_id}, ${p.staff_id ?? null}, ${p.resolved_at ?? at})
        on conflict (case_id) where case_id is not null do nothing`;
      return "applied";
    }
    case "case.overturned": {
      const p = parse(S.overturned);
      if (!p) return "invalid_payload";
      await tx`delete from ranking.ranking_adjustments where case_id = ${p.case_id}`;
      return "applied";
    }
    case "config.changed": {
      const p = parse(S.config);
      if (!p) return "invalid_payload";
      if (p.key === "ranking.formula")
        await tx`
          insert into ranking.formulas (version, value, effective_at) values (${p.version}, ${JSON.stringify(p.value)}::text::jsonb, ${p.effective_at ?? at})
          on conflict (version) do nothing`;
      else if (p.key === "feed.score" || p.key === "teacher.limits")
        await tx`
          insert into ranking.config (key, version, value) values (${p.key}, ${p.version}, ${JSON.stringify(p.value)}::text::jsonb)
          on conflict (key) do update set version = excluded.version, value = excluded.value, updated_at = now() where ranking.config.version < excluded.version`;
      else return "ignored";
      return "applied";
    }
  }
}

/**
 * user.deleted: the user's facts, scores, history and flags go, as the stack's cascades from auth.users did; the
 * ventures they owned go with work's (their completions and their members' entries), and endorsements either
 * way. Exam periods they entered keep the period without its creator. Then `user.deletion_confirmed`.
 */
export async function deleteUser(tx: Tx, userId: string): Promise<void> {
  const owned = (await tx<{ id: string }[]>`select venture_id::text as id from ranking.ventures where owner_id = ${userId}`).map((v) => v.id);
  await tx`delete from ranking.confirmations where confirmer_id = ${userId}
              or contribution_id in (select id from ranking.contributions where user_id = ${userId} or venture_id = any(${owned}::uuid[]))`;
  await tx`delete from ranking.contributions where user_id = ${userId} or venture_id = any(${owned}::uuid[])`;
  await tx`delete from ranking.venture_completions where venture_id = any(${owned}::uuid[])`;
  await tx`delete from ranking.venture_completion_members where user_id = ${userId}`;
  await tx`delete from ranking.ventures where venture_id = any(${owned}::uuid[])`;
  await tx`delete from ranking.pull_requests where user_id = ${userId}`;
  await tx`delete from ranking.applications where owner_id = ${userId}`;
  await tx`delete from ranking.user_skills where user_id = ${userId}`;
  await tx`delete from ranking.endorsements where endorser_id = ${userId} or endorsee_id = ${userId}`;
  await tx`delete from ranking.credentials where user_id = ${userId}`;
  await tx`delete from ranking.survey_responses where user_id = ${userId} or post_id in (select id from ranking.posts where author_id = ${userId})`;
  await tx`delete from ranking.posts where author_id = ${userId}`;
  await tx`delete from ranking.record_entries where user_id = ${userId}`;
  await tx`delete from ranking.ranking_adjustments where user_id = ${userId}`;
  await tx`delete from ranking.anti_gaming_flags where kind = 'rapid_gain' and user_id = ${userId}`;
  await tx`delete from ranking.ranking_scores where user_id = ${userId}`;
  await tx`delete from ranking.ranking_snapshots where user_id = ${userId}`;
  await tx`delete from ranking.published where user_id = ${userId}`;
  await tx`update ranking.exam_periods set created_by = null where created_by = ${userId}`;
  await tx`delete from ranking.friendships where user_id_a = ${userId} or user_id_b = ${userId}`;
  await tx`delete from ranking.blocks where blocker_id = ${userId} or blocked_id = ${userId}`;
  await tx`delete from ranking.members where user_id = ${userId}`;
  await appendEvents(tx, [{ type: "user.deletion_confirmed", subjects: [userId], payload: { user_id: userId } }]);
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
