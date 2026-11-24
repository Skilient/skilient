/**
 * timedClick: ms from the click to the first visible pending sign (a disabled or aria-busy button, a spinner,
 * a skeleton, a navigation starting) and to the result (toast, inline message or alert, URL change, or the DOM
 * settling), plus what the page showed. Appends one JSON line per action to docs/ux-pilot/timings.jsonl.
 */
import { appendFileSync, mkdirSync } from "node:fs";
import type { Locator, Page } from "@playwright/test";

const FILE = "docs/ux-pilot/timings.jsonl";
let currentTask = "";
export function setTask(id: string) {
  currentTask = id;
}

export interface Timing {
  task: string;
  label: string;
  route: string;
  device: string;
  pendingMs: number | null;
  resultMs: number | null;
  kind: "navigation" | "toast" | "message" | "settled" | "none";
  shown: string;
  at: string;
}

const INSTALL = () => {
  const w = window as any;
  const t0 = performance.now();
  const state = { t0, pending: null as number | null, result: null as number | null, kind: "", shown: "", last: null as number | null };
  w.__uxp = state;
  const pendingSel = 'button[disabled], button[aria-busy="true"], [aria-busy="true"], [role="progressbar"], .animate-spin, [data-skeleton], .skeleton, [data-pending="true"]';
  const resultSel = '[role="status"]:not(:empty), [role="alert"]:not(:empty), [data-sonner-toast], [data-toast], [aria-live] :is(p,div,span):not(:empty), [aria-invalid="true"]';
  const before = new Set(Array.from(document.querySelectorAll(pendingSel)));
  const beforeRes = new Set(Array.from(document.querySelectorAll(resultSel)).map((e) => (e as HTMLElement).innerText));
  const obs = new MutationObserver(() => {
    const now = performance.now() - t0;
    state.last = now;
    if (state.pending === null) {
      for (const el of Array.from(document.querySelectorAll(pendingSel))) {
        if (!before.has(el) && (el as HTMLElement).offsetParent !== null) {
          state.pending = now;
          break;
        }
      }
    }
    if (state.result === null) {
      for (const el of Array.from(document.querySelectorAll(resultSel))) {
        const text = ((el as HTMLElement).innerText || el.getAttribute("aria-invalid") || "").trim();
        if (text && !beforeRes.has(text) && (el as HTMLElement).offsetParent !== null) {
          state.result = now;
          state.kind = el.matches('[aria-invalid="true"]') ? "message" : el.matches('[role="alert"]') ? "message" : "toast";
          state.shown = text.slice(0, 200);
          break;
        }
      }
    }
  });
  obs.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
};

export async function timedClick(page: Page, target: Locator, label: string, opts: { timeout?: number; settleMs?: number; action?: () => Promise<void> } = {}): Promise<Timing> {
  const timeout = opts.timeout ?? 20_000;
  const settleMs = opts.settleMs ?? 700;
  const startUrl = page.url();
  const device = (page.viewportSize()?.width ?? 0) < 600 ? "phone" : "desktop";
  await page.evaluate(INSTALL).catch(() => undefined);
  let navAt: number | null = null;
  const onReq = (r: any) => {
    if (r.isNavigationRequest() && r.frame() === page.mainFrame() && navAt === null) navAt = Date.now();
  };
  page.on("request", onReq);
  const t0 = Date.now();
  if (opts.action) await opts.action();
  else await target.click();
  let pending: number | null = null;
  let result: number | null = null;
  let kind: Timing["kind"] = "none";
  let shown = "";
  let lastSeen: any = null;
  while (Date.now() - t0 < timeout) {
    const s = await page.evaluate(() => (window as any).__uxp ?? null).catch(() => null);
    const elapsed = Date.now() - t0;
    if (s) lastSeen = s;
    if (navAt !== null && pending === null) pending = navAt - t0;
    if (s?.pending != null && (pending === null || s.pending < pending)) pending = Math.round(s.pending);
    if (page.url() !== startUrl) {
      await page.waitForLoadState("domcontentloaded").catch(() => undefined);
      result = Date.now() - t0;
      kind = "navigation";
      shown = new URL(page.url()).pathname + new URL(page.url()).search;
      break;
    }
    if (s?.result != null) {
      result = Math.round(s.result);
      kind = s.kind || "toast";
      shown = s.shown;
      break;
    }
    if (s && s.last != null && elapsed - s.last > settleMs && elapsed > settleMs) {
      result = Math.round(s.last);
      kind = "settled";
      break;
    }
    if (!s && navAt !== null) {
      // Navigating (old document gone): wait for the new one.
      await page.waitForLoadState("domcontentloaded").catch(() => undefined);
      result = Date.now() - t0;
      kind = "navigation";
      shown = new URL(page.url()).pathname;
      break;
    }
    await page.waitForTimeout(40);
  }
  page.off("request", onReq);
  if (kind === "settled" && !shown) {
    shown = (await page.locator("h1").first().innerText({ timeout: 500 }).catch(() => "")).slice(0, 120);
  }
  const t: Timing = {
    task: currentTask,
    label,
    route: new URL(startUrl).pathname,
    device,
    pendingMs: pending,
    resultMs: result,
    kind,
    shown,
    at: new Date().toISOString(),
  };
  void lastSeen;
  mkdirSync("docs/ux-pilot", { recursive: true });
  appendFileSync(FILE, JSON.stringify(t) + "\n");
  return t;
}

/** A timed page load (navigation by URL), recorded like a click. */
export async function timedGoto(page: Page, url: string, label = `open ${url}`): Promise<Timing> {
  const t0 = Date.now();
  const startUrl = page.url();
  await page.goto(url, { waitUntil: "domcontentloaded" });
  const result = Date.now() - t0;
  const t: Timing = { task: currentTask, label, route: startUrl.startsWith("http") ? new URL(startUrl).pathname : "", device: (page.viewportSize()?.width ?? 0) < 600 ? "phone" : "desktop", pendingMs: null, resultMs: result, kind: "navigation", shown: new URL(page.url()).pathname, at: new Date().toISOString() };
  appendFileSync(FILE, JSON.stringify(t) + "\n");
  return t;
}
