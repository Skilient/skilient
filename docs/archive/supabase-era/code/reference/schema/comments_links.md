Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# comments_links

## private.add_comment(p_post uuid, p_parent uuid, p_body text)

[src: supabase/migrations/20260929020000_comments_links.sql#add_comment]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.add_comment(p_post uuid, p_parent uuid, p_body text) | plpgsql | true | search_path="" | authenticated | 20260929020000_comments_links.sql |

## private.check_comment_parent()

[src: supabase/migrations/20260929020000_comments_links.sql#check_comment_parent]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.check_comment_parent() | plpgsql | false | search_path="" | None | 20260929020000_comments_links.sql |

## private.delete_comment(p_comment uuid)

[src: supabase/migrations/20260929020000_comments_links.sql#delete_comment]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.delete_comment(p_comment uuid) | plpgsql | true | search_path="" | authenticated | 20260929020000_comments_links.sql |

## private.hide_post(p_post uuid, p_hide boolean)

[src: supabase/migrations/20260929020000_comments_links.sql#hide_post]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.hide_post(p_post uuid, p_hide boolean) | plpgsql | true | search_path="" | authenticated | 20260929020000_comments_links.sql |

## private.list_posts(p_scope text, p_filter text, p_before timestamp with time zone, p_before_id uuid, p_author uuid, p_limit integer)

[src: supabase/migrations/20260929020000_comments_links.sql#list_posts]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.list_posts(p_scope text, p_filter text, p_before timestamp with time zone, p_before_id uuid, p_author uuid, p_limit integer) | sql | true | search_path="" | authenticated | 20260929020000_comments_links.sql |

## private.mute_user(p_username text, p_mute boolean)

[src: supabase/migrations/20260929020000_comments_links.sql#mute_user]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.mute_user(p_username text, p_mute boolean) | plpgsql | true | search_path="" | authenticated | 20260929020000_comments_links.sql |

## private.my_mutes()

[src: supabase/migrations/20260929020000_comments_links.sql#my_mutes]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.my_mutes() | sql | true | search_path="" | authenticated | 20260929020000_comments_links.sql |

## private.pin_comment(p_comment uuid, p_pin boolean)

[src: supabase/migrations/20260929020000_comments_links.sql#pin_comment]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.pin_comment(p_comment uuid, p_pin boolean) | plpgsql | true | search_path="" | authenticated | 20260929020000_comments_links.sql |

## private.post_cards(p_ids uuid[])

[src: supabase/migrations/20260929020000_comments_links.sql#post_cards]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.post_cards(p_ids uuid[]) | sql | true | search_path="" | authenticated | 20260929020000_comments_links.sql |

## private.post_link_url()

[src: supabase/migrations/20260929020000_comments_links.sql#post_link_url]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.post_link_url() | plpgsql | true | search_path="" | None | 20260929020000_comments_links.sql |

## private.save_link_preview(p_url text, p_status text, p_title text, p_description text, p_image_url text, p_site_name text)

[src: supabase/migrations/20260929020000_comments_links.sql#save_link_preview]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.save_link_preview(p_url text, p_status text, p_title text, p_description text, p_image_url text, p_site_name text) | sql | true | search_path="" | None | 20260929020000_comments_links.sql |

## private.url_hash(p_url text)

[src: supabase/migrations/20260929020000_comments_links.sql#url_hash]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.url_hash(p_url text) | sql | false | search_path="" | None | 20260929020000_comments_links.sql |

## private.wake_link_preview_worker()

[src: supabase/migrations/20260929020000_comments_links.sql#wake_link_preview_worker]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.wake_link_preview_worker() | plpgsql | true | search_path="" | None | 20260929020000_comments_links.sql |

## public.add_comment(p_post uuid, p_parent uuid, p_body text)

[src: supabase/migrations/20260929020000_comments_links.sql#add_comment]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.add_comment(p_post uuid, p_parent uuid, p_body text) | sql | false | search_path="" | authenticated, service_role | 20260929020000_comments_links.sql |

## public.delete_comment(p_comment uuid)

[src: supabase/migrations/20260929020000_comments_links.sql#delete_comment]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.delete_comment(p_comment uuid) | sql | false | search_path="" | authenticated, service_role | 20260929020000_comments_links.sql |

## public.hide_post(p_post uuid, p_hide boolean)

[src: supabase/migrations/20260929020000_comments_links.sql#hide_post]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.hide_post(p_post uuid, p_hide boolean) | sql | false | search_path="" | authenticated, service_role | 20260929020000_comments_links.sql |

## public.mute_user(p_username text, p_mute boolean)

[src: supabase/migrations/20260929020000_comments_links.sql#mute_user]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.mute_user(p_username text, p_mute boolean) | sql | false | search_path="" | authenticated, service_role | 20260929020000_comments_links.sql |

## public.my_mutes()

[src: supabase/migrations/20260929020000_comments_links.sql#my_mutes]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.my_mutes() | sql | false | search_path="" | authenticated, service_role | 20260929020000_comments_links.sql |

## public.pin_comment(p_comment uuid, p_pin boolean)

[src: supabase/migrations/20260929020000_comments_links.sql#pin_comment]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.pin_comment(p_comment uuid, p_pin boolean) | sql | false | search_path="" | authenticated, service_role | 20260929020000_comments_links.sql |

## public.post_cards(p_ids uuid[])

[src: supabase/migrations/20260929020000_comments_links.sql#post_cards]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.post_cards(p_ids uuid[]) | sql | false | search_path="" | authenticated, service_role | 20260929020000_comments_links.sql |

## public.post_comment_list(p_post uuid)

[src: supabase/migrations/20260929020000_comments_links.sql#post_comment_list]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.post_comment_list(p_post uuid) | sql | false | search_path="" | authenticated, service_role | 20260929020000_comments_links.sql |

## public.link_previews

[src: supabase/migrations/20260929020000_comments_links.sql#link_previews]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| url_hash | text | true | — |  |  | "default" |
| url | text | true | — |  |  | "default" |
| status | text | true | — |  |  | "default" |
| title | text | false | — |  |  | "default" |
| description | text | false | — |  |  | "default" |
| image_url | text | false | — |  |  | "default" |
| site_name | text | false | — |  |  | "default" |
| fetched_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
link_previews_description_check: CHECK (char_length(description) <= 500); -- validated: true
```

```sql
link_previews_image_url_check: CHECK (image_url IS NULL OR image_url ~ '^https://'::text AND char_length(image_url) <= 2000); -- validated: true
```

```sql
link_previews_pkey: PRIMARY KEY (url_hash); -- validated: true
```

```sql
link_previews_site_name_check: CHECK (char_length(site_name) <= 100); -- validated: true
```

```sql
link_previews_status_check: CHECK (status = ANY (ARRAY['ok'::text, 'failed'::text])); -- validated: true
```

```sql
link_previews_title_check: CHECK (char_length(title) <= 300); -- validated: true
```

```sql
link_previews_url_check: CHECK (char_length(url) <= 2000); -- validated: true
```

```sql
link_previews_url_hash_check: CHECK (url_hash ~ '^[0-9a-f]{64}$'::text); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX link_previews_pkey ON public.link_previews USING btree (url_hash); -- valid: true
```

### Policies

#### link_previews.link_previews_read

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "true",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

### Triggers

None.

## public.post_comments

[src: supabase/migrations/20260929020000_comments_links.sql#post_comments]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| post_id | uuid | true | — |  |  | — |
| parent_id | uuid | false | — |  |  | — |
| author_id | uuid | true | — |  |  | — |
| body | text | true | — |  |  | "default" |
| pinned | boolean | true | false |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |
| deleted_at | timestamp with time zone | false | — |  |  | — |
| removed_by | uuid | false | — |  |  | — |
| hidden_by_university_at | timestamp with time zone | false | — |  |  | — |

### Keys and constraints

```sql
post_comments_author_id_fkey: FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

```sql
post_comments_body_check: CHECK (char_length(body) <= 1000); -- validated: true
```

```sql
post_comments_check: CHECK (deleted_at IS NOT NULL OR char_length(btrim(body)) >= 1); -- validated: true
```

```sql
post_comments_check1: CHECK (NOT pinned OR parent_id IS NULL); -- validated: true
```

```sql
post_comments_parent_id_fkey: FOREIGN KEY (parent_id) REFERENCES post_comments(id) ON DELETE CASCADE; -- validated: true
```

```sql
post_comments_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
post_comments_post_id_fkey: FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE; -- validated: true
```

```sql
post_comments_removed_by_fkey: FOREIGN KEY (removed_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

### Indexes

```sql
CREATE INDEX post_comments_author_idx ON public.post_comments USING btree (author_id); -- valid: true
```

```sql
CREATE UNIQUE INDEX post_comments_one_pin_idx ON public.post_comments USING btree (post_id) WHERE pinned; -- valid: true
```

```sql
CREATE INDEX post_comments_parent_idx ON public.post_comments USING btree (parent_id) WHERE (parent_id IS NOT NULL); -- valid: true
```

```sql
CREATE UNIQUE INDEX post_comments_pkey ON public.post_comments USING btree (id); -- valid: true
```

```sql
CREATE INDEX post_comments_post_idx ON public.post_comments USING btree (post_id, created_at); -- valid: true
```

```sql
CREATE INDEX post_comments_removed_by_idx ON public.post_comments USING btree (removed_by); -- valid: true
```

### Policies

#### post_comments.post_comments_read

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "(private.can_view_post(post_id) AND ((author_id = ( SELECT auth.uid() AS uid)) OR ((NOT private.is_blocked_with(author_id)) AND (hidden_by_university_at IS NULL))))",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

### Triggers

```sql
CREATE TRIGGER post_comments_analytics AFTER INSERT ON post_comments FOR EACH ROW EXECUTE FUNCTION private.analytics_comment(); -- enabled: O
```

```sql
CREATE TRIGGER post_comments_parent BEFORE INSERT OR UPDATE OF parent_id ON post_comments FOR EACH ROW EXECUTE FUNCTION private.check_comment_parent(); -- enabled: O
```

```sql
CREATE TRIGGER post_comments_stats AFTER INSERT OR UPDATE OF deleted_at ON post_comments FOR EACH ROW EXECUTE FUNCTION private.stats_on_comment(); -- enabled: O
```

```sql
CREATE TRIGGER refuse_if_restricted BEFORE INSERT ON post_comments FOR EACH ROW EXECUTE FUNCTION private.refuse_if_restricted(); -- enabled: O
```

## public.post_hides

[src: supabase/migrations/20260929020000_comments_links.sql#post_hides]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| user_id | uuid | true | — |  |  | — |
| post_id | uuid | true | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
post_hides_pkey: PRIMARY KEY (user_id, post_id); -- validated: true
```

```sql
post_hides_post_id_fkey: FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE; -- validated: true
```

```sql
post_hides_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX post_hides_pkey ON public.post_hides USING btree (user_id, post_id); -- valid: true
```

```sql
CREATE INDEX post_hides_post_idx ON public.post_hides USING btree (post_id); -- valid: true
```

### Policies

#### post_hides.post_hides_read_own

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
CREATE TRIGGER post_hides_stats AFTER INSERT OR DELETE ON post_hides FOR EACH ROW EXECUTE FUNCTION private.stats_on_hide(); -- enabled: O
```

## public.user_mutes

[src: supabase/migrations/20260929020000_comments_links.sql#user_mutes]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| user_id | uuid | true | — |  |  | — |
| muted_id | uuid | true | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
user_mutes_check: CHECK (user_id <> muted_id); -- validated: true
```

```sql
user_mutes_muted_id_fkey: FOREIGN KEY (muted_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

```sql
user_mutes_pkey: PRIMARY KEY (user_id, muted_id); -- validated: true
```

```sql
user_mutes_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE INDEX user_mutes_muted_idx ON public.user_mutes USING btree (muted_id); -- valid: true
```

```sql
CREATE UNIQUE INDEX user_mutes_pkey ON public.user_mutes USING btree (user_id, muted_id); -- valid: true
```

### Policies

#### user_mutes.user_mutes_read_own

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

None.
