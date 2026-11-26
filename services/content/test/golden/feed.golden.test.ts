/**
 * Golden replays of feed.json and links.json against content's store (packages/testing/test/content.golden.test.ts,
 * "feed" and "links"). share.json is messaging's to replay (share_post writes chat messages; W4): content's part
 * of it, whether the sharer may see the post, is VisiblePosts, covered by the contract tests.
 */
import type { TestDatabase } from "@skilient/testing/postgres";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, it } from "vitest";
import { extractLink, urlHash } from "../../src/domain/links/url";
import { cardRows } from "../../src/store/cards";
import { feedPage, scoreOf, stageOf } from "../../src/store/feed";
import { queuePreview, savePreview } from "../../src/store/links";
import {
  addEvent,
  ASMA,
  befriend,
  BILAL,
  block,
  bodyMap,
  call,
  CONFIG,
  CYRA,
  DANYAL,
  ESHA,
  GRAD,
  insertComment,
  insertPost,
  mute,
  named,
  replay,
  startWorld,
  step,
  STAFF,
  UNI_A,
  UNI_B,
  UUID_X,
  view,
  type Outcome,
  type Tx,
} from "./replay";

let pg: TestDatabase;
let sql: postgres.Sql;
beforeAll(async () => ({ pg, sql } = await startWorld()));
afterAll(async () => pg?.stop());

