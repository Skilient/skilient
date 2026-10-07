Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# cv_control

## private.create_share_link(p_token_hash text, p_label text, p_days integer)

[src: supabase/migrations/20261009000000_cv_control.sql#create_share_link]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.create_share_link(p_token_hash text, p_label text, p_days integer) | plpgsql | true | search_path="" | authenticated | 20261009000000_cv_control.sql |

## private.cv_export_rights()

[src: supabase/migrations/20261009000000_cv_control.sql#cv_export_rights]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.cv_export_rights() | sql | true | search_path="" | authenticated | 20261009000000_cv_control.sql |

## private.cv_export_upload_allowed(p_name text)

[src: supabase/migrations/20261009000000_cv_control.sql#cv_export_upload_allowed]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.cv_export_upload_allowed(p_name text) | sql | true | search_path="" | authenticated | 20261009000000_cv_control.sql |

## private.cv_exports_daily()

[src: supabase/migrations/20261009000000_cv_control.sql#cv_exports_daily]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.cv_exports_daily() | plpgsql | true | search_path="" | None | 20261009000000_cv_control.sql |

## private.cv_issue_commit(p_user uuid, p_code text, p_key_id text, p_issued_at timestamp with time zone, p_expires_at timestamp with time zone, p_snapshot jsonb, p_content_hash text, p_snapshot_hash text, p_signature text, p_source text)

[src: supabase/migrations/20261009000000_cv_control.sql#cv_issue_commit]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.cv_issue_commit(p_user uuid, p_code text, p_key_id text, p_issued_at timestamp with time zone, p_expires_at timestamp with time zone, p_snapshot jsonb, p_content_hash text, p_snapshot_hash text, p_signature text, p_source text) | plpgsql | true | search_path="" | None | 20261009000000_cv_control.sql |

## private.cv_on_ban()

[src: supabase/migrations/20261009000000_cv_control.sql#cv_on_ban]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.cv_on_ban() | plpgsql | true | search_path="" | None | 20261009000000_cv_control.sql |

## private.cv_on_delete()

[src: supabase/migrations/20261009000000_cv_control.sql#cv_on_delete]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.cv_on_delete() | plpgsql | true | search_path="" | None | 20261009000000_cv_control.sql |

## private.cv_refreshed_notice()

[src: supabase/migrations/20261009000000_cv_control.sql#cv_refreshed_notice]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.cv_refreshed_notice() | plpgsql | true | search_path="" | None | 20261009000000_cv_control.sql |

## private.cv_reissue_prepare(p_user uuid)

[src: supabase/migrations/20261009000000_cv_control.sql#cv_reissue_prepare]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.cv_reissue_prepare(p_user uuid) | plpgsql | true | search_path="" | None | 20261009000000_cv_control.sql |

## private.open_shared_cv(p_token_hash text, p_viewer_key text)

[src: supabase/migrations/20261009000000_cv_control.sql#open_shared_cv]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.open_shared_cv(p_token_hash text, p_viewer_key text) | plpgsql | true | search_path="" | anon, authenticated | 20261009000000_cv_control.sql |

## private.ops_cv_records(p_query text)

[src: supabase/migrations/20261009000000_cv_control.sql#ops_cv_records]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_cv_records(p_query text) | plpgsql | true | search_path="" | authenticated | 20261009000000_cv_control.sql |

## private.ops_revoke_cv(p_record uuid, p_all boolean, p_reason text)

[src: supabase/migrations/20261009000000_cv_control.sql#ops_revoke_cv]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_revoke_cv(p_record uuid, p_all boolean, p_reason text) | plpgsql | true | search_path="" | authenticated | 20261009000000_cv_control.sql |

## private.record_cv_export(p_export uuid, p_record uuid, p_template text, p_paper text, p_pdf_hash text, p_bytes integer, p_mac text)

[src: supabase/migrations/20261009000000_cv_control.sql#record_cv_export]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.record_cv_export(p_export uuid, p_record uuid, p_template text, p_paper text, p_pdf_hash text, p_bytes integer, p_mac text) | plpgsql | true | search_path="" | authenticated | 20261009000000_cv_control.sql |

## private.revoke_all_cvs(p_user uuid, p_reason text, p_by uuid)

[src: supabase/migrations/20261009000000_cv_control.sql#revoke_all_cvs]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.revoke_all_cvs(p_user uuid, p_reason text, p_by uuid) | plpgsql | true | search_path="" | None | 20261009000000_cv_control.sql |

## private.revoke_cv(p_record uuid)

[src: supabase/migrations/20261009000000_cv_control.sql#revoke_cv]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.revoke_cv(p_record uuid) | plpgsql | true | search_path="" | authenticated | 20261009000000_cv_control.sql |

## private.revoke_share_link(p_id uuid)

[src: supabase/migrations/20261009000000_cv_control.sql#revoke_share_link]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.revoke_share_link(p_id uuid) | plpgsql | true | search_path="" | authenticated | 20261009000000_cv_control.sql |

## private.save_cv_settings(p_sections text[], p_show_percentile boolean, p_show_email boolean, p_visibility cv_visibility)

[src: supabase/migrations/20261009000000_cv_control.sql#save_cv_settings]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.save_cv_settings(p_sections text[], p_show_percentile boolean, p_show_email boolean, p_visibility cv_visibility) | plpgsql | true | search_path="" | authenticated | 20261009000000_cv_control.sql |

## private.verify_cv(p_code text, p_pdf_hash text)

[src: supabase/migrations/20261009000000_cv_control.sql#verify_cv]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.verify_cv(p_code text, p_pdf_hash text) | sql | true | search_path="" | anon, authenticated | 20261009000000_cv_control.sql |

## public.create_share_link(p_token_hash text, p_label text, p_days integer)

[src: supabase/migrations/20261009000000_cv_control.sql#create_share_link]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.create_share_link(p_token_hash text, p_label text, p_days integer) | sql | false | search_path="" | authenticated, service_role | 20261009000000_cv_control.sql |

## public.cv_export_rights()

[src: supabase/migrations/20261009000000_cv_control.sql#cv_export_rights]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.cv_export_rights() | sql | false | search_path="" | authenticated, service_role | 20261009000000_cv_control.sql |

## public.open_shared_cv(p_token_hash text, p_viewer_key text)

[src: supabase/migrations/20261009000000_cv_control.sql#open_shared_cv]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.open_shared_cv(p_token_hash text, p_viewer_key text) | sql | false | search_path="" | anon, authenticated, service_role | 20261009000000_cv_control.sql |

## public.ops_cv_records(p_query text)

[src: supabase/migrations/20261009000000_cv_control.sql#ops_cv_records]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_cv_records(p_query text) | sql | false | search_path="" | authenticated, service_role | 20261009000000_cv_control.sql |

## public.ops_revoke_cv(p_record uuid, p_all boolean, p_reason text)

[src: supabase/migrations/20261009000000_cv_control.sql#ops_revoke_cv]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_revoke_cv(p_record uuid, p_all boolean, p_reason text) | sql | false | search_path="" | authenticated, service_role | 20261009000000_cv_control.sql |

## public.record_cv_export(p_export uuid, p_record uuid, p_template text, p_paper text, p_pdf_hash text, p_bytes integer, p_mac text)

[src: supabase/migrations/20261009000000_cv_control.sql#record_cv_export]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.record_cv_export(p_export uuid, p_record uuid, p_template text, p_paper text, p_pdf_hash text, p_bytes integer, p_mac text) | sql | false | search_path="" | authenticated, service_role | 20261009000000_cv_control.sql |

## public.revoke_cv(p_record uuid)

[src: supabase/migrations/20261009000000_cv_control.sql#revoke_cv]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.revoke_cv(p_record uuid) | sql | false | search_path="" | authenticated, service_role | 20261009000000_cv_control.sql |

## public.revoke_share_link(p_id uuid)

[src: supabase/migrations/20261009000000_cv_control.sql#revoke_share_link]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.revoke_share_link(p_id uuid) | sql | false | search_path="" | authenticated, service_role | 20261009000000_cv_control.sql |

## public.save_cv_settings(p_sections text[], p_show_percentile boolean, p_show_email boolean, p_visibility cv_visibility)

[src: supabase/migrations/20261009000000_cv_control.sql#save_cv_settings]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.save_cv_settings(p_sections text[], p_show_percentile boolean, p_show_email boolean, p_visibility cv_visibility) | sql | false | search_path="" | authenticated, service_role | 20261009000000_cv_control.sql |

## public.verify_cv(p_code text, p_pdf_hash text)

[src: supabase/migrations/20261009000000_cv_control.sql#verify_cv]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.verify_cv(p_code text, p_pdf_hash text) | sql | false | search_path="" | anon, authenticated, service_role | 20261009000000_cv_control.sql |

## public.cv_pdf_exports

[src: supabase/migrations/20261009000000_cv_control.sql#cv_pdf_exports]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | — |  |  | — |
| record_id | uuid | true | — |  |  | — |
| user_id | uuid | false | — |  |  | — |
| template | text | true | — |  |  | "default" |
| paper | text | true | — |  |  | "default" |
| pdf_hash | text | true | — |  |  | "default" |
| path | text | true | — |  |  | "default" |
| bytes | integer | true | — |  |  | — |
| file_deleted_at | timestamp with time zone | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
cv_pdf_exports_bytes_check: CHECK (bytes > 0); -- validated: true
```

```sql
cv_pdf_exports_paper_check: CHECK (paper = ANY (ARRAY['a4'::text, 'letter'::text])); -- validated: true
```

```sql
cv_pdf_exports_path_check: CHECK (path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$'::text); -- validated: true
```

```sql
cv_pdf_exports_path_key: UNIQUE (path); -- validated: true
```

```sql
cv_pdf_exports_pdf_hash_check: CHECK (pdf_hash ~ '^[0-9a-f]{64}$'::text); -- validated: true
```

```sql
cv_pdf_exports_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
cv_pdf_exports_record_id_fkey: FOREIGN KEY (record_id) REFERENCES cv_records(id); -- validated: true
```

```sql
cv_pdf_exports_template_check: CHECK (template = ANY (ARRAY['standard'::text, 'classic'::text, 'compact'::text, 'modern'::text, 'academic'::text])); -- validated: true
```

```sql
cv_pdf_exports_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

### Indexes

```sql
CREATE INDEX cv_pdf_exports_live_idx ON public.cv_pdf_exports USING btree (created_at) WHERE (file_deleted_at IS NULL); -- valid: true
```

```sql
CREATE UNIQUE INDEX cv_pdf_exports_path_key ON public.cv_pdf_exports USING btree (path); -- valid: true
```

```sql
CREATE UNIQUE INDEX cv_pdf_exports_pkey ON public.cv_pdf_exports USING btree (id); -- valid: true
```

```sql
CREATE INDEX cv_pdf_exports_record_idx ON public.cv_pdf_exports USING btree (record_id, pdf_hash); -- valid: true
```

```sql
CREATE INDEX cv_pdf_exports_user_idx ON public.cv_pdf_exports USING btree (user_id, created_at DESC); -- valid: true
```

### Policies

#### cv_pdf_exports.cv_pdf_exports_owner_read

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
CREATE TRIGGER cv_pdf_exports_analytics AFTER INSERT ON cv_pdf_exports FOR EACH ROW EXECUTE FUNCTION private.analytics_cv_exported(); -- enabled: O
```

## public.cv_share_links

[src: supabase/migrations/20261009000000_cv_control.sql#cv_share_links]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| user_id | uuid | true | — |  |  | — |
| token_hash | text | true | — |  |  | "default" |
| label | text | false | — |  |  | "default" |
| expires_at | timestamp with time zone | false | — |  |  | — |
| revoked_at | timestamp with time zone | false | — |  |  | — |
| revoked_reason | text | false | — |  |  | "default" |
| view_count | integer | true | 0 |  |  | — |
| last_viewed_at | timestamp with time zone | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
cv_share_links_check: CHECK ((revoked_at IS NULL) = (revoked_reason IS NULL)); -- validated: true
```

```sql
cv_share_links_label_check: CHECK (label IS NULL OR char_length(btrim(label)) >= 1 AND char_length(btrim(label)) <= 60); -- validated: true
```

```sql
cv_share_links_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
cv_share_links_revoked_reason_check: CHECK (revoked_reason IS NULL OR (revoked_reason = ANY (ARRAY['owner'::text, 'staff'::text, 'suspended'::text, 'deleted'::text]))); -- validated: true
```

```sql
cv_share_links_token_hash_check: CHECK (token_hash ~ '^[0-9a-f]{64}$'::text); -- validated: true
```

```sql
cv_share_links_token_hash_key: UNIQUE (token_hash); -- validated: true
```

```sql
cv_share_links_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

```sql
cv_share_links_view_count_check: CHECK (view_count >= 0); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX cv_share_links_pkey ON public.cv_share_links USING btree (id); -- valid: true
```

```sql
CREATE UNIQUE INDEX cv_share_links_token_hash_key ON public.cv_share_links USING btree (token_hash); -- valid: true
```

```sql
CREATE INDEX cv_share_links_user_idx ON public.cv_share_links USING btree (user_id, created_at DESC); -- valid: true
```

### Policies

#### cv_share_links.cv_share_links_owner_read

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
CREATE TRIGGER refuse_if_restricted BEFORE INSERT ON cv_share_links FOR EACH ROW EXECUTE FUNCTION private.refuse_if_restricted(); -- enabled: O
```

## public.cv_views

[src: supabase/migrations/20261009000000_cv_control.sql#cv_views]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | bigint | true | — | a |  | — |
| user_id | uuid | true | — |  |  | — |
| record_id | uuid | false | — |  |  | — |
| link_id | uuid | false | — |  |  | — |
| source | text | true | — |  |  | "default" |
| viewer_org_id | uuid | false | — |  |  | — |
| viewer_key | text | true | — |  |  | "default" |
| day | date | true | ((now() AT TIME ZONE 'Asia/Karachi'::text))::date |  |  | — |
| viewed_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
cv_views_link_id_fkey: FOREIGN KEY (link_id) REFERENCES cv_share_links(id) ON DELETE SET NULL; -- validated: true
```

```sql
cv_views_link_id_viewer_key_day_key: UNIQUE (link_id, viewer_key, day); -- validated: true
```

```sql
cv_views_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
cv_views_record_id_fkey: FOREIGN KEY (record_id) REFERENCES cv_records(id) ON DELETE SET NULL; -- validated: true
```

```sql
cv_views_source_check: CHECK (source = ANY (ARRAY['share_link'::text, 'recruiter'::text])); -- validated: true
```

```sql
cv_views_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

```sql
cv_views_viewer_key_check: CHECK (viewer_key ~ '^[0-9a-f]{64}$'::text); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX cv_views_link_id_viewer_key_day_key ON public.cv_views USING btree (link_id, viewer_key, day); -- valid: true
```

```sql
CREATE UNIQUE INDEX cv_views_pkey ON public.cv_views USING btree (id); -- valid: true
```

```sql
CREATE INDEX cv_views_record_idx ON public.cv_views USING btree (record_id); -- valid: true
```

```sql
CREATE INDEX cv_views_user_idx ON public.cv_views USING btree (user_id, viewed_at DESC); -- valid: true
```

### Policies

#### cv_views.cv_views_owner_read

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
