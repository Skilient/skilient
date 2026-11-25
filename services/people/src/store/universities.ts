import { createHash } from "node:crypto";
import { appendEvents, rateLimit, uuidv7, type NewEvent } from "@skilient/platform";
import { finalYearOf, graduatedYear, karachiDate } from "../domain/graduation";
import { refused } from "../refusals";
import { audit } from "./audit";
import { profileFlags, publishProfile, type Db, type Tx } from "./publish";

/**
 * Universities, domains, live dates, requests, final-year batches, the HEC seed sync, departments and
 * programmes, and the graduation rule (ported from _identity.sql, _sync_hec_universities.sql,
 * _student_portal.sql, _graduate_rule.sql, _uni_core.sql, _marketing.sql, _ops_wrapup.sql).
 *
 * Every change to a university's domains or live date publishes `university.domains_changed` v1 with the
 * whole current state, exactly as identity's gate copy reads it (services/identity/src/store/gate-copies.ts).
 * Notify sends the launch emails from the same event when live_at first becomes set (W9).
 */

/** Asks identity which domains are public email providers' (CheckEmailDomains, decision Q7). */
export interface PersonalDomains {
  personal(domains: readonly string[]): Promise<Set<string>>;
}

export async function publishDomains(tx: Tx, universityIds: readonly string[]): Promise<void> {
  if (universityIds.length === 0) return;
  const rows = await tx<{ id: string; live_at: Date | null; domains: { domain: string; kind: string }[] }[]>`
    select u.id::text, u.live_at,
           coalesce((select json_agg(json_build_object('domain', d.domain, 'kind', d.kind) order by d.domain) from people.university_domains d where d.university_id = u.id), '[]') as domains
      from people.universities u where u.id = any(${[...universityIds]}::uuid[]) order by u.id`;
  await appendEvents(
    tx,
    rows.map((r) => ({
      type: "university.domains_changed",
      subjects: [r.id],
      payload: { university_id: r.id, live_at: r.live_at ? r.live_at.toISOString() : null, domains: r.domains },
    })),
  );
}

const DOMAIN = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
/** `private.email_domain`: the part after the last @, lower-cased and trimmed; null without one. */
export function emailDomain(email: string | null | undefined): string | null {
  const e = (email ?? "").trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at <= 0 || at === e.length - 1 || e.indexOf("@") !== at) return null;
  return e.slice(at + 1);
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** ListUniversities: all, or those owning a domain for students. */
export async function listUniversities(db: Db, domain: string | null) {
  return db<{ id: string; name: string; slug: string; live: boolean }[]>`
    select u.id::text, u.name, u.slug, (u.live_at is not null and u.live_at <= now()) as live from people.universities u
     where ${domain}::text is null or exists (select 1 from people.university_domains d where d.university_id = u.id and d.domain = ${domain}::text and d.kind in ('student', 'both'))
     order by u.name`;
}

/** `private.university_live` */
export async function universityLive(db: Db, id: string): Promise<boolean> {
  const [row] = await db`select 1 from people.universities where id = ${id} and live_at is not null and live_at <= now()`;
  return Boolean(row);
}

/** `private.final_year_of` */
export async function finalYear(db: Db, id: string): Promise<number | null> {
  const [row] = await db<{ b: number | null }[]>`select final_year_batch as b from people.universities where id = ${id}`;
  return row ? finalYearOf(row.b, new Date()) : null;
}

// ---------------------------------------------------------------------------
// "Tell me when my university joins" (signed out)
// ---------------------------------------------------------------------------

