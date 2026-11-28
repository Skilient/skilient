import { rateLimit } from "@skilient/platform";
import { refused } from "../refusals";
import type { ActiveKey } from "../signing/keys";
import { isoSeconds, newCode, sign, type CvEnvelope } from "../signing/sign";
import { entitled, isUniqueViolation, publish, takeCode, type Row, type Tx } from "./db";
import { isEligible, snapshot, type SnapshotInputs } from "./snapshot";

export type IssueSource = "first" | "monthly" | "on_demand" | "reissue";
export type IssueResult =
  | { status: "issued"; id: string; code: string; snapshot: Row }
  | { status: "exists" | "unchanged"; snapshot: Row }
  | { status: "not_eligible" | "nothing_to_reissue" };

interface Prepared {
  snapshot: Row;
  content_hash: string;
  latest_content_hash: string | null;
  issued_at: Date;
  expires_at: Date;
}

/** content_hash: SHA-256 of the snapshot's jsonb text, as the stack computed it (only "nothing changed" reads it). */
async function times(tx: Tx, snap: Row) {
  const [r] = await tx<{ content_hash: string; issued_at: Date; expires_at: Date }[]>`
    select encode(sha256(convert_to(${JSON.stringify(snap)}::text::jsonb::text, 'UTF8')), 'hex') as content_hash,
           date_trunc('second', now()) as issued_at, date_trunc('second', now()) + interval '12 months' as expires_at`;
  return r!;
}

const latestHash = async (tx: Tx, userId: string) =>
  (await tx<{ h: string }[]>`select content_hash as h from credentials.cv_records where user_id = ${userId} and revoked_at is null order by version desc limit 1`)[0]?.h ?? null;

/** `cv_issue_prepare(user)`: a fresh snapshot and its times. */
async function prepare(tx: Tx, userId: string, inputs: SnapshotInputs): Promise<Prepared | null> {
  const snap = await snapshot(tx, userId, inputs);
  if (!snap) return null;
  return { snapshot: snap, ...(await times(tx, snap)), latest_content_hash: await latestHash(tx, userId) };
}

/** `cv_reissue_prepare(user)`: the newest version's content, when its owner revoked it. */
async function reissuePrepare(tx: Tx, userId: string, inputs: SnapshotInputs): Promise<Prepared | null> {
  if (!isEligible(inputs)) return null;
  const [r] = await tx<{ snapshot: Row; content_hash: string }[]>`
    select r.snapshot, r.content_hash from credentials.cv_records r
     where r.user_id = ${userId} and r.revoked_reason = 'owner' and r.snapshot is not null
       and r.version = (select max(x.version) from credentials.cv_records x where x.user_id = ${userId})`;
  if (!r) return null;
  const t = await times(tx, r.snapshot);
  return { snapshot: r.snapshot, content_hash: r.content_hash, latest_content_hash: null, issued_at: t.issued_at, expires_at: t.expires_at };
}

/**
 * `cv_issue_commit`: the checks under the student's lock, then the new version (the next number), which supersedes
 * every earlier one. Returns null when nothing is issued (a first CV that exists, an unchanged monthly snapshot).
 */
