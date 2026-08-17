# Native Living Block Map Migration Design

**Status:** Approved in conversation on 16 August 2026

## Decision summary

The WordCamp US Core AI Astro site becomes the sole implementation of the Core
AI Living Block Map. The complete visitor-facing exhibit moves to a dedicated
`/living-block-map/` route as native Astro markup and TypeScript. Its visual
design and teaching interactions remain intact, with two deliberate
deployment-context changes: automatic inactivity reset is opt-in kiosk
behavior, and the map no longer claims to know whether a response came from an
offline cache. WordPress, the block editor, the Interactivity API runtime,
WordPress Playground, PHP, plugin packaging, and the separate Cloudflare kiosk
deployment are retired.

This document supersedes the external-Playground handoff in
`2026-08-14-living-block-map-teaser-design.md`. The homepage teaser remains,
but it becomes an internal link to the native route.

## Context

The map currently lives in `henryperkins/core-ai-wcus` as a dynamic WordPress
block. PHP renders the exhibit, `@wordpress/interactivity` owns its state and
actions, and a 256 MB generated Playground artifact makes that WordPress site
available on static hosting. The public WCUS site is a separate Astro project.
Its current feature branch contains a lightweight teaser that opens the
Playground deployment in a new tab.

The Playground layer creates a long first load, a second deployment pipeline,
and substantial WordPress and WebAssembly machinery for an experience whose
content is static and whose behavior can run directly in the browser. The map
does not need WordPress persistence, an editor, PHP at request time, or a
virtual WordPress installation.

## Goals

- Make `wcus-ai.github.io/living-block-map/` the canonical and only live map.
- Preserve the current map's visitor-facing visual and behavioral experience.
- Keep the 1366 x 1024 authored kiosk stage and its responsive scaling.
- Preserve the attract loop, all four flows, browse mode, component details,
  About view, WP-Bench view, reduced-motion behavior, and accessibility
  behavior.
- Preserve the current kiosk reset contract only when the operator explicitly
  opens `/living-block-map/?kiosk=1`: 60 seconds on map/About, 90 seconds on
  inspect/WP-Bench, no reset scheduled on attract, and no reset while the
  document is hidden.
- Leave automatic reset disabled on the ordinary public route so visitors can
  take as long as they need.
- Give the map one typed, maintainable content model inside the Astro project.
- Use only build-time Astro rendering and a small standalone TypeScript
  controller at runtime.
- Reuse the WCUS site's existing navigation, preview, tracking, and offline
  infrastructure where relevant.
- Remove every WordPress- and Playground-specific source, dependency, build,
  test, deployment, and generated artifact after production parity is proven.
- Replace prose-only parity claims with numbered behavioral and visual
  contracts exercised by purpose-built tests.

## Non-goals

- Redesigning the map, rewriting its teaching model, or changing its copy.
- Embedding the map on the homepage.
- Keeping a separately installable WordPress plugin.
- Keeping a WordPress editor experience or user-configurable block attributes.
- Keeping the old Cloudflare deployment or redirecting its hostname.
- Adding a framework runtime, remote API, CMS, iframe, or client-side data fetch.
- Porting saved-block migration behavior or a WordPress translation runtime;
  the native exhibit has no editor and remains English-only, matching the
  current release, which ships no translation catalogs.
- Changing the site's unrelated project pages, analytics Worker, PR previews,
  manifest, or site-wide service-worker strategy.

## Route and navigation

Create `src/pages/living-block-map/index.astro`. It uses the shared `Base`
document shell for metadata, fonts, tracking, Astro navigation, and the site
service worker, but it does not render the normal site header or footer. The
map remains a focused, full-viewport exhibit.

`Base.astro` gains an optional named `head` slot so this route can emit its six
font preload links inside `<head>` without changing other pages. The route
passes Vite-imported font URLs through that slot; it does not place preload
markup in the body or hardcode built filenames.