/** `request_university`, with the network rate limit web applied (5 an hour per network, 300 in all). */
export async function requestUniversity(
  tx: Tx,
  input: { email: string | null; universityName: string | null; consent: boolean | null; token: string | null; ipHash: string | null },
  personal: PersonalDomains,
): Promise<{ status: "created" | "exists"; university: string | null }> {
  const email = (input.email ?? "").trim().toLowerCase();
  const domain = emailDomain(input.email);
  const name = (input.universityName ?? "").replace(/^\s+|\s+$/g, "") || null;
  if (domain == null || email.length > 254) throw refused("invalid_email");
  if (input.consent !== true) throw refused("consent_needed");
  if (input.token == null || input.token.length < 32) throw refused("missing_token");
  if (input.ipHash != null) {
    if (!(await rateLimit(tx, `uni_request:${input.ipHash.slice(0, 64)}`, 5, 3600))) throw refused("requests_rate_limited");
    if (!(await rateLimit(tx, "uni_request_all", 300, 3600))) throw refused("requests_rate_limited");
  }
  if ((await personal.personal([domain])).has(domain)) throw refused("use_university_email");
  const [live] = await tx`
    select 1 from people.university_domains d join people.universities u on u.id = d.university_id
     where d.domain = ${domain} and u.live_at is not null and u.live_at <= now()`;
  if (live) throw refused("university_already_live");
  const [known] = await tx<{ id: string; name: string }[]>`
    select d.university_id::text as id, u.name from people.university_domains d join people.universities u on u.id = d.university_id
     where d.domain = ${domain} order by u.name limit 1`;
  if (!known && (name == null || [...name].length < 2 || [...name].length > 200)) throw refused("university_name_needed");
  const [exists] = await tx`select 1 from people.university_requests where email = ${email}`;
  if (exists) return { status: "exists", university: known?.name ?? name };
  await tx`
    insert into people.university_requests (id, email, domain, university_id, university_name, consent, token_hash)
    values (${uuidv7()}, ${email}, ${domain}, ${known?.id ?? null}, ${known ? null : name}, true, ${sha256(input.token)})`;
  return { status: "created", university: known?.name ?? name };
}

/** `confirm_university_request` */
export async function confirmUniversityRequest(tx: Tx, token: string | null): Promise<{ university: string | null }> {
  const [r] = await tx<{ university: string | null }[]>`
    update people.university_requests q set confirmed_at = coalesce(q.confirmed_at, now())
     where q.token_hash = ${sha256(token ?? "")} and q.unsubscribed_at is null
    returning coalesce((select u.name from people.universities u where u.id = q.university_id), q.university_name) as university`;
  if (!r) throw refused("request_link_expired");
  return { university: r.university };
}

/** `unsubscribe_university_request` */
export async function unsubscribeUniversityRequest(tx: Tx, token: string | null): Promise<boolean> {
  const done = await tx`
    update people.university_requests q set unsubscribed_at = coalesce(q.unsubscribed_at, now()) where q.token_hash = ${sha256(token ?? "")}`;
  return done.count > 0;
}

// ---------------------------------------------------------------------------
// Staff (accounts or super admin with two-factor; the caller check is in authorize.ts)
// ---------------------------------------------------------------------------

/** `ops_university_requests`: one row per domain. */
export async function opsUniversityRequests(db: Db) {
  return db<{ domain: string; university_id: string | null; university: string | null; live: boolean; requests: number; confirmed: number; notified: number; latest: Date }[]>`
    select g.domain, g.university_id::text, g.university,
           g.university_id is not null and exists (select 1 from people.universities u where u.id = g.university_id and u.live_at is not null and u.live_at <= now()) as live,
           g.requests::int, g.confirmed::int, g.notified::int, g.latest
      from (select r.domain, max(r.university_id::text)::uuid as university_id,
                   coalesce(max(u.name), mode() within group (order by r.university_name)) as university,
                   count(*) as requests,
                   count(*) filter (where r.confirmed_at is not null and r.unsubscribed_at is null) as confirmed,
                   count(*) filter (where r.notified_at is not null) as notified,
                   max(r.created_at) as latest
              from people.university_requests r left join people.universities u on u.id = r.university_id
             group by r.domain) g
     order by g.requests desc, g.latest desc`;
}

