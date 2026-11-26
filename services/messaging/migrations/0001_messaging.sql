-- messaging: chat threads (DMs and venture team chats), members, messages, reactions, pins, read marks
-- (docs/azure/prd.md, service catalogue). Forward-only. Every table: row-level security enabled and forced,
-- one policy for the owning role (prd.md, "Layout"). No foreign key leaves the schema: user, venture and
-- organisation ids come from their owners' events and calls.
-- Ported from apps/web/supabase/migrations (_chat, _chat_extras_explore, _phase3_answers, _recruiter_talent,
-- _share_reach_push, _chat_deleted_member); docs/azure/messaging-function-bins.md maps every function.

create table messaging.threads (
  id uuid primary key,
  type text not null check (type in ('dm', 'group')),
  venture_id uuid unique,
  -- least(user)||':'||greatest(user) for DMs: one DM per pair.
  dm_key text unique,
  -- A recruiter's contact DM (market, W11): shown with the organisation; closed by the student.
  org_id uuid,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  last_message_at timestamptz,
  check ((type = 'group') = (venture_id is not null)),
  check ((type = 'dm') = (dm_key is not null))
);

create table messaging.members (
  thread_id uuid not null references messaging.threads (id) on delete cascade,
  user_id uuid not null,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  muted_until timestamptz,
  primary key (thread_id, user_id)
);
create index members_user_idx on messaging.members (user_id);

create table messaging.messages (
  id uuid primary key,
  thread_id uuid not null references messaging.threads (id) on delete cascade,
  sender_id uuid not null,
  body text not null default '' check (char_length(body) <= 10000),
  media_path text check (media_path is null or media_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'),
  media_width integer check (media_width is null or media_width between 1 and 4000),
  media_height integer check (media_height is null or media_height between 1 and 4000),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  -- Removed by staff (trust's moderation.removed, W10).
  removed_by uuid,
  reply_to_id uuid references messaging.messages (id) on delete set null,
  -- The first URL in the body (the link preview's key; previews are content's, shown by web).
  link_url text check (link_url is null or char_length(link_url) <= 2000),
  shared_post_id uuid,
  shared boolean not null default false,
  search tsvector generated always as (to_tsvector('simple', body)) stored,
  check (deleted_at is not null or char_length(btrim(body)) > 0 or media_path is not null or shared)
);
create index messages_thread_created_idx on messaging.messages (thread_id, created_at desc);
create index messages_sender_idx on messaging.messages (sender_id, created_at desc);
create index messages_reply_idx on messaging.messages (reply_to_id) where reply_to_id is not null;
create index messages_search_idx on messaging.messages using gin (search);

-- A fixed set of six; one reaction per person per message (phase 3 answers).
create table messaging.reactions (
  message_id uuid not null references messaging.messages (id) on delete cascade,
  thread_id uuid not null references messaging.threads (id) on delete cascade,
  user_id uuid not null,
  emoji text not null check (emoji in ('👍', '❤️', '😂', '🎉', '😮', '🙏')),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
create index reactions_thread_idx on messaging.reactions (thread_id);
create index reactions_user_idx on messaging.reactions (user_id);

-- Venture team chats only, by the venture's owner, up to 3.
create table messaging.pins (
  message_id uuid primary key references messaging.messages (id) on delete cascade,
  thread_id uuid not null references messaging.threads (id) on delete cascade,
  pinned_by uuid not null,
  pinned_at timestamptz not null default now()
);
create index pins_thread_idx on messaging.pins (thread_id, pinned_at);

-- Accounts already deleted: a late event for one of them is ignored.
create table messaging.deleted_accounts (
  user_id uuid primary key,
  deleted_at timestamptz not null default now()
);

alter table messaging.threads enable row level security;
alter table messaging.threads force row level security;
create policy threads_owner on messaging.threads for all to svc_messaging using (true) with check (true);
grant select, insert, update, delete on messaging.threads to svc_messaging;

alter table messaging.members enable row level security;
alter table messaging.members force row level security;
create policy members_owner on messaging.members for all to svc_messaging using (true) with check (true);
grant select, insert, update, delete on messaging.members to svc_messaging;

alter table messaging.messages enable row level security;
alter table messaging.messages force row level security;
create policy messages_owner on messaging.messages for all to svc_messaging using (true) with check (true);
grant select, insert, update, delete on messaging.messages to svc_messaging;

alter table messaging.reactions enable row level security;
alter table messaging.reactions force row level security;
create policy reactions_owner on messaging.reactions for all to svc_messaging using (true) with check (true);
grant select, insert, update, delete on messaging.reactions to svc_messaging;

alter table messaging.pins enable row level security;
alter table messaging.pins force row level security;
create policy pins_owner on messaging.pins for all to svc_messaging using (true) with check (true);
grant select, insert, update, delete on messaging.pins to svc_messaging;

alter table messaging.deleted_accounts enable row level security;
alter table messaging.deleted_accounts force row level security;
create policy deleted_accounts_owner on messaging.deleted_accounts for all to svc_messaging using (true) with check (true);
grant select, insert, update, delete on messaging.deleted_accounts to svc_messaging;
