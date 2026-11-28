import { rateLimit, uuidv7 } from "@skilient/platform";
import { correctedEvidence, rankingEvidence, type Evidence } from "../domain/record";
import { refused, refusedWith } from "../refusals";
import type { ActiveKey } from "../signing/keys";
import { isoSeconds, newCode, sign, type RecordEnvelope } from "../signing/sign";
import { macMatches } from "./cv";
import { isOfficer, isUniqueViolation, officersOf, publish, recordLimit, societyAudit, staffAudit, takeCode, type Db, type Row, type Tx } from "./db";
import { issueEntry, queueSign } from "./issuing";

/**
 * The Record: the student's page, pins and hiding, mistakes, share links, claims, PDFs and verify; the officers'
 * tab, confirm, correct, decline and revoke; the staff lookup; and sealing (the record-sign job). Ported from
 * 20261112000001_the_record.sql. Names, usernames and societies' slugs and logos are placeholders filled by the
 * handler from people's and community's batch reads.
 */

interface Entry {
  id: string;
  user_id: string | null;
  kind: string;
  issuer_type: string;
  issuer_id: string | null;
  issuer_name: string;
  source: string;
  source_id: string;
  title: string;
  evidence: Evidence;
  occurred_on: string;
  issued_by: string | null;
  status: string;
  supersedes: string | null;
  code: string | null;
  hidden: boolean;
  pinned_at: Date | null;
}
const ENTRY = `id::text, user_id::text, kind, issuer_type, issuer_id::text, issuer_name, source, source_id::text, title, evidence, occurred_on::text,
               issued_by::text, status, supersedes::text, code, hidden, pinned_at`;
const entry = async (db: Db, id: string, lock = false): Promise<Entry | undefined> =>
  ((await db.unsafe(`select ${ENTRY} from credentials.record_entries where id = $1${lock ? " for update" : ""}`, [id])) as unknown as Entry[])[0];

/** `record_entry_json(e)` as SQL over alias `e`. */
const ENTRY_JSON = `jsonb_build_object(
    'id', e.id, 'kind', e.kind, 'title', e.title, 'issuer_type', e.issuer_type, 'issuer_name', e.issuer_name,
    'issuer_slug', case when e.issuer_id is not null then '$society_slug:' || e.issuer_id end,
    'issuer_logo', case when e.issuer_id is not null then '$society_logo:' || e.issuer_id end,
    'line', e.evidence ->> 'line', 'occurred_on', e.occurred_on, 'status', e.status, 'code', e.code, 'signed_at', e.signed_at,
    'issued_at', e.issued_at, 'hidden', e.hidden, 'pinned', e.pinned_at is not null, 'revoked_at', e.revoked_at,
    'revoked_reason', e.revoked_reason, 'revoked_category', e.revoked_category,
    'superseded_by_code', (select n.code from credentials.record_entries n where n.id = e.superseded_by),
    'academic_year', case when extract(month from e.occurred_on) >= 9 then extract(year from e.occurred_on)::int else extract(year from e.occurred_on)::int - 1 end,
    'mistake_open', exists (select 1 from credentials.record_corrections c where c.entry_id = e.id and c.status = 'open'),
    'appealable', e.status = 'revoked' and e.revoked_at > now() - interval '30 days')`;

// ---------------------------------------------------------------------------
// The student
// ---------------------------------------------------------------------------

/** `record_waiting_count(user)`: held entries waiting for this account's confirmed address (`emailHash`). */
export async function waitingCount(db: Db, userId: string, emailHash: string | null): Promise<number> {
  if (!emailHash) return 0;
  const [r] = await db<{ n: number }[]>`
    select count(*)::int as n
      from credentials.record_claims c
      join credentials.record_entries e on e.claim_email_hash = c.email_hash and e.source_id = c.event_id and e.status = 'held'
     where c.email_hash = ${emailHash} and (c.user_id = ${userId} or c.user_id is null) and c.claimed_at is null and c.expires_at > now()`;
  return r!.n;
}

/** `record_match_claims`: a confirmed address is matched to its held claims (at signup, and whenever read). */
export async function matchClaims(tx: Tx, userId: string, emailHash: string | null): Promise<number> {
  if (!emailHash) return 0;
  const r = await tx`
    update credentials.record_claims set user_id = ${userId}, matched_at = now()
     where email_hash = ${emailHash} and user_id is null and claimed_at is null and expires_at > now()`;
  return r.count;
}

