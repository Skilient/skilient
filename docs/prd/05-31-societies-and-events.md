### 5.31 Societies and society events (decided 2026-11-02)

Societies are the campus's clubs: tech, debating, arts, sports, community service and the rest. On Skilient they get a page, office bearers, members, inductions and **events with full tooling**. They are also the main **issuers of The Record** (5.30). **Students can't create events; only societies do** (supersedes 5.28's "Event: anyone verified"). University-run events (5.23) return when the university portal is switched back on.

No society chat: Skilient has no group chats beyond venture chats (decisions 2026-11-02).

#### Societies: activity flow

1. **Request** (any student, `/societies/new`), a stepper: Basics → Look → Proof → Review.
   - **Basics:** name, category (Technology, Business, Debating and literary, Arts and media, Sports, Community service, Religious and cultural, Other), about (up to 1,000 characters).
   - **Look:** logo and cover, re-encoded with sharp (`lib/images/reencode.ts`).
   - **Proof:** a PDF or image of 5 MB or less (a recognition letter, notification or similar) or an official link, plus the checkbox "I am an office bearer of this society".
   - Names are unique per university after normalising (case, spacing, punctuation, "society"/"club" suffixes); a live check says "A society with this name is already on Skilient at NUTECH".
   - Submit → **Pending · reviewed within 3 working days · 14:02**. One pending request per student.
2. **Verify** (staff with the trust role, `/ops/societies`):
   - The queue shows the claim and the age.
   - Staff approve, ask for more (the requester edits and resubmits), or reject with a reason.
   - Every decision is audited before and after (pgTAP 49); the requester is notified.
   - Until approved, the society is invisible to everyone but the requester (question 6).
3. **Go live.**
   - `/societies/[slug]` opens with the requester as **President**.
   - A setup checklist on the page: add a logo → invite officers → choose the membership mode → create the first event.
4. **Officers.**
   - The president invites by username with a title (free text, up to 40 characters) and a term (start and end month).
   - The invitee accepts → they join the roll call.
   - At most 15 officers at a time.
   - **Handover:** the president picks a successor among officers or members → the successor accepts → the old president becomes "Former President, <term>".
5. **Members and followers.**
   - **Follow:** news only (posts and events in the feed).
   - **Join**, by the society's membership mode:
     - **Open:** a member at once.
     - **Request:** an officer approves.
     - **Inductions only:** the Join button explains this and links the open round.
   - Members can leave at any time.
6. **Induction rounds** (officers):
   - A round has roles (title, seats, skills optional), up to 3 questions and a deadline (at most 30 days out).
   - Publish → followers and members are notified, and the Openings "Society inductions" card updates (5.35).
   - Students apply (one application per round).
   - Officers shortlist, then accept or decline with an optional note.
   - Accepted applicants become members with a team title ("Design team").
   - The deadline closes the round; applications nobody decided are declined 14 days later with a polite notice.
7. **Posts as the society.**
   - Officers see "Post as <society>" in the composer. The post goes to the University feed under the society's byline (logo and name, with the officer named in the post menu for accountability).
   - Members and followers are notified by their prefs.
   - The feed gains a **Societies** filter chip.
8. **Term end.**
   - On each officer's term end, the president gets a task: "Confirm your officers' terms".
   - Each confirmation issues an **Office bearer** Record entry.
   - The president's own term is confirmed by another officer.
   - An unconfirmed term can still be confirmed later; it never issues on its own.
9. **Edge cases.**
   - Staff can suspend a society (hidden, can't issue, events cancelled with notices).
   - A president who leaves the university (graduates or deletes their account) must hand over first; otherwise staff reassign.
   - Reports cover the society page, its posts and its events.

#### Society events: activity flow (host)

1. **Create** (officers, `/societies/[slug]/events/new`), a stepper with "N steps left":
   1. **Basics:** type (talk, workshop, competition, hackathon, social, volunteering), title, cover, description. Co-host societies are optional and must accept the invite.
   2. **When and where:** a single session, or several sessions (each with its own time). A venue or an online link.
   3. **Who:**
      - eligibility: own university (default), all universities, or chosen departments and batches
      - ticket types (for example Participant or Audience), each with a capacity and free or a price in PKR (paid tickets need the society's confirmed payment details, below)
      - team registration on or off (2–6 people per team)
      - approval mode (automatic or manual)
      - when registration opens and closes
   4. **Form:** up to 8 questions (short text, long text, single choice, multiple choice; required or optional). Name, email, department and batch are prefilled and never asked.
   5. **Record:**
      - what attendees earn: Attended, Completed (at least N of M sessions) or Result (placings)
      - whether volunteer hours are logged
   6. **Review** → Save draft or **Publish**.
2. **Publish.**
   - `/events/[id]` goes live, with an Event post in the feed under the society's byline.
   - Followers and members are notified.
   - The Openings "Events" card updates.
   - "Duplicate" on a past event prefills a new one.
3. **Before the day** (`/events/[id]/manage`):
   - Stat tiles: registered, pending, waitlist, capacity.
   - Approve or decline (manual mode).
   - Message registrants (in-app and email).
   - Add **event staff** by username for check-in.
   - Edits: a time or venue change sends a change notice; capacity can't go below confirmed seats; eligibility can't narrow after the first registration.
4. **Day of.**
   - The event turns **Live** at its first session's start.
   - `/events/[id]/check-in` (officers and event staff) uses a camera scanner, with three results:
     - **green:** "Checked in · 10:04 · Ayesha Siddiqui"
     - **amber:** "Already checked in at 09:58"
     - **red:** "Not registered", with **Walk in** if seats remain and the person is eligible
   - Fallbacks: search by name, then **add by university email** (the person gets a claim email if they aren't on Skilient, 5.30).
   - Multi-session events check in per session.
   - A live headcount over Realtime.
   - The existing rotating self check-in code (5.23) stays as an option.
5. **Close-out** (open for 72 hours after the last session ends), a checklist:
   1. **Fix attendance:** a manual add or removal needs a reason and is audited.
   2. **Enter results:** placings for competitions and hackathons, per person or per team.
   3. **Log volunteer hours:** per person, capped at the activity's length.
   4. **Issue entries:** a preview ("212 Attended · 3 Results · 14 Volunteer") → **Issue** → entries are queued and signed, and recipients are notified.
   - If the host does nothing, **Attended** and **Completed** entries issue on their own at 72 hours (question 3). Results and hours always need the host.
6. **After.**
   - Attendee CSV (formula-escaped, `lib/uni/csv.ts`).
   - A feedback summary once the 7-day form closes: aggregate only, with groups under 5 suppressed.
7. **Cancel.** Every registrant is notified, nothing is issued, and the page shows "Cancelled · <time>".

#### Society events: activity flow (student)

1. **Discover:** an Event post in the feed, the Openings "Events" card, `/events` (calendar and list, own university first), the society page, and "3 friends going" (friends' registrations only, never strangers').
2. **Event page:**
   - agenda, host societies, seats left, what you'll earn ("Attended entry on your Record")
   - when you can't attend, a flat button with the reason ("For BSCS 2027 only", "Registration opens 14 Nov · 10:00")
3. **Register:**
   1. The form.
   2. Ticket type.
   3. Team, when the event uses teams: create one and invite by username, or join with a team code.
   - Outcome: **Confirmed** (ticket issued), **Pending approval**, or **Waitlisted · #4** (promoted automatically in order, with a notice).
4. **Ticket** (`/events/[id]/ticket`, also listed in Me → Tickets):
   - A signed QR (an HMAC of event, ticket and user, keyed by the event secret) that works offline once opened, with a "turn up your brightness" hint.
   - Reminders 24 hours and 1 hour before (push, email or in-app, by prefs).
   - Cancelling frees the seat and promotes the waitlist.
5. **At the venue:** show the QR, or self check-in by scanning the host's rotating code.
6. **After:** "New on your Record" → the Record. An optional feedback form stays open for 7 days.

#### Paid tickets: pay the society directly, upload the receipt (Ahmed, 2026-11-02)

A ticket type is free or paid. **Skilient never handles the money.** The student pays the society directly (bank transfer, JazzCash or Easypaisa) and uploads the receipt, and an officer confirms it. There is no gateway, no payout, no Skilient fee and no Skilient refund. Paying buys a seat, never proof or rank: the Record entry is the same as for a free ticket, and attendance entries never add rank (5.30).

**Society payment details** (Society manage → Payment details):
- Up to 3 methods. Bank transfer: bank, account title, account number or IBAN. JazzCash or Easypaisa: account title and number.
- Any officer can propose a change, but it **takes effect only after a second officer confirms it**. Every officer is notified and the change is audited. Why: a hijacked officer account changing where money goes is the main scam risk.
- Students see the details only after picking a paid ticket, with "Updated <date>".
- A society with no confirmed payment details can't publish a paid ticket type.

**Buying (student)**, flow B step 3 with payment:
1. Form → paid ticket type. The sheet shows:
   - the amount
   - the society's payment details
   - a **reference code** to put in the transfer note (for example `SKL-7F3K`)
   - the refund policy
   - the line "You pay CS Society directly. Skilient doesn't handle the money."
2. The seat is **held for 24 hours** for the student to pay and upload.
3. **Upload the receipt:** a screenshot (PNG, JPEG or WebP, 5 MB or less, re-encoded with EXIF stripped) or a PDF (`%PDF-` check), plus an optional transaction ID → status **Payment under review · 14:02**. The hold lasts until an officer decides.
4. **The officer reviews** (event manage → Payments): receipt, amount, reference code, transaction ID, uploaded time.
   - **Approve** → Confirmed, the ticket is issued, and the student is notified.
   - **Reject** with a reason ("Amount doesn't match") → the student can upload again within 24 hours, otherwise the seat is released.
5. **Duplicate check.** The same receipt image (perceptual hash) or transaction ID used on another registration in the same society is flagged on the review card ("Also uploaded for Ali Khan's registration · 12 Nov"). The officer decides; nothing is rejected automatically.
6. **No receipt in 24 hours** → the hold expires, the seat returns, and the student is told.
7. **Waitlist with paid tickets:** the promoted person gets the same 24-hour hold.
8. **Manual-approval events** ask for payment only after approval; the approval notice starts the 24-hour hold.

**Refunds** (between the society and the student):
- When publishing, the host states its policy: **no refunds**, or **refund until N days before**. It shows on the event page and the ticket.
- A student who cancels within the policy gets "Refund requested". An officer pays it back outside Skilient and marks **Refund sent** (an optional proof upload). The student can mark it **Received**, or **Not received**, which opens a report.
- **The host cancels a paid event** → every paid registrant is told "CS Society will refund you", and close-out lists every refund still to mark. A cancelled paid event with refunds unmarked after 14 days is flagged to staff.

**Disputes and limits:**
- "I paid but wasn't confirmed" and "Refund not received" go to the society first. After 72 hours with no answer they become a report case (5.12, target event registration).
- Staff never move money. They can pause a society's paid tickets or suspend the society.
- Prices are PKR 100 to 10,000 per ticket (`platform_config` `events.ticket_limits`).

**Privacy:**
- Receipts sit in a private bucket `event-receipts/{event}/{registration}`, visible only to the student, the society's officers and staff on a report.
- They are deleted 90 days after the event ends (`storage-cleanup`).
- The Payments tab and the receipt upload are on the never-recorded route list (`lib/analytics/privacy.ts`).

**Build:**
- `event_ticket_types.price_pkr`, `refund_policy`.
- `society_payment_methods` (proposed_by, confirmed_by, effective_at).
- `event_payments`: registration, reference_code, receipt_path, receipt_hash, transaction_id, status (awaiting, under_review, approved, rejected), decided_by and decided_at, refund_status (requested, sent, received, disputed).
- `submit_receipt`, `review_payment`, `mark_refund_sent`, `confirm_refund`.
- Holds expire in `event-tick`.
- The receipt is checked in a server action the same way as credentials (`lib/actions/credentials.ts`).
- The agreement and privacy notice must say that Skilient isn't a party to ticket payments and that receipts are stored (`docs/archive/supabase-era/setup-checklist.md`).

#### Build: societies and events

- **Society tables:**
  - `societies`: university, slug, name and normalised name, category, about, logo, cover, status (pending, more_info, verified, rejected, suspended), membership_mode, verified_by, verified_at.
  - `society_members`: role (president, officer, member), title, term_start, term_end, team_title.
  - `society_follows`.
  - `society_requests`: the proof document in a private bucket `society-documents/{society}/`, following `submit_org_document`.
  - `induction_rounds`, `induction_roles`, `induction_questions`, `induction_applications` (following `venture_roles`, `venture_questions`, `application_threads`).
  - Staff `ops_societies`, `ops_society_case`, `claim_society`, `decide_society` (the `decide_org` pattern, audited).
  - `posts.society_id`; `can_view_post` unchanged (society posts are university posts).
- **Event tables.** `events` gains `society_id`, `status` (draft, published, live, ended, cancelled), `record_kinds`, `team_size`, `approval_mode`, `registration_opens_at`, `registration_closes_at`, `eligibility` jsonb; plus:
  - `event_sessions`
  - `event_ticket_types`
  - `event_questions`
  - `event_registrations` gains ticket_type, status (confirmed, pending, waitlisted, cancelled), waitlist_position, answers, team_id
  - `event_teams`
  - `event_staff`
  - `event_checkins` (per session)
  - `event_results`
  - `volunteer_logs`
  - `event_feedback`
- **Concurrency.** Seats and waitlist promotion run under a row lock per ticket type (the fair-queue pattern, `tests/worker/fair-queue.test.ts`); a concurrency test proves no oversell.
- **Event posts.** The `post_events` type becomes officer-only (the insert path checks officer membership of `posts.society_id`); past student event posts stay readable with their RSVPs.
- **Check-in.** The scanner uses `BarcodeDetector`, with a small fallback decoder where it is missing. Codes are verified in SQL against `private.event_secrets`.
- **Jobs.** `event-tick` (every minute) moves statuses and sends reminders; `event-closeout` (hourly) auto-issues at 72 hours.
- **Gate.** The existing university events (5.23) stay behind the university portal flag.
- **Done when:**
  - a student requests a society, staff verify it, and the president runs an induction round end to end
  - an event can't oversell under parallel registrations
  - a scanned ticket checks in once and refuses a second scan with the first time
  - a student can't create an event
  - close-out issues Record entries to every checked-in attendee
  - a paid ticket is confirmed only when an officer approves the receipt, and an unpaid hold frees the seat after 24 hours
  - a payment-details change takes effect only after a second officer confirms it
  - a reused receipt or transaction ID is flagged to the officer
  - receipts are unreadable to anyone but the student, the society's officers and staff on a report
  - every screen passes axe in both themes
