import type postgres from "postgres";
import { publishProfile } from "./publish";
import { publishDomains } from "./universities";

/**
 * People's side of the cutover import (W14 obligations, docs/azure/people-status.md). tools/cutover parses the
 * Supabase export and hands the rows here; people is the only writer of its schema. Rows are matched to
 * people's tables by column name (jsonb_populate_recordset), so export columns people doesn't keep are
 * ignored. Re-running is a no-op for rows already imported, and events are sent only for new rows:
 *   - every imported university sends `university.domains_changed` (identity's gate copy of the domains);
 *   - every imported profile sends `profile.updated` and `profile.gate_changed` (identity's gate copy), so no
 *     imported account fails the sign-up gate after cutover.
 * Order: import identity's users first. Identity keeps profile facts only for accounts it knows, and drops
 * the gate event of any other.
 */
type Row = Record<string, unknown>;
type Tx = postgres.TransactionSql;

const TABLES = new Set(["universities", "university_domains", "departments", "programmes", "profiles", "onboarding_state"]);

/**
 * Inserts rows into one of people's tables by column name: only the columns the rows carry (the rest take
 * their defaults), never generated ones (e.g. profiles.search), which only Postgres may fill. Returns the
 * inserted rows' `key` column.
 */
async function insertRows(tx: Tx, table: string, rows: readonly Row[], conflict: string, key: string): Promise<string[]> {
  if (!TABLES.has(table)) throw new Error(`not an importable table: ${table}`);
  if (rows.length === 0) return [];
  const cols = (
    await tx<{ name: string }[]>`
      select column_name as name from information_schema.columns
       where table_schema = 'people' and table_name = ${table} and is_generated = 'NEVER'
       order by ordinal_position`
  )
    // Only the columns the export carries: the others take the table's defaults instead of NULL.
    .filter((c) => rows.some((r) => c.name in r))
    .map((c) => `"${c.name}"`);
  const list = cols.join(", ");
  const out = await tx.unsafe<{ k: string }[]>(
    `insert into people.${table} (${list})
     select ${list} from jsonb_populate_recordset(null::people.${table}, $1::text::jsonb)
     on conflict ${conflict} do nothing returning ${key}::text as k`,
    [JSON.stringify(rows)],
  );
  return out.map((r) => r.k);
}

export interface UniversityImport {
  universities: Row[];
  domains: Row[];
  departments: Row[];
  programmes: Row[];
}

export async function importUniversities(sql: postgres.Sql, data: UniversityImport) {
  return sql.begin(async (tx) => {
    const unis = await insertRows(tx, "universities", data.universities, "(id)", "id");
    const domains = await insertRows(tx, "university_domains", data.domains, "(university_id, domain)", "domain");
    const departments = await insertRows(tx, "departments", data.departments, "(id)", "id");
    const programmes = await insertRows(tx, "programmes", data.programmes, "(id)", "id");
    // Every university whose domains were touched, new or not, so identity's copy matches what people holds.
    const touched = [...new Set([...unis, ...data.domains.map((d) => String(d["university_id"]))])];
    await publishDomains(tx, touched);
    return { universities: unis.length, domains: domains.length, departments: departments.length, programmes: programmes.length, domainEvents: touched.length };
  });
}

/** The part after the last `@`, lower-cased; null when there is none (as identity's email_domain). */
function emailDomain(email: string): string | null {
  const m = /@([^@]+)$/.exec(email.trim());
  return m?.[1] ? m[1].toLowerCase() : null;
}

export async function importProfiles(sql: postgres.Sql, data: { profiles: Row[]; onboarding: Row[]; emails: { user_id: string; email: string }[] }, batch = 500) {
  const domains = new Map(data.emails.map((e) => [e.user_id, emailDomain(e.email)]));
  const report = { profiles: 0, onboarding: 0, gateEvents: 0 };
  for (let i = 0; i < data.profiles.length; i += batch) {
    const rows: Row[] = data.profiles.slice(i, i + batch).map((p) => ({ ...p, email_domain: domains.get(String(p["user_id"])) ?? p["email_domain"] ?? null }));
    const ids = new Set(rows.map((r) => String(r["user_id"])));
    await sql.begin(async (tx) => {
      const inserted = await insertRows(tx, "profiles", rows, "(user_id)", "user_id");
      const steps = data.onboarding.filter((o) => ids.has(String(o["user_id"])));
      const onboarding = await insertRows(tx, "onboarding_state", steps, "(user_id)", "user_id");
      for (const userId of inserted) await publishProfile(tx, userId, undefined);
      report.profiles += inserted.length;
      report.onboarding += onboarding.length;
      report.gateEvents += inserted.length;
    });
  }
  return report;
}
