Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# friends_blocks

## private.are_friends(p_a uuid, p_b uuid)

[src: supabase/migrations/20260928230000_friends_blocks.sql#are_friends]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.are_friends(p_a uuid, p_b uuid) | sql | true | search_path="" | None | 20260928230000_friends_blocks.sql |

## private.block_user(p_username text)

[src: supabase/migrations/20260928230000_friends_blocks.sql#block_user]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.block_user(p_username text) | plpgsql | true | search_path="" | authenticated | 20260928230000_friends_blocks.sql |

## private.can_view_profile(p_user uuid)

[src: supabase/migrations/20260928230000_friends_blocks.sql#can_view_profile]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.can_view_profile(p_user uuid) | sql | true | search_path="" | authenticated | 20260928230000_friends_blocks.sql |

## private.cancel_friend_request(p_request uuid)

[src: supabase/migrations/20260928230000_friends_blocks.sql#cancel_friend_request]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.cancel_friend_request(p_request uuid) | plpgsql | true | search_path="" | authenticated | 20260928230000_friends_blocks.sql |

## private.clear_pair(p_a uuid, p_b uuid)

[src: supabase/migrations/20260928230000_friends_blocks.sql#clear_pair]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.clear_pair(p_a uuid, p_b uuid) | plpgsql | true | search_path="" | None | 20260928230000_friends_blocks.sql |

## private.friendship_state(p_username text)

[src: supabase/migrations/20260928230000_friends_blocks.sql#friendship_state]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.friendship_state(p_username text) | sql | true | search_path="" | authenticated | 20260928230000_friends_blocks.sql |

## private.is_blocked(p_a uuid, p_b uuid)

[src: supabase/migrations/20260928230000_friends_blocks.sql#is_blocked]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.is_blocked(p_a uuid, p_b uuid) | sql | true | search_path="" | None | 20260928230000_friends_blocks.sql |

## private.is_blocked_with(p_other uuid)

[src: supabase/migrations/20260928230000_friends_blocks.sql#is_blocked_with]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.is_blocked_with(p_other uuid) | sql | true | search_path="" | authenticated, service_role | 20260928230000_friends_blocks.sql |

## private.is_friend_of(p_other uuid)

[src: supabase/migrations/20260928230000_friends_blocks.sql#is_friend_of]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.is_friend_of(p_other uuid) | sql | true | search_path="" | authenticated, service_role | 20260928230000_friends_blocks.sql |

## private.my_blocks()

[src: supabase/migrations/20260928230000_friends_blocks.sql#my_blocks]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.my_blocks() | sql | true | search_path="" | authenticated | 20260928230000_friends_blocks.sql |

## private.my_friend_requests()

[src: supabase/migrations/20260928230000_friends_blocks.sql#my_friend_requests]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.my_friend_requests() | sql | true | search_path="" | authenticated | 20260928230000_friends_blocks.sql |

## private.my_friends()

[src: supabase/migrations/20260928230000_friends_blocks.sql#my_friends]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.my_friends() | sql | true | search_path="" | authenticated | 20260928230000_friends_blocks.sql |

## private.ops_audit_log_append_only()

[src: supabase/migrations/20260928230000_friends_blocks.sql#ops_audit_log_append_only]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_audit_log_append_only() | plpgsql | false | search_path="" | None | 20260928230000_friends_blocks.sql |

## private.pending_friend_request_count()

[src: supabase/migrations/20260928230000_friends_blocks.sql#pending_friend_request_count]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.pending_friend_request_count() | sql | true | search_path="" | authenticated | 20260928230000_friends_blocks.sql |

## private.respond_friend_request(p_request uuid, p_accept boolean)

[src: supabase/migrations/20260928230000_friends_blocks.sql#respond_friend_request]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.respond_friend_request(p_request uuid, p_accept boolean) | plpgsql | true | search_path="" | authenticated | 20260928230000_friends_blocks.sql |

## private.send_friend_request(p_username text)

[src: supabase/migrations/20260928230000_friends_blocks.sql#send_friend_request]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.send_friend_request(p_username text) | plpgsql | true | search_path="" | authenticated | 20260928230000_friends_blocks.sql |

## private.unblock_user(p_username text)

[src: supabase/migrations/20260928230000_friends_blocks.sql#unblock_user]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.unblock_user(p_username text) | plpgsql | true | search_path="" | authenticated | 20260928230000_friends_blocks.sql |

## private.unfriend(p_username text)

[src: supabase/migrations/20260928230000_friends_blocks.sql#unfriend]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.unfriend(p_username text) | plpgsql | true | search_path="" | authenticated | 20260928230000_friends_blocks.sql |

## private.user_id_for(p_username text)

[src: supabase/migrations/20260928230000_friends_blocks.sql#user_id_for]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.user_id_for(p_username text) | sql | true | search_path="" | None | 20260928230000_friends_blocks.sql |

## public.block_user(p_username text)

[src: supabase/migrations/20260928230000_friends_blocks.sql#block_user]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.block_user(p_username text) | sql | false | search_path="" | authenticated, service_role | 20260928230000_friends_blocks.sql |

## public.cancel_friend_request(p_request uuid)

[src: supabase/migrations/20260928230000_friends_blocks.sql#cancel_friend_request]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.cancel_friend_request(p_request uuid) | sql | false | search_path="" | authenticated, service_role | 20260928230000_friends_blocks.sql |

## public.friendship_state(p_username text)

[src: supabase/migrations/20260928230000_friends_blocks.sql#friendship_state]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.friendship_state(p_username text) | sql | false | search_path="" | authenticated, service_role | 20260928230000_friends_blocks.sql |

## public.my_blocks()

[src: supabase/migrations/20260928230000_friends_blocks.sql#my_blocks]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.my_blocks() | sql | false | search_path="" | authenticated, service_role | 20260928230000_friends_blocks.sql |

## public.my_friend_requests()

[src: supabase/migrations/20260928230000_friends_blocks.sql#my_friend_requests]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.my_friend_requests() | sql | false | search_path="" | authenticated, service_role | 20260928230000_friends_blocks.sql |

## public.my_friends()

[src: supabase/migrations/20260928230000_friends_blocks.sql#my_friends]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.my_friends() | sql | false | search_path="" | authenticated, service_role | 20260928230000_friends_blocks.sql |

## public.pending_friend_request_count()

[src: supabase/migrations/20260928230000_friends_blocks.sql#pending_friend_request_count]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.pending_friend_request_count() | sql | false | search_path="" | authenticated, service_role | 20260928230000_friends_blocks.sql |

## public.respond_friend_request(p_request uuid, p_accept boolean)

[src: supabase/migrations/20260928230000_friends_blocks.sql#respond_friend_request]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.respond_friend_request(p_request uuid, p_accept boolean) | sql | false | search_path="" | authenticated, service_role | 20260928230000_friends_blocks.sql |

## public.send_friend_request(p_username text)

[src: supabase/migrations/20260928230000_friends_blocks.sql#send_friend_request]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.send_friend_request(p_username text) | sql | false | search_path="" | authenticated, service_role | 20260928230000_friends_blocks.sql |

## public.unblock_user(p_username text)

[src: supabase/migrations/20260928230000_friends_blocks.sql#unblock_user]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.unblock_user(p_username text) | sql | false | search_path="" | authenticated, service_role | 20260928230000_friends_blocks.sql |

## public.unfriend(p_username text)

[src: supabase/migrations/20260928230000_friends_blocks.sql#unfriend]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.unfriend(p_username text) | sql | false | search_path="" | authenticated, service_role | 20260928230000_friends_blocks.sql |

## public.blocks

[src: supabase/migrations/20260928230000_friends_blocks.sql#blocks]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| blocker_id | uuid | true | — |  |  | — |
| blocked_id | uuid | true | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
blocks_blocked_id_fkey: FOREIGN KEY (blocked_id) REFERENCES profiles(user_id) ON DELETE CASCADE; -- validated: true
```

```sql
blocks_blocker_id_fkey: FOREIGN KEY (blocker_id) REFERENCES profiles(user_id) ON DELETE CASCADE; -- validated: true
```

```sql
blocks_not_self: CHECK (blocker_id <> blocked_id); -- validated: true
```

```sql
blocks_pkey: PRIMARY KEY (blocker_id, blocked_id); -- validated: true
```

### Indexes

```sql
CREATE INDEX blocks_blocked_idx ON public.blocks USING btree (blocked_id, blocker_id); -- valid: true
```

```sql
CREATE UNIQUE INDEX blocks_pkey ON public.blocks USING btree (blocker_id, blocked_id); -- valid: true
```

### Policies

#### blocks.blocks_read

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "(blocker_id = ( SELECT auth.uid() AS uid))",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

### Triggers

None.

## public.friend_requests

[src: supabase/migrations/20260928230000_friends_blocks.sql#friend_requests]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| sender_id | uuid | true | — |  |  | — |
| receiver_id | uuid | true | — |  |  | — |
| status | friend_request_status | true | 'pending'::friend_request_status |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |
| responded_at | timestamp with time zone | false | — |  |  | — |

### Keys and constraints

```sql
friend_requests_not_self: CHECK (sender_id <> receiver_id); -- validated: true
```

```sql
friend_requests_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
friend_requests_receiver_id_fkey: FOREIGN KEY (receiver_id) REFERENCES profiles(user_id) ON DELETE CASCADE; -- validated: true
```

```sql
friend_requests_responded: CHECK ((status = 'pending'::friend_request_status) = (responded_at IS NULL)); -- validated: true
```

```sql
friend_requests_sender_id_fkey: FOREIGN KEY (sender_id) REFERENCES profiles(user_id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX friend_requests_live_pair_idx ON public.friend_requests USING btree (LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id)) WHERE (status = ANY (ARRAY['pending'::friend_request_status, 'accepted'::friend_request_status])); -- valid: true
```

```sql
CREATE UNIQUE INDEX friend_requests_pkey ON public.friend_requests USING btree (id); -- valid: true
```

```sql
CREATE INDEX friend_requests_receiver_pending_idx ON public.friend_requests USING btree (receiver_id, created_at DESC) WHERE (status = 'pending'::friend_request_status); -- valid: true
```

```sql
CREATE INDEX friend_requests_receiver_sender_idx ON public.friend_requests USING btree (receiver_id, sender_id); -- valid: true
```

```sql
CREATE INDEX friend_requests_sender_pending_idx ON public.friend_requests USING btree (sender_id, created_at DESC) WHERE (status = 'pending'::friend_request_status); -- valid: true
```

```sql
CREATE INDEX friend_requests_sender_receiver_idx ON public.friend_requests USING btree (sender_id, receiver_id); -- valid: true
```

### Policies

#### friend_requests.friend_requests_read

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "((sender_id = ( SELECT auth.uid() AS uid)) OR (receiver_id = ( SELECT auth.uid() AS uid)))",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

### Triggers

```sql
CREATE TRIGGER friend_requests_notify AFTER INSERT OR DELETE OR UPDATE OF status ON friend_requests FOR EACH ROW EXECUTE FUNCTION private.notify_friend_requests(); -- enabled: O
```

```sql
CREATE TRIGGER refuse_if_restricted BEFORE INSERT ON friend_requests FOR EACH ROW EXECUTE FUNCTION private.refuse_if_restricted(); -- enabled: O
```

## public.friendships

[src: supabase/migrations/20260928230000_friends_blocks.sql#friendships]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| user_id_a | uuid | true | — |  |  | — |
| user_id_b | uuid | true | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
friendships_ordered: CHECK (user_id_a < user_id_b); -- validated: true
```

```sql
friendships_pkey: PRIMARY KEY (user_id_a, user_id_b); -- validated: true
```

```sql
friendships_user_id_a_fkey: FOREIGN KEY (user_id_a) REFERENCES profiles(user_id) ON DELETE CASCADE; -- validated: true
```

```sql
friendships_user_id_b_fkey: FOREIGN KEY (user_id_b) REFERENCES profiles(user_id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE INDEX friendships_b_idx ON public.friendships USING btree (user_id_b, user_id_a); -- valid: true
```

```sql
CREATE UNIQUE INDEX friendships_pkey ON public.friendships USING btree (user_id_a, user_id_b); -- valid: true
```

### Policies

#### friendships.friendships_read

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "((user_id_a = ( SELECT auth.uid() AS uid)) OR (user_id_b = ( SELECT auth.uid() AS uid)))",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

### Triggers

None.

## public.ops_audit_log

[src: supabase/migrations/20260928230000_friends_blocks.sql#ops_audit_log]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| staff_id | uuid | true | — |  |  | — |
| action | text | true | — |  |  | "default" |
| target_type | text | true | — |  |  | "default" |
| target_id | text | true | — |  |  | "default" |
| reason | text | true | — |  |  | "default" |
| before | jsonb | false | — |  |  | — |
| after | jsonb | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
ops_audit_log_action_check: CHECK (char_length(action) >= 1 AND char_length(action) <= 80); -- validated: true
```

```sql
ops_audit_log_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
ops_audit_log_reason_check: CHECK (char_length(btrim(reason)) >= 3 AND char_length(btrim(reason)) <= 2000); -- validated: true
```

```sql
ops_audit_log_staff_id_fkey: FOREIGN KEY (staff_id) REFERENCES auth.users(id) ON DELETE RESTRICT; -- validated: true
```

```sql
ops_audit_log_target_id_check: CHECK (char_length(target_id) >= 1 AND char_length(target_id) <= 200); -- validated: true
```

```sql
ops_audit_log_target_type_check: CHECK (char_length(target_type) >= 1 AND char_length(target_type) <= 40); -- validated: true
```

### Indexes

```sql
CREATE INDEX ops_audit_log_created_idx ON public.ops_audit_log USING btree (created_at DESC); -- valid: true
```

```sql
CREATE UNIQUE INDEX ops_audit_log_pkey ON public.ops_audit_log USING btree (id); -- valid: true
```

```sql
CREATE INDEX ops_audit_log_staff_idx ON public.ops_audit_log USING btree (staff_id, created_at DESC); -- valid: true
```

```sql
CREATE INDEX ops_audit_log_target_idx ON public.ops_audit_log USING btree (target_type, target_id, created_at DESC); -- valid: true
```

### Policies

#### ops_audit_log.ops_audit_log_read

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
CREATE TRIGGER ops_audit_log_no_truncate BEFORE TRUNCATE ON ops_audit_log FOR EACH STATEMENT EXECUTE FUNCTION private.ops_audit_log_append_only(); -- enabled: O
```

```sql
CREATE TRIGGER ops_audit_log_no_update BEFORE DELETE OR UPDATE ON ops_audit_log FOR EACH ROW EXECUTE FUNCTION private.ops_audit_log_append_only(); -- enabled: O
```
