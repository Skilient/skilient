import { appendEvents, GLOBAL_FEED, publishRealtime, rateLimit, uuidv7 } from "@skilient/platform";
import { extractLink } from "../domain/links/url";
import { refused } from "../refusals";
import { canViewPost, type Db, type Tx } from "./db";
import { queuePreview } from "./links";

/**
 * Posts (ported from 20260929010000_posts.sql with the later create_post, can_view_post and trigger versions:
 * _comments_links (link_url), _micro_survey (post_stats), _student_portal (graduates), _uni_comms (university
 * pins), _societies ("post as")). Each write publishes what other services act on:
 *   post.created {post_id, author_id, type, audience, university_id, society_id, venture_id}   notify (society
 *     followers, W9), trust (analytics, W10)
 *   post.removed {post_id, author_id, reason, media_paths}   media (unused files, W9), trust
 */
export interface NewPost {
  type: string;
  audience: string;
  body: string;
  media: unknown;
  venture_id: string | null;
  society_id: string | null;
  event: { starts_at: string; place: string; url: string } | null;
  poll: { options: unknown; days: number } | null;
  pin_days: number;
}

export interface CreateChecks {
  /** The token's restriction (refuse_if_restricted on posts); throws when suspended or banned. */
  restricted: () => void;
  /** Staff (a two-factor session with a staff role), asked only for announcements. */
  isStaff: () => Promise<boolean>;
  /** Image paths media has no file for (W9). */
  missing: (paths: string[]) => Promise<string[]>;
}

const TYPES = ["general", "invite", "announcement", "event", "poll", "shipped"] as const;
const AUDIENCES = ["university", "global"] as const;

/** `check_media`: a list of at most 4 images, each in the poster's own folder and uploaded. */
async function checkMedia(me: string, media: unknown, missing: CreateChecks["missing"]): Promise<{ path: string; width: number; height: number }[]> {
  if (!Array.isArray(media)) throw refused("media_not_list");
  if (media.length > 4) throw refused("too_many_images");
  const out = media.map((m: unknown) => {
    const x = (m ?? {}) as Record<string, unknown>;
    return { path: typeof x["path"] === "string" ? x["path"] : "", width: Number(x["width"]), height: Number(x["height"]) };
  });
  if (out.some((m) => m.path.split("/")[0] !== me)) throw refused("image_missing");
  if (out.length && (await missing(out.map((m) => m.path))).length) throw refused("image_missing");
  return out;
}

