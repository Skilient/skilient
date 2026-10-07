Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# recruiter_orgs

## private.accept_org_invite(p_id uuid)

[src: supabase/migrations/20261013000000_recruiter_orgs.sql#accept_org_invite]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.accept_org_invite(p_id uuid) | plpgsql | true | search_path="" | authenticated | 20261013000000_recruiter_orgs.sql |

## private.block_company(p_org uuid)

[src: supabase/migrations/20261013000000_recruiter_orgs.sql#block_company]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.block_company(p_org uuid) | plpgsql | true | search_path="" | authenticated | 20261013000000_recruiter_orgs.sql |

## private.create_organization(p jsonb)

[src: supabase/migrations/20261013000000_recruiter_orgs.sql#create_organization]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.create_organization(p jsonb) | plpgsql | true | search_path="" | authenticated | 20261013000000_recruiter_orgs.sql |

## private.decide_org(p_org uuid, p_action text, p_reason text)

[src: supabase/migrations/20261013000000_recruiter_orgs.sql#decide_org]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.decide_org(p_org uuid, p_action text, p_reason text) | plpgsql | true | search_path="" | authenticated | 20261013000000_recruiter_orgs.sql |

## private.guard_email_change()

[src: supabase/migrations/20261013000000_recruiter_orgs.sql#guard_email_change]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.guard_email_change() | plpgsql | true | search_path="" | None | 20261013000000_recruiter_orgs.sql |

## private.host_of(p_url text)

[src: supabase/migrations/20261013000000_recruiter_orgs.sql#host_of]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.host_of(p_url text) | sql | false | search_path="" | None | 20261013000000_recruiter_orgs.sql |

## private.invite_org_member(p_email text, p_role org_role, p_token_hash text)

[src: supabase/migrations/20261013000000_recruiter_orgs.sql#invite_org_member]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.invite_org_member(p_email text, p_role org_role, p_token_hash text) | plpgsql | true | search_path="" | authenticated | 20261013000000_recruiter_orgs.sql |

## private.is_recruiter_domain(p_domain text)

[src: supabase/migrations/20261013000000_recruiter_orgs.sql#is_recruiter_domain]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.is_recruiter_domain(p_domain text) | sql | true | search_path="" | None | 20261013000000_recruiter_orgs.sql |

## private.my_blocked_companies()

[src: supabase/migrations/20261013000000_recruiter_orgs.sql#my_blocked_companies]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.my_blocked_companies() | plpgsql | true | search_path="" | authenticated | 20261013000000_recruiter_orgs.sql |

## private.my_org()

[src: supabase/migrations/20261013000000_recruiter_orgs.sql#my_org]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.my_org() | plpgsql | true | search_path="" | authenticated | 20261013000000_recruiter_orgs.sql |

## private.my_org_invites()

[src: supabase/migrations/20261013000000_recruiter_orgs.sql#my_org_invites]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.my_org_invites() | plpgsql | true | search_path="" | authenticated | 20261013000000_recruiter_orgs.sql |

## private.ops_org_case(p_org uuid)

[src: supabase/migrations/20261013000000_recruiter_orgs.sql#ops_org_case]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_org_case(p_org uuid) | plpgsql | true | search_path="" | authenticated | 20261013000000_recruiter_orgs.sql |

## private.ops_orgs(p_status text)

[src: supabase/migrations/20261013000000_recruiter_orgs.sql#ops_orgs]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_orgs(p_status text) | plpgsql | true | search_path="" | authenticated | 20261013000000_recruiter_orgs.sql |

## private.org_invite_preview(p_token_hash text)

[src: supabase/migrations/20261013000000_recruiter_orgs.sql#org_invite_preview]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.org_invite_preview(p_token_hash text) | sql | true | search_path="" | anon, authenticated | 20261013000000_recruiter_orgs.sql |

## private.org_members_list()

[src: supabase/migrations/20261013000000_recruiter_orgs.sql#org_members_list]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.org_members_list() | plpgsql | true | search_path="" | authenticated | 20261013000000_recruiter_orgs.sql |

## private.recruit_limit(p_key text)

[src: supabase/migrations/20261013000000_recruiter_orgs.sql#recruit_limit]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.recruit_limit(p_key text) | sql | true | search_path="" | None | 20261013000000_recruiter_orgs.sql |

## private.remove_org_member(p_user uuid)

[src: supabase/migrations/20261013000000_recruiter_orgs.sql#remove_org_member]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.remove_org_member(p_user uuid) | plpgsql | true | search_path="" | authenticated | 20261013000000_recruiter_orgs.sql |

## private.require_org(p_roles org_role[], p_need_verified boolean)

[src: supabase/migrations/20261013000000_recruiter_orgs.sql#require_org]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.require_org(p_roles org_role[], p_need_verified boolean) | plpgsql | true | search_path="" | None | 20261013000000_recruiter_orgs.sql |

## private.revoke_org_invite(p_id uuid)

[src: supabase/migrations/20261013000000_recruiter_orgs.sql#revoke_org_invite]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.revoke_org_invite(p_id uuid) | plpgsql | true | search_path="" | authenticated | 20261013000000_recruiter_orgs.sql |

## private.set_org_member_role(p_user uuid, p_role org_role)

[src: supabase/migrations/20261013000000_recruiter_orgs.sql#set_org_member_role]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.set_org_member_role(p_user uuid, p_role org_role) | plpgsql | true | search_path="" | authenticated | 20261013000000_recruiter_orgs.sql |

## private.slugify(p_name text)

[src: supabase/migrations/20261013000000_recruiter_orgs.sql#slugify]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.slugify(p_name text) | sql | false | search_path="" | None | 20261013000000_recruiter_orgs.sql |

## private.unblock_company(p_org uuid)

[src: supabase/migrations/20261013000000_recruiter_orgs.sql#unblock_company]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.unblock_company(p_org uuid) | plpgsql | true | search_path="" | authenticated | 20261013000000_recruiter_orgs.sql |

## private.update_company_page(p jsonb)

[src: supabase/migrations/20261013000000_recruiter_orgs.sql#update_company_page]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.update_company_page(p jsonb) | plpgsql | true | search_path="" | authenticated | 20261013000000_recruiter_orgs.sql |

## public.accept_org_invite(p_id uuid)

[src: supabase/migrations/20261013000000_recruiter_orgs.sql#accept_org_invite]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.accept_org_invite(p_id uuid) | sql | false | search_path="" | authenticated, service_role | 20261013000000_recruiter_orgs.sql |

## public.block_company(p_org uuid)

[src: supabase/migrations/20261013000000_recruiter_orgs.sql#block_company]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.block_company(p_org uuid) | sql | false | search_path="" | authenticated, service_role | 20261013000000_recruiter_orgs.sql |

## public.create_organization(p jsonb)

[src: supabase/migrations/20261013000000_recruiter_orgs.sql#create_organization]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.create_organization(p jsonb) | sql | false | search_path="" | authenticated, service_role | 20261013000000_recruiter_orgs.sql |

## public.decide_org(p_org uuid, p_action text, p_reason text)

[src: supabase/migrations/20261013000000_recruiter_orgs.sql#decide_org]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.decide_org(p_org uuid, p_action text, p_reason text) | sql | false | search_path="" | authenticated, service_role | 20261013000000_recruiter_orgs.sql |

## public.invite_org_member(p_email text, p_role org_role, p_token_hash text)

[src: supabase/migrations/20261013000000_recruiter_orgs.sql#invite_org_member]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.invite_org_member(p_email text, p_role org_role, p_token_hash text) | sql | false | search_path="" | authenticated, service_role | 20261013000000_recruiter_orgs.sql |

## public.my_blocked_companies()

[src: supabase/migrations/20261013000000_recruiter_orgs.sql#my_blocked_companies]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.my_blocked_companies() | sql | false | search_path="" | authenticated, service_role | 20261013000000_recruiter_orgs.sql |

## public.my_org()

[src: supabase/migrations/20261013000000_recruiter_orgs.sql#my_org]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.my_org() | sql | false | search_path="" | authenticated, service_role | 20261013000000_recruiter_orgs.sql |

## public.my_org_invites()

[src: supabase/migrations/20261013000000_recruiter_orgs.sql#my_org_invites]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.my_org_invites() | sql | false | search_path="" | authenticated, service_role | 20261013000000_recruiter_orgs.sql |

## public.ops_org_case(p_org uuid)

[src: supabase/migrations/20261013000000_recruiter_orgs.sql#ops_org_case]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_org_case(p_org uuid) | sql | false | search_path="" | authenticated, service_role | 20261013000000_recruiter_orgs.sql |

## public.ops_orgs(p_status text)

[src: supabase/migrations/20261013000000_recruiter_orgs.sql#ops_orgs]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_orgs(p_status text) | sql | false | search_path="" | authenticated, service_role | 20261013000000_recruiter_orgs.sql |

## public.org_invite_preview(p_token_hash text)

[src: supabase/migrations/20261013000000_recruiter_orgs.sql#org_invite_preview]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.org_invite_preview(p_token_hash text) | sql | false | search_path="" | anon, authenticated, service_role | 20261013000000_recruiter_orgs.sql |

## public.org_members_list()

[src: supabase/migrations/20261013000000_recruiter_orgs.sql#org_members_list]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.org_members_list() | sql | false | search_path="" | authenticated, service_role | 20261013000000_recruiter_orgs.sql |

## public.org_plan()

[src: supabase/migrations/20261013000000_recruiter_orgs.sql#org_plan]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.org_plan() | sql | false | search_path="" | authenticated, service_role | 20261013000000_recruiter_orgs.sql |

## public.remove_org_member(p_user uuid)

[src: supabase/migrations/20261013000000_recruiter_orgs.sql#remove_org_member]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.remove_org_member(p_user uuid) | sql | false | search_path="" | authenticated, service_role | 20261013000000_recruiter_orgs.sql |

## public.revoke_org_invite(p_id uuid)

[src: supabase/migrations/20261013000000_recruiter_orgs.sql#revoke_org_invite]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.revoke_org_invite(p_id uuid) | sql | false | search_path="" | authenticated, service_role | 20261013000000_recruiter_orgs.sql |

## public.set_org_member_role(p_user uuid, p_role org_role)

[src: supabase/migrations/20261013000000_recruiter_orgs.sql#set_org_member_role]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.set_org_member_role(p_user uuid, p_role org_role) | sql | false | search_path="" | authenticated, service_role | 20261013000000_recruiter_orgs.sql |

## public.unblock_company(p_org uuid)

[src: supabase/migrations/20261013000000_recruiter_orgs.sql#unblock_company]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.unblock_company(p_org uuid) | sql | false | search_path="" | authenticated, service_role | 20261013000000_recruiter_orgs.sql |

## public.update_company_page(p jsonb)

[src: supabase/migrations/20261013000000_recruiter_orgs.sql#update_company_page]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.update_company_page(p jsonb) | sql | false | search_path="" | authenticated, service_role | 20261013000000_recruiter_orgs.sql |

## public.company_blocks

[src: supabase/migrations/20261013000000_recruiter_orgs.sql#company_blocks]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| student_id | uuid | true | — |  |  | — |
| org_id | uuid | true | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
company_blocks_org_id_fkey: FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE; -- validated: true
```

```sql
company_blocks_pkey: PRIMARY KEY (student_id, org_id); -- validated: true
```

```sql
company_blocks_student_id_fkey: FOREIGN KEY (student_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE INDEX company_blocks_org_idx ON public.company_blocks USING btree (org_id); -- valid: true
```

```sql
CREATE UNIQUE INDEX company_blocks_pkey ON public.company_blocks USING btree (student_id, org_id); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.org_invites

[src: supabase/migrations/20261013000000_recruiter_orgs.sql#org_invites]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| org_id | uuid | true | — |  |  | — |
| email | text | true | — |  |  | "default" |
| role | org_role | true | — |  |  | — |
| token_hash | text | true | — |  |  | "default" |
| invited_by | uuid | false | — |  |  | — |
| expires_at | timestamp with time zone | true | — |  |  | — |
| used_at | timestamp with time zone | false | — |  |  | — |
| revoked_at | timestamp with time zone | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
org_invites_email_check: CHECK (email = lower(email) AND char_length(email) <= 254); -- validated: true
```

```sql
org_invites_invited_by_fkey: FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
org_invites_org_id_fkey: FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE; -- validated: true
```

```sql
org_invites_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
org_invites_token_hash_check: CHECK (token_hash ~ '^[0-9a-f]{64}$'::text); -- validated: true
```

```sql
org_invites_token_hash_key: UNIQUE (token_hash); -- validated: true
```

### Indexes

```sql
CREATE INDEX org_invites_email_idx ON public.org_invites USING btree (email) WHERE ((used_at IS NULL) AND (revoked_at IS NULL)); -- valid: true
```

```sql
CREATE INDEX org_invites_org_idx ON public.org_invites USING btree (org_id, created_at DESC); -- valid: true
```

```sql
CREATE UNIQUE INDEX org_invites_pkey ON public.org_invites USING btree (id); -- valid: true
```

```sql
CREATE UNIQUE INDEX org_invites_token_hash_key ON public.org_invites USING btree (token_hash); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.org_members

[src: supabase/migrations/20261013000000_recruiter_orgs.sql#org_members]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| org_id | uuid | true | — |  |  | — |
| user_id | uuid | true | — |  |  | — |
| role | org_role | true | — |  |  | — |
| status | text | true | 'active'::text |  |  | "default" |
| invited_by | uuid | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |
| seat_keep | boolean | true | false |  |  | — |

### Keys and constraints

```sql
org_members_invited_by_fkey: FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
org_members_org_id_fkey: FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE; -- validated: true
```

```sql
org_members_pkey: PRIMARY KEY (org_id, user_id); -- validated: true
```

```sql
org_members_status_check: CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text])); -- validated: true
```

```sql
org_members_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

```sql
org_members_user_id_key: UNIQUE (user_id); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX org_members_pkey ON public.org_members USING btree (org_id, user_id); -- valid: true
```

```sql
CREATE UNIQUE INDEX org_members_user_id_key ON public.org_members USING btree (user_id); -- valid: true
```

```sql
CREATE INDEX org_members_user_idx ON public.org_members USING btree (user_id); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.organizations

[src: supabase/migrations/20261013000000_recruiter_orgs.sql#organizations]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| slug | text | true | — |  |  | "default" |
| name | text | true | — |  |  | "default" |
| domain | text | true | — |  |  | "default" |
| website | text | true | — |  |  | "default" |
| industry | text | true | — |  |  | "default" |
| size | text | true | — |  |  | "default" |
| city | text | true | — |  |  | "default" |
| about | text | false | — |  |  | "default" |
| locations | text[] | true | '{}'::text[] |  |  | "default" |
| linkedin_url | text | false | — |  |  | "default" |
| registration_number | text | false | — |  |  | "default" |
| signer_role | text | true | — |  |  | "default" |
| status | org_status | true | 'pending'::org_status |  |  | — |
| status_reason | text | false | — |  |  | "default" |
| verified_by | uuid | false | — |  |  | — |
| verified_at | timestamp with time zone | false | — |  |  | — |
| created_by | uuid | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |
| updated_at | timestamp with time zone | true | now() |  |  | — |
| province | text | false | — |  |  | "default" |
| billing_ntn | text | false | — |  |  | "default" |
| billing_address | text | false | — |  |  | "default" |
| registration_doc_path | text | false | — |  |  | "default" |
| registration_doc_bytes | integer | false | — |  |  | — |
| registration_doc_at | timestamp with time zone | false | — |  |  | — |

### Keys and constraints

```sql
organizations_about_check: CHECK (about IS NULL OR char_length(about) <= 1500); -- validated: true
```

```sql
organizations_billing_address_check: CHECK (billing_address IS NULL OR char_length(btrim(billing_address)) >= 5 AND char_length(btrim(billing_address)) <= 300); -- validated: true
```

```sql
organizations_billing_ntn_check: CHECK (billing_ntn IS NULL OR char_length(btrim(billing_ntn)) >= 3 AND char_length(btrim(billing_ntn)) <= 30); -- validated: true
```

```sql
organizations_city_check: CHECK (char_length(btrim(city)) >= 2 AND char_length(btrim(city)) <= 60); -- validated: true
```

```sql
organizations_created_by_fkey: FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
organizations_doc_complete: CHECK ((registration_doc_path IS NULL) = (registration_doc_bytes IS NULL)); -- validated: true
```

```sql
organizations_domain_check: CHECK (domain ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'::text); -- validated: true
```

```sql
organizations_domain_key: UNIQUE (domain); -- validated: true
```

```sql
organizations_industry_check: CHECK (char_length(btrim(industry)) >= 2 AND char_length(btrim(industry)) <= 60); -- validated: true
```

```sql
organizations_linkedin_url_check: CHECK (linkedin_url IS NULL OR linkedin_url ~ '^https://([a-z]{2,3}\.)?linkedin\.com/[^[:space:]]+$'::text AND char_length(linkedin_url) <= 200); -- validated: true
```

```sql
organizations_locations_check: CHECK (cardinality(locations) <= 10); -- validated: true
```

```sql
organizations_name_check: CHECK (char_length(btrim(name)) >= 2 AND char_length(btrim(name)) <= 80); -- validated: true
```

```sql
organizations_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
organizations_province_check: CHECK (province IS NULL OR (province = ANY (ARRAY['Punjab'::text, 'Sindh'::text, 'KP'::text, 'Balochistan'::text, 'ICT'::text, 'AJK'::text, 'GB'::text]))); -- validated: true
```

```sql
organizations_registration_doc_bytes_check: CHECK (registration_doc_bytes IS NULL OR registration_doc_bytes >= 1 AND registration_doc_bytes <= 5242880); -- validated: true
```

```sql
organizations_registration_doc_path_check: CHECK (registration_doc_path IS NULL OR registration_doc_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|webp)$'::text); -- validated: true
```

```sql
organizations_registration_number_check: CHECK (registration_number IS NULL OR char_length(registration_number) <= 60); -- validated: true
```

```sql
organizations_signer_role_check: CHECK (char_length(btrim(signer_role)) >= 2 AND char_length(btrim(signer_role)) <= 60); -- validated: true
```

```sql
organizations_size_check: CHECK (size = ANY (ARRAY['1-10'::text, '11-50'::text, '51-200'::text, '201-1000'::text, '1000+'::text])); -- validated: true
```

```sql
organizations_slug_check: CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$'::text); -- validated: true
```

```sql
organizations_slug_key: UNIQUE (slug); -- validated: true
```

```sql
organizations_status_reason_check: CHECK (status_reason IS NULL OR char_length(status_reason) <= 2000); -- validated: true
```

```sql
organizations_verified_by_fkey: FOREIGN KEY (verified_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
organizations_website_check: CHECK (website ~ '^https://[^[:space:]]+$'::text AND char_length(website) <= 200); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX organizations_domain_key ON public.organizations USING btree (domain); -- valid: true
```

```sql
CREATE UNIQUE INDEX organizations_pkey ON public.organizations USING btree (id); -- valid: true
```

```sql
CREATE UNIQUE INDEX organizations_slug_key ON public.organizations USING btree (slug); -- valid: true
```

```sql
CREATE INDEX organizations_status_idx ON public.organizations USING btree (status, created_at); -- valid: true
```

### Policies

None.

### Triggers

```sql
CREATE TRIGGER billing_forget_org AFTER DELETE ON organizations FOR EACH ROW EXECUTE FUNCTION private.billing_forget_subject(); -- enabled: O
```

```sql
CREATE TRIGGER organizations_set_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION private.set_updated_at(); -- enabled: O
```
