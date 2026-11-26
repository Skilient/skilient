import { addDays, clean, daysBetween, pktDate, pktWeek, round, round2 } from "./numbers";

/**
 * The score (PRD 5.13; formula v2 with PRD 5.30's Record), ported from _ranking.sql, the teacher weight of
 * _teacher_portal.sql and score_record of _the_record.sql. Pure over `Facts`: the same facts, formula, moment
 * and previous Momentum peak give the same result (compute_ranking). The JSON is the stack's, key for key, so
 * the score page and the snapshots read the same; times are ISO strings.
 */
export type Formula = Record<string, unknown> & {
  caps: Record<string, number>;
  work: Record<string, number>;
  complexity: Record<string, number>;
  skills: { level_points: Record<string, number>; span_categories: number; span_bonus: number };
  endorsements: { points: number; mutual: number; tier_weights: Record<string, number> };
  credentials: { points: number; recognised: number };
  momentum: Record<string, number>;
  decay: { grace_days: number; weekly: number; floor: number };
  penalties: Record<string, number>;
  tiers: Record<string, number>;
  rings: { window_days: number };
  rapid_gain: { points: number; completions: number; completion_days: number };
  batch_size?: number;
  record?: {
    president: number;
    officer: number;
    places: Record<string, number>;
    finalist: number;
    min_entrants: number;
    volunteer_hour: number;
    volunteer_year_cap: number;
    society_cap: number;
    hold_days: number;
  };
};

export interface CompletionMember {
  user_id: string;
  github_days: number;
  verified_entries: number;
  unconfirmed_entries: number;
}
export interface Completion {
  venture_id: string;
  owner_id: string | null;
  completed_at: Date;
  team_size: number;
  weeks: number;
  skill_tags: number;
  deliverables: number;
  verified_members: number;
  /** The venture's status now (a completed venture can't change, but the check is the stack's). */
  status: string;
  members: CompletionMember[];
}

export interface Facts {
  userId: string;
  universityId: string | null;
  completions: Completion[];
  /** Counted pull requests. */
  prs: { repo: string; number: number; merged_at: Date }[];
  skills: { skill_id: string; level: number; category: string | null }[];
  /** Endorsements received that are not hidden, with what the run knows of each. */
  endorsements: {
    id: string;
    endorser_id: string;
    skill_id: string;
    venture_id: string;
    created_at: Date;
    endorser_kind: string;
    endorser_tier: string | null;
    mutual: boolean;
    ring: boolean;
  }[];
  /** Approved credentials. */
  credentials: { id: string; created_at: Date; recognised: boolean; expires_on: string | null }[];
  /** Sealed society entries of a merit kind, with their society's verification date. */
  record: { id: string; kind: string; issuer_id: string; occurred_on: string; evidence: Record<string, unknown>; verified_at: Date | null; signed_at: Date }[];
  /** The author's posts that aren't removed: quality index inputs and answer counts up to the moment. */
  posts: { id: string; created_at: Date; quality: number; answers: number; non_friend_answers: number }[];
  /** Original entries (corrects nothing) and every entry, for consistency and the decay clock. */
  originals: Date[];
  entries: Date[];
  confirmations: Date[];
  /** Join requests the student answered (accepted or declined). */
  answered: { created_at: Date; decided_at: Date }[];
  adjustments: { id: string; kind: string; severity: string | null; case_id: string | null; flag_id: string | null; created_at: Date; points: number | null }[];
  examPeriods: { starts_on: string; ends_on: string }[];
  /** Original entries whose newest version is peer-verified, with their venture's status. */
  verifiedEntries: { venture_id: string; venture_status: string | null }[];
  teacherWeight: number;
}