export async function myRecord(db: Db, userId: string, emailHash: string | null): Promise<Row> {
  const [r] = await db.unsafe(
    `select jsonb_build_object(
       'entries', coalesce((select jsonb_agg(${ENTRY_JSON} order by e.occurred_on desc, e.issued_at desc)
                              from credentials.record_entries e where e.user_id = $1 and e.status <> 'superseded'), '[]'::jsonb),
       'superseded', coalesce((select jsonb_agg(${ENTRY_JSON} order by e.occurred_on desc)
                                 from credentials.record_entries e where e.user_id = $1 and e.status = 'superseded'), '[]'::jsonb),
       'links', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'label', l.label, 'expires_at', l.expires_at, 'view_count', l.view_count,
                                                              'last_viewed_at', l.last_viewed_at, 'created_at', l.created_at) order by l.created_at desc)
                            from credentials.record_share_links l where l.user_id = $1 and l.revoked_at is null and l.expires_at > now()), '[]'::jsonb)) as v`,
    [userId],
  );
  const v = (r as unknown as { v: Row }).v;
  // next_event is community's (the next society event the student can register for): web reads it there (W13).
  return { ...v, waiting: await waitingCount(db, userId, emailHash), pins: await recordLimit(db, "pins"), next_event: null };
}

/** `set_record_display(entry, pinned, hidden)`: pin (up to the limit; sealed and shown only) and hide. */
export async function setDisplay(tx: Tx, userId: string, entryId: string, pinned: boolean, hidden: boolean): Promise<void> {
  const e = await entry(tx, entryId, true);
  if (!e || e.user_id !== userId) throw refused("entry_not_found");
  if (pinned && (hidden || e.status !== "sealed")) throw refused("pin_rule");
  await tx`select pg_advisory_xact_lock(hashtextextended(${"record-pins:" + userId}, 0))`;
  const pins = await recordLimit(tx, "pins");
  if (pinned && !e.pinned_at) {
    const [n] = await tx<{ n: number }[]>`select count(*)::int as n from credentials.record_entries where user_id = ${userId} and pinned_at is not null`;
    if (n!.n >= pins) throw refusedWith("pins_max", pins);
  }
  await tx`update credentials.record_entries set hidden = ${hidden}, pinned_at = case when ${pinned}::boolean then coalesce(pinned_at, now()) end where id = ${entryId}`;
}

/** `report_record_mistake(entry, note)`: a society entry; its officers hear (record.mistake_reported). */
export async function reportMistake(tx: Tx, userId: string, entryId: string, note: string): Promise<string> {
  const e = await entry(tx, entryId);
  if (!e || e.user_id !== userId || e.status !== "sealed") throw refused("entry_not_found");
  if (e.issuer_type !== "society") throw refused("skilient_mistake");
  const text = note.trim();
  if (text.length < 10 || text.length > 1000) throw refused("mistake_note");
  if (!(await rateLimit(tx, `record-mistake:${userId}`, 10, 86_400))) throw refused("mistake_limit");
  const id = uuidv7();
  const added = await tx`
    insert into credentials.record_corrections (id, entry_id, user_id, note) values (${id}, ${entryId}, ${userId}, ${text})
    on conflict (entry_id) where status = 'open' do nothing`;
  if (added.count !== 1) throw refused("mistake_again");
  await publish(tx, [
    {
      type: "record.mistake_reported",
      subjects: [id, entryId],
      payload: { correction_id: id, entry_id: entryId, society_id: e.issuer_id, user_id: userId, officer_ids: await officersOf(tx, e.issuer_id!) },
    },
  ]);
  return id;
}

/** `create_record_share_link(token_hash, label, days)`: an expiry always, up to the limit. */
export async function createShareLink(tx: Tx, userId: string, tokenHash: string, label: string | null, days: number | null): Promise<string> {
  if (!/^[0-9a-f]{64}$/.test(tokenHash) || days === null || ![7, 30, 90].includes(days)) throw refused("invalid_share_link");
  await tx`select pg_advisory_xact_lock(hashtextextended(${"record-links:" + userId}, 0))`;
  const max = await recordLimit(tx, "share_links");
  const [n] = await tx<{ n: number }[]>`select count(*)::int as n from credentials.record_share_links where user_id = ${userId} and revoked_at is null and expires_at > now()`;
  if (n!.n >= max) throw refusedWith("record_links_max", max);
  const id = uuidv7();
  await tx`
    insert into credentials.record_share_links (id, user_id, token_hash, label, expires_at)
    values (${id}, ${userId}, ${tokenHash}, ${label?.trim() || null}, now() + make_interval(days => ${days}))`;
  return id;
}

