import { COUNT_KEYS, FACT_SCHEMAS, MILESTONE_KEYS, type CountKey, type Facts, type MilestoneKey, type ShellInputs } from "../domain/shell";
import { navBadges } from "../domain/shell";
import { refused } from "../refusals";
import type { Db } from "./publish";

/**
 * The page shell (prd.md "How one page load travels": the shell comes from people). One query reads the
 * viewer's profile, university, the student tour, the pending friend requests and the event-fed copies
 * (decision Q1, advisor); the rules in domain/shell.ts turn them into badges, to-dos and the next step.
 */
interface Row {
  user_id: string;
  full_name: string;
  username: string | null;
  avatar_path: string | null;
  university_id: string | null;
  university_name: string | null;
  role: string;
  status: string;
  onboarding_complete: boolean;
  profile_finished: boolean;
  friend_requests: number;
  counts: Record<string, number> | null;
  milestones: string[] | null;
  facts: Record<string, unknown> | null;
  tour: { step: number; completed: boolean; skipped: boolean } | null;
}

async function read(db: Db, me: string): Promise<Row | undefined> {
  const [row] = await db<Row[]>`
    select p.user_id::text, p.full_name, p.username, p.avatar_path, p.university_id::text, u.name as university_name, p.role, p.status,
           p.onboarding_complete, (p.bio is not null and p.avatar_path is not null) as profile_finished,
           (select count(*)::int from people.friend_requests r where r.receiver_id = p.user_id and r.status = 'pending') as friend_requests,
           (select json_object_agg(c.key, c.count) from people.shell_counts c where c.user_id = p.user_id) as counts,
           (select array_agg(f.key) from people.shell_facts f where f.user_id = p.user_id) as milestones,
           (select json_object_agg(v.key, v.value) from people.fact_values v where v.user_id = p.user_id) as facts,
           (select json_build_object('step', t.step, 'completed', t.completed_at is not null, 'skipped', t.skipped_at is not null)
              from people.tour_progress t where t.user_id = p.user_id and t.tour_id = 'student') as tour
      from people.profiles p left join people.universities u on u.id = p.university_id
     where p.user_id = ${me}`;
  return row;
}

/** Turns the copies into typed inputs; anything not in the key registry was never stored, but is ignored here too. */
function inputs(row: Row): ShellInputs {
  const counts: Partial<Record<CountKey, number>> = {};
  for (const [k, v] of Object.entries(row.counts ?? {})) if (k in COUNT_KEYS) counts[k as CountKey] = v;
  const milestones = new Set((row.milestones ?? []).filter((k): k is MilestoneKey => k in MILESTONE_KEYS));
  const facts: Facts = {};
  for (const [k, v] of Object.entries(row.facts ?? {})) {
    const spec = FACT_SCHEMAS[k as keyof typeof FACT_SCHEMAS];
    const parsed = spec?.schema.safeParse(v);
    if (parsed?.success) (facts as Record<string, unknown>)[k] = parsed.data;
  }
  return { friendRequests: row.friend_requests, counts, milestones, facts, profileFinished: row.profile_finished };
}

/** GetShell: the viewer's card, the student tour and the badges, in one database trip. */
export async function getShell(db: Db, me: string | null) {
  if (!me) throw refused("not_signed_in");
  const row = await read(db, me);
  if (!row) throw refused("profile_not_found");
  const onboarded = row.onboarding_complete;
  return {
    me: {
      user_id: row.user_id,
      full_name: row.full_name,
      username: row.username,
      avatar_path: row.avatar_path,
      university_id: row.university_id,
      university_name: row.university_name,
      role: row.role,
      status: row.status,
      onboarding_complete: onboarded,
    },
    tour: onboarded && row.role === "student" ? (row.tour ? { started: true, ...row.tour } : { started: false, step: 0, completed: false, skipped: false }) : null,
    badges: onboarded ? navBadges(inputs(row)) : null,
  };
}

/** The shell's inputs for the to-do, next-step and checklist reads (one trip; onboarded users only). */
export async function shellInputs(db: Db, me: string | null): Promise<ShellInputs> {
  if (!me) throw refused("not_signed_in_plain");
  const row = await read(db, me);
  if (!row?.onboarding_complete) throw refused("finish_onboarding");
  return inputs(row);
}