type Json = Record<string, unknown>;
const iso = (d: Date) => d.toISOString();
const byTimeThenId = <T extends { created_at: Date; id: string }>(a: T, b: T) => a.created_at.getTime() - b.created_at.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** `venture_complexity(team, weeks, tags, deliverables, f)`. */
export function complexity(team: number, weeks: number, tags: number, deliverables: number, f: Formula): number {
  const x = f.complexity;
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return (
    x["base"]! +
    (x["span"]! *
      (clamp((team - x["min_team"]!) / x["team_range"]!) +
        clamp((weeks - x["min_weeks"]!) / x["weeks_range"]!) +
        Math.min(tags, x["max_tags"]!) / x["max_tags"]! +
        Math.min(Math.max(deliverables - 1, 0), x["max_extra_deliverables"]!) / x["max_extra_deliverables"]!)) /
      4
  );
}

/** percentile_cont(0.5). */
function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  if (s.length === 0) return 0;
  const mid = (s.length - 1) / 2;
  return clean((s[Math.floor(mid)]! + s[Math.ceil(mid)]!) / 2);
}

const unitsOf = (m: CompletionMember, unconf: number) => clean(m.github_days + m.verified_entries + unconf * m.unconfirmed_entries);

/** `score_work`: completed ventures passing every completion rule, plus counted pull requests. */
export function scoreWork(x: Facts, f: Formula): Json & { ventures: Json[] } {
  const w = f.work;
  const unconf = w["unconfirmed_entry"]!;
  let sum = 0;
  const ventures = x.completions
    .filter((c) => c.status === "completed" && c.team_size >= 2 && c.deliverables >= 1 && c.verified_members >= 2)
    .map((c) => {
      const me = c.members.find((m) => m.user_id === x.userId)!;
      const units = unitsOf(me, unconf);
      const med = median(c.members.map((m) => unitsOf(m, unconf)));
      const cx = complexity(c.team_size, c.weeks, c.skill_tags, c.deliverables, f);
      const creator = c.owner_id === x.userId;
      const share = med === 0 ? (units > 0 ? 1 : 0) : Math.min(1, units / med);
      const points = w["venture_points"]! * cx * (creator ? w["creator"]! : w["member"]!) * share;
      sum += points;
      return { c, json: { venture_id: c.venture_id, completed_at: iso(c.completed_at), creator, complexity: round(cx, 3), units, median: med, share: round(share, 3), points: round2(points) } };
    })
    .sort((a, b) => a.c.completed_at.getTime() - b.c.completed_at.getTime() || cmp(a.c.venture_id, b.c.venture_id))
    .map((v) => v.json);
  const prs = [...x.prs].sort((a, b) => b.merged_at.getTime() - a.merged_at.getTime() || cmp(a.repo, b.repo) || a.number - b.number);
  const prPoints = Math.min(w["pr_cap"]!, prs.length * w["pr_points"]!);
  return {
    points: round2(Math.min(f.caps["work"]!, sum + prPoints)),
    ventures,
    prs: { count: prs.length, points: prPoints, items: prs.map((p) => ({ repo: p.repo, number: p.number, merged_at: iso(p.merged_at) })) },
  };
}

/** `score_skills`: L2 15, L3 20, L4 25; +10% across 3+ categories. */
export function scoreSkills(x: Facts, f: Formula): Json {
  const s = f.skills;
  const counted = x.skills
    .filter((k) => k.level >= 2)
    .map((k) => ({ skill_id: k.skill_id, level: k.level, category: k.category, points: s.level_points[String(k.level)] ?? 0 }))
    .sort((a, b) => b.level - a.level || cmp(a.skill_id, b.skill_id));
  const sum = counted.reduce((t, k) => t + k.points, 0);
  const categories = new Set(counted.map((k) => k.category).filter((c) => c !== null)).size;
  const bonus = categories >= s.span_categories;
  return {
    points: round2(Math.min(f.caps["skills"]!, sum * (1 + (bonus ? s.span_bonus : 0)))),
    categories,
    bonus,
    items: counted.map((k) => ({ skill_id: k.skill_id, level: k.level, points: k.points })),
  };
}

