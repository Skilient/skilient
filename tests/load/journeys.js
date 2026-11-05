/**
 * Busy-hour load test (PRD 10 "Load test before launch"; phase 13, docs/load-test.md).
 *
 * 300 concurrent students for 30 minutes, in the mix a results day or an event day brings:
 *   browse  150  feed first page and paging, survey answers, Openings and a category, My Record
 *   social   60  chat with a friend (Realtime delivery), a comment on their post (their badge), the chat page
 *   search   40  Explore, people, ventures and chat search
 *   events   45  an event page, registering (some events have 25 seats), the ticket, an officer's scan
 *   pdf       5  the Record transcript PDF
 *   vitals    2  a throttled phone in a real browser: LCP, INP, CLS on /feed, /openings, /me/record, an event
 *
 * Accounts and events come from scripts/load/seed.mjs (LOAD_FIXTURES). LOAD_SCALE shrinks every scenario
 * (0.01 is the local smoke run); LOAD_RAMP and LOAD_HOLD set the ramp and the steady stretch.
 *
 *   k6 run -e SUPABASE_URL=… -e SUPABASE_PUBLISHABLE_KEY=… -e APP_URL=… -e LOAD_PASSWORD=… tests/load/journeys.js
 */
import exec from "k6/execution";
import { browser } from "k6/browser";
import { check, sleep } from "k6";
import { Counter, Trend } from "k6/metrics";
import { APP_URL, appPost, page, rpc, rpcAsync, select, signIn } from "./lib/api.js";
import { connect } from "./lib/realtime.js";
import { THRESHOLDS } from "./lib/thresholds.js";
import { partnerOf, userEmail, username } from "./lib/users.js";

const FIXTURES = JSON.parse(open(__ENV.LOAD_FIXTURES || "./fixtures.json"));
const SCALE = Number(__ENV.LOAD_SCALE || "1");
const RAMP = __ENV.LOAD_RAMP || "5m";
const HOLD = __ENV.LOAD_HOLD || "30m";
const MIX = { browse: 150, social: 60, search: 40, events: 45, pdf: 5 };
const TOTAL = Object.values(MIX).reduce((a, b) => a + Math.max(1, Math.round(b * SCALE)), 0);
const USERS = FIXTURES.users;

const feedFirstPage = new Trend("feed_first_page", true);
const feedNextPage = new Trend("feed_next_page", true);
const surveySaved = new Trend("survey_saved", true);
const chatDelivered = new Trend("chat_delivered", true);
const searchResults = new Trend("search_results", true);
const badgeUpdate = new Trend("badge_update", true);
const pdfReady = new Trend("pdf_ready", true);
const openingsReady = new Trend("openings_ready", true);
const recordReady = new Trend("record_ready", true);
const eventRegistered = new Trend("event_registered", true);
const eventCheckedIn = new Trend("event_checked_in", true);
const oversold = new Counter("oversold");
const doubleCheckin = new Counter("double_checkin");

const ramping = (name, vus) => ({
  executor: "ramping-vus",
  exec: name,
  startVUs: 0,
  stages: [
    { duration: RAMP, target: vus },
    { duration: HOLD, target: vus },
    { duration: "1m", target: 0 },
  ],
  gracefulRampDown: "30s",
});

export const options = {
  // Grafana Cloud runs the script from Mumbai, next to Vercel bom1 and Supabase ap-south-1 (a local `k6 run` ignores this).
  cloud: { name: "Skilient busy hour", distribution: { mumbai: { loadZone: "amazon:in:mumbai", percent: 100 } } },
  setupTimeout: "5m",
  teardownTimeout: "5m",
  thresholds: THRESHOLDS,
  summaryTrendStats: ["avg", "med", "p(75)", "p(95)", "p(99)", "max", "count"],
  scenarios: {
    ...Object.fromEntries(Object.entries(MIX).map(([name, vus]) => [name, ramping(name, Math.max(1, Math.round(vus * SCALE)))])),
    vitals: {
      executor: "constant-vus",
      exec: "vitals",
      vus: Number(__ENV.LOAD_VITALS_VUS || "2"),
      duration: HOLD,
      startTime: RAMP,
      options: { browser: { type: "chromium" } },
    },
  },
};

// Sessions are made once per account per VU and reused (tokens last an hour; the run is shorter).
const sessions = {};
const as = (n) => (sessions[n] = sessions[n] || signIn(userEmail(n, FIXTURES.domain)));
const think = (lo, hi) => sleep(lo + Math.random() * (hi - lo));
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const me = () => exec.vu.idInTest;

export function setup() {
  return { officers: FIXTURES.societies.map((s) => signIn(s.officerEmail)) };
}