The canonical, homepage-linked route has no automatic inactivity timer or
screen wake lock. Booth operators may use the non-canonical query
`?kiosk=1` to enable those unattended-kiosk behaviors. The query does not
change content, appearance, or indexing.

The homepage keeps `LivingBlockMapTeaser.astro` in its current location after
the project grid. Its CTA changes as follows:

- URL: base-aware internal `/living-block-map/`
- tracking: `click_internal`, project `site`, target `living-block-map`
- same-tab navigation
- no `target`, external-link `rel`, new-tab announcement, Playground load
  warning, or WordPress runtime claim
- copy updated only as needed to describe immediate internal navigation

The teaser image and its existing visual placement remain useful and stay in
the site.

## Feature structure

The native feature lives together under
`src/components/living-block-map/`:

- `LivingBlockMap.astro` renders the complete semantic exhibit.
- `types.ts` defines the content, layout, screen, and state contracts.
- `model.ts` is the only authored source for labels, cards, actors, panels,
  flows, layouts, preview paths, About content, and WP-Bench content.
- `state.ts` contains pure state transitions and derived view state.
- `controller.ts` owns DOM events, rendering, focus, optional kiosk timers,
  resize behavior, document-state restoration, and Astro lifecycle integration.
- `living-block-map.css` contains the map's scoped visual system and motion.

Map images and QR assets live under `src/assets/living-block-map/`. Before the
source repository is retired, copy the six tracked build fonts — variable
Inter, variable EB Garamond, and IBM Plex Mono at 400, 500, 600, and 700 — into
that same Vite-managed asset tree and copy their three licenses into
`public/licenses/living-block-map/`. The route preloads all six fonts so the
first rendered frame and visual comparison do not race `font-display: swap`.

`living-block-map.css` stays under `src/` and is imported by the route. Its
relative asset URLs are therefore rewritten by Vite for both production and
`/pr-preview/pr-N/` builds. The stylesheet and fonts must not be copied to
`public/` with root-relative URLs.

## Content model

The source feature spans 8,386 lines across `block.json`, `normalize.js`,
`render.php`, `view.js`, and `style.scss`, with 3,841 lines of map tests. The
port is contract migration, not a line-for-line rewrite. Before authoring
`model.ts`, capture the effective current render of the public block — current
registered defaults, the render-time PHP normalization, and
`offlineEnabled:false` from `playground/setup.php` — as a checked fixture.

`normalize.js` is reviewed as a third historical input because it records the
editor's legacy-default migrations. The live Playground page does not use
those migrations: it inserts a default block with only `offlineEnabled:false`.
The Astro model therefore takes its visible values from the effective render,
while legacy saved-block upgrade rules are classified as editor-only and are
not ported.

`model.ts` consolidates that effective content with the layout and bench data
embedded in `render.php`. It becomes the sole source of truth; there is no
second JSON or PHP representation and no runtime normalization layer.

The model has stable IDs for:

- screens: `attract`, `map`, `inspect`, `about`, and `bench`
- flows: `uses-ai`, `uses-wp`, `learns`, and `tests`
- component and actor cards
- component detail panels and per-flow roles
- map layouts, steps, sidecars, paths, and boundary crossings
- Abilities API detail tabs
- WP-Bench stages

TypeScript's `satisfies` operator and model-integrity tests enforce that every
flow member, layout member, detail panel, role, tab, stage, and link points to
an existing ID. Content edits therefore fail locally instead of producing a
partly interactive production map.

Before any old test is deleted, create an oracle matrix for `normalize.test.js`,
`render-contract.test.js`, `render.test.js`, `scope.test.js`,
`qr-assets.test.js`, and `view.test.js`. Every assertion is mapped to a native
test, marked as an intentional deployment-context change, or marked as
WordPress-editor/Playground-only with a reason. The source tests remain
available until that matrix and the native gates pass.

## Rendering and state

