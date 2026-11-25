import { createConsumer, type Consumer, type LoggedEvent, type Logger } from "@skilient/platform";
import type postgres from "postgres";
import { z } from "zod";

/**
 * Identity's event-fed copies of the gate facts (decision 2026-11-25, Q1). Each event below is owned by
 * another service and read by one idempotent consumer, `identity.gate-facts`: the platform records every
 * applied event id, so a replay applies once. An event from any producer but the owner is ignored (every
 * service may append to the log, so the producer is what makes an event trustworthy). Payloads are ids
 * and flags only.
 *
 * | Event (v1)                   | Owner  | Payload                                                                    | Copy                          |
 * | ---------------------------- | ------ | -------------------------------------------------------------------------- | ----------------------------- |
 * | `university.domains_changed` | people | university_id, live_at (RFC 3339 or null), domains [{domain, kind}]        | identity.allowed_domains      |
 * | `config.portals_changed`     | trust  | recruiter, university, faculty (booleans)                                  | identity.gate_config          |
 * | `profile.gate_changed`       | people | user_id, has_profile, role, university_id, onboarding_complete, onboarding_step, status | identity.profile_facts |
 * | `org.member_changed`         | market | user_id, org_domain (or null when the recruiter leaves their organisation) | identity.recruiter_org_domains |
 *
 * Each event carries the whole current state of its subject, so applying the newest one is enough; the log
 * delivers them in commit order.
 */
type Tx = postgres.TransactionSql;

export const GATE_EVENTS = {
  "university.domains_changed": "svc_people",
  "config.portals_changed": "svc_trust",
  "profile.gate_changed": "svc_people",
  "org.member_changed": "svc_market",
} as const;
export type GateEventType = keyof typeof GATE_EVENTS;

const Domain = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9.-]{1,253}$/);

export const DomainsChanged = z.object({
  university_id: z.uuid(),
  live_at: z.iso.datetime({ offset: true }).nullable(),
  domains: z.array(z.object({ domain: Domain, kind: z.enum(["student", "faculty", "both"]) })).max(200),
});

export const PortalsChanged = z.object({ recruiter: z.boolean(), university: z.boolean(), faculty: z.boolean() });

export const ProfileGateChanged = z.object({
  user_id: z.uuid(),
  has_profile: z.boolean(),
  role: z.enum(["student", "faculty", "recruiter", "university_admin"]),
  university_id: z.uuid().nullable(),
  onboarding_complete: z.boolean(),
  onboarding_step: z.number().int().min(1).max(99),
  status: z.enum(["active", "graduate", "deleting"]),
});

export const OrgMemberChanged = z.object({ user_id: z.uuid(), org_domain: Domain.nullable() });

export async function applyDomainsChanged(tx: Tx, payload: z.infer<typeof DomainsChanged>): Promise<void> {
  await tx`delete from identity.allowed_domains where university_id = ${payload.university_id}`;
  const seen = new Set<string>();
  for (const d of payload.domains) {
    if (seen.has(d.domain)) continue;
    seen.add(d.domain);
    await tx`
      insert into identity.allowed_domains (domain, university_id, kind, university_live_at)
      values (${d.domain}, ${payload.university_id}, ${d.kind}, ${payload.live_at})`;
  }
}

export async function applyPortalsChanged(tx: Tx, payload: z.infer<typeof PortalsChanged>): Promise<void> {
  await tx`
    insert into identity.gate_config (key, value) values ('portals.enabled', ${JSON.stringify(payload)}::text::jsonb)
    on conflict (key) do update set value = excluded.value, updated_at = now()`;
}

/** Profile facts for an account identity knows; facts for an unknown account are dropped. */
export async function applyProfileGateChanged(tx: Tx, p: z.infer<typeof ProfileGateChanged>): Promise<void> {
  if (!p.has_profile) {
    await tx`delete from identity.profile_facts where user_id = ${p.user_id}`;
    return;
  }
  await tx`
    insert into identity.profile_facts (user_id, has_profile, role, university_id, onboarding_complete, onboarding_step, status)
    select ${p.user_id}, true, ${p.role}, ${p.university_id}, ${p.onboarding_complete}, ${p.onboarding_step}, ${p.status}
     where exists (select 1 from identity.users u where u.id = ${p.user_id})
    on conflict (user_id) do update
      set has_profile = true, role = excluded.role, university_id = excluded.university_id,
          onboarding_complete = excluded.onboarding_complete, onboarding_step = excluded.onboarding_step,
          status = excluded.status, updated_at = now()`;
}

export async function applyOrgMemberChanged(tx: Tx, p: z.infer<typeof OrgMemberChanged>): Promise<void> {
  if (p.org_domain == null) {
    await tx`delete from identity.recruiter_org_domains where user_id = ${p.user_id}`;
    return;
  }
  await tx`
    insert into identity.recruiter_org_domains (user_id, org_domain)
    select ${p.user_id}, ${p.org_domain} where exists (select 1 from identity.users u where u.id = ${p.user_id})
    on conflict (user_id) do update set org_domain = excluded.org_domain, updated_at = now()`;
}

export type GateEventOutcome = "applied" | "wrong_producer" | "invalid_payload" | "unknown_type";

/** Applies one logged event to the copies (the consumer's handler; exported for tests and backfills). */
export async function applyGateEvent(tx: Tx, event: Pick<LoggedEvent, "type" | "producer" | "payload" | "version">): Promise<GateEventOutcome> {
  const type = event.type as GateEventType;
  const owner = GATE_EVENTS[type];
  if (!owner) return "unknown_type";
  if (event.producer !== owner) return "wrong_producer";
  if (event.version !== 1) return "invalid_payload";
  switch (type) {
    case "university.domains_changed": {
      const p = DomainsChanged.safeParse(event.payload);
      if (!p.success) return "invalid_payload";
      await applyDomainsChanged(tx, p.data);
      return "applied";
    }
    case "config.portals_changed": {
      const p = PortalsChanged.safeParse(event.payload);
      if (!p.success) return "invalid_payload";
      await applyPortalsChanged(tx, p.data);
      return "applied";
    }
    case "profile.gate_changed": {
      const p = ProfileGateChanged.safeParse(event.payload);
      if (!p.success) return "invalid_payload";
      await applyProfileGateChanged(tx, p.data);
      return "applied";
    }
    case "org.member_changed": {
      const p = OrgMemberChanged.safeParse(event.payload);
      if (!p.success) return "invalid_payload";
      await applyOrgMemberChanged(tx, p.data);
      return "applied";
    }
  }
}

export const GATE_CONSUMER = "identity.gate-facts";

/**
 * The consumer that keeps the copies (start it with the service; `runOnce` drains one batch). An event it
 * cannot apply is logged and skipped, so one bad event never stops the gate copies.
 */
export function gateFactsConsumer(options: { sql: postgres.Sql; logger?: Logger; pollMs?: number }): Consumer {
  return createConsumer({
    sql: options.sql,
    name: GATE_CONSUMER,
    types: Object.keys(GATE_EVENTS),
    pollMs: options.pollMs,
    logger: options.logger,
    handle: async (tx, event) => {
      const outcome = await applyGateEvent(tx, event);
      if (outcome !== "applied")
        options.logger?.warn("gate_facts.skipped", { action: `consume.${event.type}`, outcome: "refused", error_code: outcome });
    },
  });
}
