-- work: role paths and who follows them (PRD 5.30), proof tasks with their attempts and peer reviews, and skill
-- swaps (offers, wants, swaps, sessions, thank-you notes). Ported from _paths_tasks.sql and _skill_swap.sql.
-- Generated from the current stack's definitions (enums as checked text). The paths themselves are computed
-- weekly from work.config `paths.seed`; the proof-task bank is Trust staff's. Forward-only.

create table work.paths (
  role text NOT NULL,
  name text NOT NULL,
  pictogram text NOT NULL,
  "position" smallint NOT NULL,
  source text DEFAULT 'starter'::text NOT NULL,
  seniors integer DEFAULT 0 NOT NULL,
  computed_at timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (role),
  CONSTRAINT paths_name_check CHECK (((char_length(btrim(name)) >= 2) AND (char_length(btrim(name)) <= 40))),
  CONSTRAINT paths_pictogram_check CHECK ((pictogram ~ '^[a-z-]{2,30}$'::text)),
  CONSTRAINT paths_position_check CHECK (("position" >= 1)),
  CONSTRAINT paths_role_check CHECK ((role ~ '^[a-z][a-z0-9-]{1,30}$'::text)),
  CONSTRAINT paths_seniors_check CHECK ((seniors >= 0)),
  CONSTRAINT paths_source_check CHECK ((source = ANY (ARRAY['data'::text, 'starter'::text])))
);

create table work.path_skills (
  role text NOT NULL,
  skill_id text NOT NULL,
  "position" smallint NOT NULL,
  after_days integer,
  PRIMARY KEY (role, skill_id),
  FOREIGN KEY (role) REFERENCES work.paths(role) ON DELETE CASCADE,
  FOREIGN KEY (skill_id) REFERENCES work.skills(id),
  CONSTRAINT path_skills_after_days_check CHECK (((after_days IS NULL) OR (after_days >= 0))),
  CONSTRAINT path_skills_position_check CHECK (("position" >= 1))
);
CREATE INDEX path_skills_skill_idx ON work.path_skills (skill_id);

create table work.path_follows (
  user_id uuid NOT NULL,
  role text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (user_id, role),
  FOREIGN KEY (role) REFERENCES work.paths(role) ON DELETE CASCADE
);
CREATE INDEX path_follows_role_idx ON work.path_follows (role);

create table work.proof_tasks (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  skill_id text NOT NULL,
  title text NOT NULL,
  difficulty text NOT NULL,
  brief text NOT NULL,
  checklist jsonb NOT NULL,
  active boolean DEFAULT true NOT NULL,
  author_id uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (skill_id) REFERENCES work.skills(id),
  CONSTRAINT proof_tasks_brief_check CHECK (((char_length(btrim(brief)) >= 40) AND (char_length(btrim(brief)) <= 4000))),
  CONSTRAINT proof_tasks_checklist_check CHECK (((jsonb_typeof(checklist) = 'array'::text) AND ((jsonb_array_length(checklist) >= 3) AND (jsonb_array_length(checklist) <= 6)))),
  CONSTRAINT proof_tasks_difficulty_check CHECK ((difficulty = ANY (ARRAY['starter'::text, 'core'::text, 'stretch'::text]))),
  CONSTRAINT proof_tasks_title_check CHECK (((char_length(btrim(title)) >= 5) AND (char_length(btrim(title)) <= 120)))
);
CREATE INDEX proof_tasks_author_idx ON work.proof_tasks (author_id) WHERE (author_id IS NOT NULL);
CREATE INDEX proof_tasks_skill_idx ON work.proof_tasks (skill_id) WHERE active;

