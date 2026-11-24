create table other.things (id int primary key);
alter table other.things enable row level security;
alter table other.things force row level security;
create policy things_owner on other.things to svc_other using (true) with check (true);
grant select on other.things to svc_other;
