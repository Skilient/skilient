/** Probe 9 (TRU, H04): the same fact must match everywhere. Scrapes each fact from every page that shows it and compares. Raw results under "invariants". */
import { launch, context, page, ready, signIn, accounts } from "../lib/browser.ts";
import { sql, mainText } from "../lib/act.ts";
import { save } from "./lib.ts";
const A = accounts(); const acc = A.accounts; const ids = A.ids;
const b = await launch();
const as = async (who: string) => { const p = await page(await context(b, { device: "desktop", throttle: false })); await signIn(p, acc[who]); await ready(p, 200); return p; };
const txt = async (p: any, url: string) => { await p.goto(url).catch(() => undefined); await ready(p, 300); return await mainText(p, 20000); };
const grab = (t: string, re: RegExp) => re.exec(t)?.[1] ?? null;
const checks: any[] = [];
const add = (fact: string, values: Record<string, any>) => { const vals = Object.values(values).filter((v) => v !== null && v !== undefined); const consistent = new Set(vals.map(String)).size <= 1; checks.push({ fact, values, consistent }); console.log(fact, consistent, JSON.stringify(values)); };

// Score and tier (helper B: on the leaderboard).
let p = await as("helperB");
const me = await txt(p, "/me"), score = await txt(p, "/me/score"), lb = await txt(p, "/leaderboard"), prof = await txt(p, "/profile/uxp_helper_b"), cv = await txt(p, "/me/cv");
const [db] = await sql`select total::text, tier from public.ranking_scores where user_id = ${acc.helperB.id}`;
add("score (points)", { me: grab(me, /Score \| ([\d.]+)/), score: grab(score, /Total \| ([\d.]+)/), db: Number(db?.total).toFixed(2).replace(/\.?0+$/, "") === grab(me, /Score \| ([\d.]+)/) ? grab(me, /Score \| ([\d.]+)/) : db?.total });
add("tier", { me: grab(me, /\| (Raw|Spark|Flare|Shine|Radiant|Luminary) \| Score/), score: grab(score, /points \| (Raw|Spark|Flare|Shine|Radiant|Luminary)/), leaderboard: /Bushra Helper \| (Raw|Spark|Flare|Shine|Radiant|Luminary)/.exec(lb)?.[1] ?? null, profile: grab(prof, /Bushra Helper \| (Raw|Spark|Flare|Shine|Radiant|Luminary)/), cv: grab(cv, /(Raw|Spark|Flare|Shine|Radiant|Luminary) tier on Skilient/), db: db?.tier ? db.tier[0].toUpperCase() + db.tier.slice(1) : null });
add("tiers reached vs tier", { scorePage: grab(score, /(\d) of 6 tiers reached/), expected: String(["raw", "spark", "flare", "shine", "radiant", "luminary"].indexOf(db?.tier ?? "raw") + 1) });
add("'updated' date", { me: grab(me, /updated ([\d]+ \w+ \d{4})/), score: grab(score, /Updated ([\d]+ \w+ \d{4})/) });
await p.context().close();

// Share links: Privacy centre vs CV page (Sana).
p = await as("testerSpark");
const priv = await txt(p, "/settings/privacy"), scv = await txt(p, "/me/cv");
const [{ n: active }] = await sql`select count(*)::int as n from public.cv_share_links where user_id = ${acc.testerSpark.id} and revoked_at is null and (expires_at is null or expires_at > now())`.catch(() => [{ n: null }]);
add("active CV share links", { privacyCentre: grab(priv, /(\d+) active share links?/), cvPage: (scv.match(/expires \d/gi) ?? []).length || (/Share links are paused/.test(scv) ? "paused" : null), db: active });
await p.context().close();

