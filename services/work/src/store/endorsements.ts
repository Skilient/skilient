import type { NewEvent } from "@skilient/platform";
import { refused, refusedWith } from "../refusals";
import { blockedBetween, canViewProfile, canViewVenture, requireUser, blockedWith, type Db, type Tx } from "./db";
import { publish } from "./publish";
import { refreshVentureShell } from "./shell";
import { recomputeUserSkills } from "./skills";

/**
 * Endorsements (PRD 5.16), ported from _endorsements.sql and _skill_levels.sql: a teammate on a venture in
 * progress or completed endorses up to 5 skills per teammate per venture and 20 a month (Asia/Karachi months),
 * each for one of the venture's skills or theirs, optionally pointing at one of their entries that shows it.
 * Enough endorsements on such entries make the skill L4 and peer-verified (the recompute).
 */
async function limit(db: Db, name: "per_month" | "per_teammate_per_venture" | "peer_verified_min"): Promise<number> {
  const [r] = await db<{ n: number }[]>`select (value ->> ${name})::int as n from work.config where key = 'endorsements.limits'`;
  return r!.n;
}

/** `pk_month_start()`: the start of this month in Pakistan. */
const monthStart = (db: Db) => db`(date_trunc('month', now() at time zone 'Asia/Karachi') at time zone 'Asia/Karachi')`;

export interface EndorseItem {
  skill: string;
  evidence: string | null;
}

/** `endorse(endorsee, venture, items, note)`: returns how many were given. */
export async function endorse(tx: Tx, meId: string | null, endorsee: string | null, ventureId: string, items: EndorseItem[], note: string | null): Promise<number> {
  const me = await requireUser(tx, meId);
  if (!endorsee || endorsee === me.id) throw refused("endorse_self");
  await tx`select pg_advisory_xact_lock(hashtextextended(${"endorse:" + me.id}, 0))`;
  const [v] = await tx<{ status: string; member: boolean; skill_ids: string[] }[]>`
    select status, skill_ids, exists (select 1 from work.venture_members m where m.venture_id = v.id and m.user_id = ${me.id}) as member
      from work.ventures v where v.id = ${ventureId}`;
  if (!v || !v.member) throw refused("venture_not_found");
  const [mate] = await tx`select 1 from work.venture_members where venture_id = ${ventureId} and user_id = ${endorsee}`;
  if (!mate || (await blockedBetween(tx, me.id, endorsee))) throw refused("teammate_not_found");
  if (!["in_progress", "completed"].includes(v.status)) throw refused("endorse_not_yet");
  if (items.length === 0) throw refused("choose_skill");
  if (new Set(items.map((i) => i.skill)).size !== items.length) throw refused("each_skill_once");
  const text = note?.trim() || null;
  if (text !== null && text.length > 280) throw refused("note_280");
  const perMate = await limit(tx, "per_teammate_per_venture");
  const [given] = await tx<{ n: number }[]>`
    select count(*)::int as n from work.endorsements where endorser_id = ${me.id} and endorsee_id = ${endorsee} and venture_id = ${ventureId}`;
  if (given!.n + items.length > perMate) throw refusedWith("endorse_per_teammate", perMate);
  const perMonth = await limit(tx, "per_month");
  const [month] = await tx<{ n: number }[]>`select count(*)::int as n from work.endorsements where endorser_id = ${me.id} and created_at >= ${monthStart(tx)}`;
  if (month!.n + items.length > perMonth) throw refusedWith("endorse_per_month", perMonth);
  const ids: string[] = [];
  for (const item of items) {
    const [ok] = await tx<{ ok: boolean; name: string | null }[]>`
      select (s.id is not null and s.retired_at is null
              and (${item.skill} = any (${v.skill_ids}::text[])
                   or exists (select 1 from work.user_skills u where u.user_id = ${endorsee} and u.skill_id = ${item.skill} and u.level >= 1))) as ok,
             s.name
        from (select 1) x left join work.skills s on s.id = ${item.skill}`;
    if (!ok?.ok) throw refused("endorse_skill");
    const [dup] = await tx`
      select 1 from work.endorsements where endorser_id = ${me.id} and endorsee_id = ${endorsee} and venture_id = ${ventureId} and skill_id = ${item.skill}`;
    if (dup) throw refusedWith("already_endorsed", ok.name!);
    if (item.evidence) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.evidence)) throw refused("evidence_not_theirs");
      const [entry] = await tx<{ shows: boolean }[]>`
        select exists (
          select 1 from work.contributions o
           cross join lateral (select c.skill_ids from work.contributions c where c.id = o.id or c.corrects_id = o.id order by c.created_at desc, (c.id = o.id) limit 1) e
           where o.id = x.id and (${item.skill} = any (e.skill_ids)
                 or (o.source = 'github' and exists (select 1 from work.skill_evidence se where se.user_id = o.user_id and se.sha = o.commit_sha and se.skill_id = ${item.skill})))) as shows
          from work.contributions x
         where x.id = ${item.evidence} and x.venture_id = ${ventureId} and x.user_id = ${endorsee} and x.corrects_id is null`;
      if (!entry) throw refused("evidence_not_theirs");
      if (!entry.shows) throw refusedWith("evidence_skill", ok.name!);
    }
    const [row] = await tx<{ id: string }[]>`
      insert into work.endorsements (id, endorser_id, endorsee_id, venture_id, skill_id, evidence_id, note)
      values (gen_random_uuid(), ${me.id}, ${endorsee}, ${ventureId}, ${item.skill}, ${item.evidence}, ${text}) returning id::text`;
    ids.push(row!.id);
  }
  // endorsements_changed and recompute_endorsees: the endorsee's peer verification and levels.
  await recomputeUserSkills(tx, [endorsee]);
  await publish(tx, [endorsementGiven(ids, me.id, endorsee, ventureId, items.map((i) => i.skill))]);
  await refreshVentureShell(tx, [me.id, endorsee]);
  return items.length;
}

