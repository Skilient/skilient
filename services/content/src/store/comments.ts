import { appendEvents, rateLimit, uuidv7 } from "@skilient/platform";
import { refused } from "../refusals";
import { canViewPost, canViewProfile, notBlocked, type Db, type Tx } from "./db";

/**
 * Comments, hides (ported from 20260929020000_comments_links.sql, with post_comment_list from _uni_comms and
 * the comment stats trigger from _micro_survey). A comment publishes
 *   comment.created {comment_id, post_id, author_id, post_author_id, parent_author_id, mentioned_ids}
 * for notify (comment_received, comment_reply, comment_mention; W9) and trust (analytics, W10). Today's
 * notifications carried a 120-character excerpt; notify reads it back through content (no text in events).
 */

/** The usernames a comment mentions (`@name`), lower-cased, in order, without repeats. */
export function mentionedUsernames(body: string): string[] {
  return [...new Set([...body.matchAll(/@([a-z0-9_]{3,30})/gi)].map((m) => m[1]!.toLowerCase()))];
}

/** `stats_on_comment`: distinct commenters (not the author, 10+ characters, not deleted) and their universities. */
export async function refreshCommentStats(tx: Tx, postId: string): Promise<void> {
  await tx`
    insert into content.post_stats (post_id, commenters, commenter_universities)
    select ${postId}::uuid, count(distinct c.author_id), count(distinct m.university_id)
      from content.post_comments c
      join content.posts p on p.id = c.post_id
      left join content.members m on m.user_id = c.author_id
     where c.post_id = ${postId} and c.deleted_at is null and c.author_id <> p.author_id and char_length(c.body) >= 10
    on conflict (post_id) do update
      set commenters = excluded.commenters, commenter_universities = excluded.commenter_universities, updated_at = now()`;
}

/**
 * `add_comment`. `mentions` maps the body's usernames to user ids (people's ResolveUsernames, called before
 * the transaction). Returns the new comment's id.
 */
export async function addComment(
  tx: Tx,
  me: string | null,
  postId: string,
  parentId: string | null,
  rawBody: string,
  mentions: ReadonlyMap<string, string>,
  restricted: () => void,
): Promise<string> {
  if (!me) throw refused("not_signed_in");
  const [post] = await tx<{ author_id: string; audience: string; university_id: string | null }[]>`
    select p.author_id::text, p.audience, p.university_id::text from content.posts p where p.id = ${postId} and ${canViewPost(tx, me)}`;
  if (!post) throw refused("no_such_post");
  const body = rawBody.trim();
  if (body.length < 1 || body.length > 1000) throw refused("comment_length");
  let parentAuthor: string | null = null;
  if (parentId) {
    const [parent] = await tx<{ author_id: string; parent_id: string | null; deleted: boolean; blocked: boolean }[]>`
      select c.author_id::text, c.parent_id::text, c.deleted_at is not null as deleted, not ${notBlocked(tx, me, "c.author_id")} as blocked
        from content.post_comments c where c.id = ${parentId} and c.post_id = ${postId}`;
    if (!parent || parent.deleted || parent.blocked) throw refused("comment_gone");
    if (parent.parent_id !== null) throw refused("reply_depth");
    parentAuthor = parent.author_id;
  }
  if (!(await rateLimit(tx, `comment:${me}`, 1, 10))) throw refused("comment_rate_limited");
  restricted();
  const id = uuidv7();
  await tx`insert into content.post_comments (id, post_id, parent_id, author_id, body) values (${id}, ${postId}, ${parentId}, ${me}, ${body})`;
  await refreshCommentStats(tx, postId);

  // @mentions of people who can see the post (at most 5 per comment), not already notified.
  const skip = new Set([me, post.author_id, parentAuthor ?? me]);
  const candidates = [...new Set(mentionedUsernames(body).map((u) => mentions.get(u)).filter((x): x is string => Boolean(x) && !skip.has(x!)))].slice(0, 5);
  const reach = candidates.length
    ? await tx<{ user_id: string }[]>`
        select m.user_id::text from content.members m
         where m.user_id = any(${candidates}::uuid[]) and (${post.audience} = 'global' or m.university_id = ${post.university_id}::uuid)`
    : [];
  const reached = new Set(reach.map((r) => r.user_id));
  await appendEvents(tx, [
    {
      type: "comment.created",
      subjects: [id, postId, me],
      payload: {
        comment_id: id,
        post_id: postId,
        author_id: me,
        post_author_id: post.author_id,
        parent_author_id: parentAuthor !== null && parentAuthor !== post.author_id ? parentAuthor : null,
        mentioned_ids: candidates.filter((c) => reached.has(c)),
      },
    },
  ]);
  return id;
}

