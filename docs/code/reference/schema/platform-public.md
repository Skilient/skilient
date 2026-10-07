Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# platform-public

## enum: public.account_role

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "student",
    "faculty",
    "recruiter",
    "university_admin"
  ]
}
```

## enum: public.account_status

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "active",
    "graduate",
    "deleting"
  ]
}
```

## enum: public.anti_gaming_kind

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "ring",
    "rapid_gain"
  ]
}
```

## enum: public.appeal_decision_type

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "sanction",
    "report_case",
    "cv_revocation",
    "credential",
    "code_check"
  ]
}
```

## enum: public.appeal_status

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "pending",
    "upheld",
    "overturned"
  ]
}
```

## enum: public.application_stage

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "applied",
    "screening",
    "interview",
    "offer",
    "hired",
    "rejected",
    "withdrawn"
  ]
}
```

## enum: public.application_status

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "pending",
    "accepted",
    "declined",
    "withdrawn",
    "closed"
  ]
}
```

## enum: public.billing_subject

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "user",
    "org",
    "university"
  ]
}
```

## enum: public.chat_thread_type

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "dm",
    "group"
  ]
}
```

## enum: public.code_check_status

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "preparing",
    "ready",
    "in_progress",
    "submitted",
    "passed",
    "failed",
    "unavailable",
    "expired"
  ]
}
```

## enum: public.competition_status

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "draft",
    "in_review",
    "rejected",
    "approved",
    "live",
    "frozen",
    "judged"
  ]
}
```

## enum: public.contact_status

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "pending",
    "accepted",
    "declined",
    "expired"
  ]
}
```

## enum: public.contribution_kind

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "code",
    "design",
    "research",
    "docs",
    "management",
    "other"
  ]
}
```

## enum: public.contribution_source

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "manual",
    "github"
  ]
}
```

## enum: public.credential_status

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "pending",
    "approved",
    "rejected",
    "expired"
  ]
}
```

## enum: public.cv_visibility

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "private",
    "link",
    "recruiters"
  ]
}
```

## enum: public.domain_kind

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "student",
    "faculty",
    "both"
  ]
}
```

## enum: public.email_channel

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "instant_email",
    "digest",
    "off"
  ]
}
```

## enum: public.entitlement_kind

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "bool",
    "int",
    "limit",
    "enum"
  ]
}
```

## enum: public.fair_queue_status

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "waiting",
    "called",
    "talking",
    "done",
    "skipped",
    "left"
  ]
}
```

## enum: public.fair_status

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "draft",
    "published",
    "cancelled"
  ]
}
```

## enum: public.feedback_status

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "received",
    "reviewing",
    "planned",
    "shipped",
    "wont_do"
  ]
}
```

## enum: public.feedback_type

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "bug",
    "idea",
    "confusing",
    "praise"
  ]
}
```

## enum: public.friend_request_status

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "pending",
    "accepted",
    "declined"
  ]
}
```

## enum: public.github_commit_status

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "pending",
    "counted",
    "held",
    "excluded"
  ]
}
```

## enum: public.github_repo_kind

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "owned",
    "collaborator",
    "fork",
    "template"
  ]
}
```

## enum: public.grant_source

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "plan",
    "add_on",
    "sponsorship",
    "trial",
    "admin"
  ]
}
```

## enum: public.idea_audience

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "university",
    "global"
  ]
}
```

## enum: public.idea_difficulty

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "intro",
    "intermediate",
    "advanced"
  ]
}
```

## enum: public.idea_status

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "open",
    "closed"
  ]
}
```

## enum: public.job_run_status

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "running",
    "succeeded",
    "failed"
  ]
}
```

## enum: public.job_status

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "draft",
    "live",
    "closed",
    "paused"
  ]
}
```

## enum: public.looking_for_option

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "internship",
    "job",
    "teammates",
    "project",
    "mentorship"
  ]
}
```

## enum: public.org_role

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "admin",
    "recruiter",
    "billing"
  ]
}
```

## enum: public.org_status

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "pending",
    "verified",
    "suspended",
    "rejected"
  ]
}
```

## enum: public.post_audience

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "university",
    "global"
  ]
}
```

## enum: public.post_stage

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "seed",
    "limited",
    "full",
    "global_boost",
    "demoted",
    "held"
  ]
}
```

## enum: public.post_type

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "general",
    "invite",
    "announcement",
    "event",
    "poll",
    "shipped"
  ]
}
```

## enum: public.profile_visibility

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "friends",
    "university",
    "global"
  ]
}
```

## enum: public.ranking_adjustment_kind

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "penalty",
    "rapid_gain"
  ]
}
```

## enum: public.ranking_tier

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "raw",
    "spark",
    "flare",
    "shine",
    "radiant",
    "luminary"
  ]
}
```

## enum: public.report_case_status

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "open",
    "dismissed",
    "removed",
    "warned"
  ]
}
```

