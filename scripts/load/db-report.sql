-- After a load run (docs/load-test.md): the PRD 10 database budgets from pg_stat_statements.
-- feed_page ≤ 150 ms and every other read ≤ 50 ms in the database; any statement over 100 ms
-- (mean plus two standard deviations, as a p95 stand-in) gets a ticket. Run it with psql against the
-- scratch project right after the run; `select pg_stat_statements_reset()` is run before each run.
\pset footer off
\echo 'Statements by total time (top 25)'
select left(regexp_replace(query, '\s+', ' ', 'g'), 110) as statement,
       calls,
       round(mean_exec_time::numeric, 1) as mean_ms,
       round((mean_exec_time + 2 * stddev_exec_time)::numeric, 1) as approx_p95_ms,
       round(max_exec_time::numeric, 1) as max_ms,
       round(total_exec_time::numeric / 1000, 1) as total_s
  from extensions.pg_stat_statements
 where calls > 10
 order by total_exec_time desc
 limit 25;

\echo 'Over budget (feed_page > 150 ms mean, other RPCs > 50 ms mean, anything > 100 ms approx p95)'
select left(regexp_replace(query, '\s+', ' ', 'g'), 110) as statement,
       calls,
       round(mean_exec_time::numeric, 1) as mean_ms,
       round((mean_exec_time + 2 * stddev_exec_time)::numeric, 1) as approx_p95_ms,
       case
         when query ilike '%feed_page%' and mean_exec_time > 150 then 'feed_page over 150 ms'
         when query ilike '%public.%(%' and query not ilike '%feed_page%' and mean_exec_time > 50 then 'read over 50 ms'
         when mean_exec_time + 2 * stddev_exec_time > 100 then 'over 100 ms p95: ticket'
       end as budget
  from extensions.pg_stat_statements
 where calls > 10
   and (mean_exec_time + 2 * stddev_exec_time > 100
        or (query ilike '%feed_page%' and mean_exec_time > 150)
        or (query ilike '%public.%(%' and mean_exec_time > 50))
 order by mean_exec_time desc;

\echo 'Connections at the end of the run (PRD 10 alert: above 80% of the limit)'
select count(*) as connections, current_setting('max_connections')::int as max_connections from pg_stat_activity;
