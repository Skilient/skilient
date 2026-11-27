import { uuidv7 } from "@skilient/platform";
import { refused, refusedWith } from "../refusals";
import { canSeeSociety, isOfficer, requireOfficer, requireUser, society, societyLimits, type Db, type Filler, type Row, type StaffCheck, type Tx } from "./db";
import { applicationChanged, inductionChanged, memberChanged, publish, termChanged } from "./publish";
import { CARD } from "./societies";

/**
 * Induction rounds (the venture roles, questions and applications pattern), and the hourly society-tick. Ported
 * from 20261111000001_societies.sql.
 */
export interface RoundInput {
  id: string | null;
  title: string;
  description: string;
  deadline: string;
  roles: { title: string; seats: number; skill_ids: string[] }[];
  questions: string[];
}

interface RoundRow {
  id: string;
  society_id: string;
  title: string;
  deadline: Date;
  status: string;
  past: boolean;
}
async function round(db: Db, id: string, lock = false): Promise<RoundRow | undefined> {
  const [r] = lock
    ? await db<RoundRow[]>`select id::text, society_id::text, title, deadline, status, deadline <= now() as past from community.induction_rounds where id = ${id} for update`
    : await db<RoundRow[]>`select id::text, society_id::text, title, deadline, status, deadline <= now() as past from community.induction_rounds where id = ${id}`;
  return r;
}

/** `save_induction_round(society, p)`. */
export async function saveRound(tx: Tx, me: string | null, societyId: string, p: RoundInput): Promise<string> {
  const s = await requireOfficer(tx, societyId, me);
  if (s.status !== "verified") throw refused("rounds_once_verified");
  const limits = await societyLimits(tx);
  const deadline = new Date(p.deadline);
  if (!p.deadline || Number.isNaN(deadline.getTime())) throw refused("pick_deadline");
  const [w] = await tx<{ ok: boolean }[]>`select (${deadline} > now() and ${deadline} <= now() + make_interval(days => ${limits.induction_max_days})) as ok`;
  if (!w!.ok) throw refusedWith("deadline_window", limits.induction_max_days);
  if (p.roles.length < 1 || p.roles.length > 10) throw refused("round_roles");
  if (p.questions.length > limits.induction_questions) throw refusedWith("up_to_questions", limits.induction_questions);
  const title = p.title.trim();
  const description = p.description.trim() || null;
  let id = p.id;
  if (!id) {
    id = uuidv7();
    await tx`
      insert into community.induction_rounds (id, society_id, title, description, deadline, created_by)
      values (${id}, ${societyId}, ${title}, ${description}, ${deadline}, ${me})`;
  } else {
    const upd = await tx`
      update community.induction_rounds set title = ${title}, description = ${description}, deadline = ${deadline}
       where id = ${id} and society_id = ${societyId} and status = 'draft'`;
    if (!upd.count) throw refused("draft_only");
    await tx`delete from community.induction_roles where round_id = ${id}`;
    await tx`delete from community.induction_questions where round_id = ${id}`;
  }
  let i = 0;
  for (const r of p.roles) {
    i += 1;
    await tx`
      insert into community.induction_roles (id, round_id, title, seats, skill_ids, position)
      values (${uuidv7()}, ${id}, ${r.title.trim()}, ${r.seats || 1}, ${r.skill_ids}::text[], ${i})`;
  }
  i = 0;
  for (const q of p.questions) {
    i += 1;
    await tx`insert into community.induction_questions (round_id, position, body) values (${id}, ${i}, ${q.trim()})`;
  }
  return id;
}

/** `publish_induction_round(round)`. */
export async function publishRound(tx: Tx, me: string | null, roundId: string): Promise<void> {
  const r = await round(tx, roundId, true);
  if (!r) throw refused("round_not_found");
  const s = await requireOfficer(tx, r.society_id, me);
  if (r.status !== "draft") throw refused("round_published");
  if (r.past) throw refused("deadline_past");
  await tx`update community.induction_rounds set status = 'open', published_at = now() where id = ${roundId}`;
  await publish(tx, [inductionChanged({ ...r, status: "open", university_id: s.university_id }, me)]);
}