/** `score_endorsements` (teacher_portal): 15 × weight × 0.5 if mutual × 0 in a ring. */
export function scoreEndorsements(x: Facts, f: Formula): Json & { items: Json[]; counting: number } {
  const e = f.endorsements;
  const items = [...x.endorsements].sort(byTimeThenId).map((n) => {
    const weight = n.endorser_kind === "teacher" ? x.teacherWeight : (e.tier_weights[n.endorser_tier ?? "none"] ?? e.tier_weights["none"]!);
    const points = e.points * weight * (n.mutual ? e.mutual : 1) * (n.ring ? 0 : 1);
    return { id: n.id, endorser_id: n.endorser_id, skill_id: n.skill_id, venture_id: n.venture_id, weight, mutual: n.mutual, ring: n.ring, points: round2(points), raw: points };
  });
  const sum = items.reduce((t, i) => t + i.raw, 0);
  return {
    points: round2(Math.min(f.caps["endorsements"]!, sum)),
    counting: items.filter((i) => i.raw > 0).length,
    items: items.map(({ raw: _raw, ...i }) => i),
  };
}

/** `score_credentials`: 40 per approved, unexpired credential; × 1.5 for a recognised issuer. */
export function scoreCredentials(x: Facts, f: Formula, today: string): Json {
  const c = f.credentials;
  const items = x.credentials
    .filter((k) => k.expires_on === null || k.expires_on >= today)
    .sort(byTimeThenId)
    .map((k) => ({ id: k.id, recognised: k.recognised, points: c.points * (k.recognised ? c.recognised : 1) }));
  return { points: round2(Math.min(f.caps["credentials"]!, items.reduce((t, i) => t + i.points, 0))), items: items.map((i) => ({ ...i, points: clean(i.points) })) };
}

/** `academic_year(date)`: September to August, named by the year it starts. */
export const academicYear = (date: string) => {
  const [y, m] = date.split("-").map(Number) as [number, number];
  return m >= 9 ? y : y - 1;
};

/** `score_record` (formula v2): terms, results and volunteer hours from verified societies, capped. */
export function scoreRecord(x: Facts, f: Formula, asOf: Date): Json {
  const r = f.record;
  if (!r) return { points: 0, items: [], societies: [] };
  const base = x.record
    .filter((e) => ["office_bearer", "result", "volunteer"].includes(e.kind) && e.verified_at !== null)
    .filter((e) => e.verified_at!.getTime() + r.hold_days * 86_400_000 <= asOf.getTime() && e.signed_at.getTime() <= asOf.getTime())
    .map((e) => ({ ...e, year: academicYear(e.occurred_on) }));
  type Item = { id: string; kind: string; issuer_id: string; year: number; points: number };
  const items: Item[] = [];
  const isPresident = (e: (typeof base)[number]) => e.evidence["role"] === "president";
  const terms = new Map<string, (typeof base)[number]>();
  for (const e of base.filter((b) => b.kind === "office_bearer")) {
    const key = `${e.issuer_id}|${e.year}`;
    const best = terms.get(key);
    const better =
      !best ||
      (isPresident(e) && !isPresident(best)) ||
      (isPresident(e) === isPresident(best) && (e.occurred_on > best.occurred_on || (e.occurred_on === best.occurred_on && e.id < best.id)));
    if (better) terms.set(key, e);
  }
  for (const e of terms.values()) items.push({ id: e.id, kind: e.kind, issuer_id: e.issuer_id, year: e.year, points: isPresident(e) ? r.president : r.officer });
  for (const e of base.filter((b) => b.kind === "result" && Number(b.evidence["entrants"] ?? 0) >= r.min_entrants)) {
    const place = e.evidence["place"];
    const pts = place === undefined || place === null ? undefined : r.places[String(Math.trunc(Number(place)))];
    items.push({ id: e.id, kind: e.kind, issuer_id: e.issuer_id, year: e.year, points: pts ?? r.finalist });
  }
  const vols = base.filter((b) => b.kind === "volunteer").sort((a, b) => a.year - b.year || cmp(a.occurred_on, b.occurred_on) || cmp(a.id, b.id));
  const filled = new Map<number, number>();
  for (const v of vols) {
    const raw = (r.volunteer_hour * Number(v.evidence["minutes"] ?? 0)) / 60;
    const before = filled.get(v.year) ?? 0;
    filled.set(v.year, before + raw);
    items.push({ id: v.id, kind: v.kind, issuer_id: v.issuer_id, year: v.year, points: Math.max(0, Math.min(raw, r.volunteer_year_cap - before)) });
  }
  items.sort((a, b) => cmp(a.issuer_id, b.issuer_id) || a.year - b.year || cmp(a.kind, b.kind) || cmp(a.id, b.id));
  const per = new Map<string, number>();
  for (const i of items) per.set(i.issuer_id, (per.get(i.issuer_id) ?? 0) + i.points);
  const societies = [...per.entries()].sort(([a], [b]) => cmp(a, b)).map(([id, raw]) => ({ society_id: id, raw: round2(raw), points: round2(Math.min(r.society_cap, raw)) }));
  const sum = [...per.values()].reduce((t, v) => t + Math.min(r.society_cap, v), 0);
  return {
    points: round2(Math.min(f.caps["record"]!, sum)),
    items: items.map((i) => ({ id: i.id, kind: i.kind, society_id: i.issuer_id, year: i.year, points: round2(i.points) })),
    societies,
  };
}

