-- Phase 17 (PRD 5.32, Growth): enum values used by the next migrations. Added in their own
-- migration so the values are committed before anything uses them.
alter type public.report_target add value if not exists 'swap';
alter type public.anti_gaming_kind add value if not exists 'swap_ring';
alter type public.anti_gaming_kind add value if not exists 'swap_repeat';
