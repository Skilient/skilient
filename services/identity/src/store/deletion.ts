import { appendEvents, createConsumer, refuse, type JobHandler, type LoggedEvent, type Logger, type Schedule } from "@skilient/platform";
import type postgres from "postgres";
import type { ApiDeps } from "../deps";
import { signinAccountKey } from "../domain/signin";
import { bumpTokenVersion } from "./sessions";

/**
 * Account deletion (step 11; prd.md "Data protection"; decision Q1: the deletion state lives in identity and
 * every other service reacts to `user.deleted`). Ported from `private.request_account_deletion`,
 * `cancel_account_deletion`, `delete_account` and `account_deletion_run`:
 *   - a user asks; 14 days later the hourly run deletes identity's data and emits `user.deleted` (ids only);
 *   - every service that holds user data deletes its own and emits `user.deletion_confirmed`; identity
 *     records each confirmation once (by the event's producer role) and a daily check logs the services that
 *     have not confirmed after 24 hours.
 * Events carry ids and dates only.
 */
type Tx = postgres.TransactionSql;

export const GRACE_DAYS = 14;
/** Services that hold user data and must confirm a deletion (prd.md, "Service catalogue"). */
export const CONFIRMING_SERVICES = [
  "people",
  "content",
  "messaging",
  "work",
  "ranking",
  "community",
  "credentials",
  "notify",
  "trust",
  "market",
  "billing",
  "media",
] as const;
export const DELETION_CONFIRMED = "user.deletion_confirmed";
const CONFIRMATIONS_CONSUMER = "identity.deletion-confirmations";
/** At most this many accounts per hourly run, as today; one stuck account never blocks the rest. */
const RUN_BATCH = 20;

/**
 * Whether the user finished onboarding (today's `require_user`), from identity's event-fed copy of people's
 * gate facts, `identity.profile_facts` (decision Q1).
 */
export type OnboardedCheck = (tx: Tx, userId: string) => Promise<boolean>;

export const onboardedFromGateFacts: OnboardedCheck = async (tx, userId) => {
  const [row] = await tx<{ done: boolean }[]>`select onboarding_complete as done from identity.profile_facts where user_id = ${userId}`;
  return row?.done === true;
};

async function requireOnboarded(tx: Tx, userId: string | null, onboarded: OnboardedCheck): Promise<string> {
  if (!userId) throw refuse("not_signed_in", "not signed in");
  if (!(await onboarded(tx, userId))) throw refuse("not_allowed", "finish onboarding first");
  return userId;
}

/** RequestAccountDeletion: schedules deletion in 14 days; asking again returns the same date. */
export async function requestAccountDeletion(tx: Tx, userId: string | null, onboarded: OnboardedCheck = onboardedFromGateFacts): Promise<Date> {
  const me = await requireOnboarded(tx, userId, onboarded);
  const [staff] = await tx`select 1 from identity.staff_roles where user_id = ${me} limit 1`;
  if (staff) throw refuse("precondition", "staff accounts are removed by a super admin");
  const [set] = await tx<{ delete_after: Date }[]>`
    update identity.users
       set status = 'deleting', delete_after = now() + make_interval(days => ${GRACE_DAYS}), deletion_requested_at = now(), updated_at = now()
     where id = ${me} and status <> 'deleting'
    returning delete_after`;
  if (set) {
    await appendEvents(tx, [{ type: "user.deletion_requested", subjects: [me], payload: { delete_after: set.delete_after.toISOString() } }]);
    return set.delete_after;
  }
  const [already] = await tx<{ delete_after: Date }[]>`select delete_after from identity.users where id = ${me} and status = 'deleting'`;
  if (!already) throw refuse("not_found", "account not found");
  return already.delete_after; // already requested: the same date
}

/** CancelAccountDeletion. `people` restores its own active or graduate status from the event. */
export async function cancelAccountDeletion(tx: Tx, userId: string | null, onboarded: OnboardedCheck = onboardedFromGateFacts): Promise<void> {
  const me = await requireOnboarded(tx, userId, onboarded);
  const done = await tx`
    update identity.users set status = 'active', delete_after = null, deletion_requested_at = null, updated_at = now()
     where id = ${me} and status = 'deleting'`;
  if (done.count !== 1) throw refuse("precondition", "no deletion is pending");
  await appendEvents(tx, [{ type: "user.deletion_cancelled", subjects: [me] }]);
}

/**
 * `private.delete_account`, identity's half: removes the account and everything identity holds about it
 * (sessions, tokens, factors, codes, devices, security events, acceptances, roles, sanction marks cascade
 * from identity.users; failure counters and rate-limit keys are removed by key), records the deletion for
 * the confirmation check, and emits `user.deleted`. Audit rows stay: they are the staff record.
 */
export async function deleteAccount(tx: Tx, userId: string): Promise<void> {
  const [user] = await tx<{ email: string }[]>`
    select email from identity.users where id = ${userId} and status = 'deleting' and delete_after <= now() for update`;
  if (!user) throw refuse("precondition", "this account isn't due for deletion");
  await tx`delete from identity.auth_failures where key = ${signinAccountKey(user.email)}`;
  await tx`delete from platform.rate_limit_events where key like ${"%" + userId}`;
  // Every service refuses the account's access tokens within a second, not only when they expire.
  await bumpTokenVersion(tx, userId, "account_deleted");
  const done = await tx`delete from identity.users where id = ${userId}`;
  if (done.count !== 1) throw refuse("conflict", "account not deleted");
  await tx`insert into identity.deleted_accounts (user_id) values (${userId}) on conflict (user_id) do nothing`;
  await appendEvents(tx, [{ type: "user.deleted", subjects: [userId], payload: { user_id: userId } }]);
}