const reasonOk = (r: string | null, min = 3) => [...(r ?? "").replace(/^\s+|\s+$/g, "")].length >= min;

/** `ops_set_university_live`: opens (keeping an earlier date) or closes signups; audited. */
export async function opsSetUniversityLive(tx: Tx, staffId: string, input: { universityId: string; live: boolean; reason: string | null }): Promise<Date | null> {
  if (!reasonOk(input.reason)) throw refused("reason_needed");
  const [u] = await tx<{ live_at: Date | null }[]>`select live_at from people.universities where id = ${input.universityId} for update`;
  if (!u) throw refused("university_not_found");
  const [after] = await tx<{ live_at: Date | null }[]>`
    update people.universities set live_at = case when ${input.live} then coalesce(live_at, now()) end where id = ${input.universityId} returning live_at`;
  await audit(tx, {
    staffId,
    action: input.live ? "uni.open" : "uni.close",
    targetType: "university",
    targetId: input.universityId,
    reason: input.reason!.trim(),
    before: { live_at: u.live_at },
    after: { live_at: after!.live_at },
  });
  await publishDomains(tx, [input.universityId]);
  return after!.live_at;
}

/** `ops_open_all_universities`: opens every closed university that has a domain; audited. */
export async function opsOpenAllUniversities(tx: Tx, staffId: string, reason: string | null): Promise<number> {
  if (!reasonOk(reason)) throw refused("reason_needed");
  const opened = await tx<{ id: string }[]>`
    update people.universities u set live_at = now()
     where u.live_at is null and exists (select 1 from people.university_domains d where d.university_id = u.id)
    returning u.id::text`;
  const ids = opened.map((r) => r.id);
  await audit(tx, { staffId, action: "uni.open_all", targetType: "university", targetId: "all", reason: reason!.trim(), before: { closed: ids.length }, after: { opened: ids } });
  await publishDomains(tx, ids);
  return ids.length;
}

/** `ops_add_uni_domain`; audited. */
export async function opsAddUniDomain(tx: Tx, staffId: string, input: { universityId: string; domain: string | null; kind: string | null; reason: string | null }, personal: PersonalDomains): Promise<void> {
  const domain = (input.domain ?? "").trim().toLowerCase();
  if (!reasonOk(input.reason)) throw refused("reason_needed");
  if (input.kind == null || !["student", "faculty", "both"].includes(input.kind)) throw refused("domain_kind");
  if (!DOMAIN.test(domain)) throw refused("domain_invalid");
  if ((await personal.personal([domain])).has(domain)) throw refused("domain_personal");
  const [taken] = await tx`select 1 from people.university_domains where domain = ${domain}`;
  if (taken) throw refused("domain_taken");
  const done = await tx`insert into people.university_domains (university_id, domain, kind, source) values (${input.universityId}, ${domain}, ${input.kind}, 'ops') on conflict do nothing`;
  if (done.count !== 1) throw refused("domain_taken");
  await audit(tx, { staffId, action: "uni.domain_add", targetType: "university", targetId: input.universityId, reason: input.reason!.trim(), before: {}, after: { domain, kind: input.kind } });
  await publishDomains(tx, [input.universityId]);
}

/** `ops_batches`: students and graduates per university. */
export async function opsBatches(db: Db) {
  return db<{ university_id: string; name: string; final_year_batch: number | null; students: number; graduates: number }[]>`
    select u.id::text as university_id, u.name, u.final_year_batch,
           count(p.user_id) filter (where p.role = 'student')::int as students,
           count(p.user_id) filter (where p.status = 'graduate')::int as graduates
      from people.universities u left join people.profiles p on p.university_id = u.id
     group by u.id order by (u.final_year_batch is null), u.name`;
}

