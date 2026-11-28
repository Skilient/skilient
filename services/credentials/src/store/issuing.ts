import { uuidv7, type LoggedEvent } from "@skilient/platform";
import { z } from "zod";
import * as R from "../domain/record";
import { officersOf, publish, recordLimit, type Tx } from "./db";

/**
 * Issuing Record entries: `issue_record_entry` and the events that replace the stack's triggers and callers
 * (event close-out, confirmed office-bearer terms, venture completions, proof tasks, swaps). What an event can't
 * carry (titles, labels, walk-ins' addresses, society names, the learner's name) is read once per batch by the
 * consumer's `prepare` (`IssuingFacts`). Pending entries get a record-sign job in the same transaction; awaiting
 * ones tell the society's other officers (record.awaiting, for notify).
 */

export interface IssuingFacts {
  events: Map<string, { title: string; societyId: string }>;
  terms: Map<string, { title: string; societyId: string }>;
  labels: Map<string, string>;
  walkIns: Map<string, string>;
  societies: Map<string, { name: string; status: string }>;
  /** Address → the confirmed account holding it (identity's ResolveEmails). */
  accounts: Map<string, string | null>;
  ventures: Map<string, string>;
  /** User id → full name (people's ProfileCards), for the Taught entry's learner. */
  names: Map<string, string>;
}

export const emptyFacts = (): IssuingFacts => ({
  events: new Map(),
  terms: new Map(),
  labels: new Map(),
  walkIns: new Map(),
  societies: new Map(),
  accounts: new Map(),
  ventures: new Map(),
  names: new Map(),
});

export interface Issue {
  userId: string | null;
  emailHash?: string | null;
  draft: R.Draft;
  issuerType: "society" | "skilient";
  issuerId: string | null;
  issuerName: string;
  source: "event" | "session" | "term" | "venture" | "swap" | "task";
  sourceId: string;
  issuedBy: string | null;
  self?: boolean;
  supersedes?: string | null;
}

/** `issue_record_entry`: one entry; null when it already exists (re-running an issue never duplicates). */
export async function issueEntry(tx: Tx, i: Issue): Promise<string | null> {
  const status = i.userId === null ? "held" : i.self ? "awaiting" : "pending";
  const id = uuidv7();
  const title = i.draft.title.trim().slice(0, 120);
  const evidence = JSON.stringify(i.draft.evidence);
  let rows: { id: string }[];
  if (i.userId === null) {
    rows = await tx<{ id: string }[]>`
      insert into credentials.record_entries (id, claim_email_hash, kind, issuer_type, issuer_id, issuer_name, source, source_id, title, evidence, occurred_on, issued_by, status)
      values (${id}, ${i.emailHash!}, ${i.draft.kind}, ${i.issuerType}, ${i.issuerId}, ${i.issuerName}, ${i.source}, ${i.sourceId}, ${title}, ${evidence}::text::jsonb,
              ${i.draft.occurredOn}, ${i.issuedBy}, 'held')
      on conflict (claim_email_hash, kind, source_id) where status = 'held' do nothing returning id::text`;
  } else if (!i.supersedes) {
    rows = await tx<{ id: string }[]>`
      insert into credentials.record_entries (id, user_id, kind, issuer_type, issuer_id, issuer_name, source, source_id, title, evidence, occurred_on, issued_by, status)
      values (${id}, ${i.userId}, ${i.draft.kind}, ${i.issuerType}, ${i.issuerId}, ${i.issuerName}, ${i.source}, ${i.sourceId}, ${title}, ${evidence}::text::jsonb,
              ${i.draft.occurredOn}, ${i.issuedBy}, ${status})
      on conflict (user_id, kind, source_id) where user_id is not null and status not in ('revoked', 'superseded') and supersedes is null do nothing
      returning id::text`;
  } else {
    rows = await tx<{ id: string }[]>`
      insert into credentials.record_entries (id, user_id, kind, issuer_type, issuer_id, issuer_name, source, source_id, title, evidence, occurred_on, issued_by, status, supersedes)
      values (${id}, ${i.userId}, ${i.draft.kind}, ${i.issuerType}, ${i.issuerId}, ${i.issuerName}, ${i.source}, ${i.sourceId}, ${title}, ${evidence}::text::jsonb,
              ${i.draft.occurredOn}, ${i.issuedBy}, ${status}, ${i.supersedes}) returning id::text`;
  }
  if (!rows[0]) return null;
  if (status === "pending") await queueSign(tx, id);
  if (status === "awaiting" && i.issuerId) {
    const officers = (await officersOf(tx, i.issuerId)).filter((o) => o !== i.userId);
    await publish(tx, [
      { type: "record.awaiting", subjects: [id, i.issuerId], payload: { entry_id: id, society_id: i.issuerId, user_id: i.userId, officer_ids: officers } },
    ]);
  }
  return id;
}

