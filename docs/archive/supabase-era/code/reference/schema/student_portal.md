Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# student_portal

## private.account_deletion_run()

[src: supabase/migrations/20261010000000_student_portal.sql#account_deletion_run]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.account_deletion_run() | plpgsql | true | search_path="" | None | 20261010000000_student_portal.sql |

## private.board(p_scope text, p_department text, p_batch smallint)

[src: supabase/migrations/20261010000000_student_portal.sql#board]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.board(p_scope text, p_department text, p_batch smallint) | plpgsql | true | search_path="" | None | 20261010000000_student_portal.sql |

## private.cancel_account_deletion()

[src: supabase/migrations/20261010000000_student_portal.sql#cancel_account_deletion]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.cancel_account_deletion() | plpgsql | true | search_path="" | authenticated | 20261010000000_student_portal.sql |

## private.claim_feedback(p_id uuid, p_claim boolean)

[src: supabase/migrations/20261010000000_student_portal.sql#claim_feedback]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.claim_feedback(p_id uuid, p_claim boolean) | plpgsql | true | search_path="" | authenticated | 20261010000000_student_portal.sql |

## private.delete_account(p_user uuid)

[src: supabase/migrations/20261010000000_student_portal.sql#delete_account]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.delete_account(p_user uuid) | plpgsql | true | search_path="" | None | 20261010000000_student_portal.sql |

## private.feedback_case(p_id uuid)

[src: supabase/migrations/20261010000000_student_portal.sql#feedback_case]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.feedback_case(p_id uuid) | plpgsql | true | search_path="" | authenticated | 20261010000000_student_portal.sql |

## private.feedback_file_unused(p_name text)

[src: supabase/migrations/20261010000000_student_portal.sql#feedback_file_unused]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.feedback_file_unused(p_name text) | sql | true | search_path="" | authenticated | 20261010000000_student_portal.sql |

## private.feedback_queue(p_open boolean)

[src: supabase/migrations/20261010000000_student_portal.sql#feedback_queue]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.feedback_queue(p_open boolean) | plpgsql | true | search_path="" | authenticated | 20261010000000_student_portal.sql |

## private.feedback_upload_allowed(p_name text)

[src: supabase/migrations/20261010000000_student_portal.sql#feedback_upload_allowed]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.feedback_upload_allowed(p_name text) | sql | true | search_path="" | authenticated | 20261010000000_student_portal.sql |

## private.getting_started()

[src: supabase/migrations/20261010000000_student_portal.sql#getting_started]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.getting_started() | plpgsql | true | search_path="" | authenticated | 20261010000000_student_portal.sql |

## private.graduate_post_guard()

[src: supabase/migrations/20261010000000_student_portal.sql#graduate_post_guard]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.graduate_post_guard() | plpgsql | true | search_path="" | None | 20261010000000_student_portal.sql |

## private.graduate_venture_guard()

[src: supabase/migrations/20261010000000_student_portal.sql#graduate_venture_guard]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.graduate_venture_guard() | plpgsql | true | search_path="" | None | 20261010000000_student_portal.sql |

## private.my_feedback()

[src: supabase/migrations/20261010000000_student_portal.sql#my_feedback]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.my_feedback() | sql | true | search_path="" | authenticated | 20261010000000_student_portal.sql |

## private.nav_badges()

[src: supabase/migrations/20261010000000_student_portal.sql#nav_badges]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.nav_badges() | plpgsql | true | search_path="" | authenticated | 20261010000000_student_portal.sql |

## private.next_best_action()

[src: supabase/migrations/20261010000000_student_portal.sql#next_best_action]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.next_best_action() | plpgsql | true | search_path="" | authenticated | 20261010000000_student_portal.sql |

## private.notify(p_user uuid, p_actor uuid, p_type text, p_entity_type text, p_entity_id uuid, p_data jsonb)

[src: supabase/migrations/20261010000000_student_portal.sql#notify]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.notify(p_user uuid, p_actor uuid, p_type text, p_entity_type text, p_entity_id uuid, p_data jsonb) | plpgsql | true | search_path="" | None | 20261010000000_student_portal.sql |

## private.ops_batches()

[src: supabase/migrations/20261010000000_student_portal.sql#ops_batches]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_batches() | plpgsql | true | search_path="" | authenticated | 20261010000000_student_portal.sql |

## private.ops_set_final_year_batch(p_university uuid, p_batch smallint, p_reason text)

[src: supabase/migrations/20261010000000_student_portal.sql#ops_set_final_year_batch]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_set_final_year_batch(p_university uuid, p_batch smallint, p_reason text) | plpgsql | true | search_path="" | authenticated | 20261010000000_student_portal.sql |

## private.request_account_deletion()

[src: supabase/migrations/20261010000000_student_portal.sql#request_account_deletion]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.request_account_deletion() | plpgsql | true | search_path="" | authenticated | 20261010000000_student_portal.sql |

## private.require_any_staff()

[src: supabase/migrations/20261010000000_student_portal.sql#require_any_staff]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.require_any_staff() | plpgsql | true | search_path="" | None | 20261010000000_student_portal.sql |

## private.respond_feedback(p_id uuid, p_status feedback_status, p_reply text)

[src: supabase/migrations/20261010000000_student_portal.sql#respond_feedback]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.respond_feedback(p_id uuid, p_status feedback_status, p_reply text) | plpgsql | true | search_path="" | authenticated | 20261010000000_student_portal.sql |

## private.restart_tour(p_tour text)

[src: supabase/migrations/20261010000000_student_portal.sql#restart_tour]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.restart_tour(p_tour text) | plpgsql | true | search_path="" | authenticated | 20261010000000_student_portal.sql |

## private.save_tour(p_tour text, p_step integer, p_outcome text)

[src: supabase/migrations/20261010000000_student_portal.sql#save_tour]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.save_tour(p_tour text, p_step integer, p_outcome text) | plpgsql | true | search_path="" | authenticated | 20261010000000_student_portal.sql |

## private.see_tip(p_tip text)

[src: supabase/migrations/20261010000000_student_portal.sql#see_tip]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.see_tip(p_tip text) | plpgsql | true | search_path="" | authenticated | 20261010000000_student_portal.sql |

## private.submit_feedback(p_type feedback_type, p_body text, p_screenshot text, p_page text, p_device text, p_version text)

[src: supabase/migrations/20261010000000_student_portal.sql#submit_feedback]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.submit_feedback(p_type feedback_type, p_body text, p_screenshot text, p_page text, p_device text, p_version text) | plpgsql | true | search_path="" | authenticated | 20261010000000_student_portal.sql |

## private.todo_counts()

[src: supabase/migrations/20261010000000_student_portal.sql#todo_counts]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.todo_counts() | plpgsql | true | search_path="" | authenticated | 20261010000000_student_portal.sql |

## private.tour_state(p_tour text)

[src: supabase/migrations/20261010000000_student_portal.sql#tour_state]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.tour_state(p_tour text) | sql | true | search_path="" | authenticated | 20261010000000_student_portal.sql |

## public.cancel_account_deletion()

[src: supabase/migrations/20261010000000_student_portal.sql#cancel_account_deletion]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.cancel_account_deletion() | sql | false | search_path="" | authenticated, service_role | 20261010000000_student_portal.sql |

## public.claim_feedback(p_id uuid, p_claim boolean)

[src: supabase/migrations/20261010000000_student_portal.sql#claim_feedback]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.claim_feedback(p_id uuid, p_claim boolean) | sql | false | search_path="" | authenticated, service_role | 20261010000000_student_portal.sql |

## public.feedback_case(p_id uuid)

[src: supabase/migrations/20261010000000_student_portal.sql#feedback_case]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.feedback_case(p_id uuid) | sql | false | search_path="" | authenticated, service_role | 20261010000000_student_portal.sql |

## public.feedback_queue(p_open boolean)

[src: supabase/migrations/20261010000000_student_portal.sql#feedback_queue]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.feedback_queue(p_open boolean) | sql | false | search_path="" | authenticated, service_role | 20261010000000_student_portal.sql |

## public.getting_started()

[src: supabase/migrations/20261010000000_student_portal.sql#getting_started]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.getting_started() | sql | false | search_path="" | authenticated, service_role | 20261010000000_student_portal.sql |

## public.my_feedback()

[src: supabase/migrations/20261010000000_student_portal.sql#my_feedback]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.my_feedback() | sql | false | search_path="" | authenticated, service_role | 20261010000000_student_portal.sql |

## public.my_gate_state()

[src: supabase/migrations/20261010000000_student_portal.sql#my_gate_state]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.my_gate_state() | sql | false | search_path="" | authenticated, service_role | 20261010000000_student_portal.sql |

## public.nav_badges()

[src: supabase/migrations/20261010000000_student_portal.sql#nav_badges]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.nav_badges() | sql | false | search_path="" | authenticated, service_role | 20261010000000_student_portal.sql |

## public.next_best_action()

[src: supabase/migrations/20261010000000_student_portal.sql#next_best_action]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.next_best_action() | sql | false | search_path="" | authenticated, service_role | 20261010000000_student_portal.sql |

## public.opportunities(p_tab text, p_after integer)

[src: supabase/migrations/20261010000000_student_portal.sql#opportunities]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.opportunities(p_tab text, p_after integer) | sql | false | search_path="" | authenticated, service_role | 20261010000000_student_portal.sql |

## public.ops_batches()

[src: supabase/migrations/20261010000000_student_portal.sql#ops_batches]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_batches() | sql | false | search_path="" | authenticated, service_role | 20261010000000_student_portal.sql |

## public.ops_set_final_year_batch(p_university uuid, p_batch smallint, p_reason text)

[src: supabase/migrations/20261010000000_student_portal.sql#ops_set_final_year_batch]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_set_final_year_batch(p_university uuid, p_batch smallint, p_reason text) | sql | false | search_path="" | authenticated, service_role | 20261010000000_student_portal.sql |

## public.request_account_deletion()

[src: supabase/migrations/20261010000000_student_portal.sql#request_account_deletion]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.request_account_deletion() | sql | false | search_path="" | authenticated, service_role | 20261010000000_student_portal.sql |

## public.respond_feedback(p_id uuid, p_status feedback_status, p_reply text)

[src: supabase/migrations/20261010000000_student_portal.sql#respond_feedback]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.respond_feedback(p_id uuid, p_status feedback_status, p_reply text) | sql | false | search_path="" | authenticated, service_role | 20261010000000_student_portal.sql |

## public.restart_tour(p_tour text)

[src: supabase/migrations/20261010000000_student_portal.sql#restart_tour]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.restart_tour(p_tour text) | sql | false | search_path="" | authenticated, service_role | 20261010000000_student_portal.sql |

## public.save_tour(p_tour text, p_step integer, p_outcome text)

[src: supabase/migrations/20261010000000_student_portal.sql#save_tour]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.save_tour(p_tour text, p_step integer, p_outcome text) | sql | false | search_path="" | authenticated, service_role | 20261010000000_student_portal.sql |

## public.see_tip(p_tip text)

[src: supabase/migrations/20261010000000_student_portal.sql#see_tip]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.see_tip(p_tip text) | sql | false | search_path="" | authenticated, service_role | 20261010000000_student_portal.sql |

## public.set_ui_state(p_key text, p_value jsonb)

[src: supabase/migrations/20261010000000_student_portal.sql#set_ui_state]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.set_ui_state(p_key text, p_value jsonb) | sql | false | search_path="" | authenticated, service_role | 20261010000000_student_portal.sql |

## public.submit_feedback(p_type feedback_type, p_body text, p_screenshot text, p_page text, p_device text, p_version text)

[src: supabase/migrations/20261010000000_student_portal.sql#submit_feedback]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.submit_feedback(p_type feedback_type, p_body text, p_screenshot text, p_page text, p_device text, p_version text) | sql | false | search_path="" | authenticated, service_role | 20261010000000_student_portal.sql |

## public.todo_counts()

[src: supabase/migrations/20261010000000_student_portal.sql#todo_counts]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.todo_counts() | sql | false | search_path="" | authenticated, service_role | 20261010000000_student_portal.sql |

## public.tour_state(p_tour text)

[src: supabase/migrations/20261010000000_student_portal.sql#tour_state]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.tour_state(p_tour text) | sql | false | search_path="" | authenticated, service_role | 20261010000000_student_portal.sql |

## public.feedback

[src: supabase/migrations/20261010000000_student_portal.sql#feedback]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| user_id | uuid | true | — |  |  | — |
| type | feedback_type | true | — |  |  | — |
| body | text | true | — |  |  | "default" |
| screenshot_path | text | false | — |  |  | "default" |
| page | text | false | — |  |  | "default" |
| device | text | false | — |  |  | "default" |
| app_version | text | false | — |  |  | "default" |
| status | feedback_status | true | 'received'::feedback_status |  |  | — |
| staff_reply | text | false | — |  |  | "default" |
| claimed_by | uuid | false | — |  |  | — |
| claimed_at | timestamp with time zone | false | — |  |  | — |
| replied_at | timestamp with time zone | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
feedback_app_version_check: CHECK (app_version IS NULL OR char_length(app_version) <= 40); -- validated: true
```

```sql
feedback_body_check: CHECK (char_length(btrim(body)) >= 3 AND char_length(btrim(body)) <= 2000); -- validated: true
```

```sql
feedback_claimed_by_fkey: FOREIGN KEY (claimed_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
feedback_device_check: CHECK (device IS NULL OR char_length(device) <= 200); -- validated: true
```

```sql
feedback_page_check: CHECK (page IS NULL OR char_length(page) <= 200); -- validated: true
```

```sql
feedback_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
feedback_screenshot_path_check: CHECK (screenshot_path IS NULL OR screenshot_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'::text); -- validated: true
```

```sql
feedback_staff_reply_check: CHECK (staff_reply IS NULL OR char_length(staff_reply) <= 2000); -- validated: true
```

```sql
feedback_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE INDEX feedback_claimed_by_idx ON public.feedback USING btree (claimed_by); -- valid: true
```

```sql
CREATE UNIQUE INDEX feedback_pkey ON public.feedback USING btree (id); -- valid: true
```

```sql
CREATE INDEX feedback_status_created_idx ON public.feedback USING btree (status, created_at); -- valid: true
```

```sql
CREATE INDEX feedback_user_created_idx ON public.feedback USING btree (user_id, created_at DESC); -- valid: true
```

### Policies

#### feedback.feedback_read_own

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
CREATE TRIGGER feedback_analytics AFTER INSERT ON feedback FOR EACH ROW EXECUTE FUNCTION private.analytics_feedback(); -- enabled: O
```

## public.tips_seen

[src: supabase/migrations/20261010000000_student_portal.sql#tips_seen]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| user_id | uuid | true | — |  |  | — |
| tip_id | text | true | — |  |  | "default" |
| seen_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
tips_seen_pkey: PRIMARY KEY (user_id, tip_id); -- validated: true
```

```sql
tips_seen_tip_id_check: CHECK (tip_id = ANY (ARRAY['opportunities'::text, 'venture'::text, 'cv'::text, 'score'::text, 'privacy'::text])); -- validated: true
```

```sql
tips_seen_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX tips_seen_pkey ON public.tips_seen USING btree (user_id, tip_id); -- valid: true
```

### Policies

#### tips_seen.tips_seen_read_own

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

## public.tour_progress

[src: supabase/migrations/20261010000000_student_portal.sql#tour_progress]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| user_id | uuid | true | — |  |  | — |
| tour_id | text | true | — |  |  | "default" |
| step | smallint | true | 0 |  |  | — |
| completed_at | timestamp with time zone | false | — |  |  | — |
| skipped_at | timestamp with time zone | false | — |  |  | — |
| updated_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
tour_progress_pkey: PRIMARY KEY (user_id, tour_id); -- validated: true
```

```sql
tour_progress_step_check: CHECK (step >= 0 AND step <= 50); -- validated: true
```

```sql
tour_progress_tour_id_check: CHECK (tour_id = ANY (ARRAY['student'::text, 'faculty'::text, 'recruiter'::text, 'uni_admin'::text])); -- validated: true
```

```sql
tour_progress_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX tour_progress_pkey ON public.tour_progress USING btree (user_id, tour_id); -- valid: true
```

### Policies

#### tour_progress.tour_progress_read_own

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
CREATE TRIGGER tour_progress_analytics AFTER UPDATE OF completed_at, skipped_at ON tour_progress FOR EACH ROW WHEN (old.completed_at IS NULL AND new.completed_at IS NOT NULL OR old.skipped_at IS NULL AND new.skipped_at IS NOT NULL) EXECUTE FUNCTION private.analytics_tour(); -- enabled: O
```

## public.ui_state

[src: supabase/migrations/20261010000000_student_portal.sql#ui_state]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| user_id | uuid | true | — |  |  | — |
| key | text | true | — |  |  | "default" |
| value | jsonb | true | 'null'::jsonb |  |  | — |
| updated_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
ui_state_key_check: CHECK (key ~ '^[a-z_]{2,40}$'::text); -- validated: true
```

```sql
ui_state_pkey: PRIMARY KEY (user_id, key); -- validated: true
```

```sql
ui_state_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX ui_state_pkey ON public.ui_state USING btree (user_id, key); -- valid: true
```

### Policies

#### ui_state.ui_state_read_own

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
