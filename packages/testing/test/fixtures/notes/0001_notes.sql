-- Fixture for the harness test: the pattern every service table follows.
create table notes.notes (
  id bigint generated always as identity primary key,
  body text not null
);
alter table notes.notes enable row level security;
alter table notes.notes force row level security;
-- Default deny: the owning service's role is the only one with a policy and grants.
create policy notes_owner on notes.notes to svc_notes using (true) with check (true);
grant select, insert on notes.notes to svc_notes;