create table work.task_attempts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  task_id uuid NOT NULL,
  skill_id text NOT NULL,
  repo_id bigint,
  repo_full_name text,
  status text DEFAULT 'started'::text NOT NULL,
  route text,
  code_check_id uuid,
  round smallint DEFAULT 0 NOT NULL,
  offered_at timestamp with time zone,
  note text,
  started_at timestamp with time zone DEFAULT now() NOT NULL,
  submitted_at timestamp with time zone,
  done_at timestamp with time zone,
  verified_by text,
  record_entry_id uuid,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (code_check_id) REFERENCES work.code_checks(id) ON DELETE SET NULL,
  FOREIGN KEY (skill_id) REFERENCES work.skills(id),
  FOREIGN KEY (task_id) REFERENCES work.proof_tasks(id),
  FOREIGN KEY (user_id, repo_id) REFERENCES work.github_user_repos(user_id, repo_id) ON DELETE SET NULL (repo_id),
  CONSTRAINT task_attempts_check CHECK (((status = 'done'::text) = (done_at IS NOT NULL))),
  CONSTRAINT task_attempts_check1 CHECK (((status = 'done'::text) = (verified_by IS NOT NULL))),
  CONSTRAINT task_attempts_check2 CHECK (((status = ANY (ARRAY['started'::text, 'abandoned'::text])) OR (submitted_at IS NOT NULL))),
  CONSTRAINT task_attempts_note_check CHECK (((note IS NULL) OR (char_length(note) <= 1000))),
  CONSTRAINT task_attempts_repo_full_name_check CHECK (((repo_full_name IS NULL) OR ((repo_full_name ~ '^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$'::text) AND (char_length(repo_full_name) <= 140)))),
  CONSTRAINT task_attempts_round_check CHECK ((round >= 0)),
  CONSTRAINT task_attempts_route_check CHECK ((route = ANY (ARRAY['github'::text, 'peer'::text, 'code_check'::text]))),
  CONSTRAINT task_attempts_status_check CHECK ((status = ANY (ARRAY['started'::text, 'verifying'::text, 'awaiting_peer'::text, 'in_review'::text, 'code_check'::text, 'needs_changes'::text, 'done'::text, 'abandoned'::text]))),
  CONSTRAINT task_attempts_verified_by_check CHECK ((verified_by = ANY (ARRAY['github'::text, 'peer'::text, 'code_check'::text])))
);
CREATE INDEX task_attempts_code_check_idx ON work.task_attempts (code_check_id) WHERE (code_check_id IS NOT NULL);
CREATE INDEX task_attempts_entry_idx ON work.task_attempts (record_entry_id) WHERE (record_entry_id IS NOT NULL);
CREATE UNIQUE INDEX task_attempts_one_live ON work.task_attempts (user_id, task_id) WHERE (status <> ALL (ARRAY['done'::text, 'abandoned'::text]));
CREATE INDEX task_attempts_open_idx ON work.task_attempts (status, offered_at) WHERE (status = ANY (ARRAY['verifying'::text, 'awaiting_peer'::text, 'in_review'::text]));
CREATE INDEX task_attempts_skill_idx ON work.task_attempts (skill_id);
CREATE INDEX task_attempts_task_idx ON work.task_attempts (task_id);
CREATE INDEX task_attempts_user_idx ON work.task_attempts (user_id, status);

create table work.task_reviews (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  attempt_id uuid NOT NULL,
  reviewer_id uuid NOT NULL,
  round smallint NOT NULL,
  status text DEFAULT 'offered'::text NOT NULL,
  checklist jsonb,
  note text,
  offered_at timestamp with time zone DEFAULT now() NOT NULL,
  responded_at timestamp with time zone,
  decided_at timestamp with time zone,
  UNIQUE (attempt_id, reviewer_id),
  PRIMARY KEY (id),
  FOREIGN KEY (attempt_id) REFERENCES work.task_attempts(id) ON DELETE CASCADE,
  CONSTRAINT task_reviews_check CHECK (((status <> 'needs_changes'::text) OR (note IS NOT NULL))),
  CONSTRAINT task_reviews_checklist_check CHECK (((checklist IS NULL) OR (jsonb_typeof(checklist) = 'array'::text))),
  CONSTRAINT task_reviews_note_check CHECK (((note IS NULL) OR ((char_length(btrim(note)) >= 3) AND (char_length(btrim(note)) <= 1000)))),
  CONSTRAINT task_reviews_round_check CHECK ((round >= 1)),
  CONSTRAINT task_reviews_status_check CHECK ((status = ANY (ARRAY['offered'::text, 'accepted'::text, 'declined'::text, 'expired'::text, 'withdrawn'::text, 'confirmed'::text, 'needs_changes'::text])))
);
CREATE UNIQUE INDEX task_reviews_one_accepted ON work.task_reviews (attempt_id) WHERE (status = 'accepted'::text);
CREATE INDEX task_reviews_reviewer_idx ON work.task_reviews (reviewer_id, status, responded_at);

