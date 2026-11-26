import { rateLimit } from "@skilient/platform";
import { refused, refusedWith } from "../refusals";
import { audit } from "./audit";
import { canViewProfile, requireUser, type Db, type Tx } from "./db";
import { publish } from "./publish";

/**
 * Credentials (PRD 5.4), ported from _credentials.sql. A student attaches an uploaded certificate (a PDF or an
 * image in their own folder of the credentials bucket); a Trust reviewer claims it and approves or rejects it,
 * matching a recognised issuer. The file itself is media's (W9): `file` returns what media recorded about it.
 */
export interface FileFacts {
  owner: string;
  mimetype: string;
  bytes: number;
}

export type FileLookup = (path: string) => Promise<FileFacts | null>;

/**
 * Until media records uploads (W9), a file's facts come from its path: its folder is the owner and its extension
 * the type; the size is checked by media then (docs/decisions.md 2026-11-26).
 */
export const pathFileLookup: FileLookup = async (path) => ({
  owner: path.split("/")[0] ?? "",
  mimetype: path.endsWith(".pdf") ? "application/pdf" : path.endsWith(".webp") ? "image/webp" : "",
  bytes: 1,
});

async function limits(db: Db): Promise<{ max_active: number; max_pending: number; max_pdf_bytes: number; rejected_file_days: number }> {
  const [r] = await db<{ value: { max_active: number; max_pending: number; max_pdf_bytes: number; rejected_file_days: number } }[]>`
    select value from work.config where key = 'credential.limits'`;
  return r!.value;
}

const today = (db: Db) => db`(now() at time zone 'Asia/Karachi')::date`;

export interface NewCredential {
  path: string;
  title: string;
  issuer: string;
  issued_on: string;
  expires_on: string | null;
  verify_url: string | null;
}

/** `submit_credential(p)`. */
export async function submitCredential(tx: Tx, meId: string | null, p: NewCredential, file: FileLookup): Promise<string> {
  const me = await requireUser(tx, meId);
  const lim = await limits(tx);
  if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(pdf|webp)$/.test(p.path) || p.path.split("/")[0] !== me.id) throw refused("upload_first");
  const facts = await file(p.path);
  if (!facts || facts.owner !== me.id) throw refused("upload_first");
  const [dup] = await tx`select 1 from work.credentials where file_path = ${p.path}`;
  if (dup) throw refused("file_attached");
  if (!((p.path.endsWith(".pdf") && facts.mimetype === "application/pdf") || (p.path.endsWith(".webp") && facts.mimetype === "image/webp"))) throw refused("pdf_or_image");
  if (facts.bytes <= 0 || facts.bytes > lim.max_pdf_bytes) throw refused("file_5mb");
  const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
  if (!isDate(p.issued_on) || (p.expires_on !== null && !isDate(p.expires_on))) throw refused("check_dates");
  const [d] = await tx<{ future: boolean }[]>`select ${p.issued_on}::date > ${today(tx)} as future`;
  if (d!.future) throw refused("issued_future");
  if (p.expires_on !== null && p.expires_on <= p.issued_on) throw refused("expiry_after_issue");
  const [n] = await tx<{ active: number; pending: number }[]>`
    select count(*) filter (where status in ('pending', 'approved'))::int as active, count(*) filter (where status = 'pending')::int as pending
      from work.credentials where user_id = ${me.id}`;
  if (n!.active >= lim.max_active) throw refusedWith("credentials_max", lim.max_active);
  if (n!.pending >= lim.max_pending) throw refused("credentials_pending");
  if (!(await rateLimit(tx, `credential:${me.id}`, 10, 86_400))) throw refused("rate_limited");
  const [row] = await tx<{ id: string }[]>`
    insert into work.credentials (id, user_id, title, issuer, issued_on, expires_on, verify_url, file_path, file_type, file_bytes)
    values (gen_random_uuid(), ${me.id}, ${p.title.trim()}, ${p.issuer.trim()}, ${p.issued_on}::date, ${p.expires_on}::date,
            ${p.verify_url?.trim() || null}, ${p.path}, ${p.path.endsWith(".pdf") ? "pdf" : "image"}, ${facts.bytes})
    returning id::text`;
  return row!.id;
}

