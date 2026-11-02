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
      - ticket types (for example Participant or Audience), each with a capacity and free or a price in PKR (paid tickets need a verified payout account, below)
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

#### Paid tickets and payouts (Ahmed, 2026-11-02: paid and free tickets)

A ticket type is free or paid. Paying for a ticket buys a seat, never proof or rank: the Record entry is the same as for a free ticket, and attendance entries never add rank (5.30).

**Who can sell.**
- Only a **verified** society with a **verified payout account** can publish paid ticket types.
- **Payout account:** the president or treasurer submits the account holder's name, bank and IBAN, plus a CNIC photo whose name matches the holder.
  - Staff check it in an `/ops` queue (audited); the CNIC image sits in a private bucket and is deleted 30 days after the check.
  - A changed account needs a fresh check and pauses payouts until it passes.

**Prices and fees.**
- PKR only, through the local gateway (5.24, `BILLING_GATEWAY_LOCAL`).
- Each ticket costs between PKR 100 and PKR 10,000, within `platform_config` `events.ticket_limits`.
- The buyer pays the listed price.
- The gateway fee and the Skilient fee (`events.ticket_fee_bps`, 0 until Ahmed sets it; question 18) come out of the payout. The event page and the society's dashboard show both.
- The price is always read in SQL from `event_ticket_types`, never from the client (CLAUDE.md).

**Buying (student), flow B step 3 with payment.**
1. Form → paid ticket type → **Pay PKR 500**. This creates a checkout session (`create_checkout` with subject `event_ticket`, priced in SQL), then the gateway page, then `/billing/return/[session]`.
2. The seat is **held for 15 minutes** while payment is pending. If payment fails or the hold expires, the seat returns to the pool.
3. Payment succeeded (gateway webhook through `record_billing_event`) → **Confirmed**, the ticket is issued, and a receipt is sent: an invoice in the immutable invoice series, issued by Skilient "on behalf of <society>".
4. Manual-approval events take payment **after** approval: the approval notice carries a 48-hour payment link.
5. **Waitlist with paid tickets:** the promoted person gets a 24-hour hold to pay before the seat moves to the next person.

**Refunds.**
- The host picks a refund policy when publishing: **no refunds**, or **full refund until N days before** (shown on the event page and the receipt).
- A student cancels within the policy → an automatic full refund through the gateway adapter's `refund` → the seat frees and the waitlist is promoted.
- **The host cancels the event** → every paid ticket is refunded in full automatically, and the society bears the gateway fee.
- A credit note is issued in the `-CN` series for every refund.

**Payouts.**
- Each event's ticket money is held until **7 days after the event ends**, the refund and dispute window.
- Staff then pay the net amount (sales minus refunds, gateway fee and Skilient fee) by bank transfer to the verified payout account, and mark the payout paid with the transfer reference. This is audited, and the society sees a statement.
- Payouts are manual and weekly at first (question 19); automate when the gateway supports splits.
- **Chargebacks** come out of the society's next payout. A negative balance pauses paid tickets for that society until it is settled.

**Limits.** At most 3 paid events live per society at once until its first payout succeeds. Staff can pause a society's paid tickets.

**Build:**
- `event_ticket_types.price_pkr`, `refund_policy`.
- Billing subject `event_ticket` in `create_checkout`, with `billing_apply_event` confirming the registration.
- `event_payments` (link to `payments`), `society_payout_accounts` (status pending, verified, rejected), `society_payouts` (period, gross, refunds, fees, net, status, reference).
- Staff `ops_payout_accounts`, `ops_payouts`, `mark_payout_paid`, audited before and after.
- A `refund_ticket` path through the billing worker.
- **Legal before going live:** the merchant agreement must allow collecting on behalf of societies (`docs/setup-checklist.md`).

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
  - a paid ticket is confirmed only by the gateway webhook, and a held seat returns after 15 minutes unpaid
  - cancelling an event refunds every paid ticket with a credit note
  - a payout's net equals sales minus refunds and fees, and only staff can mark it paid
  - every screen passes axe in both themes
