import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { withAstroBuildLock } from './helpers/astro-build-lock.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const astro = join(root, 'node_modules', 'astro', 'bin', 'astro.mjs');
const mapCssPath = join(root, 'src', 'components', 'living-block-map', 'living-block-map.css');

test('native route builds a complete semantic first paint', async () => {
  const outDir = await mkdtemp(join(tmpdir(), 'wcus-living-map-route-'));

  try {
    await withAstroBuildLock(() =>
      execFileSync(process.execPath, [astro, 'build', '--outDir', outDir], {
        cwd: root,
        stdio: 'pipe',
        env: { ...process.env },
      }),
    );

    const html = await readFile(join(outDir, 'living-block-map', 'index.html'), 'utf8');
    const sourceCss = await readFile(mapCssPath, 'utf8');

    assert.match(
      html,
      /<main[^>]*class="core-ai-map[^>]*aria-label="WordPress Core AI Living Block Map"/,
    );
    assert.match(
      html,
      /<link rel="canonical" href="https:\/\/wcus-ai\.github\.io\/living-block-map"/,
    );

    const fontPreloads = html.match(/<link rel="preload"[^>]*type="font\/woff2"[^>]*>/g) ?? [];
    assert.equal(fontPreloads.length, 6);
    assert.ok(fontPreloads.every((link) => /href="\/_astro\/[^"/]+\.woff2"/.test(link)));
    assert.ok(fontPreloads.every((link) => link.includes('crossorigin')));

    const stylesheetHrefs = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(
      (match) => match[1],
    );
    const stylesheets = await Promise.all(
      stylesheetHrefs.map((href) => {
        const filename = href.split('/').at(-1);
        assert.ok(filename, `stylesheet href must end in a filename: ${href}`);
        return readFile(join(outDir, '_astro', filename), 'utf8');
      }),
    );
    const compiledCss = stylesheets.join('\n');
    const foundationPosition = compiledCss.search(/--color-bg:\s*#faf6f4/);
    const mapPosition = compiledCss.search(/--core-ai-blue:\s*#3858e9/);
    assert.ok(foundationPosition >= 0, 'compiled route must contain the site foundation');
    assert.ok(mapPosition > foundationPosition, 'site foundation must load before map styles');

    const builtMapFonts = [
      ...compiledCss.matchAll(
        /url\(([^)]*(?:inter-latin-wght-normal|eb-garamond-latin-wght-normal|ibm-plex-mono-latin-(?:400|500|600|700)-normal)\.[A-Za-z0-9_-]+\.woff2)\)/g,
      ),
    ].map((match) => match[1].replaceAll('"', ''));
    assert.equal(builtMapFonts.length, 6);
    assert.ok(builtMapFonts.every((url) => url.startsWith('/_astro/')));

    assert.equal((sourceCss.match(/@font-face/g) ?? []).length, 6);
    for (const fontContract of [
      /font-family: Core AI Inter;[\s\S]*?font-weight: 100 900;/,
      /font-family: Core AI EB Garamond;[\s\S]*?font-weight: 400 800;/,
      /font-family: Core AI IBM Plex Mono;[\s\S]*?font-weight: 400;/,
      /font-family: Core AI IBM Plex Mono;[\s\S]*?font-weight: 500;/,
      /font-family: Core AI IBM Plex Mono;[\s\S]*?font-weight: 600;/,
      /font-family: Core AI IBM Plex Mono;[\s\S]*?font-weight: 700;/,
    ]) {
      assert.match(sourceCss, fontContract);
    }
    for (const neutralizer of [
      /\.core-ai-map :where\(h1, h2, h3, h4, h5, h6, p\)/,
      /\.core-ai-map button/,
      /\.core-ai-map img/,
      /\.core-ai-map a\s*\{/,
    ]) {
      assert.match(sourceCss, neutralizer);
    }
    assert.match(
      sourceCss,
      /\.core-ai-map\s*\{[\s\S]*?font-weight: 300;[\s\S]*?letter-spacing: -0\.1px;/,
    );
    assert.match(
      sourceCss,
      /\.core-ai-map :where\(h1, h2, h3, h4, h5, h6, p\)\s*\{[\s\S]*?letter-spacing: inherit;/,
    );
    const buttonNeutralizer = sourceCss.match(/\.core-ai-map button\s*\{([^}]*)\}/)?.[1] ?? '';
    assert.doesNotMatch(
      buttonNeutralizer,
      /margin:/,
      'button neutralization must preserve authored component margins',
    );
    assert.match(sourceCss, /\.core-ai-map__details-heading\s*\{[\s\S]*?line-height: 1\.125;/);
    assert.match(sourceCss, /--cai-scale: 1;/);
    assert.match(
      sourceCss,
      /\.core-ai-map__stage\s*\{[\s\S]*?height: 1024px;[\s\S]*?scale\(var\(--cai-scale\)\)[\s\S]*?width: 1366px;/,
    );
    assert.ok(!/100d?vw/.test(sourceCss), 'map sizing must not rely on viewport-width units');
    assert.ok(!sourceCss.includes('.core-ai-map__offline'));
    assert.ok(!/\/wp-content\/|wcus\.hperkins\.com|\/_astro\//.test(sourceCss));
    assert.match(sourceCss, /@media \(prefers-contrast: more\)/);
    const reducedMotion = sourceCss.slice(sourceCss.indexOf('@media (prefers-reduced-motion'));
    for (const selector of [
      '.core-ai-map__flow path',
      '.core-ai-map__preview-flow path',
      '.core-ai-map__spark',
      '.core-ai-map__token',
    ]) {
      assert.ok(reducedMotion.includes(selector), `reduced motion must cover ${selector}`);
    }
    assert.match(reducedMotion, /animation: none !important;/);

    assert.ok(!html.includes('data-wp-'));
    assert.ok(!html.includes('<header class="site-header"'));
    assert.ok(!html.includes('<footer class="site-footer"'));
    assert.ok(!/Playground|WebAssembly|@wordpress\//i.test(html));
    assert.ok(!html.includes('wcus.hperkins.com'));

    assert.match(html, /<noscript>[\s\S]*requires JavaScript[\s\S]*href="\/"[\s\S]*<\/noscript>/);
    assert.match(html, /data-map-fallback[^>]*hidden/);

    const headings = html.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/g) ?? [];
    assert.equal(headings.length, 2, 'attract and persistent map headings must both be authored');
    assert.equal(
      headings.filter((heading) => !/<h1\b[^>]*\bhidden(?:\s|>)/.test(heading)).length,
      1,
    );
    assert.ok(headings.some((heading) => /What is WordPress Core AI\?/.test(heading)));

    assert.match(html, /data-map-screen="attract"(?![^>]*\bhidden)[^>]*>/);
    for (const screen of ['map', 'inspect', 'about', 'bench']) {
      assert.match(
        html,
        new RegExp(`data-map-screen="${screen}"[^>]*\\bhidden\\b[^>]*\\binert\\b`),
        `${screen} must be hidden and inert before the controller starts`,
      );
    }

    for (const action of [
      'start',
      'browse',
      'select-flow',
      'inspect',
      'close-inspect',
      'replay-flow',
      'reset',
      'open-about',
      'close-about',
      'select-ability-tab',
      'open-bench',
      'close-bench',
      'select-bench-stage',
      'apply-suggestion',
    ]) {
      assert.ok(html.includes(`data-action="${action}"`), `missing ${action} control`);
    }

    for (const flow of ['uses-ai', 'uses-wp', 'learns', 'tests']) {
      assert.ok(html.includes(`data-story-id="${flow}"`), `missing ${flow} flow`);
    }
    for (const card of [
      'plugin',
      'client',
      'connectors',
      'mcp',
      'abilities',
      'bench',
      'assistant',
      'skills',
      'agent',
      'task',
      'provider',
      'provider-plugin',
    ]) {
      assert.ok(html.includes(`data-card-id="${card}"`), `missing ${card} card`);
    }
    for (const tab of ['overview', 'anatomy', 'permissions']) {
      assert.ok(html.includes(`data-tab-id="${tab}"`), `missing ${tab} ability tab`);
      const tabMarkup = new RegExp(`<button[^>]*data-tab-id="${tab}"[^>]*>`).exec(html)?.[0];
      assert.ok(tabMarkup, `missing ${tab} tab control`);
      assert.match(tabMarkup, /role="tab"/);
      assert.match(tabMarkup, /aria-selected="(?:true|false)"/);
      assert.match(tabMarkup, /aria-controls="[^"]+"/);
      assert.match(tabMarkup, /tabindex="(?:0|-1)"/);
    }
    for (const stage of ['task', 'model', 'sandbox', 'checks', 'evidence']) {
      assert.ok(html.includes(`data-stage-id="${stage}"`), `missing ${stage} bench stage`);
      const stageMarkup = new RegExp(`<button[^>]*data-stage-id="${stage}"[^>]*>`).exec(html)?.[0];
      assert.ok(stageMarkup, `missing ${stage} stage control`);
      assert.match(stageMarkup, /aria-pressed="(?:true|false)"/);
      assert.match(stageMarkup, /aria-controls="[^"]+"/);
      assert.match(stageMarkup, /tabindex="(?:0|-1)"/);
    }

    const qrImages = html.match(/<img[^>]*data-map-qr[^>]*>/g) ?? [];
    assert.equal(qrImages.length, 7);
    assert.ok(qrImages.every((image) => /src="\/_astro\/[^"/]+\.[^"/]+\.svg"/.test(image)));
    const qrLinks = html.match(/<a[^>]*class="core-ai-map__qr-url"[^>]*>/g) ?? [];
    assert.equal(qrLinks.length, 7);
    assert.ok(qrLinks.every((link) => /href="https:\/\//.test(link)));

    assert.match(html, /aria-live="polite"/);
    assert.match(html, /data-map-panel="abilities"[^>]*\bhidden\b/);
    assert.match(html, /data-map-panel="provider-plugin"[^>]*\bhidden\b/);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
