> **Removed 2026-11-23, see decisions.md.** Kept for history; nothing here is built.

### 5.33 Digital yearbook (decided 2026-11-02)

The final-year batch's book: every final-year student has a page that friends, teammates and society co-members sign with notes, and the batch votes **kind superlatives** from a fixed list. It opens in the last semester and freezes at graduation as a keepsake. Signed-in only, never public (CLAUDE.md: no public profile pages).

#### Activity flow

1. **Opens.** On **1 February** (cron `yearbook-open`), each university's final-year batch gets a yearbook.
   - "Final year" follows the graduation rule (5.25, decisions: 1 September; `universities.final_year_batch` as the exception).
   - Every member is notified: "Your yearbook is open" → `/yearbook`.
2. **My page** (`/yearbook/me`):
   - a photo (the avatar, or a separate yearbook photo, re-encoded)
   - a quote (up to 140 characters)
   - up to 3 optional Record highlights (5.30)
   - a visibility toggle (a hidden page can't be signed or voted for)
3. **Sign a page** (`/yearbook/[username]`).
   - **Who can sign:** friends, venture teammates (current or past) and society co-members (5.31) in the same batch.
   - A note is up to 500 characters; one note per writer per page, editable until approved.
   - The owner is notified ("Hira signed your yearbook") and chooses **Approve** or **Hide**.
   - Only approved notes are visible to the batch. Hidden notes are never shown to anyone else, and the writer isn't told.
4. **Browse** (`/yearbook`): the batch's pages as a grid of portraits by department, with search. The page count signed is shown only to the owner.
5. **Superlatives.**
   - The vote opens **1 June** for 3 weeks.
   - The titles come from `platform_config` `yearbook.titles`: a fixed list of positive titles only (for example "Most likely to start a company", "Always ready to help", "Best teammate").
   - One **secret** vote per title, for someone in the voter's department; changeable until the close.
   - A winner needs **5 votes or more**. Winners are told privately **48 hours before** the reveal and may decline (the title then goes unawarded, never to the runner-up).
   - The reveal day shows winners on their pages.
   - Anyone can opt out of superlatives in Settings → Privacy (never shown as an option to vote for).
   - Vote counts are never shown, only the winner.
6. **Freeze.** On **1 September** (graduation) the yearbook becomes read-only for the batch forever (alumni keep access). Each person can download their page as a PDF.
7. **Moderation.** Notes and pages can be reported (5.12); removing a note never tells the writer who reported it.

#### Build: yearbook

- **Tables:** `yearbooks` (university, batch, opens_at, vote_opens_at, vote_closes_at, reveal_at, frozen_at), `yearbook_pages`, `yearbook_notes` (approved_at, hidden_at), `yearbook_votes` (voter, title_key, nominee; unique per voter and title), `yearbook_awards`, plus `profiles.yearbook_superlatives_opt_out`.
- **Rules.** RLS gives batch members read access to visible pages and approved notes only; votes are never readable (only `private` tallies at the reveal).
- **Jobs and config.** Crons `yearbook-open`, `yearbook-reveal`, `yearbook-freeze`. The dates live in `platform_config` `yearbook.calendar` (question 9), each config key with its `config_keys` row.
- **Done when:**
  - only same-batch friends, teammates and co-members can sign
  - unapproved notes are invisible to everyone but the owner and the writer
  - a winner under 5 votes is never shown
  - nobody can read another person's vote
  - the book is read-only after the freeze
