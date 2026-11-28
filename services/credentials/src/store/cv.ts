import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { rateLimit, uuidv7 } from "@skilient/platform";
import { ALL_SECTIONS, sectionsValid } from "../domain/cv";
import { refused } from "../refusals";
import { normaliseCode } from "../signing/sign";
import { entitled, publish, staffAudit, type Db, type Row, type Tx } from "./db";

/**
 * CVs: settings, share links and views, verify, revocation (owner, staff, bans, deletion), PDF exports with the MAC
 * check, the staff search, the student's page and the public key file. Ported from 20261008000000_verified_cv.sql
 * and 20261009000000_cv_control.sql. Timestamps in rows come back as the database's text (as the stack's did).
 */

export const sha256Hex = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
const HASH = /^[0-9a-f]{64}$/;

/** `save_cv_settings`. `eligible` is the handler's cv_eligible. */
export async function saveSettings(
  tx: Tx,
  userId: string,
  eligible: boolean,
  s: { sections: string[]; showPercentile: boolean | null; showEmail: boolean | null; visibility: string | null },
): Promise<void> {
  if (!eligible) throw refused("cv_students_only");
  if (!sectionsValid(s.sections)) throw refused("sections");
  const visibility = s.visibility ?? "link";
  if (!["private", "link", "recruiters"].includes(visibility)) throw refused("invalid_input");
  await tx`
    insert into credentials.cv_settings (user_id, sections, show_percentile, show_email, visibility, updated_at)
    values (${userId}, ${s.sections}, ${s.showPercentile}, ${s.showEmail ?? false}, ${visibility}, now())
    on conflict (user_id) do update set sections = excluded.sections, show_percentile = excluded.show_percentile,
      show_email = excluded.show_email, visibility = excluded.visibility, updated_at = now()`;
}

/** `create_share_link(token_hash, label, days)`: Spark and above (`spark`: the handler's tier check), up to 10. */
export async function createShareLink(tx: Tx, userId: string, eligible: boolean, spark: boolean, tokenHash: string, label: string | null, days: number | null): Promise<string> {
  if (!eligible) throw refused("cv_students_only");
  if (!spark) throw refused("share_spark");
  if (!HASH.test(tokenHash) || (days !== null && ![7, 30, 90].includes(days))) throw refused("invalid_share_link");
  await tx`select pg_advisory_xact_lock(hashtextextended(${"cv-links:" + userId}, 0))`;
  const [n] = await tx<{ n: number }[]>`
    select count(*)::int as n from credentials.cv_share_links where user_id = ${userId} and revoked_at is null and (expires_at is null or expires_at > now())`;
  if (n!.n >= 10) throw refused("cv_links_max");
  const id = uuidv7();
  await tx`
    insert into credentials.cv_share_links (id, user_id, token_hash, label, expires_at)
    values (${id}, ${userId}, ${tokenHash}, ${label?.trim() || null}, case when ${days}::int is not null then now() + make_interval(days => ${days}::int) end)`;
  return id;
}

export async function revokeShareLink(tx: Tx, userId: string, linkId: string): Promise<void> {
  const r = await tx`update credentials.cv_share_links set revoked_at = now(), revoked_reason = 'owner' where id = ${linkId} and user_id = ${userId} and revoked_at is null`;
  if (r.count !== 1) throw refused("share_link_not_found");
}

/**
 * `open_shared_cv(token_hash, viewer_key)`: always the newest version; if that one is revoked (or the CV is private,
 * or the account can't have one) the link is "unavailable" and never falls back. One view per viewer per day.
 * `eligibleOf` is the handler's cv_eligible for the link's owner (asked only when the link is valid).
 */
