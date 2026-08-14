import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const astro = join(root, 'node_modules', 'astro', 'bin', 'astro.mjs');

test('home build renders the Living Block Map teaser as a lightweight external handoff', async () => {
  const outDir = await mkdtemp(join(tmpdir(), 'wcus-living-map-'));

  try {
    execFileSync(process.execPath, [astro, 'build', '--outDir', outDir], {
      cwd: root,
      stdio: 'pipe',
      env: { ...process.env },
    });

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
    assert.match(teaser, /<h3[^>]*>See how it all fits together<\/h3>/);
    assert.ok(
      teaserText.includes(
        'Follow four guided flows across the Core AI projects and the supporting building blocks around them.',
      ),
      'teaser must explain the map without claiming a one-to-one project taxonomy',
    );

    const link = /<a class="living-map-teaser__link"[\s\S]*?<\/a>/.exec(teaser)?.[0];
    assert.ok(link, 'teaser must use a real navigation link');
    assert.match(link, /href="https:\/\/wcus\.hperkins\.com\/"/);
    assert.match(link, /target="_blank"/);
    assert.match(link, /rel="noopener noreferrer"/);
    assert.match(link, /data-track-event="click_outbound"/);
    assert.match(link, /data-track-project="site"/);
    assert.match(link, /data-track-target="living-block-map"/);
    assert.match(link, /aria-describedby="living-map-disclosure"/);
    assert.ok(link.includes('Launch the Living Block Map'));
    assert.ok(link.includes('opens in a new tab'));

    assert.ok(
      teaserText.includes(
        'Runs a real WordPress 7.0 site in your browser. The first load can take a minute or more. Best viewed in landscape.',
      ),
      'teaser must disclose the runtime and expected first-load cost',
    );
    assert.match(teaser, /id="living-map-disclosure"/);

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
    assert.equal(
      html.match(/https:\/\/wcus\.hperkins\.com\//g)?.length,
      1,
      'the kiosk URL must only appear on the explicit launch link, not in preload or prefetch markup',
    );

    const poster = await readFile(join(outDir, 'images', 'living-block-map-preview.webp'));
    assert.equal(poster.subarray(0, 4).toString('ascii'), 'RIFF');
    assert.equal(poster.subarray(8, 12).toString('ascii'), 'WEBP');
    assert.ok(poster.byteLength <= 150 * 1024, 'poster must remain at or below 150 KB');
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
