# Identity: function tracking sheet (W1)

Date: 2026-11-25 (second pass the same day). Branch: `azure`. Source: `apps/web/supabase/migrations/` (83 files, 1,501 distinct SQL functions).

The first W1 deliverable. It lists every SQL function the `identity` service will own and puts each in one of the five bins from "How each function is ported" in `docs/azure/prd.md`. Golden tests are recorded against these functions before any W1 code is written. Nothing has been recorded yet.

**Boundary (Ahmed, 2026-11-25).** The PRD service catalogue decides ownership. `identity` owns accounts, sign-in, sessions, two-factor, signup gates (university domain, live date, portals flag), agreement versions, staff roles and account deletion. Profiles, universities, onboarding, friends and blocks belong to `people` (W2), even though `_identity.sql` defines them. Functions on the line between the two stay in identity and carry a **Seam** note.

**Identity tables** used for this sheet and its checks: `auth.*` (Supabase Auth: users, sessions, mfa_factors), `public.staff_roles`, `public.personal_email_domains`, `private.rate_limit_events`, `private.auth_failures`, `private.auth_lockouts`, `public.security_events`, `public.user_devices`, `private.security_alert_tokens`, `public.agreement_versions`, `public.agreement_acceptances`, `private.mfa_backup_codes`.

Locations are the latest definition (the one that runs today), as `file:line` under `apps/web/supabase/migrations/`; app locations are under `apps/web/`. A function redefined in later migrations notes its number of versions. Four public wrappers are generated at run time by `pg_temp.expose` and point at that call.

## Reconciliation

| Part | Rows | Inside the 53? |
| --- | ---: | --- |
| Identity-owned, binned | 53 | These are the 53 |
| Unclear | 12 | No. Not binned and not counted in the 53 |
| Defined in `_identity.sql`, owned by `people` | 14 | No. Not binned |
| Triggers on identity tables owned by other services | 8 | No. Binned ("Trigger or internal helper") but ported by the owning service |
| Other services' functions that read or write identity tables | 44 | No. Not binned |
| **Total function rows** | **131** | |

The first pass of this sheet held 87 function rows (53 + 12 + 14 + 8) and named the 44 readers in a list without locations. The figure 98 given in the chat report for that pass was wrong; the sheet itself said 87. This pass turns the 44 readers into rows with `file:line`, so the sheet now has 131 function rows. No function was added or removed.

## Summary of the 53

| Bin | Count | Share |
| --- | ---: | ---: |
| Read called by the app | 4 | 8% |
| Command called by the app | 12 | 23% |
| Trigger or internal helper | 18 | 34% |
| Scheduled job | 2 | 4% |
| Wrapper or plumbing that only existed for Supabase | 17 | 32% |
| **Total** | **53** | 100% |

The 17 functions in "Wrapper or plumbing that only existed for Supabase" are not ported and have no golden tests (decision 2026-11-25); their golden tests run against the private function each one calls.

**Golden recordings (2026-11-25).** The Golden column names the fixture file under `packages/testing/test/golden/identity/` and its case. All 36 ported functions are recorded; the 17 wrappers are skipped. The same folder holds `rate-limit.json` (the current `rate_limit` definition, private and public), `agreement.json` (four acceptance cases under RLS), `ban.json` (ban, session end, audit before and after, lift, refusals, suspension), `require.json` (the seven staff-role helpers), `github.json` (the two GitHub writes) and `password.json` (the `changePassword` action driven in a browser). The SQL recorder is `packages/testing/test/identity.golden.test.ts`; the password recorder is `apps/web/tests/golden/password.golden.spec.ts` with `apps/web/playwright.golden.config.ts`. The breached-password refusal is not recorded: it needs the Have I Been Pwned API.

**Size against the PRD.** The PRD gives about 2,700 SQL lines for `identity`. The 53 identity functions come to 1,043 lines in their latest versions and 1,744 lines counting every redefinition. The 12 unclear functions add 249 lines. The PRD figure most likely counts whole migration files, tables and policies included, so it is the same order of size but not a like-for-like comparison.

## Identity-owned functions

### Signup gates and account creation

| Function | Source | Bin | Caller | Owning table(s) | Notes | Golden |
| --- | --- | --- | --- | --- | --- | --- |
| `private.email_domain` | `20260927210238_identity.sql:34` | Trigger or internal helper | SQL: 16 functions in several services | - | Pure. Other services use it for invite and check-in emails, so it needs a shared home or an identity method. | Recorded: `signup.json#email_domain` |
| `private.domain_admits_students` | `20260927210238_identity.sql:131` | Trigger or internal helper | SQL: validate_signup, email_domain_allowed, guard_email_change, set_my_university (people) | - | Seam: reads `university_domains` (people). | Recorded: `signup.json#domain_admits_students` |
| `private.email_domain_allowed` | `20261017000000_uni_core.sql:588` | Trigger or internal helper | SQL: my_gate_state | `auth.users` | Seam: reads `profiles` (people), `organizations`, `org_members`. 4 versions. | Recorded: `signup.json#email_domain_allowed` |
| `private.validate_signup` | `20261110000000_portals_flag.sql:102` | Trigger or internal helper | SQL: hook_before_user_created | `public.personal_email_domains` | The signup gate: domain, live date, role, portals flag. Seam: reads `university_domains` (people). 6 versions; port the latest. | Recorded: `signup.json#validate_signup` |
| `private.handle_new_user` | `20261017000000_uni_core.sql:499` | Trigger or internal helper | Trigger `on_auth_user_created` on auth.users | `public.agreement_acceptances`, `public.security_events` | Seam: writes `profiles`, `onboarding_state` (people) and role rows for faculty, recruiters and officials; becomes `user.created` handling. 4 versions. | Recorded: `signup.json#handle_new_user, #handle_new_user_roles` |
| `private.guard_email_change` | `20261013000000_recruiter_orgs.sql:392` | Trigger or internal helper | Trigger `on_auth_user_email_change` on auth.users | - | Seam: reads `profiles` (people), `organizations`, `org_members`. 3 versions. | Recorded: `signup.json#guard_email_change` |
| `private.guard_uni_admin_email_change` | `20261017000000_uni_core.sql:612` | Trigger or internal helper | Trigger `users_guard_uni_admin_email` on auth.users | - | Seam: refuses an email change that would break a university seat; reads `profiles` (people) and university admin data. | Recorded: `signup.json#guard_uni_admin_email_change` |
| `private.is_recruiter_domain` | `20261013000000_recruiter_orgs.sql:155` | Trigger or internal helper | SQL: email_domain_allowed, guard_email_change, handle_new_user, validate_signup, create_organization | `public.personal_email_domains` | Seam: also used by organisation creation outside identity. | Recorded: `signup.json#is_recruiter_domain` |
| `private.portals_state` | `20261110000000_portals_flag.sql:28` | Trigger or internal helper | SQL: portal_enabled, my_gate_state, public.portals_state | - | Seam: reads the `portals.enabled` config key through `private.config`. | Recorded: `signup.json#portals_state` |
| `public.portals_state` | `20261110000000_portals_flag.sql:58` | Wrapper or plumbing that only existed for Supabase | App: proxy.ts, lib/data/portals.ts | - | One-line security-invoker wrapper. | Skipped: Supabase-only wrapper (decision 2026-11-25). The cases call through it, so its private function's golden covers it. |
| `private.portal_enabled` | `20261110000000_portals_flag.sql:44` | Trigger or internal helper | SQL: validate_signup, openings_categories | - | Seam: Openings also reads it. | Recorded: `signup.json#portals_state` |

