# Native Living Block Map Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the draft PR's external WordPress Playground handoff with a native, accessible Astro Living Block Map at `/living-block-map/`, preserve the approved visitor experience, and prove behavioral and visual parity before any old deployment or source is retired.

**Architecture:** Astro renders the complete semantic exhibit from one typed `MAP_MODEL`; a pure reducer and derived-view layer own behavior, while one DOM controller applies state, focus, timing, scaling, and lifecycle effects. The shared `Base` shell supplies metadata, tracking, navigation lifecycle, and the site service worker, but the route omits the normal header/footer and enables kiosk reset/wake-lock behavior only for `?kiosk=1`.

**Tech Stack:** Astro 6, TypeScript 6, Node 24 `node:test`, Playwright 1.62, plain CSS, Vite-managed assets, `pixelmatch`, `pngjs`, GitHub Actions.

## Global Constraints

- Treat `C:\Users\htper\core-ai-wcus` as read-only migration input throughout this PR; do not delete, retire, archive, or modify it.
- Keep the 1366 × 1024 authored stage, the `core-ai-map` CSS namespace, all four flows, browse, inspect, About, WP-Bench, QR destinations, and approved copy.
- The public `/living-block-map/` route must never schedule inactivity reset or request a wake lock.
- Only `/living-block-map/?kiosk=1` enables reset and wake lock: 60 seconds on map/About, 90 seconds on inspect/bench, no timer on attract, no expiration while hidden, and activity reschedules the timer.
- Use build-time Astro markup and one standalone TypeScript controller; add no framework runtime, API, CMS, iframe, client fetch, Sass dependency, WordPress package, Playground runtime, or WebAssembly runtime.
- `src/components/living-block-map/model.ts` is the sole maintained authored content/layout source. The effective-render JSON is immutable migration evidence used only by tests.
- Preserve the six source fonts as Vite-managed assets, place their three licenses under `public/licenses/living-block-map/`, and preload all six fonts from the route's `head` slot.
- Keep the existing advisory `scripts/visual-report.ts` route list unchanged.
- Add no map analytics events, cookies, storage, identifiers, or telemetry; only the homepage teaser uses the existing internal click beacon.
- Every implementation change follows red/green/refactor: write one focused test, run it and observe the expected failure, implement the minimum behavior, then rerun the focused and affected suites.
- Every MAP-01 through MAP-23 identifier must appear verbatim in exactly one browser-test name; every VIS-01 through VIS-15 identifier must appear verbatim in the parity capture list.
- A VIS state fails when its differing-pixel ratio is greater than `0.005`; capture errors and non-2xx pages also fail.
- Do not perform the 24-hour production soak, Cloudflare/DNS teardown, or `core-ai-wcus` retirement in this implementation PR. Those are separately authorized release actions after production parity is proven.

## Planned File Structure

### Create

- `docs/superpowers/evidence/2026-08-16-living-block-map-oracle-matrix.md` — disposition of every old source assertion.
- `scripts/capture-living-block-map-source.ts` — one-time, explicit-source fixture and asset-manifest capture.
- `scripts/lib/living-block-map-parity.ts` — VIS state definitions, adapters, capture, and diff helpers.
- `scripts/verify-living-block-map-parity.ts` — strict parity CLI.
- `src/assets/living-block-map/fonts/*` — six copied WOFF2 files.
- `src/assets/living-block-map/icon.svg` — map mark.
- `src/assets/living-block-map/qr/*` — seven QR SVGs and their manifest.
- `public/licenses/living-block-map/*` — three copied font licenses.
- `src/components/living-block-map/types.ts` — IDs and content/layout/state/event/view contracts.
- `src/components/living-block-map/model.ts` — the sole maintained map model.
- `src/components/living-block-map/state.ts` — pure transition and derived-state functions.
- `src/components/living-block-map/LivingBlockMap.astro` — complete semantic exhibit markup.
- `src/components/living-block-map/controller.ts` — delegated events, DOM rendering, focus, timers, scaling, kiosk behavior, and Astro lifecycle.
- `src/components/living-block-map/living-block-map.css` — compiled visual system promoted to source and adapted for Astro.
- `src/pages/living-block-map/index.astro` — focused route and six font preloads.
- `tests/fixtures/living-block-map-effective-render.json` — immutable effective default render with `offlineEnabled:false`.
- `tests/fixtures/living-block-map-source-assets.json` — names and SHA-256 hashes of copied source assets.
- `tests/living-block-map-source.test.ts` — fixture/provenance contracts.
- `tests/living-block-map-model.test.ts` — ID integrity and content identity.
- `tests/living-block-map-state.test.ts` — pure state, timing, motion, and announcement contracts.
- `tests/living-block-map-markup.test.ts` — production route and semantic first-paint contracts.
- `tests/living-block-map-lifecycle.test.ts` — controller source/build lifecycle and cleanup contracts.
- `tests/living-block-map-service-worker.test.ts` — v4 shell/cache contract.
- `tests/living-block-map-parity.test.ts` — strict parity helper and CLI contracts.
- `tests/browser/harness.ts` — build-once static server and Playwright lifecycle.
- `tests/browser/living-block-map.test.ts` — MAP-01 through MAP-23.

### Modify

- `src/layouts/Base.astro` — optional named `head` slot.
- `src/components/LivingBlockMapTeaser.astro` — base-aware same-tab internal handoff and revised copy.
- `src/styles/global.css` — remove external-handoff-only disclosure rules while retaining the teaser layout/poster.
- `src/pages/index.astro` — retain teaser placement; formatting only if needed.
- `src/lib/config.ts` — reuse the existing `base` helper; no new route constant.
- `public/sw.js` — add the route to `SHELL` and bump v3 to v4.
- `README.md` — document `click_internal` target vocabulary and native route commands.
- `tests/living-block-map-teaser.test.ts` — replace the superseded external contract.
- `tests/preview-base.test.ts` — assert route, assets, preloads, canonical, and internal teaser under a PR base.
- `scripts/lib/report.ts` — export the existing threshold constant so parity and report code share `0.005`; do not add the map route to `routesFor()`.
- `package.json` / `pnpm-lock.yaml` — add browser and parity scripts only; no new runtime dependency.
- `.github/workflows/lint.yml` — add a separate blocking browser job.