/** Feed, survey, Openings and My Record. */
export function browse() {
  const who = as(me());
  page(who, "/feed", "feed", feedFirstPage);
  // The page rendered the first 20; load-more starts from its cursor (fetched here, not timed).
  let rows = rpc(who, "feed_page", { p_audience: "university", p_filter: "all", p_limit: 20 }).json() || [];
  for (let i = 0; i < 2 && rows.length && rows[0].next_cursor; i++) {
    think(2, 5);
    const t0 = Date.now();
    const next = rpc(who, "feed_page", { p_audience: "university", p_filter: "all", p_cursor: rows[0].next_cursor, p_limit: 20 });
    rows = next.json() || [];
    const ids = rows.map((r) => r.post_id);
    if (ids.length) rpc(who, "post_cards", { p_ids: ids });
    feedNextPage.add(Date.now() - t0);
    if (ids.length) {
      // The view tracker reports posts held on screen; only a viewed post can be answered.
      think(1, 2);
      rpc(who, "record_views", { p_ids: ids.slice(0, 6) });
      const strip = rpc(who, "survey_for_posts", { p_ids: ids.slice(0, 6) }).json() || [];
      for (const s of strip.filter((x) => !x.answered_at).slice(0, 2)) {
        const res = rpc(who, "answer_survey", { p_post: s.post_id, p_answer: Math.random() < 0.7, p_latency_ms: 900 + Math.floor(Math.random() * 2000) });
        surveySaved.add(res.timings.duration);
      }
    }
  }
  think(3, 6);
  page(who, "/openings", "openings", openingsReady);
  think(2, 4);
  const category = ["events", "inductions", "venture-roles", "this-week"][exec.scenario.iterationInTest % 4];
  page(who, `/openings/${category}`, "openings_category");
  think(3, 6);
  page(who, "/me/record", "record", recordReady);
  if (exec.scenario.iterationInTest % 3 === 0) {
    think(2, 4);
    page(who, "/notifications", "notifications");
  }
  think(4, 8);
}

