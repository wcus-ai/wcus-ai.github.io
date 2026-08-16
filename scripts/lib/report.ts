/**
 * Report and comment generation for the visual regression pipeline.
 */

import { PNG } from 'pngjs';

// Cutoff between identical and changed: measured noise is 0 px, and the
// smallest real change so far (a one-word heading edit) diffs at 0.035%.
const DEFAULT_THRESHOLD = 0.0002;

export type ViewportName = 'mobile' | 'desktop';

export interface ViewportDiff {
  name: ViewportName;
  diffRatio: number;
  diffPixels: number;
  width: number;
  height: number;
  error?: string;
}

export interface PageResult {
  name: string;
  path: string;
  urlPath: string;
  dir: string;
  /** Worst viewport ratio; drives the page-level changed/identical badge. */
  diffRatio: number;
  diffPixels: number;
  viewports: ViewportDiff[];
  error?: string;
}

export interface ReportContext {
  results: PageResult[];
  sha: string;
  previewUrl: string;
  reportUrl: string;
  runUrl: string;
  baseUrl: string;
}

/** Classify a page result against the diff threshold. */
export function diffStatus(
  result: Pick<PageResult, 'diffRatio'>,
  { threshold = DEFAULT_THRESHOLD }: { threshold?: number } = {},
): 'changed' | 'identical' {
  return result.diffRatio > threshold ? 'changed' : 'identical';
}

/**
 * Return both PNGs at the taller height. The shorter one is padded at the
 * bottom with opaque white so a page that grew or shrinks still produces
 * comparable, pixelmatch-sized images. When heights already match the inputs
 * are returned unchanged.
 */
export function normalizeHeights(a: PNG, b: PNG): [PNG, PNG] {
  if (a.height === b.height) return [a, b];
  const height = Math.max(a.height, b.height);
  return [padTo(a, height), padTo(b, height)];
}

function padTo(png: PNG, height: number): PNG {
  if (png.height === height) return png;
  const out = new PNG({ width: png.width, height });
  // Start from white so the padding rows read as blank paper, not black.
  out.data.fill(255, 0, out.data.length);
  PNG.bitblt(png, out, 0, 0, png.width, png.height, 0, 0);
  return out;
}

function pct(ratio: number): string {
  return `${(ratio * 100).toFixed(2)}%`;
}

function slugToName(slug: string): string {
  return slug
    .split('-')
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');
}

export interface Route {
  name: string;
  path: string;
}

/** Route list for the visual report: home, every project page, privacy. */
export function routesFor(projectSlugs: Iterable<string>): Route[] {
  return [
    { name: 'Home', path: '/' },
    ...[...projectSlugs]
      .toSorted()
      .map((slug) => ({ name: slugToName(slug), path: `/p/${slug}/` })),
    { name: 'Privacy', path: '/privacy/' },
  ];
}

const VIEWPORT_LABELS: Record<ViewportName, string> = {
  mobile: '📱 Mobile',
  desktop: '🖥️ Desktop',
};

/** Per-viewport cell for the comment table; blank when that viewport failed. */
function viewportCell(result: PageResult, name: ViewportName): string {
  const vp = result.viewports.find((v) => v.name === name);
  if (!vp) return '—';
  if (vp.error) return '⚠️ capture failed';
  return `${pct(vp.diffRatio)} ${diffStatus(vp) === 'changed' ? '🔴' : '✅'}`;
}

/**
 * PR comment body.
 */
export function generateComment({
  results,
  sha,
  previewUrl,
  reportUrl,
  runUrl,
  baseUrl,
}: ReportContext): string {
  const rows = results
    .map(
      (r) =>
        `| ${r.name} | \`${r.path}\` | ${viewportCell(r, 'mobile')} | ${viewportCell(r, 'desktop')} |`,
    )
    .join('\n');

  const changed = results.filter((r) => diffStatus(r) === 'changed');

  const sections = changed.map((r) => {
    const blocks = r.viewports
      .map((vp) => {
        const img = (kind: string) =>
          `![${r.name} ${vp.name} ${kind}](${baseUrl}/${r.dir}/${vp.name}/${kind}.png)`;
        return [
          `**${VIEWPORT_LABELS[vp.name]} — ${pct(vp.diffRatio)}**`,
          '',
          '| Before (production) | After (this PR) | Diff |',
          '| --- | --- | --- |',
          `| ${img('before')} | ${img('after')} | ${img('diff')} |`,
          '',
        ].join('\n');
      })
      .join('\n');
    return [`### 📸 ${r.name} — ${pct(r.diffRatio)} of pixels changed`, '', blocks, ''].join('\n');
  });

  return `<!-- pr-preview-report -->
## 🔎 PR Preview & Visual Regression

**Preview site:** ${previewUrl}
**Full visual report:** ${reportUrl}
**Tracking is disabled on the preview** — clicks there never reach Analytics Engine.

| Page | Path | Mobile | Desktop |
| --- | --- | --- | --- |
${rows}

${changed.length > 0 ? sections.join('\n') : '### ✅ No visual differences detected\n'}

Built from \`${sha}\` · [workflow run](${runUrl}) · This comment updates automatically on every push.
`;
}

/** Standalone HTML report page served next to the preview. */
export function generateHtml({ results, previewUrl, runUrl, baseUrl }: ReportContext): string {
  const cards = results
    .map((r) => {
      const blocks = r.viewports
        .map((vp) => {
          const status = diffStatus(vp);
          const color = status === 'changed' ? '#b3261e' : '#1b7f3b';
          const img = (kind: string) =>
            `<img src="${baseUrl}/${r.dir}/${vp.name}/${kind}.png" alt="${r.name} ${vp.name} ${kind}" loading="lazy">`;
          return `<div class="viewport">
  <h3>${VIEWPORT_LABELS[vp.name]} <span class="badge" style="color:${color}">${pct(vp.diffRatio)} · ${status}</span></h3>
  <div class="triptych">${img('before')}${img('after')}${img('diff')}</div>
</div>`;
        })
        .join('\n');
      return `<section class="page">
  <h2>${r.name} <code>${r.path}</code></h2>
${blocks}
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
  h3 { margin-bottom: .3rem; }
  .viewport { margin-bottom: 1.2rem; }
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