export async function revokeShareLink(tx: Tx, userId: string, linkId: string): Promise<void> {
  const r = await tx`update credentials.record_share_links set revoked_at = now() where id = ${linkId} and user_id = ${userId} and revoked_at is null`;
  if (r.count !== 1) throw refused("share_link_not_found");
}

/** `open_record_share(token_hash, viewer_key)`: the entries the student shows. `person` is the handler's (people). */
export async function openShare(tx: Tx, tokenHash: string, viewerKey: string | null): Promise<{ state: string; user_id?: string; expires_at?: string; entries?: Row[] }> {
  const [l] = await tx<{ id: string; user_id: string; expires_at: string }[]>`
    select id::text, user_id::text, expires_at::text from credentials.record_share_links where token_hash = ${tokenHash} and revoked_at is null and expires_at > now()`;
  if (!l) return { state: "invalid" };
  if (viewerKey && /^[0-9a-f]{64}$/.test(viewerKey) && (await rateLimit(tx, `record-view:${l.id}:${viewerKey}`, 1, 86_400)))
    await tx`update credentials.record_share_links set view_count = view_count + 1, last_viewed_at = now() where id = ${l.id}`;
  const [r] = await tx<{ v: Row[] }[]>`
    select coalesce(jsonb_agg(jsonb_build_object('kind', e.kind, 'title', e.title, 'issuer_name', e.issuer_name, 'issuer_type', e.issuer_type,
                                                 'line', e.evidence ->> 'line', 'occurred_on', e.occurred_on, 'code', e.code,
                                                 'academic_year', case when extract(month from e.occurred_on) >= 9 then extract(year from e.occurred_on)::int
                                                                       else extract(year from e.occurred_on)::int - 1 end)
                              order by e.occurred_on desc, e.signed_at desc), '[]'::jsonb) as v
      from credentials.record_entries e where e.user_id = ${l.user_id} and e.status = 'sealed' and not e.hidden`;
  return { state: "ok", user_id: l.user_id, expires_at: l.expires_at, entries: r!.v };
}

/** `record_highlights(user)`: pinned, sealed, shown (the handler checks the reader is signed in and not blocked). */
export async function highlights(db: Db, userId: string): Promise<Row[]> {
  const [r] = await db<{ v: Row[] }[]>`
    select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'kind', e.kind, 'title', e.title, 'issuer_name', e.issuer_name,
                                                 'line', e.evidence ->> 'line', 'occurred_on', e.occurred_on, 'code', e.code) order by e.pinned_at), '[]'::jsonb) as v
      from credentials.record_entries e where e.user_id = ${userId} and e.status = 'sealed' and e.pinned_at is not null and not e.hidden`;
  return r!.v;
}

/**
 * `claim_record_entries()`: held entries for this account's confirmed address move onto its Record (an entry it
 * already has for the same event wins) and are queued for signing. `emailHash` null: the address isn't confirmed.
 */
export async function claim(tx: Tx, userId: string, emailHash: string | null): Promise<number> {
  if (!emailHash) throw refused("verify_email");
  await matchClaims(tx, userId, emailHash);
  const claims = await tx<{ id: string; email_hash: string; event_id: string }[]>`
    select id::text, email_hash, event_id::text from credentials.record_claims
     where user_id = ${userId} and email_hash = ${emailHash} and claimed_at is null and expires_at > now() order by created_at for update`;
  let n = 0;
  for (const c of claims) {
    const moved = await tx<{ id: string }[]>`
      update credentials.record_entries x set user_id = ${userId}, claim_email_hash = null, status = 'pending'
       where x.claim_email_hash = ${c.email_hash} and x.source_id = ${c.event_id} and x.status = 'held'
         and not exists (select 1 from credentials.record_entries y where y.user_id = ${userId} and y.kind = x.kind and y.source_id = x.source_id
                           and y.status not in ('revoked', 'superseded'))
      returning x.id::text`;
    for (const m of moved) await queueSign(tx, m.id);
    await tx`delete from credentials.record_entries where claim_email_hash = ${c.email_hash} and source_id = ${c.event_id} and status = 'held'`;
    await tx`update credentials.record_claims set claimed_at = now() where id = ${c.id}`;
    n += moved.length;
  }
  return n;
}

