-- Read-only: what supabase/migrations/20261110000000_portals_flag.sql will delete (phase 14).
-- Run it in the SQL editor of the hosted project before merging, and paste the row into the PR.
select
  (select count(*) from public.profiles where role = 'recruiter') as recruiter_accounts,
  (select count(*) from public.profiles where role = 'university_admin') as official_accounts,
  (select count(*) from public.organizations o
    where not exists (select 1 from public.competitions c join public.competition_awards a on a.competition_id = c.id
                       where c.org_id = o.id)) as organisations_deleted,
  (select count(*) from public.organizations o
    where exists (select 1 from public.competitions c join public.competition_awards a on a.competition_id = c.id
                   where c.org_id = o.id)) as organisations_kept_for_awards,
  (select count(*) from public.university_admins a join public.profiles p on p.user_id = a.user_id
    where p.role in ('recruiter', 'university_admin')) as seats_deleted,
  (select count(*) from public.university_admins a join public.profiles p on p.user_id = a.user_id
    where p.role = 'faculty') as faculty_seats_kept,
  (select count(*) from public.university_admin_invites) as official_invites_deleted,
  (select count(*) from public.job_posts j
    where not exists (select 1 from public.competitions c join public.competition_awards a on a.competition_id = c.id
                       where c.org_id = j.org_id)) as job_posts_deleted,
  (select count(*) from public.contact_requests r
    where not exists (select 1 from public.competitions c join public.competition_awards a on a.competition_id = c.id
                       where c.org_id = r.org_id)) as contact_requests_deleted;
