Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# code_checks

## private.claim_code_check(p_id uuid, p_claim boolean)

[src: supabase/migrations/20261004000000_code_checks.sql#claim_code_check]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.claim_code_check(p_id uuid, p_claim boolean) | plpgsql | true | search_path="" | authenticated | 20261004000000_code_checks.sql |

## private.code_check_blocker(p_user uuid, p_skill text)

[src: supabase/migrations/20261004000000_code_checks.sql#code_check_blocker]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.code_check_blocker(p_user uuid, p_skill text) | sql | true | search_path="" | None | 20261004000000_code_checks.sql |

## private.code_check_candidates(p_check uuid)

[src: supabase/migrations/20261004000000_code_checks.sql#code_check_candidates]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.code_check_candidates(p_check uuid) | sql | true | search_path="" | None | 20261004000000_code_checks.sql |

## private.code_check_case(p_id uuid)

[src: supabase/migrations/20261004000000_code_checks.sql#code_check_case]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.code_check_case(p_id uuid) | plpgsql | true | search_path="" | authenticated | 20261004000000_code_checks.sql |

## private.code_check_conflict(p_grader uuid, p_student uuid)

[src: supabase/migrations/20261004000000_code_checks.sql#code_check_conflict]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.code_check_conflict(p_grader uuid, p_student uuid) | sql | true | search_path="" | None | 20261004000000_code_checks.sql |

## private.code_check_limit(p_name text)

[src: supabase/migrations/20261004000000_code_checks.sql#code_check_limit]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.code_check_limit(p_name text) | sql | true | search_path="" | None | 20261004000000_code_checks.sql |

## private.code_check_prepared(p_check uuid, p_repo bigint, p_sha text, p_path text, p_start integer, p_end integer)

[src: supabase/migrations/20261004000000_code_checks.sql#code_check_prepared]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.code_check_prepared(p_check uuid, p_repo bigint, p_sha text, p_path text, p_start integer, p_end integer) | plpgsql | true | search_path="" | None | 20261004000000_code_checks.sql |

## private.code_check_served(p_check uuid)

[src: supabase/migrations/20261004000000_code_checks.sql#code_check_served]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.code_check_served(p_check uuid) | sql | true | search_path="" | None | 20261004000000_code_checks.sql |

## private.code_check_state(p_skill text)

[src: supabase/migrations/20261004000000_code_checks.sql#code_check_state]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.code_check_state(p_skill text) | sql | true | search_path="" | authenticated | 20261004000000_code_checks.sql |

## private.code_check_unavailable(p_check uuid, p_reason text)

[src: supabase/migrations/20261004000000_code_checks.sql#code_check_unavailable]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.code_check_unavailable(p_check uuid, p_reason text) | sql | true | search_path="" | None | 20261004000000_code_checks.sql |

## private.code_checks_tick()

[src: supabase/migrations/20261004000000_code_checks.sql#code_checks_tick]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.code_checks_tick() | plpgsql | true | search_path="" | None | 20261004000000_code_checks.sql |

## private.grade_code_check(p_id uuid, p_rubric jsonb, p_feedback text)

[src: supabase/migrations/20261004000000_code_checks.sql#grade_code_check]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.grade_code_check(p_id uuid, p_rubric jsonb, p_feedback text) | plpgsql | true | search_path="" | authenticated | 20261004000000_code_checks.sql |

## private.has_authored_level(p_user uuid, p_skill text)

[src: supabase/migrations/20261004000000_code_checks.sql#has_authored_level]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.has_authored_level(p_user uuid, p_skill text) | sql | true | search_path="" | None | 20261004000000_code_checks.sql |

## private.my_code_check(p_id uuid)

[src: supabase/migrations/20261004000000_code_checks.sql#my_code_check]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.my_code_check(p_id uuid) | sql | true | search_path="" | authenticated | 20261004000000_code_checks.sql |

## private.request_code_check(p_skill text)

[src: supabase/migrations/20261004000000_code_checks.sql#request_code_check]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.request_code_check(p_skill text) | plpgsql | true | search_path="" | authenticated | 20261004000000_code_checks.sql |

## private.save_code_check(p_id uuid, p_answers jsonb, p_submit boolean)

[src: supabase/migrations/20261004000000_code_checks.sql#save_code_check]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.save_code_check(p_id uuid, p_answers jsonb, p_submit boolean) | plpgsql | true | search_path="" | authenticated | 20261004000000_code_checks.sql |

## private.start_code_check(p_id uuid)

[src: supabase/migrations/20261004000000_code_checks.sql#start_code_check]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.start_code_check(p_id uuid) | plpgsql | true | search_path="" | authenticated | 20261004000000_code_checks.sql |

## public.claim_code_check(p_id uuid, p_claim boolean)

[src: supabase/migrations/20261004000000_code_checks.sql#claim_code_check]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.claim_code_check(p_id uuid, p_claim boolean) | sql | false | search_path="" | authenticated, service_role | 20261004000000_code_checks.sql |

## public.code_check_case(p_id uuid)

[src: supabase/migrations/20261004000000_code_checks.sql#code_check_case]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.code_check_case(p_id uuid) | sql | false | search_path="" | authenticated, service_role | 20261004000000_code_checks.sql |

## public.code_check_queue(p_status text)

[src: supabase/migrations/20261004000000_code_checks.sql#code_check_queue]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.code_check_queue(p_status text) | sql | false | search_path="" | authenticated, service_role | 20261004000000_code_checks.sql |

## public.code_check_state(p_skill text)

[src: supabase/migrations/20261004000000_code_checks.sql#code_check_state]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.code_check_state(p_skill text) | sql | false | search_path="" | authenticated, service_role | 20261004000000_code_checks.sql |

## public.grade_code_check(p_id uuid, p_rubric jsonb, p_feedback text)

[src: supabase/migrations/20261004000000_code_checks.sql#grade_code_check]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.grade_code_check(p_id uuid, p_rubric jsonb, p_feedback text) | sql | false | search_path="" | authenticated, service_role | 20261004000000_code_checks.sql |

## public.my_code_check(p_id uuid)

[src: supabase/migrations/20261004000000_code_checks.sql#my_code_check]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.my_code_check(p_id uuid) | sql | false | search_path="" | authenticated, service_role | 20261004000000_code_checks.sql |

## public.request_code_check(p_skill text)

[src: supabase/migrations/20261004000000_code_checks.sql#request_code_check]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.request_code_check(p_skill text) | sql | false | search_path="" | authenticated, service_role | 20261004000000_code_checks.sql |

## public.save_code_check(p_id uuid, p_answers jsonb, p_submit boolean)

[src: supabase/migrations/20261004000000_code_checks.sql#save_code_check]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.save_code_check(p_id uuid, p_answers jsonb, p_submit boolean) | sql | false | search_path="" | authenticated, service_role | 20261004000000_code_checks.sql |

## public.start_code_check(p_id uuid)

[src: supabase/migrations/20261004000000_code_checks.sql#start_code_check]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.start_code_check(p_id uuid) | sql | false | search_path="" | authenticated, service_role | 20261004000000_code_checks.sql |

## public.code_check_prompts

[src: supabase/migrations/20261004000000_code_checks.sql#code_check_prompts]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| skill_id | text | false | — |  |  | "default" |
| category | skill_category | false | — |  |  | — |
| prompt | text | true | — |  |  | "default" |
| author_id | uuid | false | — |  |  | — |
| active | boolean | true | true |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
code_check_prompts_author_id_fkey: FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
code_check_prompts_check: CHECK (skill_id IS NOT NULL OR category IS NOT NULL); -- validated: true
```

```sql
code_check_prompts_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
code_check_prompts_prompt_check: CHECK (char_length(btrim(prompt)) >= 10 AND char_length(btrim(prompt)) <= 300); -- validated: true
```

```sql
code_check_prompts_skill_id_fkey: FOREIGN KEY (skill_id) REFERENCES skills(id); -- validated: true
```

### Indexes

```sql
CREATE INDEX code_check_prompts_author_idx ON public.code_check_prompts USING btree (author_id) WHERE (author_id IS NOT NULL); -- valid: true
```

```sql
CREATE INDEX code_check_prompts_category_idx ON public.code_check_prompts USING btree (category) WHERE active; -- valid: true
```

```sql
CREATE UNIQUE INDEX code_check_prompts_pkey ON public.code_check_prompts USING btree (id); -- valid: true
```

```sql
CREATE INDEX code_check_prompts_skill_idx ON public.code_check_prompts USING btree (skill_id) WHERE active; -- valid: true
```

### Policies

None.

### Triggers

None.

## public.code_checks

[src: supabase/migrations/20261004000000_code_checks.sql#code_checks]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| user_id | uuid | true | — |  |  | — |
| skill_id | text | true | — |  |  | "default" |
| status | code_check_status | true | 'preparing'::code_check_status |  |  | — |
| prompt_id | uuid | false | — |  |  | — |
| repo_id | bigint | false | — |  |  | — |
| sha | text | false | — |  |  | "default" |
| path | text | false | — |  |  | "default" |
| start_line | integer | false | — |  |  | — |
| end_line | integer | false | — |  |  | — |
| answers | jsonb | true | '{}'::jsonb |  |  | — |
| rubric | jsonb | false | — |  |  | — |
| feedback | text | false | — |  |  | "default" |
| unavailable_reason | text | false | — |  |  | "default" |
| requested_at | timestamp with time zone | true | now() |  |  | — |
| ready_at | timestamp with time zone | false | — |  |  | — |
| started_at | timestamp with time zone | false | — |  |  | — |
| deadline_at | timestamp with time zone | false | — |  |  | — |
| snippet_served_at | timestamp with time zone | false | — |  |  | — |
| submitted_at | timestamp with time zone | false | — |  |  | — |
| graded_at | timestamp with time zone | false | — |  |  | — |
| claimed_by | uuid | false | — |  |  | — |
| claimed_at | timestamp with time zone | false | — |  |  | — |
| grader_id | uuid | false | — |  |  | — |
| due_at | timestamp with time zone | false | — |  |  | — |
| routed_to_staff_at | timestamp with time zone | false | — |  |  | — |

### Keys and constraints

```sql
code_checks_answers_check: CHECK (jsonb_typeof(answers) = 'object'::text); -- validated: true
```

```sql
code_checks_check: CHECK (end_line IS NULL OR end_line >= start_line); -- validated: true
```

```sql
code_checks_check1: CHECK (deadline_at IS NULL OR started_at IS NOT NULL AND snippet_served_at IS NOT NULL); -- validated: true
```

```sql
code_checks_claimed_by_fkey: FOREIGN KEY (claimed_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
code_checks_feedback_check: CHECK (feedback IS NULL OR char_length(feedback) <= 2000); -- validated: true
```

```sql
code_checks_grader_id_fkey: FOREIGN KEY (grader_id) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
code_checks_path_check: CHECK (path IS NULL OR char_length(path) <= 500); -- validated: true
```

```sql
code_checks_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
code_checks_prompt_id_fkey: FOREIGN KEY (prompt_id) REFERENCES code_check_prompts(id) ON DELETE SET NULL; -- validated: true
```

```sql
code_checks_rubric_check: CHECK (rubric IS NULL OR jsonb_typeof(rubric) = 'object'::text); -- validated: true
```

```sql
code_checks_sha_check: CHECK (sha IS NULL OR sha ~ '^[0-9a-f]{40}$'::text); -- validated: true
```

```sql
code_checks_skill_id_fkey: FOREIGN KEY (skill_id) REFERENCES skills(id); -- validated: true
```

```sql
code_checks_start_line_check: CHECK (start_line IS NULL OR start_line >= 1); -- validated: true
```

```sql
code_checks_unavailable_reason_check: CHECK (unavailable_reason IS NULL OR char_length(unavailable_reason) <= 200); -- validated: true
```

```sql
code_checks_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE INDEX code_checks_claimed_by_idx ON public.code_checks USING btree (claimed_by) WHERE (claimed_by IS NOT NULL); -- valid: true
```

```sql
CREATE INDEX code_checks_grader_idx ON public.code_checks USING btree (grader_id) WHERE (grader_id IS NOT NULL); -- valid: true
```

```sql
CREATE UNIQUE INDEX code_checks_one_open_idx ON public.code_checks USING btree (user_id, skill_id) WHERE (status = ANY (ARRAY['preparing'::code_check_status, 'ready'::code_check_status, 'in_progress'::code_check_status, 'submitted'::code_check_status])); -- valid: true
```

```sql
CREATE UNIQUE INDEX code_checks_pkey ON public.code_checks USING btree (id); -- valid: true
```

```sql
CREATE INDEX code_checks_prompt_idx ON public.code_checks USING btree (prompt_id); -- valid: true
```

```sql
CREATE INDEX code_checks_skill_idx ON public.code_checks USING btree (skill_id); -- valid: true
```

```sql
CREATE INDEX code_checks_submitted_idx ON public.code_checks USING btree (submitted_at) WHERE (status = 'submitted'::code_check_status); -- valid: true
```

```sql
CREATE INDEX code_checks_user_skill_idx ON public.code_checks USING btree (user_id, skill_id, requested_at DESC); -- valid: true
```

### Policies

#### code_checks.code_checks_read_own

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
CREATE TRIGGER code_checks_route BEFORE INSERT OR UPDATE ON code_checks FOR EACH ROW EXECUTE FUNCTION private.code_checks_route(); -- enabled: O
```

```sql
CREATE TRIGGER refuse_if_restricted BEFORE INSERT ON code_checks FOR EACH ROW EXECUTE FUNCTION private.refuse_if_restricted(); -- enabled: O
```