/** record-claims-expire (01:41 PKT): unclaimed entries go after the claim days, with their claims. */
export async function claimsExpire(tx: Tx): Promise<number> {
  const [r] = await tx<{ n: number }[]>`
    with gone as (
      delete from credentials.record_claims c where c.claimed_at is null and c.expires_at <= now() returning c.email_hash, c.event_id
    ), entries as (
      delete from credentials.record_entries e using gone g
       where e.status = 'held' and e.claim_email_hash = g.email_hash and e.source_id = g.event_id
      returning e.id
    )
    select count(*)::int as n from entries`;
  const days = await recordLimit(tx, "claim_days");
  await tx`delete from credentials.record_entries where status = 'held' and issued_at <= now() - make_interval(days => ${days})`;
  return r!.n;
}

/** `save_cv_activities(entries)`: own sealed entries, up to the limit, kept in the Record's order. */
export async function saveCvActivities(tx: Tx, userId: string, entryIds: string[]): Promise<void> {
  const ids = [...new Set(entryIds)];
  const max = await recordLimit(tx, "cv_entries");
  if (ids.length > max) throw refusedWith("cv_entries_max", max);
  const [bad] = await tx<{ n: number }[]>`
    select count(*)::int as n from unnest(${ids}::uuid[]) x
     where not exists (select 1 from credentials.record_entries e where e.id = x and e.user_id = ${userId} and e.status = 'sealed')`;
  if (bad!.n > 0) throw refused("entry_not_found");
  await tx`
    insert into credentials.cv_settings (user_id, record_entries)
    values (${userId}, coalesce((select array_agg(e.id order by e.occurred_on desc, e.signed_at desc) from credentials.record_entries e where e.id = any (${ids}::uuid[])), '{}'))
    on conflict (user_id) do update
      set record_entries = excluded.record_entries,
          sections = case when cardinality(excluded.record_entries) > 0 and not ('activities' = any (credentials.cv_settings.sections))
                          then credentials.cv_settings.sections || array['activities'] else credentials.cv_settings.sections end,
          updated_at = now()`;
}

/** The CV picker (lib/data/record.ts read the table): sealed entries, newest first, and the ones chosen. */
export async function cvActivityOptions(db: Db, userId: string): Promise<Row> {
  const [r] = await db<{ v: Row }[]>`
    select jsonb_build_object(
      'entries', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'kind', e.kind, 'title', e.title, 'issuer_name', e.issuer_name, 'occurred_on', e.occurred_on)
                                            order by e.occurred_on desc) from credentials.record_entries e where e.user_id = ${userId} and e.status = 'sealed'), '[]'::jsonb),
      'chosen', coalesce((select to_jsonb(s.record_entries) from credentials.cv_settings s where s.user_id = ${userId}), '[]'::jsonb)) as v`;
  return r!.v;
}

/** The reader's own entries by id or by source (the score page; the proof task and swap pages). */
export async function myEntries(db: Db, userId: string, entryIds: string[], sourceIds: string[]): Promise<Row[]> {
  return [
    ...(await db<Row[]>`
      select e.id::text, e.kind, e.source_id::text, e.title, e.issuer_name, coalesce(e.evidence ->> 'line', '') as line, coalesce(e.code, '') as code, e.status
        from credentials.record_entries e
       where e.user_id = ${userId} and (e.id = any (${entryIds}::uuid[]) or e.source_id = any (${sourceIds}::uuid[]))
       order by e.occurred_on desc, e.issued_at desc limit 200`),
  ];
}

/** `record_pdf_export`: every code the student's own sealed entry; the MAC is the route's; 30 a day. */
export async function recordPdfExport(
  tx: Tx,
  userId: string,
  e: { exportId: string; kind: string; entryId: string | null; codes: string[]; pdfHash: string; bytes: number; mac: string },
  secret: string,
  holderName: string,
): Promise<void> {
  if (!["certificate", "transcript"].includes(e.kind) || e.codes.length === 0 || !/^[0-9a-f]{64}$/.test(e.pdfHash)) throw refused("invalid_export");
  const [bad] = await tx<{ n: number }[]>`
    select count(*)::int as n from unnest(${e.codes}::text[]) c
     where not exists (select 1 from credentials.record_entries x where x.code = c and x.user_id = ${userId} and x.status = 'sealed')`;
  const certOk =
    e.kind !== "certificate" ||
    (e.codes.length === 1 && e.entryId !== null && (await tx`select 1 from credentials.record_entries where id = ${e.entryId} and code = ${e.codes[0]!}`).length === 1);
  if (bad!.n > 0 || !certOk) throw refused("entry_not_found");
  if (!macMatches(secret, [e.exportId, e.kind, e.entryId ?? "", e.codes.join(","), e.pdfHash, e.bytes], e.mac)) throw refused("export_not_ours");
  if (!(await rateLimit(tx, `record-pdf:${userId}`, 30, 86_400))) throw refused("record_pdf_limit");
  await tx`
    insert into credentials.record_pdf_exports (id, user_id, kind, entry_id, holder_name, codes, pdf_hash, bytes)
    values (${e.exportId}, ${userId}, ${e.kind}, ${e.kind === "certificate" ? e.entryId : null}, ${holderName}, ${e.codes}, ${e.pdfHash}, ${e.bytes})`;
}