Astro renders all meaningful text and semantic structure at build time. The
initial document is the attract state. Hidden screens and panels are present
with correct initial `hidden`, `inert`, ARIA, and tab-index values. A concise
`noscript` fallback explains that the interactive exhibit requires JavaScript
and links back to the Core AI project index. A matching normal fallback region
starts hidden; the controller unhides it if initialization throws, so a
JavaScript failure does not strand the visitor on inactive controls.

The state module is independent of the DOM. It accepts the current state and a
named event, then returns the next state. Events cover starting, choosing a
flow, browsing all cards, inspecting and closing a card, replaying a flow,
opening and closing About, opening and closing WP-Bench, selecting a detail tab
or bench stage, applying the demo suggestion, and resetting.

The controller uses event delegation from one map root. Stable native data
attributes such as `data-action`, `data-story-id`, `data-card-id`,
`data-tab-id`, and `data-stage-id` replace all `data-wp-*` directives. A single
render pass applies classes, styles, text, ARIA state, `hidden`, `inert`, and
tab order from the derived view state.

## Browser lifecycle and timing

The controller initializes on `astro:page-load` and disposes before an Astro
view swap. Initialization is idempotent. One instance owns:

- an `AbortController` for event listeners
- a timer registry for attract, flow-settle, focus, and optional kiosk timers
- resize, orientation, visibility, and optional wake-lock lifecycle
- the element that should regain focus when a screen or panel closes
- a `restoreDocumentState` function for the body class, scroll lock, inline
  styles, and any document-level attributes changed during initialization

Disposal aborts listeners, clears every timer, releases the wake lock, and
restores document state. Navigating away and back can therefore never duplicate
actions, leave a background reset running, or leave the next Astro page fixed
and unscrollable.

The current `isolateKioskPage()` sibling walk is deliberately not ported. A
dedicated route with no site header or footer has no unrelated page branch to
hide, and its extreme z-index is retained only as part of the first visual
parity pass. The body scroll lock is still required by the fixed stage and is
covered by `restoreDocumentState`.

The attract timing and 2.9-second flow settle remain unchanged. Automatic
inactivity reset is disabled unless `?kiosk=1` is present. In kiosk mode the
configured base is 60 seconds, inspect and bench add 30 seconds, attract never
schedules a reset, and expiration resets only while
`document.visibilityState === 'visible'`. Activity inside the map reschedules
the timer. Returning to a visible document schedules from the current screen.
The screen wake lock is also kiosk-only and is released on disposal.

Reduced motion skips decorative movement and timed drawing states while
preserving content and focus changes.

## Visual parity

The current `core-ai-map` class namespace remains the map's styling boundary.
The authored 1366 x 1024 stage, map geometry, type hierarchy, colors, paths,
cards, detail views, and motion are ported rather than reinterpreted. The map
is centered and uniformly scaled to fit smaller viewports without horizontal
overflow. Its CSS loads after the site foundation and explicitly neutralizes
site-wide rules that would otherwise affect the stage.

Astro has no Sass dependency. The port therefore starts from the tracked,
already-compiled `build/core-ai-map/style-index.css`, expands only the portions
that must be edited, and commits the result as source CSS. The six compiled
font files are harvested before `build/` is deleted. Adding Sass merely to
reproduce an already-compiled release artifact is out of scope.

The native port preserves:

- attract copy, preview cycle, and primary/browse entry points
- flow recomposition, steps, paths, zones, sidecars, and settle state
- browse mode and component participation rules
- card detail content, contextual roles, tabs, QR links, and focus restoration
- About content and return behavior
- the complete WP-Bench stage browser
- demo suggestion behavior and live announcements
- the exact reset guards and delays when explicit kiosk mode is active

The public-route timing change and removal of the offline badge are intentional
deployment-context changes. Infrastructure changes must not be disguised as
other visual changes. Every other visible difference from the current exhibit
requires explicit review.

## Accessibility

The port retains the current landmark labels, screen labels, live
announcements, button names, selected and expanded states, roving tab order,
focus entry, and focus restoration. Non-current screens are both hidden and
inert. Cards outside a selected flow remain non-interactive and explain that
state in their accessible names.

