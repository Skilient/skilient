Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# feed_ranking

## private.build_feed(p_viewer uuid, p_audience post_audience, p_filter text, p_exclude uuid[])

[src: supabase/migrations/20260929040000_feed_ranking.sql#build_feed]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.build_feed(p_viewer uuid, p_audience post_audience, p_filter text, p_exclude uuid[]) | plpgsql | true | search_path="" | None | 20260929040000_feed_ranking.sql |

## private.compute_stage(p_post uuid)

[src: supabase/migrations/20260929040000_feed_ranking.sql#compute_stage]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.compute_stage(p_post uuid) | plpgsql | true | search_path="" | None | 20260929040000_feed_ranking.sql |

## private.feed_page(p_audience post_audience, p_filter text, p_cursor text, p_limit integer)

[src: supabase/migrations/20260929040000_feed_ranking.sql#feed_page]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.feed_page(p_audience post_audience, p_filter text, p_cursor text, p_limit integer) | plpgsql | true | search_path="" | authenticated | 20260929040000_feed_ranking.sql |

## private.feed_stage_job()

[src: supabase/migrations/20260929040000_feed_ranking.sql#feed_stage_job]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.feed_stage_job() | plpgsql | true | search_path="" | None | 20260929040000_feed_ranking.sql |

## private.followed_venture_updates(p_limit integer)

[src: supabase/migrations/20260929040000_feed_ranking.sql#followed_venture_updates]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.followed_venture_updates(p_limit integer) | sql | true | search_path="" | authenticated | 20260929040000_feed_ranking.sql |

## private.held_on_reports()

[src: supabase/migrations/20260929040000_feed_ranking.sql#held_on_reports]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.held_on_reports() | plpgsql | true | search_path="" | None | 20260929040000_feed_ranking.sql |

## private.in_seed_audience(p_post uuid, p_viewer uuid)

[src: supabase/migrations/20260929040000_feed_ranking.sql#in_seed_audience]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.in_seed_audience(p_post uuid, p_viewer uuid) | sql | true | search_path="" | None | 20260929040000_feed_ranking.sql |

## private.nonfriend_commenters(p_post uuid)

[src: supabase/migrations/20260929040000_feed_ranking.sql#nonfriend_commenters]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.nonfriend_commenters(p_post uuid) | sql | true | search_path="" | None | 20260929040000_feed_ranking.sql |

## public.feed_page(p_audience post_audience, p_filter text, p_cursor text, p_limit integer)

[src: supabase/migrations/20260929040000_feed_ranking.sql#feed_page]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.feed_page(p_audience post_audience, p_filter text, p_cursor text, p_limit integer) | sql | false | search_path="" | authenticated, service_role | 20260929040000_feed_ranking.sql |

## public.followed_venture_updates(p_limit integer)

[src: supabase/migrations/20260929040000_feed_ranking.sql#followed_venture_updates]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.followed_venture_updates(p_limit integer) | sql | false | search_path="" | authenticated, service_role | 20260929040000_feed_ranking.sql |

## public.pinned_announcement()

[src: supabase/migrations/20260929040000_feed_ranking.sql#pinned_announcement]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.pinned_announcement() | sql | false | search_path="" | authenticated, service_role | 20260929040000_feed_ranking.sql |

## public.feed_sessions

[src: supabase/migrations/20260929040000_feed_ranking.sql#feed_sessions]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| session_id | uuid | true | gen_random_uuid() |  |  | — |
| user_id | uuid | true | — |  |  | — |
| audience | post_audience | true | — |  |  | — |
| filter | text | true | — |  |  | "default" |
| post_ids | uuid[] | true | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
feed_sessions_filter_check: CHECK (filter = ANY (ARRAY['all'::text, 'ventures'::text, 'events'::text, 'announcements'::text, 'shipped'::text])); -- validated: true
```

```sql
feed_sessions_pkey: PRIMARY KEY (session_id); -- validated: true
```

```sql
feed_sessions_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE INDEX feed_sessions_created_idx ON public.feed_sessions USING btree (created_at); -- valid: true
```

```sql
CREATE UNIQUE INDEX feed_sessions_pkey ON public.feed_sessions USING btree (session_id); -- valid: true
```

```sql
CREATE INDEX feed_sessions_user_idx ON public.feed_sessions USING btree (user_id, created_at DESC); -- valid: true
```

### Policies

None.

### Triggers

None.