// ---------------------------------------------------------------------------
// Anyone: verify
// ---------------------------------------------------------------------------

/** `verify_record_entry(code)`: sealed, superseded or revoked (code, dates and category only). One trip. */
export async function verifyEntry(db: Db, code: string): Promise<Row | null> {
  const [r] = await db<{ v: Row }[]>`
    select case when e.status = 'revoked' then
             jsonb_build_object('code', e.code, 'status', 'revoked', 'signed_at', e.signed_at, 'revoked_at', e.revoked_at, 'revoked_category', e.revoked_category)
           else
             jsonb_build_object('code', e.code, 'status', e.status, 'signed_at', e.signed_at, 'key_id', e.key_id, 'public_key', k.public_key, 'payload', e.payload,
                                'envelope_hash', e.envelope_hash, 'signature', e.signature,
                                'superseded_by_code', (select n.code from credentials.record_entries n where n.id = e.superseded_by))
           end as v
      from credentials.record_entries e join credentials.signing_keys k on k.key_id = e.key_id
     where e.code = upper(${code}) and e.status in ('sealed', 'revoked', 'superseded')`;
  return r?.v ?? null;
}

/** `verify_record_transcript(id)`: who it was made for, and every entry on it with its status today. One trip. */
export async function verifyTranscript(db: Db, exportId: string): Promise<Row | null> {
  const [r] = await db<{ v: Row }[]>`
    select jsonb_build_object(
      'id', x.id, 'kind', x.kind, 'holder_name', x.holder_name, 'created_at', x.created_at, 'pdf_hash', x.pdf_hash,
      'entries', coalesce((select jsonb_agg(jsonb_build_object('code', c.code, 'status', coalesce(e.status, 'not_found'),
                                                               'title', case when e.status <> 'revoked' then e.title end,
                                                               'issuer_name', case when e.status <> 'revoked' then e.issuer_name end,
                                                               'occurred_on', case when e.status <> 'revoked' then e.occurred_on end) order by c.ord)
                             from unnest(x.codes) with ordinality as c(code, ord) left join credentials.record_entries e on e.code = c.code), '[]'::jsonb)) as v
      from credentials.record_pdf_exports x where x.id = ${exportId}`;
  return r?.v ?? null;
}

// ---------------------------------------------------------------------------
// Officers
// ---------------------------------------------------------------------------

/** `require_entry_officer(entry)`: a society entry (not held) of a society the user is an officer of. */
async function requireEntryOfficer(tx: Tx, userId: string, entryId: string): Promise<Entry> {
  const e = await entry(tx, entryId);
  if (!e || e.issuer_type !== "society" || e.status === "held" || !(await isOfficer(tx, e.issuer_id, userId))) throw refused("entry_not_found");
  return e;
}

/** `society_record_page(society)`: awaiting entries, open mistakes, the last 200 entries, the held count. */
export async function societyRecordPage(db: Db, userId: string, societyId: string): Promise<Row> {
  if (!(await isOfficer(db, societyId, userId))) throw refused("society_not_found");
  const [r] = await db<{ v: Row }[]>`
    select jsonb_build_object(
      'awaiting', coalesce((
        select jsonb_agg(jsonb_build_object('id', e.id, 'kind', e.kind, 'title', e.title, 'line', e.evidence ->> 'line',
                                            'name', '$name:' || e.user_id, 'username', '$username:' || e.user_id, 'issued_at', e.issued_at,
                                            'can_confirm', e.user_id <> ${userId} and coalesce(e.issued_by <> ${userId}, true)) order by e.issued_at)
          from credentials.record_entries e where e.issuer_id = ${societyId} and e.status = 'awaiting'), '[]'::jsonb),
      'mistakes', coalesce((
        select jsonb_agg(jsonb_build_object('id', c.id, 'entry_id', e.id, 'kind', e.kind, 'title', e.title, 'line', e.evidence ->> 'line',
                                            'place', e.evidence -> 'place', 'minutes', e.evidence -> 'minutes', 'code', e.code, 'note', c.note,
                                            'name', '$name:' || c.user_id, 'created_at', c.created_at) order by c.created_at)
          from credentials.record_corrections c join credentials.record_entries e on e.id = c.entry_id
         where e.issuer_id = ${societyId} and c.status = 'open'), '[]'::jsonb),
      'entries', coalesce((
        select jsonb_agg(x order by (x ->> 'issued_at') desc)
          from (select jsonb_build_object('id', e.id, 'kind', e.kind, 'title', e.title, 'line', e.evidence ->> 'line', 'status', e.status,
                                          'code', e.code, 'name', '$name:' || e.user_id, 'username', '$username:' || e.user_id, 'issued_at', e.issued_at) as x
                  from credentials.record_entries e
                 where e.issuer_id = ${societyId} and e.status in ('pending', 'sealed', 'revoked', 'superseded')
                 order by e.issued_at desc limit 200) q), '[]'::jsonb),
      'held', (select count(*) from credentials.record_entries e where e.issuer_id = ${societyId} and e.status = 'held')) as v`;
  return r!.v;
}

