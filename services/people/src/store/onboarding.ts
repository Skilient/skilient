import type { NewEvent } from "@skilient/platform";
import { nextStep, readyToComplete } from "../domain/onboarding";
import { refused } from "../refusals";
import { canViewSql, updateOwnProfile, type ProfilePatch, type ProfileRow } from "./profiles";
import { profileFlags, publishProfile, type Db, type Tx } from "./publish";

/**
 * Onboarding (PRD 5.27): the wizard's rules moved from apps/web lib/actions/onboarding.ts (each step saves
 * its slice, then moves the saved step forward, never back), plus complete_onboarding, set_my_university and
 * department_options. Step changes publish `onboarding.advanced {user_id, step, role}` and completion
 * `onboarding.completed {user_id, role}` (today's analytics_onboarding trigger), with `profile.gate_changed`.
 */

/** `domain_admits_students(domain, university)` against people's own domains. */
async function admitsStudents(db: Db, domain: string | null, universityId: string | null): Promise<boolean> {
  if (!domain) return false;
  const [row] = await db`
    select 1 from people.university_domains where domain = ${domain} and kind in ('student', 'both')
       and (${universityId}::uuid is null or university_id = ${universityId}::uuid)`;
  return Boolean(row);
}

/** `set_my_university`: one of the universities that own the student's email domain, before completion. */
export async function setMyUniversity(tx: Tx, me: string | null, universityId: string | null): Promise<boolean> {
  if (!me) throw refused("not_signed_in_plain");
  const [p] = await tx<{ email_domain: string | null }[]>`select email_domain from people.profiles where user_id = ${me}`;
  if (!universityId || !(await admitsStudents(tx, p?.email_domain ?? null, universityId))) return false;
  const before = await profileFlags(tx, me);
  const done = await tx`update people.profiles set university_id = ${universityId} where user_id = ${me} and not onboarding_complete`;
  if (done.count === 0) return false;
  // The department text is matched again at the new university (sync_profile_department on university change).
  await tx`
    update people.profiles p set department_id = (select d.id from people.departments d where d.university_id = p.university_id
                                                     and lower(d.name) = lower(btrim(coalesce(p.department, ''))))
     where p.user_id = ${me}`;
  await publishProfile(tx, me, before);
  return true;
}

/** A direct write to the wizard's own row (step and notes), as the app's `advance` made it. */
export async function writeStep(tx: Tx, me: string | null, patch: { step?: number; data?: Record<string, unknown> } & Record<string, unknown>): Promise<number> {
  if (!me) throw refused("onboarding_field_not_editable");
  if (Object.keys(patch).some((k) => k !== "step" && k !== "data")) throw refused("onboarding_field_not_editable");
  if (patch.step !== undefined && (!Number.isInteger(patch.step) || patch.step < 1 || patch.step > 6)) throw refused("step_invalid");
  const [cur] = await tx<{ step: number; role: string }[]>`select step, role from people.onboarding_state where user_id = ${me} for update`;
  if (!cur) return 0;
  const before = await profileFlags(tx, me);
  const sets: Record<string, unknown> = {};
  if (patch.step !== undefined) sets["step"] = patch.step;
  if (patch.data !== undefined) sets["data"] = tx.json(patch.data as never);
  const done = await tx`update people.onboarding_state set ${tx(sets as never)} where user_id = ${me}`;
  const events: NewEvent[] = [];
  if (patch.step !== undefined && patch.step > cur.step)
    events.push({ type: "onboarding.advanced", subjects: [me], payload: { user_id: me, step: patch.step, role: cur.role } });
  await publishProfile(tx, me, before, events);
  return done.count;
}

/** The wizard's `begin`: a step submitted after Finish has nothing to save. */
async function begin(tx: Tx, me: string | null): Promise<string> {
  if (!me) throw refused("not_signed_in");
  const [p] = await tx<{ done: boolean }[]>`select onboarding_complete as done from people.profiles where user_id = ${me}`;
  if (!p) throw refused("profile_not_found");
  if (p.done) throw refused("already_onboarded");
  return me;
}

