-- work: endorsements (PRD 5.16), credentials and the issuers staff recognise (PRD 5.4), code checks and their
-- prompts (PRD 5.5), and the copy of market's competition awards that L3/L4 read (W11 publishes them). Ported
-- from _endorsements.sql, _credentials.sql, _code_checks.sql, _teacher_portal.sql (endorser_kind,
-- confirmer_role, due dates; teacher rows wait with the faculty portal) and _recruiter_jobs.sql (awards).
-- Generated from the current stack's definitions (enums as checked text). Forward-only.

create table work.recognised_issuers (
  id text NOT NULL,
  name text NOT NULL,
  aliases text[] DEFAULT '{}'::text[] NOT NULL,
  retired_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT recognised_issuers_id_check CHECK ((id ~ '^[a-z0-9][a-z0-9-]{1,40}$'::text)),
  CONSTRAINT recognised_issuers_name_check CHECK (((char_length(name) >= 2) AND (char_length(name) <= 120)))
);

create table work.credentials (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  title text NOT NULL,
  issuer text NOT NULL,
  issued_on date NOT NULL,
  expires_on date,
  verify_url text,
  file_path text NOT NULL,
  file_type text NOT NULL,
  file_bytes integer NOT NULL,
  status text DEFAULT 'pending' NOT NULL,
  recognised_issuer_id text,
  claimed_by uuid,
  claimed_at timestamp with time zone,
  reviewer_id uuid,
  reviewed_at timestamp with time zone,
  review_reason text,
  file_deleted_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE (file_path),
  PRIMARY KEY (id),
  FOREIGN KEY (recognised_issuer_id) REFERENCES work.recognised_issuers(id),
  CHECK (status IS NULL OR status IN ('pending', 'approved', 'rejected', 'expired')),
  CONSTRAINT credentials_check CHECK (((expires_on IS NULL) OR (expires_on > issued_on))),
  CONSTRAINT credentials_check1 CHECK (((recognised_issuer_id IS NULL) OR (status = ANY (ARRAY['approved', 'expired'])))),
  CONSTRAINT credentials_check2 CHECK (((status = 'pending') = (reviewed_at IS NULL))),
  CONSTRAINT credentials_file_bytes_check CHECK ((file_bytes > 0)),
  CONSTRAINT credentials_file_path_check CHECK ((file_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|webp)$'::text)),
  CONSTRAINT credentials_file_type_check CHECK ((file_type = ANY (ARRAY['pdf'::text, 'image'::text]))),
  CONSTRAINT credentials_issued_on_check CHECK ((issued_on >= '1980-01-01'::date)),
  CONSTRAINT credentials_issuer_check CHECK (((char_length(btrim(issuer)) >= 2) AND (char_length(btrim(issuer)) <= 120))),
  CONSTRAINT credentials_review_reason_check CHECK (((review_reason IS NULL) OR ((char_length(btrim(review_reason)) >= 3) AND (char_length(btrim(review_reason)) <= 2000)))),
  CONSTRAINT credentials_title_check CHECK (((char_length(btrim(title)) >= 2) AND (char_length(btrim(title)) <= 120))),
  CONSTRAINT credentials_verify_url_check CHECK (((verify_url IS NULL) OR ((verify_url ~ '^https://[^\s]+$'::text) AND (char_length(verify_url) <= 500))))
);
CREATE INDEX credentials_claimed_by_idx ON work.credentials (claimed_by) WHERE (claimed_by IS NOT NULL);
CREATE INDEX credentials_expiry_idx ON work.credentials (expires_on) WHERE ((status = 'approved') AND (expires_on IS NOT NULL));
CREATE INDEX credentials_issuer_idx ON work.credentials (recognised_issuer_id) WHERE (recognised_issuer_id IS NOT NULL);
CREATE INDEX credentials_pending_idx ON work.credentials (created_at) WHERE (status = 'pending');
CREATE INDEX credentials_reviewer_idx ON work.credentials (reviewer_id) WHERE (reviewer_id IS NOT NULL);
CREATE INDEX credentials_user_idx ON work.credentials (user_id, created_at DESC);

create table work.endorsements (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  endorser_id uuid NOT NULL,
  endorsee_id uuid NOT NULL,
  venture_id uuid NOT NULL,
  skill_id text NOT NULL,
  evidence_id uuid,
  note text,
  hidden boolean DEFAULT false NOT NULL,
  hidden_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  endorser_kind text DEFAULT 'peer'::text NOT NULL,
  UNIQUE (endorser_id, endorsee_id, skill_id, venture_id),
  PRIMARY KEY (id),
  FOREIGN KEY (evidence_id) REFERENCES work.contributions(id) ON DELETE SET NULL,
  FOREIGN KEY (skill_id) REFERENCES work.skills(id),
  FOREIGN KEY (venture_id) REFERENCES work.ventures(id) ON DELETE CASCADE,
  CONSTRAINT endorsements_check CHECK ((endorser_id <> endorsee_id)),
  CONSTRAINT endorsements_check1 CHECK ((hidden = (hidden_at IS NOT NULL))),
  CONSTRAINT endorsements_endorser_kind_check CHECK ((endorser_kind = ANY (ARRAY['peer'::text, 'teacher'::text]))),
  CONSTRAINT endorsements_note_check CHECK (((note IS NULL) OR ((char_length(note) >= 1) AND (char_length(note) <= 280))))
);
CREATE INDEX endorsements_endorsee_idx ON work.endorsements (endorsee_id, skill_id);
CREATE INDEX endorsements_endorser_created_idx ON work.endorsements (endorser_id, created_at);
CREATE INDEX endorsements_evidence_idx ON work.endorsements (evidence_id) WHERE (evidence_id IS NOT NULL);
CREATE INDEX endorsements_skill_idx ON work.endorsements (skill_id);
CREATE INDEX endorsements_venture_idx ON work.endorsements (venture_id);

create table work.code_check_prompts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  skill_id text,
  category text,
  prompt text NOT NULL,
  author_id uuid,
  active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (skill_id) REFERENCES work.skills(id),
  CHECK (category IS NULL OR category IN ('language', 'framework', 'library', 'tool', 'platform', 'practice')),
  CONSTRAINT code_check_prompts_check CHECK (((skill_id IS NOT NULL) OR (category IS NOT NULL))),
  CONSTRAINT code_check_prompts_prompt_check CHECK (((char_length(btrim(prompt)) >= 10) AND (char_length(btrim(prompt)) <= 300)))
);
CREATE INDEX code_check_prompts_author_idx ON work.code_check_prompts (author_id) WHERE (author_id IS NOT NULL);
CREATE INDEX code_check_prompts_category_idx ON work.code_check_prompts (category) WHERE active;
CREATE INDEX code_check_prompts_skill_idx ON work.code_check_prompts (skill_id) WHERE active;