Keyboard behavior covers flow selection, card inspection, closing views,
Abilities detail tabs, and WP-Bench stages. Focus indicators continue to meet
the current design. The reduced-motion media query removes nonessential
animation without removing state feedback. The scaled stage must remain
operable at desktop, iPad landscape, and narrow viewport widths.

WCAG 2.2 Success Criterion 2.2.1 requires a content-set time limit to be
turn-offable, adjustable, extendable, or genuinely essential. Resetting a
reader's place is not essential on a public reference page. The normal route
therefore has no time limit. The query-enabled reset is an operator-selected
behavior for the unattended physical booth kiosk and is never linked as the
public reading experience. Tests cover both modes and do not claim that kiosk
mode itself is the WCAG-conforming route. See
<https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html>.

## Offline and failure behavior

The map registers no service worker of its own. The existing WCUS site worker
adds `living-block-map/` to `SHELL` and increments its cache version from `v3`
to `v4`. Navigation remains network-first, and assets remain
stale-while-revalidate. After one successful online visit, the map and its
loaded assets can use the site's normal offline cache.

The WordPress map's offline badge is removed. Its meaning depended on a
`core-ai-map-offline` meta flag and `CORE_AI_MAP_CACHE_RESULT` messages from the
plugin worker; the Astro worker provides neither signal, and
`navigator.onLine` alone does not prove useful connectivity. The native map
does not represent an online/offline state it cannot know reliably.

`cache.addAll(SHELL)` is atomic. A worker test verifies that every shell URL,
including `living-block-map/`, exists in the same build. Activation of `v4`
deletes the `v3` cache, and only route HTML is precached; hashed CSS,
JavaScript, images, and fonts enter the cache when the route is loaded online.
The booth release checklist therefore includes one successful online warm load
after the new worker activates. Cold, never-visited offline startup is not a
promise of this migration.

There are no runtime content requests to fail. Missing map roots are a safe
no-op, repeated initialization first disposes the earlier instance, and an
unexpected controller error unhides the build-rendered fallback navigation
and leaves the introduction readable. External documentation links remain
normal links and never block the exhibit from starting.

## Tracking and privacy

The homepage handoff changes from an outbound event to the existing internal
click vocabulary. The map itself adds no new analytics events, cookies,
storage, identifiers, or telemetry. The site's existing click beacon and
privacy disclosure remain unchanged.

## Numbered parity contract

Each identifier below appears verbatim in a native browser-test name. A
contract item is complete only when its test has first failed against the
missing port and then passed against the implementation.

1. **MAP-01 — Route shell:** direct navigation renders one labelled 1366 x
   1024 stage, the shared document metadata, and no normal site header/footer.
2. **MAP-02 — Attract state:** the approved introduction, preview cycle,
   primary action, browse action, legend, and announcements match the current
   exhibit.
3. **MAP-03 — Entry actions:** the primary action starts `uses-ai`; the browse
   action opens the neutral all-components canvas with no selected flow.
4. **MAP-04 — WordPress uses AI:** its members, steps, sidecars, boundary
   crossing, path, situation, outcome, and takeaway settle correctly.
5. **MAP-05 — AI uses WordPress:** its members, steps, boundary crossing, path,
   situation, outcome, and takeaway settle correctly.
6. **MAP-06 — An agent learns WordPress:** its outside-WordPress members,
   steps, path, situation, outcome, and takeaway settle correctly.
7. **MAP-07 — WordPress tests the result:** its members, steps, path,
   situation, outcome, takeaway, and WP-Bench entry settle correctly.
8. **MAP-08 — Flow controls:** rail switching, replay, settled state, and
   reset-to-attract behavior match the current exhibit.
9. **MAP-09 — Browse mode:** every component is visible and inspectable, no
   flow participation is implied, and browse guidance is announced.
10. **MAP-10 — Card inspection:** every inspectable card opens its matching
    panel and return state, rendering exactly the definition, technical notes,
    links, QR image, and contextual roles authored for that card without
    inventing fields absent from the effective fixture.
