# Native Living Block Map Migration Design

**Status:** Approved in conversation on 16 August 2026

## Decision summary

The WordCamp US Core AI Astro site becomes the sole implementation of the Core
AI Living Block Map. The complete visitor-facing exhibit moves to a dedicated
`/living-block-map/` route as native Astro markup and TypeScript. The current
visual design and behavior remain intact, while WordPress, the block editor,
the Interactivity API runtime, WordPress Playground, PHP, plugin packaging, and
the separate Cloudflare kiosk deployment are retired.

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
  About view, WP-Bench view, reduced-motion behavior, accessibility behavior,
  and 60-second inactivity reset.
- Give the map one typed, maintainable content model inside the Astro project.
- Use only build-time Astro rendering and a small standalone TypeScript
  controller at runtime.
- Reuse the WCUS site's existing navigation, preview, tracking, and offline
  infrastructure where relevant.
- Remove every WordPress- and Playground-specific source, dependency, build,
  test, deployment, and generated artifact after production parity is proven.

## Non-goals

- Redesigning the map, rewriting its teaching model, or changing its copy.
- Embedding the map on the homepage.
- Keeping a separately installable WordPress plugin.
- Keeping a WordPress editor experience or user-configurable block attributes.
- Keeping the old Cloudflare deployment or redirecting its hostname.
- Adding a framework runtime, remote API, CMS, iframe, or client-side data fetch.
- Changing the site's unrelated project pages, analytics Worker, PR previews,
  manifest, or site-wide service-worker strategy.

## Route and navigation

Create `src/pages/living-block-map/index.astro`. It uses the shared `Base`
document shell for metadata, fonts, tracking, Astro navigation, and the site
service worker, but it does not render the normal site header or footer. The
map remains a focused, full-viewport exhibit.

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
- `controller.ts` owns DOM events, rendering, focus, timers, resize behavior,
  online state, and Astro lifecycle integration.
- `living-block-map.css` contains the map's scoped visual system and motion.

Map-specific static assets live under `public/images/living-block-map/` and
the existing `public/fonts/` hierarchy. QR images, icons, and font license
files move with the assets they cover. Asset URLs are produced with the Astro
base path so production and `/pr-preview/pr-N/` builds behave identically.

## Content model

`model.ts` consolidates the current defaults in `block.json` and the additional
content and layout data embedded in `render.php`. It is the sole source of
truth; there is no second JSON or PHP representation and no runtime
normalization layer.

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
or bench stage, applying the demo suggestion, resetting, and online-state
changes.

The controller uses event delegation from one map root. Stable native data
attributes such as `data-action`, `data-story-id`, `data-card-id`,
`data-tab-id`, and `data-stage-id` replace all `data-wp-*` directives. A single
render pass applies classes, styles, text, ARIA state, `hidden`, `inert`, and
tab order from the derived view state.

## Browser lifecycle and timing

The controller initializes on `astro:page-load` and disposes before an Astro
view swap. Initialization is idempotent. One instance owns:

- an `AbortController` for event listeners
- a timer registry for attract, flow-settle, focus, and inactivity timers
- the resize and online/offline subscriptions
- the element that should regain focus when a screen or panel closes

Disposal aborts listeners and clears every timer. Navigating away and back can
therefore never duplicate actions or leave a background reset running.

The current attract timing, 2.9-second flow settle, and configured 60-second
inactivity reset remain unchanged. Pointer, keyboard, and touch activity reset
the inactivity timer. Reduced motion skips decorative movement and timed
drawing states while preserving content and focus changes.

## Visual parity

The current `core-ai-map` class namespace remains the map's styling boundary.
The authored 1366 x 1024 stage, map geometry, type hierarchy, colors, paths,
cards, detail views, and motion are ported rather than reinterpreted. The map
is centered and uniformly scaled to fit smaller viewports without horizontal
overflow. Its CSS loads after the site foundation and explicitly neutralizes
site-wide rules that would otherwise affect the stage.

The native port preserves:

- attract copy, preview cycle, and primary/browse entry points
- flow recomposition, steps, paths, zones, sidecars, and settle state
- browse mode and component participation rules
- card detail content, contextual roles, tabs, QR links, and focus restoration
- About content and return behavior
- the complete WP-Bench stage browser
- online/offline status, demo suggestion behavior, announcements, and reset

Infrastructure changes must not be disguised as visual changes. Any visible
difference from the current exhibit requires explicit review.

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

## Offline and failure behavior

The map registers no service worker of its own. The existing WCUS site worker
adds `living-block-map/` to `SHELL` and increments its cache version from `v3`
to `v4`. Navigation remains network-first, and assets remain
stale-while-revalidate. After one successful online visit, the map and its
loaded assets can use the site's normal offline cache.

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