/** `confirm_record_entry(entry)`: a second officer (not the person, not the issuer) confirms; it is queued for signing. */
export async function confirmEntry(tx: Tx, userId: string, entryId: string): Promise<void> {
  const e = await requireEntryOfficer(tx, userId, entryId);
  if (e.user_id === userId || e.issued_by === userId) throw refused("second_officer");
  const r = await tx`update credentials.record_entries set confirmed_by = ${userId}, status = 'pending' where id = ${entryId} and status = 'awaiting'`;
  if (r.count !== 1) throw refused("not_awaiting");
  await queueSign(tx, entryId);
  await societyAudit(tx, { societyId: e.issuer_id!, actorId: userId, action: "record.confirm", targetId: entryId, before: { entry: entryId, status: "awaiting" }, after: { status: "pending" } });
}

/** `correct_record_entry(entry, {title, line, place, hours}, note)`: a new entry that supersedes once signed. */
export async function correctEntry(
  tx: Tx,
  userId: string,
  entryId: string,
  change: { title?: string; line?: string; place?: number; hours?: number },
  note: string | null,
): Promise<string> {
  const e = await requireEntryOfficer(tx, userId, entryId);
  if (!["sealed", "pending", "awaiting"].includes(e.status)) throw refused("live_only");
  if (e.status !== "sealed") throw refused("wait_sealed");
  const [waiting] = await tx`select 1 from credentials.record_entries x where x.supersedes = ${e.id} and x.status not in ('revoked', 'superseded')`;
  if (waiting) throw refused("correction_waiting");
  const title = change.title?.trim() || e.title;
  if (title.length < 2 || title.length > 120) throw refused("title_length");
  if (change.place !== undefined && e.kind === "result" && (change.place < 1 || change.place > 50)) throw refused("place_range");
  if (change.hours !== undefined && e.kind === "volunteer" && (change.hours <= 0 || change.hours > 336)) throw refused("hours_range");
  let evidence = correctedEvidence(e, { title, ...(change.place !== undefined ? { place: change.place } : {}), ...(change.hours !== undefined ? { hours: change.hours } : {}) });
  const line = change.line?.trim();
  if (line) {
    if (line.length > 140) throw refused("line_length");
    evidence = { ...evidence, line };
  }
  if (title === e.title && JSON.stringify(sortKeys(evidence)) === JSON.stringify(sortKeys(e.evidence))) throw refused("nothing_changed");
  const id = await issueEntry(tx, {
    userId: e.user_id,
    draft: { kind: e.kind as never, title, evidence, occurredOn: e.occurred_on },
    issuerType: e.issuer_type as "society",
    issuerId: e.issuer_id,
    issuerName: e.issuer_name,
    source: e.source as never,
    sourceId: e.source_id,
    issuedBy: userId,
    self: e.user_id === userId,
    supersedes: e.id,
  });
  if (!e.hidden) await tx`update credentials.record_entries set hidden = ${e.hidden}, pinned_at = ${e.pinned_at} where id = ${id}`;
  await tx`
    update credentials.record_corrections set status = 'corrected', decided_by = ${userId}, decided_at = now(), decision_note = ${note?.trim() || null}
     where entry_id = ${e.id} and status = 'open'`;
  await societyAudit(tx, {
    societyId: e.issuer_id!,
    actorId: userId,
    action: "record.correct",
    targetId: e.id,
    before: { entry: e.id, title: e.title, evidence: e.evidence },
    after: { entry: id, title, evidence },
  });
  return id!;
}
const sortKeys = (o: Evidence) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));

