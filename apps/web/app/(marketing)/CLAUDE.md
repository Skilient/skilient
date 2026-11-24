# CLAUDE.md — Skilient UI

Rules for any UI work in this repo: new screens, redesigns of existing ones, and component changes. Three layers, applied in order:

1. **Design insights:** what Skilient's UI must communicate.
2. **Neumorphism system:** how it looks.
3. **UX laws:** how it behaves.

If they conflict, use this priority order: clarity, accessibility, user control, task completion, then visual style.

Figma source of truth: **Skilient · Neumorphism UI Moodboard**, https://www.figma.com/design/zwcLbhnTSznUEVYd2GMYsg
- Components there: `Button`, `Input`, `Toggle`, `Tab`, `Tier badge`, `Avatar`, `Domain card`, `Pictogram/*`.
- Effect styles there: `Neu/*`.
- Match them. Don't invent parallel versions.

---

## 1. Design insights

Skilient should feel like **a record you earn**: verified like a ledger, stepped like a ladder, credited by name.

### Seven moves
1. **One warm accent, many tints.**
   - Signal orange is the only accent.
   - Every other colour is a ramp of steps.
   - No rust + cobalt split.
2. **The six tiers are a ladder.**
   - Raw → Spark → Flare → Shine → Radiant → Luminary climb in brightness and finish.
   - Foil and iridescence are for Radiant and Luminary only.
3. **Proof as texture.** Tabular figures, mono metadata, hairline rules, and a timestamp on everything that changes.
4. **Earned objects, not flat pills.** Tier badges, the verified seal and name badges are raised objects you could hold.
5. **Names first.** Avatars, cards and pages lead with people: bylines, roll calls, portraits with context.
6. **Every state points to the next step.**
   - Empty states show the first square to fill.
   - Feedback shows a timestamp and what changed.
7. **One module, many domains.** Domain and venture cards share one layout, told apart by one colour and one pictogram.

### Five principles (check every screen against these)

| Principle | Rule | Shows most in |
|---|---|---|
| Proof | Every claim carries its evidence (source, date, count). Numbers align in columns. Nothing is decorated to look bigger. | Profile, CV, seal, forms, legal |
| Ascent | Progress is drawn as countable steps, never one vague bar. Higher tiers are brighter and sit higher. | Tier badges, tabs, pricing, progress |
| Recognition | A person's name comes before their stats. Work always shows who did it. | Avatar, venture cards, about |
| Synergy | Team elements overlap instead of sitting in separate boxes. Shared things share one light source. | Avatar stacks, overlays, team views |
| Momentum | Show recency: last active, streaks, a timestamp per change. Motion is short and purposeful. | Feedback, dashboards, landing hero |

**Tension:** Proof wants calm, Momentum wants energy. Keep surfaces calm and spend energy only on:
- the one accent
- one hero
- moments of progress

### Recurring motifs (anchor the system on the first three)

| Motif | Use it for |
|---|---|
| Steps / terraces / numbered levels | Tiers, tabs, pricing, onboarding |
| Seals and stamps | Verified mark, certificates, legal versions |
| Ledger type: tabular, mono, hairlines | Forms, stats, CV, legal |
| Names and numbers worn on the body | Avatar, profile card, about |
| One warm accent on calm ground | The primary action, one loud moment per page |
| Overlapping layers | Overlays, avatar stacks, team views |
| Foil / iridescence | Radiant and Luminary only |
| Streaks / contribution grids | Activity, empty states, feedback |
| Woven lattice / mesh | Backgrounds and placeholders, at low contrast only |

The charpai weave and the dhaba chai table are the local references: quiet texture that roots the product in Pakistani campuses.

---

## 2. Neumorphism system

### Model
- **One surface colour.** Every element is extruded from, or pressed into, that same surface.
- **One light source, top left.** A white highlight goes up-left and a warm shadow goes down-right. Never flip it.
- **Depth carries meaning:**
  - **Raised** = can be pressed or lifted (buttons, cards, chips, tiles, knobs).
  - **Pressed (inset)** = active, selected, filled in, or a place to type (input wells, active nav, pressed buttons, tab tracks, progress tracks, empty cells).
  - **Flat** = plain content (text, skill chips, hairline-outline tertiary actions).
- **Layers ("strata").** Page → card → tile → chip, each one step higher. Never use three greys to fake depth.

