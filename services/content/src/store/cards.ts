import type { ApiDeps, PersonCard } from "../deps";
import { refused } from "../refusals";
import { canViewPost, canViewProfile, notBlocked, type Db } from "./db";

/**
 * `post_cards(ids)`: everything a card needs, for the ids given, in their order, skipping any the reader can't
 * see. One query over content's tables; the author's name, username and avatar come from people's
 * ProfileCards, the venture block from work (W5) and the society block from community (W7): one batch call
 * each, made in parallel. Poll counts show once the reader has voted, the poll has closed, or it's theirs.
 */
export interface CardRow {
  id: string;
  type: string;
  audience: string;
  body: string;
  created_at: Date;
  edited_at: Date | null;
  pinned_until: Date | null;
  stage: string;
  author_id: string;
  author_visible: boolean;
  is_mine: boolean;
  can_edit: boolean;
  media: { path: string; width: number; height: number }[];
  event: { starts_at: string; place: string | null; url: string | null; going: number; interested: number; mine: string | null } | null;
  poll: {
    closes_at: string;
    closed: boolean;
    my_vote: number | null;
    total: number;
    options: { position: number; label: string; votes: number | null }[];
  } | null;
  venture_id: string | null;
  comment_count: number;
  link: { url: string; title: string | null; description: string | null; image_url: string | null; site_name: string | null } | null;
  author_muted: boolean;
  society_id: string | null;
}

export async function cardRows(db: Db, me: string | null, ids: readonly string[]): Promise<CardRow[]> {
  if (!me) throw refused("not_signed_in");
  if (ids.length === 0) return [];
  return db<CardRow[]>`
    select p.id::text, p.type, p.audience, p.body, p.created_at, p.edited_at, p.pinned_until, p.stage, p.author_id::text,
           ${canViewProfile(db, me, "p.author_id")} as author_visible,
           p.author_id = ${me}::uuid as is_mine,
           p.author_id = ${me}::uuid and p.type <> 'shipped' and now() < p.created_at + interval '15 minutes' as can_edit,
           coalesce((select jsonb_agg(jsonb_build_object('path', m.path, 'width', m.width, 'height', m.height) order by m.position)
                       from content.post_media m where m.post_id = p.id), '[]'::jsonb) as media,
           (select jsonb_build_object(
                     'starts_at', e.starts_at, 'place', e.place, 'url', e.url,
                     'going', (select count(*) from content.event_rsvps r where r.post_id = e.post_id and r.status = 'going'),
                     'interested', (select count(*) from content.event_rsvps r where r.post_id = e.post_id and r.status = 'interested'),
                     'mine', (select r.status from content.event_rsvps r where r.post_id = e.post_id and r.user_id = ${me}::uuid))
              from content.post_events e where e.post_id = p.id) as event,
           (select jsonb_build_object(
                     'closes_at', pl.closes_at,
                     'closed', now() >= pl.closes_at,
                     'my_vote', mv.position,
                     'total', (select count(*) from content.poll_votes v where v.post_id = pl.post_id),
                     'options', (select jsonb_agg(jsonb_build_object(
                                   'position', o.position, 'label', o.label,
                                   'votes', case when mv.position is not null or now() >= pl.closes_at or p.author_id = ${me}::uuid
                                                 then (select count(*) from content.poll_votes v where v.post_id = o.post_id and v.position = o.position) end)
                                 order by o.position)
                                   from content.poll_options o where o.post_id = pl.post_id))
              from content.post_polls pl
              left join content.poll_votes mv on mv.post_id = pl.post_id and mv.user_id = ${me}::uuid
             where pl.post_id = p.id) as poll,
           p.venture_id::text,
           (select count(*)::int from content.post_comments c
             where c.post_id = p.id and c.deleted_at is null
               and (c.author_id = ${me}::uuid or ${notBlocked(db, me, "c.author_id")})) as comment_count,
           (select jsonb_build_object('url', lp.url, 'title', lp.title, 'description', lp.description,
                                      'image_url', lp.image_url, 'site_name', lp.site_name)
              from content.link_previews lp
             where p.link_url is not null and lp.url_hash = encode(sha256(convert_to(p.link_url, 'UTF8')), 'hex') and lp.status = 'ok') as link,
           exists (select 1 from content.mutes mu where mu.user_id = ${me}::uuid and mu.muted_id = p.author_id) as author_muted,
           p.society_id::text
      from unnest(${ids as string[]}::uuid[]) with ordinality as ids(id, ord)
      join content.posts p on p.id = ids.id
     where ${canViewPost(db, me)}
     order by ids.ord`;
}

export interface Card extends CardRow {
  author_username: string;
  author_name: string;
  author_avatar_path: string;
  venture: unknown;
  society: unknown;
}

/** Card rows joined with the other services' parts (one batch call each, in parallel). */
export async function cards(
  deps: Pick<ApiDeps, "people" | "ventures" | "societies">,
  rows: CardRow[],
  me: string | null,
  call: unknown,
  /** Names already asked for (a first feed page knows its authors before the card query). */
  names?: Promise<Map<string, PersonCard>>,
): Promise<Card[]> {
  if (rows.length === 0) return [];
  const authors = [...new Set(rows.map((r) => r.author_id))];
  const ventures = [...new Set(rows.map((r) => r.venture_id).filter((x): x is string => x !== null))];
  const societies = [...new Set(rows.map((r) => r.society_id).filter((x): x is string => x !== null))];
  const [people, ventureCards, societyCards] = await Promise.all([
    names ?? deps.people.cards(authors, call),
    ventures.length ? deps.ventures.cards(me, ventures, call) : Promise.resolve(new Map<string, unknown>()),
    societies.length ? deps.societies.cards(societies, call) : Promise.resolve(new Map<string, unknown>()),
  ]);
  // Shipped cards list the team (owner first): names from people, in one more batch call for the ids the
  // authors' call didn't cover; a username only where the viewer may open the profile (venture_team's rule).
  type Team = { user_id: string; profile_visible: boolean }[];
  const teamOf = (r: CardRow) => (r.type === "shipped" && r.venture_id ? (((ventureCards.get(r.venture_id) as { team_ids?: Team } | undefined)?.team_ids ?? []) as Team) : []);
  const missing = [...new Set(rows.flatMap((r) => teamOf(r).map((m) => m.user_id)))].filter((id) => !people.has(id));
  const more = missing.length ? await deps.people.cards(missing, call) : new Map<string, PersonCard>();
  const venture = (r: CardRow) => {
    const c = r.venture_id ? (ventureCards.get(r.venture_id) as Record<string, unknown> | undefined) : undefined;
    if (!c) return null;
    const { team_ids: _ids, ...block } = c;
    return {
      ...block,
      team:
        r.type === "shipped"
          ? teamOf(r).map((m) => {
              const p = people.get(m.user_id) ?? more.get(m.user_id);
              return { name: p?.fullName ?? "", username: m.profile_visible ? (p?.username ?? null) : null };
            })
          : null,
    };
  };
  return rows.map((r) => {
    const a = people.get(r.author_id);
    return {
      ...r,
      author_username: a?.username ?? "",
      author_name: a?.fullName ?? "",
      author_avatar_path: r.author_visible ? (a?.avatarPath ?? "") : "",
      venture: venture(r),
      society: r.society_id ? (societyCards.get(r.society_id) ?? null) : null,
    };
  });
}