---

### Task 1: Freeze the source oracle and copy irreplaceable assets

**Files:**

- Create: `scripts/capture-living-block-map-source.ts`
- Create: `tests/fixtures/living-block-map-effective-render.json`
- Create: `tests/fixtures/living-block-map-source-assets.json`
- Create: `tests/living-block-map-source.test.ts`
- Create: `docs/superpowers/evidence/2026-08-16-living-block-map-oracle-matrix.md`
- Create: `src/assets/living-block-map/fonts/*`
- Create: `src/assets/living-block-map/icon.svg`
- Create: `src/assets/living-block-map/qr/*`
- Create: `public/licenses/living-block-map/*`
- Create: `src/components/living-block-map/living-block-map.css`
- Read only: `C:\Users\htper\core-ai-wcus\src\core-ai-map\{block.json,normalize.js,render.php,view.js,style.scss}`
- Read only: `C:\Users\htper\core-ai-wcus\src\core-ai-map\{normalize,render-contract,render,scope,qr-assets,view}.test.js`
- Read only: `C:\Users\htper\core-ai-wcus\build\core-ai-map\style-index.css`
- Read only: `C:\Users\htper\core-ai-wcus\assets\{fonts,qr}\*`

**Interfaces:**

- Consumes: explicit `--source <absolute core-ai-wcus path>`; never guesses a sibling repository.
- Produces: fixture shape `{ sourceVersion, runtimeOverrides, content, layouts, previews, about, bench }` and asset manifest shape `{ sourceCommit, compiledCssSha256, files: Array<{ source, destination, sha256 }> }`. The immutable `files` list covers fonts, licenses, icon, QR SVGs, and QR manifest; the CSS source hash is provenance only because later tasks intentionally edit its copied destination.

- [ ] **Step 1: Write the failing provenance test**

```ts
test('source fixture freezes the effective public render with offline disabled', async () => {
  const fixture = JSON.parse(await readFile(fixturePath, 'utf8'));
  assert.equal(fixture.sourceVersion, '3.2.3');
  assert.deepEqual(fixture.runtimeOverrides, { offlineEnabled: false });
  assert.equal(fixture.content.title, 'What is WordPress Core AI?');
  assert.equal(fixture.content.reviewedDate, 'Reviewed 14 Aug 2026');
  assert.deepEqual(
    fixture.content.flows.map(({ id }: { id: string }) => id),
    ['uses-ai', 'uses-wp', 'learns', 'tests'],
  );
});
```

Add a second test that expects exactly six WOFF2 files, three license files, seven QR SVGs, `manifest.json`, `icon.svg`, and `living-block-map.css`. Verify every immutable asset SHA-256 against `living-block-map-source-assets.json`; verify `compiledCssSha256` against the read-only source at capture time and retain it as provenance rather than requiring the edited destination to stay byte-identical.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/living-block-map-source.test.ts`

Expected: FAIL because the fixture, manifest, and copied assets do not exist.

- [ ] **Step 3: Implement the explicit capture script**

Use `parseArgs()` that rejects a missing/non-absolute `--source`. Read `block.json`, extract registered defaults, and force only `offlineEnabled:false`. Invoke `render.php` through a full-render PHP harness with the WordPress stubs from `render-contract.test.js`; after `require`, discard the rendered buffer and JSON-encode the still-in-scope `$blocks`, `$actors`, `$panels`, `$stories`, `$context`, `$bench_stages`, labels, intro, About markup slice, and reviewed date. This captures layout, attract-preview, loose-position, About, and WP-Bench data without parsing PHP source or applying editor-only normalization rules. Hash copied bytes with `createHash('sha256')`; record the source commit from `git -C <source> rev-parse HEAD`.

The script must fail unless all of these inputs exist:

```ts
const REQUIRED = [
  'src/core-ai-map/block.json',
  'src/core-ai-map/render.php',
  'src/core-ai-map/normalize.js',
  'src/core-ai-map/view.js',
  'build/core-ai-map/style-index.css',
  'assets/fonts/inter-latin-wght-normal.woff2',
  'assets/fonts/eb-garamond-latin-wght-normal.woff2',
  'assets/fonts/ibm-plex-mono-latin-400-normal.woff2',
  'assets/fonts/ibm-plex-mono-latin-500-normal.woff2',
  'assets/fonts/ibm-plex-mono-latin-600-normal.woff2',
  'assets/fonts/ibm-plex-mono-latin-700-normal.woff2',
];
```

- [ ] **Step 4: Run the capture and mechanical copy**

Run:

```powershell
node scripts/capture-living-block-map-source.ts --source C:\Users\htper\core-ai-wcus
Copy-Item -LiteralPath C:\Users\htper\core-ai-wcus\build\core-ai-map\style-index.css -Destination src\components\living-block-map\living-block-map.css
```

The capture script itself copies the six fonts, three licenses, icon, seven QR SVGs, and QR manifest to the destinations above. It must refuse to overwrite a destination whose bytes differ unless `--refresh` is passed explicitly.

- [ ] **Step 5: Build the exhaustive oracle matrix**

Create a row for every `it(...)` in the six old suites with columns `Source test`, `Assertion`, `Disposition`, `Native contract`, and `Reason`. Allowed dispositions are only `ported`, `intentional-context-change`, and `wordpress-only`. Map behavior to MAP IDs or a flat Node test; classify editor normalization, PHP escaping, block scope, plugin worker, and Playground-only behavior with a concrete reason. Do not delete or modify any old source test.

- [ ] **Step 6: Run the focused test and verify GREEN**

Run: `node --test tests/living-block-map-source.test.ts`

Expected: PASS with hashes matching the copied bytes.

- [ ] **Step 7: Commit the frozen inputs**

```powershell
git add scripts/capture-living-block-map-source.ts tests/fixtures tests/living-block-map-source.test.ts docs/superpowers/evidence src/assets/living-block-map public/licenses/living-block-map src/components/living-block-map/living-block-map.css
git commit -m "test: freeze Living Block Map migration oracle"
```

### Task 2: Define the typed content and layout model

**Files:**

- Create: `src/components/living-block-map/types.ts`
- Create: `src/components/living-block-map/model.ts`
- Create: `tests/living-block-map-model.test.ts`
- Test fixture: `tests/fixtures/living-block-map-effective-render.json`

**Interfaces:**

- Produces: `Screen`, `FlowId`, `CardId`, `AbilityTabId`, `BenchStageId`, `MapModel`, and `MAP_MODEL`.
- Produces stable IDs:

```ts
export type Screen = 'attract' | 'map' | 'inspect' | 'about' | 'bench';
export type FlowId = 'uses-ai' | 'uses-wp' | 'learns' | 'tests';
export type CardId =
  | 'assistant'
  | 'skills'
  | 'agent'
  | 'task'
  | 'plugin'
  | 'client'
  | 'provider-plugin'
  | 'provider'
  | 'connectors'
  | 'mcp'
  | 'abilities'
  | 'bench';
