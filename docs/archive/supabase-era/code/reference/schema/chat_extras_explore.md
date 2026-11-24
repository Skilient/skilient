Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# chat_extras_explore

## private.contains_pattern(p_q text)

[src: supabase/migrations/20260929060000_chat_extras_explore.sql#contains_pattern]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.contains_pattern(p_q text) | sql | false | search_path="" | authenticated | 20260929060000_chat_extras_explore.sql |

## private.dm_receipt(p_thread uuid)

[src: supabase/migrations/20260929060000_chat_extras_explore.sql#dm_receipt]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.dm_receipt(p_thread uuid) | sql | true | search_path="" | authenticated | 20260929060000_chat_extras_explore.sql |

## private.my_chat_settings()

[src: supabase/migrations/20260929060000_chat_extras_explore.sql#my_chat_settings]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.my_chat_settings() | sql | true | search_path="" | authenticated | 20260929060000_chat_extras_explore.sql |

## private.pin_message(p_message uuid, p_pin boolean)

[src: supabase/migrations/20260929060000_chat_extras_explore.sql#pin_message]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.pin_message(p_message uuid, p_pin boolean) | plpgsql | true | search_path="" | authenticated | 20260929060000_chat_extras_explore.sql |

## private.prefix_tsquery(p_q text)

[src: supabase/migrations/20260929060000_chat_extras_explore.sql#prefix_tsquery]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.prefix_tsquery(p_q text) | sql | false | search_path="" | authenticated | 20260929060000_chat_extras_explore.sql |

## private.reaction_summary(p_messages uuid[])

[src: supabase/migrations/20260929060000_chat_extras_explore.sql#reaction_summary]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.reaction_summary(p_messages uuid[]) | sql | true | search_path="" | authenticated | 20260929060000_chat_extras_explore.sql |

## private.search_chats(p_q text, p_thread uuid)

[src: supabase/migrations/20260929060000_chat_extras_explore.sql#search_chats]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.search_chats(p_q text, p_thread uuid) | plpgsql | true | search_path="" | authenticated | 20260929060000_chat_extras_explore.sql |

## private.search_ventures(p_q text, p_type venture_type, p_skill text, p_university text, p_offset integer)

[src: supabase/migrations/20260929060000_chat_extras_explore.sql#search_ventures]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.search_ventures(p_q text, p_type venture_type, p_skill text, p_university text, p_offset integer) | plpgsql | true | search_path="" | authenticated | 20260929060000_chat_extras_explore.sql |

## private.send_message(p_thread uuid, p_body text, p_media jsonb, p_reply_to uuid)

[src: supabase/migrations/20260929060000_chat_extras_explore.sql#send_message]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.send_message(p_thread uuid, p_body text, p_media jsonb, p_reply_to uuid) | plpgsql | true | search_path="" | authenticated | 20260929060000_chat_extras_explore.sql |

## private.set_read_receipts(p_on boolean)

[src: supabase/migrations/20260929060000_chat_extras_explore.sql#set_read_receipts]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.set_read_receipts(p_on boolean) | plpgsql | true | search_path="" | authenticated | 20260929060000_chat_extras_explore.sql |

## private.thread_messages(p_thread uuid, p_before timestamp with time zone, p_limit integer)

[src: supabase/migrations/20260929060000_chat_extras_explore.sql#thread_messages]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.thread_messages(p_thread uuid, p_before timestamp with time zone, p_limit integer) | sql | true | search_path="" | authenticated | 20260929060000_chat_extras_explore.sql |

## private.thread_pins(p_thread uuid)

[src: supabase/migrations/20260929060000_chat_extras_explore.sql#thread_pins]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.thread_pins(p_thread uuid) | sql | true | search_path="" | authenticated | 20260929060000_chat_extras_explore.sql |

## private.thread_topic_member(p_topic text)

[src: supabase/migrations/20260929060000_chat_extras_explore.sql#thread_topic_member]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.thread_topic_member(p_topic text) | sql | true | search_path="" | authenticated | 20260929060000_chat_extras_explore.sql |

## public.dm_receipt(p_thread uuid)

[src: supabase/migrations/20260929060000_chat_extras_explore.sql#dm_receipt]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.dm_receipt(p_thread uuid) | sql | false | search_path="" | authenticated, service_role | 20260929060000_chat_extras_explore.sql |

## public.my_chat_settings()

[src: supabase/migrations/20260929060000_chat_extras_explore.sql#my_chat_settings]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.my_chat_settings() | sql | false | search_path="" | authenticated, service_role | 20260929060000_chat_extras_explore.sql |

## public.pin_message(p_message uuid, p_pin boolean)

[src: supabase/migrations/20260929060000_chat_extras_explore.sql#pin_message]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.pin_message(p_message uuid, p_pin boolean) | sql | false | search_path="" | authenticated, service_role | 20260929060000_chat_extras_explore.sql |

## public.reaction_summary(p_messages uuid[])

[src: supabase/migrations/20260929060000_chat_extras_explore.sql#reaction_summary]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.reaction_summary(p_messages uuid[]) | sql | false | search_path="" | authenticated, service_role | 20260929060000_chat_extras_explore.sql |

## public.search_chats(p_q text, p_thread uuid)

[src: supabase/migrations/20260929060000_chat_extras_explore.sql#search_chats]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.search_chats(p_q text, p_thread uuid) | sql | false | search_path="" | authenticated, service_role | 20260929060000_chat_extras_explore.sql |

## public.search_ventures(p_q text, p_type venture_type, p_skill text, p_university text, p_offset integer)

[src: supabase/migrations/20260929060000_chat_extras_explore.sql#search_ventures]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.search_ventures(p_q text, p_type venture_type, p_skill text, p_university text, p_offset integer) | sql | false | search_path="" | authenticated, service_role | 20260929060000_chat_extras_explore.sql |

## public.send_message(p_thread uuid, p_body text, p_media jsonb, p_reply_to uuid)

[src: supabase/migrations/20260929060000_chat_extras_explore.sql#send_message]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.send_message(p_thread uuid, p_body text, p_media jsonb, p_reply_to uuid) | sql | false | search_path="" | authenticated, service_role | 20260929060000_chat_extras_explore.sql |

## public.set_read_receipts(p_on boolean)

[src: supabase/migrations/20260929060000_chat_extras_explore.sql#set_read_receipts]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.set_read_receipts(p_on boolean) | sql | false | search_path="" | authenticated, service_role | 20260929060000_chat_extras_explore.sql |

## public.thread_messages(p_thread uuid, p_before timestamp with time zone, p_limit integer)

[src: supabase/migrations/20260929060000_chat_extras_explore.sql#thread_messages]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.thread_messages(p_thread uuid, p_before timestamp with time zone, p_limit integer) | sql | false | search_path="" | authenticated, service_role | 20260929060000_chat_extras_explore.sql |

## public.thread_pins(p_thread uuid)

[src: supabase/migrations/20260929060000_chat_extras_explore.sql#thread_pins]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.thread_pins(p_thread uuid) | sql | false | search_path="" | authenticated, service_role | 20260929060000_chat_extras_explore.sql |

## public.toggle_reaction(p_message uuid, p_emoji text)

[src: supabase/migrations/20260929060000_chat_extras_explore.sql#toggle_reaction]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.toggle_reaction(p_message uuid, p_emoji text) | sql | false | search_path="" | authenticated, service_role | 20260929060000_chat_extras_explore.sql |

## public.chat_pins

[src: supabase/migrations/20260929060000_chat_extras_explore.sql#chat_pins]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| message_id | uuid | true | — |  |  | — |
| thread_id | uuid | true | — |  |  | — |
| pinned_by | uuid | true | — |  |  | — |
| pinned_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
chat_pins_message_id_fkey: FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE; -- validated: true
```

```sql
chat_pins_pinned_by_fkey: FOREIGN KEY (pinned_by) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

```sql
chat_pins_pkey: PRIMARY KEY (message_id); -- validated: true
```

```sql
chat_pins_thread_id_fkey: FOREIGN KEY (thread_id) REFERENCES chat_threads(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE INDEX chat_pins_pinned_by_idx ON public.chat_pins USING btree (pinned_by); -- valid: true
```

```sql
CREATE UNIQUE INDEX chat_pins_pkey ON public.chat_pins USING btree (message_id); -- valid: true
```

```sql
CREATE INDEX chat_pins_thread_idx ON public.chat_pins USING btree (thread_id, pinned_at); -- valid: true
```

### Policies

#### chat_pins.chat_pins_member_read

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

```sql
CREATE TRIGGER refuse_if_restricted BEFORE INSERT ON chat_pins FOR EACH ROW EXECUTE FUNCTION private.refuse_if_restricted(); -- enabled: O
```

## public.message_reactions

[src: supabase/migrations/20260929060000_chat_extras_explore.sql#message_reactions]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| message_id | uuid | true | — |  |  | — |
| thread_id | uuid | true | — |  |  | — |
| user_id | uuid | true | — |  |  | — |
| emoji | text | true | — |  |  | "default" |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
message_reactions_emoji_check: CHECK (emoji = ANY (ARRAY['👍'::text, '❤️'::text, '😂'::text, '🎉'::text, '😮'::text, '🙏'::text])); -- validated: true
```

```sql
message_reactions_message_id_fkey: FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE; -- validated: true
```

```sql
message_reactions_pkey: PRIMARY KEY (message_id, user_id); -- validated: true
```

```sql
message_reactions_thread_id_fkey: FOREIGN KEY (thread_id) REFERENCES chat_threads(id) ON DELETE CASCADE; -- validated: true
```

```sql
message_reactions_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX message_reactions_pkey ON public.message_reactions USING btree (message_id, user_id); -- valid: true
```

```sql
CREATE INDEX message_reactions_thread_idx ON public.message_reactions USING btree (thread_id); -- valid: true
```

```sql
CREATE INDEX message_reactions_user_idx ON public.message_reactions USING btree (user_id); -- valid: true
```

### Policies

#### message_reactions.message_reactions_member_read

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
CREATE TRIGGER refuse_if_restricted BEFORE INSERT ON message_reactions FOR EACH ROW EXECUTE FUNCTION private.refuse_if_restricted(); -- enabled: O
```
