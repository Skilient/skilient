-- Phase 15 (PRD 5.31): enum values the societies and events migrations use. Added in their own
-- migration because a value added to an existing enum can't be used in the same transaction.
alter type public.report_target add value if not exists 'society';
alter type public.report_target add value if not exists 'event';
alter type public.report_target add value if not exists 'event_registration';
alter type public.uni_event_type add value if not exists 'social';
alter type public.uni_event_type add value if not exists 'volunteering';