export async function openShared(tx: Tx, tokenHash: string, viewerKey: string | null, eligibleOf: (userId: string) => Promise<{ eligible: boolean; username: string | null }>): Promise<Row[]> {
  const none = { username: null, code: null, issued_at: null, expires_at: null, key_id: null, snapshot: null, snapshot_hash: null, signature: null };
  const [link] = await tx<{ id: string; user_id: string }[]>`
    select id::text, user_id::text from credentials.cv_share_links where token_hash = ${tokenHash} and revoked_at is null and (expires_at is null or expires_at > now())`;
  if (!link) return [{ state: "invalid", ...none }];
  const who = await eligibleOf(link.user_id);
  const [rec] = await tx<{ id: string; code: string; issued_at: string; expires_at: string; key_id: string; snapshot: Row; snapshot_hash: string; signature: string; revoked: boolean }[]>`
    select id::text, code, issued_at::text, expires_at::text, key_id, snapshot, snapshot_hash, signature, revoked_at is not null as revoked
      from credentials.cv_records where user_id = ${link.user_id} order by version desc limit 1`;
  const [vis] = await tx<{ visibility: string }[]>`select visibility from credentials.cv_settings where user_id = ${link.user_id}`;
  if (!rec || rec.revoked || !who.eligible || (vis?.visibility ?? "link") === "private") return [{ state: "unavailable", ...none, username: who.username }];
  if (viewerKey && HASH.test(viewerKey)) {
    const added = await tx`
      insert into credentials.cv_views (id, user_id, record_id, link_id, source, viewer_key) values (${uuidv7()}, ${link.user_id}, ${rec.id}, ${link.id}, 'share_link', ${viewerKey})
      on conflict (link_id, viewer_key, day) do nothing`;
    if (added.count === 1) await tx`update credentials.cv_share_links set view_count = view_count + 1, last_viewed_at = now() where id = ${link.id}`;
  }
  return [
    { state: "ok", username: who.username, code: rec.code, issued_at: rec.issued_at, expires_at: rec.expires_at, key_id: rec.key_id, snapshot: rec.snapshot, snapshot_hash: rec.snapshot_hash, signature: rec.signature },
  ];
}

/** `verify_cv(code, pdf_hash)`: anyone; a revoked version gives its code and dates only. One trip. */
export async function verifyCv(db: Db, code: string, pdfHash: string | null): Promise<Row[]> {
  const c = normaliseCode(code) ? code.toUpperCase() : code.toUpperCase();
  return [
    ...(await db<Row[]>`
      select r.code, r.issued_at::text,
             case when r.revoked_at is null then r.expires_at::text end as expires_at,
             r.revoked_at::text,
             case when r.revoked_at is null then (select n.issued_at::text from credentials.cv_records n where n.id = r.superseded_by) end as superseded_at,
             case when r.revoked_at is null then r.key_id end as key_id,
             case when r.revoked_at is null then k.public_key end as public_key,
             case when r.revoked_at is null then r.snapshot end as snapshot,
             case when r.revoked_at is null then r.snapshot_hash end as snapshot_hash,
             case when r.revoked_at is null then r.signature end as signature,
             ${pdfHash}::text is not null as pdf_checked,
             case when ${pdfHash}::text is not null and r.revoked_at is null
                  then exists (select 1 from credentials.cv_pdf_exports e where e.record_id = r.id and e.pdf_hash = lower(${pdfHash}::text)) end as pdf_matches
        from credentials.cv_records r join credentials.signing_keys k on k.key_id = r.key_id
       where r.code = ${c}`),
  ];
}

/** `revoke_cv(record)`: the owner revokes one version. */
export async function revokeCv(tx: Tx, userId: string, recordId: string): Promise<void> {
  const rows = await tx<{ id: string }[]>`
    update credentials.cv_records set revoked_at = now(), revoked_reason = 'owner', revoked_by = ${userId}
     where id = ${recordId} and user_id = ${userId} and revoked_at is null returning id::text`;
  if (rows.length !== 1) throw refused("cv_not_found");
  await publish(tx, [{ type: "cv.revoked", subjects: [userId, recordId], payload: { user_id: userId, record_ids: [recordId], reason: "owner" } }]);
}