11. **MAP-11 — Abilities tabs:** Overview, Anatomy, and Permissions expose the
    correct panel, selected state, roving tab index, and arrow/Home/End keys.
12. **MAP-12 — About:** open, close, announcement, and trigger-focus
    restoration match the current exhibit.
13. **MAP-13 — WP-Bench:** open, close, all stages, selected state, keyboard
    operation, and trigger-focus restoration match the current exhibit.
14. **MAP-14 — Suggestion demo:** the authored suggestion advances and Apply
    changes the visible phase and explanatory note exactly once.
15. **MAP-15 — Focus and announcements:** start, flow selection, inspect,
    Escape, close, replay, browse, About, bench, and reset produce the approved
    focus targets and live messages.
16. **MAP-16 — Reduced motion:** meaningful state changes remain while path,
    token, spark, preview, and transition motion is skipped.
17. **MAP-17 — Timing modes:** the ordinary route never schedules inactivity
    reset or wake lock; `?kiosk=1` uses 60 seconds on map/About, 90 seconds on
    inspect/bench, no attract timer, visible-document-only expiration, and
    activity rescheduling.
18. **MAP-18 — Astro lifecycle:** leaving and returning creates one controller,
    no duplicate action, no live timer or wake lock from the prior visit, and
    no leaked body class, fixed position, overflow lock, inert, or ARIA state.
19. **MAP-19 — Failure fallback:** no-JavaScript and forced initialization
    failure both leave the introduction and project-index navigation readable.
20. **MAP-20 — Runtime independence:** startup and every journey produce no
    console error, failed request, Playground/WebAssembly request, WordPress
    runtime request, or request to an old map hostname.
21. **MAP-21 — Responsive stage:** 1366 x 1024, 1024 x 768 iPad landscape,
    and 390 x 844 viewports preserve uniform geometry, focus visibility,
    readable content, and zero horizontal overflow.
22. **MAP-22 — Content identity:** visitor copy, flow membership, layouts,
    detail content, external documentation links, QR destinations, labels, and
    reviewed date equal the checked effective-render fixture.
23. **MAP-23 — Site cache:** the `v4` worker installs atomically with all three
    shell routes, a warm map visit caches its loaded assets, and the map renders
    no offline-status badge or unsupported cache claim.

The visual contract uses these exact captures at 1366 x 1024 after fonts are
ready and motion is disabled:

1. **VIS-01:** settled attract screen
2. **VIS-02:** settled `uses-ai` flow
3. **VIS-03:** settled `uses-wp` flow
4. **VIS-04:** settled `learns` flow
5. **VIS-05:** settled `tests` flow
6. **VIS-06:** browse-all canvas
7. **VIS-07:** Abilities Overview details
8. **VIS-08:** Abilities Anatomy details
9. **VIS-09:** external AI service details
10. **VIS-10:** About screen
11. **VIS-11:** WP-Bench prompt stage
12. **VIS-12:** WP-Bench agent stage
13. **VIS-13:** WP-Bench sandbox stage
14. **VIS-14:** WP-Bench checks stage
15. **VIS-15:** applied suggestion state

## Test design and infrastructure

Implementation follows test-first development. The Astro repository currently
has the Playwright library only: no `@playwright/test`, browser-test script, or
blocking browser job exists. This migration adds that infrastructure
explicitly without adding a second test runner.

### Node tests and file discovery

The existing `pnpm test` command remains `node --test tests/*.test.ts`.
Consequently all model, state, component, service-worker, and build-contract
tests use flat names such as:

- `tests/living-block-map-model.test.ts`
- `tests/living-block-map-state.test.ts`
- `tests/living-block-map-markup.test.ts`
- `tests/living-block-map-lifecycle.test.ts`

No unit test is placed in a nested directory unless the `test` script is
changed in the same task. Tests verify model references, effective-render
identity, all pure transitions and derived state, the exact MAP-17 scheduling
guards, reduced-motion decisions, and MAP-23 cache behavior.