create table work.swap_offers (
  user_id uuid NOT NULL,
  skill_id text NOT NULL,
  note text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (user_id, skill_id),
  FOREIGN KEY (skill_id) REFERENCES work.skills(id),
  CONSTRAINT swap_offers_note_check CHECK (((note IS NULL) OR ((char_length(btrim(note)) >= 1) AND (char_length(btrim(note)) <= 280))))
);
CREATE INDEX swap_offers_skill_idx ON work.swap_offers (skill_id);

create table work.swap_wants (
  user_id uuid NOT NULL,
  skill_id text NOT NULL,
  note text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (user_id, skill_id),
  FOREIGN KEY (skill_id) REFERENCES work.skills(id),
  CONSTRAINT swap_wants_note_check CHECK (((note IS NULL) OR ((char_length(btrim(note)) >= 1) AND (char_length(btrim(note)) <= 280))))
);
CREATE INDEX swap_wants_skill_idx ON work.swap_wants (skill_id);

create table work.swaps (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  teacher_id uuid NOT NULL,
  learner_id uuid NOT NULL,
  skill_id text NOT NULL,
  offered_skill_id text,
  mutual_of uuid,
  status text DEFAULT 'requested'::text NOT NULL,
  note text,
  preferred_times text,
  requested_at timestamp with time zone DEFAULT now() NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  decided_at timestamp with time zone,
  closed_at timestamp with time zone,
  closed_by uuid,
  close_reason text,
  thread_id uuid,
  taught_entry_id uuid,
  PRIMARY KEY (id),
  FOREIGN KEY (mutual_of) REFERENCES work.swaps(id) ON DELETE SET NULL,
  FOREIGN KEY (offered_skill_id) REFERENCES work.skills(id),
  FOREIGN KEY (skill_id) REFERENCES work.skills(id),
  CONSTRAINT swaps_check CHECK ((teacher_id <> learner_id)),
  CONSTRAINT swaps_check1 CHECK (((offered_skill_id IS NULL) OR (offered_skill_id <> skill_id))),
  CONSTRAINT swaps_check2 CHECK (((status = 'closed'::text) = (closed_at IS NOT NULL))),
  CONSTRAINT swaps_check3 CHECK (((status = 'closed'::text) = (close_reason IS NOT NULL))),
  CONSTRAINT swaps_close_reason_check CHECK ((close_reason = ANY (ARRAY['ended'::text, 'inactive'::text, 'blocked'::text]))),
  CONSTRAINT swaps_note_check CHECK (((note IS NULL) OR ((char_length(btrim(note)) >= 1) AND (char_length(btrim(note)) <= 500)))),
  CONSTRAINT swaps_preferred_times_check CHECK (((preferred_times IS NULL) OR ((char_length(btrim(preferred_times)) >= 1) AND (char_length(btrim(preferred_times)) <= 200)))),
  CONSTRAINT swaps_status_check CHECK ((status = ANY (ARRAY['requested'::text, 'accepted'::text, 'declined'::text, 'expired'::text, 'cancelled'::text, 'closed'::text])))
);
CREATE INDEX swaps_closed_by_idx ON work.swaps (closed_by) WHERE (closed_by IS NOT NULL);
CREATE INDEX swaps_entry_idx ON work.swaps (taught_entry_id) WHERE (taught_entry_id IS NOT NULL);
CREATE INDEX swaps_expiry_idx ON work.swaps (expires_at) WHERE (status = 'requested'::text);
CREATE INDEX swaps_learner_idx ON work.swaps (learner_id, status);
CREATE INDEX swaps_mutual_idx ON work.swaps (mutual_of) WHERE (mutual_of IS NOT NULL);
CREATE INDEX swaps_offered_skill_idx ON work.swaps (offered_skill_id) WHERE (offered_skill_id IS NOT NULL);
CREATE UNIQUE INDEX swaps_one_open ON work.swaps (LEAST(teacher_id, learner_id), GREATEST(teacher_id, learner_id), skill_id) WHERE (status = ANY (ARRAY['requested'::text, 'accepted'::text]));
CREATE INDEX swaps_skill_idx ON work.swaps (skill_id);
CREATE INDEX swaps_teacher_idx ON work.swaps (teacher_id, status);
CREATE INDEX swaps_thread_idx ON work.swaps (thread_id) WHERE (thread_id IS NOT NULL);