/** `revoke_all_cvs(user, reason)`: every version and link (a ban; deletion wipes the content too). */
export async function revokeAll(tx: Tx, userId: string, reason: "suspended" | "deleted" | "staff", by: string | null = null): Promise<number> {
  const rows = await tx<{ id: string }[]>`
    update credentials.cv_records set revoked_at = now(), revoked_reason = ${reason}, revoked_by = ${by}
     where user_id = ${userId} and revoked_at is null returning id::text`;
  await tx`update credentials.cv_share_links set revoked_at = now(), revoked_reason = ${reason} where user_id = ${userId} and revoked_at is null`;
  if (rows.length) await publish(tx, [{ type: "cv.revoked", subjects: [userId], payload: { user_id: userId, record_ids: rows.map((r) => r.id), reason } }]);
  return rows.length;
}

/** `cv_on_delete`: every version revoked and its content wiped; code, dates and key stay (verify says Revoked). */
export async function deleteCvs(tx: Tx, userId: string): Promise<void> {
  await tx`
    update credentials.cv_records
       set revoked_at = coalesce(revoked_at, now()), revoked_reason = coalesce(revoked_reason, 'deleted'), snapshot = null, user_id = null
     where user_id = ${userId}`;
  await tx`delete from credentials.cv_share_links where user_id = ${userId}`;
  await tx`delete from credentials.cv_views where user_id = ${userId}`;
  await tx`delete from credentials.cv_settings where user_id = ${userId}`;
  await tx`update credentials.cv_pdf_exports set user_id = null where user_id = ${userId}`;
  await tx`update credentials.cv_records set revoked_by = null where revoked_by = ${userId}`;
}

/** `ops_cv_records(query)`: by code or username (`byUsername`: people's ResolveUsernames), newest first. */
export async function opsCvRecords(db: Db, query: string, userByUsername: string | null): Promise<Row[]> {
  const q = query.trim().toLowerCase();
  const code = query.trim().toUpperCase().replace(/[\s-]/g, "");
  if (q.length < 3) return [];
  return [
    ...(await db<Row[]>`
      select r.id::text, r.user_id::text, ('$username:' || r.user_id) as username, ('$name:' || r.user_id) as full_name, r.code, r.version,
             r.issued_at::text, r.revoked_at::text, r.revoked_reason, r.superseded_by is not null as superseded
        from credentials.cv_records r
       where r.code = ${code} or r.user_id = ${userByUsername}::uuid
       order by r.issued_at desc limit 50`),
  ].map((r) => (r["user_id"] ? r : { ...r, username: null, full_name: null }));
}

/** `ops_revoke_cv(record, all, reason)`: audited before and after; the student hears (cv.revoked by staff). */
export async function opsRevokeCv(tx: Tx, staffId: string, recordId: string, all: boolean, reason: string): Promise<number> {
  const why = reason.trim();
  if (why.length < 3 || why.length > 2000) throw refused("staff_reason");
  const [rec] = await tx<{ code: string; user_id: string | null }[]>`select code, user_id::text from credentials.cv_records where id = ${recordId}`;
  if (!rec || !rec.user_id) throw refused("cv_not_found");
  const rows = all
    ? await tx<{ id: string }[]>`update credentials.cv_records set revoked_at = now(), revoked_reason = 'staff', revoked_by = ${staffId} where user_id = ${rec.user_id} and revoked_at is null returning id::text`
    : await tx<{ id: string }[]>`update credentials.cv_records set revoked_at = now(), revoked_reason = 'staff', revoked_by = ${staffId} where id = ${recordId} and revoked_at is null returning id::text`;
  if (rows.length === 0) throw refused("already_revoked");
  await staffAudit(tx, {
    staffId,
    action: all ? "cv.revoke_all" : "cv.revoke",
    targetType: "cv_record",
    targetId: recordId,
    reason: why,
    before: { code: rec.code, user_id: rec.user_id },
    after: { revoked: rows.length },
  });
  await publish(tx, [
    { type: "cv.revoked", subjects: [rec.user_id, recordId], payload: { user_id: rec.user_id, record_ids: rows.map((r) => r.id), reason: "staff", count: rows.length } },
  ]);
  return rows.length;
}

