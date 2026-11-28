import { createHash } from "node:crypto";
import { startCall, type JobHandler, type Logger, type Schedule } from "@skilient/platform";
import { eligibleSet, snapshotInputs } from "./inputs";
import type { Files, Ports, Renderer } from "./ports";
import type { ActiveKey } from "./signing/keys";
import { exportsDaily } from "./store/cv";
import type { Row, Tx } from "./store/db";
import { issueCv, refreshStart } from "./store/issue";
import { claimsExpire, sealEntry } from "./store/record";

/** Credentials' schedules (pg_cron today; UTC as there) and their handlers. */
export function credentialsSchedules(): Schedule[] {
  return [
    // 19:30 UTC on the last days of a month is 00:30 PKT on the 1st; the handler checks the day.
    { name: "cv-refresh", cron: "30 19 28-31 * *" },
    { name: "cv-exports-daily", cron: "23 19 * * *" },
    { name: "record-claims-expire", cron: "41 20 * * *" },
  ];
}

export interface JobDeps {
  logger: Logger;
  ports: Ports;
  key: ActiveKey;
  files: Files;
  renderer: Renderer;
}

/** The holder on a sealed entry (people's ProfileCards): name and university. */
export const holderOf = (ports: Ports) => async (userId: string) => {
  const p = (await ports.profiles([userId], startCall())).get(userId);
  return p ? { name: p.name, university: p.university } : null;
};

/** The render job: a PDF of a CV version, a certificate or a transcript, stored through media and recorded with its hash. */
export async function render(tx: Tx, renderId: string, deps: Pick<JobDeps, "files" | "renderer" | "ports">): Promise<void> {
  const [r] = await tx<{ id: string; user_id: string; kind: "cv" | "certificate" | "transcript"; record_id: string | null; entry_id: string | null; template: string; paper: string; status: string }[]>`
    select id::text, user_id::text, kind, record_id::text, entry_id::text, template, paper, status from credentials.pdf_renders where id = ${renderId} for update`;
  if (!r || r.status !== "queued") return;
  const doc: Row =
    r.kind === "cv"
      ? ((await tx<{ v: Row }[]>`select jsonb_build_object('code', code, 'issued_at', issued_at, 'snapshot', snapshot) as v from credentials.cv_records where id = ${r.record_id}`)[0]?.v ?? {})
      : ((
          await tx<{ v: Row }[]>`
            select jsonb_build_object('entries', coalesce(jsonb_agg(jsonb_build_object('code', e.code, 'kind', e.kind, 'title', e.title, 'issuer_name', e.issuer_name,
                                                                                       'line', e.evidence ->> 'line', 'occurred_on', e.occurred_on) order by e.occurred_on desc), '[]'::jsonb)) as v
              from credentials.record_entries e
             where e.user_id = ${r.user_id} and e.status = 'sealed' and (${r.kind} = 'transcript' or e.id = ${r.entry_id}::uuid)`
        )[0]?.v ?? {});
  const holder = (await deps.ports.profiles([r.user_id], startCall())).get(r.user_id);
  const bytes = await deps.renderer.render(r.kind, { ...doc, holder: holder ? { name: holder.name, university: holder.university } : null }, { template: r.template, paper: r.paper });
  const hash = createHash("sha256").update(bytes).digest("hex");
  const path = `${r.user_id}/${r.id}.pdf`;
  await deps.files.put(path, bytes);
  if (r.kind === "cv")
    await tx`
      insert into credentials.cv_pdf_exports (id, record_id, user_id, template, paper, pdf_hash, path, bytes)
      values (${r.id}, ${r.record_id}, ${r.user_id}, ${r.template}, ${r.paper}, ${hash}, ${path}, ${bytes.length})`;
  else {
    const codes = ((doc["entries"] as { code: string }[] | undefined) ?? []).map((e) => e.code);
    await tx`
      insert into credentials.record_pdf_exports (id, user_id, kind, entry_id, holder_name, codes, pdf_hash, bytes)
      values (${r.id}, ${r.user_id}, ${r.kind}, ${r.kind === "certificate" ? r.entry_id : null}, ${holder?.name ?? ""}, ${codes}, ${hash}, ${bytes.length})`;
  }
  await tx`update credentials.pdf_renders set status = 'done', path = ${path}, pdf_hash = ${hash}, done_at = now() where id = ${r.id}`;
}

export function credentialsJobs(deps: JobDeps): Record<string, JobHandler> {
  const run =
    (name: string, job: (tx: Tx, payload: Record<string, unknown>) => Promise<number>): JobHandler =>
    async (tx, j) => {
      const n = await job(tx, j.payload);
      deps.logger.info("jobs.done", { action: `job.${name}`, outcome: "ok", count: n });
    };
  return {
    "cv-refresh": run("cv-refresh", (tx) => refreshStart(tx, (ids) => eligibleSet(deps.ports, ids, startCall()))),
    "cv-exports-daily": run("cv-exports-daily", (tx) => exportsDaily(tx)),
    "record-claims-expire": run("record-claims-expire", (tx) => claimsExpire(tx)),
    "cv-issue": run("cv-issue", async (tx, p) => {
      const user = String(p["user_id"]);
      const r = await issueCv(tx, user, "monthly", await snapshotInputs(deps.ports, user, startCall()), deps.key);
      return r.status === "issued" ? 1 : 0;
    }),
    "record-sign": run("record-sign", async (tx, p) => ((await sealEntry(tx, String(p["entry_id"]), deps.key, holderOf(deps.ports))) ? 1 : 0)),
    render: run("render", async (tx, p) => {
      try {
        await tx.savepoint((sp) => render(sp, String(p["render_id"]), deps));
        return 1;
      } catch (e) {
        await tx`update credentials.pdf_renders set status = 'failed', done_at = now() where id = ${String(p["render_id"])} and status = 'queued'`;
        deps.logger.error("render.failed", { action: "job.render", outcome: "error", error: e instanceof Error ? e.message.slice(0, 200) : "unknown" });
        return 0;
      }
    }),
  };
}