/** `exam_days(university, after, through)`: exam days after `after`, up to and including `through`. */
export function examDays(periods: Facts["examPeriods"], after: string, through: string): number {
  const days = new Set<string>();
  for (const p of periods) {
    if (!(p.ends_on > after && p.starts_on <= through)) continue;
    const from = p.starts_on > addDays(after, 1) ? p.starts_on : addDays(after, 1);
    const to = p.ends_on < through ? p.ends_on : through;
    for (let d = from; d <= to; d = addDays(d, 1)) days.add(d);
  }
  return days.size;
}

/** `score_momentum`: content quality, consistency, citizenship, then decay. */
export function scoreMomentum(x: Facts, f: Formula, asOf: Date, prevPeak: number): Json {
  const m = f.momentum;
  const dc = f.decay;
  const today = pktDate(asOf);
  const t = asOf.getTime();
  const before = (d: Date) => d.getTime() <= t;

  const scored = x.posts
    .filter((p) => before(p.created_at) && p.answers >= m["min_answers"]! && p.non_friend_answers >= m["min_non_friends"]!)
    .sort(byTimeThenId)
    .map((p) => ({ id: p.id, idx: p.quality * 100 }));
  const n = scored.length;
  const avg = n > 0 ? scored.reduce((s, p) => s + p.idx, 0) / n : 0;
  const content = n > 0 ? Math.min(m["content_cap"]!, avg * Math.log2(1 + n)) : 0;

  const week0 = pktWeek(asOf);
  const windowStart = addDays(week0, -7 * (m["weeks"]! - 1));
  const weeks = new Set(
    [...x.originals, ...x.prs.map((p) => p.merged_at), ...x.posts.map((p) => p.created_at)]
      .filter((d) => before(d) && pktDate(d) >= windowStart)
      .map((d) => pktWeek(d)),
  ).size;
  const consistency = Math.min(m["consistency_cap"]!, weeks * m["week_points"]!);

  const joins = x.answered.filter((a) => before(a.decided_at) && a.decided_at.getTime() - a.created_at.getTime() <= m["join_hours"]! * 3600_000).length;
  const confirms = x.confirmations.filter(before).length;
  const citizenship = Math.min(m["citizenship_cap"]!, Math.min(m["join_cap"]!, joins * m["join_points"]!) + Math.min(m["confirm_cap"]!, confirms * m["confirm_points"]!));

  const raw = Math.min(f.caps["momentum"]!, content + consistency + citizenship);

  const times = [
    ...x.posts.map((p) => p.created_at),
    ...x.entries,
    ...x.confirmations,
    ...x.prs.map((p) => p.merged_at),
    ...x.answered.map((a) => a.decided_at),
  ].filter(before);
  const last = times.length ? new Date(Math.max(...times.map((d) => d.getTime()))) : null;
  let exam = 0;
  let inactive = 0;
  let decayWeeks = 0;
  let factor = 1;
  if (last) {
    const lastDay = pktDate(last);
    if (x.universityId) exam = examDays(x.examPeriods, lastDay, today);
    inactive = Math.max(0, daysBetween(lastDay, today) - exam);
    decayWeeks = Math.max(0, Math.floor((inactive - dc.grace_days) / 7));
    factor = clean(Math.max(0, 1 - dc.weekly * decayWeeks));
  }
  const peak = Math.max(prevPeak, raw);
  const points = round2(Math.min(raw, Math.max(raw * factor, dc.floor * peak)));
  return {
    points,
    raw: round2(raw),
    peak: round2(peak),
    content: { points: round2(content), average: round2(avg), posts: scored.map((p) => ({ post_id: p.id, index: round2(p.idx) })) },
    consistency: { points: consistency, weeks },
    citizenship: { points: citizenship, joins, confirmations: confirms },
    decay: {
      last_active: last ? iso(last) : null,
      inactive_days: inactive,
      exam_days: exam,
      weeks: decayWeeks,
      factor,
      exam_today: x.universityId !== null && x.examPeriods.some((p) => p.starts_on <= today && today <= p.ends_on),
    },
  };
}

