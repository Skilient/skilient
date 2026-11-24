# Student-first plan (2026-11-02)

The current plan. It replaces the "launch everything at once" scope of PRD 4 until Ahmed says otherwise. The feature detail is in PRD 5.30–5.34, the screens in `screen-spec.md` §3.14, the phases in `build-plan.md` ("Student-first track"), open questions in `student-first-questions.md`, and every decision in `decisions.md` ("Student-first scope").

## The goal

Skilient becomes **the portal a student can't do university without**: "if a university student isn't on Skilient, they aren't in university". Recruiters and universities wait. Faculty stay.

## What we build

| Feature | PRD | One line |
| --- | --- | --- |
| **The Record** (headline) | 5.30 | A signed, verifiable co-curricular transcript. Verified societies and Skilient issue entries, only through Skilient, so receiving one needs an account. Merit entries move rank slightly (formula v2) |
| Societies and society events | 5.31 | Society pages, officers, inductions; events with stepper creation, form builder, free and paid ticket types (paid directly to the society; the student uploads the receipt and an officer confirms it), waitlist, teams, signed tickets, scanner check-in, close-out that issues Record entries. Students can't create events |
| Paths, proof tasks, skill swap | 5.32 | "What do I even learn?": skills in the order seniors proved them, a task per next skill that becomes evidence, and learner-confirmed teaching that lands on the teacher's Record |
| ~~Digital yearbook~~ | ~~5.33~~ | Removed 2026-11-23, see decisions.md |
| Openings, share-to-chat, people you may know, push | 5.34 | One page of category cards with the latest opening on each; share a post into a DM or venture chat; suggestions with reasons; an installable app with web push |

## The loop: one semester with Ali

