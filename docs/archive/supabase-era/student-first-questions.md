# Student-first track: questions for Ahmed

One list for the whole track (CLAUDE.md). Answered items move to `docs/decisions.md`. The plan is `docs/student-first-plan.md`; the features are PRD 5.30–5.34.

## Answered (2026-11-02)

Every question is answered; see `docs/decisions.md` "Student-first answers (2026-11-02)".

Changes from the defaults:
- **1. Record and rank:** the Record moves rank slightly (formula v2, PRD 5.30).
- **5. Paid tickets:** free and paid tickets. Paid tickets are paid directly to the society; the student uploads the receipt and an officer confirms it. Skilient never handles the money (PRD 5.31). Questions 18–20 (Skilient fee, payouts, gateway refunds) no longer apply.
- **16. Existing recruiter or university accounts:** delete them (phase 14, done as question 22's default).

Every other question took its default, including 17 (Record weight), 21 (PKR 100 to 10,000 per ticket; the payout-based limit is dropped) and 22 (deletion through `private.delete_account`, with counts in the pull request).

## Open

None. New questions that come up during a phase get the safest default, a line in `docs/decisions.md` and a mention in the phase's report.
