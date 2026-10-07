Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# github_connect

## private.claim_github_link_ticket(p_ticket uuid)

[src: supabase/migrations/20260927224500_github_connect.sql#claim_github_link_ticket]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.claim_github_link_ticket(p_ticket uuid) | plpgsql | true | search_path="" | None | 20260927224500_github_connect.sql |

## private.classify_repo(p_user uuid, p_repo_id bigint, p_github_owner_id bigint, p_fork boolean, p_parent_full_name text, p_template_full_name text)

[src: supabase/migrations/20260927224500_github_connect.sql#classify_repo]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.classify_repo(p_user uuid, p_repo_id bigint, p_github_owner_id bigint, p_fork boolean, p_parent_full_name text, p_template_full_name text) | plpgsql | true | search_path="" | None | 20260927224500_github_connect.sql |

## private.complete_github_link(p_ticket uuid, p_github_id bigint, p_login text, p_access_token text, p_access_expires_at timestamp with time zone, p_refresh_token text, p_refresh_expires_at timestamp with time zone, p_installations jsonb)

[src: supabase/migrations/20260927224500_github_connect.sql#complete_github_link]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.complete_github_link(p_ticket uuid, p_github_id bigint, p_login text, p_access_token text, p_access_expires_at timestamp with time zone, p_refresh_token text, p_refresh_expires_at timestamp with time zone, p_installations jsonb) | plpgsql | true | search_path="" | None | 20260927224500_github_connect.sql |

## private.disconnect_github()

[src: supabase/migrations/20260927224500_github_connect.sql#disconnect_github]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.disconnect_github() | plpgsql | true | search_path="" | authenticated | 20260927224500_github_connect.sql |

## private.enqueue_github(p_message jsonb, p_delay integer)

[src: supabase/migrations/20260927224500_github_connect.sql#enqueue_github]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.enqueue_github(p_message jsonb, p_delay integer) | sql | true | search_path="" | service_role | 20260927224500_github_connect.sql |

## private.fail_github_link(p_ticket uuid)

[src: supabase/migrations/20260927224500_github_connect.sql#fail_github_link]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.fail_github_link(p_ticket uuid) | sql | true | search_path="" | None | 20260927224500_github_connect.sql |

## private.finish_github_revocation(p_id bigint)

[src: supabase/migrations/20260927224500_github_connect.sql#finish_github_revocation]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.finish_github_revocation(p_id bigint) | plpgsql | true | search_path="" | None | 20260927224500_github_connect.sql |

## private.github_tokens_revoke()

[src: supabase/migrations/20260927224500_github_connect.sql#github_tokens_revoke]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.github_tokens_revoke() | plpgsql | true | search_path="" | None | 20260927224500_github_connect.sql |

## private.mark_github_revoked(p_user uuid)

[src: supabase/migrations/20260927224500_github_connect.sql#mark_github_revoked]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.mark_github_revoked(p_user uuid) | plpgsql | true | search_path="" | None | 20260927224500_github_connect.sql |

## private.purge_github_data()

[src: supabase/migrations/20260927224500_github_connect.sql#purge_github_data]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.purge_github_data() | plpgsql | true | search_path="" | None | 20260927224500_github_connect.sql |

## private.put_secret(p_id uuid, p_secret text)

[src: supabase/migrations/20260927224500_github_connect.sql#put_secret]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.put_secret(p_id uuid, p_secret text) | plpgsql | true | search_path="" | None | 20260927224500_github_connect.sql |

## private.record_github_webhook(p_delivery_id uuid, p_event text, p_action text, p_installation_id bigint, p_payload jsonb)

[src: supabase/migrations/20260927224500_github_connect.sql#record_github_webhook]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.record_github_webhook(p_delivery_id uuid, p_event text, p_action text, p_installation_id bigint, p_payload jsonb) | plpgsql | true | search_path="" | service_role | 20260927224500_github_connect.sql |

## private.remove_github_data(p_user uuid)

[src: supabase/migrations/20260927224500_github_connect.sql#remove_github_data]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.remove_github_data(p_user uuid) | plpgsql | true | search_path="" | None | 20260927224500_github_connect.sql |

## private.request_github_resync()

[src: supabase/migrations/20260927224500_github_connect.sql#request_github_resync]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.request_github_resync() | plpgsql | true | search_path="" | authenticated | 20260927224500_github_connect.sql |

## private.start_github_link(p_code text, p_installation_id bigint)

[src: supabase/migrations/20260927224500_github_connect.sql#start_github_link]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.start_github_link(p_code text, p_installation_id bigint) | plpgsql | true | search_path="" | authenticated | 20260927224500_github_connect.sql |

## private.store_github_tokens(p_user uuid, p_access_token text, p_access_expires_at timestamp with time zone, p_refresh_token text, p_refresh_expires_at timestamp with time zone)

[src: supabase/migrations/20260927224500_github_connect.sql#store_github_tokens]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.store_github_tokens(p_user uuid, p_access_token text, p_access_expires_at timestamp with time zone, p_refresh_token text, p_refresh_expires_at timestamp with time zone) | plpgsql | true | search_path="" | None | 20260927224500_github_connect.sql |

## private.sync_user_installations(p_user uuid, p_installations jsonb)

[src: supabase/migrations/20260927224500_github_connect.sql#sync_user_installations]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.sync_user_installations(p_user uuid, p_installations jsonb) | plpgsql | true | search_path="" | None | 20260927224500_github_connect.sql |

## private.update_sync_job(p_job bigint, p_stage text, p_repos_total integer, p_repos_done_increment integer, p_finish sync_status, p_error text)

[src: supabase/migrations/20260927224500_github_connect.sql#update_sync_job]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.update_sync_job(p_job bigint, p_stage text, p_repos_total integer, p_repos_done_increment integer, p_finish sync_status, p_error text) | plpgsql | true | search_path="" | None | 20260927224500_github_connect.sql |

## private.upsert_discovered_repos(p_user uuid, p_installation_id bigint, p_repos jsonb)

[src: supabase/migrations/20260927224500_github_connect.sql#upsert_discovered_repos]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.upsert_discovered_repos(p_user uuid, p_installation_id bigint, p_repos jsonb) | plpgsql | true | search_path="" | None | 20260927224500_github_connect.sql |

## private.wake_github_worker()

[src: supabase/migrations/20260927224500_github_connect.sql#wake_github_worker]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.wake_github_worker() | plpgsql | true | search_path="" | None | 20260927224500_github_connect.sql |

## public.disconnect_github()

[src: supabase/migrations/20260927224500_github_connect.sql#disconnect_github]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.disconnect_github() | sql | false | search_path="" | authenticated, service_role | 20260927224500_github_connect.sql |

## public.record_github_webhook(p_delivery_id uuid, p_event text, p_payload jsonb, p_action text, p_installation_id bigint)

[src: supabase/migrations/20260927224500_github_connect.sql#record_github_webhook]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.record_github_webhook(p_delivery_id uuid, p_event text, p_payload jsonb, p_action text, p_installation_id bigint) | sql | false | search_path="" | service_role | 20260927224500_github_connect.sql |

## public.request_github_resync()

[src: supabase/migrations/20260927224500_github_connect.sql#request_github_resync]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.request_github_resync() | sql | false | search_path="" | authenticated, service_role | 20260927224500_github_connect.sql |

## public.start_github_link(p_code text, p_installation_id bigint)

[src: supabase/migrations/20260927224500_github_connect.sql#start_github_link]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.start_github_link(p_code text, p_installation_id bigint) | sql | false | search_path="" | authenticated, service_role | 20260927224500_github_connect.sql |

## private.github_link_tickets

[src: supabase/migrations/20260927224500_github_connect.sql#github_link_tickets]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| user_id | uuid | true | — |  |  | — |
| code | text | false | — |  |  | "default" |
| installation_id | bigint | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |
| claimed_at | timestamp with time zone | false | — |  |  | — |
| result | text | false | — |  |  | "default" |

### Keys and constraints

```sql
github_link_tickets_code_check: CHECK (code IS NULL OR char_length(code) >= 1 AND char_length(code) <= 200); -- validated: true
```

```sql
github_link_tickets_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
github_link_tickets_result_check: CHECK (result IS NULL OR (result = ANY (ARRAY['linked'::text, 'clash'::text, 'other_account'::text, 'failed'::text]))); -- validated: true
```

```sql
github_link_tickets_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX github_link_tickets_pkey ON private.github_link_tickets USING btree (id); -- valid: true
```

```sql
CREATE INDEX github_link_tickets_user_idx ON private.github_link_tickets USING btree (user_id); -- valid: true
```

### Policies

None.

### Triggers

None.

## private.github_revocations

[src: supabase/migrations/20260927224500_github_connect.sql#github_revocations]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | bigint | true | — | a |  | — |
| access_secret_id | uuid | true | — |  |  | — |
| refresh_secret_id | uuid | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
github_revocations_pkey: PRIMARY KEY (id); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX github_revocations_pkey ON private.github_revocations USING btree (id); -- valid: true
```

### Policies

None.

### Triggers

None.

## private.github_tokens

[src: supabase/migrations/20260927224500_github_connect.sql#github_tokens]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| user_id | uuid | true | — |  |  | — |
| access_secret_id | uuid | true | — |  |  | — |
| access_expires_at | timestamp with time zone | false | — |  |  | — |
| refresh_secret_id | uuid | false | — |  |  | — |
| refresh_expires_at | timestamp with time zone | false | — |  |  | — |
| updated_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
github_tokens_pkey: PRIMARY KEY (user_id); -- validated: true
```

```sql
github_tokens_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX github_tokens_pkey ON private.github_tokens USING btree (user_id); -- valid: true
```

### Policies

None.

### Triggers

```sql
CREATE TRIGGER github_tokens_revoke AFTER DELETE ON private.github_tokens FOR EACH ROW EXECUTE FUNCTION private.github_tokens_revoke(); -- enabled: O
```

## private.github_webhook_events

[src: supabase/migrations/20260927224500_github_connect.sql#github_webhook_events]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| delivery_id | uuid | true | — |  |  | — |
| event | text | true | — |  |  | "default" |
| action | text | false | — |  |  | "default" |
| installation_id | bigint | false | — |  |  | — |
| payload | jsonb | true | — |  |  | — |
| received_at | timestamp with time zone | true | now() |  |  | — |
| processed_at | timestamp with time zone | false | — |  |  | — |
| error | text | false | — |  |  | "default" |

### Keys and constraints

```sql
github_webhook_events_action_check: CHECK (action IS NULL OR action ~ '^[a-z_]{1,60}$'::text); -- validated: true
```

```sql
github_webhook_events_event_check: CHECK (event ~ '^[a-z_]{1,60}$'::text); -- validated: true
```

```sql
github_webhook_events_payload_check: CHECK (jsonb_typeof(payload) = 'object'::text); -- validated: true
```

```sql
github_webhook_events_pkey: PRIMARY KEY (delivery_id); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX github_webhook_events_pkey ON private.github_webhook_events USING btree (delivery_id); -- valid: true
```

```sql
CREATE INDEX github_webhook_events_received_idx ON private.github_webhook_events USING btree (received_at); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.github_accounts

[src: supabase/migrations/20260927224500_github_connect.sql#github_accounts]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| user_id | uuid | true | — |  |  | — |
| github_id | bigint | true | — |  |  | — |
| login | text | true | — |  |  | "default" |
| connected_at | timestamp with time zone | true | now() |  |  | — |
| revoked_at | timestamp with time zone | false | — |  |  | — |
| updated_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
github_accounts_github_id_check: CHECK (github_id > 0); -- validated: true
```

```sql
github_accounts_github_id_key: UNIQUE (github_id); -- validated: true
```

```sql
github_accounts_login_check: CHECK (login ~ '^[A-Za-z0-9-]{1,39}$'::text); -- validated: true
```

```sql
github_accounts_pkey: PRIMARY KEY (user_id); -- validated: true
```

```sql
github_accounts_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX github_accounts_github_id_key ON public.github_accounts USING btree (github_id); -- valid: true
```

```sql
CREATE UNIQUE INDEX github_accounts_pkey ON public.github_accounts USING btree (user_id); -- valid: true
```

### Policies

#### github_accounts.github_accounts_read

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "((user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1\n   FROM profiles p\n  WHERE (p.user_id = github_accounts.user_id))))",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

### Triggers

```sql
CREATE TRIGGER github_accounts_analytics AFTER INSERT ON github_accounts FOR EACH ROW EXECUTE FUNCTION private.analytics_github_connected(); -- enabled: O
```

```sql
CREATE TRIGGER github_accounts_updated_at BEFORE UPDATE ON github_accounts FOR EACH ROW EXECUTE FUNCTION private.set_updated_at(); -- enabled: O
```

## public.github_installations

[src: supabase/migrations/20260927224500_github_connect.sql#github_installations]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| installation_id | bigint | true | — |  |  | — |
| account_id | bigint | true | — |  |  | — |
| account_login | text | true | — |  |  | "default" |
| account_type | text | true | — |  |  | "default" |
| repository_selection | text | true | 'selected'::text |  |  | "default" |
| suspended_at | timestamp with time zone | false | — |  |  | — |
| deleted_at | timestamp with time zone | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |
| updated_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
github_installations_account_id_check: CHECK (account_id > 0); -- validated: true
```

```sql
github_installations_account_login_check: CHECK (account_login ~ '^[A-Za-z0-9-]{1,39}$'::text); -- validated: true
```

```sql
github_installations_account_type_check: CHECK (account_type = ANY (ARRAY['User'::text, 'Organization'::text])); -- validated: true
```

```sql
github_installations_installation_id_check: CHECK (installation_id > 0); -- validated: true
```

```sql
github_installations_pkey: PRIMARY KEY (installation_id); -- validated: true
```

```sql
github_installations_repository_selection_check: CHECK (repository_selection = ANY (ARRAY['all'::text, 'selected'::text])); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX github_installations_pkey ON public.github_installations USING btree (installation_id); -- valid: true
```

### Policies

#### github_installations.github_installations_read_own

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "(EXISTS ( SELECT 1\n   FROM github_user_installations ui\n  WHERE ((ui.installation_id = github_installations.installation_id) AND (ui.user_id = ( SELECT auth.uid() AS uid)))))",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

### Triggers

```sql
CREATE TRIGGER github_installations_updated_at BEFORE UPDATE ON github_installations FOR EACH ROW EXECUTE FUNCTION private.set_updated_at(); -- enabled: O
```

## public.github_link_clashes

[src: supabase/migrations/20260927224500_github_connect.sql#github_link_clashes]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | bigint | true | — | a |  | — |
| user_id | uuid | true | — |  |  | — |
| github_id | bigint | true | — |  |  | — |
| github_login | text | true | — |  |  | "default" |
| linked_user_id | uuid | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |
| resolved_at | timestamp with time zone | false | — |  |  | — |
| resolved_by | uuid | false | — |  |  | — |

### Keys and constraints

```sql
github_link_clashes_linked_user_id_fkey: FOREIGN KEY (linked_user_id) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
github_link_clashes_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
github_link_clashes_resolved_by_fkey: FOREIGN KEY (resolved_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
github_link_clashes_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE INDEX github_link_clashes_linked_user_idx ON public.github_link_clashes USING btree (linked_user_id); -- valid: true
```

```sql
CREATE UNIQUE INDEX github_link_clashes_pkey ON public.github_link_clashes USING btree (id); -- valid: true
```

```sql
CREATE INDEX github_link_clashes_resolved_by_idx ON public.github_link_clashes USING btree (resolved_by); -- valid: true
```

```sql
CREATE INDEX github_link_clashes_user_idx ON public.github_link_clashes USING btree (user_id); -- valid: true
```

### Policies

#### github_link_clashes.github_link_clashes_read_trust

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "( SELECT private.is_staff('trust_reviewer'::staff_role) AS is_staff)",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

### Triggers

None.

## public.github_repos

[src: supabase/migrations/20260927224500_github_connect.sql#github_repos]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| repo_id | bigint | true | — |  |  | — |
| full_name | text | true | — |  |  | "default" |
| owner_id | bigint | true | — |  |  | — |
| private | boolean | true | — |  |  | — |
| fork | boolean | true | false |  |  | — |
| parent_full_name | text | false | — |  |  | "default" |
| template_full_name | text | false | — |  |  | "default" |
| default_branch | text | false | — |  |  | "default" |
| pushed_at | timestamp with time zone | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |
| updated_at | timestamp with time zone | true | now() |  |  | — |
| languages | text[] | true | '{}'::text[] |  |  | "default" |
| linguist_excludes | text[] | true | '{}'::text[] |  |  | "default" |

### Keys and constraints

```sql
github_repos_default_branch_check: CHECK (default_branch IS NULL OR char_length(default_branch) <= 255); -- validated: true
```

```sql
github_repos_full_name_check: CHECK (full_name ~ '^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$'::text AND char_length(full_name) <= 140); -- validated: true
```

```sql
github_repos_languages_check: CHECK (cardinality(languages) <= 100); -- validated: true
```

```sql
github_repos_linguist_excludes_check: CHECK (cardinality(linguist_excludes) <= 200); -- validated: true
```

```sql
github_repos_owner_id_check: CHECK (owner_id > 0); -- validated: true
```

```sql
github_repos_parent_full_name_check: CHECK (parent_full_name IS NULL OR char_length(parent_full_name) <= 140); -- validated: true
```

```sql
github_repos_pkey: PRIMARY KEY (repo_id); -- validated: true
```

```sql
github_repos_repo_id_check: CHECK (repo_id > 0); -- validated: true
```

```sql
github_repos_template_full_name_check: CHECK (template_full_name IS NULL OR char_length(template_full_name) <= 140); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX github_repos_pkey ON public.github_repos USING btree (repo_id); -- valid: true
```

### Policies

#### github_repos.github_repos_read_own

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "(EXISTS ( SELECT 1\n   FROM github_user_repos ur\n  WHERE ((ur.repo_id = github_repos.repo_id) AND (ur.user_id = ( SELECT auth.uid() AS uid)))))",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

### Triggers

```sql
CREATE TRIGGER github_repos_updated_at BEFORE UPDATE ON github_repos FOR EACH ROW EXECUTE FUNCTION private.set_updated_at(); -- enabled: O
```

## public.github_user_installations

[src: supabase/migrations/20260927224500_github_connect.sql#github_user_installations]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| user_id | uuid | true | — |  |  | — |
| installation_id | bigint | true | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
github_user_installations_installation_id_fkey: FOREIGN KEY (installation_id) REFERENCES github_installations(installation_id) ON DELETE CASCADE; -- validated: true
```

```sql
github_user_installations_pkey: PRIMARY KEY (user_id, installation_id); -- validated: true
```

```sql
github_user_installations_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE INDEX github_user_installations_installation_idx ON public.github_user_installations USING btree (installation_id); -- valid: true
```

```sql
CREATE UNIQUE INDEX github_user_installations_pkey ON public.github_user_installations USING btree (user_id, installation_id); -- valid: true
```

### Policies

#### github_user_installations.github_user_installations_read_own

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

## public.github_user_repos

[src: supabase/migrations/20260927224500_github_connect.sql#github_user_repos]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| user_id | uuid | true | — |  |  | — |
| repo_id | bigint | true | — |  |  | — |
| installation_id | bigint | true | — |  |  | — |
| kind | github_repo_kind | false | — |  |  | — |
| excluded | boolean | true | false |  |  | — |
| discovered_at | timestamp with time zone | true | now() |  |  | — |
| classified_at | timestamp with time zone | false | — |  |  | — |
| last_synced_at | timestamp with time zone | false | — |  |  | — |
| harvested_at | timestamp with time zone | false | — |  |  | — |
| agent_prs_checked_at | timestamp with time zone | false | — |  |  | — |

### Keys and constraints

```sql
github_user_repos_installation_id_fkey: FOREIGN KEY (installation_id) REFERENCES github_installations(installation_id) ON DELETE CASCADE; -- validated: true
```

```sql
github_user_repos_pkey: PRIMARY KEY (user_id, repo_id); -- validated: true
```

```sql
github_user_repos_repo_id_fkey: FOREIGN KEY (repo_id) REFERENCES github_repos(repo_id) ON DELETE CASCADE; -- validated: true
```

```sql
github_user_repos_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE INDEX github_user_repos_installation_idx ON public.github_user_repos USING btree (installation_id); -- valid: true
```

```sql
CREATE UNIQUE INDEX github_user_repos_pkey ON public.github_user_repos USING btree (user_id, repo_id); -- valid: true
```

```sql
CREATE INDEX github_user_repos_repo_idx ON public.github_user_repos USING btree (repo_id); -- valid: true
```

### Policies

#### github_user_repos.github_user_repos_exclude_own

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "(user_id = ( SELECT auth.uid() AS uid))",
  "command": "w",
  "permissive": true,
  "with_check": "(user_id = ( SELECT auth.uid() AS uid))"
}
```

#### github_user_repos.github_user_repos_read_own

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
CREATE TRIGGER github_user_repos_recompute_delete AFTER DELETE ON github_user_repos REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION private.github_user_repos_recompute(); -- enabled: O
```

```sql
CREATE TRIGGER github_user_repos_recompute_update AFTER UPDATE ON github_user_repos REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION private.github_user_repos_recompute(); -- enabled: O
```

## public.sync_jobs

[src: supabase/migrations/20260927224500_github_connect.sql#sync_jobs]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | bigint | true | — | a |  | — |
| user_id | uuid | true | — |  |  | — |
| trigger | text | true | — |  |  | "default" |
| status | sync_status | true | 'queued'::sync_status |  |  | — |
| stage | text | false | — |  |  | "default" |
| repos_total | integer | true | 0 |  |  | — |
| repos_done | integer | true | 0 |  |  | — |
| commits_analysed | integer | true | 0 |  |  | — |
| skills_found | integer | true | 0 |  |  | — |
| error | text | false | — |  |  | "default" |
| created_at | timestamp with time zone | true | now() |  |  | — |
| updated_at | timestamp with time zone | true | now() |  |  | — |
| finished_at | timestamp with time zone | false | — |  |  | — |
| pending | integer | true | 0 |  |  | — |

### Keys and constraints

```sql
sync_jobs_commits_analysed_check: CHECK (commits_analysed >= 0); -- validated: true
```

```sql
sync_jobs_error_check: CHECK (error IS NULL OR char_length(error) <= 2000); -- validated: true
```

```sql
sync_jobs_pending_check: CHECK (pending >= 0); -- validated: true
```

```sql
sync_jobs_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
sync_jobs_repos_done_check: CHECK (repos_done >= 0); -- validated: true
```

```sql
sync_jobs_repos_total_check: CHECK (repos_total >= 0); -- validated: true
```

```sql
sync_jobs_skills_found_check: CHECK (skills_found >= 0); -- validated: true
```

```sql
sync_jobs_stage_check: CHECK (stage IS NULL OR stage ~ '^[a-z_]{1,30}$'::text); -- validated: true
```

```sql
sync_jobs_trigger_check: CHECK (trigger = ANY (ARRAY['connect'::text, 'resync'::text, 'webhook'::text, 'nightly'::text])); -- validated: true
```

```sql
sync_jobs_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX sync_jobs_one_open_per_user ON public.sync_jobs USING btree (user_id) WHERE (status = ANY (ARRAY['queued'::sync_status, 'running'::sync_status])); -- valid: true
```

```sql
CREATE UNIQUE INDEX sync_jobs_pkey ON public.sync_jobs USING btree (id); -- valid: true
```

```sql
CREATE INDEX sync_jobs_user_idx ON public.sync_jobs USING btree (user_id, created_at DESC); -- valid: true
```

### Policies

#### sync_jobs.sync_jobs_read_own

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
CREATE TRIGGER sync_jobs_updated_at BEFORE UPDATE ON sync_jobs FOR EACH ROW EXECUTE FUNCTION private.set_updated_at(); -- enabled: O
```