const endorsementGiven = (ids: string[], endorser: string, endorsee: string, ventureId: string, skills: string[]): NewEvent => ({
  type: "endorsement.given",
  subjects: [endorsee, endorser],
  payload: { endorsement_ids: ids, endorser_id: endorser, endorsee_id: endorsee, venture_id: ventureId, skill_ids: skills },
});

/** `hide_endorsement(id, hidden)`: the endorsee hides (or shows) one on their profile; the levels follow. */
export async function hideEndorsement(tx: Tx, meId: string | null, id: string, hidden: boolean): Promise<boolean> {
  const me = await requireUser(tx, meId);
  const r = await tx`
    update work.endorsements set hidden = ${hidden}, hidden_at = case when ${hidden} then coalesce(hidden_at, now()) end
     where id = ${id} and endorsee_id = ${me.id} returning 1`;
  if (!r.length) throw refused("endorsement_not_found");
  await recomputeUserSkills(tx, [me.id]);
  await publish(tx, [{ type: "endorsement.hidden", subjects: [me.id], payload: { endorsement_id: id, endorsee_id: me.id, hidden } }]);
  await refreshVentureShell(tx, [me.id]);
  return hidden;
}

/** `endorse_options(venture)`: the sheet: each teammate's endorsable skills, what the reader gave, their entries. */
export async function endorseOptions(tx: Tx, meId: string | null, ventureId: string) {
  const me = await requireUser(tx, meId);
  const [v] = await tx<{ status: string; skill_ids: string[]; member: boolean }[]>`
    select status, skill_ids, exists (select 1 from work.venture_members m where m.venture_id = v.id and m.user_id = ${me.id}) as member
      from work.ventures v where v.id = ${ventureId}`;
  if (!v || !v.member || !["in_progress", "completed"].includes(v.status)) return { monthLeft: 0, teammates: [] };
  const perMonth = await limit(tx, "per_month");
  const [month] = await tx<{ n: number }[]>`select count(*)::int as n from work.endorsements where endorser_id = ${me.id} and created_at >= ${monthStart(tx)}`;
  const teammates = await tx<{
    user_id: string;
    profile_visible: boolean;
    skills: { id: string; name: string; from_venture: boolean }[];
    given: string[];
    evidence: { id: string; description: string; kind: string; source: string; peer_verified: boolean; skills: string[] }[];
  }[]>`
    select m.user_id::text, ${canViewProfile(tx, me.id, "m.user_id")} as profile_visible,
           coalesce((select json_agg(json_build_object('id', s.id, 'name', s.name, 'from_venture', s.id = any (${v.skill_ids}::text[]))
                              order by (s.id = any (${v.skill_ids}::text[])) desc, s.name)
                       from work.skills s
                      where s.retired_at is null
                        and (s.id = any (${v.skill_ids}::text[])
                             or (${canViewProfile(tx, me.id, "m.user_id")}
                                 and exists (select 1 from work.user_skills u where u.user_id = m.user_id and u.skill_id = s.id and u.level >= 1)))), '[]'::json) as skills,
           coalesce((select array_agg(e.skill_id order by e.skill_id) from work.endorsements e
                      where e.endorser_id = ${me.id} and e.endorsee_id = m.user_id and e.venture_id = ${ventureId}), '{}') as given,
           coalesce((select json_agg(json_build_object(
                              'id', o.id, 'description', cur.description, 'kind', cur.kind, 'source', o.source,
                              'peer_verified', (o.source = 'github' and not o.before_venture) or exists (select 1 from work.contribution_confirmations k where k.contribution_id = cur.id),
                              'skills', cur.skill_ids || coalesce((select array_agg(distinct se.skill_id) from work.skill_evidence se
                                                                    where o.source = 'github' and se.user_id = o.user_id and se.sha = o.commit_sha), '{}'))
                              order by o.created_at desc)
                       from work.contributions o
                       cross join lateral (select c.id, c.description, c.kind, c.skill_ids from work.contributions c where c.id = o.id or c.corrects_id = o.id
                                            order by c.created_at desc, (c.id = o.id) limit 1) cur
                      where o.venture_id = ${ventureId} and o.user_id = m.user_id and o.corrects_id is null), '[]'::json) as evidence
      from work.venture_members m
     where m.venture_id = ${ventureId} and m.user_id <> ${me.id} and not ${blockedWith(tx, me.id, "m.user_id")}
     order by m.joined_at`;
  return { monthLeft: Math.max(0, perMonth - month!.n), teammates };
}

