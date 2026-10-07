Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# university_launch

## private.queue_university_launch(p_university uuid)

[src: supabase/migrations/20261102000000_university_launch.sql#queue_university_launch]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.queue_university_launch(p_university uuid) | plpgsql | true | search_path="" | None | 20261102000000_university_launch.sql |

## private.university_launch_email(p_request uuid)

[src: supabase/migrations/20261102000000_university_launch.sql#university_launch_email]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.university_launch_email(p_request uuid) | sql | true | search_path="" | None | 20261102000000_university_launch.sql |

## private.university_went_live()

[src: supabase/migrations/20261102000000_university_launch.sql#university_went_live]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.university_went_live() | plpgsql | true | search_path="" | None | 20261102000000_university_launch.sql |
