Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# notifications

## private.mark_all_notifications_read()

[src: supabase/migrations/20260929000000_notifications.sql#mark_all_notifications_read]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.mark_all_notifications_read() | plpgsql | true | search_path="" | authenticated | 20260929000000_notifications.sql |

## private.mark_notification_read(p_id uuid)

[src: supabase/migrations/20260929000000_notifications.sql#mark_notification_read]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.mark_notification_read(p_id uuid) | plpgsql | true | search_path="" | authenticated | 20260929000000_notifications.sql |

## private.my_notification_settings()

[src: supabase/migrations/20260929000000_notifications.sql#my_notification_settings]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.my_notification_settings() | sql | true | search_path="" | authenticated | 20260929000000_notifications.sql |

## private.my_notifications(p_before timestamp with time zone, p_limit integer)

[src: supabase/migrations/20260929000000_notifications.sql#my_notifications]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.my_notifications(p_before timestamp with time zone, p_limit integer) | sql | true | search_path="" | authenticated | 20260929000000_notifications.sql |

## private.notify_applications()

[src: supabase/migrations/20260929000000_notifications.sql#notify_applications]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.notify_applications() | plpgsql | true | search_path="" | None | 20260929000000_notifications.sql |

## private.notify_friend_requests()

[src: supabase/migrations/20260929000000_notifications.sql#notify_friend_requests]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.notify_friend_requests() | plpgsql | true | search_path="" | None | 20260929000000_notifications.sql |

## private.notify_invites()

[src: supabase/migrations/20260929000000_notifications.sql#notify_invites]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.notify_invites() | plpgsql | true | search_path="" | None | 20260929000000_notifications.sql |

## private.notify_member_removed()

[src: supabase/migrations/20260929000000_notifications.sql#notify_member_removed]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.notify_member_removed() | plpgsql | true | search_path="" | None | 20260929000000_notifications.sql |

## private.notify_venture_changes()

[src: supabase/migrations/20260929000000_notifications.sql#notify_venture_changes]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.notify_venture_changes() | plpgsql | true | search_path="" | None | 20260929000000_notifications.sql |

## private.purge_notifications()

[src: supabase/migrations/20260929000000_notifications.sql#purge_notifications]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.purge_notifications() | sql | true | search_path="" | None | 20260929000000_notifications.sql |

## private.queue_notification_digests()

[src: supabase/migrations/20260929000000_notifications.sql#queue_notification_digests]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.queue_notification_digests() | plpgsql | true | search_path="" | None | 20260929000000_notifications.sql |

## private.set_notification_pref(p_category text, p_channel email_channel)

[src: supabase/migrations/20260929000000_notifications.sql#set_notification_pref]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.set_notification_pref(p_category text, p_channel email_channel) | plpgsql | true | search_path="" | authenticated | 20260929000000_notifications.sql |

## private.touch_activity()

[src: supabase/migrations/20260929000000_notifications.sql#touch_activity]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.touch_activity() | sql | true | search_path="" | authenticated | 20260929000000_notifications.sql |

## private.unread_notification_count()

[src: supabase/migrations/20260929000000_notifications.sql#unread_notification_count]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.unread_notification_count() | sql | true | search_path="" | authenticated | 20260929000000_notifications.sql |

## private.venture_data(p_venture uuid)

[src: supabase/migrations/20260929000000_notifications.sql#venture_data]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.venture_data(p_venture uuid) | sql | true | search_path="" | None | 20260929000000_notifications.sql |

## private.wake_notify_worker()

[src: supabase/migrations/20260929000000_notifications.sql#wake_notify_worker]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.wake_notify_worker() | plpgsql | true | search_path="" | None | 20260929000000_notifications.sql |

## public.mark_all_notifications_read()

[src: supabase/migrations/20260929000000_notifications.sql#mark_all_notifications_read]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.mark_all_notifications_read() | sql | false | search_path="" | authenticated, service_role | 20260929000000_notifications.sql |

## public.mark_notification_read(p_id uuid)

[src: supabase/migrations/20260929000000_notifications.sql#mark_notification_read]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.mark_notification_read(p_id uuid) | sql | false | search_path="" | authenticated, service_role | 20260929000000_notifications.sql |

## public.my_notification_settings()

[src: supabase/migrations/20260929000000_notifications.sql#my_notification_settings]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.my_notification_settings() | sql | false | search_path="" | authenticated, service_role | 20260929000000_notifications.sql |

## public.my_notifications(p_before timestamp with time zone, p_limit integer)

[src: supabase/migrations/20260929000000_notifications.sql#my_notifications]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.my_notifications(p_before timestamp with time zone, p_limit integer) | sql | false | search_path="" | authenticated, service_role | 20260929000000_notifications.sql |

## public.set_notification_pref(p_category text, p_channel email_channel)

[src: supabase/migrations/20260929000000_notifications.sql#set_notification_pref]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.set_notification_pref(p_category text, p_channel email_channel) | sql | false | search_path="" | authenticated, service_role | 20260929000000_notifications.sql |

## public.touch_activity()

[src: supabase/migrations/20260929000000_notifications.sql#touch_activity]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.touch_activity() | sql | false | search_path="" | authenticated, service_role | 20260929000000_notifications.sql |

## public.unread_notification_count()

[src: supabase/migrations/20260929000000_notifications.sql#unread_notification_count]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.unread_notification_count() | sql | false | search_path="" | authenticated, service_role | 20260929000000_notifications.sql |

## private.email_sends

[src: supabase/migrations/20260929000000_notifications.sql#email_sends]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | bigint | true | — | a |  | — |
| kind | text | true | — |  |  | "default" |
| user_id | uuid | false | — |  |  | — |
| notification_id | uuid | false | — |  |  | — |
| resend_id | text | false | — |  |  | "default" |
| sent_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
email_sends_kind_check: CHECK (kind = ANY (ARRAY['instant'::text, 'digest'::text])); -- validated: true
```

```sql
email_sends_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
email_sends_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX email_sends_pkey ON private.email_sends USING btree (id); -- valid: true
```

```sql
CREATE INDEX email_sends_sent_at_idx ON private.email_sends USING btree (sent_at); -- valid: true
```

```sql
CREATE INDEX email_sends_user_idx ON private.email_sends USING btree (user_id); -- valid: true
```

### Policies

None.

### Triggers

None.

## private.user_activity

[src: supabase/migrations/20260929000000_notifications.sql#user_activity]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| user_id | uuid | true | — |  |  | — |
| last_active_at | timestamp with time zone | true | now() |  |  | — |
| last_digest_at | timestamp with time zone | false | — |  |  | — |

### Keys and constraints

```sql
user_activity_pkey: PRIMARY KEY (user_id); -- validated: true
```

```sql
user_activity_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX user_activity_pkey ON private.user_activity USING btree (user_id); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.notification_categories

[src: supabase/migrations/20260929000000_notifications.sql#notification_categories]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| category | text | true | — |  |  | "default" |
| label | text | true | — |  |  | "default" |
| description | text | true | — |  |  | "default" |
| position | smallint | true | — |  |  | — |
| default_channel | email_channel | true | — |  |  | — |
| allow_instant | boolean | true | false |  |  | — |

### Keys and constraints

```sql
notification_categories_category_check: CHECK (category ~ '^[a-z_]{2,40}$'::text); -- validated: true
```

```sql
notification_categories_check: CHECK (default_channel <> 'instant_email'::email_channel OR allow_instant); -- validated: true
```

```sql
notification_categories_pkey: PRIMARY KEY (category); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX notification_categories_pkey ON public.notification_categories USING btree (category); -- valid: true
```

### Policies

#### notification_categories.notification_categories_read

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

## public.notification_prefs

[src: supabase/migrations/20260929000000_notifications.sql#notification_prefs]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| user_id | uuid | true | — |  |  | — |
| category | text | true | — |  |  | "default" |
| channel | email_channel | true | — |  |  | — |
| updated_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
notification_prefs_category_fkey: FOREIGN KEY (category) REFERENCES notification_categories(category); -- validated: true
```

```sql
notification_prefs_pkey: PRIMARY KEY (user_id, category); -- validated: true
```

```sql
notification_prefs_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE INDEX notification_prefs_category_idx ON public.notification_prefs USING btree (category); -- valid: true
```

```sql
CREATE UNIQUE INDEX notification_prefs_pkey ON public.notification_prefs USING btree (user_id, category); -- valid: true
```

### Policies

#### notification_prefs.notification_prefs_read_own

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

## public.notification_types

[src: supabase/migrations/20260929000000_notifications.sql#notification_types]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| type | text | true | — |  |  | "default" |
| category | text | true | — |  |  | "default" |
| emailed | boolean | true | true |  |  | — |

### Keys and constraints

```sql
notification_types_category_fkey: FOREIGN KEY (category) REFERENCES notification_categories(category); -- validated: true
```

```sql
notification_types_pkey: PRIMARY KEY (type); -- validated: true
```

```sql
notification_types_type_check: CHECK (type ~ '^[a-z_]{2,40}$'::text); -- validated: true
```

### Indexes

```sql
CREATE INDEX notification_types_category_idx ON public.notification_types USING btree (category); -- valid: true
```

```sql
CREATE UNIQUE INDEX notification_types_pkey ON public.notification_types USING btree (type); -- valid: true
```

### Policies

#### notification_types.notification_types_read

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

## public.notifications

[src: supabase/migrations/20260929000000_notifications.sql#notifications]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| user_id | uuid | true | — |  |  | — |
| actor_id | uuid | false | — |  |  | — |
| type | text | true | — |  |  | "default" |
| entity_type | text | true | — |  |  | "default" |
| entity_id | uuid | true | — |  |  | — |
| data | jsonb | true | '{}'::jsonb |  |  | — |
| read_at | timestamp with time zone | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
notifications_actor_id_fkey: FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
notifications_check: CHECK (actor_id IS NULL OR actor_id <> user_id); -- validated: true
```

```sql
notifications_data_check: CHECK (jsonb_typeof(data) = 'object'::text); -- validated: true
```

```sql
notifications_entity_type_check: CHECK (char_length(entity_type) >= 1 AND char_length(entity_type) <= 40); -- validated: true
```

```sql
notifications_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
notifications_type_fkey: FOREIGN KEY (type) REFERENCES notification_types(type); -- validated: true
```

```sql
notifications_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE INDEX notifications_actor_idx ON public.notifications USING btree (actor_id); -- valid: true
```

```sql
CREATE INDEX notifications_entity_idx ON public.notifications USING btree (entity_type, entity_id); -- valid: true
```

```sql
CREATE UNIQUE INDEX notifications_pkey ON public.notifications USING btree (id); -- valid: true
```

```sql
CREATE INDEX notifications_type_idx ON public.notifications USING btree (type); -- valid: true
```

```sql
CREATE INDEX notifications_user_created_idx ON public.notifications USING btree (user_id, created_at DESC); -- valid: true
```

```sql
CREATE INDEX notifications_user_unread_idx ON public.notifications USING btree (user_id) WHERE (read_at IS NULL); -- valid: true
```

### Policies

#### notifications.notifications_read_own

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
