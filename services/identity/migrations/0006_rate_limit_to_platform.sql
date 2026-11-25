-- rate_limit moved to packages/platform (`platform.rate_limit_events`, per service role) (decision 2026-11-25,
-- Q12). Identity's own table is no longer written. Forward-only.
drop table identity.rate_limit_events;