/** `delete_credential(id)`: the file is media's to delete (credential.changed). */
export async function deleteCredential(tx: Tx, meId: string | null, id: string): Promise<boolean> {
  const me = await requireUser(tx, meId);
  const r = await tx<{ file_path: string; status: string }[]>`delete from work.credentials where id = ${id} and user_id = ${me.id} returning file_path, status`;
  if (!r.length) throw refused("credential_not_found");
  await publish(tx, [credentialChanged(id, me.id, "deleted", r[0]!.file_path)]);
  return true;
}

/** `credential.changed` {credential_id, user_id, status, file_path when the file can go}: notify (W9), media (W9), ranking (W6). */
const credentialChanged = (id: string, userId: string, status: string, filePath: string | null = null) => ({
  type: "credential.changed",
  subjects: [id, userId],
  payload: { credential_id: id, user_id: userId, status, file_path: filePath },
});

/** The student's own credentials (Settings, /me/credentials). */
export const myCredentials = (db: Db, me: string) =>
  db<{ id: string; title: string; issuer: string; issued_on: string; expires_on: string | null; verify_url: string | null; file_type: string; status: string; review_reason: string | null; recognised: boolean; created_at: Date }[]>`
    select c.id::text, c.title, coalesce(r.name, c.issuer) as issuer, c.issued_on::text, c.expires_on::text, c.verify_url, c.file_type, c.status,
           c.review_reason, c.recognised_issuer_id is not null as recognised, c.created_at
      from work.credentials c left join work.recognised_issuers r on r.id = c.recognised_issuer_id
     where c.user_id = ${me} order by c.created_at desc`;

/** `credentials_for(user)`: approved, unexpired credentials on a profile the reader may see. */
export const credentialsFor = (db: Db, me: string, userId: string) =>
  db<{ id: string; title: string; issuer: string; issued_on: string; expires_on: string | null; recognised: boolean; verify_url: string | null }[]>`
    select c.id::text, c.title, coalesce(r.name, c.issuer) as issuer, c.issued_on::text, c.expires_on::text, c.recognised_issuer_id is not null as recognised, c.verify_url
      from work.credentials c
      left join work.recognised_issuers r on r.id = c.recognised_issuer_id
      cross join (select ${userId}::uuid as uid) p
     where c.user_id = ${userId} and c.status = 'approved' and (c.expires_on is null or c.expires_on >= ${today(db)})
       and ${canViewProfile(db, me, "p.uid")}
     order by c.issued_on desc`;

/** `suggest_issuer(issuer)` as a column expression on `alias.issuer`. */
const suggestIssuer = (db: Db, column: string) => db`(
  select r.id from work.recognised_issuers r
   where r.retired_at is null
     and (lower(btrim(${db(column)})) = any (r.aliases) or lower(btrim(${db(column)})) = lower(r.name)
          or exists (select 1 from unnest(r.aliases) a where char_length(a) >= 4 and lower(${db(column)}) like '%' || a || '%'))
   order by r.id limit 1)`;

/** `credential_queue(status)`: pending (oldest first) or reviewed in the last 30 days. Names from people. */
export const credentialQueue = (db: Db, staff: string, status: "pending" | "reviewed") =>
  db<{ id: string; user_id: string; title: string; issuer: string; suggested_issuer: string | null; file_type: string; status: string; claimed_by: string | null; claimed_by_me: boolean; created_at: Date; reviewed_at: Date | null }[]>`
    select c.id::text, c.user_id::text, c.title, c.issuer, ${suggestIssuer(db, "c.issuer")} as suggested_issuer, c.file_type, c.status,
           c.claimed_by::text, c.claimed_by = ${staff}::uuid as claimed_by_me, c.created_at, c.reviewed_at
      from work.credentials c
     where (${status} = 'pending' and c.status = 'pending') or (${status} = 'reviewed' and c.status <> 'pending' and c.reviewed_at > now() - interval '30 days')
     order by case when ${status} = 'pending' then c.created_at end asc, c.reviewed_at desc
     limit 200`;

/** `credential_case(id)`. */
export async function credentialCase(db: Db, staff: string, id: string) {
  const [c] = await db<{
    id: string; user_id: string; title: string; issuer: string; issued_on: string; expires_on: string | null; verify_url: string | null;
    file_path: string; file_type: string; file_bytes: number; status: string; suggested_issuer: string | null; recognised_issuer_id: string | null;
    claimed_by: string | null; claimed_by_me: boolean; reviewer_id: string | null; review_reason: string | null; created_at: Date; reviewed_at: Date | null; file_deleted: boolean;
  }[]>`
    select c.id::text, c.user_id::text, c.title, c.issuer, c.issued_on::text, c.expires_on::text, c.verify_url, c.file_path, c.file_type, c.file_bytes, c.status,
           ${suggestIssuer(db, "c.issuer")} as suggested_issuer, c.recognised_issuer_id, c.claimed_by::text, c.claimed_by = ${staff}::uuid as claimed_by_me,
           c.reviewer_id::text, c.review_reason, c.created_at, c.reviewed_at, c.file_deleted_at is not null as file_deleted
      from work.credentials c where c.id = ${id}`;
  return c ?? null;
}

