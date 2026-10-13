# Vector brand

The public site's look, set on 11 October 2026 with the homepage hero (stage 1), carried down the whole homepage (stage 2), on to the docs, sign-in, setup, Base's frames and the app (stage 3), and given its own drawing for every homepage section (stage 5: the page follows one report, FLW-842, drawn six ways). It belongs to the RER seed family (Uptime, Lamp, Dial, Slate, HappyToHelp, Mango): ink on warm paper, one plain headline, a dark pill and an underlined link, the real product drawn with colour only inside the drawing.

## The idea

**A team knows what is decided and what happens next.** Vector's twist is a draughtsman's plan: the product is drawn as precise ink line-art, on construction lines in the hero and with a different drafting instrument in every section after it. A report arrives **askew**; once the call is made, every card after it sits **square on the grid**, and a cobalt arrow carries it to its place. Calm, exact, nothing lost.

## Tokens

Defined once in `src/core/app/site/brand/tokens.css`, scoped under `.vx-site` so nothing reaches the operator app. Use the variables, never the raw values.

| Token | Value | Use |
|---|---|---|
| `--vx-paper` | `#f4f0e6` | Page ground (warm drafting paper) |
| `--vx-paper-deep` | `#ebe5d7` | The full-bleed bands behind Free and the rest of the tracker |
| `--vx-card` | `#fbf9f3` | Drawn cards, a shade lighter than the page |
| `--vx-ink` | `#171a20` | Headlines, wordmark, pills, card text |
| `--vx-body` | `#41454d` | Subheads, body copy, fine print |
| `--vx-muted` | `#676a71` | Secondary labels |
| `--vx-rule` | `#d8d1c1` | Hairline under the header, the sheet rule, panel hairlines and grid paper |
| `--vx-outline` | `#23262c` | Card outlines, registration crosses, dimension lines |
| `--vx-guide` | `#a49e90` | Dashed construction lines and circles |
| `--vx-hatch` | `rgba(23,26,32,.32)` | Hatched card shadows and the deferral's away days |
| `--vx-cobalt` | `#2446dc` | The one accent: arrows and arcs, the chosen option, reasons, the "now" dot, the mark's origin point |
| `--vx-cobalt-ink` | `#1c38b4` | Cobalt text on light (reason pills) |
| `--vx-cobalt-soft` | `#e2e7fa` | Reason pill fill |
| `--vx-sans` / `--vx-mono` | Instrument Sans / IBM Plex Mono | See Type |
| `--vx-max`, `--vx-gutter`, `--vx-header-h` | 1296px, clamp(16px, 5vw, 72px), clamp(72px, 7vw, 100px) | Layout |
| `--vx-radius-card`, `--vx-ease-out` | 10px, cubic-bezier(.22,1,.36,1) | Cards, motion |

Shared chrome (`.vx-site`, `.vx-wrap`, `.vx-header`, `.vx-footer`, `.vx-brand`, `.vx-pill`, `.vx-pill--large`, `.vx-pill--outline`, `.vx-link`, `.vx-link--large`) is in `src/core/app/site/brand/chrome.css`; the header and footer are `src/core/app/site/shell/site-header.tsx` and `site-footer.tsx`, and the links are in `shell/links.ts`.

## Type

- **Instrument Sans** (SIL OFL 1.1, variable weight 400–700), self-hosted at `public/fonts/brand/` with `OFL-instrument-sans.txt`. Headline 620, tracking −0.034em, line-height 0.98, up to 84px at 1440 (`clamp(46px, 5.6vw, 84px)`); subhead 22px/1.5 in `--vx-body`; nav 17px/500; wordmark 31px/620, tracking −0.025em; buttons 20px/560.
- **IBM Plex Mono 500** (SIL OFL 1.1) only inside drawings: issue identifiers (`FLW-842`), the licence text, the terminal commands and the return time, 15–16.5px.
- A metric-matched Arial fallback (`Instrument Sans Fallback`, per weight) is declared in `public/fonts/fonts.css`, so nothing reflows when the font arrives. Never load a font from a third party.

## Wordmark

`BrandMark` (`shell/brand-mark.tsx`): the letter V drawn as a vector. A cobalt origin point sits at top-left; one ink stroke drops to the vertex and climbs out to an arrowhead, open in the lockup. "Vector" follows in Instrument Sans 620. Never recolour the stroke, add a gradient or put the mark in a tile on the page.