/** `ops_set_final_year_batch`; audited. */
export async function opsSetFinalYearBatch(tx: Tx, staffId: string, input: { universityId: string; batch: number | null; reason: string | null }): Promise<void> {
  if (input.batch != null && (input.batch < 1980 || input.batch > 2100)) throw refused("year_invalid");
  const reason = (input.reason ?? "").replace(/^\s+|\s+$/g, "");
  if ([...reason].length < 3 || [...reason].length > 500) throw refused("reason_length");
  const [u] = await tx<{ b: number | null }[]>`select final_year_batch as b from people.universities where id = ${input.universityId} for update`;
  if (!u) throw refused("university_not_found");
  await tx`update people.universities set final_year_batch = ${input.batch} where id = ${input.universityId}`;
  await audit(tx, {
    staffId,
    action: "university.final_year_batch",
    targetType: "university",
    targetId: input.universityId,
    reason,
    before: { final_year_batch: u.b },
    after: { final_year_batch: input.batch },
  });
}

/** A domain row written outside the staff method (the HEC sync): refuses a personal domain, as the trigger did. */
async function refusePersonal(domains: readonly string[], personal: PersonalDomains): Promise<void> {
  if (domains.length && (await personal.personal(domains)).size) throw refused("domain_personal_row");
}

// ---------------------------------------------------------------------------
// The HEC seed sync (apps/web supabase/seed/hec_universities.csv; run by people's seed tool)
// ---------------------------------------------------------------------------

export interface HecRow {
  name: string;
  slug: string;
  city?: string | null;
  province?: string | null;
  domains?: string[];
}

/** `sync_hec_universities`: upserts each university by name and replaces its seeded domains. */
export async function syncHecUniversities(tx: Tx, rows: unknown, personal: PersonalDomains): Promise<void> {
  if (!Array.isArray(rows)) throw refused("hec_not_array");
  const touched: string[] = [];
  for (const raw of rows as HecRow[]) {
    const domains = [...new Set((raw.domains ?? []).map((d) => d.toLowerCase()))];
    await refusePersonal(domains, personal);
    const [u] = await tx<{ id: string }[]>`
      insert into people.universities (id, name, slug, city, province)
      values (${uuidv7()}, ${raw.name}, ${raw.slug}, ${raw.city || null}, ${raw.province || null})
      on conflict (name) do update set slug = excluded.slug, city = excluded.city, province = excluded.province
      returning id::text`;
    await tx`delete from people.university_domains where university_id = ${u!.id} and source = 'hec_seed' and not (domain = any(${domains}::text[]))`;
    if (domains.length)
      await tx`insert into people.university_domains (university_id, domain, kind, source) select ${u!.id}, d, 'both', 'hec_seed' from unnest(${domains}::text[]) d on conflict do nothing`;
    touched.push(u!.id);
  }
  await publishDomains(tx, touched);
}

// ---------------------------------------------------------------------------
// Departments and programmes (market only; the university is the caller's seat, checked by market)
// ---------------------------------------------------------------------------

const nameOk = (n: string) => [...n].length >= 2 && [...n].length <= 80;

/** `save_department`: creates (up to 100) or renames; a rename renames profiles' copies, a new one links matching profiles. */
export async function saveDepartment(tx: Tx, universityId: string, id: string | null, rawName: string | null): Promise<string> {
  const name = (rawName ?? "").replace(/^\s+|\s+$/g, "");
  if (!nameOk(name)) throw refused("department_name_length");
  const [dup] = await tx`select 1 from people.departments where university_id = ${universityId} and lower(name) = lower(${name}) and id is distinct from ${id}::uuid`;
  if (dup) throw refused("department_duplicate");
  let saved: string;
  if (id == null) {
    const [n] = await tx<{ n: number }[]>`select count(*)::int as n from people.departments where university_id = ${universityId}`;
    if (n!.n >= 100) throw refused("department_limit");
    saved = uuidv7();
    await tx`insert into people.departments (id, university_id, name) values (${saved}, ${universityId}, ${name})`;
    await relinkProfiles(tx, tx`update people.profiles p set department_id = ${saved} where p.university_id = ${universityId} and p.department_id is null and lower(p.department) = lower(${name}) returning p.user_id::text`);
  } else {
    const [row] = await tx<{ id: string; old: string }[]>`
      update people.departments d set name = ${name} from (select name as old from people.departments where id = ${id} and university_id = ${universityId}) o
       where d.id = ${id} and d.university_id = ${universityId} returning d.id::text, o.old`;
    if (!row) throw refused("department_not_found");
    saved = row.id;
    if (row.old !== name) await relinkProfiles(tx, tx`update people.profiles set department = ${name} where department_id = ${id} returning user_id::text`);
  }
  return saved;
}