/** `cv_export_rights()`. */
export async function exportRights(db: Db, userId: string | null): Promise<{ pdf_export: boolean; templates: boolean; refresh_on_demand: boolean }> {
  if (!userId) return { pdf_export: false, templates: false, refresh_on_demand: false };
  const rows = await db<{ key: string }[]>`
    select key from credentials.entitlements
     where subject_id = ${userId} and key in ('cv.pdf_export', 'cv.templates', 'cv.refresh_on_demand') and value not in ('false'::jsonb, 'null'::jsonb, '0'::jsonb)`;
  const has = new Set(rows.map((r) => r.key));
  return { pdf_export: has.has("cv.pdf_export"), templates: has.has("cv.templates"), refresh_on_demand: has.has("cv.refresh_on_demand") };
}

/** The MAC web's PDF route makes (HMAC-SHA256 with the export secret over the fields, joined by "|"). */
export const exportMac = (secret: string, parts: (string | number)[]) => createHmac("sha256", secret).update(parts.join("|")).digest("hex");
export function macMatches(secret: string, parts: (string | number)[], mac: string): boolean {
  const want = Buffer.from(exportMac(secret, parts), "hex");
  const got = Buffer.from(mac, "hex");
  return HASH.test(mac) && got.length === want.length && timingSafeEqual(got, want);
}

/**
 * `record_cv_export`: Student Pro, a template right, the version is the student's and live, the MAC is the route's,
 * the file is in the student's folder with the stated size (media, W9: `size`), 20 a day.
 */
export async function recordCvExport(
  tx: Tx,
  userId: string,
  e: { exportId: string; recordId: string; template: string; paper: string; pdfHash: string; bytes: number; mac: string },
  secret: string,
  size: (path: string) => Promise<number | null>,
): Promise<void> {
  if (!(await entitled(tx, userId, "cv.pdf_export"))) throw refused("pdf_pro");
  if (e.template !== "standard" && !(await entitled(tx, userId, "cv.templates"))) throw refused("template_pro");
  const [rec] = await tx`select 1 from credentials.cv_records where id = ${e.recordId} and user_id = ${userId} and revoked_at is null`;
  if (!rec) throw refused("cv_not_found");
  if (!macMatches(secret, [e.exportId, e.recordId, e.template, e.paper, e.pdfHash, e.bytes], e.mac)) throw refused("export_not_ours");
  const path = `${userId}/${e.exportId}.pdf`;
  if ((await size(path)) !== e.bytes) throw refused("pdf_missing");
  if (!(await rateLimit(tx, `cv-export:${userId}`, 20, 86_400))) throw refused("cv_export_limit");
  await tx`
    insert into credentials.cv_pdf_exports (id, record_id, user_id, template, paper, pdf_hash, path, bytes)
    values (${e.exportId}, ${e.recordId}, ${userId}, ${e.template}, ${e.paper}, ${e.pdfHash}, ${path}, ${e.bytes})`;
}

/** cv-exports-daily (00:23 PKT): files go after 30 days (hashes stay), released to media (W9). */
export async function exportsDaily(tx: Tx): Promise<number> {
  const rows = await tx<{ path: string; user_id: string | null }[]>`
    update credentials.cv_pdf_exports set file_deleted_at = now() where file_deleted_at is null and created_at < now() - interval '30 days' returning path, user_id::text`;
  await publish(
    tx,
    rows.map((r) => ({ type: "cv_export.released", subjects: [r.user_id ?? r.path.slice(0, 36)], payload: { bucket: "cv-exports", path: r.path, owner_id: r.user_id } })),
  );
  return rows.length;
}