create table work.code_checks (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  skill_id text NOT NULL,
  status text DEFAULT 'preparing' NOT NULL,
  prompt_id uuid,
  repo_id bigint,
  sha text,
  path text,
  start_line integer,
  end_line integer,
  answers jsonb DEFAULT '{}'::jsonb NOT NULL,
  rubric jsonb,
  feedback text,
  unavailable_reason text,
  requested_at timestamp with time zone DEFAULT now() NOT NULL,
  ready_at timestamp with time zone,
  started_at timestamp with time zone,
  deadline_at timestamp with time zone,
  snippet_served_at timestamp with time zone,
  submitted_at timestamp with time zone,
  graded_at timestamp with time zone,
  claimed_by uuid,
  claimed_at timestamp with time zone,
  grader_id uuid,
  due_at timestamp with time zone,
  routed_to_staff_at timestamp with time zone,
  PRIMARY KEY (id),
  FOREIGN KEY (prompt_id) REFERENCES work.code_check_prompts(id) ON DELETE SET NULL,
  FOREIGN KEY (skill_id) REFERENCES work.skills(id),
  CHECK (status IS NULL OR status IN ('preparing', 'ready', 'in_progress', 'submitted', 'passed', 'failed', 'unavailable', 'expired')),
  CONSTRAINT code_checks_answers_check CHECK ((jsonb_typeof(answers) = 'object'::text)),
  CONSTRAINT code_checks_check CHECK (((end_line IS NULL) OR (end_line >= start_line))),
  CONSTRAINT code_checks_check1 CHECK (((deadline_at IS NULL) OR ((started_at IS NOT NULL) AND (snippet_served_at IS NOT NULL)))),
  CONSTRAINT code_checks_feedback_check CHECK (((feedback IS NULL) OR (char_length(feedback) <= 2000))),
  CONSTRAINT code_checks_path_check CHECK (((path IS NULL) OR (char_length(path) <= 500))),
  CONSTRAINT code_checks_rubric_check CHECK (((rubric IS NULL) OR (jsonb_typeof(rubric) = 'object'::text))),
  CONSTRAINT code_checks_sha_check CHECK (((sha IS NULL) OR (sha ~ '^[0-9a-f]{40}$'::text))),
  CONSTRAINT code_checks_start_line_check CHECK (((start_line IS NULL) OR (start_line >= 1))),
  CONSTRAINT code_checks_unavailable_reason_check CHECK (((unavailable_reason IS NULL) OR (char_length(unavailable_reason) <= 200)))
);
CREATE INDEX code_checks_claimed_by_idx ON work.code_checks (claimed_by) WHERE (claimed_by IS NOT NULL);
CREATE INDEX code_checks_grader_idx ON work.code_checks (grader_id) WHERE (grader_id IS NOT NULL);
CREATE UNIQUE INDEX code_checks_one_open_idx ON work.code_checks (user_id, skill_id) WHERE (status = ANY (ARRAY['preparing', 'ready', 'in_progress', 'submitted']));
CREATE INDEX code_checks_prompt_idx ON work.code_checks (prompt_id);
CREATE INDEX code_checks_skill_idx ON work.code_checks (skill_id);
CREATE INDEX code_checks_submitted_idx ON work.code_checks (submitted_at) WHERE (status = 'submitted');
CREATE INDEX code_checks_user_skill_idx ON work.code_checks (user_id, skill_id, requested_at DESC);

