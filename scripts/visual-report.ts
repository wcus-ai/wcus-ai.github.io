#!/usr/bin/env node
/* eslint-disable no-await-in-loop -- route captures share one page and must stay sequential for deterministic screenshots */
/**
 * Visual regression driver for PR previews.
 *
 * Screenshots every route on the production site and on a locally served
 * preview build at a fixed mobile viewport, diffs them with pixelmatch, and
 * writes a self-contained report (images + index.html + comment.md).
 *
 * This is a reporting tool, not a gate: it always exits 0 so the PR preview
 * comment can surface whatever it found, including per-page load errors.
 *
 * Usage:
 *   node scripts/visual-report.ts \
 *     --prod https://wcus-ai.github.io \
 *     --preview http://localhost:4326 \
 *     --out preview-out/report \
 *     --pr-number 99 --sha abc1234 \
 *     --public-preview-url https://wcus-ai.github.io/pr-preview/pr-99/ \
 *     --public-report-url https://wcus-ai.github.io/pr-preview/pr-99/report/ \
 *     --run-url https://github.com/.../actions/runs/123
 */

import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { chromium, type Page } from 'playwright';
import {
  generateComment,
  generateHtml,
  normalizeHeights,
  routesFor,
  type PageResult,
} from './lib/report.ts';

const VIEWPORT = { width: 390, height: 844, deviceScaleFactor: 2 };
const SETTLE_MS = 500;
const SETTLE_BUDGET_MS = 5000;

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 2; i < argv.length; i += 2) {
    args[argv[i].replace(/^--/, '')] = argv[i + 1];
  }
  return args;
}

const args = parseArgs(process.argv);
for (const required of [
  'prod',
  'preview',
  'out',
  'pr-number',
  'sha',
  'public-preview-url',
  'public-report-url',
  'run-url',
]) {
  if (!args[required]) {
    console.error(`missing --${required}`);
    process.exit(2);
  }
}

async function projectSlugs(): Promise<string[]> {
  const dir = new URL('../src/content/projects/', import.meta.url);
  const files = await readdir(dir);
  return files.filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, ''));
}

function dirFor(routePath: string): string {
  const dir = routePath.replace(/(^\/|\/$)/g, '').replaceAll('/', '-');
  return dir || 'home';
}

async function capture(page: Page, url: string): Promise<Buffer> {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  // Lazy images below the fold never load until scrolled into view.
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let last = -1;
      const step = () => {
        window.scrollTo(0, document.documentElement.scrollHeight);
        if (window.scrollY === last) return resolve();
        last = window.scrollY;
        setTimeout(step, 100);
      };
      step();
    });
    window.scrollTo(0, 0);
  });
  // Race-settle fonts and image decode: decode() pends forever for images
  // that never entered the viewport, and page.evaluate has no timeout.
  await page.evaluate(
    (budget) =>
      Promise.race([
        Promise.all([
          document.fonts.ready,
          ...[...document.images].map((i) => i.decode().catch(() => {})),
        ]),
        new Promise((resolve) => setTimeout(resolve, budget)),
      ]),
    SETTLE_BUDGET_MS,
  );
  await page.waitForTimeout(SETTLE_MS);
  return page.screenshot({ fullPage: true });
}

const routes = routesFor(await projectSlugs());
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: VIEWPORT,
  serviceWorkers: 'block',
  reducedMotion: 'reduce',
});
const page = await context.newPage();
// addInitScript re-runs on every navigation — addStyleTag would only style
// the first document and leave animations live on later routes.
await context.addInitScript(() => {
  const style = document.createElement('style');
  style.textContent = '* { animation: none !important; transition: none !important; }';
  document.documentElement.prepend(style);
});

const results: PageResult[] = [];
for (const route of routes) {
  const dir = path.join(args.out, dirFor(route.path));
  await mkdir(dir, { recursive: true });
  const entry: PageResult = {
    name: route.name,
    path: route.path,
    urlPath: route.path,
    dir: dirFor(route.path),
    diffRatio: 0,
    diffPixels: 0,
    width: 0,
    height: 0,
  };
  try {
    const beforeBuf = await capture(page, args.prod + route.path);
    // eslint-disable-next-line no-await-in-loop
    const afterBuf = await capture(page, args.preview + route.path);
    let before: PNG = PNG.sync.read(beforeBuf);
    let after: PNG = PNG.sync.read(afterBuf);
    [before, after] = normalizeHeights(before, after);
    const diff = new PNG({ width: before.width, height: before.height });
    const diffPixels = pixelmatch(before.data, after.data, diff.data, before.width, before.height, {
      threshold: 0.1,
    });
    writeFileSync(path.join(dir, 'before.png'), PNG.sync.write(before));
    writeFileSync(path.join(dir, 'after.png'), PNG.sync.write(after));
    writeFileSync(path.join(dir, 'diff.png'), PNG.sync.write(diff));
    Object.assign(entry, {
      diffPixels,
      width: before.width,
      height: before.height,
      diffRatio: diffPixels / (before.width * before.height),
    });
    console.log(
      `${route.path}: ${entry.diffRatio * 100 > 0.1 ? 'CHANGED' : 'identical'} (${diffPixels} px)`,
    );
  } catch (error) {
    entry.error = String(error);
    console.error(`${route.path}: capture failed — ${error}`);
  }
  results.push(entry);
}
await browser.close();

const contextForReport = {
  results,
  prNumber: Number(args['pr-number']),
  sha: args.sha,
  previewUrl: args['public-preview-url'],
  reportUrl: args['public-report-url'],
  baseUrl: args['public-report-url'].replace(/\/$/, ''),
  runUrl: args['run-url'],
};

await writeFile(path.join(args.out, 'index.html'), generateHtml(contextForReport));
await writeFile(path.join(args.out, 'comment.md'), generateComment(contextForReport));
await writeFile(path.join(args.out, 'results.json'), JSON.stringify(results, null, 2));
console.log(`report written to ${args.out}`);
// A crashed browser leaves its pipe handles holding the event loop open;
// never let a dead transport wedge the CI step after the report is written.
process.exit(0);