create table work.swap_sessions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  swap_id uuid NOT NULL,
  proposed_by uuid NOT NULL,
  starts_at timestamp with time zone NOT NULL,
  minutes smallint NOT NULL,
  place text NOT NULL,
  status text DEFAULT 'proposed'::text NOT NULL,
  responded_at timestamp with time zone,
  confirmed_minutes smallint,
  confirmed_at timestamp with time zone,
  no_show_reason text,
  reminded_at timestamp with time zone,
  asked_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (swap_id) REFERENCES work.swaps(id) ON DELETE CASCADE,
  CONSTRAINT swap_sessions_check CHECK (((status = 'confirmed'::text) = (confirmed_at IS NOT NULL))),
  CONSTRAINT swap_sessions_check1 CHECK (((status = 'confirmed'::text) = (confirmed_minutes IS NOT NULL))),
  CONSTRAINT swap_sessions_check2 CHECK (((status = 'no_show'::text) = (no_show_reason IS NOT NULL))),
  CONSTRAINT swap_sessions_confirmed_minutes_check CHECK (((confirmed_minutes >= 15) AND (confirmed_minutes <= 240))),
  CONSTRAINT swap_sessions_minutes_check CHECK (((minutes >= 15) AND (minutes <= 240))),
  CONSTRAINT swap_sessions_no_show_reason_check CHECK ((no_show_reason = ANY (ARRAY['teacher_absent'::text, 'learner_absent'::text, 'rescheduled'::text, 'other'::text]))),
  CONSTRAINT swap_sessions_place_check CHECK (((char_length(btrim(place)) >= 2) AND (char_length(btrim(place)) <= 200))),
  CONSTRAINT swap_sessions_status_check CHECK ((status = ANY (ARRAY['proposed'::text, 'accepted'::text, 'declined'::text, 'cancelled'::text, 'confirmed'::text, 'no_show'::text])))
);
CREATE INDEX swap_sessions_proposed_by_idx ON work.swap_sessions (proposed_by);
CREATE INDEX swap_sessions_swap_idx ON work.swap_sessions (swap_id, starts_at);
CREATE INDEX swap_sessions_upcoming_idx ON work.swap_sessions (starts_at) WHERE (status = 'accepted'::text);

create table work.swap_notes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  swap_id uuid NOT NULL,
  session_id uuid NOT NULL,
  author_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  body text NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  decided_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (session_id),
  FOREIGN KEY (session_id) REFERENCES work.swap_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (swap_id) REFERENCES work.swaps(id) ON DELETE CASCADE,
  CONSTRAINT swap_notes_body_check CHECK (((char_length(btrim(body)) >= 1) AND (char_length(btrim(body)) <= 280))),
  CONSTRAINT swap_notes_check CHECK (((status = 'pending'::text) = (decided_at IS NULL))),
  CONSTRAINT swap_notes_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'declined'::text])))
);
CREATE INDEX swap_notes_author_idx ON work.swap_notes (author_id);
CREATE INDEX swap_notes_swap_idx ON work.swap_notes (swap_id);
CREATE INDEX swap_notes_teacher_idx ON work.swap_notes (teacher_id, status);

-- Row-level security: enabled and forced on every table, one policy for the owning role.
alter table work.paths enable row level security;
alter table work.paths force row level security;
create policy paths_owner on work.paths for all to svc_work using (true) with check (true);
grant select, insert, update, delete on work.paths to svc_work;

alter table work.path_skills enable row level security;
alter table work.path_skills force row level security;
create policy path_skills_owner on work.path_skills for all to svc_work using (true) with check (true);
grant select, insert, update, delete on work.path_skills to svc_work;

alter table work.path_follows enable row level security;
alter table work.path_follows force row level security;
create policy path_follows_owner on work.path_follows for all to svc_work using (true) with check (true);
grant select, insert, update, delete on work.path_follows to svc_work;

alter table work.proof_tasks enable row level security;
alter table work.proof_tasks force row level security;
create policy proof_tasks_owner on work.proof_tasks for all to svc_work using (true) with check (true);
grant select, insert, update, delete on work.proof_tasks to svc_work;