/** The wizard's `advance`: merges the step's notes and moves the saved step forward; returns the next step. */
async function advance(tx: Tx, me: string, completed: number, notes: Record<string, unknown> = {}): Promise<number> {
  const [state] = await tx<{ step: number; data: Record<string, unknown> }[]>`select step, data from people.onboarding_state where user_id = ${me} for update`;
  if (!state) throw refused("profile_not_found");
  const step = nextStep(state.step, completed);
  const count = await writeStep(tx, me, { step, data: { ...state.data, ...notes } });
  if (count !== 1) throw refused("profile_not_found");
  return completed + 1;
}

export async function saveUniversityStep(
  tx: Tx,
  me: string | null,
  input: { universityId: string | null; department: string; programme: string | null; graduationYear: number; campus: string | null },
): Promise<number> {
  const user = await begin(tx, me);
  if (input.universityId && !(await setMyUniversity(tx, user, input.universityId))) throw refused("university_refused");
  const [p] = await tx<{ university_id: string | null }[]>`select university_id::text from people.profiles where user_id = ${user}`;
  if (!p?.university_id) throw refused("university_missing");
  await updateOwnProfile(tx, user, { department: input.department, programme: input.programme, graduation_year: input.graduationYear, campus: input.campus });
  return advance(tx, user, 1);
}

export async function saveProfileStep(tx: Tx, me: string | null, input: { username: string; bio: string | null }): Promise<number> {
  const user = await begin(tx, me);
  await updateOwnProfile(tx, user, { username: input.username, bio: input.bio });
  return advance(tx, user, 2);
}

export async function saveGithubStep(tx: Tx, me: string | null, choice: string): Promise<number> {
  const user = await begin(tx, me);
  return advance(tx, user, 3, { github: choice === "connected" || choice === "later" ? choice : "skipped" });
}

export async function saveSkillsStep(tx: Tx, me: string | null): Promise<number> {
  const user = await begin(tx, me);
  return advance(tx, user, 4, { skills_seen: true });
}

export async function saveLookingForStep(tx: Tx, me: string | null, input: { lookingFor: string[]; recruiterVisible: boolean }): Promise<number> {
  const user = await begin(tx, me);
  const patch: ProfilePatch = { looking_for: input.lookingFor, recruiter_visible: input.recruiterVisible };
  await updateOwnProfile(tx, user, patch);
  return advance(tx, user, 5);
}

/** `complete_onboarding`: false while username, university, department or batch is missing. */
export async function completeOnboarding(tx: Tx, me: string | null): Promise<boolean> {
  if (!me) throw refused("not_signed_in_plain");
  const [p] = await tx<{ username: string | null; university_id: string | null; department: string | null; graduation_year: number | null; complete: boolean; role: string }[]>`
    select username, university_id::text, department, graduation_year, onboarding_complete as complete, role from people.profiles where user_id = ${me} for update`;
  if (!readyToComplete(p && { username: p.username, universityId: p.university_id, department: p.department, graduationYear: p.graduation_year })) return false;
  const before = await profileFlags(tx, me);
  await tx`update people.profiles set onboarding_complete = true where user_id = ${me} and not onboarding_complete`;
  const [o] = await tx<{ was_done: boolean }[]>`
    with prev as (select completed_at from people.onboarding_state where user_id = ${me})
    update people.onboarding_state set step = 6, completed_at = coalesce(completed_at, now()) where user_id = ${me}
    returning (select completed_at is not null from prev) as was_done`;
  const events: NewEvent[] = o && !o.was_done ? [{ type: "onboarding.completed", subjects: [me], payload: { user_id: me, role: p!.role } }] : [];
  await publishProfile(tx, me, before, events);
  return true;
}

