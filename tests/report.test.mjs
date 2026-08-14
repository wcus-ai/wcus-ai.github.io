import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { test } from 'node:test';
import {
  generateComment,
  generateHtml,
  normalizeHeights,
  diffStatus,
} from '../scripts/lib/report.mjs';

const results = [
  {
    name: 'Home',
    path: '/',
    urlPath: '/',
    dir: 'home',
    diffRatio: 0,
    diffPixels: 0,
    width: 780,
    height: 1688,
  },
  {
    name: 'Abilities API',
    path: '/p/abilities-api/',
    urlPath: 'p/abilities-api',
    dir: 'p-abilities-api',
    diffRatio: 0.0231,
    diffPixels: 30123,
    width: 780,
    height: 2201,
  },
];

const commentContext = {
  results,
  prNumber: 99,
  sha: 'abc1234',
  previewUrl: 'https://wcus-ai.github.io/pr-preview/pr-99/',
  reportUrl: 'https://wcus-ai.github.io/pr-preview/pr-99/report/',
  runUrl: 'https://github.com/wcus-ai/wcus-ai.github.io/actions/runs/123',
  baseUrl: 'https://wcus-ai.github.io/pr-preview/pr-99/report',
};

test('generateComment: carries the stable marker so upsert can find it', () => {
  const comment = generateComment(commentContext);
  assert.ok(comment.includes('<!-- pr-preview-report -->'));
});

test('generateComment: links the preview site and the full report', () => {
  const comment = generateComment(commentContext);
  assert.ok(comment.includes('https://wcus-ai.github.io/pr-preview/pr-99/'));
  assert.ok(comment.includes('https://wcus-ai.github.io/pr-preview/pr-99/report/'));
});

test('generateComment: notes that tracking is disabled on the preview', () => {
  const comment = generateComment(commentContext);
  assert.ok(/tracking (is )?disabled/i.test(comment));
});

test('generateComment: summarizes every page with a diff ratio', () => {
  const comment = generateComment(commentContext);
  assert.ok(comment.includes('Home'));
  assert.ok(comment.includes('Abilities API'));
  assert.ok(comment.includes('0.00%'));
  assert.ok(comment.includes('2.31%'));
});

test('generateComment: embeds before/after/diff images for changed pages only', () => {
  const comment = generateComment(commentContext);
  assert.ok(comment.includes('p-abilities-api/before.png'));
  assert.ok(comment.includes('p-abilities-api/after.png'));
  assert.ok(comment.includes('p-abilities-api/diff.png'));
  assert.ok(!comment.includes('home/before.png'), 'identical pages must not embed images');
});

test('generateComment: identifies the commit the preview was built from', () => {
  const comment = generateComment(commentContext);
  assert.ok(comment.includes('abc1234'));
});

test('generateHtml: renders before/after/diff for every page', () => {
  const html = generateHtml(commentContext);
  assert.ok(html.includes('home/before.png'));
  assert.ok(html.includes('home/after.png'));
  assert.ok(html.includes('home/diff.png'));
  assert.ok(html.includes('p-abilities-api/diff.png'));
  assert.ok(html.includes('2.31%'));
});

test('diffStatus: classifies pages against the threshold', () => {
  assert.equal(diffStatus({ diffRatio: 0 }, { threshold: 0.001 }), 'identical');
  assert.equal(diffStatus({ diffRatio: 0.0005 }, { threshold: 0.001 }), 'identical');
  assert.equal(diffStatus({ diffRatio: 0.0231 }, { threshold: 0.001 }), 'changed');
});

test('normalizeHeights: pads the shorter PNG with white to match heights', () => {
  const short = new PNG({ width: 4, height: 2 });
  const tall = new PNG({ width: 4, height: 4 });
  short.data.fill(255, 0, short.data.length);
  tall.data.fill(0, 0, tall.data.length);
  const [a, b] = normalizeHeights(short, tall);
  assert.equal(a.height, 4);
  assert.equal(b.height, 4);
  // padding rows in `a` must be white (255,255,255,255)
  const padStart = a.width * 2 * 4;
  assert.equal(a.data[padStart], 255);
  assert.equal(a.data[padStart + 1], 255);
  assert.equal(a.data[padStart + 3], 255);
  // original content preserved
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
