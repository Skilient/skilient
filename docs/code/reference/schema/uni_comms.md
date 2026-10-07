Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# uni_comms

## private.announcement_reaches(p_post uuid)

[src: supabase/migrations/20261019000000_uni_comms.sql#announcement_reaches]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.announcement_reaches(p_post uuid) | sql | true | search_path="" | authenticated | 20261019000000_uni_comms.sql |

## private.can_attend_event(p_event uuid)

[src: supabase/migrations/20261019000000_uni_comms.sql#can_attend_event]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.can_attend_event(p_event uuid) | sql | true | search_path="" | None | 20261019000000_uni_comms.sql |

## private.can_see_event(p_event uuid)

[src: supabase/migrations/20261019000000_uni_comms.sql#can_see_event]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.can_see_event(p_event uuid) | sql | true | search_path="" | None | 20261019000000_uni_comms.sql |

## private.can_view_post(p_post uuid)

[src: supabase/migrations/20261019000000_uni_comms.sql#can_view_post]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.can_view_post(p_post uuid) | sql | true | search_path="" | authenticated | 20261019000000_uni_comms.sql |

## private.cancel_event(p_id uuid)

[src: supabase/migrations/20261019000000_uni_comms.sql#cancel_event]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.cancel_event(p_id uuid) | plpgsql | true | search_path="" | authenticated | 20261019000000_uni_comms.sql |

## private.cancel_rsvp(p_id uuid)

[src: supabase/migrations/20261019000000_uni_comms.sql#cancel_rsvp]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.cancel_rsvp(p_id uuid) | plpgsql | true | search_path="" | authenticated | 20261019000000_uni_comms.sql |

## private.check_in_event(p_id uuid, p_token text)

[src: supabase/migrations/20261019000000_uni_comms.sql#check_in_event]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.check_in_event(p_id uuid, p_token text) | plpgsql | true | search_path="" | authenticated | 20261019000000_uni_comms.sql |

## private.event_card(p_event uuid)

[src: supabase/migrations/20261019000000_uni_comms.sql#event_card]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.event_card(p_event uuid) | sql | true | search_path="" | None | 20261019000000_uni_comms.sql |

## private.event_checkin_code(p_id uuid)

[src: supabase/migrations/20261019000000_uni_comms.sql#event_checkin_code]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.event_checkin_code(p_id uuid) | plpgsql | true | search_path="" | authenticated | 20261019000000_uni_comms.sql |

## private.event_code(p_event uuid, p_window bigint)

[src: supabase/migrations/20261019000000_uni_comms.sql#event_code]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.event_code(p_event uuid, p_window bigint) | sql | true | search_path="" | None | 20261019000000_uni_comms.sql |

## private.event_detail(p_id uuid)

[src: supabase/migrations/20261019000000_uni_comms.sql#event_detail]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.event_detail(p_id uuid) | plpgsql | true | search_path="" | authenticated | 20261019000000_uni_comms.sql |

## private.event_going(p_event uuid)

[src: supabase/migrations/20261019000000_uni_comms.sql#event_going]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.event_going(p_event uuid) | sql | true | search_path="" | None | 20261019000000_uni_comms.sql |

## private.events_list(p_when text)

[src: supabase/migrations/20261019000000_uni_comms.sql#events_list]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.events_list(p_when text) | plpgsql | true | search_path="" | authenticated | 20261019000000_uni_comms.sql |

## private.is_uni_role_of(p_university uuid, p_roles uni_admin_role[])

[src: supabase/migrations/20261019000000_uni_comms.sql#is_uni_role_of]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.is_uni_role_of(p_university uuid, p_roles uni_admin_role[]) | sql | true | search_path="" | authenticated | 20261019000000_uni_comms.sql |

## private.keep_university_pin()

[src: supabase/migrations/20261019000000_uni_comms.sql#keep_university_pin]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.keep_university_pin() | plpgsql | true | search_path="" | None | 20261019000000_uni_comms.sql |

## private.my_uni_announcements(p_limit integer)

[src: supabase/migrations/20261019000000_uni_comms.sql#my_uni_announcements]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.my_uni_announcements(p_limit integer) | sql | true | search_path="" | authenticated | 20261019000000_uni_comms.sql |

## private.ops_university_hides(p_case uuid)

[src: supabase/migrations/20261019000000_uni_comms.sql#ops_university_hides]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_university_hides(p_case uuid) | plpgsql | true | search_path="" | authenticated | 20261019000000_uni_comms.sql |

## private.pinned_announcement()

[src: supabase/migrations/20261019000000_uni_comms.sql#pinned_announcement]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.pinned_announcement() | sql | true | search_path="" | authenticated | 20261019000000_uni_comms.sql |

## private.pinned_university_announcement()

[src: supabase/migrations/20261019000000_uni_comms.sql#pinned_university_announcement]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.pinned_university_announcement() | sql | true | search_path="" | authenticated | 20261019000000_uni_comms.sql |

## private.post_comment_list(p_post uuid)

[src: supabase/migrations/20261019000000_uni_comms.sql#post_comment_list]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.post_comment_list(p_post uuid) | sql | true | search_path="" | authenticated | 20261019000000_uni_comms.sql |

## private.rsvp_event(p_id uuid)

[src: supabase/migrations/20261019000000_uni_comms.sql#rsvp_event]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.rsvp_event(p_id uuid) | plpgsql | true | search_path="" | authenticated | 20261019000000_uni_comms.sql |

## private.save_event(p_id uuid, p jsonb)

[src: supabase/migrations/20261019000000_uni_comms.sql#save_event]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.save_event(p_id uuid, p jsonb) | plpgsql | true | search_path="" | authenticated | 20261019000000_uni_comms.sql |

## private.uni_announcements()

[src: supabase/migrations/20261019000000_uni_comms.sql#uni_announcements]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.uni_announcements() | plpgsql | true | search_path="" | authenticated | 20261019000000_uni_comms.sql |

## private.uni_end_announcement(p_post uuid)

[src: supabase/migrations/20261019000000_uni_comms.sql#uni_end_announcement]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.uni_end_announcement(p_post uuid) | plpgsql | true | search_path="" | authenticated | 20261019000000_uni_comms.sql |

## private.uni_events()

[src: supabase/migrations/20261019000000_uni_comms.sql#uni_events]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.uni_events() | plpgsql | true | search_path="" | authenticated | 20261019000000_uni_comms.sql |

## private.uni_events_hourly()

[src: supabase/migrations/20261019000000_uni_comms.sql#uni_events_hourly]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.uni_events_hourly() | plpgsql | true | search_path="" | None | 20261019000000_uni_comms.sql |

## private.uni_hide(p_type text, p_id uuid, p_reason text)

[src: supabase/migrations/20261019000000_uni_comms.sql#uni_hide]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.uni_hide(p_type text, p_id uuid, p_reason text) | plpgsql | true | search_path="" | authenticated | 20261019000000_uni_comms.sql |

## private.uni_moderation()

[src: supabase/migrations/20261019000000_uni_comms.sql#uni_moderation]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.uni_moderation() | plpgsql | true | search_path="" | authenticated | 20261019000000_uni_comms.sql |

## private.uni_post_announcement(p jsonb)

[src: supabase/migrations/20261019000000_uni_comms.sql#uni_post_announcement]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.uni_post_announcement(p jsonb) | plpgsql | true | search_path="" | authenticated | 20261019000000_uni_comms.sql |

## private.university_hide_decided()

[src: supabase/migrations/20261019000000_uni_comms.sql#university_hide_decided]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.university_hide_decided() | plpgsql | true | search_path="" | None | 20261019000000_uni_comms.sql |

## public.cancel_event(p_id uuid)

[src: supabase/migrations/20261019000000_uni_comms.sql#cancel_event]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.cancel_event(p_id uuid) | sql | false | search_path="" | authenticated, service_role | 20261019000000_uni_comms.sql |

## public.cancel_rsvp(p_id uuid)

[src: supabase/migrations/20261019000000_uni_comms.sql#cancel_rsvp]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.cancel_rsvp(p_id uuid) | sql | false | search_path="" | authenticated, service_role | 20261019000000_uni_comms.sql |

## public.check_in_event(p_id uuid, p_token text)

[src: supabase/migrations/20261019000000_uni_comms.sql#check_in_event]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.check_in_event(p_id uuid, p_token text) | sql | false | search_path="" | authenticated, service_role | 20261019000000_uni_comms.sql |

## public.event_checkin_code(p_id uuid)

[src: supabase/migrations/20261019000000_uni_comms.sql#event_checkin_code]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.event_checkin_code(p_id uuid) | sql | false | search_path="" | authenticated, service_role | 20261019000000_uni_comms.sql |

## public.event_detail(p_id uuid)

[src: supabase/migrations/20261019000000_uni_comms.sql#event_detail]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.event_detail(p_id uuid) | sql | false | search_path="" | authenticated, service_role | 20261019000000_uni_comms.sql |

## public.events_list(p_when text)

[src: supabase/migrations/20261019000000_uni_comms.sql#events_list]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.events_list(p_when text) | sql | false | search_path="" | authenticated, service_role | 20261019000000_uni_comms.sql |

## public.my_uni_announcements(p_limit integer)

[src: supabase/migrations/20261019000000_uni_comms.sql#my_uni_announcements]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.my_uni_announcements(p_limit integer) | sql | false | search_path="" | authenticated, service_role | 20261019000000_uni_comms.sql |

## public.ops_university_hides(p_case uuid)

[src: supabase/migrations/20261019000000_uni_comms.sql#ops_university_hides]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_university_hides(p_case uuid) | sql | false | search_path="" | authenticated, service_role | 20261019000000_uni_comms.sql |

## public.pinned_university_announcement()

[src: supabase/migrations/20261019000000_uni_comms.sql#pinned_university_announcement]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.pinned_university_announcement() | sql | false | search_path="" | authenticated, service_role | 20261019000000_uni_comms.sql |

## public.rsvp_event(p_id uuid)

[src: supabase/migrations/20261019000000_uni_comms.sql#rsvp_event]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.rsvp_event(p_id uuid) | sql | false | search_path="" | authenticated, service_role | 20261019000000_uni_comms.sql |

## public.save_event(p_id uuid, p jsonb)

[src: supabase/migrations/20261019000000_uni_comms.sql#save_event]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.save_event(p_id uuid, p jsonb) | sql | false | search_path="" | authenticated, service_role | 20261019000000_uni_comms.sql |

## public.uni_announcements()

[src: supabase/migrations/20261019000000_uni_comms.sql#uni_announcements]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.uni_announcements() | sql | false | search_path="" | authenticated, service_role | 20261019000000_uni_comms.sql |

## public.uni_end_announcement(p_post uuid)

[src: supabase/migrations/20261019000000_uni_comms.sql#uni_end_announcement]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.uni_end_announcement(p_post uuid) | sql | false | search_path="" | authenticated, service_role | 20261019000000_uni_comms.sql |

## public.uni_events()

[src: supabase/migrations/20261019000000_uni_comms.sql#uni_events]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.uni_events() | sql | false | search_path="" | authenticated, service_role | 20261019000000_uni_comms.sql |

## public.uni_hide(p_type text, p_id uuid, p_reason text)

[src: supabase/migrations/20261019000000_uni_comms.sql#uni_hide]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.uni_hide(p_type text, p_id uuid, p_reason text) | sql | false | search_path="" | authenticated, service_role | 20261019000000_uni_comms.sql |

## public.uni_moderation()

[src: supabase/migrations/20261019000000_uni_comms.sql#uni_moderation]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.uni_moderation() | sql | false | search_path="" | authenticated, service_role | 20261019000000_uni_comms.sql |

## public.uni_post_announcement(p jsonb)

[src: supabase/migrations/20261019000000_uni_comms.sql#uni_post_announcement]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.uni_post_announcement(p jsonb) | sql | false | search_path="" | authenticated, service_role | 20261019000000_uni_comms.sql |

## private.event_secrets

[src: supabase/migrations/20261019000000_uni_comms.sql#event_secrets]

RLS: false; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| event_id | uuid | true | — |  |  | — |
| secret | bytea | true | gen_random_bytes(32) |  |  | — |

### Keys and constraints

```sql
event_secrets_event_id_fkey: FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE; -- validated: true
```

```sql
event_secrets_pkey: PRIMARY KEY (event_id); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX event_secrets_pkey ON private.event_secrets USING btree (event_id); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.announcement_meta

[src: supabase/migrations/20261019000000_uni_comms.sql#announcement_meta]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| post_id | uuid | true | — |  |  | — |
| university_id | uuid | true | — |  |  | — |
| category | text | false | — |  |  | "default" |
| expires_at | timestamp with time zone | true | — |  |  | — |
| created_by | uuid | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
announcement_meta_category_check: CHECK (category IS NULL OR char_length(category) >= 2 AND char_length(category) <= 40); -- validated: true
```

```sql
announcement_meta_created_by_fkey: FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
announcement_meta_pkey: PRIMARY KEY (post_id); -- validated: true
```

```sql
announcement_meta_post_id_fkey: FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE; -- validated: true
```

```sql
announcement_meta_university_id_fkey: FOREIGN KEY (university_id) REFERENCES universities(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE INDEX announcement_meta_created_by_idx ON public.announcement_meta USING btree (created_by); -- valid: true
```

```sql
CREATE UNIQUE INDEX announcement_meta_pkey ON public.announcement_meta USING btree (post_id); -- valid: true
```

```sql
CREATE INDEX announcement_meta_uni_idx ON public.announcement_meta USING btree (university_id, created_at DESC); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.announcement_targets

[src: supabase/migrations/20261019000000_uni_comms.sql#announcement_targets]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| post_id | uuid | true | — |  |  | — |
| department_id | uuid | false | — |  |  | — |
| batch_year | smallint | false | — |  |  | — |

### Keys and constraints

```sql
announcement_targets_batch_year_check: CHECK (batch_year IS NULL OR batch_year >= 1980 AND batch_year <= 2100); -- validated: true
```

```sql
announcement_targets_check: CHECK (department_id IS NOT NULL OR batch_year IS NOT NULL); -- validated: true
```

```sql
announcement_targets_department_id_fkey: FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE; -- validated: true
```

```sql
announcement_targets_post_id_fkey: FOREIGN KEY (post_id) REFERENCES announcement_meta(post_id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE INDEX announcement_targets_department_idx ON public.announcement_targets USING btree (department_id); -- valid: true
```

```sql
CREATE INDEX announcement_targets_post_idx ON public.announcement_targets USING btree (post_id); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.event_registrations

[src: supabase/migrations/20261019000000_uni_comms.sql#event_registrations]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| event_id | uuid | true | — |  |  | — |
| user_id | uuid | true | — |  |  | — |
| registered_at | timestamp with time zone | true | now() |  |  | — |
| cancelled_at | timestamp with time zone | false | — |  |  | — |
| checked_in_at | timestamp with time zone | false | — |  |  | — |
| reminded_at | timestamp with time zone | false | — |  |  | — |

### Keys and constraints

```sql
event_registrations_event_id_fkey: FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE; -- validated: true
```

```sql
event_registrations_pkey: PRIMARY KEY (event_id, user_id); -- validated: true
```

```sql
event_registrations_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX event_registrations_pkey ON public.event_registrations USING btree (event_id, user_id); -- valid: true
```

```sql
CREATE INDEX event_registrations_user_idx ON public.event_registrations USING btree (user_id); -- valid: true
```

### Policies

#### event_registrations.event_registrations_read_own

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
CREATE TRIGGER refuse_if_restricted BEFORE INSERT ON event_registrations FOR EACH ROW EXECUTE FUNCTION private.refuse_if_restricted(); -- enabled: O
```

## public.events

[src: supabase/migrations/20261019000000_uni_comms.sql#events]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| university_id | uuid | true | — |  |  | — |
| created_by | uuid | false | — |  |  | — |
| type | uni_event_type | true | — |  |  | — |
| scope | uni_event_scope | true | 'university'::uni_event_scope |  |  | — |
| title | text | true | — |  |  | "default" |
| description | text | false | — |  |  | "default" |
| starts_at | timestamp with time zone | true | — |  |  | — |
| ends_at | timestamp with time zone | true | — |  |  | — |
| location | text | false | — |  |  | "default" |
| link | text | false | — |  |  | "default" |
| capacity | integer | false | — |  |  | — |
| cancelled_at | timestamp with time zone | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |
| updated_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
events_capacity_check: CHECK (capacity IS NULL OR capacity >= 1 AND capacity <= 20000); -- validated: true
```

```sql
events_check: CHECK (ends_at > starts_at AND ends_at <= (starts_at + '14 days'::interval)); -- validated: true
```

```sql
events_check1: CHECK (location IS NOT NULL OR link IS NOT NULL); -- validated: true
```

```sql
events_created_by_fkey: FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
events_description_check: CHECK (description IS NULL OR char_length(description) <= 4000); -- validated: true
```

```sql
events_link_check: CHECK (link IS NULL OR link ~ '^https://[^[:space:]]+$'::text AND char_length(link) <= 500); -- validated: true
```

```sql
events_location_check: CHECK (location IS NULL OR char_length(btrim(location)) >= 2 AND char_length(btrim(location)) <= 120); -- validated: true
```

```sql
events_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
events_title_check: CHECK (char_length(btrim(title)) >= 3 AND char_length(btrim(title)) <= 120); -- validated: true
```

```sql
events_university_id_fkey: FOREIGN KEY (university_id) REFERENCES universities(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE INDEX events_created_by_idx ON public.events USING btree (created_by); -- valid: true
```

```sql
CREATE INDEX events_global_idx ON public.events USING btree (starts_at) WHERE ((scope = 'global'::uni_event_scope) AND (cancelled_at IS NULL)); -- valid: true
```

```sql
CREATE UNIQUE INDEX events_pkey ON public.events USING btree (id); -- valid: true
```

```sql
CREATE INDEX events_uni_idx ON public.events USING btree (university_id, starts_at); -- valid: true
```

### Policies

None.

### Triggers

```sql
CREATE TRIGGER events_set_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION private.set_updated_at(); -- enabled: O
```

## public.university_hides

[src: supabase/migrations/20261019000000_uni_comms.sql#university_hides]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| university_id | uuid | true | — |  |  | — |
| target_type | report_target | true | — |  |  | — |
| target_id | uuid | true | — |  |  | — |
| author_id | uuid | false | — |  |  | — |
| hidden_by | uuid | false | — |  |  | — |
| reason | text | true | — |  |  | "default" |
| case_id | uuid | false | — |  |  | — |
| status | uni_hide_status | true | 'hidden'::uni_hide_status |  |  | — |
| decided_by | uuid | false | — |  |  | — |
| decided_at | timestamp with time zone | false | — |  |  | — |
| decision_reason | text | false | — |  |  | "default" |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
university_hides_author_id_fkey: FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
university_hides_case_id_fkey: FOREIGN KEY (case_id) REFERENCES report_cases(id) ON DELETE SET NULL; -- validated: true
```

```sql
university_hides_decided_by_fkey: FOREIGN KEY (decided_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
university_hides_decision_reason_check: CHECK (decision_reason IS NULL OR char_length(decision_reason) <= 2000); -- validated: true
```

```sql
university_hides_hidden_by_fkey: FOREIGN KEY (hidden_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
university_hides_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
university_hides_reason_check: CHECK (char_length(btrim(reason)) >= 3 AND char_length(btrim(reason)) <= 500); -- validated: true
```

```sql
university_hides_target_type_check: CHECK (target_type = ANY (ARRAY['post'::report_target, 'comment'::report_target])); -- validated: true
```

```sql
university_hides_university_id_fkey: FOREIGN KEY (university_id) REFERENCES universities(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE INDEX university_hides_author_idx ON public.university_hides USING btree (author_id); -- valid: true
```

```sql
CREATE INDEX university_hides_case_idx ON public.university_hides USING btree (case_id); -- valid: true
```

```sql
CREATE INDEX university_hides_decided_by_idx ON public.university_hides USING btree (decided_by); -- valid: true
```

```sql
CREATE INDEX university_hides_hidden_by_idx ON public.university_hides USING btree (hidden_by); -- valid: true
```

```sql
CREATE UNIQUE INDEX university_hides_open_idx ON public.university_hides USING btree (target_type, target_id) WHERE (status = 'hidden'::uni_hide_status); -- valid: true
```

```sql
CREATE UNIQUE INDEX university_hides_pkey ON public.university_hides USING btree (id); -- valid: true
```

```sql
CREATE INDEX university_hides_target_idx ON public.university_hides USING btree (target_type, target_id); -- valid: true
```

```sql
CREATE INDEX university_hides_uni_idx ON public.university_hides USING btree (university_id, created_at DESC); -- valid: true
```

### Policies

None.

### Triggers

None.
