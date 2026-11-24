Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# posts

## private.check_media(p_media jsonb)

[src: supabase/migrations/20260929010000_posts.sql#check_media]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.check_media(p_media jsonb) | plpgsql | true | search_path="" | None | 20260929010000_posts.sql |

## private.create_post(p jsonb)

[src: supabase/migrations/20260929010000_posts.sql#create_post]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.create_post(p jsonb) | plpgsql | true | search_path="" | authenticated | 20260929010000_posts.sql |

## private.delete_post(p_post uuid)

[src: supabase/migrations/20260929010000_posts.sql#delete_post]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.delete_post(p_post uuid) | plpgsql | true | search_path="" | authenticated | 20260929010000_posts.sql |

## private.edit_post(p_post uuid, p_body text)

[src: supabase/migrations/20260929010000_posts.sql#edit_post]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.edit_post(p_post uuid, p_body text) | plpgsql | true | search_path="" | authenticated | 20260929010000_posts.sql |

## private.post_shipped()

[src: supabase/migrations/20260929010000_posts.sql#post_shipped]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.post_shipped() | plpgsql | true | search_path="" | None | 20260929010000_posts.sql |

## private.post_venture_update_media(p_venture uuid, p_body text, p_media jsonb)

[src: supabase/migrations/20260929010000_posts.sql#post_venture_update_media]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.post_venture_update_media(p_venture uuid, p_body text, p_media jsonb) | plpgsql | true | search_path="" | authenticated | 20260929010000_posts.sql |

## private.rsvp_event(p_post uuid, p_status rsvp_status)

[src: supabase/migrations/20260929010000_posts.sql#rsvp_event]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.rsvp_event(p_post uuid, p_status rsvp_status) | plpgsql | true | search_path="" | authenticated | 20260929010000_posts.sql |

## private.vote_poll(p_post uuid, p_position smallint)

[src: supabase/migrations/20260929010000_posts.sql#vote_poll]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.vote_poll(p_post uuid, p_position smallint) | plpgsql | true | search_path="" | authenticated | 20260929010000_posts.sql |

## public.create_post(p jsonb)

[src: supabase/migrations/20260929010000_posts.sql#create_post]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.create_post(p jsonb) | sql | false | search_path="" | authenticated, service_role | 20260929010000_posts.sql |

## public.delete_post(p_post uuid)

[src: supabase/migrations/20260929010000_posts.sql#delete_post]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.delete_post(p_post uuid) | sql | false | search_path="" | authenticated, service_role | 20260929010000_posts.sql |

## public.edit_post(p_post uuid, p_body text)

[src: supabase/migrations/20260929010000_posts.sql#edit_post]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.edit_post(p_post uuid, p_body text) | sql | false | search_path="" | authenticated, service_role | 20260929010000_posts.sql |

## public.list_posts(p_scope text, p_filter text, p_before timestamp with time zone, p_before_id uuid, p_author uuid, p_limit integer)

[src: supabase/migrations/20260929010000_posts.sql#list_posts]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.list_posts(p_scope text, p_filter text, p_before timestamp with time zone, p_before_id uuid, p_author uuid, p_limit integer) | sql | false | search_path="" | authenticated, service_role | 20260929010000_posts.sql |

## public.post_venture_update_media(p_venture uuid, p_body text, p_media jsonb)

[src: supabase/migrations/20260929010000_posts.sql#post_venture_update_media]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.post_venture_update_media(p_venture uuid, p_body text, p_media jsonb) | sql | false | search_path="" | authenticated, service_role | 20260929010000_posts.sql |

## public.rsvp_event(p_post uuid, p_status rsvp_status)

[src: supabase/migrations/20260929010000_posts.sql#rsvp_event]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.rsvp_event(p_post uuid, p_status rsvp_status) | sql | false | search_path="" | authenticated, service_role | 20260929010000_posts.sql |

## public.vote_poll(p_post uuid, p_position smallint)

[src: supabase/migrations/20260929010000_posts.sql#vote_poll]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.vote_poll(p_post uuid, p_position smallint) | sql | false | search_path="" | authenticated, service_role | 20260929010000_posts.sql |

## public.event_rsvps

[src: supabase/migrations/20260929010000_posts.sql#event_rsvps]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| post_id | uuid | true | — |  |  | — |
| user_id | uuid | true | — |  |  | — |
| status | rsvp_status | true | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
event_rsvps_pkey: PRIMARY KEY (post_id, user_id); -- validated: true
```

```sql
event_rsvps_post_id_fkey: FOREIGN KEY (post_id) REFERENCES post_events(post_id) ON DELETE CASCADE; -- validated: true
```

```sql
event_rsvps_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX event_rsvps_pkey ON public.event_rsvps USING btree (post_id, user_id); -- valid: true
```

```sql
CREATE INDEX event_rsvps_user_idx ON public.event_rsvps USING btree (user_id); -- valid: true
```

### Policies

#### event_rsvps.event_rsvps_read_own

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "(user_id = ( SELECT auth.uid() AS uid))",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

### Triggers

```sql
CREATE TRIGGER refuse_if_restricted BEFORE INSERT ON event_rsvps FOR EACH ROW EXECUTE FUNCTION private.refuse_if_restricted(); -- enabled: O
```

## public.poll_options

[src: supabase/migrations/20260929010000_posts.sql#poll_options]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| post_id | uuid | true | — |  |  | — |
| position | smallint | true | — |  |  | — |
| label | text | true | — |  |  | "default" |

### Keys and constraints

```sql
poll_options_label_check: CHECK (char_length(btrim(label)) >= 1 AND char_length(btrim(label)) <= 80); -- validated: true
```

```sql
poll_options_pkey: PRIMARY KEY (post_id, "position"); -- validated: true
```

```sql
poll_options_position_check: CHECK ("position" >= 1 AND "position" <= 4); -- validated: true
```

```sql
poll_options_post_id_fkey: FOREIGN KEY (post_id) REFERENCES post_polls(post_id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX poll_options_pkey ON public.poll_options USING btree (post_id, "position"); -- valid: true
```

### Policies

#### poll_options.poll_options_read

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "private.can_view_post(post_id)",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

### Triggers

None.

## public.poll_votes

[src: supabase/migrations/20260929010000_posts.sql#poll_votes]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| post_id | uuid | true | — |  |  | — |
| user_id | uuid | true | — |  |  | — |
| position | smallint | true | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
poll_votes_pkey: PRIMARY KEY (post_id, user_id); -- validated: true
```

```sql
poll_votes_post_id_fkey: FOREIGN KEY (post_id) REFERENCES post_polls(post_id) ON DELETE CASCADE; -- validated: true
```

```sql
poll_votes_post_id_position_fkey: FOREIGN KEY (post_id, "position") REFERENCES poll_options(post_id, "position") ON DELETE CASCADE; -- validated: true
```

```sql
poll_votes_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX poll_votes_pkey ON public.poll_votes USING btree (post_id, user_id); -- valid: true
```

```sql
CREATE INDEX poll_votes_user_idx ON public.poll_votes USING btree (user_id); -- valid: true
```

### Policies

#### poll_votes.poll_votes_read_own

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "(user_id = ( SELECT auth.uid() AS uid))",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

### Triggers

```sql
CREATE TRIGGER refuse_if_restricted BEFORE INSERT ON poll_votes FOR EACH ROW EXECUTE FUNCTION private.refuse_if_restricted(); -- enabled: O
```

## public.post_events

[src: supabase/migrations/20260929010000_posts.sql#post_events]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| post_id | uuid | true | — |  |  | — |
| starts_at | timestamp with time zone | true | — |  |  | — |
| place | text | false | — |  |  | "default" |
| url | text | false | — |  |  | "default" |

### Keys and constraints

```sql
post_events_check: CHECK (place IS NOT NULL OR url IS NOT NULL); -- validated: true
```

```sql
post_events_pkey: PRIMARY KEY (post_id); -- validated: true
```

```sql
post_events_place_check: CHECK (place IS NULL OR char_length(btrim(place)) >= 2 AND char_length(btrim(place)) <= 120); -- validated: true
```

```sql
post_events_post_id_fkey: FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE; -- validated: true
```

```sql
post_events_url_check: CHECK (url IS NULL OR url ~ '^https://[^\s]+$'::text AND char_length(url) <= 500); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX post_events_pkey ON public.post_events USING btree (post_id); -- valid: true
```

### Policies

#### post_events.post_events_read

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "private.can_view_post(post_id)",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

### Triggers

None.

## public.post_media

[src: supabase/migrations/20260929010000_posts.sql#post_media]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| post_id | uuid | true | — |  |  | — |
| position | smallint | true | — |  |  | — |
| path | text | true | — |  |  | "default" |
| width | integer | true | — |  |  | — |
| height | integer | true | — |  |  | — |

### Keys and constraints

```sql
post_media_height_check: CHECK (height >= 1 AND height <= 4000); -- validated: true
```

```sql
post_media_path_check: CHECK (path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'::text); -- validated: true
```

```sql
post_media_pkey: PRIMARY KEY (post_id, "position"); -- validated: true
```

```sql
post_media_position_check: CHECK ("position" >= 1 AND "position" <= 4); -- validated: true
```

```sql
post_media_post_id_fkey: FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE; -- validated: true
```

```sql
post_media_width_check: CHECK (width >= 1 AND width <= 4000); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX post_media_pkey ON public.post_media USING btree (post_id, "position"); -- valid: true
```

### Policies

#### post_media.post_media_read

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "private.can_view_post(post_id)",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

### Triggers

```sql
CREATE TRIGGER post_media_cleanup AFTER DELETE ON post_media FOR EACH ROW EXECUTE FUNCTION private.post_media_cleanup(); -- enabled: O
```

## public.post_polls

[src: supabase/migrations/20260929010000_posts.sql#post_polls]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| post_id | uuid | true | — |  |  | — |
| closes_at | timestamp with time zone | true | — |  |  | — |

### Keys and constraints

```sql
post_polls_pkey: PRIMARY KEY (post_id); -- validated: true
```

```sql
post_polls_post_id_fkey: FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX post_polls_pkey ON public.post_polls USING btree (post_id); -- valid: true
```

### Policies

#### post_polls.post_polls_read

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "private.can_view_post(post_id)",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

### Triggers

None.

## public.posts

[src: supabase/migrations/20260929010000_posts.sql#posts]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| author_id | uuid | true | — |  |  | — |
| university_id | uuid | false | — |  |  | — |
| audience | post_audience | true | — |  |  | — |
| type | post_type | true | — |  |  | — |
| body | text | true | — |  |  | "default" |
| venture_id | uuid | false | — |  |  | — |
| stage | post_stage | true | 'seed'::post_stage |  |  | — |
| stage_changed_at | timestamp with time zone | true | now() |  |  | — |
| pinned_until | timestamp with time zone | false | — |  |  | — |
| edited_at | timestamp with time zone | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |
| link_url | text | false | — |  |  | "default" |
| removed_at | timestamp with time zone | false | — |  |  | — |
| removed_by | uuid | false | — |  |  | — |
| hidden_by_university_at | timestamp with time zone | false | — |  |  | — |

### Keys and constraints

```sql
posts_author_id_fkey: FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

```sql
posts_body_check: CHECK (char_length(btrim(body)) >= 1 AND char_length(btrim(body)) <= 2000); -- validated: true
```

```sql
posts_check: CHECK ((type = ANY (ARRAY['invite'::post_type, 'shipped'::post_type])) = (venture_id IS NOT NULL)); -- validated: true
```

```sql
posts_check1: CHECK (pinned_until IS NULL OR type = 'announcement'::post_type); -- validated: true
```

```sql
posts_check2: CHECK (university_id IS NOT NULL OR audience = 'global'::post_audience); -- validated: true
```

```sql
posts_link_url_check: CHECK (link_url IS NULL OR char_length(link_url) <= 2000); -- validated: true
```

```sql
posts_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
posts_removed_by_fkey: FOREIGN KEY (removed_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
posts_university_id_fkey: FOREIGN KEY (university_id) REFERENCES universities(id) ON DELETE RESTRICT; -- validated: true
```

```sql
posts_venture_id_fkey: FOREIGN KEY (venture_id) REFERENCES ventures(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE INDEX posts_author_created_idx ON public.posts USING btree (author_id, created_at DESC); -- valid: true
```

```sql
CREATE INDEX posts_global_created_idx ON public.posts USING btree (created_at DESC) WHERE (audience = 'global'::post_audience); -- valid: true
```

```sql
CREATE INDEX posts_pinned_idx ON public.posts USING btree (pinned_until) WHERE (pinned_until IS NOT NULL); -- valid: true
```

```sql
CREATE UNIQUE INDEX posts_pkey ON public.posts USING btree (id); -- valid: true
```

```sql
CREATE INDEX posts_removed_by_idx ON public.posts USING btree (removed_by); -- valid: true
```

```sql
CREATE UNIQUE INDEX posts_shipped_once_idx ON public.posts USING btree (venture_id) WHERE (type = 'shipped'::post_type); -- valid: true
```

```sql
CREATE INDEX posts_university_created_idx ON public.posts USING btree (university_id, created_at DESC); -- valid: true
```

```sql
CREATE INDEX posts_venture_idx ON public.posts USING btree (venture_id) WHERE (venture_id IS NOT NULL); -- valid: true
```

### Policies

#### posts.posts_read

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "((author_id = ( SELECT auth.uid() AS uid)) OR ((stage <> 'held'::post_stage) AND (hidden_by_university_at IS NULL) AND (NOT private.is_blocked_with(author_id)) AND ((audience = 'global'::post_audience) OR (university_id = ( SELECT private.current_university_id() AS current_university_id))) AND ((type <> 'announcement'::post_type) OR (audience = 'global'::post_audience) OR private.announcement_reaches(id))))",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

### Triggers

```sql
CREATE TRIGGER posts_analytics AFTER INSERT ON posts FOR EACH ROW EXECUTE FUNCTION private.analytics_post(); -- enabled: O
```

```sql
CREATE TRIGGER posts_feed_module BEFORE INSERT ON posts FOR EACH ROW EXECUTE FUNCTION private.posts_feed_module(); -- enabled: O
```

```sql
CREATE TRIGGER posts_graduate_guard BEFORE INSERT ON posts FOR EACH ROW EXECUTE FUNCTION private.graduate_post_guard(); -- enabled: O
```

```sql
CREATE TRIGGER posts_keep_university_pin BEFORE UPDATE OF pinned_until ON posts FOR EACH ROW EXECUTE FUNCTION private.keep_university_pin(); -- enabled: O
```

```sql
CREATE TRIGGER posts_link_url BEFORE INSERT OR UPDATE OF body ON posts FOR EACH ROW EXECUTE FUNCTION private.post_link_url(); -- enabled: O
```

```sql
CREATE TRIGGER posts_removed_cleanup AFTER UPDATE OF removed_at ON posts FOR EACH ROW WHEN (old.removed_at IS NULL AND new.removed_at IS NOT NULL) EXECUTE FUNCTION private.post_removed_cleanup(); -- enabled: O
```

```sql
CREATE TRIGGER posts_stats AFTER INSERT ON posts FOR EACH ROW EXECUTE FUNCTION private.stats_on_post(); -- enabled: O
```

```sql
CREATE TRIGGER refuse_if_restricted BEFORE INSERT ON posts FOR EACH ROW EXECUTE FUNCTION private.refuse_if_restricted(); -- enabled: O
```

## public.venture_update_media

[src: supabase/migrations/20260929010000_posts.sql#venture_update_media]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| update_id | uuid | true | — |  |  | — |
| position | smallint | true | — |  |  | — |
| path | text | true | — |  |  | "default" |
| width | integer | true | — |  |  | — |
| height | integer | true | — |  |  | — |

### Keys and constraints

```sql
venture_update_media_height_check: CHECK (height >= 1 AND height <= 4000); -- validated: true
```

```sql
venture_update_media_path_check: CHECK (path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'::text); -- validated: true
```

```sql
venture_update_media_pkey: PRIMARY KEY (update_id, "position"); -- validated: true
```

```sql
venture_update_media_position_check: CHECK ("position" >= 1 AND "position" <= 4); -- validated: true
```

```sql
venture_update_media_update_id_fkey: FOREIGN KEY (update_id) REFERENCES venture_updates(id) ON DELETE CASCADE; -- validated: true
```

```sql
venture_update_media_width_check: CHECK (width >= 1 AND width <= 4000); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX venture_update_media_pkey ON public.venture_update_media USING btree (update_id, "position"); -- valid: true
```

### Policies

#### venture_update_media.venture_update_media_read

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "(EXISTS ( SELECT 1\n   FROM venture_updates u\n  WHERE ((u.id = venture_update_media.update_id) AND private.can_view_venture(u.venture_id))))",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

### Triggers

None.