## enum: public.report_reason

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "spam",
    "harassment",
    "inappropriate",
    "misinformation",
    "impersonation",
    "other"
  ]
}
```

## enum: public.report_target

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "post",
    "comment",
    "message",
    "profile",
    "venture"
  ]
}
```

## enum: public.review_flag_kind

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "burst",
    "backdating",
    "cross_account_duplicate"
  ]
}
```

## enum: public.review_flag_status

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "open",
    "cleared",
    "upheld"
  ]
}
```

## enum: public.review_request_status

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "open",
    "submitted",
    "declined",
    "expired",
    "cancelled"
  ]
}
```

## enum: public.rsvp_status

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "going",
    "interested"
  ]
}
```

## enum: public.sales_lead_status

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "new",
    "contacted",
    "won",
    "lost"
  ]
}
```

## enum: public.sanction_kind

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "warn",
    "suspend",
    "ban",
    "throttle"
  ]
}
```

## enum: public.skill_category

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "language",
    "framework",
    "library",
    "tool",
    "platform",
    "practice"
  ]
}
```

## enum: public.staff_role

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "moderator",
    "trust_reviewer",
    "accounts",
    "super_admin"
  ]
}
```

## enum: public.subscription_status

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "trialing",
    "active",
    "past_due",
    "expired",
    "cancelled"
  ]
}
```

## enum: public.supervisor_status

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "invited",
    "active",
    "ended"
  ]
}
```

## enum: public.sync_status

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "queued",
    "running",
    "done",
    "failed",
    "cancelled"
  ]
}
```

## enum: public.teacher_status

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "pending",
    "approved",
    "revoked"
  ]
}
```

## enum: public.uni_admin_role

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "owner",
    "admin",
    "career",
    "coordinator",
    "comms"
  ]
}
```

## enum: public.uni_event_scope

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "university",
    "global"
  ]
}
```

## enum: public.uni_event_type

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "talk",
    "workshop",
    "hackathon",
    "competition",
    "other"
  ]
}
```

## enum: public.uni_hide_status

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "hidden",
    "restored",
    "removed"
  ]
}
```

## enum: public.uni_request_status

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "pending",
    "approved",
    "rejected"
  ]
}
```

## enum: public.venture_invite_status

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "pending",
    "accepted",
    "declined",
    "revoked"
  ]
}
```

## enum: public.venture_stage

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "idea",
    "prototype",
    "launched",
    "revenue"
  ]
}
```

## enum: public.venture_status

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "recruiting",
    "in_progress",
    "completed",
    "abandoned"
  ]
}
```

## enum: public.venture_team_role

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "lead",
    "developer",
    "designer",
    "researcher",
    "other"
  ]
}
```

## enum: public.venture_type

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "project",
    "startup"
  ]
}
```

## enum: public.venture_visibility

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "public",
    "university",
    "unlisted"
  ]
}
```

## view: public.contributions_with_status

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "options": [
    "security_invoker=true"
  ],
  "definition": " SELECT o.id,\n    o.venture_id,\n    o.user_id,\n    e.id AS current_id,\n    e.kind,\n    e.description,\n    e.evidence_url,\n    e.hours,\n    o.source,\n    o.commit_sha,\n    o.created_at,\n        CASE\n            WHEN e.id <> o.id THEN e.created_at\n            ELSE NULL::timestamp with time zone\n        END AS corrected_at,\n    ( SELECT count(*)::integer AS count\n           FROM contribution_confirmations k\n          WHERE k.contribution_id = e.id) AS confirmations,\n    o.source = 'github'::contribution_source AND NOT o.before_venture OR (EXISTS ( SELECT 1\n           FROM contribution_confirmations k\n          WHERE k.contribution_id = e.id)) AS peer_verified,\n    (EXISTS ( SELECT 1\n           FROM contribution_confirmations k\n          WHERE k.contribution_id = e.id AND k.confirmer_id = (( SELECT auth.uid() AS uid)))) AS confirmed_by_me,\n    (EXISTS ( SELECT 1\n           FROM venture_members m\n          WHERE m.venture_id = o.venture_id AND m.user_id = o.user_id)) AS by_member,\n    o.before_venture,\n    e.skill_ids,\n    (EXISTS ( SELECT 1\n           FROM contribution_confirmations k\n          WHERE k.contribution_id = e.id AND k.confirmer_role = 'supervisor'::text)) AS faculty_confirmed,\n    o.ai_agent\n   FROM contributions o\n     CROSS JOIN LATERAL ( SELECT c.id,\n            c.venture_id,\n            c.user_id,\n            c.kind,\n            c.description,\n            c.evidence_url,\n            c.hours,\n            c.corrects_id,\n            c.source,\n            c.commit_sha,\n            c.created_at,\n            c.before_venture,\n            c.skill_ids\n           FROM contributions c\n          WHERE c.id = o.id OR c.corrects_id = o.id\n          ORDER BY c.created_at DESC, (c.id = o.id)\n         LIMIT 1) e\n  WHERE o.corrects_id IS NULL;"
}
```
