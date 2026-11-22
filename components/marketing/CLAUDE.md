# components/marketing

The marketing pages follow the neumorphism UI rules in `app/(marketing)/CLAUDE.md` (design insights, the `.neu` system, UX laws). The tokens and component classes (`neu-btn`, `neu-card`, `neu-well`, `neu-seal`, tier finishes) live in `app/(marketing)/marketing.css`, scoped to `.neu` on the marketing layout, so the app and other portals keep PRD 9.

## The landing story (decisions 2026-10-31)

- Scenes in `components/marketing/story/*`: the hero (`../hero.tsx`, orbit + `orbit-parallax.tsx`), `prologue.tsx`, `chapters.tsx` (chapters 1–4 with the pinned `Record` from `record.tsx`), `climb.tsx`, `signed-found.tsx`, `rules.tsx`, `finale.tsx`. Copy: `story` in `content/marketing.ts`.
- Motion is CSS only, in `app/(marketing)/story.css`. Static first; the motion block applies under `[data-js]` + `@supports (animation-timeline: view())` + no reduced motion; pins only at ≥1024×600. Text never starts at a faint opacity (axe), only 0.
- The `animation` shorthand resets `animation-timeline`: put the timeline in the same rule, after the shorthand.
- Renders: the object images in `public/marketing/objects/` are final. The Blender script that made them (`scripts/renders/`) was removed on 2026-11-22; restore it from git history to render new ones.

## Organisation pages (decisions 2026-11-01)

- `OrgHero` (`org-parts.tsx`) takes an orbit (`story/orbit.tsx`, the same one as the landing hero). `PinnedStory` (`story/pinned-story.tsx`) takes chapters with a `panel` and an `object`; panels live in `story/panels-{recruiters,universities,faculty}.tsx`. `LitLines` (`story/rules.tsx`) lights any list of lines; `prose` for sentences.