export type AbilityTabId = 'overview' | 'anatomy' | 'permissions';
export type BenchStageId = 'task' | 'model' | 'sandbox' | 'checks' | 'evidence';
```

Define the top-level model without catch-all records:

```ts
export interface MapModel {
  readonly title: string;
  readonly eyebrow: string;
  readonly reviewedDate: string;
  readonly intro: readonly string[];
  readonly labels: MapLabels;
  readonly guidance: MapGuidance;
  readonly announcements: MapAnnouncements;
  readonly cards: readonly MapCard[];
  readonly panels: readonly MapPanel[];
  readonly flows: readonly MapFlow[];
  readonly previews: readonly AttractPreview[];
  readonly suggestions: readonly MapSuggestion[];
  readonly abilityTabs: readonly AbilityTab[];
  readonly about: AboutContent;
  readonly bench: BenchContent;
}
```

- [ ] **Step 1: Write failing model identity and integrity tests**

Test exact fixture equality for visitor content, flow membership, layout coordinates/paths, preview paths, panel roles/links/QR IDs, About copy, and WP-Bench stages. Add explicit reference checks:

```ts
for (const flow of MAP_MODEL.flows) {
  for (const id of [
    ...Object.keys(flow.layout.members),
    ...flow.layout.sidecars,
    ...flow.layout.park,
  ]) {
    assert.ok(cardIds.has(id as CardId), `${flow.id} references missing card ${id}`);
  }
}
for (const panel of MAP_MODEL.panels) {
  assert.ok(cardIds.has(panel.id));
  for (const flowId of Object.keys(panel.roles)) assert.ok(flowIds.has(flowId as FlowId));
}
assert.deepEqual(
  MAP_MODEL.abilityTabs.map((tab) => tab.id),
  ['overview', 'anatomy', 'permissions'],
);
assert.deepEqual(
  MAP_MODEL.bench.stages.map((stage) => stage.id),
  ['task', 'model', 'sandbox', 'checks', 'evidence'],
);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/living-block-map-model.test.ts`

Expected: FAIL because `types.ts`, `model.ts`, and `MAP_MODEL` do not exist.

- [ ] **Step 3: Add the exact type contracts**

Define readonly interfaces for labels, guidance, card summaries, panel roles, connection steps, layouts, preview layouts, suggestion records, About disclosures, and bench stages. Use tuple types for coordinates and `satisfies MapModel` on the exported constant; do not use `any`, untyped index signatures, or runtime normalization.

- [ ] **Step 4: Transcribe the effective fixture into `MAP_MODEL`**

Keep all visitor-visible strings and numeric geometry literal. Consolidate the `render.php` arrays (`story_layout`, `attract_previews`, `loose`, `bench_paths`, About disclosure, ability tabs, and bench stages) beside the block defaults. Use imported Vite asset URLs only in the Astro component; `model.ts` stores stable asset IDs such as `qr/abilities.svg`, never built filenames.

- [ ] **Step 5: Run type and focused model checks**

Run: `pnpm check && pnpm check:scripts && node --test tests/living-block-map-model.test.ts`

Expected: PASS and zero missing/duplicate/dangling IDs.

- [ ] **Step 6: Commit the model**

```powershell
git add src/components/living-block-map/types.ts src/components/living-block-map/model.ts tests/living-block-map-model.test.ts
git commit -m "feat: add typed Living Block Map model"
```

### Task 3: Implement the pure state machine and timing contracts

**Files:**

- Modify: `src/components/living-block-map/types.ts`
- Create: `src/components/living-block-map/state.ts`
- Create: `tests/living-block-map-state.test.ts`

**Interfaces:**

- Produces:

```ts
export interface MapState {
  screen: Screen;
  flow: FlowId | null;
  inspectedCard: CardId | null;
  abilityTab: AbilityTabId;
  benchStage: BenchStageId;
  aboutReturnScreen: 'attract' | 'map' | null;
  flowPhase: 'assembling' | 'settled';
  previewIndex: number;
  previewPhase: 'assembling' | 'drawing' | 'signalling' | 'settled' | 'releasing';
  suggestionIndex: number;
  suggestionApplied: boolean;
  announcement: string;
}

export type MapEvent =
  | { type: 'start' }
  | { type: 'browse' }
  | { type: 'select-flow'; flow: FlowId }
  | { type: 'settle-flow' }
  | { type: 'inspect'; card: CardId }
  | { type: 'close-inspect' }
  | { type: 'replay-flow' }
  | { type: 'open-about' }
  | { type: 'close-about' }
  | { type: 'select-ability-tab'; tab: AbilityTabId }
  | { type: 'open-bench' }
  | { type: 'close-bench' }
  | { type: 'select-bench-stage'; stage: BenchStageId }
  | { type: 'apply-suggestion' }
  | { type: 'advance-preview' }
  | { type: 'reset'; reason: 'visitor' | 'inactivity' };