The existing `tests/living-block-map-teaser.test.ts` is rewritten in the same
task as the teaser. Its external URL, new-tab, external tracking, disclosure,
and single-kiosk-URL assertions are removed and replaced with the base-aware
internal URL, `click_internal`, same-tab behavior, retained poster, and absence
of Playground copy.

Production and preview-base builds verify the route, canonical URL, semantic
markup, local Vite-managed assets, preloaded map fonts, fallback, and absence
of `@wordpress/*`, `data-wp-*`, Playground, WebAssembly, and old-hostname
references. `tests/preview-base.test.ts` gains the native route and teaser
contract so base-path behavior remains in the existing flat suite.

### Blocking browser suite

Add `pnpm test:browser`, implemented with Node's test runner and the already
installed `playwright` package. Browser tests live under
`tests/browser/living-block-map.test.ts`, outside the flat `pnpm test` glob.
A small harness builds the site, starts a local static server, launches the
pinned Chromium, controls time where required, records console/network
failures, and always tears down the browser and server.

Add a separate blocking `browser` job to `.github/workflows/lint.yml`. It
installs Chromium with system dependencies, builds once, and runs
`pnpm test:browser`. It is not another entry in the current five-way matrix,
because those jobs neither build nor install a browser. The suite's test names
map one-to-one to MAP-01 through MAP-23.

### Purpose-built migration parity gate

The existing `scripts/visual-report.ts` remains advisory. It always exits zero,
uses a 390 x 844 full-page viewport, compares the same production/preview path,
and cannot gate a route absent from production. The introducing change does
not add `/living-block-map/` to `routesFor()`; the expected homepage teaser
diff remains visible in the advisory report.

Add `pnpm verify:map-parity`, backed by
`scripts/verify-living-block-map-parity.ts`. While the old deployment still
exists, it accepts explicit `--reference` and `--candidate` origins, rejects a
non-2xx response, drives adapter selectors for the old and native
implementations into VIS-01 through VIS-15, waits for all six map fonts,
waits up to 180 seconds for each map's explicit ready selector, captures both
in the same Chromium process at 1366 x 1024 and device scale 1, and writes
reference/candidate/diff PNGs plus JSON.

This parity command is a release gate: any capture error or any state above a
`0.005` differing-pixel ratio exits nonzero. The value is shared with the
report helper, but the existing report itself is not the gate. The parity
report and command output are retained as migration evidence before the old
deployment is retired. After retirement, the blocking MAP browser suite and
accepted native screenshots become the regression contract; the external
side-by-side command is not run in ordinary CI.

### Full gates

The migration is not releasable until all of these exit successfully:

- `pnpm format:check`
- `pnpm lint`
- `pnpm check:scripts`
- `pnpm check`
- `pnpm test`
- `pnpm build`
- `pnpm test:browser`
- `pnpm verify:map-parity -- --reference https://wcus.hperkins.com/ --candidate http://127.0.0.1:4326` against a locally served production build while the reference deployment exists

The PR's advisory mobile visual report is reviewed separately and is expected
to show the intentional homepage teaser change.

## Migration sequencing

The port is divided into independently testable slices rather than attempted
as one 8,000-line translation:

1. Inventory the current effective render, create the old-to-native oracle
   matrix, capture the VIS references, and copy the compiled CSS, six fonts,
   licenses, QR images, and other source assets before any retirement change.
2. Write failing flat tests for the typed content model and pure state machine,
   then implement only enough model/state code to satisfy each contract batch.
3. Rewrite the teaser contract and add failing route/markup/base-path tests,
   then implement the Astro route and static semantic markup.
4. Add the controller in MAP-numbered slices: entry/flows, browse/inspect,
   About/bench/tabs, focus/announcements, motion, and kiosk timing/lifecycle.
5. Import the compiled CSS as source CSS, connect Vite-managed assets, preload
   the fonts, and resolve only measured parity differences.
6. Add the blocking browser harness and CI job, then make MAP-01 through MAP-23
   pass with clean console and network output.