- **Sizing**: the mark is 0.73em tall (the wordmark's font-size) and 0.81em wide, so the dot's top sits on the cap line and the vertex on the baseline (the public chrome nudges it up 0.023em). The same rule sizes the header (31px, 24px on phones), the footer (25px) and the app sidebar (1.45rem); the mark takes the wordmark's ink.
- **Favicon**: the same V on a paper tile with a filled, swept-back, pixel-snapped head so it holds at small sizes: `public/favicon.svg` (32px, linked `sizes="any"`), `public/brand/favicon-16.png` (a true 16px raster of the 16px grid, not a resampled one) and `public/brand/apple-touch-icon.png` (180px, full-bleed paper square; the OS rounds it). All three are linked from the root head on every page.
- **Bare mark**: `public/brand/mark.svg` is the lockup's V with transparent corners and no tile, for Base's frames.

## Drawing rules

1. **Draw the real product.** Every string is a label Vector shows today or its sample workspace (`FLW-842`, `Sarah Chen`, `Maya Ortiz`, `Awaiting decision`, `Accept`/`Defer`/`Decline`, `Accepted`, `Now`, `Started work`). Check UI-REFERENCE.md before adding one. No grey placeholder bars standing in for words, no lorem ipsum, at most about 30 words per drawing (numbers on tags and calendar days are drafting marks and do not count).
2. **Cards**: `--vx-card` fill, 1.4px `--vx-outline` border, 10px radius, a 50px header strip with a hairline under it, and a hatched shadow offset down-right (`.vx-card::before`). A card is as tall as what it holds: no fixed heights, no empty bands. Text in the drawing is real, selectable DOM text, at least 15px at 1440 (reason pills are 15px and 32px tall) and 14px at 390. New shapes (sheet, calendar cells, tags, keycaps) use the same `--vx-outline` token and weight. Every stroked SVG shape sets `fill: none` or a token fill; an unset fill paints black.
3. **Construction** (`Plate`, `home/drawing/plate.tsx`, styles in `drawing.css`) is the hero's and the doors' device only: a dashed circle (`--vx-guide`) about 125% of the card's width so it shows above and below it, dashed extension lines 12px outside its edges running about 40px past them, and a registration cross where they meet. On phones circles shrink to about 104% so nothing leaves the page. Construction is always square to the page. Text that the construction would cross on phones sits on a patch of paper.
4. **The twist**: what has not been decided yet is tilted (the arriving report and the returned `FLW-842`, −5°, −3° on phones); what has been decided sits square. At most one tilted element per drawing, and nothing else is ever tilted.
5. **Cobalt only inside drawings**, and only for: arrows and arcs that carry work (the hero's arrow, the deferral's arrow and return arc), the chosen option (the chosen decision, the chosen return day, the selected search result), reason pills, the "now" dot (the gauge's), the cycle's capacity state (`Within capacity`, in `--vx-cobalt-ink`), the saved check and the `free of charge` underline. Leaders, tags and rules are ink. Page chrome stays ink on paper; cobalt appears outside the drawings only as the wordmark's origin point.
6. **Numbers on a dimension line** (the hero and the closing): steps are numbered on a thin ink dimension line with a tick at the start and an open arrowhead at the end; the step's words sit under the number. On phones each number and its words go above its card.
7. **Arrows**: solid cobalt, 7px shaft, filled head. Horizontal on wide screens, pointing down when cards stack.
8. **Every section draws with its own device.** Neighbouring sections never share a device or a composition, and no composition is used by more than two sections. The hero draws on construction; each later section draws with the instrument below.

### Drawing vocabulary

| Device | Used in | Sizes | Colours |
|---|---|---|---|
| **Tag and leader** (`drawing/tag.tsx`, `tag.css`) | Current (four tags beside its card, repeated as the markers of the key); Projects (the elbowed leader with an open arrowhead); the deferral (leader from the field to the first day, and the one under the return time) | Tag: pentagon pointing left, 34×24 (30×22 on phones), 1.3px outline, number 15px/600 as text. Leader: 1px, starting on a 5px dot on the card border or ending in an open arrowhead | Ink only. Tag fill `--vx-card` |
| **Sheet and title block** (`drawing/sheet.tsx`, `sheet.css`) | Free | Square corners, 1.4px outer border, 1px inner border inset 8px (6px on phones), 12 zone ticks (25/50/75% per edge) across the gap, square hatched shadow 7px; mono 16.5px/1.8 body; title block flush in the inner border's corner, 2×2 ruled cells (one column of four on phones) | Ink and `--vx-card`; cobalt only for the underline and the check |
| **Day strip and return arc** (`drawing/day-strip.tsx`, `day-strip.css`) | Deferral | Seven square cells, 60×60 at 1440, 8px apart; `--vx-hatch` stripes on the away days, an ink dot on the day it was deferred; a 4px cobalt arc with a 12px head above the strip; the time on a 16px leader below | Ink cells; the return day has a 1.6px cobalt border, `--vx-cobalt-soft` fill and `--vx-cobalt-ink` number |
| **Gauge** (`drawing/gauge.tsx`, `gauge.css`) | Cycles | 240×132 semicircle, radius 110, ticks every 10% (long at 0, 50, 100), finished part 5px; stands on the paper with no card | Ink; a cobalt "now" dot at the percentage, and the capacity state (`Within capacity`) in `--vx-cobalt-ink` |
| **Ruled table** (`sections/product/history-panel.tsx`) | History | A card holding three columns and two rows, 15.5px; 1px rules at 28% ink between columns and rows, no cell boxes | Ink; a cobalt dot on the accepted row |
| **Keycap** (`drawing/keycap.tsx`, `keycap.css`) | Search | 44×44 `<kbd>`, 1.4px border with a 3px bottom edge, 8px radius; the palette's `Esc` is the small keycap (28px tall) | Ink; the selected result is `--vx-cobalt-soft` |
| **Grid paper and terminal** (`sections/try-it.css`) | Try | A borderless square patch (max 640×376 at 1440), 1px `--vx-rule` lines every 24px; a terminal card of mono 15px lines (`$ ` in `--vx-muted`, wrapping only at spaces with a 2ch hanging indent) overlapped by the first-run card | Ink; no cobalt |

## Motion

Once, on load, CSS only, opacity and transform only: construction fades in, the report arrives askew (0.95s, ease-out), the arrow draws, the decision card rises 14px, the chosen option fills and the saved line rises. About 2.3s to settle. Under `prefers-reduced-motion: reduce` and before CSS animations run, the page is simply the finished drawing. Never loop, never move on scroll in the hero, never animate layout properties.

## Layout

The homepage, top to bottom: hero · Current (`#current`) · Free (`#free`, band) · Later gets a date (`#later`) · The rest of your tracker (`#product`, band) · Try it without switching (`#try`) · closing (`#get-started`) · footer. The page follows one report, FLW-842: it arrives (hero), lands in a list that says why (Current), is deferred and comes back on a date, and leaves a history. Every word is in `home/copy/` (one file per section); UI-REFERENCE.md in the stage 5 evidence backs each claim.

| Section | Ground | Copy | Composition at 1440 | Device | Tilt |
|---|---|---|---|---|---|
| Hero | paper | left | row of two cards | construction | arriving report |
| Current | paper | right, with a numbered key | one tall card (420px) | tags on leaders | none |
| Free | `--vx-paper-deep` band | left | one wide sheet (600px) | engineering sheet, title block | none |
| Later | paper | heading left, body right | row across the full width (`StackSection`) | calendar strip, return arc | returned card |
| Rest of tracker | `--vx-paper-deep` band | heading and body stacked | four panels on hairlines, 7/5 over 5/7 columns | leader, gauge, ruled table, keycaps | none |
| Try | paper | left | terminal card and first-run card on grid paper | grid paper | none |
| Closing | paper | centred | none | dimension line | none |

- Sections after the hero: a heading (`.vx-h2`, up to 60px, 640, −0.032em), one or two lines of body (20px/1.55, `--vx-body`, at most 28em) and the drawing. `SplitSection` puts copy and drawing side by side (reversed for Current; `band` makes the ground a full-bleed `--vx-paper-deep`); `StackSection` puts the drawing across the full content width below the heading and body. The two bands, `#free` and `#product`, give the page its rhythm.
- One `SheetRule` (hairline with a registration cross at each end), between the hero and Current. The band edges separate the other sections; none before the closing.
- Section padding about 140px at 1440, 72px on phones. Phones stack copy first, then the drawing.
- Phone drawings: Current's tags sit in a 44px column at the card's right (30×22, 12px leaders); the deferral is a vertical stack (Defer card, leader, strip with a 40px arc, arrow pointing down, returned card tilted −3°); the four panels are one column with hairlines between; the licence's title block is one column of four rows, as it is up to 1100px; Try's first-run card still overlaps the terminal's bottom edge, and up to 1100px it follows the terminal rather than being pinned to the paper. Between 1101 and 1360px the deferral's cards are 270px and its cells shrink; at 1100px and below it uses the phone stack. From 901 to 1180px the panels are two equal columns and Projects stacks its cards with the leader dropping down.
- The proof row (`No seats.` `No plans.` `No fees.`) is page chrome: ink icons, never cobalt.
- No scroll reveals: everything below the hero is visible without motion, and only the hero animates.

- Header: lockup left; `Docs`, `Source` and a dark `Sign in` pill right; a full-width `--vx-rule` hairline under it. One row on phones.
- Hero at 1440: the copy column is as wide as the headline (`auto`, the headline never wraps); the drawing is two cards (the arriving report and the decision) on their construction, and sits level with the copy: it starts at the headline's top and ends with the actions, so the two blocks share a midpoint. Its column is the space right of the headline; the drawing is centred in it with at least 72px of clear paper between the headline and its construction at 1280px and wider (less below, never touching), and never leaves the content width. Between the subhead and the actions sits the alternative line, 12-16px under the subhead: `100% free, open source alternative to Linear, Jira and Asana`, with the three names in bold (ink, 620). Actions: dark pill `Get the code` (62px) and an underlined `Read the docs`. Nothing sits below the actions.
- Below 1080px the drawing goes under the copy, centred; below 900px the two cards stack. At 390 the headline, subhead and both actions are in the first screen.

## Do and don't

- Do: ink on paper, one cobalt, square construction, real labels, generous paper around the hero, the same header and buttons on every public page, a different drawing instrument in every section.
- Do: say "100% free and open source." (the closing) or the hero's "100% free, open source alternative to Linear, Jira and Asana", and nothing about hosting or costs.
- Don't: dark sections, gradients on buttons or text, a second accent colour, emoji, stock illustration, people or mascots, AI imagery, approval or permission steps in drawings, invented metrics or testimonials.
- Don't: tilt anything that has been decided, draw construction lines crooked, or repeat one section's device in the next.

## Docs, sign-in, setup and Base's frames

- **Docs** (`/docs`, `/docs/<slug>`, `site/docs/`): the homepage header (with `Docs` underlined) and footer, the page list on the left with a 2px cobalt rule on the current page, a 700px reading column, "On this page" on the right; code on a drawn card (ink outline, hatched shadow). Pages are built at build time from the Markdown that `docs/site.json` lists; every other tracked Markdown file is in its `githubOnly` list with a reason, and the build fails on a broken link, a missing file or an unlisted file. Owner guides live in `docs/guide/`.
- **Doors** (`/signin`, `/setup`, page not found; `site/door/`): the hero's copy column on the left (headline up to 68px), one drawing on its construction on the right: the real sign-in message (askew, not yet opened) on sign-in, the first team on setup, none on page not found. Phones stack copy, then the drawing. The local-outbox note on sign-in shows only when the installation uses the local development outbox.
- **Base's frames** (installer, sign-in confirmation, development outbox) read `public/rer-theme.css`: paper page, lighter card surface, ink text and ink button, cobalt focus, Instrument Sans, and the bare V (`public/brand/mark.svg`, never the favicon's tile). The sign-in confirmation links `public/brand/confirmation.css`, which adds the ink pill to its button; the theme file may hold only tokens. The installer's background is paper with one construction circle and the V.

## The app

The operator app wears the same brand through `--app-*` tokens on `:root` (`src/core/app/app.css`) and the installation theme (`src/ext/config.ts`, accent cobalt `#2446dc` by default):

- Paper page and sidebar, cards a shade lighter (`--app-card`) with an ink hairline and a small offset shadow, inputs on `--app-field`.
- Ink text in three steps (`--app-ink`, `--app-body`, `--app-muted`); nothing under 12px.
- Labels keep their user colour quietly (`LabelChip`): ink text on an 18% tint of the colour with an edge of it, never a solid fill.
- The accent marks only where you are and what you chose: the active nav item's wash, the selected issue card, the chosen triage option, reason pills, focus. Primary actions are ink pills (`New issue`, `Accept and route work`, `Create issue`); secondary actions are outlined.
- Danger, warning and success use `--app-danger`, `--app-warn`, `--app-ok` and their `-soft` fills, for priority and health only. Label colours are the workspace's own.
- Issue identifiers use IBM Plex Mono. Page titles are 620 with −0.03em tracking.
- No construction drawings inside the app: it stays a calm, dense working tool.