/** `claim_credential(id, claim)`: claim or release, audited before and after. */
export async function claimCredential(tx: Tx, staff: string, id: string, claim: boolean): Promise<void> {
  const [c] = await tx<{ status: string; user_id: string; claimed_by: string | null }[]>`
    select status, user_id::text, claimed_by::text from work.credentials where id = ${id} for update`;
  if (!c || c.status !== "pending") throw refused("credential_not_pending");
  if (c.user_id === staff) throw refused("credential_own");
  if (claim) {
    if (c.claimed_by !== null && c.claimed_by !== staff) throw refused("credential_claimed_other");
    await tx`update work.credentials set claimed_by = ${staff}, claimed_at = now() where id = ${id}`;
  } else {
    if (c.claimed_by !== staff) throw refused("credential_not_claimed");
    await tx`update work.credentials set claimed_by = null, claimed_at = null where id = ${id}`;
  }
  await audit(tx, {
    staffId: staff,
    action: claim ? "credential.claim" : "credential.release",
    targetType: "credential",
    targetId: id,
    reason: claim ? "claimed to review" : "released",
    before: { claimed_by: c.claimed_by },
    after: { claimed_by: claim ? staff : null },
  });
}

/** `review_credential(id, approve, reason, issuer)`: the claimer decides; audited; the student is told. */
export async function reviewCredential(tx: Tx, staff: string, id: string, approve: boolean, reason: string, issuer: string | null): Promise<void> {
  if (reason.trim().length < 3) throw refused("give_reason");
  const [c] = await tx<{ status: string; user_id: string; claimed_by: string | null }[]>`
    select status, user_id::text, claimed_by::text from work.credentials where id = ${id} for update`;
  if (!c || c.status !== "pending") throw refused("credential_not_pending");
  if (c.claimed_by !== staff) throw refused("credential_claim_first");
  let recognised = approve ? issuer?.trim() || null : null;
  if (recognised !== null) {
    const [r] = await tx`select 1 from work.recognised_issuers where id = ${recognised} and retired_at is null`;
    if (!r) throw refused("unknown_issuer");
  } else recognised = null;
  const status = approve ? "approved" : "rejected";
  await tx`
    update work.credentials set status = ${status}, recognised_issuer_id = ${recognised}, reviewer_id = ${staff}, reviewed_at = now(),
           review_reason = left(btrim(${reason}), 2000), claimed_by = null, claimed_at = null
     where id = ${id}`;
  await audit(tx, {
    staffId: staff,
    action: approve ? "credential.approve" : "credential.reject",
    targetType: "credential",
    targetId: id,
    reason: reason.trim(),
    before: { status: c.status },
    after: { status, recognised_issuer: recognised },
  });
  await publish(tx, [credentialChanged(id, c.user_id, status)]);
}

/**
 * `credentials_daily()`: approved credentials past their expiry expire (the student is told); rejected files
 * older than the limit are handed to media to delete (W9 deletes unattached uploads itself).
 */
export async function credentialsDaily(tx: Tx): Promise<number> {
  const lim = await limits(tx);
  const expired = await tx<{ id: string; user_id: string }[]>`
    update work.credentials set status = 'expired' where status = 'approved' and expires_on is not null and expires_on < ${today(tx)}
    returning id::text, user_id::text`;
  const files = await tx<{ id: string; user_id: string; file_path: string }[]>`
    update work.credentials set file_deleted_at = now()
     where status = 'rejected' and file_deleted_at is null and reviewed_at < now() - make_interval(days => ${lim.rejected_file_days})
    returning id::text, user_id::text, file_path`;
  await publish(tx, [
    ...expired.map((c) => credentialChanged(c.id, c.user_id, "expired")),
    ...files.map((c) => credentialChanged(c.id, c.user_id, "file_removed", c.file_path)),
  ]);
  return expired.length + files.length;
}
