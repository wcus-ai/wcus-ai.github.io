import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { test } from 'node:test';
import {
  generateComment,
  generateHtml,
  normalizeHeights,
  diffStatus,
  type PageResult,
  type ReportContext,
} from '../scripts/lib/report.ts';

function page(partial: Partial<PageResult>): PageResult {
  return {
    name: 'Home',
    path: '/',
    urlPath: '/',
    dir: 'home',
    diffRatio: 0,
    diffPixels: 0,
    viewports: [],
    ...partial,
  };
}

const results: PageResult[] = [
  page({
    name: 'Home',
    dir: 'home',
    viewports: [
      { name: 'mobile', diffRatio: 0, diffPixels: 0, width: 390, height: 3523 },
      { name: 'desktop', diffRatio: 0, diffPixels: 0, width: 1440, height: 2000 },
    ],
  }),
  page({
    name: 'Privacy',
    path: '/privacy/',
    dir: 'privacy',
    diffRatio: 0.0011,
    diffPixels: 1464,
    viewports: [
      { name: 'mobile', diffRatio: 0.0011, diffPixels: 1464, width: 390, height: 3389 },
      { name: 'desktop', diffRatio: 0.0004, diffPixels: 1150, width: 1440, height: 2000 },
    ],
  }),
];

const commentContext: ReportContext = {
  results,
  sha: 'abc1234',
  previewUrl: 'https://wcus-ai.github.io/pr-preview/pr-99/',
  reportUrl: 'https://wcus-ai.github.io/pr-preview/pr-99/report/',
  runUrl: 'https://github.com/wcus-ai/wcus-ai.github.io/actions/runs/123',
  baseUrl: 'https://wcus-ai.github.io/pr-preview/pr-99/report',
};

test('diffStatus default threshold: catches a single-heading-size change on any viewport', () => {
  assert.equal(diffStatus({ diffRatio: 0.00111 }), 'changed', 'mobile-scale change must flag');
  assert.equal(diffStatus({ diffRatio: 0.00035 }), 'changed', 'desktop-scale change must flag');
  assert.equal(diffStatus({ diffRatio: 0 }), 'identical', 'no diff is identical');
  assert.equal(diffStatus({ diffRatio: 0.0002 }), 'identical');
});

test('generateComment: carries the stable marker so upsert can find it', () => {
  assert.ok(generateComment(commentContext).includes('<!-- pr-preview-report -->'));
});

test('generateComment: links the preview site and the full report', () => {
  const comment = generateComment(commentContext);
  assert.ok(comment.includes('https://wcus-ai.github.io/pr-preview/pr-99/'));
  assert.ok(comment.includes('https://wcus-ai.github.io/pr-preview/pr-99/report/'));
});

test('generateComment: notes that tracking is disabled on the preview', () => {
  assert.ok(/tracking (is )?disabled/i.test(generateComment(commentContext)));
});

test('generateComment: table shows a per-viewport column for mobile and desktop', () => {
  const comment = generateComment(commentContext);
  assert.ok(comment.includes('| Page | Path | Mobile | Desktop |'));
  assert.ok(comment.includes('0.11%'));
  assert.ok(comment.includes('0.04%'));
});

test('generateComment: embeds before/after/diff per viewport for changed pages only', () => {
  const comment = generateComment(commentContext);
  for (const vp of ['mobile', 'desktop']) {
    assert.ok(comment.includes(`privacy/${vp}/before.png`), `${vp} before image`);
    assert.ok(comment.includes(`privacy/${vp}/after.png`), `${vp} after image`);
    assert.ok(comment.includes(`privacy/${vp}/diff.png`), `${vp} diff image`);
  }
  assert.ok(!comment.includes('home/mobile/before.png'), 'identical pages must not embed images');
});

test('generateComment: identifies the commit the preview was built from', () => {
  assert.ok(generateComment(commentContext).includes('abc1234'));
});

test('generateHtml: renders both viewports for every page', () => {
  const html = generateHtml(commentContext);
  for (const dir of ['home', 'privacy']) {
    for (const vp of ['mobile', 'desktop']) {
      assert.ok(html.includes(`${dir}/${vp}/before.png`), `${dir}/${vp} before`);
      assert.ok(html.includes(`${dir}/${vp}/diff.png`), `${dir}/${vp} diff`);
    }
  }
  assert.ok(html.includes('0.11%'));
  assert.ok(/desktop/i.test(html));
});

test('normalizeHeights: pads the shorter PNG with white to match heights', () => {
  const short = new PNG({ width: 4, height: 2 });
  const tall = new PNG({ width: 4, height: 4 });
  short.data.fill(255, 0, short.data.length);
  tall.data.fill(0, 0, tall.data.length);
  const [a, b] = normalizeHeights(short, tall);
  assert.equal(a.height, 4);
  assert.equal(b.height, 4);
  const padStart = a.width * 2 * 4;
  assert.equal(a.data[padStart], 255);
  assert.equal(a.data[padStart + 1], 255);
  assert.equal(a.data[padStart + 3], 255);
  assert.equal(a.data[0], 255);
  assert.equal(b.data[0], 0);
});

test('normalizeHeights: returns inputs unchanged when heights match', () => {
  const x = new PNG({ width: 2, height: 2 });
  const y = new PNG({ width: 2, height: 2 });
  const [a, b] = normalizeHeights(x, y);
  assert.equal(a, x);
  assert.equal(b, y);
});