### Tokens

```css
:root {
  /* surface + light */
  --surface:        #E6E1D8;  /* the one background, everything sits on it */
  --light:          #FFFFFF;  /* highlight, top-left */
  --shade:          #BCB2A2;  /* shadow, bottom-right */

  /* palette */
  --paper:          #F1EEE8;
  --concrete:       #B7B3AB;  /* hairlines, disabled */
  --jute:           #C6A16A;  /* warm secondary, Raw tier */
  --mustard:        #D6A21E;  /* Shine tier, highlights */
  --signal:         #E1592B;  /* THE accent: primary action, first spark */
  --signal-pressed: #C94A20;
  --signal-tint:    #EAAB93;  /* Spark tier */
  --ink:            #1B1B19;  /* text, dark primary, specimen trays */
  --muted:          #6F695F;  /* secondary text */
  --synergy:        #4A8BD6;  /* teams/overlap + focus ring only */
  --error:          #B8233A;  /* kept clearly apart from orange */

  /* elevation (match Figma effect styles Neu/*) */
  --raised-l: 12px 12px 28px rgba(188,178,162,.75), -12px -12px 28px rgba(255,255,255,.95);
  --raised-m:  7px  7px 16px rgba(188,178,162,.75),  -7px  -7px 16px rgba(255,255,255,.95);
  --raised-s:  3px  3px  8px rgba(188,178,162,.70),  -3px  -3px  8px rgba(255,255,255,.90);
  --pressed:   inset 5px 5px 10px rgba(188,178,162,.80), inset -5px -5px 10px rgba(255,255,255,.95);
  --pressed-s: inset 2px 2px  5px rgba(188,178,162,.80), inset -2px -2px  5px rgba(255,255,255,.95);
  /* the primary button is coloured, so it uses tinted shadows */
  --raised-signal:  7px 7px 16px rgba(180,68,29,.55), -7px -7px 16px rgba(255,255,255,.95);
  --pressed-signal: inset 5px 5px 10px rgba(142,52,18,.70);

  /* radius */
  --r-pill: 999px; --r-card: 32px; --r-tile: 24px; --r-well: 16px; --r-chip: 999px; --r-tag: 6px;

  /* type */
  --font-serif: "Spectral", serif;          /* belief: landing headlines, manifesto, certificates */
  --font-ui:    "Space Grotesk", sans-serif; /* all interface text */
  --font-mono:  "JetBrains Mono", monospace; /* proof: dates, IDs, hashes, counts, metadata */
}
```

| Elevation | Use |
|---|---|
| `raised-l` | Dialogs, sheets, hero cards |
| `raised-m` | Cards, buttons, tiles |
| `raised-s` | Chips, knobs, small controls |
| `pressed` | Wells, pressed states, tracks |
| `pressed-s` | Checkboxes, small wells, empty grid cells |

### Hard rules
- **Backgrounds**
  - Every parent background is `--surface`. Neumorphism breaks on any other background.
  - Don't put raised elements on white, or on a different grey.
  - Parents must not clip children's shadows (`overflow: visible` or enough padding).
- **Shadows**
  - Shadow pairs only: never a single drop shadow.
  - Never stack raised inside pressed inside raised more than 3 levels deep.
- **Colour**
  - One primary per view, in `--signal` (or `--ink` where orange would be a second loud moment).
  - Secondary actions are raised surface buttons. Tertiary actions use a 1px hairline outline.
  - Never use a second accent hue. Blue appears only for the focus ring and team/overlap meaning.