/** `decline_record_mistake(correction, note)`: the student hears why (record.mistake_declined). */
export async function declineMistake(tx: Tx, userId: string, correctionId: string, note: string): Promise<void> {
  const [c] = await tx<{ id: string; entry_id: string; user_id: string }[]>`
    select id::text, entry_id::text, user_id::text from credentials.record_corrections where id = ${correctionId} and status = 'open'`;
  if (!c) throw refused("report_not_found");
  const e = await requireEntryOfficer(tx, userId, c.entry_id);
  const why = note.trim();
  if (why.length < 3) throw refused("decline_reason");
  await tx`update credentials.record_corrections set status = 'declined', decided_by = ${userId}, decided_at = now(), decision_note = ${why} where id = ${correctionId}`;
  await publish(tx, [{ type: "record.mistake_declined", subjects: [correctionId, c.user_id], payload: { correction_id: correctionId, entry_id: e.id, user_id: c.user_id } }]);
}

/**
 * `revoke_record_entry(entry, category, reason)`: officers of the issuing society, or staff (trust reviewers and
 * moderators; `staff` is the handler's check), audited before and after. Pins and CV picks drop.
 */
export async function revokeEntry(tx: Tx, userId: string, staff: boolean, entryId: string, category: string | null, reason: string): Promise<void> {
  const e = await entry(tx, entryId, true);
  const officer = e ? e.issuer_type === "society" && (await isOfficer(tx, e.issuer_id, userId)) : false;
  if (!e || e.status === "held" || !(staff || officer)) throw refused("entry_not_found");
  if (!["sealed", "pending", "awaiting"].includes(e.status)) throw refusedWith("entry_already", e.status);
  if (!category || !["issued_in_error", "not_earned", "misconduct", "other"].includes(category)) throw refused("choose_category");
  const why = reason.trim();
  if (why.length < 3) throw refused("student_reason");
  const [done] = await tx<{ signed_at: Date | null }[]>`
    update credentials.record_entries
       set status = 'revoked', revoked_at = now(), revoked_by = ${userId}, revoked_category = ${category}, revoked_reason = ${why}, pinned_at = null
     where id = ${entryId} returning signed_at`;
  if (!done) throw refused("entry_not_found");
  await tx`update credentials.cv_settings set record_entries = array_remove(record_entries, ${entryId}::uuid) where user_id = ${e.user_id} and ${entryId}::uuid = any (record_entries)`;
  if (staff && !officer)
    await staffAudit(tx, {
      staffId: userId,
      action: "record.revoke",
      targetType: "record_entry",
      targetId: e.id,
      reason: why,
      before: { status: e.status, code: e.code },
      after: { status: "revoked", category },
    });
  else
    await societyAudit(tx, {
      societyId: e.issuer_id!,
      actorId: userId,
      action: "record.revoke",
      targetId: e.id,
      before: { entry: e.id, status: e.status, code: e.code },
      after: { status: "revoked", category, reason: why },
    });
  await publish(tx, [
    { type: "record.revoked", subjects: [e.id, e.user_id!], payload: { entry_id: e.id, user_id: e.user_id, status: "revoked", was_sealed: e.status === "sealed", category } },
  ]);
}

/** `ops_record_entry(code)`: the staff lookup (record_entry_json plus holder, username, evidence, issuer). */
export async function opsRecordEntry(db: Db, code: string): Promise<Row | null> {
  const [r] = await db.unsafe(
    `select ${ENTRY_JSON} || jsonb_build_object('holder', case when e.user_id is not null then '$name:' || e.user_id end,
                                                 'username', case when e.user_id is not null then '$username:' || e.user_id end,
                                                 'evidence', e.evidence, 'issued_by', case when e.issued_by is not null then '$name:' || e.issued_by end) as v
       from credentials.record_entries e where e.code = upper(btrim($1))`,
    [code],
  );
  return (r as unknown as { v: Row } | undefined)?.v ?? null;
}

// ---------------------------------------------------------------------------
// Sealing (the record-sign job)
// ---------------------------------------------------------------------------

/**
 * `record_sign_prepare` + sign + `record_sign_commit` for one pending entry: RecordEntryV1 with the holder's name and
 * university (people's, `holder`), signed with the active key, five tries on a code clash. A correction that seals
 * supersedes the entry it corrects (and the CV follows). Publishes record.sealed (with the evidence ranking reads).
 * Returns the code, or null when the entry is no longer pending.
 */
