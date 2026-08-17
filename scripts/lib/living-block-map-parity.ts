/* oxlint-disable no-await-in-loop -- Visual states are intentionally captured sequentially in one browser process. */
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pixelmatch from 'pixelmatch';
import { chromium, type Browser, type BrowserContext, type Frame, type Page } from 'playwright';
import { PNG } from 'pngjs';
import { DIFF_RATIO_THRESHOLD } from './report.ts';

const CAPTURE_TIMEOUT_MS = 180_000;
const ACTION_TIMEOUT_MS = 30_000;
const VIEWPORT = { width: 1_366, height: 1_024 } as const;
const DEFAULT_OUTPUT_DIRECTORY = 'artifacts/living-block-map-parity';
const PIXELMATCH_COLOR_THRESHOLD = 0.1;
const CONTEXT_OPTIONS = {
  viewport: VIEWPORT,
  deviceScaleFactor: 1,
  reducedMotion: 'reduce' as const,
  colorScheme: 'light' as const,
  locale: 'en-US',
};

const VISUAL_STATE_LABELS = [
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

const VISUAL_STATE_KEYS = [
  'attract',
  'uses-ai',
  'uses-wp',
  'learns',
  'tests',
  'browse',
  'abilities-overview',
  'abilities-anatomy',
  'provider-details',
  'about',
  'bench-task',
  'bench-model',
  'bench-sandbox',
  'bench-checks',
  'applied-suggestion',
] as const;

type VisualStateKey = (typeof VISUAL_STATE_KEYS)[number];
type MapSurface = Page | Frame;

export const VISUAL_STATES = VISUAL_STATE_LABELS.map((label, index) => ({
  id: label.slice(0, 6),
  label,
  key: VISUAL_STATE_KEYS[index],
}));

export interface ParityOptions {
  readonly reference: string;
  readonly candidate: string;
  readonly out: string;
}

export type ParityStatus = 'pass' | 'fail' | 'error';

export interface ParityResult {
  readonly id: string;
  readonly name: string;
  readonly referenceUrl: string;
  readonly candidateUrl: string;
  readonly width: number;
  readonly height: number;
  readonly diffPixels: number;
  readonly diffRatio: number;
  readonly status: ParityStatus;
  readonly error: string | null;
}

export interface ParityReport {
  readonly generatedAt: string;
  readonly reference: string;
  readonly candidate: string;
  readonly outputDirectory: string;
  readonly threshold: number;
  readonly viewport: typeof VIEWPORT & { readonly deviceScaleFactor: 1 };
  readonly results: readonly ParityResult[];
}

export interface ParityDiff {
  readonly reference: PNG;
  readonly candidate: PNG;
  readonly diff: PNG;
  readonly width: number;
  readonly height: number;
  readonly diffPixels: number;
  readonly diffRatio: number;
}

interface AdapterSelectors {
  readonly kind: 'reference' | 'candidate';
  readonly route: string;
  readonly ready: string;
  readonly start: string;
  readonly browse: string;
  readonly rail: string;
  readonly abilityCard: string;
  readonly providerCard: string;
  readonly abilityAnatomy: string;
  readonly about: string;
  readonly openBench: string;
  readonly applySuggestion: string;
  benchStage(stage: string): string;
}

const REFERENCE_ADAPTER: AdapterSelectors = {
  kind: 'reference',
  route: '/',
  ready: '.core-ai-map.is-ready',
  start: '.core-ai-map__prompt',
  browse: '.core-ai-map__attract-browse',
  rail: '.core-ai-map__rail button',
  abilityCard: '.core-ai-map__block--abilities .core-ai-map__block-body',
  providerCard: '.core-ai-map__actor--provider .core-ai-map__actor-body',
  abilityAnatomy: '[data-core-ai-abilities-tab="anatomy"]',
  about: '.core-ai-map__about-trigger',
  openBench: '.core-ai-map__run-loop-link:visible',
  applySuggestion: '.core-ai-map__workbench-apply',
  benchStage: (stage) => `[data-core-ai-stage="${stage}"]`,
};

const CANDIDATE_ADAPTER: AdapterSelectors = {
  kind: 'candidate',
  route: '/living-block-map/',
  ready: '[data-map-root][data-map-state="attract"] [data-action="start"]',
  start: '[data-map-screen="attract"] [data-action="start"]',
  browse: '[data-map-screen="attract"] [data-action="browse"]',
  rail: '[data-action="select-flow"]',
  abilityCard: '[data-map-surface="canvas"] [data-card-id="abilities"] [data-action="inspect"]',
  providerCard: '[data-map-surface="canvas"] [data-card-id="provider"] [data-action="inspect"]',
  abilityAnatomy: '[data-action="select-ability-tab"][data-tab-id="anatomy"]',
  about: '[data-action="open-about"]',
  openBench: '[data-action="open-bench"]:visible',
  applySuggestion: '[data-action="apply-suggestion"]',
  benchStage: (stage) => `[data-action="select-bench-stage"][data-stage-id="${stage}"]`,
};

const fontQueries = [
  '400 16px "Core AI Inter"',
  '400 16px "Core AI EB Garamond"',
  '400 16px "Core AI IBM Plex Mono"',
  '500 16px "Core AI IBM Plex Mono"',
  '600 16px "Core AI IBM Plex Mono"',
  '700 16px "Core AI IBM Plex Mono"',
] as const;

const errorMessage = (error: unknown): string =>
  error instanceof Error ? `${error.name}: ${error.message}` : String(error);

export function normalizeOrigin(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Invalid origin: ${value}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Origin must use http or https: ${value}`);
  }
  if (url.username || url.password)
    throw new Error(`Origin must not contain credentials: ${value}`);
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error(`Expected an origin without a path, query, or fragment: ${value}`);
  }
  return url.origin;
}

export function parseParityArgs(argv: readonly string[]): ParityOptions {
  const args = argv[0] === '--' ? argv.slice(1) : argv;
  const values = new Map<string, string>();
  const allowed = new Set(['reference', 'candidate', 'out']);
  for (let index = 0; index < args.length; index += 2) {
    const option = args[index];
    const value = args[index + 1];
    if (!option?.startsWith('--')) throw new Error(`Expected a --flag at argument ${index + 1}.`);
    const name = option.slice(2);
    if (!allowed.has(name)) throw new Error(`Unknown option --${name}.`);
    if (values.has(name)) throw new Error(`Duplicate option --${name}.`);
    if (!value || value.startsWith('--')) throw new Error(`Missing value for --${name}.`);
    values.set(name, value);
  }
  const reference = values.get('reference');
  const candidate = values.get('candidate');
  if (!reference) throw new Error('Missing required option --reference.');
  if (!candidate) throw new Error('Missing required option --candidate.');
  return {
    reference: normalizeOrigin(reference),
    candidate: normalizeOrigin(candidate),
    out: values.get('out') ?? DEFAULT_OUTPUT_DIRECTORY,
  };
}

export function parityStatus(diffRatio: number): Exclude<ParityStatus, 'error'> {
  return diffRatio > DIFF_RATIO_THRESHOLD ? 'fail' : 'pass';
}

export async function withCaptureRetries<T>(
  capture: () => Promise<T>,
  attempts: number,
): Promise<T> {
  if (!Number.isInteger(attempts) || attempts < 1) {
    throw new Error('Capture attempts must be a positive integer.');
  }
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await capture();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

export function assertSuccessfulNavigation(url: string, status: number | null): void {
  if (status === null) throw new Error(`Navigation did not return an HTTP response: ${url}`);
  if (status < 200 || status >= 300) throw new Error(`Navigation returned HTTP ${status}: ${url}`);
}

export function diffParityPngs(referenceBuffer: Buffer, candidateBuffer: Buffer): ParityDiff {
  const reference = PNG.sync.read(referenceBuffer);
  const candidate = PNG.sync.read(candidateBuffer);
  if (reference.width !== candidate.width || reference.height !== candidate.height) {
    throw new Error(
      `Screenshot dimension mismatch: reference ${reference.width} x ${reference.height}; candidate ${candidate.width} x ${candidate.height}.`,
    );
  }
  const diff = new PNG({ width: reference.width, height: reference.height });
  const diffPixels = pixelmatch(
    reference.data,
    candidate.data,
    diff.data,
    reference.width,
    reference.height,
    { threshold: PIXELMATCH_COLOR_THRESHOLD },
  );
  return {
    reference,
    candidate,
    diff,
    width: reference.width,
    height: reference.height,
    diffPixels,
    diffRatio: diffPixels / (reference.width * reference.height),
  };
}

const stateUrl = (origin: string, adapter: AdapterSelectors): string =>
  new URL(adapter.route, `${origin}/`).href;

const waitForFonts = async (surface: MapSurface): Promise<void> => {
  const loaded = await surface.evaluate(async (queries) => {
    const sets = await Promise.all(queries.map((query) => document.fonts.load(query)));
    await document.fonts.ready;
    return sets.map((faces, index) => faces.length > 0 && document.fonts.check(queries[index]));
  }, fontQueries);
  if (!loaded.every(Boolean))
    throw new Error('One or more of the six map font faces did not load.');
};

const selectFlow = async (
  page: MapSurface,
  adapter: AdapterSelectors,
  flowIndex: number,
): Promise<void> => {
  await page.locator(adapter.start).click({ timeout: ACTION_TIMEOUT_MS });
  const selected = page.locator(adapter.rail).nth(flowIndex);
  if (flowIndex !== 0) await selected.click({ timeout: ACTION_TIMEOUT_MS });
  await page.waitForFunction(
    ({ selector, index }) =>
      document.querySelectorAll(selector)[index]?.getAttribute('aria-pressed') === 'true',
    { selector: adapter.rail, index: flowIndex },
    { timeout: ACTION_TIMEOUT_MS },
  );
  await page
    .locator('.core-ai-map__story-flow:not([hidden]) .core-ai-map__takeaway:not([hidden])')
    .waitFor({ state: 'visible', timeout: ACTION_TIMEOUT_MS });
};

const openBench = async (
  page: MapSurface,
  adapter: AdapterSelectors,
  stage: 'task' | 'model' | 'sandbox' | 'checks',
): Promise<void> => {
  await selectFlow(page, adapter, 3);
  await page.locator(adapter.openBench).click({ timeout: ACTION_TIMEOUT_MS });
  const stageButton = page.locator(adapter.benchStage(stage));
  if ((await stageButton.getAttribute('aria-pressed')) !== 'true') {
    await stageButton.click({ timeout: ACTION_TIMEOUT_MS });
  }
  await page.waitForFunction(
    (selector) => document.querySelector(selector)?.getAttribute('aria-pressed') === 'true',
    adapter.benchStage(stage),
    { timeout: ACTION_TIMEOUT_MS },
  );
  await page
    .locator('.core-ai-map__bench:not([hidden])')
    .waitFor({ state: 'visible', timeout: ACTION_TIMEOUT_MS });
};

const prepareState = async (
  page: MapSurface,
  adapter: AdapterSelectors,
  key: VisualStateKey,
): Promise<void> => {
  switch (key) {
    case 'attract':
      return;
    case 'uses-ai':
      await selectFlow(page, adapter, 0);
      return;
    case 'uses-wp':
      await selectFlow(page, adapter, 1);
      return;
    case 'learns':
      await selectFlow(page, adapter, 2);
      return;
    case 'tests':
      await selectFlow(page, adapter, 3);
      return;
    case 'browse':
      await page.locator(adapter.browse).click({ timeout: ACTION_TIMEOUT_MS });
      await page
        .locator('.core-ai-map__browse-note:not([hidden])')
        .waitFor({ state: 'visible', timeout: ACTION_TIMEOUT_MS });
      return;
    case 'abilities-overview':
    case 'abilities-anatomy':
      await selectFlow(page, adapter, 1);
      await page.locator(adapter.abilityCard).click({ timeout: ACTION_TIMEOUT_MS });
      await page
        .locator('.core-ai-map__details article:not([hidden])')
        .waitFor({ state: 'visible', timeout: ACTION_TIMEOUT_MS });
      if (key === 'abilities-anatomy') {
        await page.locator(adapter.abilityAnatomy).click({ timeout: ACTION_TIMEOUT_MS });
        await page.waitForFunction(
          (selector) => document.querySelector(selector)?.getAttribute('aria-selected') === 'true',
          adapter.abilityAnatomy,
          { timeout: ACTION_TIMEOUT_MS },
        );
      }
      return;
    case 'provider-details':
      await selectFlow(page, adapter, 0);
      await page.locator(adapter.providerCard).click({ timeout: ACTION_TIMEOUT_MS });
      await page
        .locator('.core-ai-map__details article:not([hidden])')
        .waitFor({ state: 'visible', timeout: ACTION_TIMEOUT_MS });
      return;
    case 'about':
      await page.locator(adapter.about).click({ timeout: ACTION_TIMEOUT_MS });
      await page
        .locator('.core-ai-map__about:not([hidden])')
        .waitFor({ state: 'visible', timeout: ACTION_TIMEOUT_MS });
      return;
    case 'bench-task':
      await openBench(page, adapter, 'task');
      return;
    case 'bench-model':
      await openBench(page, adapter, 'model');
      return;
    case 'bench-sandbox':
      await openBench(page, adapter, 'sandbox');
      return;
    case 'bench-checks':
      await openBench(page, adapter, 'checks');
      return;
    case 'applied-suggestion':
      await selectFlow(page, adapter, 0);
      await page.locator(adapter.applySuggestion).click({ timeout: ACTION_TIMEOUT_MS });
      await page.waitForFunction(
        () =>
          document
            .querySelector('.core-ai-map__workbench-phase')
            ?.textContent?.includes('Applied') === true,
        undefined,
        { timeout: ACTION_TIMEOUT_MS },
      );
  }
};

const findMapSurface = async (page: Page, adapter: AdapterSelectors): Promise<MapSurface> => {
  const deadline = Date.now() + CAPTURE_TIMEOUT_MS;
  do {
    const surfaces: MapSurface[] = adapter.kind === 'reference' ? page.frames() : [page];
    for (const surface of surfaces) {
      try {
        const ready = surface.locator(adapter.ready);
        if ((await ready.count()) > 0 && (await ready.first().isVisible())) return surface;
      } catch (error) {
        if (adapter.kind !== 'reference' || page.isClosed()) throw error;
      }
    }
    await page.waitForTimeout(100);
  } while (Date.now() < deadline);
  throw new Error(`Map ready selector timed out after ${CAPTURE_TIMEOUT_MS}ms: ${adapter.ready}`);
};

const captureState = async (
  context: BrowserContext,
  adapter: AdapterSelectors,
  origin: string,
  key: VisualStateKey,
): Promise<Buffer> => {
  const page = await context.newPage();
  const url = stateUrl(origin, adapter);
  try {
    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: CAPTURE_TIMEOUT_MS,
    });
    assertSuccessfulNavigation(url, response?.status() ?? null);
    const surface = await findMapSurface(page, adapter);
    if (adapter.kind === 'reference') {
      await page
        .locator('[data-core-ai-loader]')
        .waitFor({ state: 'hidden', timeout: CAPTURE_TIMEOUT_MS });
    }
    await waitForFonts(surface);
    await surface.addStyleTag({
      content:
        '*, *::before, *::after { animation: none !important; caret-color: transparent !important; transition: none !important; }',
    });
    await prepareState(surface, adapter, key);
    await surface.evaluate(async () => {
      (document.activeElement as HTMLElement | null)?.blur();
      await new Promise<void>((resolveFrame) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame())),
      );
    });
    return await page.screenshot({ fullPage: false, animations: 'disabled' });
  } finally {
    await page.close();
  }
};

const captureInFreshContext = async (
  browser: Browser,
  adapter: AdapterSelectors,
  origin: string,
  key: VisualStateKey,
): Promise<Buffer> =>
  withCaptureRetries(
    async () => {
      const context = await browser.newContext({
        ...CONTEXT_OPTIONS,
        serviceWorkers: adapter.kind === 'reference' ? 'allow' : 'block',
      });
      try {
        return await captureState(context, adapter, origin, key);
      } finally {
        await context.close();
      }
    },
    adapter.kind === 'reference' ? 2 : 1,
  );

const errorResult = (
  id: string,
  name: string,
  referenceUrl: string,
  candidateUrl: string,
  error: unknown,
): ParityResult => ({
  id,
  name,
  referenceUrl,
  candidateUrl,
  width: 0,
  height: 0,
  diffPixels: 0,
  diffRatio: 1,
  status: 'error',
  error: errorMessage(error),
});

export async function runLivingBlockMapParity(options: ParityOptions): Promise<ParityReport> {
  const outputDirectory = resolve(options.out);
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all(
    VISUAL_STATES.map(({ id }) =>
      rm(resolve(outputDirectory, id), { recursive: true, force: true }),
    ),
  );
  await rm(resolve(outputDirectory, 'results.json'), { force: true });
  const browser = await chromium.launch({ headless: true });
  const results: ParityResult[] = [];
  try {
    for (const state of VISUAL_STATES) {
      const referenceUrl = stateUrl(options.reference, REFERENCE_ADAPTER);
      const candidateUrl = stateUrl(options.candidate, CANDIDATE_ADAPTER);
      const stateDirectory = resolve(outputDirectory, state.id);
      await mkdir(stateDirectory, { recursive: true });
      try {
        const referenceBuffer = await captureInFreshContext(
          browser,
          REFERENCE_ADAPTER,
          options.reference,
          state.key,
        );
        await writeFile(resolve(stateDirectory, 'reference.png'), referenceBuffer);
        const candidateBuffer = await captureInFreshContext(
          browser,
          CANDIDATE_ADAPTER,
          options.candidate,
          state.key,
        );
        await writeFile(resolve(stateDirectory, 'candidate.png'), candidateBuffer);
        const compared = diffParityPngs(referenceBuffer, candidateBuffer);
        await writeFile(resolve(stateDirectory, 'diff.png'), PNG.sync.write(compared.diff));
        results.push({
          id: state.id,
          name: state.label,
          referenceUrl,
          candidateUrl,
          width: compared.width,
          height: compared.height,
          diffPixels: compared.diffPixels,
          diffRatio: compared.diffRatio,
          status: parityStatus(compared.diffRatio),
          error: null,
        });
      } catch (error) {
        results.push(errorResult(state.id, state.label, referenceUrl, candidateUrl, error));
      }
    }
  } finally {
    await browser.close();
  }
  const report: ParityReport = {
    generatedAt: new Date().toISOString(),
    reference: options.reference,
    candidate: options.candidate,
    outputDirectory,
    threshold: DIFF_RATIO_THRESHOLD,
    viewport: { ...VIEWPORT, deviceScaleFactor: 1 },
    results,
  };
  await writeFile(resolve(outputDirectory, 'results.json'), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}