### Sign-in, sessions and security events

| Function | Source | Bin | Caller | Owning table(s) | Notes | Golden |
| --- | --- | --- | --- | --- | --- | --- |
| `public.my_gate_state` | `20261110000000_portals_flag.sql:71` | Read called by the app | App: proxy.ts, app/auth/callback, lib/actions/{auth,agreement,mfa}.ts, lib/data/marketing.ts | `public.agreement_acceptances` | Has its own logic (not a wrapper). Seam: reads `profiles`, `onboarding_state` (people). 3 versions. | Recorded: `signin.json#my_gate_state`; `agreement.json#acceptance (gate before and after)` |
| `private.signin_account_key` | `20260927210238_identity.sql:489` | Trigger or internal helper | SQL: signin_status, signin_failed, record_sign_in | - | Pure. | Recorded: `signin.json#signin_helpers` |
| `private.signin_ip_key` | `20260927210238_identity.sql:499` | Trigger or internal helper | SQL: signin_status, signin_failed | - | Pure. | Recorded: `signin.json#signin_helpers` |
| `private.signin_delay_seconds` | `20260928123000_auth_decisions.sql:25` | Trigger or internal helper | SQL: signin_status, signin_failed | - | Pure. | Recorded: `signin.json#signin_helpers` |
| `private.signin_status` | `20260928123000_auth_decisions.sql:37` | Read called by the app | public.signin_status (lib/actions/auth.ts) | `private.auth_failures` | 2 versions. | Recorded: `signin.json#signin_failures` |
| `public.signin_status` | `20260927210238_identity.sql:539` | Wrapper or plumbing that only existed for Supabase | App: lib/actions/auth.ts | - |  | Skipped: Supabase-only wrapper (decision 2026-11-25). The cases call through it, so its private function's golden covers it. |
| `private.signin_failed` | `20260928123000_auth_decisions.sql:74` | Command called by the app | public.signin_failed (lib/actions/auth.ts) | `auth.users`, `private.auth_failures`, `public.security_events` | 2 versions. | Recorded: `signin.json#signin_failures` |
| `public.signin_failed` | `20260927210238_identity.sql:657` | Wrapper or plumbing that only existed for Supabase | App: lib/actions/auth.ts | - |  | Skipped: Supabase-only wrapper (decision 2026-11-25). The cases call through it, so its private function's golden covers it. |
| `private.record_sign_in` | `20260927210238_identity.sql:672` | Command called by the app | public.record_sign_in (lib/auth/sign-in-record.ts) | `auth.users`, `private.auth_failures`, `private.security_alert_tokens`, `public.security_events`, `public.user_devices` | New-device alert token. | Recorded: `signin.json#record_sign_in` |
| `public.record_sign_in` | `20260927210238_identity.sql:729` | Wrapper or plumbing that only existed for Supabase | App: lib/auth/sign-in-record.ts | - |  | Skipped: Supabase-only wrapper (decision 2026-11-25). The cases call through it, so its private function's golden covers it. |
| `private.security_not_me` | `20260927210238_identity.sql:743` | Command called by the app | public.security_not_me (lib/actions/auth.ts) | `auth.sessions`, `auth.users`, `private.security_alert_tokens`, `public.security_events` | Revokes `auth.sessions`. | Recorded: `signin.json#record_sign_in` |
| `public.security_not_me` | `20260927210238_identity.sql:779` | Wrapper or plumbing that only existed for Supabase | App: lib/actions/auth.ts | - |  | Skipped: Supabase-only wrapper (decision 2026-11-25). The cases call through it, so its private function's golden covers it. |
| `private.log_security_event` | `20260927210238_identity.sql:794` | Command called by the app | public.log_security_event (lib/actions/{auth,mfa}.ts) | `public.security_events` |  | Recorded: `signin.json#log_security_event` |
| `public.log_security_event` | `20260927210238_identity.sql:820` | Wrapper or plumbing that only existed for Supabase | App: lib/actions/auth.ts, lib/actions/mfa.ts | - |  | Skipped: Supabase-only wrapper (decision 2026-11-25). The cases call through it, so its private function's golden covers it. |
| `private.purge_security_data` | `20260928123000_auth_decisions.sql:124` | Scheduled job | Cron `purge-security-data` (23 3 * * *) | `private.auth_failures`, `private.mfa_backup_codes`, `private.rate_limit_events`, `private.security_alert_tokens`, `public.security_events` | Also purges `rate_limit_events`, whose owner is unclear (see Unclear). 2 versions. | Recorded: `signin.json#purge_security_data` |