/** `induction_round_page(round)`. */
export async function roundPage(db: Db, me: string | null, roundId: string, staff: StaffCheck, fill: Filler): Promise<Row> {
  const m = await requireUser(db, me);
  const r = await round(db, roundId);
  if (!r || !(await canSeeSociety(db, await society(db, r.society_id), m.id, staff))) throw refused("round_not_found");
  const officer = await isOfficer(db, r.society_id, m.id);
  if (r.status === "draft" && !officer) throw refused("round_not_found");
  const [doc] = await db<{ v: Row }[]>`
    select jsonb_build_object(
      'id', r.id, 'title', r.title, 'description', r.description, 'deadline', r.deadline, 'status', r.status,
      'closed', r.status = 'closed' or r.deadline <= now(),
      'society', (select ${CARD(db)} from community.societies s where s.id = r.society_id),
      'officer', ${officer}::boolean,
      'roles', coalesce((select jsonb_agg(jsonb_build_object('id', ro.id, 'title', ro.title, 'seats', ro.seats, 'filled', ro.filled,
                                                             'skill_ids', ro.skill_ids) order by ro.position)
                           from community.induction_roles ro where ro.round_id = r.id), '[]'::jsonb),
      'questions', coalesce((select jsonb_agg(q.body order by q.position) from community.induction_questions q where q.round_id = r.id), '[]'::jsonb),
      'mine', (select jsonb_build_object('id', a.id, 'status', a.status, 'note', a.note, 'role_id', a.role_id, 'created_at', a.created_at)
                 from community.induction_applications a where a.round_id = r.id and a.applicant_id = ${m.id}),
      'applications', case when ${officer}::boolean then coalesce((
        select jsonb_agg(jsonb_build_object('id', a.id, 'name', '$name:' || a.applicant_id, 'username', '$username:' || a.applicant_id, 'role_id', a.role_id,
                                            'answers', a.answers, 'status', a.status, 'note', a.note, 'created_at', a.created_at)
                         order by a.created_at)
          from community.induction_applications a where a.round_id = r.id), '[]'::jsonb) end) as v
      from community.induction_rounds r where r.id = ${roundId}`;
  return fill(doc!.v);
}

/** `apply_induction(round, p)`. */
export async function applyInduction(tx: Tx, me: string | null, roundId: string, roleId: string | null, answers: string[], staff: StaffCheck): Promise<string> {
  const m = await requireUser(tx, me);
  const r = await round(tx, roundId);
  const s = r ? await society(tx, r.society_id) : undefined;
  if (!r || r.status !== "open" || !(await canSeeSociety(tx, s, m.id, staff))) throw refused("round_not_found");
  if (r.past) throw refused("round_closed");
  if (m.role !== "student" || m.university_id !== s!.university_id) throw refused("apply_students_only");
  const [role] = roleId ? await tx<{ x: boolean }[]>`select exists (select 1 from community.induction_roles where id = ${roleId} and round_id = ${roundId}) as x` : [{ x: false }];
  if (!role!.x) throw refused("pick_role");
  const [q] = await tx<{ n: number }[]>`select count(*)::int as n from community.induction_questions where round_id = ${roundId}`;
  if (answers.length !== q!.n || answers.some((a) => a.trim().length < 1 || a.trim().length > 1000)) throw refused("answer_every_question");
  const [dup] = await tx<{ x: boolean }[]>`select exists (select 1 from community.induction_applications where round_id = ${roundId} and applicant_id = ${m.id}) as x`;
  if (dup!.x) throw refused("already_applied");
  const id = uuidv7();
  await tx`
    insert into community.induction_applications (id, round_id, role_id, applicant_id, answers)
    values (${id}, ${roundId}, ${roleId}, ${m.id}, ${JSON.stringify(answers)}::text::jsonb)`;
  await publish(tx, [applicationChanged({ id, round_id: roundId, society_id: r.society_id, applicant_id: m.id, status: "pending" }, m.id)]);
  return id;
}