// Unread counts: rail badges vs pages (tester).
p = await as("tester");
await p.goto("/feed"); await ready(p, 300);
const rail = await p.evaluate(() => Array.from(document.querySelectorAll("nav a[aria-label]")).map((a) => a.getAttribute("aria-label")).join(" | "));
const chat = await txt(p, "/chat"), notif = await txt(p, "/notifications");
const [{ n: dbChat }] = await sql`select count(distinct m.thread_id)::int as n from public.chat_messages m join public.chat_thread_members t on t.thread_id = m.thread_id and t.user_id = ${acc.tester.id} where m.sender_id <> ${acc.tester.id} and m.created_at > coalesce(t.last_read_at, 'epoch')`.catch(() => [{ n: null }]);
add("unread chats", { rail: grab(rail, /Chat, (\d+) unread/) ?? "0", chatList: String((chat.match(/\d+ unread/g) ?? []).length), db: dbChat });
add("unread notifications", { rail: grab(rail, /Notifications, (\d+) unread/) ?? "0", page: String((notif.match(/, unread/g) ?? []).length) });
// Society members and followers.
const [s] = await sql`select id, slug from public.societies where name = 'UX Pilot Developers Club'`;
const sp = await txt(p, `/societies/${s.slug}`);
const [{ m, f }] = await sql`select (select count(*)::int from public.society_members where society_id = ${s.id}) as m, (select count(*)::int from public.society_follows where society_id = ${s.id}) as f`;
add("society members", { page: grab(sp, /(\d+) members?/), db: m }); add("society followers", { page: grab(sp, /(\d+) followers?/), db: f });
// Venture status across surfaces (Fee Tracker).
const vp = await txt(p, `/ventures/${ids.testerVenture}`), vl = await txt(p, "/ventures"), pv = await txt(p, "/profile/uxp_tester/ventures"), tcv = await txt(p, "/me/cv");
add("venture status (Fee Tracker)", { venturePage: grab(vp, /PROJECT \| (Recruiting|In progress|Completed|Abandoned)/), venturesList: grab(vl, /(Recruiting|In progress|Completed|Abandoned) \| Fee Tracker/), profile: grab(pv, /Fee Tracker \|[^|]*\| (Recruiting|In progress|Completed|Abandoned)/), cvDates: grab(tcv, /Fee Tracker \| (Nov 2026 – [A-Za-z]+(?: 2026)?)/) === "Nov 2026 – Nov 2026" ? "Completed" : grab(tcv, /Fee Tracker \| ([^|]+)/) });
add("venture team size (Fee Tracker)", { page: grab(vp, /(\d) of \d members/), team: grab(await txt(p, `/ventures/${ids.testerVenture}/team`), /(\d) in/) });
// Record entries: Record vs CV activities picker vs profile pins.
const rec = await txt(p, "/me/record"), cvAct = await txt(p, "/me/cv");
const [{ n: sealed }] = await sql`select count(*)::int as n from public.record_entries where user_id = ${acc.tester.id} and status = 'sealed'`;
add("sealed Record entries", { record: String((rec.match(/Sealed · /g) ?? []).length), cvPicker: String(((cvAct.split("Leadership and activities | ").slice(-1)[0] ?? "").match(/ · \d+ \w+ 2026/g) ?? []).length), db: sealed });
add("pinned entries", { record: String((rec.match(/Pinned/g) ?? []).length), profile: String(((await txt(p, "/profile/uxp_tester")).split("From the Record | ")[1] ?? "").split(" | ").filter((l) => /^(Venture completed|Attended|Result|Taught|Office bearer):/.test(l)).length) });
// GitHub sync numbers vs skills evidence.
const gh = await txt(p, "/settings/github"), sk = await txt(p, "/me/skills");
const [{ c }] = await sql`select count(*)::int as c from public.github_commits where user_id = ${acc.tester.id}`;
add("GitHub sync vs evidence", { settings: grab(gh, /(Not synced yet|Up to date[^|]*)/), skillsWithLevels: String((sk.match(/L[1-4] \|/g) ?? []).length), commitsInDb: c });
await p.context().close();
save("invariants", { checks, contradictions: checks.filter((c) => !c.consistent).length });
await b.close(); await sql.end();
