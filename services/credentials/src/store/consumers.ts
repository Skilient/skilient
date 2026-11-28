import { createConsumer, startCall, type Consumer, type LoggedEvent, type Logger } from "@skilient/platform";
import type postgres from "postgres";
import { z } from "zod";
import { emailHash } from "../domain/record";
import type { Ports } from "../ports";
import { deleteCvs, revokeAll } from "./cv";
import { publish, type Tx } from "./db";
import { emptyFacts, eventClosed, S, swapClosed, taskCompleted, termConfirmed, ventureCompleted, wantedFacts, type IssuingFacts } from "./issuing";
import { deleteRecord, matchClaims } from "./record";

/**
 * Credentials' consumers. Each event type has one owning producer role; anything else is logged and dropped.
 * Idempotent throughout (the platform records applied event ids; entries are unique per person, kind and source).
 *
 * | Event (v1)              | From      | Consumer             | Effect                                              |
 * | ----------------------- | --------- | -------------------- | --------------------------------------------------- |
 * | group.member_changed    | community | credentials.copies   | society officers (who confirms, corrects, revokes)  |
 * | entitlement.changed     | billing   | credentials.copies   | Student Pro features (W12)                          |
 * | user.banned             | identity  | credentials.copies   | every CV version and link revoked (cv_on_ban)       |
 * | user.deleted            | identity  | credentials.copies   | CVs wiped, the Record gone; user.deletion_confirmed |
 * | event.closed            | community | credentials.issuing  | the close-out's entries and held walk-ins           |
 * | society.term_changed    | community | credentials.issuing  | the Office bearer entry (confirmed)                 |
 * | venture.completed       | work      | credentials.issuing  | Venture completed entries                           |
 * | task.completed          | work      | credentials.issuing  | the proof task entry                                |
 * | swap.closed             | work      | credentials.issuing  | the teacher's Taught entry                          |
 * | user.created            | identity  | credentials.issuing  | held claims matched to the confirmed address        |
 */
export const COPIES_CONSUMER = "credentials.copies";
export const ISSUING_CONSUMER = "credentials.issuing";
export const COPY_EVENTS = ["group.member_changed", "entitlement.changed", "user.banned", "user.deleted"] as const;
export const ISSUING_EVENTS = ["event.closed", "society.term_changed", "venture.completed", "task.completed", "swap.closed", "user.created"] as const;

const OWNER: Record<(typeof COPY_EVENTS)[number] | (typeof ISSUING_EVENTS)[number], string> = {
  "group.member_changed": "svc_community",
  "entitlement.changed": "svc_billing",
  "user.banned": "svc_identity",
  "user.deleted": "svc_identity",
  "event.closed": "svc_community",
  "society.term_changed": "svc_community",
  "venture.completed": "svc_work",
  "task.completed": "svc_work",
  "swap.closed": "svc_work",
  "user.created": "svc_identity",
};

const id = z.uuid();
const C = {
  member: z.object({ kind: z.string().max(40), group_id: id, user_id: id, member: z.boolean(), role: z.string().max(40).optional() }),
  entitlement: z.object({ subject_id: id, key: z.string().regex(/^[a-z_]+\.[a-z_]+$/), value: z.unknown() }),
  user: z.object({ user_id: id }),
};

export type Outcome = "applied" | "ignored" | "wrong_producer" | "invalid_payload" | "unknown_type";
type Event = Pick<LoggedEvent, "type" | "producer" | "payload" | "version" | "subjects"> & { at?: string };

function check(event: Event): Outcome | null {
  if (event.version !== 1) return "invalid_payload";
  const owner = OWNER[event.type as keyof typeof OWNER];
  if (!owner) return "unknown_type";
  if (owner !== event.producer) return "wrong_producer";
  return null;
}

/** Applies one copy event (the consumer's handler; exported for tests and replays). */
export async function applyCopyEvent(tx: Tx, event: Event): Promise<Outcome> {
  const bad = check(event);
  if (bad) return bad;
  switch (event.type) {
    case "group.member_changed": {
      const r = C.member.safeParse(event.payload);
      if (!r.success) return "invalid_payload";
      const p = r.data;
      if (p.kind !== "society") return "ignored";
      if (p.member && (p.role === "president" || p.role === "officer"))
        await tx`insert into credentials.society_officers (society_id, user_id, role) values (${p.group_id}, ${p.user_id}, ${p.role})
                 on conflict (society_id, user_id) do update set role = excluded.role`;
      else await tx`delete from credentials.society_officers where society_id = ${p.group_id} and user_id = ${p.user_id}`;
      return "applied";
    }
    case "entitlement.changed": {
      const r = C.entitlement.safeParse(event.payload);
      if (!r.success) return "invalid_payload";
      const p = r.data;
      if (p.value === null || p.value === undefined || p.value === false) await tx`delete from credentials.entitlements where subject_id = ${p.subject_id} and key = ${p.key}`;
      else
        await tx`insert into credentials.entitlements (subject_id, key, value) values (${p.subject_id}, ${p.key}, ${JSON.stringify(p.value)}::text::jsonb)
                 on conflict (subject_id, key) do update set value = excluded.value`;
      return "applied";
    }
    case "user.banned": {
      const r = C.user.safeParse(event.payload);
      if (!r.success) return "invalid_payload";
      await revokeAll(tx, r.data.user_id, "suspended");
      return "applied";
    }
    case "user.deleted": {
      const user = event.subjects[0] ?? (typeof event.payload["user_id"] === "string" ? event.payload["user_id"] : null);
      if (!user || !id.safeParse(user).success) return "invalid_payload";
      await deleteUser(tx, user);
      return "applied";
    }
    default:
      return "unknown_type";
  }
}