export const INITIAL_MAP_STATE: Readonly<MapState>;
export function transition(state: Readonly<MapState>, event: MapEvent): MapState;
export function deriveView(state: Readonly<MapState>, model: MapModel): DerivedMapView;
export function inactivityDelay(state: Readonly<MapState>, kiosk: boolean): number | null;
export function animationDuration(milliseconds: number, reducedMotion: boolean): number;
```

`DerivedMapView` is the controller's complete render input rather than a second
mutable state object:

```ts
export interface DerivedMapView {
  readonly rootClasses: readonly string[];
  readonly screens: Readonly<Record<Screen, { hidden: boolean; inert: boolean }>>;
  readonly selectedFlow: FlowId | null;
  readonly cards: Readonly<
    Record<
      CardId,
      {
        active: boolean;
        dimmed: boolean;
        disabled: boolean;
        inspected: boolean;
        step: string;
        transform: string;
        opacity: string;
        accessibleName: string;
      }
    >
  >;
  readonly abilityTabs: Readonly<Record<AbilityTabId, { selected: boolean; tabIndex: 0 | -1 }>>;
  readonly benchStages: Readonly<Record<BenchStageId, { selected: boolean; tabIndex: 0 | -1 }>>;
  readonly guidance: string;
  readonly announcement: string;
}
```

- [ ] **Step 1: Write failing transition tests in contract batches**

Cover start=`uses-ai`, browse with no flow, switching/replaying each flow, inspect/close return state, About return state, ability tabs, bench default=`sandbox`, all bench stages, suggestion apply exactly once, visitor/inactivity reset announcements, and immutable input objects. Assert `inactivityDelay()` returns `null` for public/attract, `60_000` for kiosk map/About, and `90_000` for kiosk inspect/bench. Assert reduced motion returns zero for decorative delays but does not alter state or announcements.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/living-block-map-state.test.ts`

Expected: FAIL because the state API does not exist.

- [ ] **Step 3: Implement minimal immutable transitions**

Use exhaustive `switch (event.type)` handling with a `never` guard. Copy state only in the handled branch. Derive selected/disabled/hidden/inert/tab-index values from state and `MAP_MODEL`; do not duplicate them in controller-local booleans.

- [ ] **Step 4: Run focused and type checks**

Run: `node --test tests/living-block-map-state.test.ts && pnpm check:scripts`

Expected: PASS.

- [ ] **Step 5: Commit the state layer**

```powershell
git add src/components/living-block-map/types.ts src/components/living-block-map/state.ts tests/living-block-map-state.test.ts
git commit -m "feat: add Living Block Map state machine"
```

### Task 4: Add the native route, semantic first paint, and internal teaser

**Files:**

- Modify: `src/layouts/Base.astro`
- Create: `src/components/living-block-map/LivingBlockMap.astro`
- Create: `src/pages/living-block-map/index.astro`
- Modify: `src/components/LivingBlockMapTeaser.astro`
- Modify: `src/styles/global.css`
- Modify: `README.md`
- Create: `tests/living-block-map-markup.test.ts`
- Modify: `tests/living-block-map-teaser.test.ts`
- Modify: `tests/preview-base.test.ts`

**Interfaces:**

- `Base.astro` adds optional `<slot name="head" />` as the final metadata/preload hook inside `<head>`.
- `LivingBlockMap.astro` consumes `{ model: MapModel }` and emits stable `data-action`, `data-story-id`, `data-card-id`, `data-tab-id`, and `data-stage-id` attributes.
- Route imports every WOFF2 with `?url`, imports the feature CSS, and renders `<LivingBlockMap model={MAP_MODEL} />` inside `Base` without `SiteHeader` or `SiteFooter`.

- [ ] **Step 1: Rewrite the teaser test for the approved internal handoff**

Assert the built link is base-aware `/living-block-map/`, has `data-track-event="click_internal"`, project `site`, target `living-block-map`, and has no `target`, external `rel`, `aria-describedby`, new-tab copy, Playground/WordPress runtime copy, or old hostname. Retain the 1366 × 1024 lazy WebP poster and placement checks.

- [ ] **Step 2: Write failing route/markup tests**

Build to a temporary directory and assert:

```ts
assert.match(
  html,
  /<main[^>]*class="core-ai-map[^>]*aria-label="WordPress Core AI Living Block Map"/,
);
assert.equal((html.match(/<link rel="preload"[^>]*type="font\/woff2"/g) ?? []).length, 6);
assert.ok(!html.includes('data-wp-'));
assert.ok(!html.includes('<header class="site-header"'));
assert.ok(!html.includes('<footer class="site-footer"'));
assert.match(html, /<noscript>[\s\S]*requires JavaScript[\s\S]*href="\/"/);
assert.match(html, /data-map-fallback[^>]*hidden/);
assert.ok(!/Playground|WebAssembly|@wordpress\//i.test(html));
```

Also assert initial attract markup has one exposed h1, every other screen/panel has `hidden inert` as appropriate, controls carry native action attributes, QR images use built Vite URLs, and the canonical is `https://wcus-ai.github.io/living-block-map`.

- [ ] **Step 3: Extend preview-base RED tests**

Assert `/pr-preview/pr-99/living-block-map/index.html` exists, its canonical omits the preview base, its six preloads and all QR/font/CSS/JS URLs include the preview base, and the teaser points to `/pr-preview/pr-99/living-block-map/`.

- [ ] **Step 4: Run all three tests and verify RED**

Run: `node --test tests/living-block-map-teaser.test.ts tests/living-block-map-markup.test.ts tests/preview-base.test.ts`

Expected: FAIL on the external teaser and missing route.

- [ ] **Step 5: Add the Base head slot and route preloads**

Place `<slot name="head" />` immediately before `<ClientRouter />`. In the route, create the exact array of six imported font URLs and render:

```astro
<Fragment slot="head">
  {fontUrls.map((href) => (
    <link rel="preload" href={href} as="font" type="font/woff2" crossorigin />
  ))}
</Fragment>
```

- [ ] **Step 6: Make the minimum Vite-safe CSS promotion edits**