/** `score_adjustments`: penalties within 12 months by severity, and upheld gains. */
export function scoreAdjustments(x: Facts, f: Formula, asOf: Date): Json {
  const months = f.penalties["months"]!;
  const since = new Date(asOf);
  since.setUTCMonth(since.getUTCMonth() - months);
  const items = x.adjustments
    .filter((a) => a.created_at.getTime() <= asOf.getTime() && (a.kind !== "penalty" || a.created_at.getTime() > since.getTime()))
    .sort(byTimeThenId)
    .map((a) => ({
      id: a.id,
      kind: a.kind,
      severity: a.severity,
      case_id: a.case_id,
      flag_id: a.flag_id,
      created_at: iso(a.created_at),
      points: a.kind === "penalty" ? -(f.penalties[a.severity!] ?? 0) : (a.points ?? 0),
    }));
  return { points: clean(items.reduce((t, i) => t + i.points, 0)), items };
}

/** `compute_ranking(user, as_of, f, prev_peak)` (the_record, formula v2). */
export function computeRanking(x: Facts, f: Formula, asOf: Date, prevPeak: number): Json & { total: number; proof: number } {
  const today = pktDate(asOf);
  const work = scoreWork(x, f);
  const skills = scoreSkills(x, f);
  const endorsements = scoreEndorsements(x, f);
  const credentials = scoreCredentials(x, f, today);
  const record = scoreRecord(x, f, asOf);
  const momentum = scoreMomentum(x, f, asOf, prevPeak);
  const adjustments = scoreAdjustments(x, f, asOf);
  const pts = (c: Json) => c["points"] as number;
  const proof = pts(work) + pts(skills) + pts(endorsements) + pts(credentials) + pts(record);
  const facts = {
    peer_verified_entries: x.verifiedEntries.length,
    active_ventures: new Set(x.verifiedEntries.filter((v) => v.venture_status === "in_progress" || v.venture_status === "completed").map((v) => v.venture_id)).size,
    counting_endorsements: endorsements.counting,
    completed_ventures: work.ventures.length,
    max_level: x.skills.reduce((mx, k) => Math.max(mx, k.level), 0),
    teacher_endorsement: endorsements.items.some((i) => (i["points"] as number) > 0 && x.endorsements.find((n) => n.id === i["id"])?.endorser_kind === "teacher"),
    hire: false,
  };
  return {
    work,
    skills,
    endorsements,
    credentials,
    record,
    momentum,
    adjustments,
    facts,
    proof: round2(proof),
    total: Math.max(0, round2(proof + pts(momentum) + pts(adjustments))),
    as_of: iso(asOf),
  };
}

/** `ranking_points(components)`: points per component only, for snapshots and flag details. */
export function rankingPoints(c: Json): Json {
  const p = (k: string) => ((c[k] as Json | undefined)?.["points"] ?? null) as unknown;
  return {
    work: p("work"),
    skills: p("skills"),
    endorsements: p("endorsements"),
    credentials: p("credentials"),
    record: p("record") ?? 0,
    momentum: p("momentum"),
    adjustments: p("adjustments"),
    total: c["total"] ?? null,
  };
}
