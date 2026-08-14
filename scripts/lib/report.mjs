/**
 * Pure helpers for the PR preview visual regression report.
 *
 * The Playwright driver (scripts/visual-report.mjs) captures screenshots and
 * computes diffs; everything string- or pixel-shaped that needs to be
 * deterministic and testable lives here.
 */

import { PNG } from 'pngjs';

const DEFAULT_THRESHOLD = 0.001; // 0.1% of pixels — below this a page counts as identical

/** Classify a page result against the diff threshold. */
export function diffStatus(result, { threshold = DEFAULT_THRESHOLD } = {}) {
  return result.diffRatio > threshold ? 'changed' : 'identical';
}

/**
 * Return both PNGs at the taller height. The shorter one is padded at the
 * bottom with opaque white so a page that grew or shrinks still produces
 * comparable, pixelmatch-sized images. When heights already match the inputs
 * are returned unchanged.
 */
export function normalizeHeights(a, b) {
  if (a.height === b.height) return [a, b];
  const height = Math.max(a.height, b.height);
  return [padTo(a, height), padTo(b, height)];
}

function padTo(png, height) {
  if (png.height === height) return png;
  const out = new PNG({ width: png.width, height });
  // Start from white so the padding rows read as blank paper, not black.
  out.data.fill(255, 0, out.data.length);
  PNG.bitblt(png, out, 0, 0, png.width, png.height, 0, 0);
  return out;
}

function pct(ratio) {
  return `${(ratio * 100).toFixed(2)}%`;
}

function slugToName(slug) {
  return slug
    .split('-')
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');
}

/** Route list for the visual report: home, every project page, privacy. */
export function routesFor(projectSlugs) {
  return [
    { name: 'Home', path: '/' },
    ...[...projectSlugs]
      .toSorted()
      .map((slug) => ({ name: slugToName(slug), path: `/p/${slug}/` })),
    { name: 'Privacy', path: '/privacy/' },
  ];
}

/**
 * PR comment body. Contains a hidden marker so the publisher can find and
 * update the one existing comment instead of posting a new one per run.
 */
export function generateComment({ results, sha, previewUrl, reportUrl, runUrl, baseUrl }) {
  const rows = results
    .map((r) => {
      const status = diffStatus(r);
      const badge = status === 'changed' ? '🔴' : '✅';
      return `| ${r.name} | \`${r.path}\` | ${pct(r.diffRatio)} ${badge} |`;
    })
    .join('\n');

  const changed = results.filter((r) => diffStatus(r) === 'changed');

  const sections = changed.map((r) => {
    const img = (kind) => `![${r.name} ${kind}](${baseUrl}/${r.dir}/${kind}.png)`;
    return [
      `### 📸 ${r.name} — ${pct(r.diffRatio)} of pixels changed`,
      '',
      '| Before (production) | After (this PR) | Diff |',
      '| --- | --- | --- |',
      `| ${img('before')} | ${img('after')} | ${img('diff')} |`,
      '',
    ].join('\n');
  });

  return `<!-- pr-preview-report -->
## 🔎 PR Preview & Visual Regression

**Preview site:** ${previewUrl}
**Full visual report:** ${reportUrl}
**Tracking is disabled on the preview** — clicks there never reach Analytics Engine.

| Page | Path | Diff |
| --- | --- | --- |
${rows}

${changed.length > 0 ? sections.join('\n') : '### ✅ No visual differences detected\n'}

Built from \`${sha}\` · [workflow run](${runUrl}) · This comment updates automatically on every push.
`;
}

/** Standalone HTML report page served next to the preview. */
export function generateHtml({ results, previewUrl, runUrl, baseUrl }) {
  const cards = results
    .map((r) => {
      const status = diffStatus(r);
      const color = status === 'changed' ? '#b3261e' : '#1b7f3b';
      const img = (kind) =>
        `<img src="${baseUrl}/${r.dir}/${kind}.png" alt="${r.name} ${kind}" loading="lazy">`;
      return `<section class="page">
  <h2>${r.name} <code>${r.path}</code> <span class="badge" style="color:${color}">${pct(r.diffRatio)} · ${status}</span></h2>
  <div class="triptych">${img('before')}${img('after')}${img('diff')}</div>
</section>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Visual regression report</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 0 auto; max-width: 1400px; padding: 1rem; }
  h1 a { color: #4a1a3c; }
  .triptych { display: grid; grid-template-columns: repeat(3, 1fr); gap: .5rem; align-items: start; }
  .triptych img { width: 100%; height: auto; border: 1px solid #ccc; }
  .badge { font-size: .8em; border: 1px solid currentColor; border-radius: 1em; padding: .1em .6em; }
  code { background: #f4f4f4; padding: 0 .3em; border-radius: 3px; }
</style>
</head>
<body>
<h1>Visual regression report</h1>
<p><a href="${previewUrl}">Open the preview site</a> · <a href="${runUrl}">Workflow run</a> · Tracking disabled on preview.</p>
${cards}
</body>
</html>
`;
}
