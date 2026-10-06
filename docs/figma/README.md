# Skilient in Figma

Every screen, tab and section of the built product as an editable Figma file: desktop 1440 and
phone 390, light and dark. Decisions 2026-10-04.

File: https://www.figma.com/design/9D9DDtTpYC8MPRsSGL7vHK (node ids and progress in `state.json`).

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

## Slice 2 onwards: the converter

1. Capture: `pnpm db:start`, `pnpm build`, `FIGMA_PORTAL=<portal> pnpm figma:captures`.
2. Plan: `node scripts/figma-plan-calls.mjs <portal> ...` compacts every captured layout tree
   (`scripts/figma-compact.mjs`: token names, text styles, component kinds, Phosphor names from
   `icons.json`) and packs the chunks into `reference/calls/NNN.js`, each under the `use_figma` limit.
3. Build: paste each call into `use_figma`. The converter is also stored in the file
   (`figma.root` shared plugin data `skilient/converter`), so a call can send only its `JOBS` and run
   `new Function("return " + figma.root.getSharedPluginData("skilient", "converter"))()(JOBS)`.
   Marketing header/footer chunks live in `skilient/marketing-chrome`.
   Cheapest (slice 3 onwards): `--packed` writes calls that carry deflate-raw + base64 data for the
   stored runner (`skilient/run`, from `docs/figma/runner.js`), at most 8 frames per call (more
   times out at 60 s). The runner also applies the app-shell post-fix: sidebar to full frame
   height, phone tab bar to the frame bottom. A copy slip in the base64 fails the whole call
   (JSON parse error), never builds a broken frame; re-run it split in two.
   After editing `converter.js` or `runner.js`, store the new source in the file again.
4. Check a screenshot per page against `reference/*.png`, then clone each `· light` frame to `· dark`
   (desktop x 2030, phone x 3570), set the Color mode to Dark and drop level 1–2 shadows.
5. Audit: no unbound solid paints outside instances (the CV specimen's print ink is the only exception).

## Lessons from slice 1 (Plugin API)

- `resize()` resets sizing modes to fixed: set `primaryAxisSizingMode`/`counterAxisSizingMode` after it.
- Fractional spacing variables are named with an underscore: `spacing/1_5`, `spacing/2_5`.
- Swapping an icon instance resets its fill override: re-bind the colour after the swap.
- A text property on a variant set has one default for every variant; set per-instance text on instances.
- Icons are Phosphor regular weight; where code uses `bold` or `fill`, the Figma icon is an approximation.
- Text centring: one-line text in a padded link, button or chip is centred like flexbox; a trailing icon far from the
  text (a FAQ caret) leaves the text at the start. `align-items: center` is vertical only.
- Closed `<details>` keep their answer in the tree: clip them. Clip `cv-paper` and `hero-capture` parents too.
- Effect styles can't follow a variable mode: use `Elevation Dark/*` on dark frames (levels 1–2 have no shadow in dark).