/** user.deleted: CVs revoked and wiped (codes stay, verify says Revoked), the Record gone, others' rows lose the id. */
export async function deleteUser(tx: Tx, userId: string): Promise<void> {
  await deleteCvs(tx, userId);
  await deleteRecord(tx, userId);
  await publish(tx, [{ type: "user.deletion_confirmed", subjects: [userId], payload: { user_id: userId } }]);
}

/** What one batch of issuing events reads from other services: one batch call each (the consumer's prepare). */
export async function gatherFacts(events: readonly Event[], ports: Ports): Promise<IssuingFacts & { emails: Map<string, string | null> }> {
  const f = { ...emptyFacts(), emails: new Map<string, string | null>() };
  const w = wantedFacts(events);
  const call = startCall();
  const created = events.filter((e) => e.type === "user.created").map((e) => String(e.payload["user_id"] ?? e.subjects[0] ?? ""));
  const [facts, ventures, names, accounts] = await Promise.all([
    w.eventIds.size || w.termIds.size || w.attendeeIds.size || w.societyIds.size
      ? ports.recordFacts({ eventIds: [...w.eventIds], termIds: [...w.termIds], attendeeIds: [...w.attendeeIds], societyIds: [...w.societyIds] }, call)
      : null,
    w.ventureIds.size ? ports.ventureTitles([...w.ventureIds], call) : new Map<string, string>(),
    w.learnerIds.size ? ports.profiles([...w.learnerIds], call) : new Map(),
    created.length ? ports.accounts(created.filter((u) => id.safeParse(u).success), call) : new Map(),
  ]);
  if (facts) {
    f.events = facts.events;
    f.terms = facts.terms;
    f.labels = facts.labels;
    f.walkIns = facts.walkIns;
    f.societies = new Map([...facts.societies].map(([k, s]) => [k, { name: s.name, status: s.status }]));
  }
  // The walk-ins' addresses come from community, so the account check is a second call (identity's ResolveEmails).
  if (f.walkIns.size) f.accounts = await ports.resolveEmails([...f.walkIns.values()], call);
  f.ventures = ventures;
  f.names = new Map([...names].map(([k, p]) => [k, (p as { name: string }).name]));
  for (const [u, a] of accounts as Map<string, { email: string; confirmed: boolean }>) f.emails.set(u, a.confirmed ? a.email : null);
  return f;
}

/** Applies one issuing event (the consumer's handler; exported for tests and replays). */
export async function applyIssuingEvent(tx: Tx, event: Event, f: IssuingFacts & { emails: Map<string, string | null> }): Promise<Outcome> {
  const bad = check(event);
  if (bad) return bad;
  const parse = <T>(s: z.ZodType<T>) => {
    const r = s.safeParse(event.payload);
    return r.success ? r.data : null;
  };
  switch (event.type) {
    case "event.closed": {
      const p = parse(S.closed);
      if (!p) return "invalid_payload";
      await eventClosed(tx, p, f);
      return "applied";
    }
    case "society.term_changed": {
      const p = parse(S.term);
      if (!p) return "invalid_payload";
      await termConfirmed(tx, p, f);
      return "applied";
    }
    case "venture.completed": {
      const p = parse(S.venture);
      if (!p) return "invalid_payload";
      await ventureCompleted(tx, p, f);
      return "applied";
    }
    case "task.completed": {
      const p = parse(S.task);
      if (!p) return "invalid_payload";
      await taskCompleted(tx, p, event.at ?? new Date().toISOString());
      return "applied";
    }
    case "swap.closed": {
      const p = parse(S.swap);
      if (!p) return "invalid_payload";
      await swapClosed(tx, p, f);
      return "applied";
    }
    case "user.created": {
      const p = parse(C.user);
      if (!p) return "invalid_payload";
      const email = f.emails.get(p.user_id);
      await matchClaims(tx, p.user_id, email ? emailHash(email) : null);
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
      if (outcome !== "applied" && outcome !== "ignored") options.logger?.warn("copies.skipped", { action: `consume.${event.type}`, outcome: "skipped", error_code: outcome });
    },
  });
}

export function issuingConsumer(options: { sql: postgres.Sql; ports: Ports; logger?: Logger; pollMs?: number }): Consumer {
  return createConsumer({
    sql: options.sql,
    name: ISSUING_CONSUMER,
    types: ISSUING_EVENTS,
    pollMs: options.pollMs,
    logger: options.logger,
    batch: 50,
    prepare: (events) => gatherFacts(events, options.ports),
    handle: async (tx, event, facts) => {
      const outcome = await applyIssuingEvent(tx, event, facts);
      if (outcome !== "applied" && outcome !== "ignored") options.logger?.warn("issuing.skipped", { action: `consume.${event.type}`, outcome: "skipped", error_code: outcome });
    },
  });
}
