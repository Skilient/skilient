-- work's settings (platform_config today; config_keys held their schemas): limits for credentials, endorsements,
-- code checks, proof tasks and skill swaps, the AI agents GitHub commits are matched against, and the paths seed
-- (= apps/web/lib/github/taxonomy/paths.yaml). Values copied from the current stack. Staff change them through
-- trust's /ops config (W10) by an event, or by a new migration. Forward-only.
create table work.config (
  key text primary key check (key ~ '^[a-z_]+\.[a-z_]+$'),
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table work.config enable row level security;
alter table work.config force row level security;
create policy config_owner on work.config for all to svc_work using (true) with check (true);
grant select, insert, update, delete on work.config to svc_work;

insert into work.config (key, value) values
  ('code_check.limits', '{"minutes":10,"due_hours":72,"max_lines":40,"min_lines":20,"answer_max":2000,"pass_parts":3,"ready_days":7,"retry_days":30,"grace_seconds":30}'::jsonb),
  ('credential.limits', '{"max_active":20,"max_pending":5,"max_pdf_bytes":5242880,"rejected_file_days":30}'::jsonb),
  ('endorsements.limits', '{"per_month":20,"peer_verified_min":2,"per_teammate_per_venture":5}'::jsonb),
  ('github.ai_agents', '[{"name":"Claude","match":"noreply@anthropic.com"},{"name":"Claude","match":"claude[bot]"},{"name":"Claude","match":"claude"},{"name":"GitHub Copilot","match":"copilot-swe-agent[bot]"},{"name":"GitHub Copilot","match":"198982749+copilot@users.noreply.github.com"},{"name":"Devin","match":"devin-ai-integration[bot]"},{"name":"Cursor","match":"cursoragent@cursor.com"},{"name":"Codex","match":"codex@openai.com"},{"name":"Codex","match":"chatgpt-codex-connector[bot]"}]'::jsonb),
  ('paths.seed', '{"roles":[{"name":"Frontend","role":"frontend","skills":["html","css","javascript","typescript","react","tailwindcss","redux","tanstack-query","nextjs","vitest","playwright"],"pictogram":"browser"},{"name":"Backend","role":"backend","skills":["javascript","nodejs","express","sql","postgresql","typescript","nestjs","redis","docker","automated-testing","api-documentation"],"pictogram":"database"},{"name":"Mobile","role":"mobile","skills":["dart","flutter","firebase","kotlin","android","jetpack-compose","swift","swiftui","ios","react-native","expo"],"pictogram":"device-mobile"},{"name":"Data","role":"data","skills":["python","sql","pandas","numpy","jupyter","matplotlib","seaborn","scipy","plotly","postgresql"],"pictogram":"chart-line"},{"name":"Machine learning","role":"machine-learning","skills":["python","numpy","pandas","jupyter","matplotlib","scikit-learn","tensorflow","pytorch","keras","opencv","hugging-face-transformers"],"pictogram":"brain"},{"name":"DevOps","role":"devops","skills":["shell","docker","docker-compose","github-actions","continuous-integration","nginx","kubernetes","terraform","ansible","aws","helm"],"pictogram":"cloud"},{"name":"UI/UX","role":"ui-ux","skills":["html","css","javascript","tailwindcss","bootstrap","react","material-ui","storybook","d3","threejs"],"pictogram":"pen-nib"},{"name":"Product","role":"product","skills":["javascript","typescript","react","nextjs","nodejs","postgresql","supabase","vercel","automated-testing","api-documentation"],"pictogram":"compass"}],"min_tier":"shine","min_share":0.6,"max_follows":2,"min_seniors":10}'::jsonb),
  ('swaps.limits', '{"ring_days":30,"rapid_hours":24,"request_days":7,"inactive_days":30,"open_requests":5,"rapid_confirms":3,"pair_week_minutes":600,"upcoming_sessions":3}'::jsonb),
  ('tasks.limits', '{"peers":3,"active":3,"reoffer_days":7,"reviews_week":5,"github_wait_minutes":30}'::jsonb);