async function commit(
  tx: Tx,
  userId: string,
  source: IssueSource,
  p: Prepared,
  envelope: CvEnvelope,
  signed: { hash: string; signature: string },
  eligibleNow: boolean,
): Promise<string | null> {
  await tx`select pg_advisory_xact_lock(hashtextextended(${"cv:" + userId}, 0))`;
  if (!eligibleNow) return null;
  const [newest] = await tx<{ id: string; version: number; revoked_reason: string | null; content_hash: string }[]>`
    select id::text, version, revoked_reason, content_hash from credentials.cv_records where user_id = ${userId} order by version desc limit 1`;
  if (source === "first" && newest) return null;
  if (source === "monthly" && p.content_hash === (await latestHash(tx, userId))) return null;
  if (source === "reissue") {
    if (!newest || newest.revoked_reason !== "owner" || newest.content_hash !== p.content_hash) throw refused("reissue_newest_only");
    if (!(await rateLimit(tx, `cv-reissue:${userId}`, 5, 86_400))) throw refused("reissue_limit");
  }
  if (source === "on_demand") {
    if (!(await entitled(tx, userId, "cv.refresh_on_demand"))) throw refused("refresh_pro");
    if (!(await rateLimit(tx, `cv-refresh:${userId}`, 10, 86_400))) throw refused("refresh_limit");
  }
  const [key] = await tx`select 1 from credentials.signing_keys where key_id = ${envelope.key_id}`;
  if (!key) throw new Error("unknown signing key");
  const id = crypto.randomUUID();
  const version = (newest?.version ?? 0) + 1;
  await takeCode(tx, envelope.code, "cv");
  await tx`
    insert into credentials.cv_records (id, user_id, code, version, snapshot, content_hash, snapshot_hash, signature, key_id, source, issued_at, expires_at)
    values (${id}, ${userId}, ${envelope.code}, ${version}, ${JSON.stringify(p.snapshot)}::text::jsonb, ${p.content_hash}, ${signed.hash}, ${signed.signature},
            ${envelope.key_id}, ${source}, ${envelope.issued_at}, ${envelope.expires_at})`;
  await tx`update credentials.cv_records set superseded_by = ${id} where user_id = ${userId} and id <> ${id} and superseded_by is null`;
  await publish(tx, [
    { type: "cv.issued", subjects: [userId, id], payload: { record_id: id, user_id: userId, version, source } },
    ...(version === 1 ? [{ type: "milestone.reached", subjects: [userId], payload: { user_id: userId, key: "cv.built" } }] : []),
  ]);
  return id;
}

/**
 * The cv-sign Edge Function's issueCv, in one transaction: prepare, sign with the active key, commit (five tries
 * on a code clash, each in a savepoint).
 */
export async function issueCv(tx: Tx, userId: string, source: IssueSource, inputs: SnapshotInputs, key: ActiveKey): Promise<IssueResult> {
  const p = source === "reissue" ? await reissuePrepare(tx, userId, inputs) : await prepare(tx, userId, inputs);
  if (!p) return { status: source === "reissue" ? "nothing_to_reissue" : "not_eligible" };
  if (source === "monthly" && p.content_hash === p.latest_content_hash) return { status: "unchanged", snapshot: p.snapshot };
  for (let attempt = 0; attempt < 5; attempt++) {
    const envelope: CvEnvelope = {
      v: 1,
      code: newCode(),
      key_id: key.keyId,
      issued_at: isoSeconds(p.issued_at),
      expires_at: isoSeconds(p.expires_at),
      snapshot: p.snapshot,
    };
    const signed = sign(envelope, key.privateKey);
    try {
      const id = await tx.savepoint((sp) => commit(sp, userId, source, p, envelope, signed, isEligible(inputs)));
      if (!id) return { status: source === "first" ? "exists" : "unchanged", snapshot: p.snapshot };
      return { status: "issued", id, code: envelope.code, snapshot: p.snapshot };
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
    }
  }
  throw new Error("could not find a free CV code");
}

/** The newest unrevoked code (what IssueCv returns). */
export async function newestCode(tx: Tx, userId: string): Promise<string | null> {
  const [r] = await tx<{ code: string }[]>`select code from credentials.cv_records where user_id = ${userId} and revoked_at is null order by version desc limit 1`;
  return r?.code ?? null;
}

/**
 * cv-refresh (00:30 PKT on the 1st): one cv-issue job per student with a CV who may have one (`eligibleOf`: people's
 * and identity's batch reads, one call each); the job issues only if the snapshot changed.
 */
export async function refreshStart(tx: Tx, eligibleOf: (ids: string[]) => Promise<Set<string>>, force = false): Promise<number> {
  const [d] = await tx<{ first: boolean; month: string }[]>`
    select extract(day from now() at time zone 'Asia/Karachi') = 1 as first, to_char(now() at time zone 'Asia/Karachi', 'YYYY-MM') as month`;
  if (!force && !d!.first) return 0;
  const users = (await tx<{ user_id: string }[]>`select distinct user_id::text from credentials.cv_records where user_id is not null`).map((u) => u.user_id);
  const ok = users.length ? await eligibleOf(users) : new Set<string>();
  const queue = users.filter((u) => ok.has(u));
  await tx`
    insert into platform.jobs (kind, payload, dedupe_key, max_attempts)
    select 'cv-issue', jsonb_build_object('user_id', u, 'source', 'monthly'), 'cv-refresh:' || ${d!.month}::text || ':' || u, 5
      from unnest(${queue}::uuid[]) u
    on conflict (owner, dedupe_key) do nothing`;
  return queue.length;
}
