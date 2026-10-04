# Skilient in Figma

Every screen, tab and section of the built product as an editable Figma file: desktop 1440 and
phone 390, light and dark. Decisions 2026-10-04.

## Pieces

- `screens.json`: the inventory, generated from `app/**/page.tsx` by `pnpm figma:inventory`
  (`scripts/figma-inventory.mjs`). Per route: portal, the role that opens it, tabs (`?tab=`/`?status=`
  links and the dynamic segments that are tabs, e.g. `/opportunities/[tab]`), sections (the components
  the page renders), states. `tests/unit/figma-inventory.test.ts` fails when it is stale.
- `reference/` (gitignored): `pnpm build && pnpm figma:captures` (optionally `FIGMA_PORTAL=student`)
  signs in one fictional account per role on the local stack and writes, for every tab × viewport ×
  theme, a full-page PNG and a layout tree (`tests/figma/layout-dump.ts`: boxes, auto-layout, text,
  typography, colours named by their PRD 9 token). `reference/manifest.json` lists what was captured and
  what was skipped (dynamic routes with no local row). Needs `pnpm db:start`.
- `progress.md`: one box per screen; tick it when all its frames exist.

## Building in Figma (needs the Figma connector in the session)

1. Slice 1, foundations: a "Skilient" variable collection with Light and Dark modes from
   `app/styles/tokens.css` and `design/tokens-figma-ramps.json`; text styles (Spectral display/h1/h2,
   Barlow h3 and body, JetBrains Mono data); radius, spacing and shadow tokens; components with variants
   for `components/ui/*`, the shell (`components/shell/*`, ops sidebar) and the shared domain cards; the
   logos from `brand/`.
2. Slices 2–8, one portal per session (order in `progress.md`): one Figma page per portal; each screen a
   frame named by its route, tabs as sibling frames (`route › tab`), sections as named auto-layout
   children, built from the slice-1 components and the layout tree. Phone frame next to desktop. Dark
   frames are duplicates with the collection's mode set to Dark, never a second build, so no fill may be
   a raw colour.
3. Check per slice: frames on the page match `screens.json` for that portal, and a scan for unbound
   paints finds none.
