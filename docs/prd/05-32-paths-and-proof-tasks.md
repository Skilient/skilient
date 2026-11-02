### 5.32 Paths, proof tasks and the skill swap (decided 2026-11-02)

The pain students voice most is "what do I even learn?". Skilient answers it from its own evidence:
- **Paths** show which skills seniors proved, in the order they proved them.
- **Proof tasks** turn each next skill into practice that becomes evidence.
- **The skill swap** lets students teach each other, with the teaching recorded.

No AI anywhere: paths come from aggregate data, tasks from a staff-written bank, and verification from GitHub, peers or code checks.

#### Paths: activity flow

1. **Pick** (`/me/paths`):
   - About 8 role cards at launch: Frontend, Backend, Mobile, Data, Machine learning, DevOps, UI/UX, Product.
   - Each card has a pictogram and its source: "Based on 48 seniors' records", or **Starter path** while data is thin.
   - A student follows up to 2 paths.
2. **Path view**, a ladder of squares (the `Ladder` primitive) in the order seniors proved the role's skills:
   - **Proved:** ticked, with the date the student reached L2.
   - **In progress:** a task is started.
   - **Next:** lit, one at a time.
   - **Later.**
   - Footer: "4 of 11 proved · next: TypeScript".
3. **A square opens the skill drawer:**
   - why it is here ("Seniors proved it after React, median 3 months later")
   - the student's evidence so far (from `my_skill_proofs`)
   - 2–3 proof tasks by difficulty
   - skill swap teachers at their university
   - ventures and inductions that need the skill (from Openings)
4. **Where it shows:**
   - The Home progress card's next step points at the next square.
   - The Openings "Paths" card shows the student's next square.

**How the order is computed.**
- A path's skills are a set from the skill taxonomy (`lib/github/taxonomy/skills.yaml`).
- The order is the median first-L2 date among students who reached **Shine or higher** and hold at least 60% of the role's skills at L2.
- Aggregate only: a path needs at least 10 such students, otherwise it shows the config **Starter path** (`platform_config` `paths.seed`, staff-edited, schema-checked).
- Recomputed weekly. Never per university when that group is under 10 (`private.suppress_groups`).

#### Proof tasks: activity flow

1. **Start** (from a square): the task page shows the brief, an acceptance checklist (3–6 items) and the skill.
   - "Link repository": a pick from the student's connected GitHub repositories; with no GitHub connected, the connect step comes first.
   - At most 3 active tasks per student.
2. **Submit**, then verification in order:
   1. **GitHub:** the linked repository is rescanned (the `harvest`/`extract` stages). If the skill reaches L1 or L2 from commits in that repository since the task started, the task is **Done** automatically.
   2. **Peer review:** otherwise, 3 eligible peers are offered: L2 or higher in the skill, any university, not flagged in a ring with the student, not friends with them. The first to accept reviews against the checklist and answers **Confirm** or **Needs changes** (a note is required).
   3. **Code check:** where the skill has code-check prompts (5.5 code checks), the student can choose one instead.
   - States: Submitted → Verifying → Awaiting peer → Done, or Needs changes → resubmit. A task nobody reviews within 7 days is offered to 3 more peers.
3. **Done:**
   - a skill evidence row (kind `proof_task`)
   - a Skilient **Proof task** Record entry (5.30)
   - the square ticks, the next square lights, and the progress card updates
4. **Peer side.**
   - The peer is notified ("Can you check Hira's TypeScript task?") and gets a review page with the checklist and the repository link.
   - At most 5 reviews a week.
   - A peer who declines is never asked again for that task.
   - Reviews are counted for anti-gaming but earn no Record entry.

Tasks come from a staff-written bank (`proof_tasks`, edited in `/ops/config` like `code_check_prompts`): title, skill, difficulty, brief, checklist. There are no student-written tasks at launch.

#### Skill swap: activity flow

1. **Set up** (`/swaps`, also the Openings "Skill swaps" card):
   - **I can teach:** skills where the student is L2 or higher; the verified level is shown.
   - **I want to learn:** any skill.
2. **Match:**
   - For a want: teachers at the same university, with their level, hours taught and approved thank-you notes.
   - For an offer: open requests.
   - The path drawer links here ("3 seniors teach React in swaps").
3. **Request** (learner): "Ask Ayesha to teach SQL", with a note, preferred times, and optionally a skill offered back (a **mutual swap**). The teacher accepts or declines within 7 days, after which it expires.
4. **Accepted:**
   - A DM opens between them (the same unlock rule as an accepted venture application, 5.9).
   - Either side proposes a session (date, time, length, a place or link) → the other accepts → both get reminders.
5. **After each session**, the learner is asked "Did your session with Ayesha happen?":
   - **Yes:** confirm the length, plus an optional **thank-you note** (up to 280 characters), shown on the teacher's profile once the teacher approves it.
   - **No:** a no-show reason.
   - No ratings, no stars, no counts of anything but confirmed hours.
6. **Close:** either side ends the swap, or it closes after 30 days with no session. If at least one session was confirmed, the teacher gets a Skilient **Taught** Record entry: "Taught SQL to Hira · 3 sessions · 4.5 h". In a mutual swap each side gets one.
7. **Limits and safety:**
   - one open swap per pair per skill
   - at most 10 confirmed hours per pair per week
   - mutual-swap rings and rapid repeat confirmations are flagged in `anti_gaming_flags`
   - blocks end swaps
   - swaps are reportable

#### Build: paths, tasks and swaps

- **Tables:**
  - `paths` and `path_skills` (role, skill, computed order, source: data or starter)
  - `path_follows`
  - `proof_tasks` (staff bank)
  - `task_attempts` (user, task, repo, status, timestamps)
  - `task_reviews`
  - `swap_offers`
  - `swap_wants`
  - `swaps` (teacher, learner, skill, mutual_of, status)
  - `swap_sessions` (proposed, accepted, confirmed, no_show; length)
  - `swap_notes` (approved flag)
- **Functions:**
  - `private.compute_paths()` (weekly cron `paths-weekly`)
  - `my_paths()`, `path_view(role)`, `start_task`, `submit_task`, `review_task`
  - swap functions mirroring the venture application functions
  - the DM unlock extends the `send_message` rule
- **Evidence.** GitHub verification reuses the worker stages; `my_skill_proofs` gains kind `proof_task`.
- **Done when:**
  - a path shows the starter order with no data and the data order once 10 seniors qualify
  - a task linked to a repository that proves the skill completes without a peer
  - a peer can't review a friend's task
  - a swap with a confirmed session issues exactly one Taught entry
  - pgTAP refuses every cross-user write