alter table work.task_attempts enable row level security;
alter table work.task_attempts force row level security;
create policy task_attempts_owner on work.task_attempts for all to svc_work using (true) with check (true);
grant select, insert, update, delete on work.task_attempts to svc_work;

alter table work.task_reviews enable row level security;
alter table work.task_reviews force row level security;
create policy task_reviews_owner on work.task_reviews for all to svc_work using (true) with check (true);
grant select, insert, update, delete on work.task_reviews to svc_work;

alter table work.swap_offers enable row level security;
alter table work.swap_offers force row level security;
create policy swap_offers_owner on work.swap_offers for all to svc_work using (true) with check (true);
grant select, insert, update, delete on work.swap_offers to svc_work;

alter table work.swap_wants enable row level security;
alter table work.swap_wants force row level security;
create policy swap_wants_owner on work.swap_wants for all to svc_work using (true) with check (true);
grant select, insert, update, delete on work.swap_wants to svc_work;

alter table work.swaps enable row level security;
alter table work.swaps force row level security;
create policy swaps_owner on work.swaps for all to svc_work using (true) with check (true);
grant select, insert, update, delete on work.swaps to svc_work;

alter table work.swap_sessions enable row level security;
alter table work.swap_sessions force row level security;
create policy swap_sessions_owner on work.swap_sessions for all to svc_work using (true) with check (true);
grant select, insert, update, delete on work.swap_sessions to svc_work;

alter table work.swap_notes enable row level security;
alter table work.swap_notes force row level security;
create policy swap_notes_owner on work.swap_notes for all to svc_work using (true) with check (true);
grant select, insert, update, delete on work.swap_notes to svc_work;

-- 8 rows of public.paths as the current stack holds them.
insert into work.paths (role,name,pictogram,position,source,seniors) values
  ('frontend', 'Frontend', 'browser', 1, 'starter', 0),
  ('backend', 'Backend', 'database', 2, 'starter', 0),
  ('mobile', 'Mobile', 'device-mobile', 3, 'starter', 0),
  ('data', 'Data', 'chart-line', 4, 'starter', 0),
  ('machine-learning', 'Machine learning', 'brain', 5, 'starter', 0),
  ('devops', 'DevOps', 'cloud', 6, 'starter', 0),
  ('ui-ux', 'UI/UX', 'pen-nib', 7, 'starter', 0),
  ('product', 'Product', 'compass', 8, 'starter', 0);

