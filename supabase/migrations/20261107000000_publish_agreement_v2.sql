-- Publish agreement version 2 (the User Agreement and Privacy Notice, PRD 5.27).
-- Text: docs/legal/user-agreement-and-privacy-notice.md, staged by 20261106000000_agreement_v2.sql.
-- Publishing forces every account to accept it again at its next sign-in, and makes /terms
-- and /privacy show it. Guarded so a re-run never moves the publication date.
update public.agreement_versions
   set published_at = now()
 where version = 2
   and published_at is null;