/** The student's CV page (the table reads lib/data/cv.ts made): settings, versions, links, views, exports. */
export async function myCv(db: Db, userId: string): Promise<Row> {
  const [r] = await db<{ v: Row }[]>`
    select jsonb_build_object(
      'settings', (select jsonb_build_object('sections', s.sections, 'show_percentile', s.show_percentile, 'show_email', s.show_email, 'visibility', s.visibility)
                     from credentials.cv_settings s where s.user_id = ${userId}),
      'default_sections', ${JSON.stringify(ALL_SECTIONS)}::text::jsonb,
      'records', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'code', r.code, 'version', r.version, 'source', r.source, 'issued_at', r.issued_at,
                                                               'expires_at', r.expires_at, 'revoked_at', r.revoked_at, 'revoked_reason', r.revoked_reason,
                                                               'superseded', r.superseded_by is not null, 'snapshot', r.snapshot, 'snapshot_hash', r.snapshot_hash,
                                                               'signature', r.signature, 'key_id', r.key_id) order by r.version desc)
                             from credentials.cv_records r where r.user_id = ${userId}), '[]'::jsonb),
      'links', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'label', l.label, 'expires_at', l.expires_at, 'view_count', l.view_count,
                                                             'last_viewed_at', l.last_viewed_at, 'created_at', l.created_at) order by l.created_at desc)
                           from credentials.cv_share_links l where l.user_id = ${userId} and l.revoked_at is null and (l.expires_at is null or l.expires_at > now())), '[]'::jsonb),
      'views', jsonb_build_object('total', (select count(*) from credentials.cv_views v where v.user_id = ${userId}),
                                  'last_30_days', (select count(*) from credentials.cv_views v where v.user_id = ${userId} and v.viewed_at > now() - interval '30 days')),
      'exports', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'record_id', e.record_id, 'template', e.template, 'paper', e.paper, 'pdf_hash', e.pdf_hash,
                                                               'created_at', e.created_at, 'file_deleted', e.file_deleted_at is not null) order by e.created_at desc)
                             from (select * from credentials.cv_pdf_exports where user_id = ${userId} order by created_at desc limit 20) e), '[]'::jsonb)) as v`;
  return r!.v;
}

/**
 * The public key file (/.well-known/skilient-cv-keys.json), byte for byte as the web route served it: the rows as
 * PostgREST serialised them (timestamps as Postgres's JSON text, UTC), in Response.json's key order. One trip.
 */
export const KEYS_FORMAT =
  "Each CV record is signed over the SHA-256 digest (32 bytes) of the RFC 8785 canonical JSON of " +
  "{v, code, key_id, issued_at, expires_at, snapshot}, with the Ed25519 key named by key_id. " +
  "public_key is the raw 32-byte key, base64url. Retired keys no longer sign but still verify.";
export async function publicKeys(db: Db): Promise<string> {
  const [r] = await db<{ keys: string }[]>`
    select coalesce(json_agg(json_build_object('key_id', key_id, 'alg', algorithm, 'public_key', public_key,
                                               'active_from', (to_json(active_from at time zone 'UTC') #>> '{}') || '+00:00',
                                               'retired_at', (to_json(retired_at at time zone 'UTC') #>> '{}') || '+00:00')
                             order by active_from), '[]')::text as keys
      from credentials.signing_keys`;
  const keys = JSON.parse(r!.keys) as { key_id: string; alg: string; public_key: string; active_from: string; retired_at: string | null }[];
  return JSON.stringify({
    issuer: "Skilient",
    format: KEYS_FORMAT,
    keys: keys.map((k) => ({ key_id: k.key_id, alg: k.alg, public_key: k.public_key, active_from: k.active_from, retired_at: k.retired_at })),
  });
}
