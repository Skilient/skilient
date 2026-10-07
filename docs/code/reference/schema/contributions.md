Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# contributions

## private.github_commit_contributions()

[src: supabase/migrations/20260928210000_contributions.sql#github_commit_contributions]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.github_commit_contributions() | plpgsql | true | search_path="" | None | 20260928210000_contributions.sql |

## private.require_contributor(p_venture uuid)

[src: supabase/migrations/20260928210000_contributions.sql#require_contributor]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.require_contributor(p_venture uuid) | plpgsql | true | search_path="" | authenticated | 20260928210000_contributions.sql |

## private.transition_venture(p_venture uuid, p_to venture_status)

[src: supabase/migrations/20260928210000_contributions.sql#transition_venture]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.transition_venture(p_venture uuid, p_to venture_status) | plpgsql | true | search_path="" | authenticated | 20260928210000_contributions.sql |

## private.venture_member_commits()

[src: supabase/migrations/20260928210000_contributions.sql#venture_member_commits]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.venture_member_commits() | plpgsql | true | search_path="" | None | 20260928210000_contributions.sql |

## private.venture_repo_commits()

[src: supabase/migrations/20260928210000_contributions.sql#venture_repo_commits]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.venture_repo_commits() | plpgsql | true | search_path="" | None | 20260928210000_contributions.sql |

## private.venture_verified_contributors(p_venture uuid)

[src: supabase/migrations/20260928210000_contributions.sql#venture_verified_contributors]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.venture_verified_contributors(p_venture uuid) | sql | true | search_path="" | authenticated | 20260928210000_contributions.sql |

## public.confirm_contribution(p_entry uuid)

[src: supabase/migrations/20260928210000_contributions.sql#confirm_contribution]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.confirm_contribution(p_entry uuid) | sql | false | search_path="" | authenticated, service_role | 20260928210000_contributions.sql |

## public.venture_verified_contributors(p_venture uuid)

[src: supabase/migrations/20260928210000_contributions.sql#venture_verified_contributors]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.venture_verified_contributors(p_venture uuid) | sql | false | search_path="" | authenticated, service_role | 20260928210000_contributions.sql |

## public.contribution_confirmations

[src: supabase/migrations/20260928210000_contributions.sql#contribution_confirmations]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| contribution_id | uuid | true | — |  |  | — |
| confirmer_id | uuid | true | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |
| confirmer_role | text | true | 'peer'::text |  |  | "default" |

### Keys and constraints

```sql
contribution_confirmations_confirmer_id_fkey: FOREIGN KEY (confirmer_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

```sql
contribution_confirmations_confirmer_role_check: CHECK (confirmer_role = ANY (ARRAY['peer'::text, 'supervisor'::text])); -- validated: true
```

```sql
contribution_confirmations_contribution_id_fkey: FOREIGN KEY (contribution_id) REFERENCES contributions(id) ON DELETE CASCADE; -- validated: true
```

```sql
contribution_confirmations_pkey: PRIMARY KEY (contribution_id, confirmer_id); -- validated: true
```

### Indexes

```sql
CREATE INDEX contribution_confirmations_confirmer_idx ON public.contribution_confirmations USING btree (confirmer_id); -- valid: true
```

```sql
CREATE UNIQUE INDEX contribution_confirmations_pkey ON public.contribution_confirmations USING btree (contribution_id, confirmer_id); -- valid: true
```

### Policies

#### contribution_confirmations.contribution_confirmations_read

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "(EXISTS ( SELECT 1\n   FROM contributions c\n  WHERE ((c.id = contribution_confirmations.contribution_id) AND private.can_view_venture(c.venture_id))))",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

### Triggers

```sql
CREATE TRIGGER contribution_confirmations_recompute AFTER INSERT ON contribution_confirmations REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION private.recompute_confirmed_authors(); -- enabled: O
```

```sql
CREATE TRIGGER refuse_if_restricted BEFORE INSERT ON contribution_confirmations FOR EACH ROW EXECUTE FUNCTION private.refuse_if_restricted(); -- enabled: O
```

## public.contributions

[src: supabase/migrations/20260928210000_contributions.sql#contributions]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| venture_id | uuid | true | — |  |  | — |
| user_id | uuid | true | — |  |  | — |
| kind | contribution_kind | true | — |  |  | — |
| description | text | true | — |  |  | "default" |
| evidence_url | text | false | — |  |  | "default" |
| hours | numeric(5,2) | false | — |  |  | — |
| corrects_id | uuid | false | — |  |  | — |
| source | contribution_source | true | 'manual'::contribution_source |  |  | — |
| commit_sha | text | false | — |  |  | "default" |
| created_at | timestamp with time zone | true | now() |  |  | — |
| before_venture | boolean | true | false |  |  | — |
| skill_ids | text[] | true | '{}'::text[] |  |  | "default" |
| ai_agent | text | false | — |  |  | "default" |

### Keys and constraints

```sql
contributions_ai_agent_check: CHECK (ai_agent IS NULL OR char_length(ai_agent) >= 3 AND char_length(ai_agent) <= 200); -- validated: true
```

```sql
contributions_before_venture_github: CHECK (source = 'github'::contribution_source OR NOT before_venture); -- validated: true
```

```sql
contributions_check: CHECK ((source = 'github'::contribution_source) = (commit_sha IS NOT NULL)); -- validated: true
```

```sql
contributions_check1: CHECK (source = 'manual'::contribution_source OR corrects_id IS NULL); -- validated: true
```

```sql
contributions_commit_sha_check: CHECK (commit_sha IS NULL OR commit_sha ~ '^[0-9a-f]{40}$'::text); -- validated: true
```

```sql
contributions_corrects_id_fkey: FOREIGN KEY (corrects_id) REFERENCES contributions(id) ON DELETE CASCADE; -- validated: true
```

```sql
contributions_description_check: CHECK (char_length(btrim(description)) >= 1 AND char_length(btrim(description)) <= 500); -- validated: true
```

```sql
contributions_evidence_url_check: CHECK (evidence_url IS NULL OR evidence_url ~ '^https?://[^\s]+$'::text AND char_length(evidence_url) <= 500); -- validated: true
```

```sql
contributions_hours_check: CHECK (hours IS NULL OR hours > 0::numeric AND hours <= 100::numeric); -- validated: true
```

```sql
contributions_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
contributions_skill_ids_check: CHECK (cardinality(skill_ids) <= 3); -- validated: true
```

```sql
contributions_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

```sql
contributions_venture_id_fkey: FOREIGN KEY (venture_id) REFERENCES ventures(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX contributions_commit_uniq ON public.contributions USING btree (venture_id, user_id, commit_sha) WHERE (commit_sha IS NOT NULL); -- valid: true
```

```sql
CREATE INDEX contributions_corrects_idx ON public.contributions USING btree (corrects_id) WHERE (corrects_id IS NOT NULL); -- valid: true
```

```sql
CREATE UNIQUE INDEX contributions_pkey ON public.contributions USING btree (id); -- valid: true
```

```sql
CREATE INDEX contributions_user_idx ON public.contributions USING btree (user_id, venture_id); -- valid: true
```

```sql
CREATE INDEX contributions_venture_created_idx ON public.contributions USING btree (venture_id, created_at DESC); -- valid: true
```

### Policies

#### contributions.contributions_read

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "private.can_view_venture(venture_id)",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

### Triggers

```sql
CREATE TRIGGER contributions_analytics AFTER INSERT ON contributions FOR EACH ROW WHEN (new.source = 'manual'::contribution_source AND new.corrects_id IS NULL) EXECUTE FUNCTION private.analytics_contribution(); -- enabled: O
```

```sql
CREATE TRIGGER contributions_recompute_corrections AFTER INSERT ON contributions REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION private.recompute_corrected_authors(); -- enabled: O
```

```sql
CREATE TRIGGER refuse_if_restricted BEFORE INSERT ON contributions FOR EACH ROW EXECUTE FUNCTION private.refuse_if_restricted(); -- enabled: O
```
