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
    }
    for (const stage of ['task', 'model', 'sandbox', 'checks', 'evidence']) {
      assert.ok(html.includes(`data-stage-id="${stage}"`), `missing ${stage} bench stage`);
    }

    const qrImages = html.match(/<img[^>]*data-map-qr[^>]*>/g) ?? [];
    assert.equal(qrImages.length, 7);
    assert.ok(qrImages.every((image) => /src="\/_astro\/[^"/]+\.[^"/]+\.svg"/.test(image)));

    assert.match(html, /aria-live="polite"/);
    assert.match(html, /data-map-panel="abilities"[^>]*\bhidden\b/);
    assert.match(html, /data-map-panel="provider-plugin"[^>]*\bhidden\b/);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