/** `decide_induction_application(application, action, note)`: shortlist | accept | decline. */
export async function decideApplication(tx: Tx, me: string | null, applicationId: string, action: string, note: string | null): Promise<void> {
  const [a] = await tx<{ id: string; round_id: string; role_id: string; applicant_id: string; status: string }[]>`
    select id::text, round_id::text, role_id::text, applicant_id::text, status from community.induction_applications where id = ${applicationId} for update`;
  if (!a) throw refused("application_not_found");
  const r = (await round(tx, a.round_id))!;
  const s = await requireOfficer(tx, r.society_id, me);
  if (a.status === "accepted" || a.status === "declined") throw refused("already_decided");
  const ev = (status: string) => applicationChanged({ id: a.id, round_id: a.round_id, society_id: s.id, applicant_id: a.applicant_id, status }, me);
  if (action === "shortlist") {
    await tx`update community.induction_applications set status = 'shortlisted' where id = ${a.id}`;
    await publish(tx, [ev("shortlisted")]);
    return;
  }
  if (action !== "accept" && action !== "decline") throw refused("unknown_action");
  const events = [];
  if (action === "accept") {
    // Seats are counted under the role's row lock.
    const [ro] = await tx<{ id: string; title: string; seats: number; filled: number }[]>`
      select id::text, title, seats, filled from community.induction_roles where id = ${a.role_id} for update`;
    if (ro!.filled >= ro!.seats) throw refused("role_full");
    await tx`update community.induction_roles set filled = filled + 1 where id = ${ro!.id}`;
    const [was] = await tx<{ x: boolean }[]>`select exists (select 1 from community.society_members where society_id = ${s.id} and user_id = ${a.applicant_id}) as x`;
    await tx`
      insert into community.society_members (society_id, user_id, team_title) values (${s.id}, ${a.applicant_id}, ${ro!.title})
      on conflict (society_id, user_id) do update set team_title = excluded.team_title`;
    await tx`insert into community.society_follows (society_id, user_id) values (${s.id}, ${a.applicant_id}) on conflict do nothing`;
    if (!was!.x) events.push(memberChanged(s.id, a.applicant_id, "member", me));
  }
  const status = action === "accept" ? "accepted" : "declined";
  await tx`
    update community.induction_applications
       set status = ${status}, note = nullif(btrim(${note ?? ""}), ''), decided_by = ${me}, decided_at = now()
     where id = ${a.id}`;
  await publish(tx, [...events, ev(status)]);
}

/**
 * society-tick (hourly): a term that has run out tells whoever confirms it (society.term_changed ended); rounds
 * close at their deadline; applications nobody decided are declined `undecided_decline_days` after it.
 */
export async function societyTick(tx: Tx): Promise<number> {
  const limits = await societyLimits(tx);
  const terms = await tx<{ id: string; society_id: string; user_id: string; role: string; term_start: string; term_end: string; confirmed_by: string | null }[]>`
    update community.society_terms t set ended_notified_at = now()
      from community.societies s
     where s.id = t.society_id and t.id in (
             select st.id from community.society_terms st join community.societies x on x.id = st.society_id
              where st.term_end < current_date and st.confirmed_at is null and st.ended_notified_at is null and x.status = 'verified' limit 500)
    returning t.id::text, t.society_id::text, t.user_id::text, t.role, t.term_start::text, t.term_end::text, t.confirmed_by::text`;
  const closed = await tx<{ id: string; society_id: string; university_id: string; deadline: Date }[]>`
    update community.induction_rounds r set status = 'closed'
      from community.societies s
     where s.id = r.society_id and r.status = 'open' and r.deadline <= now()
    returning r.id::text, r.society_id::text, s.university_id::text, r.deadline`;
  const expired = await tx<{ id: string; round_id: string; society_id: string; applicant_id: string }[]>`
    with due as (
      update community.induction_rounds r set undecided_closed_at = now()
       where r.id in (select x.id from community.induction_rounds x
                       where x.status = 'closed' and x.undecided_closed_at is null
                         and x.deadline + make_interval(days => ${limits.undecided_decline_days}) <= now() limit 200)
      returning r.id, r.society_id)
    update community.induction_applications a set status = 'declined', decided_at = now(), note = 'The round closed before a decision.'
      from due where a.round_id = due.id and a.status in ('pending', 'shortlisted')
    returning a.id::text, a.round_id::text, due.society_id::text, a.applicant_id::text`;
  await publish(tx, [
    ...terms.map((t) => termChanged(t, "ended")),
    ...closed.map((r) => inductionChanged({ ...r, status: "closed" }, null)),
    ...expired.map((a) => applicationChanged({ ...a, status: "declined" }, null, true)),
  ]);
  return terms.length + closed.length + expired.length;
}
