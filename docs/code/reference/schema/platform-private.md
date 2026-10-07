Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# platform-private

## materialized_view: private.landing_stats_mv

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "options": null,
  "definition": " SELECT ( SELECT count(*) AS count\n           FROM profiles p\n             JOIN auth.users au ON au.id = p.user_id\n          WHERE p.role = 'student'::account_role AND (p.status = ANY (ARRAY['active'::account_status, 'graduate'::account_status])) AND au.email_confirmed_at IS NOT NULL) AS verified_students,\n    ( SELECT count(*) AS count\n           FROM ventures v\n          WHERE v.status <> 'abandoned'::venture_status) AS ventures,\n    ( SELECT count(*) AS count\n           FROM ventures v\n          WHERE v.status = 'completed'::venture_status) AS shipped_ventures,\n    ( SELECT count(*) AS count\n           FROM universities u\n          WHERE u.live_at IS NOT NULL AND u.live_at <= now()) AS live_universities,\n    now() AS refreshed_at;"
}
```

## materialized_view: private.landing_universities_mv

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "options": null,
  "definition": " SELECT id AS university_id,\n    name,\n    ( SELECT count(*) AS count\n           FROM profiles p\n             JOIN auth.users au ON au.id = p.user_id\n          WHERE p.university_id = u.id AND p.role = 'student'::account_role AND (p.status = ANY (ARRAY['active'::account_status, 'graduate'::account_status])) AND au.email_confirmed_at IS NOT NULL) AS students\n   FROM universities u\n  WHERE live_at IS NOT NULL AND live_at <= now();"
}
```

## materialized_view: private.ops_metrics_mv

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "options": null,
  "definition": " SELECT 'signups'::text AS series,\n    COALESCE(( SELECT jsonb_agg(jsonb_build_object('day', d.day, 'student', d.student, 'faculty', d.faculty, 'recruiter', d.recruiter, 'official', d.official) ORDER BY d.day) AS jsonb_agg\n           FROM ( SELECT g.day::date AS day,\n                    count(*) FILTER (WHERE p.role = 'student'::account_role) AS student,\n                    count(*) FILTER (WHERE p.role = 'faculty'::account_role) AS faculty,\n                    count(*) FILTER (WHERE p.role = 'recruiter'::account_role) AS recruiter,\n                    count(*) FILTER (WHERE p.role <> ALL (ARRAY['student'::account_role, 'faculty'::account_role, 'recruiter'::account_role])) AS official\n                   FROM generate_series(((now() AT TIME ZONE 'Asia/Karachi'::text)::date - 89)::timestamp with time zone, (now() AT TIME ZONE 'Asia/Karachi'::text)::date::timestamp with time zone, '1 day'::interval) g(day)\n                     LEFT JOIN profiles p ON (p.created_at AT TIME ZONE 'Asia/Karachi'::text)::date = g.day::date\n                  GROUP BY g.day) d), '[]'::jsonb) AS data\nUNION ALL\n SELECT 'evidence'::text AS series,\n    COALESCE(( SELECT jsonb_agg(jsonb_build_object('university', x.name, 'students', x.students, 'l2', x.l2) ORDER BY x.students DESC) AS jsonb_agg\n           FROM ( SELECT un.name,\n                    count(*) AS students,\n                    count(*) FILTER (WHERE (EXISTS ( SELECT 1\n                           FROM user_skills us\n                          WHERE us.user_id = p.user_id AND us.level >= 2))) AS l2\n                   FROM profiles p\n                     JOIN universities un ON un.id = p.university_id\n                  WHERE p.role = 'student'::account_role AND p.onboarding_complete\n                  GROUP BY un.name\n                  ORDER BY (count(*)) DESC\n                 LIMIT 15) x), '[]'::jsonb) AS data\nUNION ALL\n SELECT 'contacts'::text AS series,\n    COALESCE(( SELECT jsonb_agg(jsonb_build_object('week', w.week, 'sent', w.sent, 'accepted', w.accepted, 'declined', w.declined) ORDER BY w.week) AS jsonb_agg\n           FROM ( SELECT g.week::date AS week,\n                    count(c.id) AS sent,\n                    count(c.id) FILTER (WHERE c.status = 'accepted'::contact_status) AS accepted,\n                    count(c.id) FILTER (WHERE c.status = 'declined'::contact_status) AS declined\n                   FROM generate_series(date_trunc('week'::text, now()) - '77 days'::interval, date_trunc('week'::text, now()), '7 days'::interval) g(week)\n                     LEFT JOIN contact_requests c ON date_trunc('week'::text, c.created_at) = g.week\n                  GROUP BY g.week) w), '[]'::jsonb) AS data\nUNION ALL\n SELECT 'hires'::text AS series,\n    COALESCE(( SELECT jsonb_agg(jsonb_build_object('month', m.month, 'intern', m.intern, 'full_time', m.full_time) ORDER BY m.month) AS jsonb_agg\n           FROM ( SELECT g.month::date AS month,\n                    count(h.id) FILTER (WHERE h.kind = 'intern'::text) AS intern,\n                    count(h.id) FILTER (WHERE h.kind = 'full_time'::text) AS full_time\n                   FROM generate_series(date_trunc('month'::text, now()) - '11 mons'::interval, date_trunc('month'::text, now()), '1 mon'::interval) g(month)\n                     LEFT JOIN hires h ON date_trunc('month'::text, h.hired_at) = g.month\n                  GROUP BY g.month) m), '[]'::jsonb) AS data\nUNION ALL\n SELECT 'mrr'::text AS series,\n    COALESCE(( SELECT jsonb_agg(jsonb_build_object('stream', r.subject_type, 'currency', r.currency, 'mrr', r.mrr, 'subscriptions', r.n) ORDER BY r.subject_type, r.currency) AS jsonb_agg\n           FROM ( SELECT s.subject_type,\n                    s.currency,\n                    count(*) AS n,\n                    round(sum(s.period_amount /\n                        CASE p.\"interval\"\n                            WHEN 'year'::text THEN 12\n                            ELSE 1\n                        END::numeric), 2) AS mrr\n                   FROM subscriptions s\n                     JOIN plans p ON p.id = s.plan_id\n                  WHERE s.live AND (s.status = ANY (ARRAY['active'::subscription_status, 'past_due'::subscription_status]))\n                  GROUP BY s.subject_type, s.currency) r), '[]'::jsonb) AS data\nUNION ALL\n SELECT 'refreshed'::text AS series,\n    to_jsonb(now()) AS data;"
}
```