/** `delete_comment`: blanks it; its author or the post's author. */
export async function deleteComment(tx: Tx, me: string | null, commentId: string): Promise<void> {
  const [done] = await tx<{ post_id: string }[]>`
    update content.post_comments c set deleted_at = now(), body = '', pinned = false
     where c.id = ${commentId} and c.deleted_at is null
       and (c.author_id = ${me}::uuid or exists (select 1 from content.posts p where p.id = c.post_id and p.author_id = ${me}::uuid))
    returning c.post_id::text`;
  if (!done) throw refused("comment_delete_refused");
  await refreshCommentStats(tx, done.post_id);
}

/** `pin_comment`: one pinned top-level comment per post; the post's author only. */
export async function pinComment(tx: Tx, me: string | null, commentId: string, pin: boolean): Promise<void> {
  const [c] = await tx<{ post_id: string; parent_id: string | null }[]>`
    select c.post_id::text, c.parent_id::text from content.post_comments c join content.posts p on p.id = c.post_id
     where c.id = ${commentId} and p.author_id = ${me}::uuid and c.deleted_at is null`;
  if (!c) throw refused("pin_author_only");
  if (c.parent_id !== null) throw refused("pin_top_level");
  await tx`update content.post_comments set pinned = false where post_id = ${c.post_id} and pinned and id <> ${commentId}`;
  await tx`update content.post_comments set pinned = ${pin} where id = ${commentId}`;
}

/** `hide_post` (and `stats_on_hide`). */
export async function hidePost(tx: Tx, me: string | null, postId: string, hide: boolean): Promise<void> {
  const [post] = await tx`select 1 from content.posts p where p.id = ${postId} and ${canViewPost(tx, me)}`;
  if (!post) throw refused("no_such_post");
  const changed = hide
    ? await tx`insert into content.post_hides (user_id, post_id) values (${me}, ${postId}) on conflict do nothing`
    : await tx`delete from content.post_hides where user_id = ${me}::uuid and post_id = ${postId}`;
  if (changed.count)
    await tx`
      insert into content.post_stats (post_id, hides) values (${postId}, ${hide ? 1 : 0})
      on conflict (post_id) do update set hides = greatest(content.post_stats.hides + ${hide ? 1 : -1}, 0), updated_at = now()`;
}

export interface CommentRow {
  id: string;
  parent_id: string | null;
  body: string;
  pinned: boolean;
  deleted: boolean;
  created_at: Date;
  author_id: string;
  show_name: boolean;
  show_profile: boolean;
  is_mine: boolean;
  can_delete: boolean;
}

/** `post_comment_list`: a post's comments in display order (pinned thread first, then threads oldest first). */
export async function postComments(db: Db, me: string | null, postId: string): Promise<CommentRow[]> {
  if (!me) throw refused("not_signed_in");
  return db<CommentRow[]>`
    select c.id::text, c.parent_id::text,
           case when c.hidden_by_university_at is not null and c.author_id <> ${me}::uuid then '' else c.body end as body,
           c.pinned,
           c.deleted_at is not null or (c.hidden_by_university_at is not null and c.author_id <> ${me}::uuid) as deleted,
           c.created_at, c.author_id::text,
           c.deleted_at is null and c.hidden_by_university_at is null as show_name,
           c.deleted_at is null and c.hidden_by_university_at is null and ${canViewProfile(db, me, "c.author_id")} as show_profile,
           c.author_id = ${me}::uuid as is_mine,
           c.deleted_at is null and (c.author_id = ${me}::uuid or p.author_id = ${me}::uuid) as can_delete
      from content.post_comments c
      join content.posts p on p.id = c.post_id
     where c.post_id = ${postId} and ${canViewPost(db, me)}
       and (c.author_id = ${me}::uuid or ${notBlocked(db, me, "c.author_id")})
     order by coalesce((select pc.pinned from content.post_comments pc where pc.id = coalesce(c.parent_id, c.id)), false) desc,
              coalesce((select pc.created_at from content.post_comments pc where pc.id = c.parent_id), c.created_at),
              c.parent_id nulls first, c.created_at`;
}
