import type { Facts } from "../domain/score";
import { configValue } from "./formula";
import { num, type Db } from "./db";

/**
 * Everything compute_ranking reads, for a batch of students, from ranking's own schema only (the copies in
 * migrations/0001): one query per kind of fact for the whole batch, never one per student.
 */
export async function loadFacts(db: Db, userIds: readonly string[], asOf: Date): Promise<Map<string, Facts>> {
  const ids = [...userIds];
  const out = new Map<string, Facts>();
  const sc = await configValue(db, "feed.score");
  const teacher = await configValue(db, "teacher.limits");
  const members = await db<{ user_id: string; university_id: string | null }[]>`
    select u as user_id, m.university_id::text from unnest(${ids}::uuid[]) u left join ranking.members m on m.user_id = u`;
  for (const m of members)
    out.set(m.user_id, {
      userId: m.user_id,
      universityId: m.university_id,
      completions: [],
      prs: [],
      skills: [],
      endorsements: [],
      credentials: [],
      record: [],
      posts: [],
      originals: [],
      entries: [],
      confirmations: [],
      answered: [],
      adjustments: [],
      examPeriods: [],
      verifiedEntries: [],
      teacherWeight: teacher["endorsement_weight"] ?? 1.5,
    });
  const get = (u: string) => out.get(u)!;

  // Completed ventures the students were on, with every member's units (for the median).
  const comps = await db<
    {
      user_id: string;
      venture_id: string;
      owner_id: string | null;
      completed_at: Date;
      team_size: number;
      weeks: string;
      skill_tags: number;
      deliverables: number;
      verified_members: number;
      status: string | null;
      members: { user_id: string; github_days: number; verified_entries: number; unconfirmed_entries: number }[];
    }[]
  >`
    select m.user_id::text, c.venture_id::text, c.owner_id::text, c.completed_at, c.team_size, c.weeks::text, c.skill_tags, c.deliverables, c.verified_members,
           v.status,
           (select json_agg(json_build_object('user_id', x.user_id, 'github_days', x.github_days, 'verified_entries', x.verified_entries,
                                              'unconfirmed_entries', x.unconfirmed_entries))
              from ranking.venture_completion_members x where x.venture_id = c.venture_id) as members
      from ranking.venture_completion_members m
      join ranking.venture_completions c on c.venture_id = m.venture_id
      left join ranking.ventures v on v.venture_id = c.venture_id
     where m.user_id = any(${ids}::uuid[])`;
  for (const c of comps)
    get(c.user_id).completions.push({
      venture_id: c.venture_id,
      owner_id: c.owner_id,
      completed_at: c.completed_at,
      team_size: c.team_size,
      weeks: Number(c.weeks),
      skill_tags: c.skill_tags,
      deliverables: c.deliverables,
      verified_members: c.verified_members,
      status: c.status ?? "completed",
      members: c.members,
    });

  for (const p of await db<{ user_id: string; repo: string; number: number; merged_at: Date }[]>`
    select user_id::text, repo, number, merged_at from ranking.pull_requests where user_id = any(${ids}::uuid[]) and counted`)
    get(p.user_id).prs.push({ repo: p.repo, number: p.number, merged_at: p.merged_at });

  for (const s of await db<{ user_id: string; skill_id: string; level: number; category: string | null }[]>`
    select user_id::text, skill_id, level, category from ranking.user_skills where user_id = any(${ids}::uuid[])`)
    get(s.user_id).skills.push({ skill_id: s.skill_id, level: s.level, category: s.category });

  for (const n of await db<
    { endorsee_id: string; id: string; endorser_id: string; skill_id: string; venture_id: string; created_at: Date; endorser_kind: string; tier: string | null; mutual: boolean; ring: boolean }[]
  >`
    select n.endorsee_id::text, n.id::text, n.endorser_id::text, n.skill_id, n.venture_id::text, n.created_at, n.endorser_kind, rs.tier,
           exists (select 1 from ranking.endorsements b where b.endorser_id = n.endorsee_id and b.endorsee_id = n.endorser_id) as mutual,
           exists (select 1 from ranking.anti_gaming_flags f where f.kind = 'ring' and f.status in ('open', 'upheld') and f.endorsement_ids @> array[n.id]) as ring
      from ranking.endorsements n
      left join ranking.ranking_scores rs on rs.user_id = n.endorser_id
     where n.endorsee_id = any(${ids}::uuid[]) and not n.hidden`)
    get(n.endorsee_id).endorsements.push({
      id: n.id,
      endorser_id: n.endorser_id,
      skill_id: n.skill_id,
      venture_id: n.venture_id,
      created_at: n.created_at,
      endorser_kind: n.endorser_kind,
      endorser_tier: n.tier,
      mutual: n.mutual,
      ring: n.ring,
    });

  for (const c of await db<{ user_id: string; id: string; created_at: Date; recognised: boolean; expires_on: string | null }[]>`
    select user_id::text, id::text, created_at, recognised, expires_on::text from ranking.credentials where user_id = any(${ids}::uuid[]) and status = 'approved'`)
    get(c.user_id).credentials.push({ id: c.id, created_at: c.created_at, recognised: c.recognised, expires_on: c.expires_on });

  for (const r of await db<{ user_id: string; id: string; kind: string; issuer_id: string; occurred_on: string; evidence: Record<string, unknown>; verified_at: Date | null; signed_at: Date }[]>`
    select e.user_id::text, e.id::text, e.kind, e.issuer_id::text, e.occurred_on::text, e.evidence, s.verified_at, e.signed_at
      from ranking.record_entries e join ranking.societies s on s.society_id = e.issuer_id
     where e.user_id = any(${ids}::uuid[]) and e.status = 'sealed' and e.issuer_type = 'society' and e.kind in ('office_bearer', 'result', 'volunteer')`)
    get(r.user_id).record.push({ id: r.id, kind: r.kind, issuer_id: r.issuer_id, occurred_on: r.occurred_on, evidence: r.evidence, verified_at: r.verified_at, signed_at: r.signed_at });

  // Posts: the quality index over every answer as the counts stand (post_quality), and the answers up to the
  // moment, with those from people who aren't the author's friends (score_momentum).
  const posts = await db<{ author_id: string; id: string; created_at: Date; pos: string; total: string; cred_crosses: number; cred_all: number; answers: number; outsiders: number }[]>`
    select p.author_id::text, p.id::text, p.created_at,
           coalesce(sum(r.weight) filter (where r.answer and r.dimension in ('informative', 'interesting')), 0)::text as pos,
           coalesce(sum(r.weight) filter (where r.dimension in ('informative', 'interesting')), 0)::text as total,
           (count(*) filter (where not r.answer and r.dimension = 'credible'))::int as cred_crosses,
           (count(*) filter (where r.dimension = 'credible'))::int as cred_all,
           (count(*) filter (where r.created_at <= ${asOf}))::int as answers,
           (count(*) filter (where r.created_at <= ${asOf} and r.user_id <> p.author_id and not exists (
              select 1 from ranking.friendships f where f.user_id_a = least(r.user_id, p.author_id) and f.user_id_b = greatest(r.user_id, p.author_id))))::int as outsiders
      from ranking.posts p left join ranking.survey_responses r on r.post_id = p.id
     where p.author_id = any(${ids}::uuid[]) and not p.removed
     group by p.id`;
  const k = sc["bayes_k"] ?? 10;
  const mean = sc["platform_mean"] ?? 0.6;
  const penMax = sc["credible_penalty_max"] ?? 0.8;
  const penFactor = sc["credible_penalty_factor"] ?? 2;
  for (const p of posts) {
    const rate = p.cred_all > 0 ? p.cred_crosses / p.cred_all : 0;
    const quality = ((Number(p.pos) + k * mean) / (Number(p.total) + k)) * (1 - Math.min(penMax, penFactor * rate));
    get(p.author_id).posts.push({ id: p.id, created_at: p.created_at, quality, answers: p.answers, non_friend_answers: p.outsiders });
  }

  for (const c of await db<{ user_id: string; created_at: Date; original: boolean }[]>`
    select user_id::text, created_at, corrects_id is null as original from ranking.contributions where user_id = any(${ids}::uuid[])`) {
    get(c.user_id).entries.push(c.created_at);
    if (c.original) get(c.user_id).originals.push(c.created_at);
  }
  for (const c of await db<{ confirmer_id: string; created_at: Date }[]>`
    select confirmer_id::text, created_at from ranking.confirmations where confirmer_id = any(${ids}::uuid[])`)
    get(c.confirmer_id).confirmations.push(c.created_at);
  for (const a of await db<{ owner_id: string; created_at: Date; decided_at: Date }[]>`
    select owner_id::text, created_at, decided_at from ranking.applications
     where owner_id = any(${ids}::uuid[]) and status in ('accepted', 'declined') and decided_at is not null`)
    get(a.owner_id).answered.push({ created_at: a.created_at, decided_at: a.decided_at });

  for (const a of await db<{ user_id: string; id: string; kind: string; severity: string | null; case_id: string | null; flag_id: string | null; created_at: Date; points: string | null }[]>`
    select user_id::text, id::text, kind, severity, case_id::text, flag_id::text, created_at, points::text from ranking.ranking_adjustments where user_id = any(${ids}::uuid[])`)
    get(a.user_id).adjustments.push({ id: a.id, kind: a.kind, severity: a.severity, case_id: a.case_id, flag_id: a.flag_id, created_at: a.created_at, points: num(a.points) });

  for (const e of await db<{ user_id: string; starts_on: string; ends_on: string }[]>`
    select m.user_id::text, e.starts_on::text, e.ends_on::text from ranking.members m join ranking.exam_periods e on e.university_id = m.university_id
     where m.user_id = any(${ids}::uuid[])`)
    get(e.user_id).examPeriods.push({ starts_on: e.starts_on, ends_on: e.ends_on });

  // verified_entries(user): originals whose newest version is peer-confirmed (GitHub entries after the venture began are).
  for (const v of await db<{ user_id: string; venture_id: string; status: string | null }[]>`
    select o.user_id::text, o.venture_id::text, v.status
      from ranking.contributions o left join ranking.ventures v on v.venture_id = o.venture_id
     where o.user_id = any(${ids}::uuid[]) and o.corrects_id is null
       and ((o.source = 'github' and not o.before_venture)
            or exists (select 1 from ranking.confirmations k
                        where k.contribution_id = (select c.id from ranking.contributions c where c.id = o.id or c.corrects_id = o.id
                                                    order by c.created_at desc, (c.id = o.id) limit 1)))`)
    get(v.user_id).verifiedEntries.push({ venture_id: v.venture_id, venture_status: v.status });

  return out;
}