7. Run the purpose-built VIS-01 through VIS-15 parity gate and all local gates,
   retaining its evidence.
8. Deploy, verify, soak, and only then retire the old runtime, hostname, and
   source tree.

The source tests and build assets remain untouched through steps 1–7. Deletion
is a release action, not an implementation shortcut.

## Source repository retirement

Retirement starts only after the native route passes the 24-hour production
soak. The `core-ai-wcus` tracked tree currently contains 89 files. It is reduced
to exactly one tracked `README.md` explaining that the implementation moved,
linking the Astro source and live route, and noting that prior plugin and
Playground code remain available in Git history.

This is an exhaustive rule, not a directory sample: delete every tracked path
except `README.md`. It includes the previously listed application, build,
Playground, test, package, workflow, product, design, review, and plan files,
plus `.editorconfig`, `.gitattributes`, `.gitignore`,
`.impeccable/design.json`, and the tracked 1.5 MB
`Kiosk screen recreation.zip`.

`core-ai-map.zip` is not tracked; it is a local generated artifact. After the
repository's resolved absolute path is checked, remove it together with the
ignored `dist-playground/`, old `node_modules/`, and `.wrangler/` cache. Do not
remove `.git/`, `.worktrees/`, or any linked worktree as part of generated-file
cleanup.

Before the retirement commit, this exact invariant must pass:

```powershell
$tracked = @(git ls-files)
if ($tracked.Count -ne 1 -or $tracked[0] -ne 'README.md') {
    throw "Expected only README.md; found: $($tracked -join ', ')"
}
```

The Git repository and history are not deleted. The repository may be marked
archived separately, but archival is not required for code retirement.

## Deployment retirement

The production sequence is:

1. Merge and deploy the Astro route to GitHub Pages.
2. Verify the production route, MAP contract, assets, console, network, public
   no-timer behavior, and explicit kiosk timing behavior.
3. Verify the homepage teaser navigates internally.
4. Keep the old deployment live but unlinked for a minimum 24-hour soak. Repeat
   production smoke checks at the beginning and end of that window.
5. Remove the `core-ai-living-block-map` Cloudflare Pages deployment.
6. Remove the `wcus.hperkins.com` custom hostname or DNS record.
7. Confirm neither old hostname still serves the map.
8. Commit and publish the `core-ai-wcus` retirement tree.

No redirect is required by the approved release decision. The checked QR
manifest points only to WordPress.org, developer.wordpress.org, Make WordPress,
and GitHub documentation — never to the old map hostname — and the homepage is
changed to the internal route before teardown. Old untracked bookmarks are
allowed to stop resolving after the soak rather than retaining Cloudflare
infrastructure solely for a redirect.

Remote retirement is performed only with the relevant configured credentials.
If those credentials are unavailable, the code migration can complete but the
release remains explicitly incomplete until the owner removes the deployment
and hostname.

## Rollback

Until the 24-hour soak succeeds, the existing Playground deployment and source
tree remain untouched. A failed native deployment is rolled back by reverting
the Astro change while the old map remains live. After the old deployment and
source tree are retired, Git history can restore the old code, but restoring
the Cloudflare deployment would be a deliberate new release.

## Acceptance criteria

The migration is complete only when:

- the native route is the production map and the homepage link is internal
- MAP-01 through MAP-23 pass in the blocking native browser suite
- VIS-01 through VIS-15 each pass the purpose-built migration gate at or below
  the `0.005` differing-pixel ratio
- the public route has no inactivity timer, while `?kiosk=1` passes the exact
  60/90-second, attract, and visibility guards
- all listed Node, build, browser, accessibility, and production gates pass
- the built site makes no WordPress or Playground runtime request
- the Astro repository contains the only maintained implementation
- the 24-hour soak completes before the old deployment and custom hostname are
  removed without a redirect
- `git ls-files` in `core-ai-wcus` returns exactly `README.md`
- Git history remains available for provenance and recovery
