Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# github_evidence

## private.github_job_advance(p_job bigint, p_messages jsonb, p_commits integer, p_stage text)

[src: supabase/migrations/20260928150000_github_evidence.sql#github_job_advance]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.github_job_advance(p_job bigint, p_messages jsonb, p_commits integer, p_stage text) | plpgsql | true | search_path="" | None | 20260928150000_github_evidence.sql |

## private.github_nightly_sync()

[src: supabase/migrations/20260928150000_github_evidence.sql#github_nightly_sync]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.github_nightly_sync() | plpgsql | true | search_path="" | None | 20260928150000_github_evidence.sql |

## private.github_user_repos_recompute()

[src: supabase/migrations/20260928150000_github_evidence.sql#github_user_repos_recompute]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.github_user_repos_recompute() | plpgsql | true | search_path="" | None | 20260928150000_github_evidence.sql |

## private.open_review_flag(p_user uuid, p_kind review_flag_kind, p_key text, p_refs jsonb, p_commits jsonb)

[src: supabase/migrations/20260928150000_github_evidence.sql#open_review_flag]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.open_review_flag(p_user uuid, p_kind review_flag_kind, p_key text, p_refs jsonb, p_commits jsonb) | plpgsql | true | search_path="" | None | 20260928150000_github_evidence.sql |

## private.process_github_webhook(p_delivery_id uuid)

[src: supabase/migrations/20260928150000_github_evidence.sql#process_github_webhook]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.process_github_webhook(p_delivery_id uuid) | plpgsql | true | search_path="" | None | 20260928150000_github_evidence.sql |

## private.refresh_github_login(p_user uuid, p_github_id bigint, p_login text)

[src: supabase/migrations/20260928150000_github_evidence.sql#refresh_github_login]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.refresh_github_login(p_user uuid, p_github_id bigint, p_login text) | sql | true | search_path="" | None | 20260928150000_github_evidence.sql |

## private.review_flag_details(p_flag bigint)

[src: supabase/migrations/20260928150000_github_evidence.sql#review_flag_details]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.review_flag_details(p_flag bigint) | plpgsql | true | search_path="" | authenticated | 20260928150000_github_evidence.sql |

## private.set_repo_details(p_repo bigint, p_languages text[], p_upstream_blobs text[])

[src: supabase/migrations/20260928150000_github_evidence.sql#set_repo_details]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.set_repo_details(p_repo bigint, p_languages text[], p_upstream_blobs text[]) | plpgsql | true | search_path="" | None | 20260928150000_github_evidence.sql |

## private.set_repo_linguist_excludes(p_repo bigint, p_globs text[])

[src: supabase/migrations/20260928150000_github_evidence.sql#set_repo_linguist_excludes]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.set_repo_linguist_excludes(p_repo bigint, p_globs text[]) | sql | true | search_path="" | None | 20260928150000_github_evidence.sql |

## private.start_github_sync(p_user uuid, p_trigger text)

[src: supabase/migrations/20260928150000_github_evidence.sql#start_github_sync]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.start_github_sync(p_user uuid, p_trigger text) | plpgsql | true | search_path="" | None | 20260928150000_github_evidence.sql |

## public.resolve_review_flag(p_flag bigint, p_upheld boolean, p_note text)

[src: supabase/migrations/20260928150000_github_evidence.sql#resolve_review_flag]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.resolve_review_flag(p_flag bigint, p_upheld boolean, p_note text) | sql | false | search_path="" | authenticated, service_role | 20260928150000_github_evidence.sql |

## public.review_flag_details(p_flag bigint)

[src: supabase/migrations/20260928150000_github_evidence.sql#review_flag_details]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.review_flag_details(p_flag bigint) | sql | false | search_path="" | authenticated, service_role | 20260928150000_github_evidence.sql |

## private.github_commit_blobs

[src: supabase/migrations/20260928150000_github_evidence.sql#github_commit_blobs]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| blob_sha | text | true | — |  |  | "default" |
| user_id | uuid | true | — |  |  | — |
| repo_id | bigint | true | — |  |  | — |
| sha | text | true | — |  |  | "default" |

### Keys and constraints

```sql
github_commit_blobs_blob_sha_check: CHECK (blob_sha ~ '^[0-9a-f]{40}$'::text); -- validated: true
```

```sql
github_commit_blobs_pkey: PRIMARY KEY (blob_sha, user_id, repo_id, sha); -- validated: true
```

```sql
github_commit_blobs_user_id_repo_id_sha_fkey: FOREIGN KEY (user_id, repo_id, sha) REFERENCES github_commits(user_id, repo_id, sha) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE INDEX github_commit_blobs_commit_idx ON private.github_commit_blobs USING btree (user_id, repo_id, sha); -- valid: true
```

```sql
CREATE UNIQUE INDEX github_commit_blobs_pkey ON private.github_commit_blobs USING btree (blob_sha, user_id, repo_id, sha); -- valid: true
```

### Policies

None.

### Triggers

None.

## private.github_upstream_blobs

[src: supabase/migrations/20260928150000_github_evidence.sql#github_upstream_blobs]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| repo_id | bigint | true | — |  |  | — |
| blob_sha | text | true | — |  |  | "default" |

### Keys and constraints

```sql
github_upstream_blobs_blob_sha_check: CHECK (blob_sha ~ '^[0-9a-f]{40}$'::text); -- validated: true
```

```sql
github_upstream_blobs_pkey: PRIMARY KEY (repo_id, blob_sha); -- validated: true
```

```sql
github_upstream_blobs_repo_id_fkey: FOREIGN KEY (repo_id) REFERENCES github_repos(repo_id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX github_upstream_blobs_pkey ON private.github_upstream_blobs USING btree (repo_id, blob_sha); -- valid: true
```

### Policies

None.

### Triggers

None.

## private.review_flag_commits

[src: supabase/migrations/20260928150000_github_evidence.sql#review_flag_commits]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| flag_id | bigint | true | — |  |  | — |
| user_id | uuid | true | — |  |  | — |
| repo_id | bigint | true | — |  |  | — |
| sha | text | true | — |  |  | "default" |

### Keys and constraints

```sql
review_flag_commits_flag_id_fkey: FOREIGN KEY (flag_id) REFERENCES review_flags(id) ON DELETE CASCADE; -- validated: true
```

```sql
review_flag_commits_pkey: PRIMARY KEY (flag_id, user_id, repo_id, sha); -- validated: true
```

```sql
review_flag_commits_user_id_repo_id_sha_fkey: FOREIGN KEY (user_id, repo_id, sha) REFERENCES github_commits(user_id, repo_id, sha) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE INDEX review_flag_commits_commit_idx ON private.review_flag_commits USING btree (user_id, repo_id, sha); -- valid: true
```

```sql
CREATE UNIQUE INDEX review_flag_commits_pkey ON private.review_flag_commits USING btree (flag_id, user_id, repo_id, sha); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.github_commits

[src: supabase/migrations/20260928150000_github_evidence.sql#github_commits]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| user_id | uuid | true | — |  |  | — |
| repo_id | bigint | true | — |  |  | — |
| sha | text | true | — |  |  | "default" |
| authored_at | timestamp with time zone | false | — |  |  | — |
| occurred_at | timestamp with time zone | true | — |  |  | — |
| seen_via | text | true | — |  |  | "default" |
| signed | boolean | true | false |  |  | — |
| files | integer | true | 0 |  |  | — |
| meaningful_lines | integer | true | 0 |  |  | — |
| status | github_commit_status | true | 'pending'::github_commit_status |  |  | — |
| exclusion | text | false | — |  |  | "default" |
| first_seen_at | timestamp with time zone | true | now() |  |  | — |
| extracted_at | timestamp with time zone | false | — |  |  | — |
| ai_agent | text | false | — |  |  | "default" |
| via_pr | integer | false | — |  |  | — |

### Keys and constraints

```sql
github_commits_agent_via_pr: CHECK (ai_agent IS NULL OR via_pr IS NOT NULL); -- validated: true
```

```sql
github_commits_ai_agent_check: CHECK (ai_agent IS NULL OR char_length(ai_agent) >= 3 AND char_length(ai_agent) <= 200); -- validated: true
```

```sql
github_commits_exclusion_check: CHECK (exclusion IS NULL OR (exclusion = ANY (ARRAY['merge'::text, 'too_many_files'::text, 'rename_only'::text, 'formatting_only'::text, 'bulk_import'::text, 'rewritten'::text, 'review'::text]))); -- validated: true
```

```sql
github_commits_files_check: CHECK (files >= 0); -- validated: true
```

```sql
github_commits_meaningful_lines_check: CHECK (meaningful_lines >= 0 AND meaningful_lines <= 400); -- validated: true
```

```sql
github_commits_pkey: PRIMARY KEY (user_id, repo_id, sha); -- validated: true
```

```sql
github_commits_seen_via_check: CHECK (seen_via = ANY (ARRAY['harvest'::text, 'push'::text])); -- validated: true
```

```sql
github_commits_sha_check: CHECK (sha ~ '^[0-9a-f]{40}$'::text); -- validated: true
```

```sql
github_commits_user_id_repo_id_fkey: FOREIGN KEY (user_id, repo_id) REFERENCES github_user_repos(user_id, repo_id) ON DELETE CASCADE; -- validated: true
```

```sql
github_commits_via_pr_check: CHECK (via_pr IS NULL OR via_pr > 0); -- validated: true
```

### Indexes

```sql
CREATE INDEX github_commits_agent_idx ON public.github_commits USING btree (user_id, repo_id) WHERE (ai_agent IS NOT NULL); -- valid: true
```

```sql
CREATE INDEX github_commits_pending_idx ON public.github_commits USING btree (user_id, repo_id) WHERE (extracted_at IS NULL); -- valid: true
```

```sql
CREATE UNIQUE INDEX github_commits_pkey ON public.github_commits USING btree (user_id, repo_id, sha); -- valid: true
```

```sql
CREATE INDEX github_commits_user_occurred_idx ON public.github_commits USING btree (user_id, occurred_at); -- valid: true
```

### Policies

#### github_commits.github_commits_read_own

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
CREATE TRIGGER github_commit_contributions AFTER INSERT OR UPDATE OF status ON github_commits FOR EACH ROW EXECUTE FUNCTION private.github_commit_contributions(); -- enabled: O
```

## public.review_flags

[src: supabase/migrations/20260928150000_github_evidence.sql#review_flags]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | bigint | true | — | a |  | — |
| user_id | uuid | true | — |  |  | — |
| kind | review_flag_kind | true | — |  |  | — |
| key | text | true | — |  |  | "default" |
| refs | jsonb | true | '{}'::jsonb |  |  | — |
| status | review_flag_status | true | 'open'::review_flag_status |  |  | — |
| reviewer_id | uuid | false | — |  |  | — |
| note | text | false | — |  |  | "default" |
| created_at | timestamp with time zone | true | now() |  |  | — |
| resolved_at | timestamp with time zone | false | — |  |  | — |
| claimed_by | uuid | false | — |  |  | — |
| claimed_at | timestamp with time zone | false | — |  |  | — |

### Keys and constraints

```sql
review_flags_claimed_by_fkey: FOREIGN KEY (claimed_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
review_flags_key_check: CHECK (char_length(key) >= 1 AND char_length(key) <= 100); -- validated: true
```

```sql
review_flags_note_check: CHECK (note IS NULL OR char_length(note) <= 2000); -- validated: true
```

```sql
review_flags_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
review_flags_refs_check: CHECK (jsonb_typeof(refs) = 'object'::text); -- validated: true
```

```sql
review_flags_reviewer_id_fkey: FOREIGN KEY (reviewer_id) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
review_flags_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

```sql
review_flags_user_id_kind_key_key: UNIQUE (user_id, kind, key); -- validated: true
```

### Indexes

```sql
CREATE INDEX review_flags_claimed_by_idx ON public.review_flags USING btree (claimed_by) WHERE (claimed_by IS NOT NULL); -- valid: true
```

```sql
CREATE INDEX review_flags_open_idx ON public.review_flags USING btree (created_at) WHERE (status = 'open'::review_flag_status); -- valid: true
```

```sql
CREATE UNIQUE INDEX review_flags_pkey ON public.review_flags USING btree (id); -- valid: true
```

```sql
CREATE INDEX review_flags_reviewer_idx ON public.review_flags USING btree (reviewer_id) WHERE (reviewer_id IS NOT NULL); -- valid: true
```

```sql
CREATE UNIQUE INDEX review_flags_user_id_kind_key_key ON public.review_flags USING btree (user_id, kind, key); -- valid: true
```

### Policies

#### review_flags.review_flags_read

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT private.is_staff('trust_reviewer'::staff_role) AS is_staff))",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

### Triggers

None.

## public.skill_evidence

[src: supabase/migrations/20260928150000_github_evidence.sql#skill_evidence]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | bigint | true | — | a |  | — |
| user_id | uuid | true | — |  |  | — |
| skill_id | text | true | — |  |  | "default" |
| source | text | true | 'commit'::text |  |  | "default" |
| repo_id | bigint | true | — |  |  | — |
| sha | text | true | — |  |  | "default" |
| detectors | text[] | true | — |  |  | "default" |
| paths | text[] | true | '{}'::text[] |  |  | "default" |
| lines | integer | true | 0 |  |  | — |
| occurred_at | timestamp with time zone | true | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
skill_evidence_detectors_check: CHECK (detectors <@ ARRAY['lines'::text, 'file'::text, 'path'::text, 'manifest'::text, 'import'::text] AND cardinality(detectors) > 0); -- validated: true
```

```sql
skill_evidence_lines_check: CHECK (lines >= 0 AND lines <= 400); -- validated: true
```

```sql
skill_evidence_paths_check: CHECK (cardinality(paths) <= 10); -- validated: true
```

```sql
skill_evidence_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
skill_evidence_skill_id_fkey: FOREIGN KEY (skill_id) REFERENCES skills(id); -- validated: true
```

```sql
skill_evidence_source_check: CHECK (source = 'commit'::text); -- validated: true
```

```sql
skill_evidence_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

```sql
skill_evidence_user_id_repo_id_sha_fkey: FOREIGN KEY (user_id, repo_id, sha) REFERENCES github_commits(user_id, repo_id, sha) ON DELETE CASCADE; -- validated: true
```

```sql
skill_evidence_user_id_repo_id_sha_skill_id_key: UNIQUE (user_id, repo_id, sha, skill_id); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX skill_evidence_pkey ON public.skill_evidence USING btree (id); -- valid: true
```

```sql
CREATE INDEX skill_evidence_skill_idx ON public.skill_evidence USING btree (skill_id); -- valid: true
```

```sql
CREATE UNIQUE INDEX skill_evidence_user_id_repo_id_sha_skill_id_key ON public.skill_evidence USING btree (user_id, repo_id, sha, skill_id); -- valid: true
```

```sql
CREATE INDEX skill_evidence_user_skill_idx ON public.skill_evidence USING btree (user_id, skill_id); -- valid: true
```

### Policies

#### skill_evidence.skill_evidence_read_own

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

## public.user_skills

[src: supabase/migrations/20260928150000_github_evidence.sql#user_skills]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| user_id | uuid | true | — |  |  | — |
| skill_id | text | true | — |  |  | "default" |
| level | smallint | true | — |  |  | — |
| active_days | integer | true | 0 |  |  | — |
| lines | integer | true | 0 |  |  | — |
| hits | integer | true | 0 |  |  | — |
| repos | integer | true | 0 |  |  | — |
| last_used_at | timestamp with time zone | false | — |  |  | — |
| updated_at | timestamp with time zone | true | now() |  |  | — |
| peer_verified | boolean | true | false |  |  | — |
| ai_lines | integer | true | 0 |  |  | — |
| ai_assisted | boolean | true | false |  |  | — |

### Keys and constraints

```sql
user_skills_active_days_check: CHECK (active_days >= 0); -- validated: true
```

```sql
user_skills_hits_check: CHECK (hits >= 0); -- validated: true
```

```sql
user_skills_level_check: CHECK (level >= 0 AND level <= 4); -- validated: true
```

```sql
user_skills_lines_check: CHECK (lines >= 0); -- validated: true
```

```sql
user_skills_pkey: PRIMARY KEY (user_id, skill_id); -- validated: true
```

```sql
user_skills_repos_check: CHECK (repos >= 0); -- validated: true
```

```sql
user_skills_skill_id_fkey: FOREIGN KEY (skill_id) REFERENCES skills(id); -- validated: true
```

```sql
user_skills_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX user_skills_pkey ON public.user_skills USING btree (user_id, skill_id); -- valid: true
```

```sql
CREATE INDEX user_skills_skill_level_idx ON public.user_skills USING btree (skill_id, level); -- valid: true
```

### Policies

#### user_skills.user_skills_read

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "((user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1\n   FROM profiles p\n  WHERE (p.user_id = user_skills.user_id))))",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

### Triggers

```sql
CREATE TRIGGER user_skills_analytics_insert AFTER INSERT ON user_skills FOR EACH ROW WHEN (new.level >= 2) EXECUTE FUNCTION private.analytics_first_l2(); -- enabled: O
```

```sql
CREATE TRIGGER user_skills_analytics_update AFTER UPDATE OF level ON user_skills FOR EACH ROW WHEN (new.level >= 2 AND old.level < 2) EXECUTE FUNCTION private.analytics_first_l2(); -- enabled: O
```

```sql
CREATE TRIGGER user_skills_peer_verified BEFORE INSERT ON user_skills FOR EACH ROW EXECUTE FUNCTION private.user_skills_peer_verified(); -- enabled: O
```
