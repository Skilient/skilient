# components/marketing

The marketing pages follow the neumorphism UI rules in `app/(marketing)/CLAUDE.md` (design insights, the `.neu` system, UX laws). The tokens and component classes (`neu-btn`, `neu-card`, `neu-well`, `neu-seal`, tier finishes) live in `app/(marketing)/marketing.css`, scoped to `.neu` on the marketing layout, so the app and other portals keep PRD 9.

## The landing story (decisions 2026-10-31)

- Scenes in `components/marketing/story/*`: the hero (`../hero.tsx`, orbit + `orbit-parallax.tsx`), `prologue.tsx`, `chapters.tsx` (chapters 1–4 with the pinned `Record` from `record.tsx`), `climb.tsx`, `signed-found.tsx`, `rules.tsx`, `finale.tsx`. Copy: `story` in `content/marketing.ts`.
- Motion is CSS only, in `app/(marketing)/story.css`. Static first; the motion block applies under `[data-js]` + `@supports (animation-timeline: view())` + no reduced motion; pins only at ≥1024×600. Text never starts at a faint opacity (axe), only 0.
- The `animation` shorthand resets `animation-timeline`: put the timeline in the same rule, after the shorthand.
- Renders: edit `scripts/renders/objects.py`, run `blender -b -P scripts/renders/objects.py -- --out /tmp/renders/final` (add `--preview` for quick checks, `--project --only terraces-light` for the climb's step points), then `node scripts/renders/export.mjs /tmp/renders/final`.
