### 5.34 Openings, share-to-chat, people you may know and push (decided 2026-11-02)

#### Openings (replaces the Opportunities hub in 5.25)

Opportunities is renamed **Openings**. It is **one page of category cards**: a bento grid across the page, not carousels or scrolling rows. Each card features its category's **latest opening**. Clicking a card opens that category with every opening in detail.

**Activity flow**
1. **`/openings`**, a grid of `DomainCard`s (the brief's domain card: a colour band and a pictogram per category).
   - Each card shows:
     - the **latest opening**: its title, host and deadline in mono
     - the count ("12 open")
     - "updated 2 h ago"
     - a dot when something is new since the last visit
   - Cards while the recruiter and university portals are off:
     - **Venture roles:** open roles, matched to the student's skills
     - **Society inductions** (5.31)
     - **Events:** society events open for registration (5.31)
     - **Project ideas** (faculty, 5.21)
     - **Paths:** the student's next square (5.32)
     - **Skill swaps:** teachers for the student's wants (5.32)
     - **This week:** the campus pulse
   - **Jobs, Contact requests, Applications and Job fairs** return as cards when the portals are switched back on (decisions 2026-11-02).
   - Phones: the grid collapses to one or two columns; it is still one page of cards.
2. **A card opens `/openings/[category]`**: the full list with filters and sort (deadline soonest, newest). Items matching the student's skills and paths come first; nothing is ever ordered by payment.
3. **Items open their own pages:** venture role apply, induction apply, event page, idea page, the path square, the swap profile.
4. **This week**, recomputed nightly:
   - the week's most informative posts at the student's university (the micro-survey line, never a like count)
   - upcoming events
   - new inductions
   - newly started ventures
5. **Empty card:** a render, one honest line ("No inductions open at NUTECH yet") and one action ("Request a society").

**Build.**
- `openings_overview()` returns one jsonb holding each card (latest item, count, updated_at) in one call.
- `openings(category, cursor)` returns a page of items. It replaces `opportunities(tab)`, which stays as a wrapper while the portals are off.
- `/opportunities/*` gets a 308 redirect to `/openings/*`.
- The nav badge key `opportunities` becomes `openings`.
- **Done when:**
  - the grid loads in one SQL call
  - every card has loading, empty and error states
  - no category is ever ordered by sponsorship

#### Share-to-chat (supersedes "no share-to-chat" in 5.28 and CLAUDE.md)

1. A post's **Share** → a sheet listing the student's recent DMs and venture chats, with search. Pick up to 5, add an optional note, then **Send** → toast "Sent to Hira · 14:02 · Undo" (10 seconds).
2. The recipient sees a post card in the chat. If `can_view_post` fails for them (another university's university post, a block, a removal, a deletion), the card says "This post isn't available".
3. Chat rate limits (30 messages a minute) and blocks apply. Shares are **never counted or shown** on the post. Likes, reactions and saves stay out.
4. **Build:** `chat_messages.shared_post_id` (nullable FK, set null on delete), `send_message` accepts it, and `post_cards(ids)` renders the card for the viewer.

#### People you may know

- Shown on Friends and Explore. Each suggestion carries its reason ("Same batch · 4 mutual friends", "In CS Society with you").
- Sources: same department and batch, mutual friends, shared ventures, shared societies.
- People from other universities appear only through a shared venture or society.
- Dismissable; a dismissed person never returns. Blocks and mutes are respected.
- **Build:** `people_you_may_know(limit)` with a score from those sources; dismissals stored in `pymk_dismissals`.

#### Installable app and web push (supersedes 5.25's "no installable app, no push")

- **PWA:** a web app manifest and a service worker that caches the shell and the open ticket (5.31). There is no offline feed.
- **Push** is offered after the first meaningful action, never on first load (for example after registering for an event: "Get reminded on your phone?").
- Per-category push preferences in `/settings/notifications`, next to instant email and digest.
- What is pushed: chat messages, event reminders and changes, new Record entries, induction results, swap requests and session reminders, yearbook notes.
- **Build:** `push_subscriptions`; the `notify-worker` gains a push channel (Web Push with VAPID keys in Vault, `reseed-vault.sql`); CSP allows the push service's endpoint only from the worker. The keys go on `docs/setup-checklist.md`.
- **Done when:** a registered student gets the 1-hour reminder as a push on a phone, and turning the category off stops it.
