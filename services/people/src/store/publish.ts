import { appendEvents, type NewEvent } from "@skilient/platform";
import type postgres from "postgres";

export type Tx = postgres.TransactionSql;
export type Db = postgres.Sql | Tx;

/**
 * What people publishes about a profile (decision 2026-11-25, advisor, W2 Q4). Payloads carry ids, enums and
 * flags only: names, usernames, bios, avatars and `city` travel through the ProfileCards batch read.
 *
 * - `profile.updated` v1 on every change to a profile: what messaging (read receipts), ranking (opt-out,
 *   cohort), market (recruiter visibility, looking for) and content (status, university) copy.
 * - `profile.gate_changed` v1, exactly as identity's gate copy reads it (services/identity/src/store/gate-copies.ts),
 *   whenever a gate field changes: role, university, onboarding, status, or the profile appears or goes.
 */
export interface ProfileFlags {
  user_id: string;
  role: string;
  university_id: string | null;
  department_id: string | null;
  /** sha256 of the department text, for content's exact same-programme match (W3); never the text. */
  department_hash: string | null;
  graduation_year: number | null;
  visibility: string;
  status: string;
  read_receipts: boolean;
  leaderboard_opt_out: boolean;
  recruiter_visible: boolean;
  looking_for: string[];
  availability: string[];
  remote_ok: boolean;
  onboarding_complete: boolean;
  onboarding_step: number;
}

export async function profileFlags(db: Db, userId: string): Promise<ProfileFlags | undefined> {
  const [row] = await db<ProfileFlags[]>`
    select p.user_id::text, p.role, p.university_id::text, p.department_id::text,
           case when p.department is not null then encode(sha256(convert_to(p.department, 'UTF8')), 'hex') end as department_hash, p.graduation_year, p.visibility, p.status,
           p.chat_read_receipts as read_receipts, p.leaderboard_opt_out, p.recruiter_visible, p.looking_for, p.availability,
           p.remote_ok, p.onboarding_complete, coalesce(o.step, 1)::int as onboarding_step
      from people.profiles p left join people.onboarding_state o on o.user_id = p.user_id
     where p.user_id = ${userId}`;
  return row;
}

const gateOf = (f: ProfileFlags | undefined) =>
  f && { role: f.role, university_id: f.university_id, onboarding_complete: f.onboarding_complete, onboarding_step: f.onboarding_step, status: f.status };

/**
 * Publishes the profile's current flags after a change, in the change's transaction. `before` is the flags
 * read before the change (undefined for a new profile): the gate event is sent only when a gate field moved.
 */
export async function publishProfile(tx: Tx, userId: string, before: ProfileFlags | undefined, extra: NewEvent[] = []): Promise<void> {
  const after = await profileFlags(tx, userId);
  const events: NewEvent[] = [];
  if (after) {
    const { onboarding_step: _step, ...flags } = after;
    if (JSON.stringify(after) !== JSON.stringify(before)) events.push({ type: "profile.updated", subjects: [userId], payload: { ...flags } });
    if (JSON.stringify(gateOf(after)) !== JSON.stringify(gateOf(before)))
      events.push({
        type: "profile.gate_changed",
        subjects: [userId],
        payload: {
          user_id: userId,
          has_profile: true,
          role: after.role,
          university_id: after.university_id,
          onboarding_complete: after.onboarding_complete,
          onboarding_step: after.onboarding_step,
          status: after.status,
        },
      });
  } else if (before) {
    events.push({
      type: "profile.gate_changed",
      subjects: [userId],
      payload: { user_id: userId, has_profile: false, role: before.role, university_id: before.university_id, onboarding_complete: false, onboarding_step: 1, status: before.status },
    });
  }
  await appendEvents(tx, [...events, ...extra]);
}