/** Chat with a friend and comment on their post, timed until the friend's Realtime subscription sees it. */
export async function social() {
  const a = as(me());
  const bn = partnerOf(me(), USERS);
  const b = as(bn);
  a.thread = a.thread || rpc(a, "get_or_create_dm", { p_username: username(bn) }).json();
  a.partnerPost = a.partnerPost || (select(a, `posts?author_id=eq.${b.userId}&select=id&order=created_at.desc&limit=1`, "rest.partner_post").json()[0] || {}).id;
  page(a, `/chat/${a.thread}`, "chat_thread");

  const rt = connect();
  if (!check(await rt.open(), { "realtime connected": (ok) => ok })) return;
  const chat = await rt.subscribe(`chat:${a.thread}`, b.token, { event: "*", schema: "public", table: "chat_messages", filter: `thread_id=eq.${a.thread}` });
  const notes = await rt.subscribe(`notifications:${b.userId}`, b.token, { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${b.userId}` });
  check(chat && notes, { "realtime subscribed": (ok) => ok });
  if (chat) {
    for (let i = 0; i < 3; i++) {
      const marker = `k6 ${me()}.${exec.scenario.iterationInTest}.${i} see you at the lab`;
      const seen = rt.change(`chat:${a.thread}`, (r) => r.body === marker, 5000);
      const t0 = Date.now();
      const sent = await rpcAsync(a, "send_message", { p_thread: a.thread, p_body: marker });
      check(sent, { "send_message ok": (r) => r.status === 200 });
      const got = await seen;
      if (check(got, { "chat delivered": (m) => m !== null })) chatDelivered.add(Date.now() - t0);
      await delay(3000 + Math.random() * 4000);
    }
  }
  if (notes && a.partnerPost) {
    const told = rt.change(`notifications:${b.userId}`, () => true, 5000);
    const t0 = Date.now();
    const res = await rpcAsync(a, "add_comment", { p_post: a.partnerPost, p_parent: null, p_body: "Nice work, see you at the lab." });
    check(res, { "add_comment ok": (r) => r.status === 200 });
    const got = await told;
    if (check(got, { "badge event": (m) => m !== null })) {
      const badges = await rpcAsync(b, "nav_badges", {});
      check(badges, { "nav_badges ok": (r) => r.status === 200 });
      badgeUpdate.add(Date.now() - t0);
    }
  }
  rt.close();
  await delay(10000 + Math.random() * 10000);
}

/** Explore and the three searches. */
export function search() {
  const who = as(me());
  page(who, "/explore?q=Load", "explore");
  const terms = ["Timetable", "Campus", "Lab", "Bus", "Study"];
  for (let i = 0; i < 3; i++) {
    think(2, 4);
    const q = terms[(exec.scenario.iterationInTest + i) % terms.length];
    const res =
      i === 0
        ? rpc(who, "search_people", { p_q: `Load Student ${1 + Math.floor(Math.random() * USERS)}` })
        : i === 1
          ? rpc(who, "search_ventures", { p_q: q, p_type: "project" })
          : rpc(who, "search_chats", { p_q: "lab" });
    searchResults.add(res.timings.duration);
  }
  think(5, 10);
}

/** Register for an event-day event, open the ticket, and an officer scans it (one in ten twice). */
export function events(data) {
  const state = (sessions.events = sessions.events || { k: 0, done: {} });
  const n = me() + state.k * TOTAL;
  if (n > USERS) {
    think(20, 30);
    return;
  }
  const who = as(n);
  const todo = FIXTURES.events.filter((e) => !state.done[`${n}:${e.id}`]);
  if (!todo.length) {
    state.k++;
    return;
  }
  const event = todo[Math.floor(Math.random() * todo.length)];
  state.done[`${n}:${event.id}`] = true;
  page(who, `/events/${event.id}`, "event");
  think(3, 8);
  const reg = rpc(who, "register_event", { p_event: event.id, p: { ticket_type_id: event.ticket } });
  eventRegistered.add(reg.timings.duration);
  const status = reg.status === 200 ? reg.json().status : null;
  check(status, { "registered or waitlisted": (s) => ["confirmed", "waitlisted", "pending"].includes(s) });
  if (status === "confirmed") {
    think(2, 5);
    page(who, `/events/${event.id}/ticket`, "ticket");
    const ticket = rpc(who, "event_ticket", { p_event: event.id }).json();
    const officer = data.officers[event.society];
    const scan = rpc(officer, "check_in_scan", { p_event: event.id, p_session: null, p_payload: ticket.payload });
    eventCheckedIn.add(scan.timings.duration);
    check(scan.json(), { "first scan green": (r) => r && r.result === "green" });
    if (Math.random() < 0.1) {
      const again = rpc(officer, "check_in_scan", { p_event: event.id, p_session: null, p_payload: ticket.payload }).json();
      if (again && again.result === "green") doubleCheckin.add(1);
    }
  }
  think(5, 12);
}

/** The Record transcript PDF (5 a minute per student, so each iteration moves to the next student). */
export function pdf() {
  const state = (sessions.pdf = sessions.pdf || { k: 0 });
  const n = me() + state.k++ * TOTAL;
  if (n > USERS) {
    think(30, 60);
    return;
  }
  const who = as(n);
  page(who, "/me/record", "record", recordReady);
  const res = appPost(who, "/api/record/pdf", { kind: "transcript" }, "route.record_pdf");
  pdfReady.add(res.timings.duration);
  think(20, 40);
}

/**
 * Core Web Vitals in a real browser on Lighthouse's mobile profile (150 ms RTT, 1.6 Mbps down, 4x CPU),
 * the same throttling Lighthouse CI scores against, while the other scenarios load the system.
 */
export async function vitals() {
  const who = as(me());
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
  const host = APP_URL.replace(/^https?:\/\//, "").split(/[:/]/)[0];
  await context.addCookies(
    who.cookie.split("; ").map((c) => {
      const name = c.slice(0, c.indexOf("="));
      return { name, value: c.slice(c.indexOf("=") + 1), domain: host, path: "/", secure: name.startsWith("__Secure-"), sameSite: "Lax" };
    }),
  );
  const tab = await context.newPage();
  try {
    await tab.throttleNetwork({ latency: 150, download: (1.6 * 1024 * 1024) / 8, upload: (750 * 1024) / 8 });
    await tab.throttleCPU({ rate: 4 });
    const event = FIXTURES.events[exec.scenario.iterationInTest % FIXTURES.events.length];
    for (const path of ["/feed", "/openings", "/me/record", `/events/${event.id}`]) {
      await tab.goto(`${APP_URL}${path}`, { waitUntil: "load" });
      // One interaction per page so INP has something to measure: open the first menu or tab, then Escape.
      await tab.keyboard.press("Tab");
      await tab.keyboard.press("Tab");
      await tab.keyboard.press("Enter");
      await tab.keyboard.press("Escape");
      await delay(1500);
    }
  } finally {
    await tab.close();
    await context.close();
  }
  await delay(5000);
}

/** Correctness after the run: no event confirmed more seats than it has. */
export function teardown(data) {
  for (const e of FIXTURES.events) {
    const res = rpc(data.officers[e.society], "event_manage", { p_event: e.id });
    const stats = (res.json() || {}).stats || {};
    if (Number(stats.registered) > Number(stats.capacity || e.capacity)) oversold.add(1);
  }
}
