Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# chat

## private.delete_message(p_message uuid)

[src: supabase/migrations/20260929050000_chat.sql#delete_message]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.delete_message(p_message uuid) | plpgsql | true | search_path="" | authenticated | 20260929050000_chat.sql |

## private.edit_message(p_message uuid, p_body text)

[src: supabase/migrations/20260929050000_chat.sql#edit_message]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.edit_message(p_message uuid, p_body text) | plpgsql | true | search_path="" | authenticated | 20260929050000_chat.sql |

## private.get_or_create_dm(p_username text)

[src: supabase/migrations/20260929050000_chat.sql#get_or_create_dm]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.get_or_create_dm(p_username text) | plpgsql | true | search_path="" | authenticated | 20260929050000_chat.sql |

## private.is_thread_member(p_thread uuid)

[src: supabase/migrations/20260929050000_chat.sql#is_thread_member]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.is_thread_member(p_thread uuid) | sql | true | search_path="" | authenticated | 20260929050000_chat.sql |

## private.mark_thread_read(p_thread uuid)

[src: supabase/migrations/20260929050000_chat.sql#mark_thread_read]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.mark_thread_read(p_thread uuid) | plpgsql | true | search_path="" | authenticated | 20260929050000_chat.sql |

## private.mute_thread(p_thread uuid, p_hours integer)

[src: supabase/migrations/20260929050000_chat.sql#mute_thread]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.mute_thread(p_thread uuid, p_hours integer) | plpgsql | true | search_path="" | authenticated | 20260929050000_chat.sql |

## private.notify_chat_message()

[src: supabase/migrations/20260929050000_chat.sql#notify_chat_message]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.notify_chat_message() | plpgsql | true | search_path="" | None | 20260929050000_chat.sql |

## private.storage_thread_member(p_name text)

[src: supabase/migrations/20260929050000_chat.sql#storage_thread_member]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.storage_thread_member(p_name text) | sql | true | search_path="" | authenticated | 20260929050000_chat.sql |

## private.unread_chat_count()

[src: supabase/migrations/20260929050000_chat.sql#unread_chat_count]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.unread_chat_count() | sql | true | search_path="" | authenticated | 20260929050000_chat.sql |

## private.venture_chat(p_venture uuid)

[src: supabase/migrations/20260929050000_chat.sql#venture_chat]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.venture_chat(p_venture uuid) | sql | true | search_path="" | authenticated | 20260929050000_chat.sql |

## private.venture_chat_created()

[src: supabase/migrations/20260929050000_chat.sql#venture_chat_created]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.venture_chat_created() | plpgsql | true | search_path="" | None | 20260929050000_chat.sql |

## private.venture_chat_membership()

[src: supabase/migrations/20260929050000_chat.sql#venture_chat_membership]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.venture_chat_membership() | plpgsql | true | search_path="" | None | 20260929050000_chat.sql |

## public.delete_message(p_message uuid)

[src: supabase/migrations/20260929050000_chat.sql#delete_message]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.delete_message(p_message uuid) | sql | false | search_path="" | authenticated, service_role | 20260929050000_chat.sql |

## public.edit_message(p_message uuid, p_body text)

[src: supabase/migrations/20260929050000_chat.sql#edit_message]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.edit_message(p_message uuid, p_body text) | sql | false | search_path="" | authenticated, service_role | 20260929050000_chat.sql |

## public.get_or_create_dm(p_username text)

[src: supabase/migrations/20260929050000_chat.sql#get_or_create_dm]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.get_or_create_dm(p_username text) | sql | false | search_path="" | authenticated, service_role | 20260929050000_chat.sql |

## public.mark_thread_read(p_thread uuid)

[src: supabase/migrations/20260929050000_chat.sql#mark_thread_read]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.mark_thread_read(p_thread uuid) | sql | false | search_path="" | authenticated, service_role | 20260929050000_chat.sql |

## public.mute_thread(p_thread uuid, p_hours integer)

[src: supabase/migrations/20260929050000_chat.sql#mute_thread]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.mute_thread(p_thread uuid, p_hours integer) | sql | false | search_path="" | authenticated, service_role | 20260929050000_chat.sql |

## public.my_threads()

[src: supabase/migrations/20260929050000_chat.sql#my_threads]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.my_threads() | sql | false | search_path="" | authenticated, service_role | 20260929050000_chat.sql |

## public.thread_people(p_thread uuid)

[src: supabase/migrations/20260929050000_chat.sql#thread_people]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.thread_people(p_thread uuid) | sql | false | search_path="" | authenticated, service_role | 20260929050000_chat.sql |

## public.unread_chat_count()

[src: supabase/migrations/20260929050000_chat.sql#unread_chat_count]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.unread_chat_count() | sql | false | search_path="" | authenticated, service_role | 20260929050000_chat.sql |

## public.venture_chat(p_venture uuid)

[src: supabase/migrations/20260929050000_chat.sql#venture_chat]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.venture_chat(p_venture uuid) | sql | false | search_path="" | authenticated, service_role | 20260929050000_chat.sql |

## public.chat_messages

[src: supabase/migrations/20260929050000_chat.sql#chat_messages]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| thread_id | uuid | true | — |  |  | — |
| sender_id | uuid | true | — |  |  | — |
| body | text | true | ''::text |  |  | "default" |
| media_path | text | false | — |  |  | "default" |
| media_width | integer | false | — |  |  | — |
| media_height | integer | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |
| edited_at | timestamp with time zone | false | — |  |  | — |
| deleted_at | timestamp with time zone | false | — |  |  | — |
| reply_to_id | uuid | false | — |  |  | — |
| link_url | text | false | — |  |  | "default" |
| search | tsvector | false | to_tsvector('simple'::regconfig, body) |  | s | — |
| removed_by | uuid | false | — |  |  | — |

### Keys and constraints

```sql
chat_messages_body_check: CHECK (char_length(body) <= 10000); -- validated: true
```

```sql
chat_messages_check: CHECK (deleted_at IS NOT NULL OR char_length(btrim(body)) > 0 OR media_path IS NOT NULL); -- validated: true
```

```sql
chat_messages_link_url_check: CHECK (link_url IS NULL OR char_length(link_url) <= 2000); -- validated: true
```

```sql
chat_messages_media_height_check: CHECK (media_height IS NULL OR media_height >= 1 AND media_height <= 4000); -- validated: true
```

```sql
chat_messages_media_path_check: CHECK (media_path IS NULL OR media_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'::text); -- validated: true
```

```sql
chat_messages_media_width_check: CHECK (media_width IS NULL OR media_width >= 1 AND media_width <= 4000); -- validated: true
```

```sql
chat_messages_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
chat_messages_removed_by_fkey: FOREIGN KEY (removed_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
chat_messages_reply_to_id_fkey: FOREIGN KEY (reply_to_id) REFERENCES chat_messages(id) ON DELETE SET NULL; -- validated: true
```

```sql
chat_messages_sender_id_fkey: FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

```sql
chat_messages_thread_id_fkey: FOREIGN KEY (thread_id) REFERENCES chat_threads(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX chat_messages_pkey ON public.chat_messages USING btree (id); -- valid: true
```

```sql
CREATE INDEX chat_messages_removed_by_idx ON public.chat_messages USING btree (removed_by); -- valid: true
```

```sql
CREATE INDEX chat_messages_reply_idx ON public.chat_messages USING btree (reply_to_id) WHERE (reply_to_id IS NOT NULL); -- valid: true
```

```sql
CREATE INDEX chat_messages_search_idx ON public.chat_messages USING gin (search); -- valid: true
```

```sql
CREATE INDEX chat_messages_sender_idx ON public.chat_messages USING btree (sender_id); -- valid: true
```

```sql
CREATE INDEX chat_messages_thread_created_idx ON public.chat_messages USING btree (thread_id, created_at DESC); -- valid: true
```

### Policies

#### chat_messages.chat_messages_member_read

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "(private.is_thread_member(thread_id) AND (NOT private.dm_blocked(thread_id)))",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

### Triggers

```sql
CREATE TRIGGER chat_messages_analytics AFTER INSERT ON chat_messages FOR EACH ROW EXECUTE FUNCTION private.analytics_chat_message(); -- enabled: O
```

```sql
CREATE TRIGGER chat_messages_link_url BEFORE INSERT OR UPDATE OF body ON chat_messages FOR EACH ROW EXECUTE FUNCTION private.post_link_url(); -- enabled: O
```

```sql
CREATE TRIGGER chat_messages_media_cleanup AFTER UPDATE OF media_path ON chat_messages FOR EACH ROW WHEN (old.media_path IS NOT NULL AND new.media_path IS DISTINCT FROM old.media_path) EXECUTE FUNCTION private.chat_media_cleanup(); -- enabled: O
```

```sql
CREATE TRIGGER chat_messages_notify AFTER INSERT ON chat_messages FOR EACH ROW EXECUTE FUNCTION private.notify_chat_message(); -- enabled: O
```

```sql
CREATE TRIGGER refuse_if_restricted BEFORE INSERT ON chat_messages FOR EACH ROW EXECUTE FUNCTION private.refuse_if_restricted(); -- enabled: O
```

## public.chat_thread_members

[src: supabase/migrations/20260929050000_chat.sql#chat_thread_members]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| thread_id | uuid | true | — |  |  | — |
| user_id | uuid | true | — |  |  | — |
| joined_at | timestamp with time zone | true | now() |  |  | — |
| last_read_at | timestamp with time zone | true | now() |  |  | — |
| muted_until | timestamp with time zone | false | — |  |  | — |

### Keys and constraints

```sql
chat_thread_members_pkey: PRIMARY KEY (thread_id, user_id); -- validated: true
```

```sql
chat_thread_members_thread_id_fkey: FOREIGN KEY (thread_id) REFERENCES chat_threads(id) ON DELETE CASCADE; -- validated: true
```

```sql
chat_thread_members_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX chat_thread_members_pkey ON public.chat_thread_members USING btree (thread_id, user_id); -- valid: true
```

```sql
CREATE INDEX chat_thread_members_user_idx ON public.chat_thread_members USING btree (user_id); -- valid: true
```

### Policies

#### chat_thread_members.chat_thread_members_member_read

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "private.is_thread_member(thread_id)",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

### Triggers

None.

## public.chat_threads

[src: supabase/migrations/20260929050000_chat.sql#chat_threads]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| type | chat_thread_type | true | — |  |  | — |
| venture_id | uuid | false | — |  |  | — |
| dm_key | text | false | — |  |  | "default" |
| created_at | timestamp with time zone | true | now() |  |  | — |
| last_message_at | timestamp with time zone | false | — |  |  | — |
| org_id | uuid | false | — |  |  | — |
| closed_at | timestamp with time zone | false | — |  |  | — |
| fair_id | uuid | false | — |  |  | — |

### Keys and constraints

```sql
chat_threads_check: CHECK ((type = 'group'::chat_thread_type) = (venture_id IS NOT NULL)); -- validated: true
```

```sql
chat_threads_check1: CHECK ((type = 'dm'::chat_thread_type) = (dm_key IS NOT NULL)); -- validated: true
```

```sql
chat_threads_fair_id_fkey: FOREIGN KEY (fair_id) REFERENCES job_fairs(id) ON DELETE SET NULL; -- validated: true
```

```sql
chat_threads_org_id_fkey: FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE SET NULL; -- validated: true
```

```sql
chat_threads_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
chat_threads_venture_id_fkey: FOREIGN KEY (venture_id) REFERENCES ventures(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX chat_threads_dm_key_idx ON public.chat_threads USING btree (dm_key) WHERE (type = 'dm'::chat_thread_type); -- valid: true
```

```sql
CREATE INDEX chat_threads_fair_idx ON public.chat_threads USING btree (fair_id); -- valid: true
```

```sql
CREATE UNIQUE INDEX chat_threads_pkey ON public.chat_threads USING btree (id); -- valid: true
```

```sql
CREATE UNIQUE INDEX chat_threads_venture_idx ON public.chat_threads USING btree (venture_id) WHERE (type = 'group'::chat_thread_type); -- valid: true
```

### Policies

#### chat_threads.chat_threads_member_read

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "private.is_thread_member(id)",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

### Triggers

None.
