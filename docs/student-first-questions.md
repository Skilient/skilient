# Student-first track: questions for Ahmed

One list for the whole track (CLAUDE.md). Each has a recommended default; phases build on the defaults until Ahmed answers, and answered items move to `docs/decisions.md`. The plan is `docs/student-first-plan.md`; the features are PRD 5.30–5.34.

## Answered (2026-11-02)

Questions 1–16 are answered; see `docs/decisions.md` "Student-first answers (2026-11-02)". Changes from the defaults:
- **1. Record and rank:** the Record moves rank slightly (formula v2, PRD 5.30).
- **5. Paid tickets:** paid and free tickets (PRD 5.31).
- **16. Existing recruiter or university accounts:** delete them (phase 14 slice 1).

Every other question took its default.

## Open (raised by the answers)

17. **Record weight in rank.** *Default: a Record component of at most 100 points (the maximum becomes 2,600; tier thresholds unchanged). Only office-bearer terms (president 35, officers 25), competition results (30/20/15/10, at least 5 entrants) and volunteer hours (2 an hour, at most 20 a year) count. At most 50 points from one society. Attendance never counts, so paid tickets can't buy rank.*
18. **Skilient's fee on paid tickets.** *Default: 0% until you set `events.ticket_fee_bps`. The gateway fee comes out of the society's payout.*
19. **Payouts.** *Default: staff pay each event's net by bank transfer 7 days after it ends, weekly, to a payout account (holder name matched to a CNIC) that staff verified; payouts get automated once the gateway supports split payments.*
20. **Refund policy.** *Default: the host picks "no refunds" or "full refund until N days before"; a cancelled event refunds everyone in full automatically, and the society bears the gateway fee.*
21. **Ticket price limits.** *Default: PKR 100 to 10,000 per ticket; at most 3 paid events live per society until its first payout succeeds.*
22. **Deleting recruiter and university accounts.** *Default: one migration in phase 14 slice 1 runs `private.delete_account` for every `recruiter` and `university_admin` account (others' records are anonymised, as on any deletion) and deletes their organisations and seats. Faculty who hold a university seat keep their faculty account and lose the seat. Universities themselves (the HEC list) stay. The pull request lists the exact counts before merge. No email to the deleted accounts.*
