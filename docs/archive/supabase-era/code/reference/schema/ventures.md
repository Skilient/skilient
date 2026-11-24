Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# ventures

## private.add_application_message(p_thread uuid, p_body text)

[src: supabase/migrations/20260928190000_ventures.sql#add_application_message]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.add_application_message(p_thread uuid, p_body text) | plpgsql | true | search_path="" | authenticated | 20260928190000_ventures.sql |

## private.add_venture_deliverable(p_venture uuid, p_label text, p_url text)

[src: supabase/migrations/20260928190000_ventures.sql#add_venture_deliverable]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.add_venture_deliverable(p_venture uuid, p_label text, p_url text) | plpgsql | true | search_path="" | authenticated | 20260928190000_ventures.sql |

## private.add_venture_member(p_venture uuid, p_user uuid, p_role uuid)

[src: supabase/migrations/20260928190000_ventures.sql#add_venture_member]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.add_venture_member(p_venture uuid, p_user uuid, p_role uuid) | plpgsql | true | search_path="" | authenticated | 20260928190000_ventures.sql |

## private.apply_to_venture(p_venture uuid, p_role uuid, p_message text, p_answers text[])

[src: supabase/migrations/20260928190000_ventures.sql#apply_to_venture]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.apply_to_venture(p_venture uuid, p_role uuid, p_message text, p_answers text[]) | plpgsql | true | search_path="" | authenticated | 20260928190000_ventures.sql |

## private.create_venture(p jsonb)

[src: supabase/migrations/20260928190000_ventures.sql#create_venture]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.create_venture(p jsonb) | plpgsql | true | search_path="" | authenticated | 20260928190000_ventures.sql |

## private.decide_application(p_thread uuid, p_accept boolean)

[src: supabase/migrations/20260928190000_ventures.sql#decide_application]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.decide_application(p_thread uuid, p_accept boolean) | plpgsql | true | search_path="" | authenticated | 20260928190000_ventures.sql |

## private.delete_venture_role(p_venture uuid, p_role uuid)

[src: supabase/migrations/20260928190000_ventures.sql#delete_venture_role]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.delete_venture_role(p_venture uuid, p_role uuid) | plpgsql | true | search_path="" | authenticated | 20260928190000_ventures.sql |

## private.delete_venture_update(p_update uuid)

[src: supabase/migrations/20260928190000_ventures.sql#delete_venture_update]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.delete_venture_update(p_update uuid) | sql | true | search_path="" | authenticated | 20260928190000_ventures.sql |

## private.follow_venture(p_venture uuid, p_follow boolean)

[src: supabase/migrations/20260928190000_ventures.sql#follow_venture]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.follow_venture(p_venture uuid, p_follow boolean) | plpgsql | true | search_path="" | authenticated | 20260928190000_ventures.sql |

## private.has_venture_invite(p_venture uuid)

[src: supabase/migrations/20260928190000_ventures.sql#has_venture_invite]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.has_venture_invite(p_venture uuid) | sql | true | search_path="" | authenticated | 20260928190000_ventures.sql |

## private.invite_to_venture(p_venture uuid, p_username text)

[src: supabase/migrations/20260928190000_ventures.sql#invite_to_venture]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.invite_to_venture(p_venture uuid, p_username text) | plpgsql | true | search_path="" | authenticated | 20260928190000_ventures.sql |

## private.is_venture_member(p_venture uuid)

[src: supabase/migrations/20260928190000_ventures.sql#is_venture_member]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.is_venture_member(p_venture uuid) | sql | true | search_path="" | authenticated | 20260928190000_ventures.sql |

## private.leave_venture(p_venture uuid)

[src: supabase/migrations/20260928190000_ventures.sql#leave_venture]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.leave_venture(p_venture uuid) | plpgsql | true | search_path="" | authenticated | 20260928190000_ventures.sql |

## private.link_venture_repo(p_venture uuid, p_repo bigint)

[src: supabase/migrations/20260928190000_ventures.sql#link_venture_repo]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.link_venture_repo(p_venture uuid, p_repo bigint) | plpgsql | true | search_path="" | authenticated | 20260928190000_ventures.sql |

## private.lock_owned_venture(p_venture uuid)

[src: supabase/migrations/20260928190000_ventures.sql#lock_owned_venture]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.lock_owned_venture(p_venture uuid) | plpgsql | true | search_path="" | authenticated | 20260928190000_ventures.sql |

## private.post_venture_update(p_venture uuid, p_body text)

[src: supabase/migrations/20260928190000_ventures.sql#post_venture_update]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.post_venture_update(p_venture uuid, p_body text) | plpgsql | true | search_path="" | authenticated | 20260928190000_ventures.sql |

## private.remove_venture_deliverable(p_deliverable uuid)

[src: supabase/migrations/20260928190000_ventures.sql#remove_venture_deliverable]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.remove_venture_deliverable(p_deliverable uuid) | plpgsql | true | search_path="" | authenticated | 20260928190000_ventures.sql |

## private.remove_venture_member(p_venture uuid, p_member uuid)

[src: supabase/migrations/20260928190000_ventures.sql#remove_venture_member]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.remove_venture_member(p_venture uuid, p_member uuid) | plpgsql | true | search_path="" | authenticated | 20260928190000_ventures.sql |

## private.require_open(v ventures)

[src: supabase/migrations/20260928190000_ventures.sql#require_open]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.require_open(v ventures) | plpgsql | false | search_path="" | authenticated | 20260928190000_ventures.sql |

## private.require_user()

[src: supabase/migrations/20260928190000_ventures.sql#require_user]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.require_user() | plpgsql | true | search_path="" | authenticated | 20260928190000_ventures.sql |

## private.respond_invite(p_invite uuid, p_accept boolean)

[src: supabase/migrations/20260928190000_ventures.sql#respond_invite]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.respond_invite(p_invite uuid, p_accept boolean) | plpgsql | true | search_path="" | authenticated | 20260928190000_ventures.sql |

## private.revoke_invite(p_invite uuid)

[src: supabase/migrations/20260928190000_ventures.sql#revoke_invite]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.revoke_invite(p_invite uuid) | plpgsql | true | search_path="" | authenticated | 20260928190000_ventures.sql |

## private.save_venture_role(p_venture uuid, p_role uuid, p_title text, p_skill_ids text[], p_slots smallint)

[src: supabase/migrations/20260928190000_ventures.sql#save_venture_role]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.save_venture_role(p_venture uuid, p_role uuid, p_title text, p_skill_ids text[], p_slots smallint) | plpgsql | true | search_path="" | authenticated | 20260928190000_ventures.sql |

## private.set_member_role(p_venture uuid, p_member uuid, p_role venture_team_role)

[src: supabase/migrations/20260928190000_ventures.sql#set_member_role]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.set_member_role(p_venture uuid, p_member uuid, p_role venture_team_role) | plpgsql | true | search_path="" | authenticated | 20260928190000_ventures.sql |

## private.set_venture_questions(p_venture uuid, p_questions text[])

[src: supabase/migrations/20260928190000_ventures.sql#set_venture_questions]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.set_venture_questions(p_venture uuid, p_questions text[]) | plpgsql | true | search_path="" | authenticated | 20260928190000_ventures.sql |

## private.transfer_venture_ownership(p_venture uuid, p_member uuid)

[src: supabase/migrations/20260928190000_ventures.sql#transfer_venture_ownership]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.transfer_venture_ownership(p_venture uuid, p_member uuid) | plpgsql | true | search_path="" | authenticated | 20260928190000_ventures.sql |

## private.update_venture(p_venture uuid, p jsonb)

[src: supabase/migrations/20260928190000_ventures.sql#update_venture]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.update_venture(p_venture uuid, p jsonb) | plpgsql | true | search_path="" | authenticated | 20260928190000_ventures.sql |

## private.valid_skill_ids(p_ids text[])

[src: supabase/migrations/20260928190000_ventures.sql#valid_skill_ids]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.valid_skill_ids(p_ids text[]) | plpgsql | true | search_path="" | authenticated | 20260928190000_ventures.sql |

## private.venture_by_link(p_venture uuid)

[src: supabase/migrations/20260928190000_ventures.sql#venture_by_link]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.venture_by_link(p_venture uuid) | sql | true | search_path="" | authenticated | 20260928190000_ventures.sql |

## private.venture_counts(p_venture uuid)

[src: supabase/migrations/20260928190000_ventures.sql#venture_counts]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.venture_counts(p_venture uuid) | sql | true | search_path="" | authenticated | 20260928190000_ventures.sql |

## private.venture_max_members()

[src: supabase/migrations/20260928190000_ventures.sql#venture_max_members]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.venture_max_members() | sql | false | search_path="" | authenticated | 20260928190000_ventures.sql |

## private.venture_members_guard()

[src: supabase/migrations/20260928190000_ventures.sql#venture_members_guard]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.venture_members_guard() | plpgsql | true | search_path="" | None | 20260928190000_ventures.sql |

## private.withdraw_application(p_thread uuid)

[src: supabase/migrations/20260928190000_ventures.sql#withdraw_application]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.withdraw_application(p_thread uuid) | sql | true | search_path="" | authenticated | 20260928190000_ventures.sql |

## public.add_application_message(p_thread uuid, p_body text)

[src: supabase/migrations/20260928190000_ventures.sql#add_application_message]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.add_application_message(p_thread uuid, p_body text) | sql | false | search_path="" | authenticated, service_role | 20260928190000_ventures.sql |

## public.add_venture_deliverable(p_venture uuid, p_label text, p_url text)

[src: supabase/migrations/20260928190000_ventures.sql#add_venture_deliverable]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.add_venture_deliverable(p_venture uuid, p_label text, p_url text) | sql | false | search_path="" | authenticated, service_role | 20260928190000_ventures.sql |

## public.apply_to_venture(p_venture uuid, p_message text, p_answers text[], p_role uuid)

[src: supabase/migrations/20260928190000_ventures.sql#apply_to_venture]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.apply_to_venture(p_venture uuid, p_message text, p_answers text[], p_role uuid) | sql | false | search_path="" | authenticated, service_role | 20260928190000_ventures.sql |

## public.create_venture(p jsonb)

[src: supabase/migrations/20260928190000_ventures.sql#create_venture]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.create_venture(p jsonb) | sql | false | search_path="" | authenticated, service_role | 20260928190000_ventures.sql |

## public.decide_application(p_thread uuid, p_accept boolean)

[src: supabase/migrations/20260928190000_ventures.sql#decide_application]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.decide_application(p_thread uuid, p_accept boolean) | sql | false | search_path="" | authenticated, service_role | 20260928190000_ventures.sql |

## public.delete_venture_role(p_venture uuid, p_role uuid)

[src: supabase/migrations/20260928190000_ventures.sql#delete_venture_role]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.delete_venture_role(p_venture uuid, p_role uuid) | sql | false | search_path="" | authenticated, service_role | 20260928190000_ventures.sql |

## public.delete_venture_update(p_update uuid)

[src: supabase/migrations/20260928190000_ventures.sql#delete_venture_update]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.delete_venture_update(p_update uuid) | sql | false | search_path="" | authenticated, service_role | 20260928190000_ventures.sql |

## public.follow_venture(p_venture uuid, p_follow boolean)

[src: supabase/migrations/20260928190000_ventures.sql#follow_venture]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.follow_venture(p_venture uuid, p_follow boolean) | sql | false | search_path="" | authenticated, service_role | 20260928190000_ventures.sql |

## public.invite_to_venture(p_venture uuid, p_username text)

[src: supabase/migrations/20260928190000_ventures.sql#invite_to_venture]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.invite_to_venture(p_venture uuid, p_username text) | sql | false | search_path="" | authenticated, service_role | 20260928190000_ventures.sql |

## public.leave_venture(p_venture uuid)

[src: supabase/migrations/20260928190000_ventures.sql#leave_venture]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.leave_venture(p_venture uuid) | sql | false | search_path="" | authenticated, service_role | 20260928190000_ventures.sql |

## public.link_venture_repo(p_venture uuid, p_repo bigint)

[src: supabase/migrations/20260928190000_ventures.sql#link_venture_repo]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.link_venture_repo(p_venture uuid, p_repo bigint) | sql | false | search_path="" | authenticated, service_role | 20260928190000_ventures.sql |

## public.post_venture_update(p_venture uuid, p_body text)

[src: supabase/migrations/20260928190000_ventures.sql#post_venture_update]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.post_venture_update(p_venture uuid, p_body text) | sql | false | search_path="" | authenticated, service_role | 20260928190000_ventures.sql |

## public.remove_venture_deliverable(p_deliverable uuid)

[src: supabase/migrations/20260928190000_ventures.sql#remove_venture_deliverable]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.remove_venture_deliverable(p_deliverable uuid) | sql | false | search_path="" | authenticated, service_role | 20260928190000_ventures.sql |

## public.remove_venture_member(p_venture uuid, p_member uuid)

[src: supabase/migrations/20260928190000_ventures.sql#remove_venture_member]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.remove_venture_member(p_venture uuid, p_member uuid) | sql | false | search_path="" | authenticated, service_role | 20260928190000_ventures.sql |

## public.respond_invite(p_invite uuid, p_accept boolean)

[src: supabase/migrations/20260928190000_ventures.sql#respond_invite]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.respond_invite(p_invite uuid, p_accept boolean) | sql | false | search_path="" | authenticated, service_role | 20260928190000_ventures.sql |

## public.revoke_invite(p_invite uuid)

[src: supabase/migrations/20260928190000_ventures.sql#revoke_invite]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.revoke_invite(p_invite uuid) | sql | false | search_path="" | authenticated, service_role | 20260928190000_ventures.sql |

## public.save_venture_role(p_venture uuid, p_title text, p_skill_ids text[], p_slots smallint, p_role uuid)

[src: supabase/migrations/20260928190000_ventures.sql#save_venture_role]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.save_venture_role(p_venture uuid, p_title text, p_skill_ids text[], p_slots smallint, p_role uuid) | sql | false | search_path="" | authenticated, service_role | 20260928190000_ventures.sql |

## public.set_member_role(p_venture uuid, p_member uuid, p_role venture_team_role)

[src: supabase/migrations/20260928190000_ventures.sql#set_member_role]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.set_member_role(p_venture uuid, p_member uuid, p_role venture_team_role) | sql | false | search_path="" | authenticated, service_role | 20260928190000_ventures.sql |

## public.set_venture_questions(p_venture uuid, p_questions text[])

[src: supabase/migrations/20260928190000_ventures.sql#set_venture_questions]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.set_venture_questions(p_venture uuid, p_questions text[]) | sql | false | search_path="" | authenticated, service_role | 20260928190000_ventures.sql |

## public.transfer_venture_ownership(p_venture uuid, p_member uuid)

[src: supabase/migrations/20260928190000_ventures.sql#transfer_venture_ownership]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.transfer_venture_ownership(p_venture uuid, p_member uuid) | sql | false | search_path="" | authenticated, service_role | 20260928190000_ventures.sql |

## public.transition_venture(p_venture uuid, p_to venture_status)

[src: supabase/migrations/20260928190000_ventures.sql#transition_venture]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.transition_venture(p_venture uuid, p_to venture_status) | sql | false | search_path="" | authenticated, service_role | 20260928190000_ventures.sql |

## public.update_venture(p_venture uuid, p jsonb)

[src: supabase/migrations/20260928190000_ventures.sql#update_venture]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.update_venture(p_venture uuid, p jsonb) | sql | false | search_path="" | authenticated, service_role | 20260928190000_ventures.sql |

## public.venture_by_link(p_venture uuid)

[src: supabase/migrations/20260928190000_ventures.sql#venture_by_link]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.venture_by_link(p_venture uuid) | sql | false | search_path="" | authenticated, service_role | 20260928190000_ventures.sql |

## public.venture_counts(p_venture uuid)

[src: supabase/migrations/20260928190000_ventures.sql#venture_counts]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.venture_counts(p_venture uuid) | sql | false | search_path="" | authenticated, service_role | 20260928190000_ventures.sql |

## public.withdraw_application(p_thread uuid)

[src: supabase/migrations/20260928190000_ventures.sql#withdraw_application]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.withdraw_application(p_thread uuid) | sql | false | search_path="" | authenticated, service_role | 20260928190000_ventures.sql |

## public.application_messages

[src: supabase/migrations/20260928190000_ventures.sql#application_messages]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | bigint | true | — | a |  | — |
| thread_id | uuid | true | — |  |  | — |
| sender_id | uuid | true | — |  |  | — |
| body | text | true | — |  |  | "default" |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
application_messages_body_check: CHECK (char_length(btrim(body)) >= 1 AND char_length(btrim(body)) <= 1000); -- validated: true
```

```sql
application_messages_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
application_messages_sender_id_fkey: FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

```sql
application_messages_thread_id_fkey: FOREIGN KEY (thread_id) REFERENCES application_threads(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX application_messages_pkey ON public.application_messages USING btree (id); -- valid: true
```

```sql
CREATE INDEX application_messages_thread_idx ON public.application_messages USING btree (thread_id, created_at); -- valid: true
```

### Policies

#### application_messages.application_messages_read

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "(EXISTS ( SELECT 1\n   FROM application_threads t\n  WHERE ((t.id = application_messages.thread_id) AND ((t.candidate_id = ( SELECT auth.uid() AS uid)) OR (t.owner_id = ( SELECT auth.uid() AS uid))))))",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

### Triggers

```sql
CREATE TRIGGER refuse_if_restricted BEFORE INSERT ON application_messages FOR EACH ROW EXECUTE FUNCTION private.refuse_if_restricted(); -- enabled: O
```

## public.application_threads

[src: supabase/migrations/20260928190000_ventures.sql#application_threads]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| venture_id | uuid | true | — |  |  | — |
| role_id | uuid | false | — |  |  | — |
| candidate_id | uuid | true | — |  |  | — |
| owner_id | uuid | true | — |  |  | — |
| status | application_status | true | 'pending'::application_status |  |  | — |
| message | text | true | — |  |  | "default" |
| answers | jsonb | true | '[]'::jsonb |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |
| decided_at | timestamp with time zone | false | — |  |  | — |

### Keys and constraints

```sql
application_threads_answers_check: CHECK (jsonb_typeof(answers) = 'array'::text); -- validated: true
```

```sql
application_threads_candidate_id_fkey: FOREIGN KEY (candidate_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

```sql
application_threads_check: CHECK (candidate_id <> owner_id); -- validated: true
```

```sql
application_threads_message_check: CHECK (char_length(btrim(message)) >= 1 AND char_length(btrim(message)) <= 1000); -- validated: true
```

```sql
application_threads_owner_id_fkey: FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

```sql
application_threads_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
application_threads_role_id_fkey: FOREIGN KEY (role_id) REFERENCES venture_roles(id) ON DELETE SET NULL; -- validated: true
```

```sql
application_threads_venture_id_fkey: FOREIGN KEY (venture_id) REFERENCES ventures(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE INDEX application_threads_candidate_idx ON public.application_threads USING btree (candidate_id, created_at DESC); -- valid: true
```

```sql
CREATE UNIQUE INDEX application_threads_one_pending ON public.application_threads USING btree (candidate_id, venture_id) WHERE (status = 'pending'::application_status); -- valid: true
```

```sql
CREATE INDEX application_threads_owner_idx ON public.application_threads USING btree (owner_id, status, created_at DESC); -- valid: true
```

```sql
CREATE UNIQUE INDEX application_threads_pkey ON public.application_threads USING btree (id); -- valid: true
```

```sql
CREATE INDEX application_threads_venture_idx ON public.application_threads USING btree (venture_id, status); -- valid: true
```

### Policies

#### application_threads.application_threads_read

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "((candidate_id = ( SELECT auth.uid() AS uid)) OR (owner_id = ( SELECT auth.uid() AS uid)))",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

### Triggers

```sql
CREATE TRIGGER application_threads_graduate_guard BEFORE INSERT ON application_threads FOR EACH ROW EXECUTE FUNCTION private.graduate_venture_guard(); -- enabled: O
```

```sql
CREATE TRIGGER application_threads_notify AFTER INSERT OR UPDATE OF status ON application_threads FOR EACH ROW EXECUTE FUNCTION private.notify_applications(); -- enabled: O
```

```sql
CREATE TRIGGER refuse_if_restricted BEFORE INSERT ON application_threads FOR EACH ROW EXECUTE FUNCTION private.refuse_if_restricted(); -- enabled: O
```

## public.venture_deliverables

[src: supabase/migrations/20260928190000_ventures.sql#venture_deliverables]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| venture_id | uuid | true | — |  |  | — |
| label | text | true | — |  |  | "default" |
| url | text | true | — |  |  | "default" |
| added_by | uuid | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
venture_deliverables_added_by_fkey: FOREIGN KEY (added_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
venture_deliverables_label_check: CHECK (char_length(btrim(label)) >= 2 AND char_length(btrim(label)) <= 80); -- validated: true
```

```sql
venture_deliverables_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
venture_deliverables_url_check: CHECK (url ~ '^https://'::text AND char_length(url) <= 500); -- validated: true
```

```sql
venture_deliverables_venture_id_fkey: FOREIGN KEY (venture_id) REFERENCES ventures(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX venture_deliverables_pkey ON public.venture_deliverables USING btree (id); -- valid: true
```

```sql
CREATE INDEX venture_deliverables_venture_idx ON public.venture_deliverables USING btree (venture_id); -- valid: true
```

### Policies

#### venture_deliverables.venture_deliverables_read

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "(private.is_venture_member(venture_id) OR private.is_venture_teacher(venture_id))",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

### Triggers

None.

## public.venture_follows

[src: supabase/migrations/20260928190000_ventures.sql#venture_follows]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| venture_id | uuid | true | — |  |  | — |
| user_id | uuid | true | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
venture_follows_pkey: PRIMARY KEY (venture_id, user_id); -- validated: true
```

```sql
venture_follows_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

```sql
venture_follows_venture_id_fkey: FOREIGN KEY (venture_id) REFERENCES ventures(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX venture_follows_pkey ON public.venture_follows USING btree (venture_id, user_id); -- valid: true
```

```sql
CREATE INDEX venture_follows_user_idx ON public.venture_follows USING btree (user_id); -- valid: true
```

### Policies

#### venture_follows.venture_follows_read

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
CREATE TRIGGER refuse_if_restricted BEFORE INSERT ON venture_follows FOR EACH ROW EXECUTE FUNCTION private.refuse_if_restricted(); -- enabled: O
```

## public.venture_invites

[src: supabase/migrations/20260928190000_ventures.sql#venture_invites]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| venture_id | uuid | true | — |  |  | — |
| invitee_id | uuid | true | — |  |  | — |
| inviter_id | uuid | true | — |  |  | — |
| status | venture_invite_status | true | 'pending'::venture_invite_status |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |
| responded_at | timestamp with time zone | false | — |  |  | — |

### Keys and constraints

```sql
venture_invites_check: CHECK (invitee_id <> inviter_id); -- validated: true
```

```sql
venture_invites_invitee_id_fkey: FOREIGN KEY (invitee_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

```sql
venture_invites_inviter_id_fkey: FOREIGN KEY (inviter_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

```sql
venture_invites_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
venture_invites_venture_id_fkey: FOREIGN KEY (venture_id) REFERENCES ventures(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE INDEX venture_invites_invitee_idx ON public.venture_invites USING btree (invitee_id, status); -- valid: true
```

```sql
CREATE UNIQUE INDEX venture_invites_one_pending ON public.venture_invites USING btree (venture_id, invitee_id) WHERE (status = 'pending'::venture_invite_status); -- valid: true
```

```sql
CREATE UNIQUE INDEX venture_invites_pkey ON public.venture_invites USING btree (id); -- valid: true
```

### Policies

#### venture_invites.venture_invites_read

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "((invitee_id = ( SELECT auth.uid() AS uid)) OR (inviter_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1\n   FROM ventures v\n  WHERE ((v.id = venture_invites.venture_id) AND (v.owner_id = ( SELECT auth.uid() AS uid))))))",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

### Triggers

```sql
CREATE TRIGGER refuse_if_restricted BEFORE INSERT ON venture_invites FOR EACH ROW EXECUTE FUNCTION private.refuse_if_restricted(); -- enabled: O
```

```sql
CREATE TRIGGER venture_invites_notify AFTER INSERT OR UPDATE OF status ON venture_invites FOR EACH ROW EXECUTE FUNCTION private.notify_invites(); -- enabled: O
```

## public.venture_members

[src: supabase/migrations/20260928190000_ventures.sql#venture_members]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| venture_id | uuid | true | — |  |  | — |
| user_id | uuid | true | — |  |  | — |
| team_role | venture_team_role | true | 'other'::venture_team_role |  |  | — |
| joined_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
venture_members_pkey: PRIMARY KEY (venture_id, user_id); -- validated: true
```

```sql
venture_members_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

```sql
venture_members_venture_id_fkey: FOREIGN KEY (venture_id) REFERENCES ventures(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX venture_members_pkey ON public.venture_members USING btree (venture_id, user_id); -- valid: true
```

```sql
CREATE INDEX venture_members_user_idx ON public.venture_members USING btree (user_id); -- valid: true
```

### Policies

#### venture_members.venture_members_read

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
CREATE TRIGGER venture_member_commits AFTER INSERT ON venture_members FOR EACH ROW EXECUTE FUNCTION private.venture_member_commits(); -- enabled: O
```

```sql
CREATE TRIGGER venture_members_analytics AFTER INSERT ON venture_members FOR EACH ROW EXECUTE FUNCTION private.analytics_venture_joined(); -- enabled: O
```

```sql
CREATE TRIGGER venture_members_chat AFTER INSERT OR DELETE ON venture_members FOR EACH ROW EXECUTE FUNCTION private.venture_chat_membership(); -- enabled: O
```

```sql
CREATE TRIGGER venture_members_graduate_guard BEFORE INSERT ON venture_members FOR EACH ROW EXECUTE FUNCTION private.graduate_venture_guard(); -- enabled: O
```

```sql
CREATE TRIGGER venture_members_guard BEFORE INSERT OR DELETE ON venture_members FOR EACH ROW EXECUTE FUNCTION private.venture_members_guard(); -- enabled: O
```

```sql
CREATE TRIGGER venture_members_notify AFTER DELETE ON venture_members FOR EACH ROW EXECUTE FUNCTION private.notify_member_removed(); -- enabled: O
```

## public.venture_questions

[src: supabase/migrations/20260928190000_ventures.sql#venture_questions]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| venture_id | uuid | true | — |  |  | — |
| position | smallint | true | — |  |  | — |
| body | text | true | — |  |  | "default" |

### Keys and constraints

```sql
venture_questions_body_check: CHECK (char_length(btrim(body)) >= 3 AND char_length(btrim(body)) <= 200); -- validated: true
```

```sql
venture_questions_pkey: PRIMARY KEY (venture_id, "position"); -- validated: true
```

```sql
venture_questions_position_check: CHECK ("position" >= 1 AND "position" <= 3); -- validated: true
```

```sql
venture_questions_venture_id_fkey: FOREIGN KEY (venture_id) REFERENCES ventures(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX venture_questions_pkey ON public.venture_questions USING btree (venture_id, "position"); -- valid: true
```

### Policies

#### venture_questions.venture_questions_read

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

None.

## public.venture_roles

[src: supabase/migrations/20260928190000_ventures.sql#venture_roles]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| venture_id | uuid | true | — |  |  | — |
| title | text | true | — |  |  | "default" |
| skill_ids | text[] | true | '{}'::text[] |  |  | "default" |
| slots | smallint | true | 1 |  |  | — |
| filled | smallint | true | 0 |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
venture_roles_check: CHECK (filled <= slots); -- validated: true
```

```sql
venture_roles_filled_check: CHECK (filled >= 0); -- validated: true
```

```sql
venture_roles_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
venture_roles_skill_ids_check: CHECK (cardinality(skill_ids) <= 5); -- validated: true
```

```sql
venture_roles_slots_check: CHECK (slots >= 1 AND slots <= 5); -- validated: true
```

```sql
venture_roles_title_check: CHECK (char_length(btrim(title)) >= 2 AND char_length(btrim(title)) <= 60); -- validated: true
```

```sql
venture_roles_venture_id_fkey: FOREIGN KEY (venture_id) REFERENCES ventures(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX venture_roles_pkey ON public.venture_roles USING btree (id); -- valid: true
```

```sql
CREATE INDEX venture_roles_venture_idx ON public.venture_roles USING btree (venture_id); -- valid: true
```

### Policies

#### venture_roles.venture_roles_read

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

None.

## public.venture_updates

[src: supabase/migrations/20260928190000_ventures.sql#venture_updates]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| venture_id | uuid | true | — |  |  | — |
| author_id | uuid | true | — |  |  | — |
| body | text | true | — |  |  | "default" |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
venture_updates_author_id_fkey: FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

```sql
venture_updates_body_check: CHECK (char_length(btrim(body)) >= 1 AND char_length(btrim(body)) <= 2000); -- validated: true
```

```sql
venture_updates_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
venture_updates_venture_id_fkey: FOREIGN KEY (venture_id) REFERENCES ventures(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX venture_updates_pkey ON public.venture_updates USING btree (id); -- valid: true
```

```sql
CREATE INDEX venture_updates_venture_idx ON public.venture_updates USING btree (venture_id, created_at DESC); -- valid: true
```

### Policies

#### venture_updates.venture_updates_read

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
CREATE TRIGGER refuse_if_restricted BEFORE INSERT ON venture_updates FOR EACH ROW EXECUTE FUNCTION private.refuse_if_restricted(); -- enabled: O
```

## public.ventures

[src: supabase/migrations/20260928190000_ventures.sql#ventures]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| type | venture_type | true | — |  |  | — |
| owner_id | uuid | true | — |  |  | — |
| university_id | uuid | true | — |  |  | — |
| title | text | true | — |  |  | "default" |
| description | text | true | — |  |  | "default" |
| status | venture_status | true | 'recruiting'::venture_status |  |  | — |
| visibility | venture_visibility | true | 'public'::venture_visibility |  |  | — |
| stage | venture_stage | false | — |  |  | — |
| pitch_url | text | false | — |  |  | "default" |
| affiliation | text | false | — |  |  | "default" |
| skill_ids | text[] | true | '{}'::text[] |  |  | "default" |
| team_size | smallint | true | 4 |  |  | — |
| repo_id | bigint | false | — |  |  | — |
| repo_full_name | text | false | — |  |  | "default" |
| completed_at | timestamp with time zone | false | — |  |  | — |
| abandoned_at | timestamp with time zone | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |
| updated_at | timestamp with time zone | true | now() |  |  | — |
| search | tsvector | false | (setweight(to_tsvector('simple'::regconfig, title), 'A'::"char") \|\| setweight(to_tsvector('simple'::regconfig, "left"(description, 2000)), 'B'::"char")) |  | s | — |
| idea_id | uuid | false | — |  |  | — |

### Keys and constraints

```sql
ventures_affiliation_check: CHECK (affiliation IS NULL OR char_length(affiliation) <= 120); -- validated: true
```

```sql
ventures_check: CHECK (type = 'startup'::venture_type OR stage IS NULL AND pitch_url IS NULL); -- validated: true
```

```sql
ventures_check1: CHECK ((status = 'completed'::venture_status) = (completed_at IS NOT NULL)); -- validated: true
```

```sql
ventures_check2: CHECK ((status = 'abandoned'::venture_status) = (abandoned_at IS NOT NULL)); -- validated: true
```

```sql
ventures_description_check: CHECK (char_length(description) >= 1 AND char_length(description) <= 4000); -- validated: true
```

```sql
ventures_idea_id_fkey: FOREIGN KEY (idea_id) REFERENCES project_ideas(id) ON DELETE SET NULL; -- validated: true
```

```sql
ventures_owner_id_fkey: FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE RESTRICT; -- validated: true
```

```sql
ventures_pitch_url_check: CHECK (pitch_url IS NULL OR pitch_url ~ '^https://'::text AND char_length(pitch_url) <= 500); -- validated: true
```

```sql
ventures_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
ventures_repo_full_name_check: CHECK (repo_full_name IS NULL OR char_length(repo_full_name) <= 140); -- validated: true
```

```sql
ventures_skill_ids_check: CHECK (cardinality(skill_ids) <= 10); -- validated: true
```

```sql
ventures_team_size_check: CHECK (team_size >= 2 AND team_size <= 6); -- validated: true
```

```sql
ventures_title_check: CHECK (char_length(btrim(title)) >= 3 AND char_length(btrim(title)) <= 80); -- validated: true
```

```sql
ventures_university_id_fkey: FOREIGN KEY (university_id) REFERENCES universities(id) ON DELETE RESTRICT; -- validated: true
```

### Indexes

```sql
CREATE INDEX ventures_browse_idx ON public.ventures USING btree (type, status, created_at DESC) WHERE (visibility <> 'unlisted'::venture_visibility); -- valid: true
```

```sql
CREATE INDEX ventures_idea_idx ON public.ventures USING btree (idea_id) WHERE (idea_id IS NOT NULL); -- valid: true
```

```sql
CREATE INDEX ventures_owner_idx ON public.ventures USING btree (owner_id); -- valid: true
```

```sql
CREATE UNIQUE INDEX ventures_pkey ON public.ventures USING btree (id); -- valid: true
```

```sql
CREATE INDEX ventures_search_idx ON public.ventures USING gin (search); -- valid: true
```

```sql
CREATE INDEX ventures_skills_idx ON public.ventures USING gin (skill_ids); -- valid: true
```

```sql
CREATE INDEX ventures_title_trgm_idx ON public.ventures USING gin (title gin_trgm_ops); -- valid: true
```

```sql
CREATE INDEX ventures_university_idx ON public.ventures USING btree (university_id); -- valid: true
```

### Policies

#### ventures.ventures_read

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "((NOT private.is_blocked_with(owner_id)) AND ((visibility = 'public'::venture_visibility) OR ((visibility = 'university'::venture_visibility) AND (university_id = ( SELECT private.current_university_id() AS current_university_id))) OR private.is_venture_member(id) OR private.has_venture_invite(id) OR private.is_venture_teacher(id)))",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

### Triggers

```sql
CREATE TRIGGER refuse_if_restricted BEFORE INSERT ON ventures FOR EACH ROW EXECUTE FUNCTION private.refuse_if_restricted(); -- enabled: O
```

```sql
CREATE TRIGGER venture_repo_commits AFTER UPDATE OF repo_id ON ventures FOR EACH ROW EXECUTE FUNCTION private.venture_repo_commits(); -- enabled: O
```

```sql
CREATE TRIGGER ventures_analytics_completed AFTER UPDATE OF status ON ventures FOR EACH ROW WHEN (new.status = 'completed'::venture_status AND old.status IS DISTINCT FROM 'completed'::venture_status) EXECUTE FUNCTION private.analytics_venture_completed(); -- enabled: O
```

```sql
CREATE TRIGGER ventures_analytics_created AFTER INSERT ON ventures FOR EACH ROW EXECUTE FUNCTION private.analytics_venture_created(); -- enabled: O
```

```sql
CREATE TRIGGER ventures_chat AFTER INSERT ON ventures FOR EACH ROW EXECUTE FUNCTION private.venture_chat_created(); -- enabled: O
```

```sql
CREATE TRIGGER ventures_notify AFTER UPDATE OF owner_id, status ON ventures FOR EACH ROW EXECUTE FUNCTION private.notify_venture_changes(); -- enabled: O
```

```sql
CREATE TRIGGER ventures_post_shipped AFTER UPDATE OF status ON ventures FOR EACH ROW EXECUTE FUNCTION private.post_shipped(); -- enabled: O
```

```sql
CREATE TRIGGER ventures_prompt_endorsements AFTER UPDATE OF status ON ventures FOR EACH ROW EXECUTE FUNCTION private.prompt_endorsements(); -- enabled: O
```

```sql
CREATE TRIGGER ventures_record_completion AFTER UPDATE OF status ON ventures FOR EACH ROW EXECUTE FUNCTION private.ventures_record_completion(); -- enabled: O
```

```sql
CREATE TRIGGER ventures_updated_at BEFORE UPDATE ON ventures FOR EACH ROW EXECUTE FUNCTION private.set_updated_at(); -- enabled: O
```
