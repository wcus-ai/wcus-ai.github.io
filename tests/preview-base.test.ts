import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { withAstroBuildLock } from './helpers/astro-build-lock.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = new URL('../dist/', import.meta.url);
const astro = fileURLToPath(new URL('../node_modules/astro/bin/astro.mjs', import.meta.url));

/**
 * Builds the site exactly the way the PR preview workflow does — under a base
 * path and with the tracking endpoint unset — then asserts the emitted HTML is
 * internally consistent: navigation, manifest, favicon and service worker all
 * resolve under the base, canonical URLs stay pointed at production, and the
 * tracking beacon is tree-shaken out of the client bundle.
 */

async function buildPreview(): Promise<void> {
  await withAstroBuildLock(() =>
    execFileSync(process.execPath, [astro, 'build', '--base', '/pr-preview/pr-99/'], {
      cwd: root,
      stdio: 'pipe',
      env: { ...process.env }, // deliberately no PUBLIC_TRACKING_ENDPOINT
    }),
  );
}

test('preview build: all internal links respect the base path', async () => {
  await buildPreview();
  const index = await readFile(new URL('index.html', dist), 'utf8');
  assert.ok(
    index.includes('href="/pr-preview/pr-99/p/abilities-api/"'),
    'project cards must link under the base path',
  );
  assert.ok(
    index.includes('href="/pr-preview/pr-99/privacy/"'),
    'footer privacy link must be base-aware',
  );
  assert.ok(
    index.includes('href="/pr-preview/pr-99/"') || index.includes('href="/pr-preview/pr-99'),
    'header brand link must be base-aware',
  );
  assert.ok(
    index.includes('/pr-preview/pr-99/manifest.webmanifest'),
    'manifest link must be base-aware',
  );
  assert.ok(index.includes('/pr-preview/pr-99/favicon.svg'), 'favicon must be base-aware');
  assert.ok(
    index.includes('/pr-preview/pr-99/sw.js'),
    'service worker must register under the base',
  );
  assert.ok(
    index.includes('href="/pr-preview/pr-99/living-block-map/"'),
    'Living Block Map teaser must link under the base path',
  );

  assert.ok(!index.includes('href="/p/'), 'no root-absolute project links may remain');
  assert.ok(!index.includes('href="/privacy/"'), 'no root-absolute privacy link may remain');
});

test('preview build: project detail back-link respects the base path', async () => {
  const page = await readFile(new URL('p/abilities-api/index.html', dist), 'utf8');
  assert.ok(page.includes('href="/pr-preview/pr-99/"'), 'back-to-projects link must be base-aware');
});

test('preview build: canonical URLs stay on production, not the preview path', async () => {
  const index = await readFile(new URL('index.html', dist), 'utf8');
  const canonical = /rel="canonical" href="([^"]+)"/.exec(index)?.[1];
  assert.ok(canonical, 'canonical link must exist');
  assert.ok(!canonical.includes('pr-preview'), 'canonical must not point at the preview');
});

test('preview build: the vendored Living Block Map is base-agnostic', async () => {
  const map = await readFile(new URL('living-block-map/index.html', dist), 'utf8');

  assert.ok(
    map.includes('<link rel="canonical" href="https://wcus-ai.github.io/living-block-map/"'),
    'map canonical must omit the preview base',
  );

  // The kiosk ships as a static page copied verbatim out of `public/`, so Astro
  // never rewrites its URLs for the preview base. It stays correct under any
  // base by referencing its assets relatively instead.
  const fontPreloads = map.match(/<link rel="preload"[^>]*type="font\/woff2"[^>]*>/g) ?? [];
  assert.equal(fontPreloads.length, 6);
  assert.ok(
    fontPreloads.every((link) => link.includes('href="fonts/')),
    'every font preload must resolve relative to the page',
  );

  for (const asset of map.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)) {
    assert.ok(
      !asset[1].startsWith('/') && !/^https?:/.test(asset[1]),
      `map image must resolve relative to the page: ${asset[1]}`,
    );
  }
});

test('preview build: tracking beacon is absent from the client bundle', async () => {
  const astroDir = new URL('_astro/', dist);
  const files = await readdir(astroDir);
  const jsFiles = files.filter((f) => f.endsWith('.js'));
  assert.ok(jsFiles.length > 0, 'client bundle must exist');
  const sources = await Promise.all(jsFiles.map((f) => readFile(new URL(f, astroDir), 'utf8')));
  for (const [i, src] of sources.entries()) {
    assert.ok(!src.includes('sendBeacon'), `no beacon code may ship in previews (${jsFiles[i]})`);
  }
});