Import `living-block-map.css` from the route. Replace only the six compiled `../fonts/<name>.<hash>.woff2` URLs with `../../assets/living-block-map/fonts/<name>.woff2` so the route can build through Vite. Add a leading provenance comment containing `compiledCssSha256`; defer selector neutralization and measured visual changes to Task 8.

- [ ] **Step 7: Render the complete semantic exhibit**

Port the server structure from `render.php:1375-2341` as native Astro markup. Render all cards, flow rail buttons, paths, sidecars, strips, details panels, ability tabs/panels, About disclosures, WP-Bench stages, live region, normal failure fallback, and noscript fallback from `MAP_MODEL`. Replace every `data-wp-*` binding with stable native data attributes; initial `hidden`, `inert`, ARIA, disabled, and tab-index values must be correct without JavaScript. Remove only the offline badge and plugin-worker markup.

- [ ] **Step 8: Change the teaser and tracking vocabulary**

Use `href={`${base}/living-block-map/`}`, same-tab navigation, `click_internal`, and immediate-navigation copy. Remove the disclosure element and external-handoff-only CSS. Keep the poster, placement, and responsive grid.

- [ ] **Step 9: Run focused tests and build checks**

Run: `node --test tests/living-block-map-teaser.test.ts tests/living-block-map-markup.test.ts tests/preview-base.test.ts && pnpm check && pnpm build`

Expected: PASS with no root-relative asset leaks in preview output.

- [ ] **Step 10: Commit the route shell**

```powershell
git add src/layouts/Base.astro src/components/living-block-map/LivingBlockMap.astro src/pages/living-block-map src/components/LivingBlockMapTeaser.astro src/styles/global.css README.md tests/living-block-map-markup.test.ts tests/living-block-map-teaser.test.ts tests/preview-base.test.ts
git commit -m "feat: render native Living Block Map route"
```

### Task 5: Implement delegated map actions, flow rendering, and motion

**Files:**

- Create: `src/components/living-block-map/controller.ts`
- Modify: `src/pages/living-block-map/index.astro`
- Modify: `src/components/living-block-map/LivingBlockMap.astro`
- Create: `tests/living-block-map-lifecycle.test.ts`
- Test: `tests/living-block-map-state.test.ts`

**Interfaces:**

- Produces:

```ts
export interface LivingBlockMapController {
  dispose(): void;
}
export interface ControllerOptions {
  kiosk?: boolean;
  reducedMotion?: boolean;
}
export function initializeLivingBlockMap(
  root: HTMLElement,
  options?: ControllerOptions,
): LivingBlockMapController;
export function installLivingBlockMapLifecycle(doc?: Document): () => void;
```

- [ ] **Step 1: Add failing lifecycle/source-contract tests**

Assert the built controller contains one root-level delegated `click` listener, consumes the stable action/id attributes, registers `astro:page-load` and `astro:before-swap`, and exposes one idempotent disposer. Assert no `@wordpress/interactivity`, `data-wp-`, service-worker registration, online/offline badge logic, old hostname, or `isolateKioskPage` sibling walk appears in source/build output.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/living-block-map-lifecycle.test.ts`

Expected: FAIL because the controller and lifecycle installation are absent.

- [ ] **Step 3: Implement controller state ownership and dispatch**

Initialize from `INITIAL_MAP_STATE`; on each delegated action, validate the associated stable ID against `MAP_MODEL`, call `transition`, then run one `render(root, state, deriveView(...))`. The render pass owns root screen classes, transforms, opacity, step numbers, path variants, selected/expanded/disabled states, hidden/inert state, tab order, live text, details content visibility, suggestion phase, and SVG classes/styles.

- [ ] **Step 4: Add attract and flow timer registries**

Track every timeout in `Set<number>`. Preserve the source attract timeline and 2.9-second flow settle; use `animationDuration()` so reduced motion immediately settles decorative phases. Replaying `uses-ai` advances to the next authored suggestion; applying is idempotent until replay.

- [ ] **Step 5: Add responsive stage scaling**

Set `--cai-scale` to `min(root.clientWidth / 1366, root.clientHeight / 1024)` on initialization, resize, and orientation change. Reject non-finite/non-positive values. Keep the stage centered and fixed to authored geometry.

- [ ] **Step 6: Wire lifecycle installation from the route**

The route's module script calls `installLivingBlockMapLifecycle()`. Installation first disposes any active instance, then initializes the current `[data-living-block-map]` root on `astro:page-load`; `astro:before-swap` disposes it. A second installation call must return the existing uninstall function rather than add duplicate listeners.

- [ ] **Step 7: Run focused Node tests**

Run: `node --test tests/living-block-map-state.test.ts tests/living-block-map-lifecycle.test.ts && pnpm check:scripts && pnpm check`

Expected: PASS.

- [ ] **Step 8: Commit core interaction**

```powershell
git add src/components/living-block-map/controller.ts src/components/living-block-map/LivingBlockMap.astro src/pages/living-block-map/index.astro tests/living-block-map-lifecycle.test.ts tests/living-block-map-state.test.ts
git commit -m "feat: add Living Block Map controller"
```

### Task 6: Complete focus, keyboard, details, About, and WP-Bench behavior

**Files:**

- Modify: `src/components/living-block-map/controller.ts`
- Modify: `src/components/living-block-map/LivingBlockMap.astro`
- Modify: `tests/living-block-map-lifecycle.test.ts`
- Later browser gate: `tests/browser/living-block-map.test.ts`

**Interfaces:**

- Controller retains the opener element for inspect, About, and bench separately.
- One keydown handler covers Escape plus ability-tab and bench-stage roving keyboard behavior.

- [ ] **Step 1: Add failing state/markup assertions for every close path**

Assert details close returns to the same flow/browse state, About returns to attract or map, bench returns to its stored map trigger, and each path emits the approved announcement. Assert all three ability tabs use `role=tab`, `aria-selected`, `aria-controls`, and roving `tabindex`; bench stages expose equivalent selected state and keyboard operation.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/living-block-map-state.test.ts tests/living-block-map-markup.test.ts tests/living-block-map-lifecycle.test.ts`

Expected: FAIL on missing keyboard/focus controller behavior.