-- 85 rows of public.path_skills as the current stack holds them.
insert into work.path_skills (role,skill_id,position,after_days) values
  ('backend', 'javascript', 1, null),
  ('backend', 'nodejs', 2, null),
  ('backend', 'express', 3, null),
  ('backend', 'sql', 4, null),
  ('backend', 'postgresql', 5, null),
  ('backend', 'typescript', 6, null),
  ('backend', 'nestjs', 7, null),
  ('backend', 'redis', 8, null),
  ('backend', 'docker', 9, null),
  ('backend', 'automated-testing', 10, null),
  ('backend', 'api-documentation', 11, null),
  ('data', 'python', 1, null),
  ('data', 'sql', 2, null),
  ('data', 'pandas', 3, null),
  ('data', 'numpy', 4, null),
  ('data', 'jupyter', 5, null),
  ('data', 'matplotlib', 6, null),
  ('data', 'seaborn', 7, null),
  ('data', 'scipy', 8, null),
  ('data', 'plotly', 9, null),
  ('data', 'postgresql', 10, null),
  ('devops', 'shell', 1, null),
  ('devops', 'docker', 2, null),
  ('devops', 'docker-compose', 3, null),
  ('devops', 'github-actions', 4, null),
  ('devops', 'continuous-integration', 5, null),
  ('devops', 'nginx', 6, null),
  ('devops', 'kubernetes', 7, null),
  ('devops', 'terraform', 8, null),
  ('devops', 'ansible', 9, null),
  ('devops', 'aws', 10, null),
  ('devops', 'helm', 11, null),
  ('frontend', 'html', 1, null),
  ('frontend', 'css', 2, null),
  ('frontend', 'javascript', 3, null),
  ('frontend', 'typescript', 4, null),
  ('frontend', 'react', 5, null),
  ('frontend', 'tailwindcss', 6, null),
  ('frontend', 'redux', 7, null),
  ('frontend', 'tanstack-query', 8, null),
  ('frontend', 'nextjs', 9, null),
  ('frontend', 'vitest', 10, null),
  ('frontend', 'playwright', 11, null),
  ('machine-learning', 'python', 1, null),
  ('machine-learning', 'numpy', 2, null),
  ('machine-learning', 'pandas', 3, null),
  ('machine-learning', 'jupyter', 4, null),
  ('machine-learning', 'matplotlib', 5, null),
  ('machine-learning', 'scikit-learn', 6, null),
  ('machine-learning', 'tensorflow', 7, null),
  ('machine-learning', 'pytorch', 8, null),
  ('machine-learning', 'keras', 9, null),
  ('machine-learning', 'opencv', 10, null),
  ('machine-learning', 'hugging-face-transformers', 11, null),
  ('mobile', 'dart', 1, null),
  ('mobile', 'flutter', 2, null),
  ('mobile', 'firebase', 3, null),
  ('mobile', 'kotlin', 4, null),
  ('mobile', 'android', 5, null),
  ('mobile', 'jetpack-compose', 6, null),
  ('mobile', 'swift', 7, null),
  ('mobile', 'swiftui', 8, null),
  ('mobile', 'ios', 9, null),
  ('mobile', 'react-native', 10, null),
  ('mobile', 'expo', 11, null),
  ('product', 'javascript', 1, null),
  ('product', 'typescript', 2, null),
  ('product', 'react', 3, null),
  ('product', 'nextjs', 4, null),
  ('product', 'nodejs', 5, null),
  ('product', 'postgresql', 6, null),
  ('product', 'supabase', 7, null),
  ('product', 'vercel', 8, null),
  ('product', 'automated-testing', 9, null),
  ('product', 'api-documentation', 10, null),
  ('ui-ux', 'html', 1, null),
  ('ui-ux', 'css', 2, null),
  ('ui-ux', 'javascript', 3, null),
  ('ui-ux', 'tailwindcss', 4, null),
  ('ui-ux', 'bootstrap', 5, null),
  ('ui-ux', 'react', 6, null),
  ('ui-ux', 'material-ui', 7, null),
  ('ui-ux', 'storybook', 8, null),
  ('ui-ux', 'd3', 9, null),
  ('ui-ux', 'threejs', 10, null);