export async function sealEntry(tx: Tx, entryId: string, key: ActiveKey, holder: (userId: string) => Promise<{ name: string; university: string } | null>): Promise<string | null> {
  const e = await entry(tx, entryId, true);
  if (!e || e.status !== "pending" || !e.user_id) return null;
  const h = await holder(e.user_id);
  if (!h) return null;
  const [s] = await tx<{ supersedes_code: string | null; now: Date }[]>`
    select (select o.code from credentials.record_entries o where o.id = ${e.supersedes}::uuid) as supersedes_code, date_trunc('second', now()) as now`;
  const payload = {
    schema: "skilient.record/1",
    id: e.id,
    kind: e.kind,
    title: e.title,
    issuer: { type: e.issuer_type, name: e.issuer_name },
    holder: { name: h.name, university: h.university },
    date: e.occurred_on,
    evidence: e.evidence,
    supersedes: s!.supersedes_code,
  };
  for (let attempt = 0; attempt < 5; attempt++) {
    const envelope: RecordEnvelope = { v: 1, type: "record_entry", code: newCode(), key_id: key.keyId, issued_at: isoSeconds(s!.now), entry: payload };
    const signed = sign(envelope, key.privateKey);
    try {
      await tx.savepoint(async (sp) => {
        await takeCode(sp, envelope.code, "record");
        await sp`
          update credentials.record_entries
             set status = 'sealed', code = ${envelope.code}, key_id = ${key.keyId}, signed_at = ${envelope.issued_at}, payload = ${JSON.stringify(payload)}::text::jsonb,
                 envelope_hash = ${signed.hash}, signature = ${signed.signature}
           where id = ${entryId} and status = 'pending'`;
      });
      break;
    } catch (err) {
      if (!isUniqueViolation(err) || attempt === 4) throw err;
    }
  }
  const [sealed] = await tx<{ code: string; signed_at: Date }[]>`select code, signed_at from credentials.record_entries where id = ${entryId}`;
  const events = [
    {
      type: "record.sealed",
      subjects: [e.id, e.user_id],
      payload: {
        entry_id: e.id,
        user_id: e.user_id,
        kind: e.kind,
        issuer_type: e.issuer_type,
        issuer_id: e.issuer_id,
        occurred_on: e.occurred_on,
        signed_at: sealed!.signed_at.toISOString(),
        evidence: rankingEvidence(e.evidence),
        corrected: e.supersedes !== null,
      },
    },
  ];
  if (e.supersedes) {
    const old = await tx<{ id: string }[]>`
      update credentials.record_entries set status = 'superseded', superseded_by = ${e.id}, pinned_at = null where id = ${e.supersedes} and status = 'sealed' returning id::text`;
    await tx`update credentials.cv_settings set record_entries = array_replace(record_entries, ${e.supersedes}::uuid, ${e.id}::uuid)
              where user_id = ${e.user_id} and ${e.supersedes}::uuid = any (record_entries)`;
    if (old[0]) events.push({ type: "record.revoked", subjects: [e.supersedes, e.user_id], payload: { entry_id: e.supersedes, user_id: e.user_id, status: "superseded" } as never });
  }
  await publish(tx, events);
  return sealed!.code;
}

/** user.deleted: the account's Record goes (the stack's cascade); codes stay taken; others' rows lose the id. */
export async function deleteRecord(tx: Tx, userId: string): Promise<void> {
  await tx`delete from credentials.record_entries where user_id = ${userId}`;
  await tx`delete from credentials.record_claims where user_id = ${userId}`;
  await tx`delete from credentials.record_share_links where user_id = ${userId}`;
  await tx`delete from credentials.record_corrections where user_id = ${userId}`;
  await tx`update credentials.record_pdf_exports set user_id = null where user_id = ${userId}`;
  await tx`update credentials.record_entries set issued_by = null where issued_by = ${userId}`;
  await tx`update credentials.record_entries set confirmed_by = null where confirmed_by = ${userId}`;
  await tx`update credentials.record_entries set revoked_by = null where revoked_by = ${userId}`;
  await tx`update credentials.record_corrections set decided_by = null where decided_by = ${userId}`;
  await tx`delete from credentials.society_officers where user_id = ${userId}`;
  await tx`delete from credentials.entitlements where subject_id = ${userId}`;
  await tx`delete from credentials.pdf_renders where user_id = ${userId}`;
  await tx`update credentials.audit_log set actor_id = null where actor_id = ${userId}`;
}