- [ ] **Step 3: Implement focus entry/restoration and Escape**

After starting/selecting/replaying/browsing, focus the first enabled card or documented control after render. Inspect/About/bench focus their close/heading control and restore the exact opener on close. Escape performs the same transition and focus restoration as the visible close button. Use `{ preventScroll:true }` and cancel pending focus timeouts on dispose.

- [ ] **Step 4: Implement roving tabs and stage keys**

ArrowLeft/ArrowRight wrap; Home/End select the first/last ability tab. Apply the same four keys to WP-Bench stage controls. Update state, ARIA, tab indexes, focus, panel visibility, and announcements in one render.

- [ ] **Step 5: Verify suggestion and role/detail content**

Ensure the selected flow controls which contextual role appears; browse mode renders only the definition/technical/connect/QR content. The Apply action changes the authored suggestion's phase/note exactly once and announces that a person chose it.

- [ ] **Step 6: Run focused tests and commit**

Run: `node --test tests/living-block-map-state.test.ts tests/living-block-map-markup.test.ts tests/living-block-map-lifecycle.test.ts && pnpm check`

```powershell
git add src/components/living-block-map/controller.ts src/components/living-block-map/LivingBlockMap.astro tests/living-block-map-lifecycle.test.ts
git commit -m "feat: complete map focus and detail journeys"
```

### Task 7: Add opt-in kiosk timing, wake lock, failure fallback, and full cleanup

**Files:**

- Modify: `src/components/living-block-map/controller.ts`
- Modify: `src/components/living-block-map/LivingBlockMap.astro`
- Modify: `tests/living-block-map-lifecycle.test.ts`
- Test: `tests/living-block-map-state.test.ts`

**Interfaces:**

- Kiosk mode is true only when `new URL(location.href).searchParams.get('kiosk') === '1'`.
- Disposal aborts all listener signals, clears every timer, releases wake lock, restores body class/overflow/position and root inline style/attributes, and removes active-instance references.

- [ ] **Step 1: Write failing public/kiosk lifecycle tests**

Assert public initialization never calls `setTimeout` for inactivity and never calls `navigator.wakeLock.request`. Assert kiosk map/About schedule 60,000 ms, inspect/bench 90,000 ms, attract schedules none, hidden expiration does not reset, returning visible schedules from the current state, pointer/keyboard activity reschedules, and disposal clears the timer and releases a held wake lock.

- [ ] **Step 2: Write failing restoration/fallback tests**

Snapshot body class, position, overflow, width, top, scroll coordinates, and root style before init; assert exact restoration after dispose and after forced initialization failure. Assert failure unhides `[data-map-fallback]`, leaves attract introduction readable, disables inert interactive controls, and does not throw past the lifecycle boundary.

- [ ] **Step 3: Run focused tests and verify RED**

Run: `node --test tests/living-block-map-lifecycle.test.ts tests/living-block-map-state.test.ts`

Expected: FAIL on missing kiosk and cleanup behavior.

- [ ] **Step 4: Implement kiosk-only timer and wake lock**

Call `inactivityDelay(state, kiosk)` after map activity/state changes. On expiry, reset only when visible; otherwise leave state untouched and schedule only on a later visible event. Request screen wake lock only in kiosk mode while visible; release on hidden/dispose and reacquire on visible.

- [ ] **Step 5: Implement document-state restoration**

Record exact pre-init values, apply only `core-ai-kiosk-active` and the fixed-stage scroll lock needed by the route, and return an idempotent restore function. Do not walk or hide sibling branches. Use one `AbortController.signal` for listeners and one registry for all timer IDs.

- [ ] **Step 6: Add guarded initialization fallback**

Wrap initialization in the lifecycle mount. On error, dispose partial state, unhide the normal fallback, remove `inert` from the introduction only, and log one actionable error; missing roots remain a silent no-op.

- [ ] **Step 7: Run focused tests and commit**

Run: `node --test tests/living-block-map-lifecycle.test.ts tests/living-block-map-state.test.ts && pnpm check:scripts`

```powershell
git add src/components/living-block-map/controller.ts src/components/living-block-map/LivingBlockMap.astro tests/living-block-map-lifecycle.test.ts tests/living-block-map-state.test.ts
git commit -m "feat: add opt-in map kiosk lifecycle"
```

### Task 8: Adapt compiled CSS and Vite-managed assets to visual parity

**Files:**

- Modify: `src/components/living-block-map/living-block-map.css`
- Modify: `src/components/living-block-map/LivingBlockMap.astro`
- Modify: `src/pages/living-block-map/index.astro`
- Modify: `tests/living-block-map-markup.test.ts`

**Interfaces:**

- CSS references the six copied fonts and map assets with paths Vite rewrites; no `/wp-content/`, plugin root, old hostname, or built hash is authored.
- Root exposes `--cai-scale`; the 1366 × 1024 stage uses that single uniform scale.

- [ ] **Step 1: Add failing CSS/build contracts**