1. Ali attends the CS Society's React workshop. The society adds walk-ins by university email, so he gets "Your entry for Build with React is waiting" and signs up to claim it.
2. Onboarding ends on "1 entry waiting", and his Record holds its first sealed entry.
3. The Openings "Society inductions" card features "CS Society · Design team · closes 20 Nov". He applies and is accepted.
4. He follows the Frontend path. Its next square is TypeScript. He starts a proof task and links his repository; the GitHub scan proves the skill. That's a new Record entry, and the next square lights.
5. For React he asks a senior through a skill swap. After 3 confirmed sessions, the senior's Record shows "Taught React · 4.5 h".
6. He shares an informative post into his venture chat.
7. The next year he's Design Lead, and his check-ins issue other people's entries.
8. In final year he attaches his Record transcript to a scholarship application. (~~He signs batch-mates' yearbook pages~~: the yearbook was removed 2026-11-23.)

Every step starts with someone else's action that needs an account to receive.

## Rejected (2026-11-02): don't propose these again

- **Campus structure:** spaces (university, department, batch or study-group spaces), course spaces, My Day, timetable, course resources (notes and past papers), campus Q&A.
- **Social:** group chats (only DMs and venture chats), the 24-hour "now" status line, fresher buddy.
- **Utilities:** campus board (buy, sell, lost and found), attendance tracker.
- **Faculty tools:** official course spaces, office hours, the FYP hub, research and lab openings, recommendation letters, society advisor, class pulse.
- **Other proof sources:** internship logbook, freelance proof, group-work receipts.
- **Post signals:** likes, reactions and saves on posts (share-to-chat is the only addition).

## Portals

- **Off by flag:** recruiter and university portals. `platform_config` `portals.enabled` = `{recruiter:false, university:false, faculty:true}`.
  - `lib/auth/gate.ts` 404s `/recruit`, `/org`, `/uni`, `/companies` and `/fairs`.
  - `validate_signup` refuses recruiter and official signups.
  - Recruiter bits are hidden on student surfaces.
  - Code stays; switching the flag back restores the portals.
  - Existing recruiter and university-official accounts are deleted in phase 14 (Ahmed, 2026-11-02).
- **Faculty** stays live as it is (ideas, supervision, reviews, code checks, endorsements, judging) and gets the redesign. New faculty work waits for Ahmed's direction (question 10).
- **Marketing.**
  - `/recruiters` and `/universities` keep their URLs; their calls to action become "Talk to us" (`submit_sales_lead` → `/ops/leads`).
  - `/pricing` → `/features` (308). `/features` lists student features, Student Pro (no price), faculty, and organisations with "Talk to us".
  - Organisation signup and claim routes redirect to `#talk`.
  - The landing story features The Record once it is live (landing copy never claims what isn't live).

## How the app looks

The app adopts the neumorphism brief from the marketing branch (`claude/wonderful-feynman-rmrfgy`, `app/(marketing)/CLAUDE.md`). This supersedes the 2026-10-31 line "the app keeps PRD 9". **One system, two densities:**

1. **Root tokens.** The branch's contrast-checked `.neu` token block (light #E6E1D8, dark #2A2723) moves into `app/styles/tokens.css` with the PRD 9 semantic names re-pointed, so every existing component follows. The component classes (`neu-card`, `neu-btn`, `neu-well`, `neu-tile`, tier finishes) move to a shared `app/styles/neu.css`.
2. **App density.** Radii 24/20/14 (marketing uses 32/24/16); mostly `raised-s`/`raised-m`; `raised-l` only for sheets and dialogs; smaller shadows on phones; `content-visibility: auto` on long lists, because doubled blurred shadows are a paint cost on a mid-range Android.
3. **Fonts.** Space Grotesk replaces Barlow app-wide; the CV keeps Barlow; Spectral only for belief moments (tier-up, the Record and certificates; ~~the yearbook~~, removed 2026-11-23); JetBrains Mono for proof.
4. **Primitives** (`components/ui/`), rebuilt to the brief and the Figma moodboard:
   - Button with a timed variant; Field with four states; Tabs as an inset track; Switch; Checkbox
   - Avatar with tier ring and seal; TierBadge and Seal (from `components/marketing/neu.tsx`); SkillChip; status tag
   - Dialog and Sheet; Toast with time and undo; EmptyState with a 3D object; Skeleton as static wells
   - New: `DomainCard`, `VentureCard` (the team tray: avatars plus open slots as pressed holes), `StatTile`, `Ladder`, `CommandMenu` (⌘K), `Ticket`, `RecordEntry`, `Stepper`.
5. **Shell.**
   - Desktop: a two-tier sidebar (a raised rail of places plus the levels inside).
   - Header: search well, ⌘K, notifications, avatar.
   - Phone dock: **Home · Openings · Ventures · Chat · Me**. Me holds Record, Paths, Tickets, Skills, CV and Score.
   - Secondary: Societies, Events, ~~Yearbook (final year)~~ (removed 2026-11-23), Explore, Leaderboard, Friends, Notifications.
6. **3D objects at earned moments only** (never in navigation):
   - existing renders: medallions, seal, ticket, tray, bulb, envelope, campus, chai
   - new renders from `scripts/renders/objects.py`: a society banner, a check-in stamp, a ledger book, ~~a yearbook~~ (removed 2026-11-23)
   - AVIF/WebP, 30 KB or less on phones
7. **Post card.** Name first; the survey strip in a well; Comment and Share visible; Not for me, Mute and Report move into a `⋯` menu.
8. **Ops** keeps its dense PRD 9 look by wrapping its layout in `.classic`.
9. **Contrast.** `tests/unit/tokens-contrast.test.ts` checks every token pair at build time; axe runs in both themes.

## Phases

Five build phases, **each built in one go: one session and one PR per phase, no slices** (Ahmed, 2026-11-02). The detail and "done when" lines are in `build-plan.md`. The session prompt for each phase is in `student-first-prompts.md`.

| Phase | What it builds |
| --- | --- |
| 14 New look | Portals flag, marketing routes, `/features`, delete recruiter and official accounts · Design system in the app · Shell and core screens |
| 15 Societies and events | Societies · Events, registration, tickets · Check-in, close-out, export · Paid tickets (receipt upload and review) |
| 16 The Record | Entries, signing, verify, issuing, formula v2 · `/me/record`, PDFs, share, CV, claim by email, corrections · Landing story update |
| 17 Growth | Paths and proof tasks · Skill swap |
| 18 Community | Openings · ~~Yearbook~~ (removed 2026-11-23) · Share-to-chat, people you may know, PWA and push |
| 13 (rest) | Load test, design gates on the new design, launch gate |

**Checklist for every new table or feature:**
- RLS default deny, plus a pgTAP refusal test
- `refuse_if_restricted`
- a `submit_report` target
- `storage-cleanup` per bucket
- `private.track()` and `SERVER_EVENTS`
- `config_keys` rows
- staff writes audited before and after (pgTAP `49`)
- `OPS_AREAS`
- `tests/e2e/sweep-routes.ts`
- E2E with axe in both themes
- `notification_types` plus wording in `describe.ts`
- new Vault secrets in `reseed-vault.sql`
