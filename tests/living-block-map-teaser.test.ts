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

test('home build renders the Living Block Map teaser as an internal handoff', async () => {
  const outDir = await mkdtemp(join(tmpdir(), 'wcus-living-map-'));

  try {
    await withAstroBuildLock(() =>
      execFileSync(process.execPath, [astro, 'build', '--outDir', outDir], {
        cwd: root,
        stdio: 'pipe',
        env: { ...process.env },
      }),
    );

    const html = await readFile(join(outDir, 'index.html'), 'utf8');
    const projectGridIndex = html.indexOf('class="project-grid"');
    const teaserIndex = html.indexOf('class="living-map-teaser"');
    const whoIndex = html.indexOf('class="who"');

    assert.ok(projectGridIndex >= 0, 'project grid must be present');
    assert.ok(teaserIndex > projectGridIndex, 'teaser must follow the project grid');
    assert.ok(whoIndex > teaserIndex, 'teaser must remain inside Projects and precede Who We Are');

    const teaser = /<section class="living-map-teaser"[\s\S]*?<\/section>/.exec(html)?.[0];
    assert.ok(teaser, 'teaser section must be rendered');
    const teaserText = teaser
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    assert.match(teaser, /<h3[^>]*>See how WordPress and AI connect<\/h3>/);
    assert.ok(
      teaserText.includes(
        'Choose from four interactive flows. Follow the numbered path, then tap a highlighted component to understand the role it plays.',
      ),
      'teaser must explain how to use the interactive map',
    );

    const link = /<a class="living-map-teaser__link"[\s\S]*?<\/a>/.exec(teaser)?.[0];
    assert.ok(link, 'teaser must use a real navigation link');
    assert.match(link, /href="\/living-block-map\/"/);
    assert.ok(!/\starget=/.test(link), 'internal handoff must stay in the same tab');
    assert.ok(!/\srel=/.test(link), 'internal handoff does not need an external-link rel');
    assert.match(link, /data-track-event="click_internal"/);
    assert.match(link, /data-track-project="site"/);
    assert.match(link, /data-track-target="living-block-map"/);
    assert.ok(!link.includes('aria-describedby='));
    assert.ok(link.includes('Explore the Living Block Map'));
    assert.ok(!link.includes('opens in a new tab'));
    assert.ok(!teaser.includes('living-map-disclosure'));
    assert.ok(!/Playground|WordPress 7\.0 site|first load can take|new tab/i.test(teaserText));

    const image = /<img[^>]*living-block-map-preview\.webp[^>]*>/.exec(teaser)?.[0];
    assert.ok(image, 'teaser must render the static preview poster');
    assert.match(image, /width="1366"/);
    assert.match(image, /height="1024"/);
    assert.match(image, /loading="lazy"/);
    assert.match(image, /decoding="async"/);
    assert.match(
      image,
      /alt="Simplified Living Block Map path from AI Plugin through AI Client and a provider layer to an external AI service\."/,
    );

    assert.ok(!teaser.includes('<iframe'), 'the full-screen kiosk must not be embedded');
    assert.ok(!html.includes('wcus.hperkins.com'), 'the retired kiosk hostname must not ship');

    const poster = await readFile(join(outDir, 'images', 'living-block-map-preview.webp'));
    assert.equal(poster.subarray(0, 4).toString('ascii'), 'RIFF');
    assert.equal(poster.subarray(8, 12).toString('ascii'), 'WEBP');
    assert.ok(poster.byteLength <= 150 * 1024, 'poster must remain at or below 150 KB');
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