async function relinkProfiles(tx: Tx, update: PromiseLike<readonly { user_id: string }[]>): Promise<void> {
  const changed = await update;
  if (changed.length) {
    const events: NewEvent[] = [];
    for (const r of changed) {
      const f = await profileFlags(tx, r.user_id);
      if (f) {
        const { onboarding_step: _s, ...flags } = f;
        events.push({ type: "profile.updated", subjects: [r.user_id], payload: { ...flags } });
      }
    }
    await appendEvents(tx, events);
  }
}

/** `delete_department` (market checks that no coordinator is assigned to it before calling). */
export async function deleteDepartment(tx: Tx, universityId: string, id: string): Promise<void> {
  const affected = await tx<{ user_id: string }[]>`select user_id::text from people.profiles where department_id = ${id}`;
  const done = await tx`delete from people.departments where id = ${id} and university_id = ${universityId}`;
  if (done.count === 0) throw refused("department_not_found");
  if (affected.length) await relinkProfiles(tx, Promise.resolve(affected));
}

/** `save_programme`: up to 30 a department, no duplicates. */
export async function saveProgramme(tx: Tx, universityId: string, departmentId: string, rawName: string | null): Promise<string> {
  const [d] = await tx`select 1 from people.departments where id = ${departmentId} and university_id = ${universityId}`;
  if (!d) throw refused("department_not_found");
  const name = (rawName ?? "").replace(/^\s+|\s+$/g, "");
  if (!nameOk(name)) throw refused("programme_name_length");
  const [n] = await tx<{ n: number }[]>`select count(*)::int as n from people.programmes where department_id = ${departmentId}`;
  if (n!.n >= 30) throw refused("programme_limit");
  const id = uuidv7();
  const done = await tx`insert into people.programmes (id, department_id, name) values (${id}, ${departmentId}, ${name}) on conflict do nothing`;
  if (done.count !== 1) throw refused("programme_duplicate");
  return id;
}

/** `delete_programme` */
export async function deleteProgramme(tx: Tx, universityId: string, id: string): Promise<void> {
  const done = await tx`
    delete from people.programmes g using people.departments d where g.id = ${id} and d.id = g.department_id and d.university_id = ${universityId}`;
  if (done.count === 0) throw refused("programme_not_found");
}

// ---------------------------------------------------------------------------
// Graduation (the daily schedule `graduate-rollover`, 10 19 * * * UTC)
// ---------------------------------------------------------------------------

/** `graduate_rollover`: students whose batch has graduated under the rule (or their university's exception). */
export async function graduateRollover(tx: Tx, today?: { year: number; month: number; day: number }): Promise<number> {
  const year = graduatedYear(today ?? karachiDate(new Date()));
  const rows = await tx<{ user_id: string }[]>`
    select p.user_id::text from people.profiles p join people.universities u on u.id = p.university_id
     where p.role = 'student' and p.status = 'active' and p.graduation_year is not null
       and p.graduation_year <= coalesce(u.final_year_batch, ${year})
     for update of p`;
  for (const { user_id } of rows) {
    const before = await profileFlags(tx, user_id);
    await tx`update people.profiles set status = 'graduate', graduated_at = now() where user_id = ${user_id}`;
    await publishProfile(tx, user_id, before);
  }
  return rows.length;
}