/** `endorsements_for(user)`: a profile's endorsements as the reader may see them (endorser names from people). */
export async function endorsementsFor(db: Db, me: string, userId: string) {
  return db<{
    id: string;
    skill_id: string;
    skill_name: string;
    endorser_id: string;
    endorser_visible: boolean;
    venture_id: string | null;
    venture_title: string | null;
    note: string | null;
    has_evidence: boolean;
    hidden: boolean;
    created_at: Date;
    endorser_kind: string;
  }[]>`
    select e.id::text, e.skill_id, s.name as skill_name, e.endorser_id::text, ${canViewProfile(db, me, "e.endorser_id")} as endorser_visible,
           case when ${canViewVenture(db, me)} then v.id::text end as venture_id, case when ${canViewVenture(db, me)} then v.title end as venture_title,
           e.note, e.evidence_id is not null as has_evidence, e.hidden, e.created_at, e.endorser_kind
      from work.endorsements e
      join work.skills s on s.id = e.skill_id
      join work.ventures v on v.id = e.venture_id
      cross join (select ${userId}::uuid as uid) p
     where e.endorsee_id = ${userId}
       and ${canViewProfile(db, me, "p.uid")}
       and (not e.hidden or ${userId}::uuid = ${me}::uuid)
       and (e.endorser_id = ${me}::uuid or not ${blockedWith(db, me, "e.endorser_id")})
     order by s.name, e.created_at desc`;
}
