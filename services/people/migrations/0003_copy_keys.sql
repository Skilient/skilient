-- people: the copy tables' key check allowed no digits, so work's `skills.l2` milestone (W5) failed it and rolled
-- back people's copies batch with it (found by ranking's contract test, W6). Keys may hold digits after the first
-- letter. Forward-only.

alter table people.shell_counts drop constraint shell_counts_key_check;
alter table people.shell_counts add constraint shell_counts_key_check check (key ~ '^[a-z][a-z0-9_.]{1,60}$');
alter table people.shell_facts drop constraint shell_facts_key_check;
alter table people.shell_facts add constraint shell_facts_key_check check (key ~ '^[a-z][a-z0-9_.]{1,60}$');
alter table people.fact_values drop constraint fact_values_key_check;
alter table people.fact_values add constraint fact_values_key_check check (key ~ '^[a-z][a-z0-9_.]{1,60}$');
