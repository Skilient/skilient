Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# uni_fairs

## private.accept_fair_invite(p_token_hash text)

[src: supabase/migrations/20261020000000_uni_fairs.sql#accept_fair_invite]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.accept_fair_invite(p_token_hash text) | plpgsql | true | search_path="" | authenticated | 20261020000000_uni_fairs.sql |

## private.add_booth_slots(p_booth uuid, p_starts timestamp with time zone, p_count integer, p_minutes integer)

[src: supabase/migrations/20261020000000_uni_fairs.sql#add_booth_slots]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.add_booth_slots(p_booth uuid, p_starts timestamp with time zone, p_count integer, p_minutes integer) | plpgsql | true | search_path="" | authenticated | 20261020000000_uni_fairs.sql |

## private.answer_fair_call(p_queue uuid)

[src: supabase/migrations/20261020000000_uni_fairs.sql#answer_fair_call]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.answer_fair_call(p_queue uuid) | plpgsql | true | search_path="" | authenticated | 20261020000000_uni_fairs.sql |

## private.book_fair_slot(p_slot uuid)

[src: supabase/migrations/20261020000000_uni_fairs.sql#book_fair_slot]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.book_fair_slot(p_slot uuid) | plpgsql | true | search_path="" | authenticated | 20261020000000_uni_fairs.sql |

## private.booth_queue(p_booth uuid)

[src: supabase/migrations/20261020000000_uni_fairs.sql#booth_queue]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.booth_queue(p_booth uuid) | plpgsql | true | search_path="" | authenticated | 20261020000000_uni_fairs.sql |

## private.fair_call_next(p_booth uuid)

[src: supabase/migrations/20261020000000_uni_fairs.sql#fair_call_next]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.fair_call_next(p_booth uuid) | plpgsql | true | search_path="" | authenticated | 20261020000000_uni_fairs.sql |

## private.fair_eligible(p_fair uuid, p_user uuid)

[src: supabase/migrations/20261020000000_uni_fairs.sql#fair_eligible]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.fair_eligible(p_fair uuid, p_user uuid) | sql | true | search_path="" | None | 20261020000000_uni_fairs.sql |

## private.fair_invite_preview(p_token_hash text)

[src: supabase/migrations/20261020000000_uni_fairs.sql#fair_invite_preview]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.fair_invite_preview(p_token_hash text) | sql | true | search_path="" | anon, authenticated | 20261020000000_uni_fairs.sql |

## private.fair_live(f job_fairs)

[src: supabase/migrations/20261020000000_uni_fairs.sql#fair_live]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.fair_live(f job_fairs) | sql | false | search_path="" | None | 20261020000000_uni_fairs.sql |

## private.fair_mark(p_kind text, p_id uuid)

[src: supabase/migrations/20261020000000_uni_fairs.sql#fair_mark]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.fair_mark(p_kind text, p_id uuid) | plpgsql | true | search_path="" | authenticated | 20261020000000_uni_fairs.sql |

## private.fair_student_card(p_student uuid)

[src: supabase/migrations/20261020000000_uni_fairs.sql#fair_student_card]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.fair_student_card(p_student uuid) | sql | true | search_path="" | None | 20261020000000_uni_fairs.sql |

## private.fair_view(p_fair uuid)

[src: supabase/migrations/20261020000000_uni_fairs.sql#fair_view]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.fair_view(p_fair uuid) | plpgsql | true | search_path="" | authenticated | 20261020000000_uni_fairs.sql |

## private.finish_hackathon(p_id uuid)

[src: supabase/migrations/20261020000000_uni_fairs.sql#finish_hackathon]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.finish_hackathon(p_id uuid) | plpgsql | true | search_path="" | authenticated | 20261020000000_uni_fairs.sql |

## private.invite_fair_company(p_fair uuid, p_email text, p_token_hash text)

[src: supabase/migrations/20261020000000_uni_fairs.sql#invite_fair_company]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.invite_fair_company(p_fair uuid, p_email text, p_token_hash text) | plpgsql | true | search_path="" | authenticated | 20261020000000_uni_fairs.sql |

## private.is_booth_member(p_booth uuid)

[src: supabase/migrations/20261020000000_uni_fairs.sql#is_booth_member]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.is_booth_member(p_booth uuid) | sql | true | search_path="" | authenticated | 20261020000000_uni_fairs.sql |

## private.join_fair_queue(p_booth uuid)

[src: supabase/migrations/20261020000000_uni_fairs.sql#join_fair_queue]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.join_fair_queue(p_booth uuid) | plpgsql | true | search_path="" | authenticated | 20261020000000_uni_fairs.sql |

## private.judge_hackathon(p_id uuid)

[src: supabase/migrations/20261020000000_uni_fairs.sql#judge_hackathon]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.judge_hackathon(p_id uuid) | plpgsql | true | search_path="" | authenticated | 20261020000000_uni_fairs.sql |

## private.judge_score_team(p_team uuid, p_scores jsonb, p_feedback text)

[src: supabase/migrations/20261020000000_uni_fairs.sql#judge_score_team]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.judge_score_team(p_team uuid, p_scores jsonb, p_feedback text) | plpgsql | true | search_path="" | authenticated | 20261020000000_uni_fairs.sql |

## private.leave_fair_booth(p_booth uuid)

[src: supabase/migrations/20261020000000_uni_fairs.sql#leave_fair_booth]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.leave_fair_booth(p_booth uuid) | plpgsql | true | search_path="" | authenticated | 20261020000000_uni_fairs.sql |

## private.my_fair_booths()

[src: supabase/migrations/20261020000000_uni_fairs.sql#my_fair_booths]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.my_fair_booths() | plpgsql | true | search_path="" | authenticated | 20261020000000_uni_fairs.sql |

## private.my_judging()

[src: supabase/migrations/20261020000000_uni_fairs.sql#my_judging]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.my_judging() | plpgsql | true | search_path="" | authenticated | 20261020000000_uni_fairs.sql |

## private.save_booth(p_booth uuid, p_roles text[], p_about text)

[src: supabase/migrations/20261020000000_uni_fairs.sql#save_booth]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.save_booth(p_booth uuid, p_roles text[], p_about text) | plpgsql | true | search_path="" | authenticated | 20261020000000_uni_fairs.sql |

## private.set_job_fair_status(p_id uuid, p_action text)

[src: supabase/migrations/20261020000000_uni_fairs.sql#set_job_fair_status]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.set_job_fair_status(p_id uuid, p_action text) | plpgsql | true | search_path="" | authenticated | 20261020000000_uni_fairs.sql |

## private.suppress_groups(p_groups jsonb)

[src: supabase/migrations/20261020000000_uni_fairs.sql#suppress_groups]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.suppress_groups(p_groups jsonb) | plpgsql | false | search_path="" | authenticated, service_role | 20261020000000_uni_fairs.sql |

## private.uni_fair(p_id uuid)

[src: supabase/migrations/20261020000000_uni_fairs.sql#uni_fair]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.uni_fair(p_id uuid) | plpgsql | true | search_path="" | authenticated | 20261020000000_uni_fairs.sql |

## public.accept_fair_invite(p_token_hash text)

[src: supabase/migrations/20261020000000_uni_fairs.sql#accept_fair_invite]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.accept_fair_invite(p_token_hash text) | sql | false | search_path="" | authenticated, service_role | 20261020000000_uni_fairs.sql |

## public.add_booth_slots(p_booth uuid, p_starts timestamp with time zone, p_count integer, p_minutes integer)

[src: supabase/migrations/20261020000000_uni_fairs.sql#add_booth_slots]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.add_booth_slots(p_booth uuid, p_starts timestamp with time zone, p_count integer, p_minutes integer) | sql | false | search_path="" | authenticated, service_role | 20261020000000_uni_fairs.sql |

## public.answer_fair_call(p_queue uuid)

[src: supabase/migrations/20261020000000_uni_fairs.sql#answer_fair_call]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.answer_fair_call(p_queue uuid) | sql | false | search_path="" | authenticated, service_role | 20261020000000_uni_fairs.sql |

## public.book_fair_slot(p_slot uuid)

[src: supabase/migrations/20261020000000_uni_fairs.sql#book_fair_slot]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.book_fair_slot(p_slot uuid) | sql | false | search_path="" | authenticated, service_role | 20261020000000_uni_fairs.sql |

## public.booth_queue(p_booth uuid)

[src: supabase/migrations/20261020000000_uni_fairs.sql#booth_queue]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.booth_queue(p_booth uuid) | sql | false | search_path="" | authenticated, service_role | 20261020000000_uni_fairs.sql |

## public.fair_call_next(p_booth uuid)

[src: supabase/migrations/20261020000000_uni_fairs.sql#fair_call_next]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.fair_call_next(p_booth uuid) | sql | false | search_path="" | authenticated, service_role | 20261020000000_uni_fairs.sql |

## public.fair_invite_preview(p_token_hash text)

[src: supabase/migrations/20261020000000_uni_fairs.sql#fair_invite_preview]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.fair_invite_preview(p_token_hash text) | sql | false | search_path="" | anon, authenticated, service_role | 20261020000000_uni_fairs.sql |

## public.fair_mark(p_kind text, p_id uuid)

[src: supabase/migrations/20261020000000_uni_fairs.sql#fair_mark]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.fair_mark(p_kind text, p_id uuid) | sql | false | search_path="" | authenticated, service_role | 20261020000000_uni_fairs.sql |

## public.fair_view(p_fair uuid)

[src: supabase/migrations/20261020000000_uni_fairs.sql#fair_view]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.fair_view(p_fair uuid) | sql | false | search_path="" | authenticated, service_role | 20261020000000_uni_fairs.sql |

## public.finish_hackathon(p_id uuid)

[src: supabase/migrations/20261020000000_uni_fairs.sql#finish_hackathon]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.finish_hackathon(p_id uuid) | sql | false | search_path="" | authenticated, service_role | 20261020000000_uni_fairs.sql |

## public.invite_fair_company(p_fair uuid, p_email text, p_token_hash text)

[src: supabase/migrations/20261020000000_uni_fairs.sql#invite_fair_company]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.invite_fair_company(p_fair uuid, p_email text, p_token_hash text) | sql | false | search_path="" | authenticated, service_role | 20261020000000_uni_fairs.sql |

## public.join_fair_queue(p_booth uuid)

[src: supabase/migrations/20261020000000_uni_fairs.sql#join_fair_queue]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.join_fair_queue(p_booth uuid) | sql | false | search_path="" | authenticated, service_role | 20261020000000_uni_fairs.sql |

## public.judge_hackathon(p_id uuid)

[src: supabase/migrations/20261020000000_uni_fairs.sql#judge_hackathon]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.judge_hackathon(p_id uuid) | sql | false | search_path="" | authenticated, service_role | 20261020000000_uni_fairs.sql |

## public.judge_score_team(p_team uuid, p_scores jsonb, p_feedback text)

[src: supabase/migrations/20261020000000_uni_fairs.sql#judge_score_team]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.judge_score_team(p_team uuid, p_scores jsonb, p_feedback text) | sql | false | search_path="" | authenticated, service_role | 20261020000000_uni_fairs.sql |

## public.leave_fair_booth(p_booth uuid)

[src: supabase/migrations/20261020000000_uni_fairs.sql#leave_fair_booth]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.leave_fair_booth(p_booth uuid) | sql | false | search_path="" | authenticated, service_role | 20261020000000_uni_fairs.sql |

## public.my_fair_booths()

[src: supabase/migrations/20261020000000_uni_fairs.sql#my_fair_booths]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.my_fair_booths() | sql | false | search_path="" | authenticated, service_role | 20261020000000_uni_fairs.sql |

## public.my_judging()

[src: supabase/migrations/20261020000000_uni_fairs.sql#my_judging]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.my_judging() | sql | false | search_path="" | authenticated, service_role | 20261020000000_uni_fairs.sql |

## public.save_booth(p_booth uuid, p_roles text[], p_about text)

[src: supabase/migrations/20261020000000_uni_fairs.sql#save_booth]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.save_booth(p_booth uuid, p_roles text[], p_about text) | sql | false | search_path="" | authenticated, service_role | 20261020000000_uni_fairs.sql |

## public.save_hackathon(p_id uuid, p jsonb)

[src: supabase/migrations/20261020000000_uni_fairs.sql#save_hackathon]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.save_hackathon(p_id uuid, p jsonb) | sql | false | search_path="" | authenticated, service_role | 20261020000000_uni_fairs.sql |

## public.save_job_fair(p_id uuid, p jsonb)

[src: supabase/migrations/20261020000000_uni_fairs.sql#save_job_fair]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.save_job_fair(p_id uuid, p jsonb) | sql | false | search_path="" | authenticated, service_role | 20261020000000_uni_fairs.sql |

## public.set_job_fair_status(p_id uuid, p_action text)

[src: supabase/migrations/20261020000000_uni_fairs.sql#set_job_fair_status]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.set_job_fair_status(p_id uuid, p_action text) | sql | false | search_path="" | authenticated, service_role | 20261020000000_uni_fairs.sql |

## public.uni_fair(p_id uuid)

[src: supabase/migrations/20261020000000_uni_fairs.sql#uni_fair]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.uni_fair(p_id uuid) | sql | false | search_path="" | authenticated, service_role | 20261020000000_uni_fairs.sql |

## public.uni_fairs()

[src: supabase/migrations/20261020000000_uni_fairs.sql#uni_fairs]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.uni_fairs() | sql | false | search_path="" | authenticated, service_role | 20261020000000_uni_fairs.sql |

## public.uni_hackathons()

[src: supabase/migrations/20261020000000_uni_fairs.sql#uni_hackathons]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.uni_hackathons() | sql | false | search_path="" | authenticated, service_role | 20261020000000_uni_fairs.sql |

## public.competition_judge_scores

[src: supabase/migrations/20261020000000_uni_fairs.sql#competition_judge_scores]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| team_id | uuid | true | — |  |  | — |
| judge_id | uuid | true | — |  |  | — |
| scores | jsonb | true | — |  |  | — |
| total | numeric(6,2) | true | — |  |  | — |
| feedback | text | false | — |  |  | "default" |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
competition_judge_scores_feedback_check: CHECK (feedback IS NULL OR char_length(feedback) <= 2000); -- validated: true
```

```sql
competition_judge_scores_judge_id_fkey: FOREIGN KEY (judge_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

```sql
competition_judge_scores_pkey: PRIMARY KEY (team_id, judge_id); -- validated: true
```

```sql
competition_judge_scores_team_id_fkey: FOREIGN KEY (team_id) REFERENCES competition_teams(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE INDEX competition_judge_scores_judge_idx ON public.competition_judge_scores USING btree (judge_id); -- valid: true
```

```sql
CREATE UNIQUE INDEX competition_judge_scores_pkey ON public.competition_judge_scores USING btree (team_id, judge_id); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.competition_judges

[src: supabase/migrations/20261020000000_uni_fairs.sql#competition_judges]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| competition_id | uuid | true | — |  |  | — |
| teacher_id | uuid | true | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
competition_judges_competition_id_fkey: FOREIGN KEY (competition_id) REFERENCES competitions(id) ON DELETE CASCADE; -- validated: true
```

```sql
competition_judges_pkey: PRIMARY KEY (competition_id, teacher_id); -- validated: true
```

```sql
competition_judges_teacher_id_fkey: FOREIGN KEY (teacher_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX competition_judges_pkey ON public.competition_judges USING btree (competition_id, teacher_id); -- valid: true
```

```sql
CREATE INDEX competition_judges_teacher_idx ON public.competition_judges USING btree (teacher_id); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.job_fair_booths

[src: supabase/migrations/20261020000000_uni_fairs.sql#job_fair_booths]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| fair_id | uuid | true | — |  |  | — |
| org_id | uuid | true | — |  |  | — |
| roles | text[] | true | '{}'::text[] |  |  | "default" |
| about | text | false | — |  |  | "default" |
| next_position | integer | true | 1 |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
job_fair_booths_about_check: CHECK (about IS NULL OR char_length(about) <= 1000); -- validated: true
```

```sql
job_fair_booths_fair_id_fkey: FOREIGN KEY (fair_id) REFERENCES job_fairs(id) ON DELETE CASCADE; -- validated: true
```

```sql
job_fair_booths_fair_id_org_id_key: UNIQUE (fair_id, org_id); -- validated: true
```

```sql
job_fair_booths_org_id_fkey: FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE; -- validated: true
```

```sql
job_fair_booths_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
job_fair_booths_roles_check: CHECK (cardinality(roles) <= 10); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX job_fair_booths_fair_id_org_id_key ON public.job_fair_booths USING btree (fair_id, org_id); -- valid: true
```

```sql
CREATE INDEX job_fair_booths_org_idx ON public.job_fair_booths USING btree (org_id); -- valid: true
```

```sql
CREATE UNIQUE INDEX job_fair_booths_pkey ON public.job_fair_booths USING btree (id); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.job_fair_invites

[src: supabase/migrations/20261020000000_uni_fairs.sql#job_fair_invites]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| fair_id | uuid | true | — |  |  | — |
| email | text | true | — |  |  | "default" |
| token_hash | text | true | — |  |  | "default" |
| invited_by | uuid | false | — |  |  | — |
| accepted_org_id | uuid | false | — |  |  | — |
| accepted_at | timestamp with time zone | false | — |  |  | — |
| revoked_at | timestamp with time zone | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
job_fair_invites_accepted_org_id_fkey: FOREIGN KEY (accepted_org_id) REFERENCES organizations(id) ON DELETE SET NULL; -- validated: true
```

```sql
job_fair_invites_email_check: CHECK (email ~ '^[^@[:space:]]+@[^@[:space:]]+$'::text AND char_length(email) <= 254); -- validated: true
```

```sql
job_fair_invites_fair_id_fkey: FOREIGN KEY (fair_id) REFERENCES job_fairs(id) ON DELETE CASCADE; -- validated: true
```

```sql
job_fair_invites_invited_by_fkey: FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
job_fair_invites_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
job_fair_invites_token_hash_check: CHECK (token_hash ~ '^[0-9a-f]{64}$'::text); -- validated: true
```

```sql
job_fair_invites_token_hash_key: UNIQUE (token_hash); -- validated: true
```

### Indexes

```sql
CREATE INDEX job_fair_invites_email_idx ON public.job_fair_invites USING btree (email); -- valid: true
```

```sql
CREATE INDEX job_fair_invites_fair_idx ON public.job_fair_invites USING btree (fair_id); -- valid: true
```

```sql
CREATE INDEX job_fair_invites_invited_by_idx ON public.job_fair_invites USING btree (invited_by); -- valid: true
```

```sql
CREATE INDEX job_fair_invites_org_idx ON public.job_fair_invites USING btree (accepted_org_id); -- valid: true
```

```sql
CREATE UNIQUE INDEX job_fair_invites_pkey ON public.job_fair_invites USING btree (id); -- valid: true
```

```sql
CREATE UNIQUE INDEX job_fair_invites_token_hash_key ON public.job_fair_invites USING btree (token_hash); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.job_fair_queue

[src: supabase/migrations/20261020000000_uni_fairs.sql#job_fair_queue]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| booth_id | uuid | true | — |  |  | — |
| student_id | uuid | true | — |  |  | — |
| position | integer | true | — |  |  | — |
| status | fair_queue_status | true | 'waiting'::fair_queue_status |  |  | — |
| joined_at | timestamp with time zone | true | now() |  |  | — |
| called_at | timestamp with time zone | false | — |  |  | — |
| ended_at | timestamp with time zone | false | — |  |  | — |
| thread_id | uuid | false | — |  |  | — |

### Keys and constraints

```sql
job_fair_queue_booth_id_fkey: FOREIGN KEY (booth_id) REFERENCES job_fair_booths(id) ON DELETE CASCADE; -- validated: true
```

```sql
job_fair_queue_booth_id_position_key: UNIQUE (booth_id, "position"); -- validated: true
```

```sql
job_fair_queue_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
job_fair_queue_student_id_fkey: FOREIGN KEY (student_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

```sql
job_fair_queue_thread_id_fkey: FOREIGN KEY (thread_id) REFERENCES chat_threads(id) ON DELETE SET NULL; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX job_fair_queue_active_idx ON public.job_fair_queue USING btree (booth_id, student_id) WHERE (status = ANY (ARRAY['waiting'::fair_queue_status, 'called'::fair_queue_status, 'talking'::fair_queue_status])); -- valid: true
```

```sql
CREATE UNIQUE INDEX job_fair_queue_booth_id_position_key ON public.job_fair_queue USING btree (booth_id, "position"); -- valid: true
```

```sql
CREATE UNIQUE INDEX job_fair_queue_pkey ON public.job_fair_queue USING btree (id); -- valid: true
```

```sql
CREATE INDEX job_fair_queue_student_idx ON public.job_fair_queue USING btree (student_id); -- valid: true
```

```sql
CREATE INDEX job_fair_queue_thread_idx ON public.job_fair_queue USING btree (thread_id); -- valid: true
```

### Policies

#### job_fair_queue.job_fair_queue_read

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "((student_id = ( SELECT auth.uid() AS uid)) OR ((status <> 'left'::fair_queue_status) AND private.is_booth_member(booth_id)))",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

### Triggers

None.

## public.job_fair_slots

[src: supabase/migrations/20261020000000_uni_fairs.sql#job_fair_slots]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| booth_id | uuid | true | — |  |  | — |
| starts_at | timestamp with time zone | true | — |  |  | — |
| ends_at | timestamp with time zone | true | — |  |  | — |
| student_id | uuid | false | — |  |  | — |
| booked_at | timestamp with time zone | false | — |  |  | — |
| held_at | timestamp with time zone | false | — |  |  | — |
| cancelled_at | timestamp with time zone | false | — |  |  | — |

### Keys and constraints

```sql
job_fair_slots_booth_id_fkey: FOREIGN KEY (booth_id) REFERENCES job_fair_booths(id) ON DELETE CASCADE; -- validated: true
```

```sql
job_fair_slots_check: CHECK (ends_at > starts_at AND ends_at <= (starts_at + '01:00:00'::interval) AND ends_at >= (starts_at + '00:15:00'::interval)); -- validated: true
```

```sql
job_fair_slots_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
job_fair_slots_student_id_fkey: FOREIGN KEY (student_id) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

### Indexes

```sql
CREATE INDEX job_fair_slots_booth_idx ON public.job_fair_slots USING btree (booth_id, starts_at); -- valid: true
```

```sql
CREATE UNIQUE INDEX job_fair_slots_pkey ON public.job_fair_slots USING btree (id); -- valid: true
```

```sql
CREATE INDEX job_fair_slots_student_idx ON public.job_fair_slots USING btree (student_id); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.job_fairs

[src: supabase/migrations/20261020000000_uni_fairs.sql#job_fairs]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| university_id | uuid | true | — |  |  | — |
| title | text | true | — |  |  | "default" |
| description | text | false | — |  |  | "default" |
| starts_at | timestamp with time zone | true | — |  |  | — |
| ends_at | timestamp with time zone | true | — |  |  | — |
| status | fair_status | true | 'draft'::fair_status |  |  | — |
| created_by | uuid | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
job_fairs_check: CHECK (ends_at > starts_at AND ends_at <= (starts_at + '7 days'::interval)); -- validated: true
```

```sql
job_fairs_created_by_fkey: FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
job_fairs_description_check: CHECK (description IS NULL OR char_length(description) <= 4000); -- validated: true
```

```sql
job_fairs_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
job_fairs_title_check: CHECK (char_length(btrim(title)) >= 3 AND char_length(btrim(title)) <= 120); -- validated: true
```

```sql
job_fairs_university_id_fkey: FOREIGN KEY (university_id) REFERENCES universities(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE INDEX job_fairs_created_by_idx ON public.job_fairs USING btree (created_by); -- valid: true
```

```sql
CREATE UNIQUE INDEX job_fairs_pkey ON public.job_fairs USING btree (id); -- valid: true
```

```sql
CREATE INDEX job_fairs_uni_idx ON public.job_fairs USING btree (university_id, starts_at DESC); -- valid: true
```

### Policies

None.

### Triggers

None.