Assert all six font families/weights are declared, compiled output contains hashed local font and QR URLs under both production and preview bases, site foundation loads before feature CSS, `.core-ai-map` neutralizes global box/heading/button/image/link rules, reduced-motion disables decorative path/token/spark/preview transitions, and no horizontal overflow rule relies on hardcoded viewport width.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/living-block-map-markup.test.ts tests/preview-base.test.ts`

Expected: FAIL until copied CSS URLs/selectors are adapted.

- [ ] **Step 3: Promote and adapt the compiled release CSS**

Start from the byte-copied `style-index.css`; expand only rules requiring edits. Replace plugin font URLs with relative Vite source URLs, remove WordPress wrapper assumptions/offline badge rules, add route-foundation neutralizers, preserve color/type/geometry/z-index/motion on the first parity pass, and retain `@media (prefers-contrast: more)` and `@media (prefers-reduced-motion: reduce)`.

- [ ] **Step 4: Verify three responsive viewports locally**

At 1366 × 1024, 1024 × 768, and 390 × 844, assert stage aspect ratio remains 1366:1024, `document.documentElement.scrollWidth === innerWidth`, focused controls remain within the viewport, and cards/panels remain operable. Record measured CSS changes in the commit body; do not visually redesign.

- [ ] **Step 5: Run focused build checks and commit**

Run: `node --test tests/living-block-map-markup.test.ts tests/preview-base.test.ts && pnpm build && pnpm check`

```powershell
git add src/components/living-block-map/living-block-map.css src/components/living-block-map/LivingBlockMap.astro src/pages/living-block-map/index.astro tests/living-block-map-markup.test.ts tests/preview-base.test.ts
git commit -m "style: port Living Block Map visual system"
```

### Task 9: Add the native route to the site cache contract

**Files:**

- Modify: `public/sw.js`
- Create: `tests/living-block-map-service-worker.test.ts`

**Interfaces:**

- `SHELL = ['.', 'privacy/', 'living-block-map/']`
- `VERSION = 'v4'`
- Existing network-first navigation and stale-while-revalidate asset behavior remains unchanged.

- [ ] **Step 1: Write failing service-worker tests**

Assert the exact v4 shell, atomic `cache.addAll(SHELL)`, deletion of old cache keys, route fallback, no map-specific worker/message/offline badge logic, and a production build containing every shell URL before install. Exercise a service-worker harness that warms the map route and confirms subsequently requested hashed CSS/JS/image/font responses are cacheable.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/living-block-map-service-worker.test.ts`

Expected: FAIL because the worker is v3 and omits the map route.

- [ ] **Step 3: Make the minimal worker change**

Add `living-block-map/` to `SHELL` and change only `VERSION` from `v3` to `v4`. Do not change strategy, register another worker, or claim cold offline support for unvisited hashed assets.

- [ ] **Step 4: Run focused tests and commit**

Run: `node --test tests/living-block-map-service-worker.test.ts && pnpm build`

```powershell
git add public/sw.js tests/living-block-map-service-worker.test.ts
git commit -m "feat: cache native Living Block Map route"
```

### Task 10: Build the blocking MAP-01 through MAP-23 browser suite

**Files:**

- Create: `tests/browser/harness.ts`
- Create: `tests/browser/living-block-map.test.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `.github/workflows/lint.yml`

**Interfaces:**

- `startMapTestSite()` builds once to a temporary directory, starts a base-aware static HTTP server on `127.0.0.1`, launches pinned Chromium, and returns `{ origin, browser, newPage, close }`.
- `pnpm test:browser` runs `node --test --test-concurrency=1 tests/browser/living-block-map.test.ts`.

- [ ] **Step 1: Write the browser harness and one failing MAP-01 test**

The harness must always close pages/browser/server and remove its temporary build in `after()`, even after assertion failures. Record console errors, page errors, failed requests, and responses with status ≥400 per page. MAP-01 first fails on the not-yet-complete route shell.

- [ ] **Step 2: Add exactly one test for every remaining MAP identifier**

Use these verbatim names and no duplicate identifiers:

```ts
const contracts = [
  'MAP-01 — Route shell',
  'MAP-02 — Attract state',
  'MAP-03 — Entry actions',
  'MAP-04 — WordPress uses AI',
  'MAP-05 — AI uses WordPress',
  'MAP-06 — An agent learns WordPress',
  'MAP-07 — WordPress tests the result',
  'MAP-08 — Flow controls',
  'MAP-09 — Browse mode',
  'MAP-10 — Card inspection',
  'MAP-11 — Abilities tabs',
  'MAP-12 — About',
  'MAP-13 — WP-Bench',
  'MAP-14 — Suggestion demo',
  'MAP-15 — Focus and announcements',
  'MAP-16 — Reduced motion',
  'MAP-17 — Timing modes',
  'MAP-18 — Astro lifecycle',
  'MAP-19 — Failure fallback',
  'MAP-20 — Runtime independence',
  'MAP-21 — Responsive stage',
  'MAP-22 — Content identity',
  'MAP-23 — Site cache',
] as const;
```

Drive real controls and assert visible content/ARIA/focus/network behavior. Use Playwright's clock for MAP-17; do not wait 60/90 real seconds. For MAP-18, navigate home and back through Astro transitions twice, then assert one action/announcement, restored body state, and no prior timer/wake lock. For MAP-22, compare DOM projections to the checked fixture rather than duplicating prose in the test.

- [ ] **Step 3: Run the suite and classify every RED failure**

Run: `pnpm test:browser`

Expected: individual failures name the missing contract, not harness errors. Fix harness errors before modifying production behavior.

- [ ] **Step 4: Close implementation gaps contract by contract**

For each failing MAP test, change the smallest relevant model/state/markup/controller/CSS/worker unit, rerun that test with `--test-name-pattern`, then rerun the full browser suite. Do not weaken expected copy, timings, request exclusions, overflow bounds, or accessible state to make a test pass.

- [ ] **Step 5: Add the separate blocking CI job**

Add `browser` beside the existing matrix job. It checks out, sets up pnpm 11 and Node 24, installs with frozen lockfile, runs `pnpm exec playwright install --with-deps chromium`, then `pnpm test:browser`. Do not add browser to the five-way lint matrix.

- [ ] **Step 6: Verify GREEN locally**

Run: `pnpm test:browser`

Expected: 23/23 MAP tests pass with no console error, page error, failed request, or leaked process.

- [ ] **Step 7: Commit the blocking browser gate**

```powershell
git add tests/browser package.json pnpm-lock.yaml .github/workflows/lint.yml src/components/living-block-map src/pages/living-block-map public/sw.js
git commit -m "test: gate Living Block Map browser contracts"
```

### Task 11: Add the purpose-built VIS-01 through VIS-15 parity gate

**Files:**

- Modify: `scripts/lib/report.ts`
- Create: `scripts/lib/living-block-map-parity.ts`
- Create: `scripts/verify-living-block-map-parity.ts`
- Create: `tests/living-block-map-parity.test.ts`
- Modify: `package.json`

**Interfaces:**

- Export `DIFF_RATIO_THRESHOLD = 0.005` from `scripts/lib/report.ts` and use it in both report and parity helpers.
- CLI: `pnpm verify:map-parity -- --reference <origin> --candidate <origin> [--out <dir>]`.
- Writes `<out>/<vis-id>/{reference,candidate,diff}.png` and `<out>/results.json`; exits nonzero on any error or ratio `> 0.005`.

- [ ] **Step 1: Write failing helper/CLI tests**

Test strict arg parsing, origin normalization, 15 unique VIS IDs, threshold boundary (`0.005` passes, `0.0050001` fails), dimension mismatch handling, non-2xx rejection, and nonzero capture-error exit. Assert `routesFor()` still excludes `/living-block-map/`.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/living-block-map-parity.test.ts`