-- 14 rows of public.proof_tasks as the current stack holds them.
insert into work.proof_tasks (id,skill_id,title,difficulty,brief,checklist,active) values
  ('427f069f-149b-454b-ae4b-dd78f2b362b7', 'css', 'A responsive card grid without a framework', 'starter', 'Style a grid of 6 project cards with plain CSS. It must reflow from one column on a phone to three on a laptop, with a visible keyboard focus on each card link.', '["Uses CSS grid or flexbox, no CSS framework", "One column under 600px, three columns from 1024px", "Card links show a visible focus outline", "Colours meet 4.5:1 contrast for body text"]', true),
  ('4fe123b1-6039-46e4-a01b-6bad7bc3504f', 'docker', 'Containerise one of your projects', 'core', 'Write a Dockerfile (and a compose file if the project needs a database) so the project runs with one command on any machine.', '["docker build succeeds from a clean checkout", "The image runs as a non-root user", "Secrets come from environment variables, not the image", "The README has the one command to run it"]', true),
  ('3e41f99a-b108-4ffb-bd60-9f4682c3ef9f', 'flutter', 'A two-screen Flutter app with navigation', 'starter', 'Build a Flutter app with a list screen and a detail screen, passing data between them, with a layout that works on a small phone.', '["Two screens with navigation and back", "Data is passed to the detail screen", "Layout has no overflow on a 360px-wide screen", "Widgets are split into their own classes"]', true),
  ('3b73f559-463d-4a02-982f-7958d0cf1424', 'github-actions', 'Run your tests on every push', 'starter', 'Add a GitHub Actions workflow to one of your repositories that installs dependencies and runs the tests (or a linter) on every push and pull request.', '["The workflow runs on push and pull_request", "Dependencies are cached", "A failing test fails the workflow", "The README shows the workflow status badge"]', true),
  ('3c3780c8-0e93-4371-b365-380da831cef7', 'html', 'A semantic, accessible event page', 'starter', 'Build a single page for a society event using semantic HTML only: header, main, sections, a schedule table and a sign-up form with labels. No CSS framework needed.', '["Uses header, main, section and footer elements", "The schedule is a table with a caption and header cells", "Every form field has a visible label", "The page passes an automated accessibility check with no errors"]', true),
  ('9601c3d2-e1a9-489f-80e5-f9ced2a5d86c', 'javascript', 'A to-do list that survives a reload', 'starter', 'Write a small to-do list in plain JavaScript: add, complete and delete items, saved to localStorage so they come back after a reload. Keep the logic in functions you could test.', '["Add, complete and delete work from the keyboard", "Items are still there after a reload", "State changes go through named functions, not inline handlers", "No framework or build step is required"]', true),
  ('e24cb79a-765e-4a5f-b580-21e78717d770', 'nodejs', 'A REST API with validation', 'core', 'Build a small REST API in Node.js with create, read, update and delete for one resource, input validation and proper status codes.', '["Four routes for create, read, update and delete", "Invalid input returns 400 with a message", "Unknown ids return 404", "Configuration comes from environment variables"]', true),
  ('9a133109-e98e-4ab5-a2ab-b76a7d84bec4', 'pandas', 'Clean and summarise a messy dataset', 'core', 'Take a public dataset with missing and inconsistent values, clean it with pandas, and answer three questions about it in a notebook or script.', '["Missing values are handled and the choice is explained", "Column types are fixed (dates, numbers, categories)", "Three questions are answered with code and a sentence each", "The cleaned data is saved separately from the raw data"]', true),
  ('31ef0d83-500e-473c-b181-6d669468b399', 'python', 'A command-line expense tracker', 'starter', 'Write a Python command-line tool that adds expenses, lists them by month and prints a total per category, saving to a CSV or JSON file.', '["Add, list and summary commands work from the terminal", "Data is saved to a file and read back", "Code is split into functions with docstrings", "Bad input prints a helpful message instead of a traceback"]', true),
  ('4d2e2958-a155-4923-a0db-c16dd3fa1c44', 'react', 'A multi-step form with validation', 'stretch', 'Build a three-step sign-up form in React that keeps its values between steps, validates each step before moving on, and lets the user go back without losing data.', '["Three steps with Back and Next", "Each step validates before moving on and shows the error next to the field", "Values survive going back and forth", "The form can be completed with the keyboard alone"]', true),
  ('b3cdb0b9-cb20-46a1-bd9b-9413ff050e85', 'react', 'A searchable list with loading and error states', 'core', 'Build a React component that fetches a list, filters it as the user types, and shows loading, empty and error states. Split it into at least three components.', '["Loading, empty and error states each render something different", "Filtering happens as the user types without refetching", "At least three components with clear props", "Keys on list items are stable ids, not indexes"]', true),
  ('7a543751-882d-4727-8e9c-c37c532530c5', 'sql', 'Design and query a society membership schema', 'starter', 'Design tables for societies, members and events with primary and foreign keys, load sample data, and write five queries that answer real questions (for example, the most active members this term).', '["Tables have primary keys and foreign keys", "Sample data is loaded by a script in the repository", "Five queries, each with a comment saying what it answers", "At least one query uses a join and one uses GROUP BY"]', true),
  ('96de4a69-d5d7-4528-8343-93e95e0c0ad6', 'typescript', 'Migrate a JavaScript module to TypeScript', 'starter', 'Take a JavaScript file of at least 100 lines from one of your projects and convert it to TypeScript, fixing what the compiler finds rather than silencing it.', '["The file compiles with strict mode on", "No any or ts-ignore was added", "Function parameters and return values are typed", "A short note in the README says what the compiler caught"]', true),
  ('177f5e97-ea9f-45cb-8b5f-51fe9c4f62d5', 'typescript', 'Type a small API client', 'core', 'Write a typed client for a public JSON API (for example a weather or books API). Model the responses with interfaces, handle errors with a result type, and turn on strict mode.', '["tsconfig has strict mode on", "Responses are described by interfaces or types, no any", "Network and parse errors return a typed error instead of throwing", "At least one function uses a generic type"]', true);
