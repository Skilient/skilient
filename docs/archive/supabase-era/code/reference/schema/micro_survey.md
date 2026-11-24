Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# micro_survey

## private.answer_survey(p_post uuid, p_answer boolean, p_latency_ms integer)

[src: supabase/migrations/20260929030000_micro_survey.sql#answer_survey]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.answer_survey(p_post uuid, p_answer boolean, p_latency_ms integer) | plpgsql | true | search_path="" | authenticated | 20260929030000_micro_survey.sql |

## private.assign_survey_question(p_post uuid)

[src: supabase/migrations/20260929030000_micro_survey.sql#assign_survey_question]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.assign_survey_question(p_post uuid) | plpgsql | true | search_path="" | None | 20260929030000_micro_survey.sql |

## private.bump_stat(p_post uuid, p_column text, p_delta integer)

[src: supabase/migrations/20260929030000_micro_survey.sql#bump_stat]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.bump_stat(p_post uuid, p_column text, p_delta integer) | plpgsql | true | search_path="" | None | 20260929030000_micro_survey.sql |

## private.config(p_key text)

[src: supabase/migrations/20260929030000_micro_survey.sql#config]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.config(p_key text) | sql | true | search_path="" | None | 20260929030000_micro_survey.sql |

## private.config_append_only()

[src: supabase/migrations/20260929030000_micro_survey.sql#config_append_only]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.config_append_only() | plpgsql | false | search_path="" | None | 20260929030000_micro_survey.sql |

## private.post_insights(p_post uuid)

[src: supabase/migrations/20260929030000_micro_survey.sql#post_insights]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.post_insights(p_post uuid) | plpgsql | true | search_path="" | authenticated | 20260929030000_micro_survey.sql |

## private.record_views(p_ids uuid[])

[src: supabase/migrations/20260929030000_micro_survey.sql#record_views]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.record_views(p_ids uuid[]) | plpgsql | true | search_path="" | authenticated | 20260929030000_micro_survey.sql |

## private.stats_on_assignment()

[src: supabase/migrations/20260929030000_micro_survey.sql#stats_on_assignment]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.stats_on_assignment() | plpgsql | true | search_path="" | None | 20260929030000_micro_survey.sql |

## private.stats_on_comment()

[src: supabase/migrations/20260929030000_micro_survey.sql#stats_on_comment]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.stats_on_comment() | plpgsql | true | search_path="" | None | 20260929030000_micro_survey.sql |

## private.stats_on_hide()

[src: supabase/migrations/20260929030000_micro_survey.sql#stats_on_hide]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.stats_on_hide() | plpgsql | true | search_path="" | None | 20260929030000_micro_survey.sql |

## private.stats_on_post()

[src: supabase/migrations/20260929030000_micro_survey.sql#stats_on_post]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.stats_on_post() | plpgsql | true | search_path="" | None | 20260929030000_micro_survey.sql |

## private.stats_on_response()

[src: supabase/migrations/20260929030000_micro_survey.sql#stats_on_response]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.stats_on_response() | plpgsql | true | search_path="" | None | 20260929030000_micro_survey.sql |

## private.stats_on_view()

[src: supabase/migrations/20260929030000_micro_survey.sql#stats_on_view]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.stats_on_view() | plpgsql | true | search_path="" | None | 20260929030000_micro_survey.sql |

## private.survey_for_posts(p_ids uuid[])

[src: supabase/migrations/20260929030000_micro_survey.sql#survey_for_posts]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.survey_for_posts(p_ids uuid[]) | plpgsql | true | search_path="" | authenticated | 20260929030000_micro_survey.sql |

## public.answer_survey(p_post uuid, p_answer boolean, p_latency_ms integer)

[src: supabase/migrations/20260929030000_micro_survey.sql#answer_survey]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.answer_survey(p_post uuid, p_answer boolean, p_latency_ms integer) | sql | false | search_path="" | authenticated, service_role | 20260929030000_micro_survey.sql |

## public.post_insights(p_post uuid)

[src: supabase/migrations/20260929030000_micro_survey.sql#post_insights]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.post_insights(p_post uuid) | sql | false | search_path="" | authenticated, service_role | 20260929030000_micro_survey.sql |

## public.record_views(p_ids uuid[])

[src: supabase/migrations/20260929030000_micro_survey.sql#record_views]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.record_views(p_ids uuid[]) | sql | false | search_path="" | authenticated, service_role | 20260929030000_micro_survey.sql |

## public.survey_for_posts(p_ids uuid[])

[src: supabase/migrations/20260929030000_micro_survey.sql#survey_for_posts]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.survey_for_posts(p_ids uuid[]) | sql | false | search_path="" | authenticated, service_role | 20260929030000_micro_survey.sql |

## public.micro_survey_assignments

[src: supabase/migrations/20260929030000_micro_survey.sql#micro_survey_assignments]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| post_id | uuid | true | — |  |  | — |
| user_id | uuid | true | — |  |  | — |
| question_id | smallint | true | — |  |  | — |
| dimension | text | true | — |  |  | "default" |
| assigned_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
micro_survey_assignments_dimension_fkey: FOREIGN KEY (dimension) REFERENCES micro_survey_dimensions(dimension); -- validated: true
```

```sql
micro_survey_assignments_pkey: PRIMARY KEY (post_id, user_id); -- validated: true
```

```sql
micro_survey_assignments_post_id_fkey: FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE; -- validated: true
```

```sql
micro_survey_assignments_question_id_fkey: FOREIGN KEY (question_id) REFERENCES micro_survey_questions(id); -- validated: true
```

```sql
micro_survey_assignments_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE INDEX micro_survey_assignments_dimension_idx ON public.micro_survey_assignments USING btree (dimension); -- valid: true
```

```sql
CREATE UNIQUE INDEX micro_survey_assignments_pkey ON public.micro_survey_assignments USING btree (post_id, user_id); -- valid: true
```

```sql
CREATE INDEX micro_survey_assignments_question_idx ON public.micro_survey_assignments USING btree (question_id); -- valid: true
```

```sql
CREATE INDEX micro_survey_assignments_user_idx ON public.micro_survey_assignments USING btree (user_id); -- valid: true
```

### Policies

#### micro_survey_assignments.micro_survey_assignments_read_own

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
CREATE TRIGGER micro_survey_assignments_stats AFTER INSERT ON micro_survey_assignments FOR EACH ROW EXECUTE FUNCTION private.stats_on_assignment(); -- enabled: O
```

## public.micro_survey_dimensions

[src: supabase/migrations/20260929030000_micro_survey.sql#micro_survey_dimensions]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| dimension | text | true | — |  |  | "default" |
| label | text | true | — |  |  | "default" |
| public | boolean | true | false |  |  | — |
| public_phrase | text | false | — |  |  | "default" |
| post_types | post_type[] | true | — |  |  | — |
| tie_priority | smallint | true | 0 |  |  | — |

### Keys and constraints

```sql
micro_survey_dimensions_check: CHECK (NOT public OR public_phrase IS NOT NULL); -- validated: true
```

```sql
micro_survey_dimensions_dimension_check: CHECK (dimension ~ '^[a-z_]{3,40}$'::text); -- validated: true
```

```sql
micro_survey_dimensions_pkey: PRIMARY KEY (dimension); -- validated: true
```

```sql
micro_survey_dimensions_post_types_check: CHECK (NOT post_types && ARRAY['announcement'::post_type, 'poll'::post_type]); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX micro_survey_dimensions_pkey ON public.micro_survey_dimensions USING btree (dimension); -- valid: true
```

### Policies

#### micro_survey_dimensions.micro_survey_dimensions_read

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

## public.micro_survey_questions

[src: supabase/migrations/20260929030000_micro_survey.sql#micro_survey_questions]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | smallint | true | — | a |  | — |
| dimension | text | true | — |  |  | "default" |
| text | text | true | — |  |  | "default" |
| active | boolean | true | true |  |  | — |

### Keys and constraints

```sql
micro_survey_questions_dimension_fkey: FOREIGN KEY (dimension) REFERENCES micro_survey_dimensions(dimension); -- validated: true
```

```sql
micro_survey_questions_dimension_text_key: UNIQUE (dimension, text); -- validated: true
```

```sql
micro_survey_questions_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
micro_survey_questions_text_check: CHECK (char_length(text) >= 5 AND char_length(text) <= 120); -- validated: true
```

### Indexes

```sql
CREATE INDEX micro_survey_questions_dimension_idx ON public.micro_survey_questions USING btree (dimension) WHERE active; -- valid: true
```

```sql
CREATE UNIQUE INDEX micro_survey_questions_dimension_text_key ON public.micro_survey_questions USING btree (dimension, text); -- valid: true
```

```sql
CREATE UNIQUE INDEX micro_survey_questions_pkey ON public.micro_survey_questions USING btree (id); -- valid: true
```

### Policies

#### micro_survey_questions.micro_survey_questions_read

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "active",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

### Triggers

None.

## public.micro_survey_responses

[src: supabase/migrations/20260929030000_micro_survey.sql#micro_survey_responses]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| post_id | uuid | true | — |  |  | — |
| user_id | uuid | true | — |  |  | — |
| question_id | smallint | true | — |  |  | — |
| dimension | text | true | — |  |  | "default" |
| answer | boolean | true | — |  |  | — |
| latency_ms | integer | true | — |  |  | — |
| weight | numeric(4,3) | true | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |
| locked_at | timestamp with time zone | true | — |  |  | — |
| updated_at | timestamp with time zone | false | — |  |  | — |

### Keys and constraints

```sql
micro_survey_responses_dimension_fkey: FOREIGN KEY (dimension) REFERENCES micro_survey_dimensions(dimension); -- validated: true
```

```sql
micro_survey_responses_latency_ms_check: CHECK (latency_ms >= 0); -- validated: true
```

```sql
micro_survey_responses_pkey: PRIMARY KEY (post_id, user_id); -- validated: true
```

```sql
micro_survey_responses_post_id_user_id_fkey: FOREIGN KEY (post_id, user_id) REFERENCES micro_survey_assignments(post_id, user_id) ON DELETE CASCADE; -- validated: true
```

```sql
micro_survey_responses_question_id_fkey: FOREIGN KEY (question_id) REFERENCES micro_survey_questions(id); -- validated: true
```

```sql
micro_survey_responses_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

```sql
micro_survey_responses_weight_check: CHECK (weight > 0::numeric AND weight <= 1::numeric); -- validated: true
```

### Indexes

```sql
CREATE INDEX micro_survey_responses_dimension_idx ON public.micro_survey_responses USING btree (dimension); -- valid: true
```

```sql
CREATE UNIQUE INDEX micro_survey_responses_pkey ON public.micro_survey_responses USING btree (post_id, user_id); -- valid: true
```

```sql
CREATE INDEX micro_survey_responses_question_idx ON public.micro_survey_responses USING btree (question_id); -- valid: true
```

```sql
CREATE INDEX micro_survey_responses_user_idx ON public.micro_survey_responses USING btree (user_id, created_at DESC); -- valid: true
```

### Policies

#### micro_survey_responses.micro_survey_responses_read_own

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
CREATE TRIGGER micro_survey_responses_analytics AFTER INSERT ON micro_survey_responses FOR EACH ROW EXECUTE FUNCTION private.analytics_survey(); -- enabled: O
```

```sql
CREATE TRIGGER micro_survey_responses_stats AFTER INSERT OR UPDATE OF answer ON micro_survey_responses FOR EACH ROW EXECUTE FUNCTION private.stats_on_response(); -- enabled: O
```

## public.platform_config

[src: supabase/migrations/20260929030000_micro_survey.sql#platform_config]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| key | text | true | — |  |  | "default" |
| version | integer | true | — |  |  | — |
| value | jsonb | true | — |  |  | — |
| reason | text | true | — |  |  | "default" |
| staff_id | uuid | false | — |  |  | — |
| effective_at | timestamp with time zone | true | now() |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
platform_config_key_check: CHECK (key ~ '^[a-z][a-z0-9_.]{1,80}$'::text); -- validated: true
```

```sql
platform_config_pkey: PRIMARY KEY (key, version); -- validated: true
```

```sql
platform_config_reason_check: CHECK (char_length(btrim(reason)) >= 3 AND char_length(btrim(reason)) <= 500); -- validated: true
```

```sql
platform_config_staff_id_fkey: FOREIGN KEY (staff_id) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
platform_config_version_check: CHECK (version >= 1); -- validated: true
```

### Indexes

```sql
CREATE INDEX platform_config_key_effective_idx ON public.platform_config USING btree (key, effective_at DESC); -- valid: true
```

```sql
CREATE UNIQUE INDEX platform_config_pkey ON public.platform_config USING btree (key, version); -- valid: true
```

### Policies

#### platform_config.platform_config_staff_read

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "( SELECT private.is_staff() AS is_staff)",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

### Triggers

```sql
CREATE TRIGGER platform_config_no_update BEFORE DELETE OR UPDATE ON platform_config FOR EACH ROW EXECUTE FUNCTION private.config_append_only(); -- enabled: O
```

## public.post_stats

[src: supabase/migrations/20260929030000_micro_survey.sql#post_stats]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| post_id | uuid | true | — |  |  | — |
| views | integer | true | 0 |  |  | — |
| hides | integer | true | 0 |  |  | — |
| answers | integer | true | 0 |  |  | — |
| positives | integer | true | 0 |  |  | — |
| commenters | integer | true | 0 |  |  | — |
| commenter_universities | integer | true | 0 |  |  | — |
| appropriate_flags | integer | true | 0 |  |  | — |
| reports | integer | true | 0 |  |  | — |
| updated_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
post_stats_pkey: PRIMARY KEY (post_id); -- validated: true
```

```sql
post_stats_post_id_fkey: FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX post_stats_pkey ON public.post_stats USING btree (post_id); -- valid: true
```

### Policies

None.

### Triggers

```sql
CREATE TRIGGER post_stats_appropriate_signal AFTER UPDATE OF appropriate_flags ON post_stats FOR EACH ROW EXECUTE FUNCTION private.appropriate_signal(); -- enabled: O
```

```sql
CREATE TRIGGER post_stats_held AFTER UPDATE OF reports ON post_stats FOR EACH ROW EXECUTE FUNCTION private.held_on_reports(); -- enabled: O
```

## public.post_survey_counts

[src: supabase/migrations/20260929030000_micro_survey.sql#post_survey_counts]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| post_id | uuid | true | — |  |  | — |
| dimension | text | true | — |  |  | "default" |
| assigned | integer | true | 0 |  |  | — |
| ticks | integer | true | 0 |  |  | — |
| crosses | integer | true | 0 |  |  | — |
| weighted_ticks | numeric | true | 0 |  |  | — |
| weighted_crosses | numeric | true | 0 |  |  | — |

### Keys and constraints

```sql
post_survey_counts_dimension_fkey: FOREIGN KEY (dimension) REFERENCES micro_survey_dimensions(dimension); -- validated: true
```

```sql
post_survey_counts_pkey: PRIMARY KEY (post_id, dimension); -- validated: true
```

```sql
post_survey_counts_post_id_fkey: FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE INDEX post_survey_counts_dimension_idx ON public.post_survey_counts USING btree (dimension); -- valid: true
```

```sql
CREATE UNIQUE INDEX post_survey_counts_pkey ON public.post_survey_counts USING btree (post_id, dimension); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.post_views

[src: supabase/migrations/20260929030000_micro_survey.sql#post_views]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| post_id | uuid | true | — |  |  | — |
| user_id | uuid | true | — |  |  | — |
| first_seen_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
post_views_pkey: PRIMARY KEY (post_id, user_id); -- validated: true
```

```sql
post_views_post_id_fkey: FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE; -- validated: true
```

```sql
post_views_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX post_views_pkey ON public.post_views USING btree (post_id, user_id); -- valid: true
```

```sql
CREATE INDEX post_views_user_idx ON public.post_views USING btree (user_id, first_seen_at DESC); -- valid: true
```

### Policies

#### post_views.post_views_read_own

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
CREATE TRIGGER post_views_stats AFTER INSERT ON post_views FOR EACH ROW EXECUTE FUNCTION private.stats_on_view(); -- enabled: O
```