Expected: FAIL because parity helpers and CLI do not exist and the threshold is not exported.

- [ ] **Step 3: Define old/native adapters and all capture states**

Use the same Chromium process, viewport 1366 × 1024, device scale 1, reduced motion, blocked service workers, and font-ready wait. Old adapter drives current `.core-ai-map__*` controls; native adapter drives `[data-action]` controls. Define this exact list:

```ts
const VISUAL_STATES = [
  'VIS-01 — settled attract screen',
  'VIS-02 — settled uses-ai flow',
  'VIS-03 — settled uses-wp flow',
  'VIS-04 — settled learns flow',
  'VIS-05 — settled tests flow',
  'VIS-06 — browse-all canvas',
  'VIS-07 — Abilities Overview details',
  'VIS-08 — Abilities Anatomy details',
  'VIS-09 — external AI service details',
  'VIS-10 — About screen',
  'VIS-11 — WP-Bench prompt stage',
  'VIS-12 — WP-Bench agent stage',
  'VIS-13 — WP-Bench sandbox stage',
  'VIS-14 — WP-Bench checks stage',
  'VIS-15 — applied suggestion state',
] as const;
```

- [ ] **Step 4: Implement strict capture/diff output**

Wait up to 180 seconds for each adapter's explicit ready selector and `document.fonts.ready`. Capture only the 1366 × 1024 map viewport, use `pixelmatch` with the shared threshold policy, and serialize URL, dimensions, differing pixels, ratio, status, and error per VIS ID. Close browser contexts in `finally`.

- [ ] **Step 5: Run helper tests and the live parity gate**

Start a local production build server on port 4326, then run:

```powershell
pnpm verify:map-parity -- --reference https://wcus.hperkins.com/ --candidate http://127.0.0.1:4326 --out artifacts/living-block-map-parity
```

Expected: every VIS state captures successfully and reports `diffRatio <= 0.005`.

- [ ] **Step 6: Fix only measured parity differences**

For any failure, inspect the reference/candidate/diff triplet, adjust the smallest content/geometry/type/style/state issue, rerun the individual state if supported, then rerun all 15. Record intentional public-timer/offline-badge differences outside the captured visible regions; do not raise the threshold.

- [ ] **Step 7: Commit the parity gate and retained evidence**

Do not commit large PNG artifacts unless the repository owner explicitly wants them versioned. Commit the script, tests, and JSON summary or a concise Markdown evidence report containing source/candidate revisions and ratios.

```powershell
git add scripts/lib/report.ts scripts/lib/living-block-map-parity.ts scripts/verify-living-block-map-parity.ts tests/living-block-map-parity.test.ts package.json docs/superpowers/evidence
git commit -m "test: add Living Block Map parity gate"
```

### Task 12: Run full gates and update the draft PR for native migration review

**Files:**

- Modify only if a gate reveals a defect: files owned by the failing task.
- Update remotely after push: PR #1 title/body/draft state only with explicit publish workflow authorization.

**Interfaces:**

- Required local gates are the exact eight commands in the approved design.
- The source repo remains clean and unchanged; its deployment remains live.

- [ ] **Step 1: Run formatting and static gates**

```powershell
pnpm format:check
pnpm lint
pnpm check:scripts
pnpm check
```

Expected: all exit 0 with no warnings treated as errors.

- [ ] **Step 2: Run unit/build/browser gates**

```powershell
pnpm test
pnpm build
pnpm test:browser
```

Expected: all flat Node tests and all 23 MAP tests pass.

- [ ] **Step 3: Run the external parity gate one final time**

Run the exact `verify:map-parity` command from Task 11 against a freshly served production build. Preserve the JSON result and command transcript as migration evidence.

- [ ] **Step 4: Verify repository boundaries**

Run:

```powershell
git status --short
git -C C:\Users\htper\core-ai-wcus status --short --branch
git diff --check
```

Expected: only intentional Astro-branch changes before the final commit; `core-ai-wcus` remains `main...origin/main` with no changes; `git diff --check` is silent.

- [ ] **Step 5: Commit any gate-only corrections**

Use a focused commit message naming the corrected contract. Do not squash source-oracle evidence into unrelated UI changes unless the user requests history rewriting.

- [ ] **Step 6: Prepare the PR update**

Replace the superseded title/body with a native-migration summary, explicit public-vs-kiosk behavior, MAP/VIS evidence, known release follow-ups, and the eight gate results. Keep the PR draft until the live parity evidence is present. Publishing/pushing and changing draft state use the dedicated GitHub publish workflow and require the user's chosen execution handoff.

- [ ] **Step 7: Stop before retirement**

Document that production deploy, 24-hour soak, Cloudflare Pages deletion, DNS removal, and source-tree retirement are pending. Do not perform them in this task.

## Plan Self-Review Checklist

- The implementation tasks cover every route, model, state, rendering, lifecycle, timing, visual, accessibility, offline/cache, tracking, test, CI, and parity section in the approved design.
- MAP-01 through MAP-23 are assigned to the blocking browser suite; VIS-01 through VIS-15 are assigned to the strict parity gate.
- The public/kiosk timing distinction, offline-badge removal, base-path behavior, six font preloads, fallback behavior, and Astro cleanup contract are explicit.
- The old repo stays available and untouched through parity; destructive deployment/source retirement is intentionally excluded until after the required production soak.
- No task adds Sass, WordPress, Playground, an iframe, a framework runtime, a second test runner, or runtime content fetching.