/** `create_post`. Returns the new post's id. */
export async function createPost(tx: Tx, me: string | null, p: NewPost, checks: CreateChecks): Promise<string> {
  if (!me) throw refused("not_signed_in");
  const [member] = await tx<{ university_id: string | null; status: string | null }[]>`
    select university_id::text, status from content.members where user_id = ${me} and onboarding_complete`;
  if (!member) throw refused("finish_onboarding");
  let universityId = member.university_id;
  if (!(TYPES as readonly string[]).includes(p.type) || !(AUDIENCES as readonly string[]).includes(p.audience || "university")) throw refused("unknown_type");
  const type = p.type as (typeof TYPES)[number];
  let audience = (p.audience || "university") as (typeof AUDIENCES)[number];
  if (type === "shipped") throw refused("shipped_refused");
  const body = p.body.trim();
  if (body.length < 1 || body.length > 2000) throw refused("post_length");
  const media = await checkMedia(me, p.media, checks.missing);
  if (media.length > 0 && !["general", "invite", "event"].includes(type)) throw refused("images_wrong_type");

  let societyId: string | null = null;
  if (p.society_id) {
    const [s] = await tx<{ university_id: string }[]>`
      select s.university_id::text from content.societies s
       where s.society_id = ${p.society_id} and s.status = 'verified'
         and exists (select 1 from content.group_members g where g.kind = 'society' and g.group_id = s.society_id
                        and g.user_id = ${me} and g.role in ('officer', 'president'))`;
    if (!s) throw refused("officers_only");
    if (!["general", "event", "poll"].includes(type)) throw refused("society_post_type");
    audience = "university";
    universityId = s.university_id;
    societyId = p.society_id;
  }
  if (type === "event" && !societyId) throw refused("events_by_societies");

  let pinDays = 0;
  if (type === "announcement") {
    if (!(await checks.isStaff())) throw refused("staff_announcements");
    audience = "global";
    pinDays = Math.min(p.pin_days > 0 ? p.pin_days : 0, 7);
  }

  let ventureId: string | null = null;
  if (type === "invite") {
    const [v] = p.venture_id
      ? await tx<{ owner_id: string; status: string; visibility: string }[]>`
          select owner_id::text, status, visibility from content.ventures where venture_id = ${p.venture_id} for share`
      : [];
    if (!v || v.owner_id !== me) throw refused("invite_owner_only");
    if (!["recruiting", "in_progress"].includes(v.status)) throw refused("venture_not_recruiting");
    if (v.visibility === "unlisted") throw refused("venture_unlisted");
    if (v.visibility === "university" && audience === "global") throw refused("venture_university_only");
    ventureId = p.venture_id;
  }

  let startsAt: Date | null = null;
  if (type === "event") {
    startsAt = p.event?.starts_at ? new Date(p.event.starts_at) : null;
    if (!startsAt || Number.isNaN(startsAt.getTime())) throw refused("event_needs_time");
    const [ok] = await tx<{ ok: boolean }[]>`select ${startsAt} >= now() - interval '1 hour' and ${startsAt} <= now() + interval '1 year' as ok`;
    if (!ok?.ok) throw refused("event_within_year");
  }

  let options: string[] = [];
  if (type === "poll") {
    const raw = p.poll?.options;
    if (!Array.isArray(raw) || raw.length < 2 || raw.length > 4) throw refused("poll_options");
    if (!p.poll || !(p.poll.days >= 1 && p.poll.days <= 7)) throw refused("poll_days");
    options = raw.map((o) => String(o).trim());
  }

  if (!(await rateLimit(tx, `post:${me}`, 1, 30))) throw refused("post_rate_limited");
  // The insert's triggers, in their firing order: graduate_post_guard (phase 6: graduates post to the Global
  // Feed only), then refuse_if_restricted (the token's restriction).
  if (audience === "university" && member.status === "graduate") throw refused("graduates_global_only");
  checks.restricted();

  const id = uuidv7();
  const link = extractLink(body);
  await tx`
    insert into content.posts (id, author_id, university_id, audience, type, body, venture_id, society_id, pinned_until, link_url)
    values (${id}, ${me}, ${universityId}, ${audience}, ${type}, ${body}, ${ventureId}, ${societyId},
            ${pinDays > 0 ? tx`now() + make_interval(days => ${pinDays})` : null}, ${link})`;
  if (pinDays > 0)
    // One pinned platform announcement at a time; a university's own pin stays (keep_university_pin).
    await tx`update content.posts set pinned_until = null
              where pinned_until is not null and id <> ${id} and not (audience = 'university' and type = 'announcement')`;
  if (media.length)
    await tx`insert into content.post_media ${tx(media.map((m, i) => ({ post_id: id, position: i + 1, path: m.path, width: m.width, height: m.height })))}`;
  if (type === "event")
    await tx`insert into content.post_events (post_id, starts_at, place, url)
             values (${id}, ${startsAt}, ${p.event!.place.trim() || null}, ${p.event!.url.trim() || null})`;
  if (type === "poll") {
    await tx`insert into content.post_polls (post_id, closes_at) values (${id}, now() + make_interval(days => ${p.poll!.days}))`;
    await tx`insert into content.poll_options ${tx(options.map((label, i) => ({ post_id: id, position: i + 1, label })))}`;
  }
  await tx`insert into content.post_stats (post_id) values (${id})`;
  if (link) await queuePreview(tx, link);
  await appendEvents(tx, [
    {
      type: "post.created",
      subjects: [id, me],
      payload: { post_id: id, author_id: me, type, audience, university_id: universityId, society_id: societyId, venture_id: ventureId },
    },
  ]);
  // The new-posts pill (W4): readers of this feed hear that a post arrived; the pill loads it.
  await publishRealtime(tx, { topic: `feed:${audience === "global" ? GLOBAL_FEED : universityId}`, event: "post.created", payload: { post_id: id, author_id: me } });
  return id;
}

/** `edit_post`: the author, within 15 minutes, not a Shipped post. The link is read again from the new text. */
export async function editPost(tx: Tx, me: string | null, postId: string, body: string): Promise<void> {
  const [post] = await tx<{ type: string; open: boolean; link_url: string | null }[]>`
    select type, now() < created_at + interval '15 minutes' as open, link_url from content.posts
     where id = ${postId} and author_id = ${me}::uuid for update`;
  if (!post || post.type === "shipped") throw refused("edit_own_only");
  if (!post.open) throw refused("edit_window");
  const text = body.trim();
  if (text.length < 1 || text.length > 2000) throw refused("post_length");
  const link = extractLink(text);
  await tx`update content.posts set body = ${text}, edited_at = now(), link_url = ${link} where id = ${postId}`;
  if (link && link !== post.link_url) await queuePreview(tx, link);
}

