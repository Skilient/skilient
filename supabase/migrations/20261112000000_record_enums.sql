-- Phase 16 (PRD 5.30, The Record): enum values used by the next migration. Added in their own
-- migration so the values are committed before anything uses them.
alter type public.appeal_decision_type add value if not exists 'record_revocation';
alter type public.report_target add value if not exists 'record_entry';