## Test design

Implementation follows test-first development.

### Model and state tests

Node tests verify:

- all model references resolve and all four flows have complete layouts
- every inspectable card has a panel and every authored role names a real flow
- initial, flow, browse, inspect, About, and WP-Bench transitions
- reset, suggestion, tab, stage, and online-state transitions
- derived participation, step, path, focus, hidden, inert, and ARIA state
- reduced-motion and timer scheduling decisions

### Markup and build tests

Production and preview-base builds verify:

- `/living-block-map/` exists with its canonical URL
- the teaser links internally under the active base path
- every map asset is local and base-aware
- headings, landmarks, buttons, tabs, panels, live regions, and fallback exist
- no built map HTML or JavaScript references Playground, WebAssembly,
  `@wordpress/*`, `data-wp-*`, `wcus.hperkins.com`, or the old Pages hostname
- tracking remains excluded from PR-preview bundles
- the site worker includes the native route and uses the new cache version

### Browser journeys

Playwright runs the built site and exercises:

- direct route entry and homepage navigation
- attract animation and both entry points
- all four flows, their settled states, and replay
- browse mode and representative cards from every card family
- inspect close and trigger-focus restoration
- About open/close and focus restoration
- all Abilities tabs and WP-Bench stages
- keyboard-only operation, live announcements, and reduced motion
- 60-second inactivity reset using controlled time
- leaving and returning through Astro navigation without duplicated handlers
- clean browser console and no failed or Playground-related network request

### Visual evidence

Capture the current exhibit before retiring it. At 1366 x 1024, compare the
attract screen, each settled flow, browse mode, representative detail views,
About, and every WP-Bench stage. The pixel-difference ratio must stay at or
below the site's existing `0.005` threshold after antialiasing tolerance;
every remaining difference is reviewed. Additional iPad-landscape and narrow
viewport captures verify uniform scaling, readable text, focus visibility,
and zero horizontal overflow.

### Full local gates

The migration is not releasable until all of these exit successfully:

- `pnpm format:check`
- `pnpm lint`
- `pnpm check:scripts`
- `pnpm check`
- `pnpm test`
- `pnpm build`
- the preview-base regression build
- the Playwright interaction and visual-parity suite

## Source repository retirement

Retirement starts only after the native route passes local parity and a
production smoke check. The `core-ai-wcus` tracked tree is then reduced to a
single `README.md` explaining that the implementation moved, linking the
Astro source and live route, and noting that prior plugin and Playground code
remain available in Git history.

The retirement removes:

- `src/`, `build/`, `assets/`, `playground/`, `scripts/`, and `tests/`
- `core-ai-map.php`, `core-ai-map.zip`, and `readme.txt`
- `package.json`, `package-lock.json`, and all WordPress dependencies
- the Playground verification workflow and build documentation
- obsolete product, design, review, and prior implementation-plan files
- the ignored local `dist-playground/` runtime and old repository
  `node_modules/`, after their resolved paths are verified

The Git repository and history are not deleted. The repository may be marked
archived separately, but archival is not required for code retirement.

## Deployment retirement

The production sequence is:

1. Merge and deploy the Astro route to GitHub Pages.
2. Verify the production route, assets, interactions, console, and network.
3. Verify the homepage teaser navigates internally.
4. Remove the `core-ai-living-block-map` Cloudflare Pages deployment.
5. Remove the `wcus.hperkins.com` custom hostname or DNS record.
6. Confirm neither old hostname still serves the map. No redirect is required.
7. Commit and publish the `core-ai-wcus` retirement tree.

Remote retirement is performed only with the relevant configured credentials.
If those credentials are unavailable, the code migration can complete but the
release remains explicitly incomplete until the owner removes the deployment
and hostname.

## Rollback

Until production verification succeeds, the existing Playground deployment
and source tree remain untouched. A failed native deployment is rolled back by
reverting the Astro change while the old map remains live. After the old
deployment and source tree are retired, Git history can restore the old code,
but restoring the Cloudflare deployment would be a deliberate new release.

## Acceptance criteria

The migration is complete only when:

- the native route is the production map and the homepage link is internal
- the visitor-facing experience meets the approved parity contract
- all automated, browser, visual, accessibility, and production gates pass
- the built site makes no WordPress or Playground runtime request
- the Astro repository contains the only maintained implementation
- the old deployment and custom hostname no longer serve the map
- `core-ai-wcus` contains only its retirement README in the tracked tree
- Git history remains available for provenance and recovery