/** A record-sign job for a pending entry (record_enqueue), once per entry. */
export async function queueSign(tx: Tx, entryId: string): Promise<void> {
  await tx`
    insert into platform.jobs (kind, payload, dedupe_key, max_attempts)
    values ('record-sign', ${JSON.stringify({ entry_id: entryId })}::text::jsonb, ${"record-sign:" + entryId}, 5)
    on conflict (owner, dedupe_key) do nothing`;
}

// ---------------------------------------------------------------------------
// The events
// ---------------------------------------------------------------------------
const id = z.uuid();
const nid = id.nullable().optional();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const S = {
  closed: z.object({
    event_id: id,
    society_id: id,
    society_verified: z.boolean(),
    issued_by: nid,
    ends_on: date,
    sessions: z.number().int(),
    team_event: z.boolean(),
    attended: z.array(z.object({ user_id: id, first_at: z.string(), self_added: z.boolean() })).max(5000),
    completed: z.array(z.object({ user_id: id, sessions: z.number().int(), self_added: z.boolean() })).max(5000),
    results: z.array(z.object({ user_id: id, place: z.number().int(), entrants: z.number().int(), set_by_self: z.boolean(), labelled: z.boolean() })).max(5000),
    volunteer: z.array(z.object({ user_id: id, minutes: z.number().int(), self_logged: z.boolean() })).max(5000),
    walk_ins: z.array(z.object({ attendee_id: id, email_hash: z.string().regex(/^[0-9a-f]{64}$/), first_at: z.string() })).max(5000),
  }),
  term: z.object({
    term_id: id,
    society_id: id,
    user_id: id,
    role: z.string().max(20),
    status: z.string().max(20),
    term_start: date,
    term_end: date,
    confirmed_by: nid,
    self_confirmed: z.boolean(),
  }),
  venture: z.object({
    venture_id: id,
    completion: z.object({
      completed_at: z.string(),
      team_size: z.number().int(),
      members: z.array(z.object({ user_id: id, github_days: z.number().int(), verified_entries: z.number().int() })).max(500),
    }),
  }),
  task: z.object({ user_id: id, attempt_id: id, skill_id: z.string().max(80), skill_label: z.string().max(120), task_title: z.string().max(200), verified_by: z.string().max(20) }),
  swap: z.object({
    swap_id: id,
    teacher_id: id,
    learner_id: id,
    skill_id: z.string().max(80),
    skill_label: z.string().max(120).optional(),
    sessions: z.number().int(),
    minutes: z.number().int(),
    last_session_on: date.nullable(),
  }),
};

/** `issue_event_record` from event.closed: attended, completed, results, volunteer hours and walk-ins. */
export async function eventClosed(tx: Tx, p: z.infer<typeof S.closed>, f: IssuingFacts): Promise<number> {
  const society = f.societies.get(p.society_id);
  if (!p.society_verified || !society) return 0;
  const title = f.events.get(p.event_id)?.title;
  if (!title) return 0;
  const by = p.issued_by ?? null;
  const base = { issuerType: "society" as const, issuerId: p.society_id, issuerName: society.name, source: "event" as const, sourceId: p.event_id, issuedBy: by };
  let n = 0;
  const count = (x: string | null) => (n += x ? 1 : 0);
  for (const a of p.attended) count(await issueEntry(tx, { ...base, userId: a.user_id, draft: R.attended(title, a.first_at, p.ends_on), self: a.user_id === by || a.self_added }));
  for (const c of p.completed)
    count(await issueEntry(tx, { ...base, userId: c.user_id, draft: R.completed(title, c.sessions, p.sessions, p.ends_on), self: c.user_id === by || c.self_added }));
  for (const r of p.results) {
    const label = r.labelled ? (f.labels.get(`${p.event_id}:${r.user_id}`) ?? null) : null;
    count(await issueEntry(tx, { ...base, userId: r.user_id, draft: R.result(title, r.place, r.entrants, label, p.team_event, p.ends_on), self: r.user_id === by || r.set_by_self }));
  }
  for (const v of p.volunteer) count(await issueEntry(tx, { ...base, userId: v.user_id, draft: R.volunteer(title, v.minutes, p.ends_on), self: v.user_id === by || v.self_logged }));
  const days = await recordLimit(tx, "claim_days");
  for (const w of p.walk_ins) {
    const email = f.walkIns.get(w.attendee_id);
    const user = email ? (f.accounts.get(email) ?? null) : null;
    if (user) {
      count(await issueEntry(tx, { ...base, userId: user, draft: R.attended(title, w.first_at, p.ends_on), self: user === by }));
      continue;
    }
    count(await issueEntry(tx, { ...base, userId: null, emailHash: w.email_hash, draft: R.attended(title, w.first_at, p.ends_on) }));
    const claim = uuidv7();
    const added = await tx`
      insert into credentials.record_claims (id, email_hash, event_id, email_attendee_id, expires_at)
      values (${claim}, ${w.email_hash}, ${p.event_id}, ${w.attendee_id}, now() + make_interval(days => ${days}))
      on conflict (email_hash, event_id) do nothing`;
    if (added.count === 1)
      await publish(tx, [{ type: "record.claim_held", subjects: [claim, p.event_id], payload: { claim_id: claim, event_id: p.event_id, attendee_id: w.attendee_id } }]);
  }
  return n;
}