### Two-factor

| Function | Source | Bin | Caller | Owning table(s) | Notes | Golden |
| --- | --- | --- | --- | --- | --- | --- |
| `private.normalize_backup_code` | `20260928123000_auth_decisions.sql:188` | Trigger or internal helper | SQL: use_mfa_backup_code | - | Pure. | Recorded: `two-factor.json#normalize_backup_code` |
| `private.create_mfa_backup_codes` | `20260928123000_auth_decisions.sql:200` | Command called by the app | public.create_mfa_backup_codes (lib/actions/mfa.ts) | `private.mfa_backup_codes`, `public.security_events` |  | Recorded: `two-factor.json#backup_codes` |
| `public.create_mfa_backup_codes` | `20260928123000_auth_decisions.sql:238` | Wrapper or plumbing that only existed for Supabase | App: lib/actions/mfa.ts | - |  | Skipped: Supabase-only wrapper (decision 2026-11-25). The cases call through it, so its private function's golden covers it. |
| `private.mfa_backup_codes_remaining` | `20260928123000_auth_decisions.sql:251` | Read called by the app | public.mfa_backup_codes_remaining (settings/security page) | `private.mfa_backup_codes` |  | Recorded: `two-factor.json#backup_codes` |
| `public.mfa_backup_codes_remaining` | `20260928123000_auth_decisions.sql:264` | Wrapper or plumbing that only existed for Supabase | App: app/(app)/settings/security/page.tsx | - |  | Skipped: Supabase-only wrapper (decision 2026-11-25). The cases call through it, so its private function's golden covers it. |
| `private.delete_mfa_backup_codes` | `20260928123000_auth_decisions.sql:277` | Command called by the app | public.delete_mfa_backup_codes (lib/actions/mfa.ts) | `private.mfa_backup_codes` |  | Recorded: `two-factor.json#delete_backup_codes` |
| `public.delete_mfa_backup_codes` | `20260928123000_auth_decisions.sql:289` | Wrapper or plumbing that only existed for Supabase | App: lib/actions/mfa.ts | - |  | Skipped: Supabase-only wrapper (decision 2026-11-25). The cases call through it, so its private function's golden covers it. |
| `private.use_mfa_backup_code` | `20260928123000_auth_decisions.sql:306` | Command called by the app | public.use_mfa_backup_code (lib/actions/mfa.ts) | `auth.mfa_factors`, `private.mfa_backup_codes`, `public.security_events` | Removes the TOTP factor in `auth.mfa_factors`. | Recorded: `two-factor.json#backup_codes` |
| `public.use_mfa_backup_code` | `20260928123000_auth_decisions.sql:337` | Wrapper or plumbing that only existed for Supabase | App: lib/actions/mfa.ts | - |  | Skipped: Supabase-only wrapper (decision 2026-11-25). The cases call through it, so its private function's golden covers it. |
| `private.ops_reset_mfa` | `20261028000000_users_view_as.sql:323` | Command called by the app | public.ops_reset_mfa (lib/actions/ops/users.ts) | `auth.mfa_factors`, `auth.sessions`, `auth.users`, `private.mfa_backup_codes` | Staff method: super admin, audited before and after. Seam: writes `ops_audit_log`. | Recorded: `two-factor.json#ops_reset_mfa` |
| `public.ops_reset_mfa` | `20261028000000_users_view_as.sql:400` (generated) | Wrapper or plumbing that only existed for Supabase | App: lib/actions/ops/users.ts | - | Generated by `pg_temp.expose`. | Skipped: Supabase-only wrapper (decision 2026-11-25). The cases call through it, so its private function's golden covers it. |

### Agreement and staff roles

| Function | Source | Bin | Caller | Owning table(s) | Notes | Golden |
| --- | --- | --- | --- | --- | --- | --- |
| `private.current_agreement_version` | `20260927210238_identity.sql:855` | Trigger or internal helper | SQL: handle_new_user, my_gate_state; RLS policy agreement_acceptances_accept_current | `public.agreement_versions` | Acceptance itself has no function: the app inserts into `agreement_acceptances` directly (lib/actions/agreement.ts, app/auth/callback). W1 needs a command for it. | Recorded: `staff.json#current_agreement_version` |
| `private.is_staff` | `20260927210238_identity.sql:210` | Trigger or internal helper | SQL: 34 functions in several services, plus RLS policies | `public.staff_roles` | Every staff check in every service depends on it. | Recorded: `staff.json#is_staff` |
| `public.is_staff` | `20260927210238_identity.sql:235` | Wrapper or plumbing that only existed for Supabase | App: feed page, api/ops/pdf-check, lib/data/ops.ts, lib/data/ops-trust.ts | - |  | Skipped: Supabase-only wrapper (decision 2026-11-25). The cases call through it, so its private function's golden covers it. |
| `private.staff_roles_of` | `20261026000000_ops_shell.sql:136` | Trigger or internal helper | SQL: grant_staff_role, revoke_staff_role, ops_user_record | `public.staff_roles` | Seam: `ops_user_record` (/ops users) also calls it. | Recorded: `staff.json#is_staff` |
| `private.ops_staff` | `20261026000000_ops_shell.sql:147` | Read called by the app | public.ops_staff (lib/data/ops-shell.ts) | `auth.mfa_factors`, `auth.users`, `public.staff_roles` | Seam: reads `profiles` (people). | Recorded: `staff.json#ops_staff` |
| `public.ops_staff` | `20261026000000_ops_shell.sql:386` (generated) | Wrapper or plumbing that only existed for Supabase | App: lib/data/ops-shell.ts | - | Generated by `pg_temp.expose`. | Skipped: Supabase-only wrapper (decision 2026-11-25). The cases call through it, so its private function's golden covers it. |
| `private.grant_staff_role` | `20261026000000_ops_shell.sql:172` | Command called by the app | public.grant_staff_role (lib/actions/ops/staff.ts) | `auth.mfa_factors`, `auth.users`, `public.staff_roles` | Staff method: super admin, two-factor required on the target, audited. Seam: writes `ops_audit_log`. | Recorded: `staff.json#grant_revoke` |
| `public.grant_staff_role` | `20261026000000_ops_shell.sql:386` (generated) | Wrapper or plumbing that only existed for Supabase | App: lib/actions/ops/staff.ts | - | Generated by `pg_temp.expose`. | Skipped: Supabase-only wrapper (decision 2026-11-25). The cases call through it, so its private function's golden covers it. |
| `private.revoke_staff_role` | `20261026000000_ops_shell.sql:208` | Command called by the app | public.revoke_staff_role (lib/actions/ops/staff.ts) | `public.staff_roles` | Never removes the last super admin. Seam: writes `ops_audit_log`. | Recorded: `staff.json#grant_revoke` |
| `public.revoke_staff_role` | `20261026000000_ops_shell.sql:386` (generated) | Wrapper or plumbing that only existed for Supabase | App: lib/actions/ops/staff.ts | - | Generated by `pg_temp.expose`. | Skipped: Supabase-only wrapper (decision 2026-11-25). The cases call through it, so its private function's golden covers it. |

