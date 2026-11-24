/**
 * Shared by the heuristic probes (part 5): every visitor, student and faculty page in tests/e2e/sweep-routes.ts with
 * its dynamic segments filled from the UX pilot seed (real ventures, posts, societies, events, entries), the account
 * that opens it, and a writer that merges each probe's raw results into docs/ux-pilot/heuristics/probes.json.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { SWEEP } from "../../../tests/e2e/sweep-routes.ts";
import { sql } from "../lib/act.ts";
import { accounts } from "../lib/browser.ts";

export interface Route { route: string; role: "visitor" | "student" | "faculty"; who: string | null; url: string }
const PH = "00000000-0000-4000-8000-000000000000";

export async function routes(): Promise<Route[]> {
  const A = accounts(); const ids = A.ids; const acc = A.accounts; const ev = ids.events;
  const q1 = async (text: string, ...p: any[]) => (await sql.unsafe(text, p))[0] ?? {};
  const tester = acc.tester.id;
  const att = (await q1("select id from public.task_attempts where user_id = $1 limit 1", tester)).id ?? PH;
  const rev = (await q1("select id from public.task_reviews where reviewer_id = $1 limit 1", tester)).id ?? PH;
  const swap = (await q1("select id from public.swaps where learner_id = $1 limit 1", tester)).id ?? PH;
  const app = (await q1("select id from public.application_threads where candidate_id = $1 limit 1", tester)).id ?? PH;
  const code = (await q1("select code from public.record_entries where user_id = $1 and status = 'sealed' limit 1", tester)).code ?? "ABCDE12345";
  const uni = (await q1("select u.slug from public.universities u join public.profiles p on p.university_id = u.id where p.user_id = $1", tester)).slug;
  const round = ids.inductionRound;
  const door = (await q1("select id from public.events where title = '[UX test] Door check-in night'")).id ?? ev.workshop;
  const devClub = ids.societies.open.slug, guild = ids.societies.inductions.slug;
  const fill: Record<string, (r: string) => { who: string | null; seg: Record<string, string> } | null> = {};
  const out: Route[] = [];
  for (const s of SWEEP) {
    if (!["visitor", "student", "faculty"].includes(s.role)) continue;
    let who: string | null = s.role === "visitor" ? null : s.role === "faculty" ? "faculty" : "tester";
    const seg: Record<string, string> = {};
    const r = s.route;
    const set = (k: string, v: string) => (seg[k] = v);
    if (r.includes("[username]")) set("username", r.startsWith("/profile") ? "uxp_helper_a" : "uxp_tester");
    if (r.includes("[threadId]")) set("threadId", ids.dmTesterA);
    if (r === "/verify/[code]") set("code", code);
    if (r.startsWith("/ventures/[id]")) set("id", ids.testerVenture);
    if (r === "/post/[id]") set("id", ids.posts.text);
    if (r === "/ideas/[id]" || r === "/teach/ideas/[id]") set("id", ids.idea);
    if (r === "/me/tasks/[id]") set("id", att);
    if (r === "/me/tasks/reviews/[id]") set("id", rev);
    if (r === "/swaps/[id]") set("id", swap);
    if (r === "/openings/applications/[id]") set("id", app);
    if (r === "/moderation/[id]") { set("id", ids.posts.reportMe); who = "helperC"; }
    if (r === "/onboarding/[step]") set("step", "university");
    if (r === "/u/[slug]/[[...page]]") set("slug", uni);
    if (r.startsWith("/openings/[category]")) set("category", (s.params?.category as string)?.slice(1) ?? "events");
    if (r.startsWith("/events/[id]")) {
      if (/manage|check-in/.test(r)) { set("id", door); who = "officer1"; } else set("id", ev.workshop);
    }
    if (r.startsWith("/societies/[slug]")) {
      if (/inductions\/\[id\]/.test(r)) { set("slug", guild); set("id", round); }
      else set("slug", devClub);
      if (/manage|events\/new|inductions\/new/.test(r)) who = "officer1";
    }
    const url = r.replace(/\/\[\[\.\.\.[^\]]+\]\]/g, "").replace(/\[([^\]]+)\]/g, (_, n: string) => encodeURIComponent(seg[n] ?? (n === "type" ? "user" : PH)));
    out.push({ route: r, role: s.role as Route["role"], who, url });
  }
  return out;
}

const FILE = "docs/ux-pilot/heuristics/probes.json";
export function save(key: string, data: unknown) {
  mkdirSync("docs/ux-pilot/heuristics", { recursive: true });
  const all = existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : {};
  all[key] = data;
  writeFileSync(FILE, JSON.stringify(all, null, 1));
}
export function load(key: string): any { return existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8"))[key] : undefined; }