/** `department_options`: the caller's university's departments and programmes. */
export async function departmentOptions(db: Db, me: string | null) {
  if (!me) throw refused("not_signed_in_plain");
  const [row] = await db<{ v: { own_list: boolean; department_id: string | null; departments: { id: string; name: string; programmes: string[] }[] } | null }[]>`
    select json_build_object(
      'own_list', exists (select 1 from people.departments d where d.university_id = p.university_id),
      'department_id', p.department_id,
      'departments', coalesce((
        select json_agg(json_build_object(
                 'id', d.id, 'name', d.name,
                 'programmes', coalesce((select json_agg(g.name order by g.name) from people.programmes g where g.department_id = d.id), '[]'::json))
               order by d.name)
          from people.departments d where d.university_id = p.university_id), '[]'::json)) as v
      from people.profiles p where p.user_id = ${me}`;
  return row?.v ?? null;
}

/**
 * GetOnboarding in one database trip: the wizard's row, the profile, the universities that own the email
 * domain, and the departments and programmes of the profile's university.
 */
export async function getOnboarding(db: Db, me: string) {
  const [row] = await db<
    {
      step: number;
      data: Record<string, unknown>;
      completed: boolean;
      profile: ProfileRow;
      universities: { id: string; name: string; slug: string; live: boolean }[];
      own_list: boolean;
      departments: { id: string; name: string; programmes: string[] }[];
    }[]
  >`
    select o.step, o.data, o.completed_at is not null as completed,
           (select row_to_json(x) from (
              select p.user_id, p.role, p.university_id, (select u.name from people.universities u where u.id = p.university_id) as university_name, p.email_domain, p.full_name, p.username, p.department,
                     p.department_id, p.programme, p.graduation_year, p.campus, p.bio, p.avatar_path, p.cover_path, p.visibility,
                     p.recruiter_visible, p.looking_for, p.onboarding_complete, p.chat_read_receipts, p.leaderboard_opt_out, p.status, p.delete_after
             ) x) as profile,
           coalesce((select json_agg(json_build_object('id', u.id, 'name', u.name, 'slug', u.slug, 'live', u.live_at is not null and u.live_at <= now()) order by u.name)
                       from people.universities u
                      where exists (select 1 from people.university_domains d where d.university_id = u.id and d.domain = p.email_domain and d.kind in ('student', 'both'))), '[]') as universities,
           exists (select 1 from people.departments d where d.university_id = p.university_id) as own_list,
           coalesce((select json_agg(json_build_object('id', d.id, 'name', d.name,
                       'programmes', coalesce((select json_agg(g.name order by g.name) from people.programmes g where g.department_id = d.id), '[]'::json)) order by d.name)
                       from people.departments d where d.university_id = p.university_id), '[]') as departments
      from people.profiles p join people.onboarding_state o on o.user_id = p.user_id
     where p.user_id = ${me}`;
  if (!row) throw refused("profile_not_found");
  return row;
}

/** Onboarding step 6: onboarded people at the viewer's university in their department (and batch), newest first. */
export async function classmates(db: Db, me: string, limit: number) {
  return db<{ user_id: string; username: string; full_name: string; department: string | null; graduation_year: number | null; avatar_path: string | null }[]>`
    with me as (select university_id, department, graduation_year from people.profiles where user_id = ${me})
    select p.user_id::text, p.username, p.full_name, p.department, p.graduation_year,
           case when ${canViewSql(db, me)} then p.avatar_path end as avatar_path
      from people.profiles p, me
     where me.university_id is not null and me.department is not null
       and p.university_id = me.university_id and p.department = me.department
       and (me.graduation_year is null or p.graduation_year = me.graduation_year)
       and p.onboarding_complete and p.user_id <> ${me} and p.username is not null
       and ${canViewSql(db, me)}
     order by p.created_at desc, p.user_id
     limit ${Math.min(Math.max(limit || 12, 1), 30)}`;
}