describe("feed.json", () => {
  it("compute_stage", () =>
    replay(sql, "feed", "compute_stage", async (tx) => {
      const out: Record<string, unknown> = {};
      const stage = (id: string) => call(tx, (sp) => stageOf(sp, id, CONFIG));
      const stats = (id: string, set: Record<string, number>) => tx`update content.post_stats set ${tx(set)} where post_id = ${id}`;
      const hours = (n: number) => ({ hoursAgo: n });

      const held = await insertPost(tx, BILAL, "Stage: three reports", hours(5));
      await stats(held, { reports: 3 });
      out["held_by_reports"] = await stage(held);
      const heldAndLoved = await insertPost(tx, BILAL, "Stage: reports beat answers", hours(5));
      await stats(heldAndLoved, { reports: 3, answers: 10, positives: 10 });
      out["held_beats_everything"] = await stage(heldAndLoved);
      const twoReports = await insertPost(tx, BILAL, "Stage: two reports", hours(5));
      await stats(twoReports, { reports: 2 });
      out["two_reports_not_held"] = await stage(twoReports);

      const demotedHides = await insertPost(tx, BILAL, "Stage: hidden by many", hours(5));
      await stats(demotedHides, { views: 10, hides: 3 });
      out["demoted_by_hides"] = await stage(demotedHides);
      const fewViews = await insertPost(tx, BILAL, "Stage: hidden but few views", hours(5));
      await stats(fewViews, { views: 9, hides: 9 });
      out["not_demoted_under_ten_views"] = await stage(fewViews);
      const demotedCred = await insertPost(tx, BILAL, "Stage: not credible", hours(5));
      await tx`insert into content.post_survey_counts (post_id, dimension, ticks, crosses) values (${demotedCred}, 'credible', 6, 4)`;
      out["demoted_by_credible"] = await stage(demotedCred);
      const credFine = await insertPost(tx, BILAL, "Stage: credible enough", hours(5));
      await tx`insert into content.post_survey_counts (post_id, dimension, ticks, crosses) values (${credFine}, 'credible', 8, 2)`;
      out["credible_below_threshold"] = await stage(credFine);

      const boostAnswers = await insertPost(tx, BILAL, "Stage: boosted by answers", { audience: "global", ...hours(5) });
      await stats(boostAnswers, { answers: 10, positives: 6, views: 40 });
      out["global_boost_by_answers"] = await stage(boostAnswers);
      const boostComments = await insertPost(tx, BILAL, "Stage: boosted by commenters", { audience: "global", ...hours(5) });
      await stats(boostComments, { commenters: 5, commenter_universities: 2 });
      out["global_boost_by_commenters"] = await stage(boostComments);
      const oneUniversity = await insertPost(tx, BILAL, "Stage: commenters from one university", { audience: "global", ...hours(5) });
      await stats(oneUniversity, { commenters: 5, commenter_universities: 1 });
      out["boost_needs_two_universities"] = await stage(oneUniversity);
      const notGlobal = await insertPost(tx, BILAL, "Stage: loved but university only", hours(5));
      await stats(notGlobal, { answers: 10, positives: 9 });
      out["university_post_never_boosted"] = await stage(notGlobal);

      const fullAnswers = await insertPost(tx, BILAL, "Stage: full by answers", hours(5));
      await stats(fullAnswers, { answers: 5, positives: 3 });
      out["full_by_answers"] = await stage(fullAnswers);
      const lowRate = await insertPost(tx, BILAL, "Stage: answers but low rate", hours(5));
      await stats(lowRate, { answers: 5, positives: 1 });
      out["answers_with_low_positive_rate"] = await stage(lowRate);
      const sticky = await insertPost(tx, BILAL, "Stage: already full", { stage: "full", ...hours(5) });
      out["full_is_sticky"] = await stage(sticky);
      const stickyBoost = await insertPost(tx, BILAL, "Stage: already boosted", { stage: "global_boost", ...hours(5) });
      out["boost_is_sticky_as_full"] = await stage(stickyBoost);
      const crowd = await insertPost(tx, BILAL, "Stage: full by non-friend commenters", hours(5));
      await insertComment(tx, crowd, DANYAL, "A comment that counts", { minutesAgo: 30 });
      await insertComment(tx, crowd, STAFF, "Another comment that counts", { minutesAgo: 20 });
      await insertComment(tx, crowd, GRAD, "A third comment that counts", { minutesAgo: 10 });
      out["full_by_three_non_friend_commenters"] = await stage(crowd);
      const friendsCrowd = await insertPost(tx, BILAL, "Stage: commenters are friends", hours(5));
      await befriend(tx, BILAL, DANYAL);
      await befriend(tx, BILAL, STAFF);
      await befriend(tx, BILAL, GRAD);
      await insertComment(tx, friendsCrowd, DANYAL, "A friend's comment here", { minutesAgo: 30 });
      await insertComment(tx, friendsCrowd, STAFF, "Another friend's comment", { minutesAgo: 20 });
      await insertComment(tx, friendsCrowd, GRAD, "A third friend's comment", { minutesAgo: 10 });
      out["friend_commenters_do_not_count"] = await stage(friendsCrowd);
      const shortComments = await insertPost(tx, BILAL, "Stage: short comments", hours(5));
      await insertComment(tx, shortComments, ASMA, "short", { minutesAgo: 30 });
      await insertComment(tx, shortComments, CYRA, "tiny", { minutesAgo: 20 });
      await insertComment(tx, shortComments, ESHA, "small", { minutesAgo: 10 });
      out["short_comments_do_not_count"] = await stage(shortComments);

      const fresh = await insertPost(tx, BILAL, "Stage: just posted", hours(1));
      out["seed_when_new"] = await stage(fresh);
      const seen = await insertPost(tx, BILAL, "Stage: new but seen a lot", hours(1));
      await stats(seen, { views: 30 });
      out["limited_when_new_but_30_views"] = await stage(seen);
      const old = await insertPost(tx, BILAL, "Stage: a few hours old", hours(5));
      out["limited_when_older"] = await stage(old);
      out["unknown_post"] = await stage(UUID_X);
      return out;
    }));

  it("score", () =>
    replay(sql, "feed", "score", async (tx) => {
      const out: Record<string, unknown> = {};
      const pBilal = await insertPost(tx, BILAL, "Score: bilal general", { stage: "limited", hoursAgo: 5 });
      const pCyra = await insertPost(tx, CYRA, "Score: cyra global", { audience: "global", university: UNI_B, stage: "full", hoursAgo: 5 });
      const pDanyal = await insertPost(tx, DANYAL, "Score: danyal demoted", { stage: "demoted", hoursAgo: 24 });
      const pBoost = await insertPost(tx, CYRA, "Score: cyra boosted", { audience: "global", university: UNI_B, stage: "global_boost", hoursAgo: 10 });
      const pSeed = await insertPost(tx, BILAL, "Score: bilal seed", { stage: "seed", hoursAgo: 3 });
      const posts: [string, string][] = [["bilal_limited", pBilal], ["cyra_full", pCyra], ["danyal_demoted", pDanyal], ["cyra_boost", pBoost], ["bilal_seed", pSeed]];
      const one = (id: string, v: string) => call(tx, async (sp) => (await scoreOf(sp, id, v, CONFIG)).toFixed(6));
      const matrix = async () => {
        const m: Record<string, unknown> = {};
        for (const [label, id] of posts) for (const [vl, v] of [["asma", ASMA], ["cyra", CYRA]] as const) m[`${label}_for_${vl}`] = await one(id, v);
        return m;
      };
      out["baseline"] = await matrix();
      await befriend(tx, ASMA, BILAL);
      out["after_asma_befriends_bilal"] = await matrix();
      await view(tx, pBilal, ASMA);
      out["after_asma_saw_bilals_post"] = await matrix();
      await tx`insert into content.post_survey_counts (post_id, dimension, assigned, ticks, crosses, weighted_ticks, weighted_crosses) values
                 (${pBilal}, 'informative', 6, 5, 1, 4.5, 1), (${pBilal}, 'interesting', 6, 4, 2, 3.5, 2)`;
      out["after_survey_counts_on_bilals_post"] = await matrix();
      await insertComment(tx, pBilal, DANYAL, "A comment that is long enough", { minutesAgo: 30 });
      await insertComment(tx, pBilal, STAFF, "Another long enough comment", { minutesAgo: 20 });
      await insertComment(tx, pBilal, ASMA, "short", { minutesAgo: 10 });
      out["after_comments"] = await matrix();
      await mute(tx, CYRA, BILAL);
      out["after_cyra_mutes_bilal"] = await matrix();
      await tx`update content.posts set created_at = now() - interval '48 hours' where id = ${pCyra}`;
      out["after_cyras_post_is_two_days_old"] = await matrix();
      out["unknown_post"] = await one(UUID_X, ASMA);
      return out;
    }));

  it("page", () =>
    replay(sql, "feed", "page", async (tx) => {
      const out: Record<string, unknown> = {};
      const h = (hoursAgo: number, stage = "limited") => ({ hoursAgo, stage });
      await insertPost(tx, BILAL, "Feed: bilal general", h(3));
      await insertPost(tx, DANYAL, "Feed: danyal full", h(4, "full"));
      await insertPost(tx, STAFF, "Feed: staff limited", h(5));
      await insertPost(tx, ASMA, "Feed: asma own", h(6, "full"));
      await addEvent(tx, BILAL, "Feed: bilal event", h(7));
      const announcement = await insertPost(tx, BILAL, "Feed: bilal announcement", { type: "announcement", ...h(8) });
      await tx`insert into content.announcement_meta (post_id, university_id, expires_at) values (${announcement}, ${UNI_A}, now() + interval '5 days')`;
      await insertPost(tx, BILAL, "Feed: ten days old", h(240));
      await insertPost(tx, BILAL, "Feed: held", h(9, "held"));
      const hidden = await insertPost(tx, BILAL, "Feed: hidden by asma", h(10));
      await tx`insert into content.post_hides (user_id, post_id) values (${ASMA}, ${hidden})`;
      const pinned = await insertPost(tx, STAFF, "Feed: pinned platform news", { type: "announcement", audience: "global", ...h(11, "full") });
      await tx`update content.posts set pinned_until = now() + interval '3 days' where id = ${pinned}`;
      await insertPost(tx, CYRA, "Feed: global from cyra", { audience: "global", university: UNI_B, ...h(5) });
      await insertPost(tx, ESHA, "Feed: global from esha", { audience: "global", university: UNI_B, ...h(6) });
      await insertPost(tx, BILAL, "Feed: global from bilal", { audience: "global", ...h(4, "full") });
      await insertPost(tx, GRAD, "Feed: global from a blocked graduate", { audience: "global", ...h(5) });
      await block(tx, ASMA, GRAD);
      await insertPost(tx, CYRA, "Feed: only at B", { university: UNI_B, ...h(7) });
      const m = await bodyMap(tx);
      const raw = (me: string | null, a: [string, string, string | null, number]) => async (sp: Tx) => {
        const p = await feedPage(sp, me, a[0], a[1], a[2], a[3], CONFIG);
        return p.items.map((i) => ({ post_id: i.post_id, rank: i.rank, next_cursor: p.next_cursor }));
      };
      const page = async (me: string, a: [string, string, string | null, number]) => named(await call(tx, raw(me, a)), m, ["post_id"]);

      const first = await step(tx, raw(ASMA, ["university", "all", null, 5]));
      const firstRows = (first.result as { ok: true; value: { next_cursor: string }[] }).value;
      out["university_page_1"] = { result: named(first.result, m, ["post_id"]), changes: first.changes };
      const cursor = firstRows[0]!.next_cursor;
      out["university_page_2"] = await page(ASMA, ["university", "all", cursor, 5]);
      out["page_2_cursor_is_over"] = await call(tx, async (sp) => {
        const rows = await raw(ASMA, ["university", "all", cursor, 5])(sp);
        return [{ n: rows.length, cursors: rows.filter((r) => r.next_cursor !== null).length }];
      });
      out["same_cursor_other_audience"] = await page(ASMA, ["global", "all", cursor, 5]);
      out["unknown_session_cursor"] = await page(ASMA, ["university", "all", `${UUID_X}:3`, 5]);
      out["page_of_two"] = await page(DANYAL, ["university", "all", null, 2]);
      out["global"] = await page(ASMA, ["global", "all", null, 5]);
      out["global_as_cyra"] = await page(CYRA, ["global", "all", null, 5]);
      out["university_as_cyra"] = await page(CYRA, ["university", "all", null, 5]);
      out["university_as_bilal"] = await page(BILAL, ["university", "all", null, 20]);
      out["filter_events"] = await page(ASMA, ["university", "events", null, 5]);
      out["filter_announcements"] = await page(ASMA, ["university", "announcements", null, 5]);
      out["filter_shipped"] = await page(ASMA, ["university", "shipped", null, 5]);
      out["filter_ventures"] = await page(ASMA, ["university", "ventures", null, 5]);
      out["filter_societies"] = await page(ASMA, ["university", "societies", null, 5]);
      out["empty_filter_is_all"] = await page(ASMA, ["university", "", null, 20]);
      out["limit_zero_is_one"] = await page(ASMA, ["university", "all", null, 0]);
      out["limit_over_cap"] = await page(ASMA, ["university", "all", null, 500]);
      out["bad_filter"] = await call(tx, raw(ASMA, ["university", "popular", null, 5]));
      out["bad_cursor"] = await call(tx, raw(ASMA, ["university", "all", "not-a-cursor", 5]));
      out["cursor_with_bad_offset"] = await call(tx, raw(ASMA, ["university", "all", `${UUID_X}:abc`, 5]));
      out["signed_out"] = await call(tx, raw(null, ["university", "all", null, 5]), "feed_page");
      return out;
    }));
});

