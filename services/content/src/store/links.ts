import { lookup } from "node:dns/promises";
import { enqueue, type JobHandler, type Logger } from "@skilient/platform";
import { parsePreview } from "../domain/links/meta";
import { PreviewRefused, safeFetchHtml, type Resolve } from "../domain/links/ssrf";
import { urlHash } from "../domain/links/url";
import type { Db, Tx } from "./db";

/**
 * Link previews (ported from _comments_links.sql and the link-preview Edge Function, _shared/links/worker.ts).
 * A post's link queues a `link-preview` job unless a preview fetched in the last 7 days exists; the job fetches
 * through the SSRF guard and caches the result (or `failed`) for 7 days; previews older than 30 days go nightly.
 */
export const LINK_JOB = "link-preview";

export async function queuePreview(tx: Tx, url: string): Promise<void> {
  const [fresh] = await tx`select 1 from content.link_previews where url_hash = ${urlHash(url)} and fetched_at > now() - interval '7 days'`;
  if (!fresh) await enqueue(tx, { kind: LINK_JOB, payload: { url }, dedupeKey: `link:${urlHash(url)}:${new Date().toISOString().slice(0, 10)}`, maxAttempts: 2 });
}

/** `save_link_preview`. */
export async function savePreview(
  db: Db,
  url: string,
  status: "ok" | "failed",
  meta: { title: string | null; description: string | null; imageUrl: string | null; siteName: string | null } | null,
): Promise<void> {
  const cut = (s: string | null | undefined, n: number) => (s == null ? null : s.slice(0, n));
  const image = meta?.imageUrl && /^https:\/\//.test(meta.imageUrl) ? meta.imageUrl.slice(0, 2000) : null;
  await db`
    insert into content.link_previews (url_hash, url, status, title, description, image_url, site_name, fetched_at)
    values (${urlHash(url)}, ${url.slice(0, 2000)}, ${status}, ${cut(meta?.title, 300)}, ${cut(meta?.description, 500)}, ${image},
            ${cut(meta?.siteName, 100)}, now())
    on conflict (url_hash) do update
      set status = excluded.status, title = excluded.title, description = excluded.description,
          image_url = excluded.image_url, site_name = excluded.site_name, fetched_at = excluded.fetched_at, url = excluded.url`;
}

/** Every address a host name resolves to (the guard refuses the URL if any is private). */
export const dnsResolver: Resolve = async (host) => (await lookup(host, { all: true })).map((a) => a.address);

/** The `link-preview` job: one URL, fetched once per 7 days, the outcome cached either way. */
export function linkPreviewJob(deps: { fetch: typeof fetch; resolve: Resolve; logger: Logger; budgetMs?: number }): JobHandler {
  return async (tx, job) => {
    const url = typeof job.payload["url"] === "string" ? job.payload["url"] : "";
    if (!url) return;
    const [fresh] = await tx`select 1 from content.link_previews where url_hash = ${urlHash(url)} and fetched_at > now() - interval '7 days'`;
    if (fresh) return;
    try {
      const page = await safeFetchHtml(url, { fetch: deps.fetch, resolve: deps.resolve, budgetMs: deps.budgetMs });
      const meta = parsePreview(page.html, page.url);
      await savePreview(tx, url, "ok", { title: meta.title, description: meta.description, imageUrl: meta.imageUrl, siteName: meta.siteName });
      deps.logger.info("links.preview", { action: LINK_JOB, outcome: "ok" });
    } catch (error) {
      await savePreview(tx, url, "failed", null);
      deps.logger.info("links.preview", { action: LINK_JOB, outcome: "refused", error_code: error instanceof PreviewRefused ? error.reason : "error" });
    }
  };
}

/** `purge-link-previews` (nightly): previews older than 30 days. */
export async function purgeLinkPreviews(tx: Tx): Promise<number> {
  return (await tx`delete from content.link_previews where fetched_at < now() - interval '30 days'`).count;
}
