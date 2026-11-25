import { appendEvents, createConsumer, type Consumer, type LoggedEvent, type Logger } from "@skilient/platform";
import type postgres from "postgres";
import { z } from "zod";
import { startingStep } from "../domain/onboarding";
import { profileFlags, publishProfile, type Tx } from "./publish";

/**
 * Account lifecycle, driven by identity's events (decisions 2026-11-25: user.created creates the profile
 * through an idempotent handler, and signup never depends on people being up; Q1: the deletion state is
 * identity's and people mirrors it). Every event must come from `svc_identity`; anything else is ignored.
 *
 * | Event (v1)                  | Payload                                                       | People's half                                   |
 * | --------------------------- | ------------------------------------------------------------- | ----------------------------------------------- |
 * | user.created                | role, university_id, visibility, onboarding_* , status, ...   | profile + onboarding rows; name and email domain from GetSignupDetails |
 * | user.deletion_requested     | delete_after                                                  | status deleting, delete_after                   |
 * | user.deletion_cancelled     | -                                                             | status back to graduate (if graduated) or active |
 * | user.deleted                | user_id                                                       | every people row for the user; user.deletion_confirmed |
 * | user.email_domain_changed   | user_id, email_domain                                         | the profile's email domain                      |
 */
export const LIFECYCLE_EVENTS = ["user.created", "user.deletion_requested", "user.deletion_cancelled", "user.deleted", "user.email_domain_changed"] as const;
export const LIFECYCLE_CONSUMER = "people.lifecycle";
const IDENTITY = "svc_identity";

const Created = z.object({
  role: z.enum(["student", "faculty", "recruiter", "university_admin"]),
  university_id: z.uuid().nullable(),
  visibility: z.enum(["friends", "university", "global"]),
  onboarding_complete: z.boolean(),
  onboarding_step: z.number().int().min(1).max(6),
  onboarding_completed_at: z.string().nullable(),
  status: z.literal("active"),
});

/** What identity's GetSignupDetails returns for one account (the name never travels in an event). */
export interface SignupDetail {
  fullName: string;
  emailDomain: string | null;
}
export type SignupDetails = Map<string, SignupDetail>;

/** user.created: creates the profile and onboarding rows once; a replay or a vanished account does nothing. */
export async function applyUserCreated(tx: Tx, userId: string, payload: unknown, details: SignupDetails): Promise<"created" | "exists" | "no_details" | "invalid"> {
  const p = Created.safeParse(payload);
  if (!p.success) return "invalid";
  const d = details.get(userId);
  if (!d) return "no_details";
  const e = p.data;
  const inserted = await tx`
    insert into people.profiles (user_id, role, university_id, email_domain, full_name, onboarding_complete, visibility, status)
    values (${userId}, ${e.role}, ${e.university_id}, ${d.emailDomain}, ${d.fullName.slice(0, 60)}, ${e.onboarding_complete}, ${e.visibility}, 'active')
    on conflict (user_id) do nothing`;
  if (inserted.count === 0) return "exists";
  await tx`
    insert into people.onboarding_state (user_id, role, step, completed_at)
    values (${userId}, ${e.role}, ${e.onboarding_step ?? startingStep(e.role)}, ${e.onboarding_completed_at})`;
  await publishProfile(tx, userId, undefined);
  return "created";
}

/** user.deletion_requested / user.deletion_cancelled: the status people shows mirrors identity's. */
export async function applyDeletionState(tx: Tx, userId: string, requested: boolean, deleteAfter: string | null): Promise<boolean> {
  const before = await profileFlags(tx, userId);
  const done = requested
    ? await tx`update people.profiles set status = 'deleting', delete_after = ${deleteAfter ?? null}::timestamptz where user_id = ${userId} and ${deleteAfter ?? null}::timestamptz is not null`
    : await tx`update people.profiles set status = case when graduated_at is not null then 'graduate' else 'active' end, delete_after = null
                where user_id = ${userId} and status = 'deleting'`;
  if (done.count) await publishProfile(tx, userId, before);
  return done.count === 1;
}

/** user.deleted: removes everything people holds for the user and confirms (user.deletion_confirmed). */
export async function applyUserDeleted(tx: Tx, userId: string): Promise<void> {
  await tx`delete from people.profiles where user_id = ${userId}`; // cascades onboarding, friends, requests, blocks, mutes, dismissals, tours, tips, ui
  for (const table of ["shell_counts", "shell_facts", "fact_values", "skill_levels"] as const) await tx`delete from ${tx("people." + table)} where user_id = ${userId}`;
  await tx`delete from people.group_members where user_id = ${userId}`;
  await tx`insert into people.deleted_accounts (user_id) values (${userId}) on conflict do nothing`;
  await appendEvents(tx, [{ type: "user.deletion_confirmed", subjects: [userId], payload: { user_id: userId } }]);
}

/** user.email_domain_changed (identity's changeEmail; W2 Q9). */
export async function applyEmailDomainChanged(tx: Tx, userId: string, domain: unknown): Promise<void> {
  if (typeof domain !== "string" || !/^[a-z0-9.-]{1,253}$/.test(domain)) return;
  await tx`update people.profiles set email_domain = ${domain} where user_id = ${userId}`;
}

/** Applies one identity event (the consumer's handler; exported for tests and the cutover backfill). */
export async function applyLifecycleEvent(tx: Tx, event: Pick<LoggedEvent, "type" | "producer" | "subjects" | "payload" | "version">, details: SignupDetails): Promise<string> {
  if (event.producer !== IDENTITY) return "wrong_producer";
  if (event.version !== 1) return "invalid";
  const userId = event.subjects[0] ?? (typeof event.payload["user_id"] === "string" ? event.payload["user_id"] : null);
  if (!userId) return "invalid";
  switch (event.type) {
    case "user.created":
      return applyUserCreated(tx, userId, event.payload, details);
    case "user.deletion_requested":
      return (await applyDeletionState(tx, userId, true, typeof event.payload["delete_after"] === "string" ? event.payload["delete_after"] : null)) ? "applied" : "no_profile";
    case "user.deletion_cancelled":
      return (await applyDeletionState(tx, userId, false, null)) ? "applied" : "no_profile";
    case "user.deleted":
      await applyUserDeleted(tx, userId);
      return "applied";
    case "user.email_domain_changed":
      await applyEmailDomainChanged(tx, userId, event.payload["email_domain"]);
      return "applied";
    default:
      return "unknown_type";
  }
}

/** Reads signup details for a batch's user.created events in one call (createConsumer's `prepare`, W2 Q2). */
export type SignupDetailsPort = (userIds: readonly string[]) => Promise<SignupDetails>;

export function lifecycleConsumer(options: { sql: postgres.Sql; details: SignupDetailsPort; logger?: Logger; pollMs?: number }): Consumer {
  return createConsumer<SignupDetails>({
    sql: options.sql,
    name: LIFECYCLE_CONSUMER,
    types: LIFECYCLE_EVENTS,
    pollMs: options.pollMs,
    logger: options.logger,
    prepare: async (events) => {
      const ids = [...new Set(events.filter((e) => e.type === "user.created" && e.producer === IDENTITY).map((e) => e.subjects[0]).filter((x): x is string => Boolean(x)))];
      return ids.length ? options.details(ids) : new Map();
    },
    handle: async (tx, event, details) => {
      const outcome = await applyLifecycleEvent(tx, event, details);
      if (!["created", "exists", "applied"].includes(outcome))
        options.logger?.warn("lifecycle.skipped", { action: `consume.${event.type}`, outcome: "skipped", error_code: outcome });
    },
  });
}
