Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# skill_levels

## private.correct_contribution(p_original uuid, p_kind contribution_kind, p_description text, p_evidence_url text, p_hours numeric, p_skill_ids text[])

[src: supabase/migrations/20261002000000_skill_levels.sql#correct_contribution]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.correct_contribution(p_original uuid, p_kind contribution_kind, p_description text, p_evidence_url text, p_hours numeric, p_skill_ids text[]) | plpgsql | true | search_path="" | authenticated | 20261002000000_skill_levels.sql |

## private.endorse(p_endorsee uuid, p_venture uuid, p_items jsonb, p_note text)

[src: supabase/migrations/20261002000000_skill_levels.sql#endorse]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.endorse(p_endorsee uuid, p_venture uuid, p_items jsonb, p_note text) | plpgsql | true | search_path="" | authenticated | 20261002000000_skill_levels.sql |

## private.endorse_options(p_venture uuid)

[src: supabase/migrations/20261002000000_skill_levels.sql#endorse_options]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.endorse_options(p_venture uuid) | plpgsql | true | search_path="" | authenticated | 20261002000000_skill_levels.sql |

## private.entry_shows_skill(p_entry uuid, p_skill text)

[src: supabase/migrations/20261002000000_skill_levels.sql#entry_shows_skill]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.entry_shows_skill(p_entry uuid, p_skill text) | sql | true | search_path="" | None | 20261002000000_skill_levels.sql |

## private.entry_skills(p_venture uuid, p_skills text[])

[src: supabase/migrations/20261002000000_skill_levels.sql#entry_skills]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.entry_skills(p_venture uuid, p_skills text[]) | plpgsql | true | search_path="" | None | 20261002000000_skill_levels.sql |

## private.github_webhook_pr(p_delivery_id uuid)

[src: supabase/migrations/20261002000000_skill_levels.sql#github_webhook_pr]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.github_webhook_pr(p_delivery_id uuid) | plpgsql | true | search_path="" | None | 20261002000000_skill_levels.sql |

## private.known_pull_requests(p_user uuid)

[src: supabase/migrations/20261002000000_skill_levels.sql#known_pull_requests]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.known_pull_requests(p_user uuid) | sql | true | search_path="" | None | 20261002000000_skill_levels.sql |

## private.log_contribution(p_venture uuid, p_kind contribution_kind, p_description text, p_evidence_url text, p_hours numeric, p_skill_ids text[])

[src: supabase/migrations/20261002000000_skill_levels.sql#log_contribution]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.log_contribution(p_venture uuid, p_kind contribution_kind, p_description text, p_evidence_url text, p_hours numeric, p_skill_ids text[]) | plpgsql | true | search_path="" | authenticated | 20261002000000_skill_levels.sql |

## private.recompute_confirmed_authors()

[src: supabase/migrations/20261002000000_skill_levels.sql#recompute_confirmed_authors]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.recompute_confirmed_authors() | plpgsql | true | search_path="" | None | 20261002000000_skill_levels.sql |

## private.recompute_corrected_authors()

[src: supabase/migrations/20261002000000_skill_levels.sql#recompute_corrected_authors]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.recompute_corrected_authors() | plpgsql | true | search_path="" | None | 20261002000000_skill_levels.sql |

## private.recompute_endorsees()

[src: supabase/migrations/20261002000000_skill_levels.sql#recompute_endorsees]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.recompute_endorsees() | plpgsql | true | search_path="" | None | 20261002000000_skill_levels.sql |

## private.record_pull_request(p_user uuid, p jsonb)

[src: supabase/migrations/20261002000000_skill_levels.sql#record_pull_request]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.record_pull_request(p_user uuid, p jsonb) | plpgsql | true | search_path="" | None | 20261002000000_skill_levels.sql |

## public.correct_contribution(p_original uuid, p_kind contribution_kind, p_description text, p_evidence_url text, p_hours numeric, p_skill_ids text[])

[src: supabase/migrations/20261002000000_skill_levels.sql#correct_contribution]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.correct_contribution(p_original uuid, p_kind contribution_kind, p_description text, p_evidence_url text, p_hours numeric, p_skill_ids text[]) | sql | false | search_path="" | authenticated, service_role | 20261002000000_skill_levels.sql |

## public.log_contribution(p_venture uuid, p_kind contribution_kind, p_description text, p_evidence_url text, p_hours numeric, p_skill_ids text[])

[src: supabase/migrations/20261002000000_skill_levels.sql#log_contribution]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.log_contribution(p_venture uuid, p_kind contribution_kind, p_description text, p_evidence_url text, p_hours numeric, p_skill_ids text[]) | sql | false | search_path="" | authenticated, service_role | 20261002000000_skill_levels.sql |

## public.my_skill_proofs(p_skill text)

[src: supabase/migrations/20261002000000_skill_levels.sql#my_skill_proofs]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.my_skill_proofs(p_skill text) | sql | false | search_path="" | authenticated, service_role | 20261002000000_skill_levels.sql |

## public.github_pr_skills

[src: supabase/migrations/20261002000000_skill_levels.sql#github_pr_skills]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| user_id | uuid | true | — |  |  | — |
| repo_github_id | bigint | true | — |  |  | — |
| number | integer | true | — |  |  | — |
| skill_id | text | true | — |  |  | "default" |
| paths | text[] | true | '{}'::text[] |  |  | "default" |

### Keys and constraints

```sql
github_pr_skills_paths_check: CHECK (cardinality(paths) <= 10); -- validated: true
```

```sql
github_pr_skills_pkey: PRIMARY KEY (user_id, repo_github_id, number, skill_id); -- validated: true
```

```sql
github_pr_skills_skill_id_fkey: FOREIGN KEY (skill_id) REFERENCES skills(id); -- validated: true
```

```sql
github_pr_skills_user_id_repo_github_id_number_fkey: FOREIGN KEY (user_id, repo_github_id, number) REFERENCES github_pull_requests(user_id, repo_github_id, number) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX github_pr_skills_pkey ON public.github_pr_skills USING btree (user_id, repo_github_id, number, skill_id); -- valid: true
```

```sql
CREATE INDEX github_pr_skills_skill_idx ON public.github_pr_skills USING btree (skill_id); -- valid: true
```

### Policies

#### github_pr_skills.github_pr_skills_read_own

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

## public.github_pull_requests

[src: supabase/migrations/20261002000000_skill_levels.sql#github_pull_requests]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| user_id | uuid | true | — |  |  | — |
| repo_github_id | bigint | true | — |  |  | — |
| number | integer | true | — |  |  | — |
| pr_github_id | bigint | true | — |  |  | — |
| repo_full_name | text | true | — |  |  | "default" |
| repo_private | boolean | true | — |  |  | — |
| merged_at | timestamp with time zone | true | — |  |  | — |
| approver_github_id | bigint | false | — |  |  | — |
| counted | boolean | true | — |  |  | — |
| exclusion | text | false | — |  |  | "default" |
| files | integer | true | 0 |  |  | — |
| seen_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
github_pull_requests_check: CHECK (counted = (exclusion IS NULL)); -- validated: true
```

```sql
github_pull_requests_check1: CHECK (NOT counted OR approver_github_id IS NOT NULL); -- validated: true
```

```sql
github_pull_requests_exclusion_check: CHECK (exclusion IS NULL OR (exclusion = ANY (ARRAY['own_repo'::text, 'no_other_human'::text, 'young_account'::text]))); -- validated: true
```

```sql
github_pull_requests_files_check: CHECK (files >= 0); -- validated: true
```

```sql
github_pull_requests_number_check: CHECK (number > 0); -- validated: true
```

```sql
github_pull_requests_pkey: PRIMARY KEY (user_id, repo_github_id, number); -- validated: true
```

```sql
github_pull_requests_repo_full_name_check: CHECK (char_length(repo_full_name) >= 3 AND char_length(repo_full_name) <= 140); -- validated: true
```

```sql
github_pull_requests_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE INDEX github_pull_requests_counted_idx ON public.github_pull_requests USING btree (user_id, merged_at) WHERE counted; -- valid: true
```

```sql
CREATE UNIQUE INDEX github_pull_requests_pkey ON public.github_pull_requests USING btree (user_id, repo_github_id, number); -- valid: true
```

### Policies

#### github_pull_requests.github_pull_requests_read_own

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
