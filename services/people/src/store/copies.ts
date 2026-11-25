import { createConsumer, type Consumer, type LoggedEvent, type Logger } from "@skilient/platform";
import type postgres from "postgres";
import { z } from "zod";
import { COUNT_KEYS, FACT_SCHEMAS, MILESTONE_KEYS } from "../domain/shell";
import type { Tx } from "./publish";

/**
 * People's event-fed copies of other services' facts (decisions 2026-11-25, advisor, W2 Q1 and Q8). One
 * consumer, `people.copies`, started with the service and woken by NOTIFY (W4 needs badges within 500 ms).
 * Each key or event type has one owning producer role; anything else is logged and dropped, as identity's
 * gate copies do. Counts and facts carry the whole current value, so applying the newest is enough.
 */
export const COPIES_CONSUMER = "people.copies";
export const COPY_EVENTS = ["badge.count_changed", "milestone.reached", "milestone.cleared", "fact.value_changed", "skill.changed", "group.member_changed"] as const;

const Count = z.object({ user_id: z.uuid(), key: z.string(), count: z.number().int().min(0).max(1_000_000) });
const Milestone = z.object({ user_id: z.uuid(), key: z.string() });
const Fact = z.object({ user_id: z.uuid(), key: z.string(), value: z.unknown() });
const Skill = z.object({
  user_id: z.uuid(),
  skill_id: z.string().min(1).max(80),
  // Catalogue text staff curate (the skills taxonomy), never user-written.
  skill_label: z.string().min(1).max(80),
  level: z.number().int().min(0).max(5),
});
const Group = z.object({ kind: z.enum(["venture", "society"]), group_id: z.uuid(), user_id: z.uuid(), member: z.boolean() });
const GROUP_OWNER = { venture: "svc_work", society: "svc_community" } as const;

export type CopyOutcome = "applied" | "wrong_producer" | "unknown_key" | "invalid_payload" | "unknown_type";

/** Applies one event to the copies (the consumer's handler; exported for tests and replays). */
export async function applyCopyEvent(tx: Tx, event: Pick<LoggedEvent, "type" | "producer" | "payload" | "version">): Promise<CopyOutcome> {
  if (event.version !== 1) return "invalid_payload";
  switch (event.type) {
    case "badge.count_changed": {
      const p = Count.safeParse(event.payload);
      if (!p.success) return "invalid_payload";
      const owner = COUNT_KEYS[p.data.key as keyof typeof COUNT_KEYS];
      if (!owner) return "unknown_key";
      if (owner !== event.producer) return "wrong_producer";
      await tx`
        insert into people.shell_counts (user_id, key, count) values (${p.data.user_id}, ${p.data.key}, ${p.data.count})
        on conflict (user_id, key) do update set count = excluded.count, updated_at = now()`;
      return "applied";
    }
    case "milestone.reached":
    case "milestone.cleared": {
      const p = Milestone.safeParse(event.payload);
      if (!p.success) return "invalid_payload";
      const owner = MILESTONE_KEYS[p.data.key as keyof typeof MILESTONE_KEYS];
      if (!owner) return "unknown_key";
      if (owner !== event.producer) return "wrong_producer";
      if (event.type === "milestone.reached")
        await tx`insert into people.shell_facts (user_id, key) values (${p.data.user_id}, ${p.data.key}) on conflict (user_id, key) do update set updated_at = now()`;
      else await tx`delete from people.shell_facts where user_id = ${p.data.user_id} and key = ${p.data.key}`;
      return "applied";
    }
    case "fact.value_changed": {
      const p = Fact.safeParse(event.payload);
      if (!p.success) return "invalid_payload";
      const spec = FACT_SCHEMAS[p.data.key as keyof typeof FACT_SCHEMAS];
      if (!spec) return "unknown_key";
      if (spec.owner !== event.producer) return "wrong_producer";
      if (p.data.value === null) {
        await tx`delete from people.fact_values where user_id = ${p.data.user_id} and key = ${p.data.key}`;
        return "applied";
      }
      const v = spec.schema.safeParse(p.data.value);
      if (!v.success) return "invalid_payload";
      await tx`
        insert into people.fact_values (user_id, key, value) values (${p.data.user_id}, ${p.data.key}, ${JSON.stringify(v.data)}::text::jsonb)
        on conflict (user_id, key) do update set value = excluded.value, updated_at = now()`;
      return "applied";
    }
    case "skill.changed": {
      if (event.producer !== "svc_work") return "wrong_producer";
      const p = Skill.safeParse(event.payload);
      if (!p.success) return "invalid_payload";
      await tx`
        insert into people.skill_levels (user_id, skill_id, skill_label, level) values (${p.data.user_id}, ${p.data.skill_id}, ${p.data.skill_label}, ${p.data.level})
        on conflict (user_id, skill_id) do update set skill_label = excluded.skill_label, level = excluded.level, updated_at = now()`;
      return "applied";
    }
    case "group.member_changed": {
      const p = Group.safeParse(event.payload);
      if (!p.success) return "invalid_payload";
      if (GROUP_OWNER[p.data.kind] !== event.producer) return "wrong_producer";
      if (p.data.member)
        await tx`insert into people.group_members (kind, group_id, user_id) values (${p.data.kind}, ${p.data.group_id}, ${p.data.user_id}) on conflict do nothing`;
      else await tx`delete from people.group_members where kind = ${p.data.kind} and group_id = ${p.data.group_id} and user_id = ${p.data.user_id}`;
      return "applied";
    }
    default:
      return "unknown_type";
  }
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
      if (outcome !== "applied") options.logger?.warn("copies.skipped", { action: `consume.${event.type}`, outcome: "refused", error_code: outcome });
    },
  });
}