### Account deletion

| Function | Source | Bin | Caller | Owning table(s) | Notes | Golden |
| --- | --- | --- | --- | --- | --- | --- |
| `private.request_account_deletion` | `20261010000000_student_portal.sql:257` | Command called by the app | public.request_account_deletion (lib/actions/account.ts) | `public.staff_roles` | Seam: the deletion state lives on `profiles.status`/`delete_after` (people). | Recorded: `deletion.json#request_cancel` |
| `public.request_account_deletion` | `20261010000000_student_portal.sql:421` | Wrapper or plumbing that only existed for Supabase | App: lib/actions/account.ts | - |  | Skipped: Supabase-only wrapper (decision 2026-11-25). The cases call through it, so its private function's golden covers it. |
| `private.cancel_account_deletion` | `20261010000000_student_portal.sql:290` | Command called by the app | public.cancel_account_deletion (lib/actions/account.ts) | - | Seam: writes `profiles` (people). | Recorded: `deletion.json#request_cancel` |
| `public.cancel_account_deletion` | `20261010000000_student_portal.sql:423` | Wrapper or plumbing that only existed for Supabase | App: lib/actions/account.ts | - |  | Skipped: Supabase-only wrapper (decision 2026-11-25). The cases call through it, so its private function's golden covers it. |
| `private.delete_account` | `20261010000000_student_portal.sql:353` | Trigger or internal helper | SQL: account_deletion_run, delete_closed_portal_accounts | `auth.users` | Seam: writes chat, venture and application tables, then deletes `auth.users` (cascades). Becomes `user.deleted` handlers in those services. | Recorded: `deletion.json#delete_account` |
| `private.account_deletion_run` | `20261010000000_student_portal.sql:390` | Scheduled job | Cron `account-deletion` (17 * * * *) | - |  | Recorded: `deletion.json#account_deletion_run` |

## Triggers on identity tables owned by other services

All "Trigger or internal helper". Each becomes "an event handler in another service" (`user.created`, `user.deleted`, or a new identity event) and is ported with the service that owns the tables it writes, not in W1. W1 must emit the events they need.

| Function | Source | Bin | Caller | Owning table(s) | Notes |
| --- | --- | --- | --- | --- | --- |
| `private.cv_on_ban` | `20261009000000_cv_control.sql:351` | Trigger or internal helper | Trigger `cv_on_ban` on auth.users | - | Revokes CVs on a ban. |
| `private.cv_on_delete` | `20261009000000_cv_control.sql:370` | Trigger or internal helper | Trigger `cv_on_delete` on auth.users | - |  |
| `private.recruit_on_user_delete` | `20261014000000_recruiter_talent.sql:339` | Trigger or internal helper | Trigger `recruit_on_user_delete` on auth.users | - |  |
| `private.billing_forget_subject` | `20261023000000_billing_core.sql:296` | Trigger or internal helper | Trigger `billing_forget_user` on auth.users | - |  |
| `private.analytics_email_verified` | `20261104000000_analytics.sql:126` | Trigger or internal helper | Triggers `analytics_email_verified_insert`/`_update` on auth.users | - |  |
| `private.analytics_agreement_accepted` | `20261104000000_analytics.sql:140` | Trigger or internal helper | Trigger `agreement_acceptances_analytics` on agreement_acceptances | - |  |
| `private.analytics_forget_user` | `20261104000000_analytics.sql:440` | Trigger or internal helper | Trigger `analytics_forget_user` on auth.users | - |  |
| `private.record_match_claims` | `20261112000001_the_record.sql:1093` | Trigger or internal helper | Triggers `record_match_claims_insert`/`_verified` on auth.users | - | Matches pending Record claims by email. |

## Unclear

Not counted in the 53. All twelve were decided on 2026-11-25 (see `docs/decisions.md`); they stay in this section so the counts above do not move.

