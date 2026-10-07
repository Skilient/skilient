Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# identity

## private.complete_onboarding()

[src: supabase/migrations/20260927210238_identity.sql#complete_onboarding]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.complete_onboarding() | plpgsql | true | search_path="" | authenticated | 20260927210238_identity.sql |

## private.current_agreement_version()

[src: supabase/migrations/20260927210238_identity.sql#current_agreement_version]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.current_agreement_version() | sql | true | search_path="" | anon, authenticated, service_role | 20260927210238_identity.sql |

## private.current_university_id()

[src: supabase/migrations/20260927210238_identity.sql#current_university_id]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.current_university_id() | sql | true | search_path="" | authenticated, service_role | 20260927210238_identity.sql |

## private.domain_admits_students(p_domain text, p_university_id uuid)

[src: supabase/migrations/20260927210238_identity.sql#domain_admits_students]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.domain_admits_students(p_domain text, p_university_id uuid) | sql | true | search_path="" | None | 20260927210238_identity.sql |

## private.email_domain(p_email text)

[src: supabase/migrations/20260927210238_identity.sql#email_domain]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.email_domain(p_email text) | sql | false | search_path="" | None | 20260927210238_identity.sql |

## private.is_staff(p_role staff_role)

[src: supabase/migrations/20260927210238_identity.sql#is_staff]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.is_staff(p_role staff_role) | sql | true | search_path="" | authenticated, service_role | 20260927210238_identity.sql |

## private.log_security_event(p_kind text, p_ip_hash text, p_user_agent text)

[src: supabase/migrations/20260927210238_identity.sql#log_security_event]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.log_security_event(p_kind text, p_ip_hash text, p_user_agent text) | plpgsql | true | search_path="" | authenticated | 20260927210238_identity.sql |

## private.rate_limit(p_key text, p_limit integer, p_window interval)

[src: supabase/migrations/20260927210238_identity.sql#rate_limit]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.rate_limit(p_key text, p_limit integer, p_window interval) | plpgsql | true | search_path="" | anon, authenticated, service_role | 20260927210238_identity.sql |

## private.record_sign_in(p_device_hash text, p_ip_hash text, p_user_agent text, p_method text)

[src: supabase/migrations/20260927210238_identity.sql#record_sign_in]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.record_sign_in(p_device_hash text, p_ip_hash text, p_user_agent text, p_method text) | plpgsql | true | search_path="" | authenticated | 20260927210238_identity.sql |

## private.reserved_usernames()

[src: supabase/migrations/20260927210238_identity.sql#reserved_usernames]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.reserved_usernames() | sql | false | search_path="" | authenticated, service_role | 20260927210238_identity.sql |

## private.security_not_me(p_token text)

[src: supabase/migrations/20260927210238_identity.sql#security_not_me]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.security_not_me(p_token text) | plpgsql | true | search_path="" | anon, authenticated | 20260927210238_identity.sql |

## private.set_my_university(p_university_id uuid)

[src: supabase/migrations/20260927210238_identity.sql#set_my_university]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.set_my_university(p_university_id uuid) | plpgsql | true | search_path="" | authenticated | 20260927210238_identity.sql |

## private.set_updated_at()

[src: supabase/migrations/20260927210238_identity.sql#set_updated_at]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.set_updated_at() | plpgsql | false | search_path="" | None | 20260927210238_identity.sql |

## private.signin_account_key(p_email text)

[src: supabase/migrations/20260927210238_identity.sql#signin_account_key]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.signin_account_key(p_email text) | sql | false | search_path="" | None | 20260927210238_identity.sql |

## private.signin_ip_key(p_ip_hash text)

[src: supabase/migrations/20260927210238_identity.sql#signin_ip_key]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.signin_ip_key(p_ip_hash text) | sql | false | search_path="" | None | 20260927210238_identity.sql |

## private.sync_hec_universities(p_rows jsonb)

[src: supabase/migrations/20260927210238_identity.sql#sync_hec_universities]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.sync_hec_universities(p_rows jsonb) | plpgsql | false | search_path="" | None | 20260927210238_identity.sql |

## private.sync_public_card()

[src: supabase/migrations/20260927210238_identity.sql#sync_public_card]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.sync_public_card() | plpgsql | true | search_path="" | None | 20260927210238_identity.sql |

## private.username_available(p_username text)

[src: supabase/migrations/20260927210238_identity.sql#username_available]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.username_available(p_username text) | plpgsql | true | search_path="" | authenticated | 20260927210238_identity.sql |

## public.complete_onboarding()

[src: supabase/migrations/20260927210238_identity.sql#complete_onboarding]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.complete_onboarding() | sql | false | search_path="" | authenticated, service_role | 20260927210238_identity.sql |

## public.hook_before_user_created(event jsonb)

[src: supabase/migrations/20260927210238_identity.sql#hook_before_user_created]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.hook_before_user_created(event jsonb) | plpgsql | false | search_path="" | service_role, supabase_auth_admin | 20260927210238_identity.sql |

## public.is_staff(p_role staff_role)

[src: supabase/migrations/20260927210238_identity.sql#is_staff]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.is_staff(p_role staff_role) | sql | false | search_path="" | authenticated, service_role | 20260927210238_identity.sql |

## public.log_security_event(p_kind text, p_ip_hash text, p_user_agent text)

[src: supabase/migrations/20260927210238_identity.sql#log_security_event]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.log_security_event(p_kind text, p_ip_hash text, p_user_agent text) | sql | false | search_path="" | authenticated, service_role | 20260927210238_identity.sql |

## public.rate_limit(p_key text, p_limit integer, p_window_seconds integer)

[src: supabase/migrations/20260927210238_identity.sql#rate_limit]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.rate_limit(p_key text, p_limit integer, p_window_seconds integer) | sql | false | search_path="" | anon, authenticated, service_role | 20260927210238_identity.sql |

## public.record_sign_in(p_device_hash text, p_ip_hash text, p_user_agent text, p_method text)

[src: supabase/migrations/20260927210238_identity.sql#record_sign_in]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.record_sign_in(p_device_hash text, p_ip_hash text, p_user_agent text, p_method text) | sql | false | search_path="" | authenticated, service_role | 20260927210238_identity.sql |

## public.security_not_me(p_token text)

[src: supabase/migrations/20260927210238_identity.sql#security_not_me]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.security_not_me(p_token text) | sql | false | search_path="" | anon, authenticated, service_role | 20260927210238_identity.sql |

## public.set_my_university(p_university_id uuid)

[src: supabase/migrations/20260927210238_identity.sql#set_my_university]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.set_my_university(p_university_id uuid) | sql | false | search_path="" | authenticated, service_role | 20260927210238_identity.sql |

## public.signin_failed(p_email text, p_ip_hash text)

[src: supabase/migrations/20260927210238_identity.sql#signin_failed]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.signin_failed(p_email text, p_ip_hash text) | sql | false | search_path="" | anon, authenticated, service_role | 20260927210238_identity.sql |

## public.signin_status(p_email text, p_ip_hash text)

[src: supabase/migrations/20260927210238_identity.sql#signin_status]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.signin_status(p_email text, p_ip_hash text) | sql | false | search_path="" | anon, authenticated, service_role | 20260927210238_identity.sql |

## public.username_available(p_username text)

[src: supabase/migrations/20260927210238_identity.sql#username_available]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.username_available(p_username text) | sql | false | search_path="" | authenticated, service_role | 20260927210238_identity.sql |

## private.auth_failures

[src: supabase/migrations/20260927210238_identity.sql#auth_failures]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| key | text | true | — |  |  | "default" |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
auth_failures_key_check: CHECK (char_length(key) >= 1 AND char_length(key) <= 200); -- validated: true
```

### Indexes

```sql
CREATE INDEX auth_failures_created_idx ON private.auth_failures USING btree (created_at); -- valid: true
```

```sql
CREATE INDEX auth_failures_key_created_idx ON private.auth_failures USING btree (key, created_at DESC); -- valid: true
```

### Policies

None.

### Triggers

None.

## private.rate_limit_events

[src: supabase/migrations/20260927210238_identity.sql#rate_limit_events]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| key | text | true | — |  |  | "default" |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
rate_limit_events_key_check: CHECK (char_length(key) >= 1 AND char_length(key) <= 200); -- validated: true
```

### Indexes

```sql
CREATE INDEX rate_limit_events_created_idx ON private.rate_limit_events USING btree (created_at); -- valid: true
```

```sql
CREATE INDEX rate_limit_events_key_created_idx ON private.rate_limit_events USING btree (key, created_at DESC); -- valid: true
```

### Policies

None.

### Triggers

None.

## private.security_alert_tokens

[src: supabase/migrations/20260927210238_identity.sql#security_alert_tokens]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| token_hash | text | true | — |  |  | "default" |
| user_id | uuid | true | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |
| expires_at | timestamp with time zone | true | (now() + '7 days'::interval) |  |  | — |
| used_at | timestamp with time zone | false | — |  |  | — |

### Keys and constraints

```sql
security_alert_tokens_pkey: PRIMARY KEY (token_hash); -- validated: true
```

```sql
security_alert_tokens_token_hash_check: CHECK (token_hash ~ '^[0-9a-f]{64}$'::text); -- validated: true
```

```sql
security_alert_tokens_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX security_alert_tokens_pkey ON private.security_alert_tokens USING btree (token_hash); -- valid: true
```

```sql
CREATE INDEX security_alert_tokens_user_idx ON private.security_alert_tokens USING btree (user_id); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.agreement_acceptances

[src: supabase/migrations/20260927210238_identity.sql#agreement_acceptances]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| user_id | uuid | true | — |  |  | — |
| version | integer | true | — |  |  | — |
| accepted_at | timestamp with time zone | true | now() |  |  | — |
| ip_hash | text | false | — |  |  | "default" |

### Keys and constraints

```sql
agreement_acceptances_ip_hash_check: CHECK (ip_hash IS NULL OR ip_hash ~ '^[0-9a-f]{64}$'::text); -- validated: true
```

```sql
agreement_acceptances_pkey: PRIMARY KEY (user_id, version); -- validated: true
```

```sql
agreement_acceptances_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

```sql
agreement_acceptances_version_fkey: FOREIGN KEY (version) REFERENCES agreement_versions(version); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX agreement_acceptances_pkey ON public.agreement_acceptances USING btree (user_id, version); -- valid: true
```

```sql
CREATE INDEX agreement_acceptances_version_idx ON public.agreement_acceptances USING btree (version); -- valid: true
```

### Policies

#### agreement_acceptances.agreement_acceptances_accept_current

```json
{
  "roles": [
    "authenticated"
  ],
  "using": null,
  "command": "a",
  "permissive": true,
  "with_check": "((user_id = ( SELECT auth.uid() AS uid)) AND (version = ( SELECT private.current_agreement_version() AS current_agreement_version)))"
}
```

#### agreement_acceptances.agreement_acceptances_read_own

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
CREATE TRIGGER agreement_acceptances_analytics AFTER INSERT ON agreement_acceptances FOR EACH ROW EXECUTE FUNCTION private.analytics_agreement_accepted(); -- enabled: O
```

## public.agreement_versions

[src: supabase/migrations/20260927210238_identity.sql#agreement_versions]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| version | integer | true | — |  |  | — |
| title | text | true | — |  |  | "default" |
| body_md | text | true | — |  |  | "default" |
| summary_md | text | true | ''::text |  |  | "default" |
| published_at | timestamp with time zone | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
agreement_versions_pkey: PRIMARY KEY (version); -- validated: true
```

```sql
agreement_versions_title_check: CHECK (char_length(title) >= 1 AND char_length(title) <= 120); -- validated: true
```

```sql
agreement_versions_version_check: CHECK (version > 0); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX agreement_versions_pkey ON public.agreement_versions USING btree (version); -- valid: true
```

### Policies

#### agreement_versions.agreement_versions_read_published

```json
{
  "roles": [
    "anon",
    "authenticated"
  ],
  "using": "((published_at IS NOT NULL) AND (published_at <= now()))",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

### Triggers

None.

## public.onboarding_state

[src: supabase/migrations/20260927210238_identity.sql#onboarding_state]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| user_id | uuid | true | — |  |  | — |
| role | account_role | true | 'student'::account_role |  |  | — |
| step | smallint | true | 1 |  |  | — |
| data | jsonb | true | '{}'::jsonb |  |  | — |
| completed_at | timestamp with time zone | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |
| updated_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
onboarding_state_data_check: CHECK (jsonb_typeof(data) = 'object'::text AND pg_column_size(data) < 16384); -- validated: true
```

```sql
onboarding_state_pkey: PRIMARY KEY (user_id); -- validated: true
```

```sql
onboarding_state_step_check: CHECK (step >= 1 AND step <= 6); -- validated: true
```

```sql
onboarding_state_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX onboarding_state_pkey ON public.onboarding_state USING btree (user_id); -- valid: true
```

### Policies

#### onboarding_state.onboarding_state_read_own

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

#### onboarding_state.onboarding_state_update_own

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

### Triggers

```sql
CREATE TRIGGER onboarding_state_analytics AFTER UPDATE OF step, completed_at ON onboarding_state FOR EACH ROW WHEN (new.step > old.step OR old.completed_at IS NULL AND new.completed_at IS NOT NULL) EXECUTE FUNCTION private.analytics_onboarding(); -- enabled: O
```

```sql
CREATE TRIGGER onboarding_state_set_updated_at BEFORE UPDATE ON onboarding_state FOR EACH ROW EXECUTE FUNCTION private.set_updated_at(); -- enabled: O
```

## public.personal_email_domains

[src: supabase/migrations/20260927210238_identity.sql#personal_email_domains]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| domain | text | true | — |  |  | "default" |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
personal_email_domains_domain_check: CHECK (domain ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'::text); -- validated: true
```

```sql
personal_email_domains_pkey: PRIMARY KEY (domain); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX personal_email_domains_pkey ON public.personal_email_domains USING btree (domain); -- valid: true
```

### Policies

#### personal_email_domains.personal_email_domains_read

```json
{
  "roles": [
    "anon",
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

## public.profiles

[src: supabase/migrations/20260927210238_identity.sql#profiles]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| user_id | uuid | true | — |  |  | — |
| role | account_role | true | 'student'::account_role |  |  | — |
| university_id | uuid | false | — |  |  | — |
| full_name | text | true | — |  |  | "default" |
| username | text | false | — |  |  | "default" |
| department | text | false | — |  |  | "default" |
| programme | text | false | — |  |  | "default" |
| graduation_year | smallint | false | — |  |  | — |
| campus | text | false | — |  |  | "default" |
| bio | text | false | — |  |  | "default" |
| avatar_path | text | false | — |  |  | "default" |
| cover_path | text | false | — |  |  | "default" |
| visibility | profile_visibility | true | 'university'::profile_visibility |  |  | — |
| recruiter_visible | boolean | true | false |  |  | — |
| looking_for | looking_for_option[] | true | '{}'::looking_for_option[] |  |  | — |
| onboarding_complete | boolean | true | false |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |
| updated_at | timestamp with time zone | true | now() |  |  | — |
| chat_read_receipts | boolean | true | true |  |  | — |
| leaderboard_opt_out | boolean | true | false |  |  | — |
| status | account_status | true | 'active'::account_status |  |  | — |
| graduated_at | timestamp with time zone | false | — |  |  | — |
| delete_after | timestamp with time zone | false | — |  |  | — |
| availability | text[] | true | '{}'::text[] |  |  | "default" |
| city | text | false | — |  |  | "default" |
| remote_ok | boolean | true | false |  |  | — |
| department_id | uuid | false | — |  |  | — |

### Keys and constraints

```sql
profiles_availability_check: CHECK (availability <@ ARRAY['internship'::text, 'full_time'::text, 'part_time'::text]); -- validated: true
```

```sql
profiles_bio_check: CHECK (bio IS NULL OR char_length(bio) <= 280); -- validated: true
```

```sql
profiles_campus_check: CHECK (campus IS NULL OR char_length(campus) >= 2 AND char_length(campus) <= 60); -- validated: true
```

```sql
profiles_check: CHECK (avatar_path IS NULL OR starts_with(avatar_path, user_id::text || '/'::text) AND char_length(avatar_path) <= 200); -- validated: true
```

```sql
profiles_check1: CHECK (cover_path IS NULL OR starts_with(cover_path, user_id::text || '/'::text) AND char_length(cover_path) <= 200); -- validated: true
```

```sql
profiles_city_check: CHECK (city IS NULL OR char_length(city) >= 2 AND char_length(city) <= 60); -- validated: true
```

```sql
profiles_deleting_has_date: CHECK ((status = 'deleting'::account_status) = (delete_after IS NOT NULL)); -- validated: true
```

```sql
profiles_department_check: CHECK (department IS NULL OR char_length(department) >= 2 AND char_length(department) <= 80); -- validated: true
```

```sql
profiles_department_id_fkey: FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL; -- validated: true
```

```sql
profiles_full_name_check: CHECK (char_length(btrim(full_name)) >= 1 AND char_length(btrim(full_name)) <= 60); -- validated: true
```

```sql
profiles_graduation_year_check: CHECK (graduation_year IS NULL OR graduation_year >= 1980 AND graduation_year <= 2100); -- validated: true
```

```sql
profiles_pkey: PRIMARY KEY (user_id); -- validated: true
```

```sql
profiles_programme_check: CHECK (programme IS NULL OR char_length(programme) >= 2 AND char_length(programme) <= 80); -- validated: true
```

```sql
profiles_university_id_fkey: FOREIGN KEY (university_id) REFERENCES universities(id) ON DELETE RESTRICT; -- validated: true
```

```sql
profiles_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

```sql
profiles_username_check: CHECK (username ~ '^[a-z0-9_]{3,30}$'::text AND NOT (username = ANY (private.reserved_usernames()))); -- validated: true
```

```sql
profiles_username_key: UNIQUE (username); -- validated: true
```

### Indexes

```sql
CREATE INDEX profiles_deleting_idx ON public.profiles USING btree (delete_after) WHERE (status = 'deleting'::account_status); -- valid: true
```

```sql
CREATE INDEX profiles_department_id_idx ON public.profiles USING btree (department_id); -- valid: true
```

```sql
CREATE INDEX profiles_looking_for_idx ON public.profiles USING gin (looking_for); -- valid: true
```

```sql
CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (user_id); -- valid: true
```

```sql
CREATE INDEX profiles_university_cohort_idx ON public.profiles USING btree (university_id, department, graduation_year); -- valid: true
```

```sql
CREATE UNIQUE INDEX profiles_username_key ON public.profiles USING btree (username); -- valid: true
```

### Policies

#### profiles.profiles_select_visible

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "((user_id = ( SELECT auth.uid() AS uid)) OR ((NOT private.is_blocked_with(user_id)) AND ((visibility = 'global'::profile_visibility) OR ((visibility = 'university'::profile_visibility) AND (university_id = ( SELECT private.current_university_id() AS current_university_id))) OR private.is_friend_of(user_id))))",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

#### profiles.profiles_update_own

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

### Triggers

```sql
CREATE TRIGGER profiles_analytics_changed AFTER UPDATE OF university_id, role ON profiles FOR EACH ROW WHEN (old.university_id IS DISTINCT FROM new.university_id OR old.role IS DISTINCT FROM new.role) EXECUTE FUNCTION private.analytics_profile_changed(); -- enabled: O
```

```sql
CREATE TRIGGER profiles_analytics_created AFTER INSERT ON profiles FOR EACH ROW EXECUTE FUNCTION private.analytics_profile_created(); -- enabled: O
```

```sql
CREATE TRIGGER profiles_avatar_cleanup AFTER UPDATE OF avatar_path ON profiles FOR EACH ROW WHEN (old.avatar_path IS NOT NULL AND new.avatar_path IS DISTINCT FROM old.avatar_path) EXECUTE FUNCTION private.avatar_cleanup(); -- enabled: O
```

```sql
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION private.set_updated_at(); -- enabled: O
```

```sql
CREATE TRIGGER profiles_sync_department BEFORE INSERT OR UPDATE OF department, department_id, university_id ON profiles FOR EACH ROW EXECUTE FUNCTION private.sync_profile_department(); -- enabled: O
```

```sql
CREATE TRIGGER profiles_sync_public_card AFTER INSERT OR UPDATE OF username, full_name, department, graduation_year ON profiles FOR EACH ROW EXECUTE FUNCTION private.sync_public_card(); -- enabled: O
```

```sql
CREATE TRIGGER profiles_talent_sync AFTER UPDATE OF recruiter_visible, status, university_id, department, graduation_year, availability, city, remote_ok, looking_for, onboarding_complete ON profiles FOR EACH ROW EXECUTE FUNCTION private.profile_talent_sync(); -- enabled: O
```

```sql
CREATE TRIGGER profiles_tcheck_department BEFORE INSERT OR UPDATE OF department ON profiles FOR EACH ROW EXECUTE FUNCTION private.check_profile_department(); -- enabled: O
```

## public.profiles_public_card

[src: supabase/migrations/20260927210238_identity.sql#profiles_public_card]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| user_id | uuid | true | — |  |  | — |
| username | text | false | — |  |  | "default" |
| full_name | text | true | — |  |  | "default" |
| department | text | false | — |  |  | "default" |
| graduation_year | smallint | false | — |  |  | — |
| search | tsvector | false | to_tsvector('simple'::regconfig, ((((COALESCE(full_name, ''::text) \|\| ' '::text) \|\| COALESCE(username, ''::text)) \|\| ' '::text) \|\| COALESCE(department, ''::text))) |  | s | — |

### Keys and constraints

```sql
profiles_public_card_pkey: PRIMARY KEY (user_id); -- validated: true
```

```sql
profiles_public_card_user_id_fkey: FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE; -- validated: true
```

```sql
profiles_public_card_username_key: UNIQUE (username); -- validated: true
```

### Indexes

```sql
CREATE INDEX profiles_public_card_name_trgm_idx ON public.profiles_public_card USING gin (full_name gin_trgm_ops); -- valid: true
```

```sql
CREATE UNIQUE INDEX profiles_public_card_pkey ON public.profiles_public_card USING btree (user_id); -- valid: true
```

```sql
CREATE INDEX profiles_public_card_search_idx ON public.profiles_public_card USING gin (search); -- valid: true
```

```sql
CREATE UNIQUE INDEX profiles_public_card_username_key ON public.profiles_public_card USING btree (username); -- valid: true
```

```sql
CREATE INDEX profiles_public_card_username_trgm_idx ON public.profiles_public_card USING gin (username gin_trgm_ops); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.security_events

[src: supabase/migrations/20260927210238_identity.sql#security_events]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| user_id | uuid | true | — |  |  | — |
| kind | text | true | — |  |  | "default" |
| ip_hash | text | false | — |  |  | "default" |
| user_agent | text | false | — |  |  | "default" |
| meta | jsonb | true | '{}'::jsonb |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
security_events_ip_hash_check: CHECK (ip_hash IS NULL OR ip_hash ~ '^[0-9a-f]{64}$'::text); -- validated: true
```

```sql
security_events_kind_check: CHECK (kind = ANY (ARRAY['signup'::text, 'sign_in'::text, 'sign_in_failed'::text, 'account_locked'::text, 'sign_in_alert'::text, 'new_device'::text, 'not_me'::text, 'password_reset_requested'::text, 'password_changed'::text, 'mfa_enrolled'::text, 'mfa_unenrolled'::text, 'mfa_backup_codes_created'::text, 'mfa_backup_code_used'::text, 'signed_out_everywhere'::text, 'github_connected'::text, 'github_disconnected'::text])); -- validated: true
```

```sql
security_events_meta_check: CHECK (jsonb_typeof(meta) = 'object'::text); -- validated: true
```

```sql
security_events_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
security_events_user_agent_check: CHECK (user_agent IS NULL OR char_length(user_agent) <= 512); -- validated: true
```

```sql
security_events_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE INDEX security_events_created_idx ON public.security_events USING btree (created_at); -- valid: true
```

```sql
CREATE UNIQUE INDEX security_events_pkey ON public.security_events USING btree (id); -- valid: true
```

```sql
CREATE INDEX security_events_user_created_idx ON public.security_events USING btree (user_id, created_at DESC); -- valid: true
```

### Policies

#### security_events.security_events_read_own

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

## public.staff_roles

[src: supabase/migrations/20260927210238_identity.sql#staff_roles]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| user_id | uuid | true | — |  |  | — |
| role | staff_role | true | — |  |  | — |
| granted_by | uuid | false | — |  |  | — |
| granted_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
staff_roles_granted_by_fkey: FOREIGN KEY (granted_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
staff_roles_pkey: PRIMARY KEY (user_id, role); -- validated: true
```

```sql
staff_roles_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE INDEX staff_roles_granted_by_idx ON public.staff_roles USING btree (granted_by); -- valid: true
```

```sql
CREATE UNIQUE INDEX staff_roles_pkey ON public.staff_roles USING btree (user_id, role); -- valid: true
```

### Policies

#### staff_roles.staff_roles_read

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT private.is_staff('super_admin'::staff_role) AS is_staff))",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

### Triggers

None.

## public.universities

[src: supabase/migrations/20260927210238_identity.sql#universities]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| name | text | true | — |  |  | "default" |
| slug | text | true | — |  |  | "default" |
| city | text | false | — |  |  | "default" |
| province | text | false | — |  |  | "default" |
| created_at | timestamp with time zone | true | now() |  |  | — |
| updated_at | timestamp with time zone | true | now() |  |  | — |
| final_year_batch | smallint | false | — |  |  | — |
| claimed_at | timestamp with time zone | false | — |  |  | — |
| owner_id | uuid | false | — |  |  | — |
| slug_changed_at | timestamp with time zone | false | — |  |  | — |
| billing_ntn | text | false | — |  |  | "default" |
| billing_address | text | false | — |  |  | "default" |
| live_at | timestamp with time zone | false | now() |  |  | — |

### Keys and constraints

```sql
universities_billing_address_check: CHECK (billing_address IS NULL OR char_length(btrim(billing_address)) >= 5 AND char_length(btrim(billing_address)) <= 300); -- validated: true
```

```sql
universities_billing_ntn_check: CHECK (billing_ntn IS NULL OR char_length(btrim(billing_ntn)) >= 3 AND char_length(btrim(billing_ntn)) <= 30); -- validated: true
```

```sql
universities_city_check: CHECK (city IS NULL OR char_length(city) >= 1 AND char_length(city) <= 80); -- validated: true
```

```sql
universities_final_year_batch_check: CHECK (final_year_batch IS NULL OR final_year_batch >= 1980 AND final_year_batch <= 2100); -- validated: true
```

```sql
universities_name_check: CHECK (char_length(name) >= 2 AND char_length(name) <= 200); -- validated: true
```

```sql
universities_name_key: UNIQUE (name); -- validated: true
```

```sql
universities_owner_id_fkey: FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
universities_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
universities_province_check: CHECK (province IS NULL OR (province = ANY (ARRAY['Punjab'::text, 'Sindh'::text, 'KP'::text, 'Balochistan'::text, 'ICT'::text, 'AJK'::text, 'GB'::text]))); -- validated: true
```

```sql
universities_slug_check: CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text AND char_length(slug) <= 100); -- validated: true
```

```sql
universities_slug_key: UNIQUE (slug); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX universities_name_key ON public.universities USING btree (name); -- valid: true
```

```sql
CREATE INDEX universities_owner_idx ON public.universities USING btree (owner_id); -- valid: true
```

```sql
CREATE UNIQUE INDEX universities_pkey ON public.universities USING btree (id); -- valid: true
```

```sql
CREATE UNIQUE INDEX universities_slug_key ON public.universities USING btree (slug); -- valid: true
```

### Policies

#### universities.universities_read

```json
{
  "roles": [
    "anon",
    "authenticated"
  ],
  "using": "true",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

### Triggers

```sql
CREATE TRIGGER universities_launch_emails AFTER UPDATE OF live_at ON universities FOR EACH ROW WHEN (old.live_at IS NULL AND new.live_at IS NOT NULL) EXECUTE FUNCTION private.university_went_live(); -- enabled: O
```

```sql
CREATE TRIGGER universities_set_updated_at BEFORE UPDATE ON universities FOR EACH ROW EXECUTE FUNCTION private.set_updated_at(); -- enabled: O
```

## public.university_domains

[src: supabase/migrations/20260927210238_identity.sql#university_domains]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| university_id | uuid | true | — |  |  | — |
| domain | text | true | — |  |  | "default" |
| kind | domain_kind | true | 'both'::domain_kind |  |  | — |
| source | text | true | 'hec_seed'::text |  |  | "default" |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
university_domains_domain_check: CHECK (char_length(domain) <= 253 AND domain ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'::text); -- validated: true
```

```sql
university_domains_pkey: PRIMARY KEY (university_id, domain); -- validated: true
```

```sql
university_domains_source_check: CHECK (source = ANY (ARRAY['hec_seed'::text, 'ops'::text])); -- validated: true
```

```sql
university_domains_university_id_fkey: FOREIGN KEY (university_id) REFERENCES universities(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE INDEX university_domains_domain_idx ON public.university_domains USING btree (domain); -- valid: true
```

```sql
CREATE UNIQUE INDEX university_domains_pkey ON public.university_domains USING btree (university_id, domain); -- valid: true
```

### Policies

#### university_domains.university_domains_read

```json
{
  "roles": [
    "anon",
    "authenticated"
  ],
  "using": "true",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

### Triggers

```sql
CREATE TRIGGER university_domains_not_public BEFORE INSERT OR UPDATE OF domain ON university_domains FOR EACH ROW EXECUTE FUNCTION private.refuse_public_university_domain(); -- enabled: O
```

## public.user_devices

[src: supabase/migrations/20260927210238_identity.sql#user_devices]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| user_id | uuid | true | — |  |  | — |
| device_hash | text | true | — |  |  | "default" |
| user_agent | text | false | — |  |  | "default" |
| first_seen_at | timestamp with time zone | true | now() |  |  | — |
| last_seen_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
user_devices_device_hash_check: CHECK (device_hash ~ '^[0-9a-f]{64}$'::text); -- validated: true
```

```sql
user_devices_pkey: PRIMARY KEY (user_id, device_hash); -- validated: true
```

```sql
user_devices_user_agent_check: CHECK (user_agent IS NULL OR char_length(user_agent) <= 512); -- validated: true
```

```sql
user_devices_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX user_devices_pkey ON public.user_devices USING btree (user_id, device_hash); -- valid: true
```

### Policies

#### user_devices.user_devices_read_own

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