create table work.competition_awards (
  student_id uuid NOT NULL,
  competition_id uuid NOT NULL,
  skill_id text NOT NULL,
  kind text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (student_id, competition_id, skill_id),
  FOREIGN KEY (skill_id) REFERENCES work.skills(id),
  CONSTRAINT competition_awards_kind_check CHECK ((kind = ANY (ARRAY['participant'::text, 'winner'::text])))
);

-- Row-level security: enabled and forced on every table, one policy for the owning role.
alter table work.recognised_issuers enable row level security;
alter table work.recognised_issuers force row level security;
create policy recognised_issuers_owner on work.recognised_issuers for all to svc_work using (true) with check (true);
grant select, insert, update, delete on work.recognised_issuers to svc_work;

alter table work.credentials enable row level security;
alter table work.credentials force row level security;
create policy credentials_owner on work.credentials for all to svc_work using (true) with check (true);
grant select, insert, update, delete on work.credentials to svc_work;

alter table work.endorsements enable row level security;
alter table work.endorsements force row level security;
create policy endorsements_owner on work.endorsements for all to svc_work using (true) with check (true);
grant select, insert, update, delete on work.endorsements to svc_work;

alter table work.code_check_prompts enable row level security;
alter table work.code_check_prompts force row level security;
create policy code_check_prompts_owner on work.code_check_prompts for all to svc_work using (true) with check (true);
grant select, insert, update, delete on work.code_check_prompts to svc_work;

alter table work.code_checks enable row level security;
alter table work.code_checks force row level security;
create policy code_checks_owner on work.code_checks for all to svc_work using (true) with check (true);
grant select, insert, update, delete on work.code_checks to svc_work;

alter table work.competition_awards enable row level security;
alter table work.competition_awards force row level security;
create policy competition_awards_owner on work.competition_awards for all to svc_work using (true) with check (true);
grant select, insert, update, delete on work.competition_awards to svc_work;

-- 17 rows of public.recognised_issuers as the current stack holds them.
insert into work.recognised_issuers (id,name,aliases) values
  ('aws', 'Amazon Web Services (AWS)', array['aws', 'amazon web services', 'amazon']::text[]),
  ('cisco', 'Cisco', array['cisco', 'cisco networking academy']::text[]),
  ('comptia', 'CompTIA', array['comptia']::text[]),
  ('digiskills', 'DigiSkills.pk', array['digiskills', 'digiskills.pk', 'digi skills']::text[]),
  ('google', 'Google', array['google', 'google cloud', 'google career certificates']::text[]),
  ('hec', 'Higher Education Commission (HEC)', array['hec', 'higher education commission']::text[]),
  ('huawei', 'Huawei', array['huawei', 'huawei ict academy']::text[]),
  ('ibm', 'IBM', array['ibm']::text[]),
  ('linux-foundation', 'The Linux Foundation', array['linux foundation', 'the linux foundation', 'cncf']::text[]),
  ('meta', 'Meta', array['meta', 'facebook']::text[]),
  ('microsoft', 'Microsoft', array['microsoft', 'microsoft learn', 'azure']::text[]),
  ('navttc', 'NAVTTC', array['navttc', 'national vocational and technical training commission']::text[]),
  ('nftp', 'National Freelance Training Programme (NFTP)', array['nftp', 'national freelance training programme', 'national freelance training program']::text[]),
  ('oracle', 'Oracle', array['oracle', 'oracle university']::text[]),
  ('piaic', 'PIAIC', array['piaic', 'presidential initiative for artificial intelligence and computing']::text[]),
  ('pseb', 'Pakistan Software Export Board (PSEB)', array['pseb', 'pakistan software export board']::text[]),
  ('red-hat', 'Red Hat', array['red hat', 'redhat']::text[]);

