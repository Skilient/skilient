/** Small helpers for session runners: as-user SQL for helper roles, compact page text, dialogs. */
import postgres from "postgres";
import type { Page } from "@playwright/test";
const DB = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
if (!/@(127\.0\.0\.1|localhost):/.test(DB)) throw new Error("ux-pilot: refused non-local DATABASE_URL");
export const sql = postgres(DB, { max: 2, onnotice: () => undefined, prepare: false });
/** One product function call as a helper account (the role-play half of a task). */
export async function asUser<T = any>(uid: string, text: string, params: any[] = [], aal = "aal1"): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await sql.begin(async (tx) => {
        await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: uid, role: "authenticated", aal })}, true)`;
        await tx.unsafe("set local role authenticated");
        const r = await tx.unsafe(text, params);
        return Object.values(r[0] ?? {})[0] as T;
      }) as T;
    } catch (e: any) {
      const secs = Number(/(\d+) seconds/.exec(e?.message ?? "")?.[1] ?? 0);
      if (e?.code !== "54000" || !secs || i > 4) throw e;
      await new Promise((r) => setTimeout(r, (secs + 1) * 1000));
    }
  }
}
const NAV = /^(Home|Openings|\d+|waiting|Ventures|Chat|unread|Me|Search or jump to…|What happened since you were last here\.|Venture roles, inductions.*|Projects you build with others\.|Messages with friends and teammates\.|Your profile, Record.*|Your feed, your progress.*)$/;
export async function mainText(p: Page, n = 700): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const busy = await p.evaluate(() => /^(Loading|Loading your|Searching)/m.test(document.querySelector("main")?.textContent ?? "") || !!document.querySelector('main [aria-busy="true"]')).catch(() => false);
    if (!busy) break;
    await p.waitForTimeout(500);
  }
  const t = await p.evaluate(() => { const m = (document.querySelector("main") ?? document.body).cloneNode(true) as HTMLElement; m.querySelectorAll("select, option, datalist, script, style").forEach((e) => e.remove()); document.body.appendChild(m); m.style.position = "absolute"; m.style.left = "-99999px"; const txt = m.innerText; m.remove(); return txt; }).catch(async () => p.locator("body").innerText());
  return t.split("\n").map((l) => l.trim()).filter((l) => l && !NAV.test(l)).join(" | ").slice(0, n);
}
export async function dialogText(p: Page, n = 900): Promise<string> {
  const d = p.locator('[role="dialog"], [role="alertdialog"]').last();
  if (!(await d.isVisible().catch(() => false))) return "(no dialog)";
  return (await d.innerText()).split("\n").map((l) => l.trim()).filter(Boolean).join(" | ").slice(0, n);
}
export async function toastText(p: Page): Promise<string> {
  return (await p.locator('[role="status"], [data-sonner-toast], [role="alert"]').allInnerTexts().catch(() => [])).map((s) => s.replace(/\n+/g, " ")).filter(Boolean).join(" || ").slice(0, 300);
}