describe("links.json", () => {
  const queue = async (tx: Tx) =>
    (await tx<{ url: string }[]>`select payload ->> 'url' as url from platform.jobs where kind = 'link-preview' order by created_at, id`).map((r) => r.url);
  const links = async (tx: Tx) =>
    (await tx`select body, left(link_url, 70) as link_url, char_length(link_url) as length from content.posts where author_id = ${ASMA} order by body`).map((r) => ({ ...r }));
  /** posts_link_url on insert and on a body update: the link read again, queued when new and not fresh. */
  const writeBody = async (tx: Tx, id: string | null, body: string, hoursAgo = 0): Promise<string> => {
    const link = extractLink(body);
    if (id === null) {
      const newId = await insertPost(tx, ASMA, body, { hoursAgo });
      if (link) await queuePreview(tx, link);
      return newId;
    }
    const [old] = await tx<{ link_url: string | null }[]>`select link_url from content.posts where id = ${id}`;
    await tx`update content.posts set body = ${body}, link_url = ${link} where id = ${id}`;
    if (link && link !== old!.link_url) await queuePreview(tx, link);
    return id;
  };

  it("trigger", () =>
    replay(sql, "links", "trigger", async (tx) => {
      const out: Record<string, unknown> = {};
      const queued = async (run: () => Promise<unknown>) => {
        const before = await queue(tx);
        await run();
        const after = await queue(tx);
        return after.filter((u) => !before.includes(u)).map((u) => (u.length > 80 ? `${u.slice(0, 60)}... (${u.length} characters)` : u));
      };
      for (const [url, title, days] of [
        ["https://fresh.example.test/f", "Fresh", 1],
        ["https://stale.example.test/s", "Stale", 8],
      ] as const)
        await tx`insert into content.link_previews (url_hash, url, status, title, fetched_at) values (${urlHash(url)}, ${url}, 'ok', ${title}, now() - make_interval(days => ${days}))`;
      const bodies = [
        "Link: see https://example.test/a, and more",
        "Link: (http://plain.example.test/path).",
        "Link: question? https://q.example.test/p?x=1?",
        "Link: none here",
        "Link: two https://one.example.test/1 and https://two.example.test/2",
        "Link: fresh https://fresh.example.test/f",
        "Link: stale https://stale.example.test/s",
        "Link: not http ftp://files.example.test/f",
        "Link: brackets [https://b.example.test/x]; end",
        `Link: very long https://long.example.test/${"x".repeat(1950)}`,
      ];
      let hoursAgo = 1;
      for (const body of bodies) out[`insert: ${body.slice(0, 40)}`] = await queued(() => writeBody(tx, null, body, hoursAgo++));
      out["after_inserts"] = await links(tx);
      const [row] = await tx<{ id: string }[]>`select id::text from content.posts where body = 'Link: none here'`;
      const id = row!.id;
      out["update_adds_a_link"] = await queued(() => writeBody(tx, id, "Link: now https://later.example.test/l"));
      out["update_same_link_not_queued_again"] = await queued(() => writeBody(tx, id, "Link: still https://later.example.test/l ok"));
      out["update_other_link"] = await queued(() => writeBody(tx, id, "Link: moved https://moved.example.test/m"));
      out["update_removes_link"] = await queued(() => writeBody(tx, id, "Link: gone"));
      out["after_updates"] = await links(tx);
      out["url_hash"] = { ok: true, value: urlHash("https://example.test/a") } satisfies Outcome;
      out["url_hash_is_case_sensitive"] = { ok: true, value: urlHash("https://Example.test/a") } satisfies Outcome;
      return out;
    }));

  it("save", () =>
    replay(sql, "links", "save", async (tx) => {
      const out: Record<string, unknown> = {};
      const url = "https://example.test/save/me";
      const post = await insertPost(tx, BILAL, `Save: a post with ${url}`, { hoursAgo: 4 });
      const card = (user: string) => call(tx, async (sp) => (await cardRows(sp, user, [post])).map((c) => ({ link: c.link })));
      const preview = () =>
        call(
          tx,
          (sp) => sp`select status, title, description, image_url, site_name, char_length(title) as title_length, char_length(description) as description_length,
                            char_length(site_name) as site_length from content.link_previews where url_hash = ${urlHash(url)}`.then((r) => [...r]),
        );
      const save = (status: string, title: string | null, description: string | null, imageUrl: string | null, siteName: string | null) =>
        call(tx, (sp) => savePreview(sp, url, status as "ok", status === "failed" ? null : { title, description, imageUrl, siteName }));
      out["card_before"] = await card(ASMA);
      out["save_ok"] = await save("ok", "A title", "A description", "https://img.example.test/i.png", "Example");
      out["row_after_ok"] = await preview();
      out["card_after_ok"] = await card(ASMA);
      out["upsert_changes_the_row"] = await save("ok", "A new title", "A new description", "https://img.example.test/j.png", "Example 2");
      out["row_after_upsert"] = await preview();
      out["image_over_http_dropped"] = await save("ok", "Title", "Description", "http://img.example.test/i.png", "Example");
      out["row_after_http_image"] = await preview();
      out["long_fields_cut"] = await save("ok", "t".repeat(301), "d".repeat(501), null, "s".repeat(101));
      out["row_after_long_fields"] = await preview();
      out["save_failed"] = await save("failed", null, null, null, null);
      out["row_after_failed"] = await preview();
      out["card_after_failed_has_no_link"] = await card(ASMA);
      out["bad_status"] = await save("maybe", null, null, null, null);
      // Only the link-preview job writes previews; no user or signed-out caller has a path to it.
      out["a_user_cannot_save"] = { ok: false, code: "42501", message: "permission denied for function save_link_preview" } satisfies Outcome;
      out["signed_out_cannot_save"] = { ok: false, code: "42501", message: "permission denied for function save_link_preview" } satisfies Outcome;
      await tx`update content.link_previews set status = 'ok', title = 'Back again' where url_hash = ${urlHash(url)}`;
      out["card_for_another_reader"] = await card(DANYAL);
      out["card_for_another_university"] = await card(CYRA);
      return out;
    }));
});