| Function | Source | Caller | Reason | Golden |
| --- | --- | --- | --- | --- |
| `public.hook_before_user_created` | `20260927210238_identity.sql:1195` | Supabase Auth before-user-created hook | It exists only because Supabase Auth runs the gate, which points to "Wrapper or plumbing that only existed for Supabase". But it carries real logic the signup handler must keep (role and university parsed from metadata, the OAuth error wording), which points to "Command called by the app". | Skipped: Supabase-only, removed at cutover (decision 2026-11-25). |
| `private.delete_closed_portal_accounts` | `20261110000000_portals_flag.sql:172` | Run by hand once (phase 14) | Called by no app code, trigger or cron, so no bin fits. If production has already run it, it may simply be dropped. That is your call. | Not recorded: not ported; a one-off that has already been applied (decision 2026-11-25). |
| `private.rate_limit` | `20260927210238_identity.sql:428` | SQL: 60 functions in most services; public.rate_limit | One definition (no later migration redefines it), plus its `public.rate_limit` wrapper. Decided 2026-11-25: ported as the current definition. Its golden test is the ordinary one, recorded against this function on the current stack; there is no older version to compare against. Which service or package owns it is still not recorded. | Recorded: `rate-limit.json#private` |
| `public.rate_limit` | `20260927210238_identity.sql:463` | App: lib/security/rate-limit.ts | The public wrapper of `private.rate_limit`; it passes its arguments straight through. | Recorded: `rate-limit.json#public` |
| `private.set_updated_at` | `20260927210238_identity.sql:21` | Triggers on 21 tables, none of them identity tables | Defined in `_identity.sql`, but only other services use it. | Not recorded: copied into each service that needs it (decision 2026-11-25), and no identity table uses it, so each owning service tests its own copy. |
| `private.require_super_admin` | `20261026000000_ops_shell.sql:9` | SQL: grant/revoke_staff_role, ops_reset_mfa, ops_set_config, ops_audit_export and others | Staff-role guards built on `is_staff`, used mostly by other services' staff methods. The sections read do not settle whether they become a role check on the token in `packages/platform`, code in each service's `authorize` module, or an identity method. | Recorded: `require.json#require_super_admin` (called as the owner with the caller's claims, as its security-definer callers run it). |
| `private.require_moderator` | `20260929070000_reports.sql:334` | SQL: 7 trust functions | Same as `require_super_admin`. | Recorded: `require.json#require_moderator` (called as the owner with the caller's claims, as its security-definer callers run it). |
| `private.require_trust_reviewer` | `20261003000000_credentials.sql:296` | SQL: 28 functions | Same as `require_super_admin`. | Recorded: `require.json#require_trust_reviewer` (called as the owner with the caller's claims, as its security-definer callers run it). |
| `private.require_accounts` | `20261005000000_ranking.sql:1631` | SQL: 46 functions | Same as `require_super_admin`. | Recorded: `require.json#require_accounts` (called as the owner with the caller's claims, as its security-definer callers run it). |
| `private.require_any_staff` | `20261010000000_student_portal.sql:887` | SQL: 23 functions | Same as `require_super_admin`. | Recorded: `require.json#require_any_staff` (called as the owner with the caller's claims, as its security-definer callers run it). |
| `private.require_accounts_or_admin` | `20261012000000_teacher_portal.sql:731` | SQL: ops_universities, teacher_requests | Same as `require_super_admin`. | Recorded: `require.json#require_accounts_or_admin` (called as the owner with the caller's claims, as its security-definer callers run it). |
| `private.require_appeal_decider` | `20261027000000_sanctions_appeals.sql:708` | SQL: claim_appeal, decide_appeal | Same as `require_super_admin`. | Recorded: `require.json#require_appeal_decider` (called as the owner with the caller's claims, as its security-definer callers run it). |

## Defined in `_identity.sql`, owned by `people` (W2)

No bins assigned here; W2 assigns them.

| Function | Source |
| --- | --- |
| `private.reserved_usernames` | `20260927210238_identity.sql:44` |
| `private.sync_hec_universities` | `20260927210238_identity.sql:152` |
| `private.sync_public_card` | `20260927210238_identity.sql:298` |
| `private.is_friend_of` | `20260928230000_friends_blocks.sql:97` |
| `private.is_blocked_with` | `20260928230000_friends_blocks.sql:111` |
| `private.current_university_id` | `20260927210238_identity.sql:341` |
| `private.get_profile_card` | `20260929070000_reports.sql:586` |
| `public.get_profile_card` | `20260929070000_reports.sql:601` |
| `private.complete_onboarding` | `20260927210238_identity.sql:981` |
| `public.complete_onboarding` | `20260927210238_identity.sql:1013` |
| `private.set_my_university` | `20260927210238_identity.sql:1027` |
| `public.set_my_university` | `20260927210238_identity.sql:1054` |
| `private.username_available` | `20260927210238_identity.sql:1068` |
| `public.username_available` | `20260927210238_identity.sql:1094` |

## Not verified, and what each gap means

Two kinds of concern:

- **Port order**: another service reads or writes identity data directly today. W1 must ship an identity query method, command or event first, and that service's port must use it. It changes the order of work, not the expected results.
- **Golden test**: identity values appear in the recorded output, or the logic has no SQL function to record. Golden fixtures must seed the same identity rows, and the port must return byte-identical values (for example the same email casing).

### 1. Other services' functions that read or write identity tables (44)

All 44 are port-order concerns. 14 also put identity values in their output (golden test). 4 write identity data and need an identity command, not a query. On the new stack each read should be a batch method (CLAUDE.md: no service-to-service call inside a loop).

| Function | Source | Identity data used | Concern |
| --- | --- | --- | --- |
| `private.accept_org_invite` | `20261013000000_recruiter_orgs.sql:772` | email to match the invite; `aal` from the token | Port order |
| `private.accept_uni_invite` | `20261017000000_uni_core.sql:966` | email to match the invite; `aal` from the token | Port order |
| `private.answer_survey` | `20260929030000_micro_survey.sql:483` | account age (`auth.users.created_at`) | Port order |
| `private.apply_org_limits` | `20261024000000_billing_lifecycle.sql:765` | `last_sign_in_at` orders who keeps a seat | Port order |
| `private.award_badge` | `20261018000000_uni_ecosphere.sql:735` | finds a student by email | Port order |
| `private.bill_to` | `20261024000000_billing_lifecycle.sql:646` | email on the invoice | Port order + golden test |
| `private.check_in_email` | `20261111000002_society_events.sql:1715` | finds an account by email | Port order |
| `private.claim_record_entries` | `20261112000001_the_record.sql:1138` | confirmed email, hashed | Port order |
| `private.code_check_snippet_access` | `20261012000000_teacher_portal.sql:2387` | `staff_roles` (trust reviewer, super admin) | Port order |
| `private.complete_github_link` | `20260927224500_github_connect.sql:517` | writes a security event | Port order (needs an identity command). Recorded: `github.json#complete_github_link`, `github.json#complete_github_link_relink`. |
| `private.create_organization` | `20261013000000_recruiter_orgs.sql:477` | email domain | Port order |
| `private.cv_eligible` | `20261008000000_verified_cv.sql:133` | `banned_until` | Port order |
| `private.cv_snapshot_base` | `20261109000000_cv_recruiter_layout.sql:8` | email printed on the signed CV when `show_email` is on | Port order + golden test |
| `private.disconnect_github` | `20260927224500_github_connect.sql:649` | writes a security event | Port order (needs an identity command). Recorded: `github.json#disconnect_github`. |
| `private.import_faculty_csv` | `20261012000000_teacher_portal.sql:681` | matches CSV rows by email | Port order |
| `private.invite_org_member` | `20261013000000_recruiter_orgs.sql:664` | personal email domains; existing members by email | Port order |
| `private.invite_uni_admin` | `20261017000000_uni_core.sql:853` | existing seats by email | Port order |
| `private.issue_event_record` | `20261112000001_the_record.sql:432` | finds an account by confirmed email | Port order |
| `private.lift_sanction_row` | `20261027000000_sanctions_appeals.sql:309` | lifts a ban | Port order (needs an identity command) |
| `private.my_org_invites` | `20261013000000_recruiter_orgs.sql:748` | own email to match invites | Port order |
| `private.my_uni_invites` | `20261017000000_uni_core.sql:941` | own email to match invites | Port order |
| `private.ops_add_uni_domain` | `20261030000000_ops_wrapup.sql:379` | personal email domains | Port order |
| `private.ops_appeals` | `20261027000000_sanctions_appeals.sql:729` | `staff_roles` decide the `stuck` flag | Port order + golden test |
| `private.ops_assign_uni_owner` | `20261030000000_ops_wrapup.sql:334` | account by email; verified TOTP factor | Port order |
| `private.ops_find_account` | `20261027000000_sanctions_appeals.sql:407` | email in the result | Port order + golden test |
| `private.ops_org_case` | `20261013000000_recruiter_orgs.sql:917` | member emails in the result | Port order + golden test |
| `private.ops_uni_claim` | `20261017000000_uni_core.sql:1521` | email and two-factor status in the result | Port order + golden test |
| `private.ops_uni_queue` | `20261017000000_uni_core.sql:1484` | emails in the result | Port order + golden test |
| `private.ops_uni_record` | `20261030000000_ops_wrapup.sql:288` | admin emails in the result | Port order + golden test |
| `private.ops_user_record` | `20261028000000_users_view_as.sql:53` | email, created, last sign-in, ban, two-factor, backup codes, staff roles in the result | Port order + golden test |
| `private.ops_user_search` | `20261028000000_users_view_as.sql:17` | email and created date in the result | Port order + golden test |
| `private.org_members_list` | `20261013000000_recruiter_orgs.sql:634` | member emails in the result | Port order + golden test |
| `private.record_claim_email` | `20261112000001_the_record.sql:1181` | checks no account has the email | Port order |
| `private.record_waiting_count` | `20261112000001_the_record.sql:1114` | confirmed email, hashed | Port order |
| `private.refuse_public_university_domain` | `20261017000000_uni_core.sql:89` | personal email domains (trigger on `university_domains`) | Port order |
| `private.request_teacher_role` | `20261012000000_teacher_portal.sql:560` | own email against the faculty CSV | Port order |
| `private.request_uni_domain` | `20261017000000_uni_core.sql:1118` | personal email domains | Port order |
| `private.request_university` | `20261031000000_marketing.sql:120` | personal email domains | Port order |
| `private.sanction_user` | `20261027000000_sanctions_appeals.sql:167` | signs the user out everywhere and bans | Port order (needs an identity command) |
| `private.sanctions_role_limits` | `20261027000000_sanctions_appeals.sql:38` | `staff_roles` (super admin may ban) | Port order |
| `private.submit_uni_claim` | `20261017000000_uni_core.sql:735` | own email domain; `aal` from the token | Port order |
| `private.teacher_requests` | `20261012000000_teacher_portal.sql:748` | emails in the result | Port order + golden test |
| `private.uni_admins_list` | `20261017000000_uni_core.sql:819` | emails in the result | Port order + golden test |
| `private.uni_teachers` | `20261017000000_uni_core.sql:1358` | emails in the result | Port order + golden test |

### 2. Functions that reach identity only through an identity function (27)

The first pass did not list these. They call one of the 53 (mostly `is_staff`) and touch no identity table themselves. All are port-order concerns: the call becomes a role claim on the token or an identity method. None returns identity values.

| Function | Source | Calls | Concern |
| --- | --- | --- | --- |
| `private.accept_fair_invite` | `20261020000000_uni_fairs.sql:587` | `private.email_domain` | Port order |
| `private.approve_teacher` | `20261012000000_teacher_portal.sql:609` | `private.is_staff` | Port order |
| `private.can_see_society` | `20261111000001_societies.sql:436` | `private.is_staff` | Port order |
| `private.create_post` | `20261111000001_societies.sql:1537` | `private.is_staff` | Port order |
| `private.invite_fair_company` | `20261020000000_uni_fairs.sql:535` | `private.email_domain`, `private.is_recruiter_domain` | Port order |
| `private.invoice_document` | `20261024000000_billing_lifecycle.sql:2247` | `private.is_staff` | Port order |
| `private.lift_sanction` | `20261027000000_sanctions_appeals.sql:340` | `private.is_staff` | Port order |
| `private.may_use_simulated` | `20261025000000_billing_ops.sql:859` | `private.is_staff` | Port order |
| `private.openings_categories` | `20261114000001_openings.sql:80` | `private.portal_enabled` | Port order |
| `private.ops_appeal_case` | `20261027000000_sanctions_appeals.sql:757` | `private.is_staff` | Port order |
| `private.ops_batches` | `20261010000000_student_portal.sql:184` | `private.is_staff` | Port order |
| `private.ops_inbox` | `20261111000001_societies.sql:2013` | `private.is_staff` | Port order |
| `private.ops_org_reputation` | `20261016000000_recruiter_api.sql:565` | `private.is_staff` | Port order |
| `private.ops_proof_tasks` | `20261113000001_paths_tasks.sql:1263` | `private.is_staff` | Port order |
| `private.ops_record_entry` | `20261112000001_the_record.sql:1324` | `private.is_staff` | Port order |
| `private.ops_sanctions` | `20261027000000_sanctions_appeals.sql:375` | `private.is_staff` | Port order |
| `private.ops_set_final_year_batch` | `20261010000000_student_portal.sql:208` | `private.is_staff` | Port order |
| `private.ops_university_hides` | `20261019000000_uni_comms.sql:1036` | `private.is_staff` | Port order |
| `private.org_doc_readable` | `20261030000000_ops_wrapup.sql:158` | `private.is_staff` | Port order |
| `private.org_response_stats` | `20261016000000_recruiter_api.sql:540` | `private.is_staff` | Port order |
| `private.receipt_readable` | `20261111000003_paid_tickets.sql:142` | `private.is_staff` | Port order |
| `private.review_flag_details` | `20260928150000_github_evidence.sql:723` | `private.is_staff` | Port order |
| `private.revoke_record_entry` | `20261112000001_the_record.sql:787` | `private.is_staff` | Port order |
| `private.revoke_teacher` | `20261012000000_teacher_portal.sql:642` | `private.is_staff` | Port order |
| `private.society_doc_readable` | `20261111000001_societies.sql:257` | `private.is_staff` | Port order |
| `private.storage_usage` | `20261003000000_credentials.sql:617` | `private.is_staff` | Port order |
| `private.submit_sales_lead` | `20261110000000_portals_flag.sql:251` | `private.email_domain` | Port order |

### 3. Row-level security policies that call identity functions (17)

Policies are not functions, so the function checks did not cover them. Each moves into the owning service's `authorize` module and needs the staff role or agreement version from identity. All are port-order concerns.

| Policy | Table | Source | Concern |
| --- | --- | --- | --- |
| `staff_roles_read` | `public.staff_roles` | `20260927210238_identity.sql:231` | Port order |
| `job_runs_staff_read` | `public.job_runs` | `20260927210238_identity.sql:249` | Port order |
| `agreement_acceptances_accept_current` | `public.agreement_acceptances` | `20260927210238_identity.sql:879` | Port order |
| `github_link_clashes_read_trust` | `public.github_link_clashes` | `20260927224500_github_connect.sql:228` | Port order |
| `review_flags_read` | `public.review_flags` | `20260928150000_github_evidence.sql:280` | Port order |
| `ops_audit_log_read` | `public.ops_audit_log` | `20260928230000_friends_blocks.sql:187` | Port order |
| `platform_config_staff_read` | `public.platform_config` | `20260929030000_micro_survey.sql:53` | Port order |
| `report_cases_staff_read` | `public.report_cases` | `20260929070000_reports.sql:94` | Port order |
| `reports_staff_read` | `public.reports` | `20260929070000_reports.sql:96` | Port order |
| `report_messages_staff_read` | `public.report_messages` | `20260929070000_reports.sql:98` | Port order |
| `sanctions_read` | `public.sanctions` | `20260929070000_reports.sql:100` | Port order |
| `credentials_files_read` | `storage.objects` | `20261003000000_credentials.sql:137` | Port order |
| `exam_periods_read` | `public.exam_periods` | `20261005000000_ranking.sql:255` | Port order |
| `feedback_files_read` | `storage.objects` | `20261010000000_student_portal.sql:855` | Port order |
| `university_claims_files_read` | `storage.objects` | `20261017000000_uni_core.sql:348` | Port order |
| `appeals_read` | `public.appeals` | `20261027000000_sanctions_appeals.sql:524` | Port order |
| `config_keys_staff_read` | `public.config_keys` | `20261029000000_config_metrics.sql:32` | Port order |

### 4. Dynamic SQL (3)

Closed. Three functions build SQL at run time. None of them can reach an identity table, so nothing is missing.

| Function | Source | What it builds | Concern |
| --- | --- | --- | --- |
| `private.bump_stat` | `20260929030000_micro_survey.sql:198` | a column name in `post_stats` | None |
| `private.alert_conditions` | `20261123000000_job_alert_fixes.sql:120` | a `pgmq` queue table name | None |
| `private.wake_workers` | `20261115000000_cron_load.sql:58` | a `private.wake_*_worker()` call | None |

### 5. App call sites, found by text search (42)

Callers were found by searching `apps/web` for `rpc("…")`, `from("…")` and the function names passed to the action helpers; nothing was run. These are the places golden inputs are taken from, so all are golden-test concerns. The direct table accesses (`kind = table`) have no SQL function at all: W1 needs a query method or command for each, and its golden test is recorded through the app path. A call made through a helper that builds the name at run time would not be found.

| Source (apps/web) | Function or table | Kind | Concern |
| --- | --- | --- | --- |
| `app/(app)/agreement/page.tsx:19` | `agreement_acceptances` | table | Golden test (no SQL function) |
| `app/(app)/feed/page.tsx:66` | `is_staff` | rpc | Golden test |
| `app/(app)/settings/security/page.tsx:37` | `mfa_backup_codes_remaining` | rpc | Golden test |
| `app/(app)/settings/security/page.tsx:38` | `security_events` | table | Golden test (no SQL function) |
| `app/api/ops/pdf-check/route.ts:56` | `is_staff` | rpc | Golden test |
| `app/auth/callback/route.ts:56` | `my_gate_state` | rpc | Golden test |
| `app/auth/callback/route.ts:68` | `agreement_acceptances` | table | Golden test (no SQL function) |
| `lib/actions/account.ts:30` | `request_account_deletion` | rpc | Golden test |
| `lib/actions/account.ts:40` | `cancel_account_deletion` | rpc | Golden test |
| `lib/actions/agreement.ts:32` | `agreement_acceptances` | table | Golden test (no SQL function) |
| `lib/actions/agreement.ts:43` | `my_gate_state` | rpc | Golden test |
| `lib/actions/auth.ts:70` | `my_gate_state` | rpc | Golden test |
| `lib/actions/auth.ts:105` | `agreement_versions` | table | Golden test (no SQL function) |
| `lib/actions/auth.ts:157` | `personal_email_domains` | table | Golden test (no SQL function) |
| `lib/actions/auth.ts:283` | `personal_email_domains` | table | Golden test (no SQL function) |
| `lib/actions/auth.ts:452` | `signin_status` | rpc | Golden test |
| `lib/actions/auth.ts:491` | `signin_failed` | rpc | Golden test |
| `lib/actions/auth.ts:753` | `log_security_event` | rpc | Golden test |
| `lib/actions/auth.ts:809` | `log_security_event` | rpc | Golden test |
| `lib/actions/auth.ts:839` | `log_security_event` | rpc | Golden test |
| `lib/actions/auth.ts:861` | `security_not_me` | rpc | Golden test |
| `lib/actions/mfa.ts:107` | `log_security_event` | rpc | Golden test |
| `lib/actions/mfa.ts:111` | `create_mfa_backup_codes` | rpc | Golden test |
| `lib/actions/mfa.ts:134` | `create_mfa_backup_codes` | rpc | Golden test |
| `lib/actions/mfa.ts:166` | `log_security_event` | rpc | Golden test |
| `lib/actions/mfa.ts:170` | `delete_mfa_backup_codes` | rpc | Golden test |
| `lib/actions/mfa.ts:216` | `my_gate_state` | rpc | Golden test |
| `lib/actions/mfa.ts:251` | `use_mfa_backup_code` | rpc | Golden test |
| `lib/actions/ops/staff.ts:32` | `grant_staff_role` | rpc | Golden test |
| `lib/actions/ops/staff.ts:51` | `revoke_staff_role` | rpc | Golden test |
| `lib/actions/ops/users.ts:74` | `ops_reset_mfa` | rpc | Golden test |
| `lib/auth/sign-in-record.ts:51` | `record_sign_in` | rpc | Golden test |
| `lib/data/agreement.ts:15` | `agreement_versions` | table | Golden test (no SQL function) |
| `lib/data/marketing.ts:28` | `my_gate_state` | rpc | Golden test |
| `lib/data/ops-shell.ts:93` | `ops_staff` | rpc | Golden test |
| `lib/data/ops-trust.ts:19` | `is_staff` | rpc | Golden test |
| `lib/data/ops-trust.ts:25` | `staff_roles` | table | Golden test (no SQL function) |
| `lib/data/ops.ts:22` | `is_staff` | rpc | Golden test |
| `lib/data/portals.ts:14` | `portals_state` | rpc | Golden test |
| `lib/data/universities.ts:19` | `personal_email_domains` | table | Golden test (no SQL function) |
| `proxy.ts:64` | `my_gate_state` | rpc | Golden test |
| `proxy.ts:73` | `portals_state` | rpc | Golden test |

### 6. Password change and agreement acceptance

Neither has a SQL function, so there is nothing to bin and no SQL output to record.

**Password change** lives in the app action `changePassword` (`apps/web/lib/actions/auth.ts:768`) and in Supabase Auth:

- Zod `changeSchema` (`auth.ts:763`): current password present, new password passes `passwordSchema` (`lib/auth/password.ts:7`), confirm matches, new differs from current.
- `rate_limit` scope `password_change`, 5 per 15 minutes (`auth.ts:783`).
- Current password checked with `signInWithPassword` on a separate cookie-less client (`auth.ts:788`).
- Breached-password check `isBreachedPassword` (HIBP; `auth.ts:795`).
- `supabase.auth.updateUser({ password })` (`auth.ts:799`). Supabase Auth hashes and stores it and enforces `minimum_password_length = 10` (`supabase/config.toml:182`); its `same_password` and `weak_password` codes map to our wording.
- `signOut({ scope: "others" })` ends every other session (`auth.ts:808`), then `log_security_event` writes `password_changed` (`auth.ts:809`).

The golden test records the action's results instead of SQL output: the `ActionResult` code for each refusal (`invalid_input`, `rate_limited`, `wrong_password`, `breached_password`, `same_password`, `weak_password`) and for success; the effects (old password fails and new one signs in, other sessions revoked, the current one kept, exactly one `password_changed` row in `security_events`). Hash bytes are not comparable across stacks; "imported hashes verify" in the W1 row is a separate check.

**Agreement acceptance** is a direct table write from the app, checked by RLS:

- `acceptAgreement` (`apps/web/lib/actions/agreement.ts:12`) inserts into `agreement_acceptances` (`agreement.ts:32`) and treats `23505` (already accepted) as success. The Google path in `app/auth/callback/route.ts:68` inserts the same row when "I agree" was ticked before sign-up.
- RLS policy `agreement_acceptances_accept_current` (`_identity.sql:879`) allows only your own `user_id` and only `version = private.current_agreement_version()`. Column grants (`_identity.sql:876`) limit the insert to `user_id`, `version`, `ip_hash`.
- Sign-up by email writes the row in `handle_new_user`; the trigger `agreement_acceptances_analytics` then sends the analytics event.

The golden test records the outcomes: own row at the current version accepted (one row); stale version refused (the RLS failure the action reports as `stale_version`); someone else's `user_id` refused; a repeat accepted with no second row; and `my_gate_state.agreement_accepted` before and after.

## Checks against the code

- Every function row names a function that exists in the migrations: **131 / 131** (4 are generated wrappers, confirmed in the `pg_temp.expose` name lists).
- Every migration function that touches an identity table (its latest body names one, or it runs as a trigger on one) has a row: **80 / 80** (36 in the identity, trigger, unclear and people sections, 44 in section 1 above).
- Every `file:line` in the sheet points at the definition it names: **220 / 220** rows checked. Function rows must hit their `create function` line, generated wrappers their `pg_temp.expose(array[` call with the name in its list, policies their `create policy` line, and app sites a line containing the name.
- How it was checked: a parser over all 83 migrations (dollar-quoted bodies, `create trigger`, `cron.schedule`, `create policy`), latest definition per name, table names matched against every `create table`. Run 2026-11-25.