/** `delete_post`: the author's own, not a Shipped post. Returns its image paths. */
export async function deletePost(tx: Tx, me: string | null, postId: string): Promise<string[]> {
  const paths = await tx<{ path: string }[]>`select path from content.post_media where post_id = ${postId} order by position`;
  const gone = await tx`delete from content.posts where id = ${postId} and author_id = ${me}::uuid and type <> 'shipped'`;
  if (gone.count !== 1) throw refused("delete_own_only");
  const media = paths.map((r) => r.path);
  await appendEvents(tx, [{ type: "post.removed", subjects: [postId, me!], payload: { post_id: postId, author_id: me, reason: "deleted", media_paths: media } }]);
  return media;
}

/** `vote_poll`. */
export async function votePoll(tx: Tx, me: string | null, postId: string, position: number, restricted: () => void): Promise<void> {
  const [poll] = await tx<{ open: boolean; has: boolean }[]>`
    select now() < pl.closes_at as open,
           exists (select 1 from content.poll_options o where o.post_id = pl.post_id and o.position = ${position}) as has
      from content.posts p join content.post_polls pl on pl.post_id = p.id
     where p.id = ${postId} and ${canViewPost(tx, me)}`;
  if (!poll) throw refused("no_such_poll");
  if (!poll.open) throw refused("poll_closed");
  if (!poll.has) throw refused("poll_option");
  restricted();
  const done = await tx`insert into content.poll_votes (post_id, user_id, position) values (${postId}, ${me}, ${position}) on conflict do nothing`;
  if (done.count !== 1) throw refused("already_voted");
}

/** `rsvp_event(post, status)`: going, interested, or cleared (null). */
export async function rsvpEvent(tx: Tx, me: string | null, postId: string, status: "going" | "interested" | null, restricted: () => void): Promise<void> {
  const [e] = await tx<{ past: boolean }[]>`
    select e.starts_at < now() - interval '6 hours' as past
      from content.posts p join content.post_events e on e.post_id = p.id
     where p.id = ${postId} and ${canViewPost(tx, me)}`;
  if (!e) throw refused("no_such_event");
  if (e.past) throw refused("event_over");
  if (status === null) {
    await tx`delete from content.event_rsvps where post_id = ${postId} and user_id = ${me}`;
    return;
  }
  restricted();
  await tx`
    insert into content.event_rsvps (post_id, user_id, status) values (${postId}, ${me}, ${status})
    on conflict (post_id, user_id) do update set status = excluded.status, created_at = now()`;
}

export interface ListArgs {
  scope: string;
  filter: string;
  before: string | null;
  beforeId: string | null;
  author: string | null;
  limit: number | null;
}

/** `list_posts`: newest first, (created_at, id) cursor. */
/** created_at is the exact time as text (microseconds), so it works as the next page's cursor. */
export async function listPosts(db: Db, me: string | null, a: ListArgs): Promise<{ id: string; created_at: string }[]> {
  if (!me) throw refused("not_signed_in");
  const scope =
    a.scope === "university"
      ? db`p.university_id = (select m.university_id from content.members m where m.user_id = ${me}::uuid)`
      : a.scope === "global"
        ? db`p.audience = 'global'`
        : a.scope === "author"
          ? db`p.author_id = ${a.author}::uuid`
          : db`false`;
  const type = { ventures: "invite", events: "event", announcements: "announcement", shipped: "shipped" }[a.filter || "all"];
  const limit = Math.min(Math.max(a.limit ?? 20, 1), 50);
  return db<{ id: string; created_at: string }[]>`
    select p.id::text, to_json(p.created_at) #>> '{}' as created_at from content.posts p
     where ${canViewPost(db, me)} and ${scope}
       and (${a.scope} = 'author' or not exists (select 1 from content.post_hides h where h.user_id = ${me}::uuid and h.post_id = p.id))
       and (${a.scope} = 'author' or not exists (select 1 from content.mutes m where m.user_id = ${me}::uuid and m.muted_id = p.author_id))
       and (${type ?? null}::text is null or p.type = ${type ?? null}::text)
       and (${a.before}::text is null
            or (p.created_at, p.id) < (${a.before}::text::timestamptz, coalesce(${a.beforeId}::uuid, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
     order by p.created_at desc, p.id desc
     limit ${limit}`;
}

/** `pinned_announcement` (platform) or `pinned_university_announcement` (the reader's university). */
export async function pinnedAnnouncement(db: Db, me: string | null, university: boolean): Promise<string | null> {
  if (!me) throw refused("not_signed_in");
  const where = university
    ? db`p.audience = 'university' and p.type = 'announcement' and p.university_id = (select m.university_id from content.members m where m.user_id = ${me}::uuid)`
    : db`p.audience = 'global'`;
  const [row] = await db<{ id: string }[]>`
    select p.id::text from content.posts p
     where p.pinned_until > now() and ${where} and ${canViewPost(db, me)}
       and not exists (select 1 from content.post_hides h where h.user_id = ${me}::uuid and h.post_id = p.id)
     order by p.created_at desc limit 1`;
  return row?.id ?? null;
}