/** `private.account_deletion_run` (hourly): deletes up to 20 due accounts; returns how many. */
export async function accountDeletionRun(tx: Tx, logger?: Logger): Promise<number> {
  const due = await tx<{ id: string }[]>`
    select id from identity.users where status = 'deleting' and delete_after <= now()
     order by delete_after limit ${RUN_BATCH} for update skip locked`;
  let deleted = 0;
  for (const { id } of due) {
    try {
      await tx.savepoint((sp) => deleteAccount(sp, id));
      deleted += 1;
    } catch (error) {
      // Retried next hour. No user id in the log line: the count and the error code are enough to look.
      logger?.warn("deletion.account_failed", { action: "account-deletion", outcome: "error", error_code: error instanceof Error ? error.message.slice(0, 80) : "unknown" });
    }
  }
  return deleted;
}

/** Applies one `user.deletion_confirmed` event: the producer's role names the service (`svc_<name>`). */
export async function applyDeletionConfirmation(tx: Tx, event: Pick<LoggedEvent, "id" | "producer" | "subjects" | "payload">, logger?: Logger): Promise<boolean> {
  const service = event.producer.replace(/^svc_/, "");
  const userId = event.subjects[0] ?? (typeof event.payload["user_id"] === "string" ? event.payload["user_id"] : null);
  if (!(CONFIRMING_SERVICES as readonly string[]).includes(service) || !userId) {
    logger?.warn("deletion.confirmation_ignored", { action: "deletion-confirmation", outcome: "ignored", producer: event.producer.slice(0, 40) });
    return false;
  }
  const done = await tx`
    insert into identity.deletion_confirmations (user_id, service, event_id)
    select ${userId}::uuid, ${service}, ${event.id}::uuid
     where exists (select 1 from identity.deleted_accounts where user_id = ${userId}::uuid)
    on conflict (user_id, service) do nothing`;
  return done.count === 1;
}

/** Reads every new confirmation event once (the platform consumer records applied event ids). */
export async function drainDeletionConfirmations(sql: postgres.Sql, logger?: Logger): Promise<number> {
  const consumer = createConsumer({
    sql,
    name: CONFIRMATIONS_CONSUMER,
    types: [DELETION_CONFIRMED],
    handle: async (tx, event) => {
      await applyDeletionConfirmation(tx, event, logger);
    },
    logger,
  });
  let total = 0;
  for (;;) {
    const n = await consumer.runOnce();
    total += n;
    if (n < 100) return total;
  }
}

export interface DeletionCheck {
  /** Deleted accounts at least 24 hours old with a service still to confirm. */
  unconfirmed: number;
  /** Each missing service, with how many accounts it has not confirmed. */
  missing: Record<string, number>;
  /** Fully confirmed records older than 30 days, removed. */
  purged: number;
}

/**
 * The daily check (prd.md: "identity reports any service that has not confirmed after 24 hours"): logs one
 * line naming the services and counts (no user ids), marks those accounts reported, and removes records that
 * every service confirmed more than 30 days ago.
 */
export async function deletionCheck(tx: Tx, logger?: Logger): Promise<DeletionCheck> {
  const rows = await tx<{ user_id: string; confirmed: string[] }[]>`
    select d.user_id::text, coalesce(array_agg(c.service) filter (where c.service is not null), '{}') as confirmed
      from identity.deleted_accounts d
      left join identity.deletion_confirmations c on c.user_id = d.user_id
     where d.deleted_at <= now() - interval '24 hours'
     group by d.user_id`;
  const missing: Record<string, number> = {};
  const late: string[] = [];
  const complete: string[] = [];
  for (const r of rows) {
    const gaps = CONFIRMING_SERVICES.filter((s) => !r.confirmed.includes(s));
    if (gaps.length === 0) complete.push(r.user_id);
    else {
      late.push(r.user_id);
      for (const s of gaps) missing[s] = (missing[s] ?? 0) + 1;
    }
  }
  if (late.length) {
    await tx`update identity.deleted_accounts set reported_at = now() where user_id = any(${late}::uuid[])`;
    logger?.warn("deletion.unconfirmed", {
      action: "account-deletion-check",
      outcome: "unconfirmed",
      accounts: late.length,
      services: Object.keys(missing).sort().join(","),
    });
  }
  const purged = complete.length
    ? (await tx`delete from identity.deleted_accounts where user_id = any(${complete}::uuid[]) and deleted_at <= now() - interval '30 days'`).count
    : 0;
  return { unconfirmed: late.length, missing, purged };
}

/** The hourly run (pg_cron `account-deletion` today) and the daily confirmation check, in UTC. */
export const deletionSchedules: Schedule[] = [
  { name: "account-deletion", cron: "17 * * * *" },
  { name: "account-deletion-check", cron: "41 4 * * *" },
];

export function deletionJobs(deps: ApiDeps): Record<string, JobHandler> {
  return {
    "account-deletion": async (tx) => {
      const n = await accountDeletionRun(tx, deps.logger);
      deps.logger.info("deletion.run", { action: "account-deletion", outcome: "ok", deleted: n });
    },
    "account-deletion-check": async (tx) => {
      await drainDeletionConfirmations(deps.sql, deps.logger);
      await deletionCheck(tx, deps.logger);
    },
  };
}
