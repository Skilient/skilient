-- Phase 18 (PRD 5.33, 5.34, Community): enum values used by the next migrations. Added in their
-- own migration so the values are committed before anything uses them.
alter type public.report_target add value if not exists 'yearbook_page';
alter type public.report_target add value if not exists 'yearbook_note';