/** `term_record` from society.term_changed {confirmed}: the Office bearer entry, from a verified society. */
export async function termConfirmed(tx: Tx, p: z.infer<typeof S.term>, f: IssuingFacts): Promise<string | null> {
  if (p.status !== "confirmed") return null;
  const society = f.societies.get(p.society_id);
  const term = f.terms.get(p.term_id);
  if (!society || society.status !== "verified" || !term) return null;
  return issueEntry(tx, {
    userId: p.user_id,
    draft: R.officeBearer(term.title, p.role, p.term_start, p.term_end),
    issuerType: "society",
    issuerId: p.society_id,
    issuerName: society.name,
    source: "term",
    sourceId: p.term_id,
    issuedBy: p.confirmed_by ?? null,
    self: p.self_confirmed,
  });
}

const skilient = { issuerType: "skilient" as const, issuerId: null, issuerName: "Skilient", issuedBy: null };

/** `venture_completion_record` from venture.completed: each member with verified work at completion. */
export async function ventureCompleted(tx: Tx, p: z.infer<typeof S.venture>, f: IssuingFacts): Promise<number> {
  let n = 0;
  for (const m of p.completion.members) {
    if (m.verified_entries + m.github_days === 0) continue;
    const draft = R.ventureCompleted(f.ventures.get(p.venture_id) ?? null, p.completion.team_size, p.completion.completed_at);
    if (await issueEntry(tx, { ...skilient, userId: m.user_id, draft, source: "venture", sourceId: p.venture_id })) n++;
  }
  return n;
}

/** complete_task's entry from task.completed. */
export const taskCompleted = (tx: Tx, p: z.infer<typeof S.task>, at: string) =>
  issueEntry(tx, { ...skilient, userId: p.user_id, draft: R.proofTask(p.task_title, p.skill_id, p.skill_label, p.verified_by, at), source: "task", sourceId: p.attempt_id });

/** close_swap's Taught entry from swap.closed, when a session was confirmed. */
export async function swapClosed(tx: Tx, p: z.infer<typeof S.swap>, f: IssuingFacts): Promise<string | null> {
  if (p.sessions <= 0 || !p.last_session_on) return null;
  const learner = f.names.get(p.learner_id)?.split(" ")[0] || null;
  const draft = R.taught(p.skill_id, p.skill_label ?? p.skill_id, learner, p.sessions, p.minutes, p.last_session_on);
  return issueEntry(tx, { ...skilient, userId: p.teacher_id, draft, source: "swap", sourceId: p.swap_id });
}

/** What one batch of issuing events needs from other services (the consumer's prepare reads it). */
export function wantedFacts(events: readonly Pick<LoggedEvent, "type" | "payload">[]) {
  const w = { eventIds: new Set<string>(), termIds: new Set<string>(), attendeeIds: new Set<string>(), societyIds: new Set<string>(), ventureIds: new Set<string>(), learnerIds: new Set<string>() };
  for (const e of events) {
    const p = e.payload as Record<string, unknown>;
    if (e.type === "event.closed") {
      const r = S.closed.safeParse(p);
      if (!r.success) continue;
      w.eventIds.add(r.data.event_id);
      w.societyIds.add(r.data.society_id);
      for (const x of r.data.walk_ins) w.attendeeIds.add(x.attendee_id);
    } else if (e.type === "society.term_changed") {
      const r = S.term.safeParse(p);
      if (!r.success || r.data.status !== "confirmed") continue;
      w.termIds.add(r.data.term_id);
      w.societyIds.add(r.data.society_id);
    } else if (e.type === "venture.completed") {
      const r = S.venture.safeParse(p);
      if (r.success) w.ventureIds.add(r.data.venture_id);
    } else if (e.type === "swap.closed") {
      const r = S.swap.safeParse(p);
      if (r.success && r.data.sessions > 0) w.learnerIds.add(r.data.learner_id);
    }
  }
  return w;
}