-- 48 rows of public.code_check_prompts as the current stack holds them.
insert into work.code_check_prompts (id,skill_id,category,prompt,active) values
  ('7b03826c-cec2-465e-b518-cd0e2ec3abd1', null, 'framework', 'A new major version of the framework breaks something here. How would you find what broke and fix it?', true),
  ('e357bc94-e4da-439b-9b5c-f6f50618e03c', null, 'framework', 'A second screen or endpoint needs the same behaviour. How would you share it instead of copying it?', true),
  ('23315360-ab50-465b-8c88-6529732c9b05', null, 'framework', 'Errors here must show the user a helpful message instead of crashing. What would you change?', true),
  ('2dbb4015-083f-4696-8a6d-11c0985dd9d0', null, 'framework', 'Only signed-in users with a certain role may use this. How would you enforce that the framework''s way?', true),
  ('942725f3-1980-45cc-8eb8-ac975a20e115', null, 'framework', 'Ten times more people now use this page or endpoint. What would you change to keep it fast?', true),
  ('9b316e2f-8eeb-4170-9576-965cf9d2cf4b', null, 'framework', 'This part needs automated tests. Which of the framework''s tools would you use, and what would you test?', true),
  ('abc8ee2e-4976-4cbc-bb7e-844e02361afd', null, 'framework', 'This screen or endpoint must now load its data from an API that can be slow or fail. What would you change?', true),
  ('a3aa36fa-a204-4305-975c-bf5a5c5e7115', null, 'framework', 'You need to add form input with validation here. How would you do it the framework''s way?', true),
  ('68c87407-35b5-42ca-9e38-3d9cbee2ddaf', null, 'language', 'A new option must change how it behaves. How would you add it without breaking the code that already calls it?', true),
  ('fa1739e7-5809-49d1-aa66-7927dfdfd03e', null, 'language', 'A teammate finds this hard to read. How would you rewrite it for clarity without changing what it does?', true),
  ('8059cbe3-5063-49d6-bc08-2c66281edade', null, 'language', 'Another part of the project needs to reuse this logic. How would you restructure it?', true),
  ('ef82e8bd-3b43-459e-8955-cd809340a3b2', null, 'language', 'Failures must now be logged with enough detail to debug them later. What would you add?', true),
  ('c206823d-525f-47de-b9c8-d7d4ed9b3e9f', null, 'language', 'It must now run for many users at the same time. What could go wrong, and what would you change?', true),
  ('20d188ea-a446-43e2-8f8c-dc29467803c8', null, 'language', 'It now has to handle 100 times more data. What would you change, and why?', true),
  ('0dcf4cf4-4178-417d-97cc-69c67915948e', null, 'language', 'The input can now be empty, missing or malformed. How would you change this code to handle that safely?', true),
  ('3c667287-d244-410b-8cbb-aed586ec142d', null, 'language', 'You need automated tests for this code. What would you test, and what would you change to make it easy to test?', true),
  ('63cbc578-3449-4f1c-b534-9f834b149937', null, 'library', 'A newer version of the library changes this function''s signature. How would you update the code and check it still works?', true),
  ('456f3843-32fa-4597-b01d-09e785fa76c3', null, 'library', 'Input must be validated before it reaches the library. What would you check?', true),
  ('f49d1869-663b-4d0a-85bd-5030d6ceee07', null, 'library', 'The data passed to the library is now much larger. What would you check or change?', true),
  ('63411561-6597-46cf-8ecd-96f697a46eed', null, 'library', 'The library call can fail or time out. How would you handle that here?', true),
  ('9b0fe9d0-f2bc-4cb6-83d5-3d71515febc2', null, 'library', 'The library needs different settings in development and production. How would you handle that?', true),
  ('c4d1771c-5491-4fd3-b19c-fb1ef565a893', null, 'library', 'The library''s result must now be cached. Where and how would you add that?', true),
  ('ec1ef56c-b706-4522-bd48-8f9ee22c42ed', null, 'library', 'You must replace this library with a different one. How would you change the code so the swap touches as little as possible?', true),
  ('6d9822c8-5d5d-4ff5-ad98-19eb2d45f633', null, 'library', 'You need a test for this code that doesn''t call the real library. How would you write it?', true),
  ('ca21d882-9121-4ac9-9445-5c62908b0595', null, 'platform', 'A service limit forces a different configuration. What would you change?', true),
  ('39a8c39b-3702-44d4-a015-5015906d7c20', null, 'platform', 'Only the owner of a record may read or change it. How would you enforce that on this platform?', true),
  ('18aae133-5d49-4d7c-8fde-49d184469eb2', null, 'platform', 'Sensitive data must be protected when stored and when sent. What would you check or change?', true),
  ('273b5e06-f5e4-4ab7-adb5-de87d38a497f', null, 'platform', 'The data here must be backed up and restorable. How would you set that up?', true),
  ('aa182ba7-a3fb-42ff-9c1a-2207994fa4cd', null, 'platform', 'The platform''s service is briefly unavailable. How should this code behave?', true),
  ('fae5111d-7ab2-4749-9c3c-b72fafa756f1', null, 'platform', 'Usage grows ten times. What would you change to stay within the platform''s limits and cost?', true),
  ('cbb8fa39-30a2-416e-9602-2b61ad3b44be', null, 'platform', 'You need logs or metrics to see when this fails in production. What would you add?', true),
  ('f0beb35e-d363-4516-b4a6-e5069bb3bbf0', null, 'platform', 'You need separate development and production setups. What would you change?', true),
  ('7854c64f-d17a-402a-bc24-2c9e15e9c1fe', null, 'practice', 'A bug slips through in this area. What test or check would have caught it, and where would you add it?', true),
  ('5fb91f94-682a-4ec6-9d81-b23bea853c5b', null, 'practice', 'A new teammate must follow this practice. What would you document or automate?', true),
  ('44bc13f1-7dc5-4fd0-a05c-e3e019594ac9', null, 'practice', 'A reviewer disagrees with how this is done. How would you justify it, or what would you change?', true),
  ('9875287c-68a1-4759-b41f-402c14eae92e', null, 'practice', 'The deadline is tight. What part of this would you keep, and what would you postpone?', true),
  ('e9c35ce0-06fa-4ceb-99a1-5e143b65aa9b', null, 'practice', 'The project doubles in size. What would you change so this still works?', true),
  ('dd252b37-1363-4737-985c-77c3a1df55cd', null, 'practice', 'The same approach must now apply to another part of the codebase. How would you roll it out?', true),
  ('3f63ed50-a090-415d-bcba-6dc518a4d89b', null, 'practice', 'The team wants to know whether this practice is working. What would you measure?', true),
  ('d52dda4c-3783-43ad-b5ff-837def0a4767', null, 'practice', 'You find a case this doesn''t cover. How would you extend it?', true),
  ('31590135-d636-4a97-a7f2-1aad0cf9ae69', null, 'tool', 'A dependency''s version must be pinned so builds can be repeated exactly. What would you change?', true),
  ('ed2a7992-946e-4715-ac61-447f77fcdbdd', null, 'tool', 'A new teammate must be able to use this within 10 minutes. What would you change or document?', true),
  ('cc08435e-d7f9-46e5-b3f9-44727b16998b', null, 'tool', 'A secret such as an API key is needed here. How would you provide it safely?', true),
  ('8001179b-602b-4c74-95df-317a3c5f2181', null, 'tool', 'It fails on a teammate''s machine but works on yours. How would you find out why and fix it?', true),
  ('b9991169-bdc8-4c54-a553-0fa6caf3bfdd', null, 'tool', 'This must now also work for a second environment, such as staging. What would you change?', true),
  ('878e3b7e-6519-4b73-8838-99f2e2af60c2', null, 'tool', 'This must now run automatically on every push. What would you add or change?', true),
  ('41ee8a78-5e9e-490e-9144-1228d5b6e290', null, 'tool', 'This now takes too long to build or run. What would you change to speed it up?', true),
  ('ecfb468b-597d-446d-ad26-95f797ceab3e', null, 'tool', 'You need to roll back to the previous version quickly. How would this setup support that?', true);