- **Contrast (neumorphism's known weak spot)**
  - Shadows alone never carry state. Pair depth with at least one of: colour, icon, label change, or weight.
  - Body text is `--ink` on `--surface`, at least 4.5:1. Muted text must still pass 4.5:1 at its size; increase its weight or size if not.
  - Check token pairs at build time.
  - Disabled = flat (no shadow) + `--concrete` text + `aria-disabled`, never just lighter shadows.
- **Focus**
  - Visible `2px` `--synergy` ring, offset 2px, on every focusable element.
  - Focus and error must never share a colour.
- **Motion**
  - Pressing animates from raised to pressed shadows in 120–160ms ease-out.
  - Progress fills, never spins.
  - A tier-up gets one moment of light.
  - Nothing loops for its own sake. Respect `prefers-reduced-motion`.
- **Texture** (weave, mesh, grain): background only, at low contrast, never under body text.

### Typography
- **Serif:** belief moments only (landing headline with an italic turn, about manifesto, certificates).
- **Grotesk:** every label, button and line of body copy.
- **Mono:** proof (dates, IDs, commit hashes, counts, metadata captions).
- **Tabular figures** (`font-variant-numeric: tabular-nums`) wherever numbers stack: stats, pricing, ledgers, tier counts.
- **Visible scale:** 48 / 36 / 28 / 20 / 16 / 14 / 12.
- **Milestones:** one big numeral as the hero of a panel.

### Iconography
- **Line icons for interface chrome.**
  - One stroke weight (1.8px on a 24 grid), round caps.
  - Shapes from the keyword map: check, steps, brackets, hash, fingerprint whorl, knot.
- **3D objects only for earned moments:** achievements, empty states, trophy shelf. Never in navigation, never as a game skin.

### Tier ramp

| Tier | Finish |
|---|---|
| Raw | Matte jute/concrete |
| Spark | `--signal-tint` |
| Flare | `--signal` |
| Shine | Mustard-gold gradient |
| Radiant | Foil gradient + soft glow |
| Luminary | Iridescent (angular gradient) + glow |

Rules for the ramp:
- Same shape for all six; only brightness and finish change.
- Ribbon or step height can be a second cue.
- Never give foil or glow to Raw–Shine.

---

## 3. Components

| Component | Rules |
|---|---|
| **Button** | Pill or keycap, raised at rest, inset when pressed. **Timed variant** for verify/submit: an inset track fills orange while running, then shows `✓ Verified · 14:32`. Minimum height 48px. |
| **Input** | Inset well on the surface, label above, 56px tall. Four distinct states: **Default**; **Focus** (blue ring); **Error** (red ring + icon + plain-language message + time); **Verified** (seal + mono metadata). Numbers in tabular mono; IDs, links and dates in mono. |
| **Toggle / checkbox** | Toggle: inset track with a raised knob, orange track when on. Checked checkbox: raised ink box with a white check. Settings rows put the label first and the control second. |
| **Tabs** | Inset track. The active tab is raised out of it, with its count in mono orange. A hairline underline is only for quiet secondary navigation. Order tabs the way users climb: overview first. |
| **Tier badge** | See the tier ramp above. |
| **Verified seal** | 18-point notched seal in ink with a white check. Full size on profiles and certificates; small (24–28px) on avatars. |
| **Skill chip / status tag** | Skill chips are flat, hairline, with a mono count. Status tags are square-cornered with a tint. Never reuse the tier badge shape for either. |
| **Avatar** | Tier ring + corner seal (if verified). Initials fallback uses the tier colour, never grey. Teams overlap with the lead in front. Profile cards go name → university · batch → tier → stats. |
| **Overlays** | A dialog asks one question with pill choices; a delete confirm puts the safe option first. Sheets sit over a blurred scrim, one level higher. Command menu on ⌘K. A single urgent action may rise as an orange bottom sheet. |
| **Feedback** | Toasts carry a time and an undo. Empty and error are **different states**: empty shows the first square to fill; error says what failed, when, and how to retry. Progress is steps, dots or a streak. Status that decays over time is a gauge. |
| **Shell** | Two-tier sidebar: a raised rail for places plus a list for the levels inside them. Header: search well + ⌘K + notifications + avatar. Dashboards: stat tiles in tabular mono, one big number per tile. Project work: board view of columns of raised cards in inset lanes. |
| **Cards** | **Domain card:** one module (colour band, pictogram in a raised well, name, mono metadata such as members, open roles, updated); change only the colour and the pictogram. **Venture card:** adds a byline (avatar stack + "Name and N others"), a pinned highlight in a well, last-activity time, and Join as the primary. **Tall cards:** one illustration + one line, like stepping stones. |

### Pages
- **Landing**
  - A verified record in the hero (CV card with seal, tier, timestamps), never a grey placeholder.
  - One promise, one button.
  - Energy comes from type, a big numeral, or one orange gradient. No stock photos.
- **Product:** explain in levels (Proof → Ascent → Recognition), show the product window early, stat tiles for countable things.
- **About:** a statement, then a roll call of portraits with context. A serif manifesto.
- **Pricing:** plans grow small-to-large. One pinned plan, in ink. Plans first, then a comparison table with aligned checkmarks.
- **Legal:** a ledger with numbered short sections in a narrow column. The version line (effective date, version, change log) is in mono and visible. A quiet seal marks the current version.

### Avoid
- Two accents fighting.
- Foil or gradients everywhere.
- The same pill for everything.
- Grey placeholders used as design.
- One shared state for empty and error.
- Inflated numbers: no vanity stats, no rounded-up counts, no "top talent" claims.
- A game skin.
- Decorative motion.
- Shipping default-kit (shadcn) styling as the final look.
- Too much texture.

---

## 4. UX laws (apply on every screen)

| # | Law | Do |
|---|---|---|
| 1 | Hick | One purpose per screen. Cut low-priority options. Split big decisions into steps. Recommend an option when choice is hard. |
| 2 | Fitts (size) | Targets at least 44×44px (48px buttons). Generous spacing. Never a tiny icon as the only target; pad the hit area. |
| 3 | Jakob | Conventional placement: nav left, search top, account top-right, settings in the account menu. Familiar icons. No novel patterns without a clear win. |
| 4 | Proximity | Group related labels/controls/info. Spacing shows relationships. Prefer space over borders. |
| 5 | Miller | Chunk long content. Split long forms into steps. Concise headings and labels. Never make users remember info across screens. |
| 6 | Doherty | Acknowledge every action within 400ms (the press state counts). Show loading/processing/success when not instant. Optimistic updates where safe. |
| 7 | Von Restorff | The primary action gets the strongest emphasis (the only orange, raised). One dominant CTA per section; secondaries quieter. |
| 8 | Fitts (proximity) | Actions sit beside the content they affect. Submit sits next to the last input. Frequent actions within reach. |
| 9 | Serial position | Most important first; final action/takeaway last; low priority in the middle. Order nav by importance. |
| 10 | Peak-end | A clear completion state: confirm what was done (with a timestamp), say what happens next. Never end on an empty screen. |
| 11 | Zeigarnik | Show done vs remaining steps. Autosave. Easy resume. Checklists for multi-step work. |
| 12 | Prägnanz | Simple structures, recognisable shapes, obvious hierarchy. Neumorphism stays restrained: depth only where it means something. |
| 13 | Defaults | Preselect the safest, most common option. Use known context (university, email domain, GitHub). No defaults that commit the user to anything. Every default is easy to change. |
| 14 | Postel (prevent) | Accept common input variants (GitHub URL forms, handles, spacing). Show requirements before submit. Disable impossible actions, flat with a reason. Warn before destructive actions. |
| 15 | Postel (recover) | Keep the user's input after errors. Plain-language cause + exact fix. Undo / retry / restore / cancel where relevant. |
| 16 | Similarity | Same look = same behaviour. Reuse existing components before creating new ones. Never give different actions the same treatment. |
| 17 | Uniform connectedness | Use shared wells/containers/states to tie controls to their content. Connection is deliberate, not decorative. |
| 18 | Parkinson | Fewer steps, fewer confirmations, prefill known data, shortcuts (⌘K) for repeat actions. |
| 19 | Tesler | Essential controls first, advanced on demand. The system absorbs complexity: never expose scoring internals, raw API states or schema terms. |
| 20 | Goal-gradient | Visible milestones through multi-step flows. Emphasise progress made. Make the remaining work specific ("2 steps left: link repo, confirm role"). |

### Implementation checklist (run before calling a UI change done)
1. State the user's primary goal for the screen.
2. Is the path to that goal the shortest clear one?
3. Is the next action visually obvious (one orange, raised)?
4. Is anything left that distracts from the goal? Remove it.
5. Does every interaction give feedback within 400ms?
6. Are errors prevented before they occur, and do they keep the user's work when they do occur?
7. Does completion clearly confirm what happened and what's next?
8. Neumorphism checks:
   - All surfaces `--surface`.
   - Shadow pairs follow the light direction.
   - No state carried by shadow alone.
   - Contrast passes.
   - Focus ring is visible.
   - Raised vs pressed matches meaning.
9. Principles check: Proof (evidence + time), Ascent (countable steps), Recognition (name first), Synergy (overlap), Momentum (recency).
10. Content is real or realistic: no lorem, no grey blocks, no inflated numbers.
