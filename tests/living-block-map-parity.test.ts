import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PNG } from 'pngjs';
import { DIFF_RATIO_THRESHOLD, diffStatus, routesFor } from '../scripts/lib/report.ts';
import {
  VISUAL_STATES,
  assertSuccessfulNavigation,
  diffParityPngs,
  normalizeOrigin,
  parseParityArgs,
  parityStatus,
  withCaptureRetries,
} from '../scripts/lib/living-block-map-parity.ts';
import { main } from '../scripts/verify-living-block-map-parity.ts';

const validArgs = [
  '--reference',
  'https://wcus.hperkins.com/',
  '--candidate',
  'http://127.0.0.1:4326/',
  '--out',
  'artifacts/map-parity',
] as const;

const png = (width: number, height: number): Buffer =>
  PNG.sync.write(new PNG({ width, height, fill: true }));

test('parity CLI parses only the documented flags and normalizes origins', () => {
  assert.deepEqual(parseParityArgs(validArgs), {
    reference: 'https://wcus.hperkins.com',
    candidate: 'http://127.0.0.1:4326',
    out: 'artifacts/map-parity',
  });
  assert.deepEqual(parseParityArgs(['--', ...validArgs]), parseParityArgs(validArgs));
  assert.equal(normalizeOrigin('HTTPS://Example.COM:443/'), 'https://example.com');
  assert.throws(() => normalizeOrigin('file:///tmp/map'), /http or https/i);
  assert.throws(() => normalizeOrigin('https://example.com/map'), /origin without a path/i);
  assert.throws(() => parseParityArgs(['--reference', 'https://example.com']), /--candidate/);
  assert.throws(() => parseParityArgs([...validArgs, '--wat', 'nope']), /unknown option --wat/i);
  assert.throws(
    () => parseParityArgs([...validArgs, '--candidate', 'https://duplicate.example']),
    /duplicate option --candidate/i,
  );
  assert.throws(() => parseParityArgs(['reference', 'https://example.com', ...validArgs]), /flag/i);
});

test('parity registry contains exactly one of each approved VIS identifier', () => {
  assert.equal(VISUAL_STATES.length, 15);
  assert.deepEqual(
    VISUAL_STATES.map(({ id }) => id),
    Array.from({ length: 15 }, (_unused, index) => `VIS-${String(index + 1).padStart(2, '0')}`),
  );
  assert.equal(new Set(VISUAL_STATES.map(({ id }) => id)).size, 15);
});

test('the map parity threshold stays at 0.005 without weakening the report default', () => {
  assert.equal(DIFF_RATIO_THRESHOLD, 0.005);
  assert.equal(parityStatus(0.005), 'pass');
  assert.equal(parityStatus(0.005_000_1), 'fail');
  assert.equal(diffStatus({ diffRatio: 0.005 }, { threshold: DIFF_RATIO_THRESHOLD }), 'identical');
  assert.equal(
    diffStatus({ diffRatio: 0.005_000_1 }, { threshold: DIFF_RATIO_THRESHOLD }),
    'changed',
  );
  assert.equal(diffStatus({ diffRatio: 0.000_35 }), 'changed');
});

test('strict parity rejects screenshots with different dimensions', () => {
  assert.throws(() => diffParityPngs(png(2, 2), png(2, 3)), /dimension mismatch.*2 x 2.*2 x 3/i);
});

test('parity navigation rejects missing and non-2xx responses', () => {
  assert.doesNotThrow(() => assertSuccessfulNavigation('https://example.test/map', 200));
  assert.doesNotThrow(() => assertSuccessfulNavigation('https://example.test/map', 299));
  assert.throws(
    () => assertSuccessfulNavigation('https://example.test/map', 404),
    /404.*https:\/\/example\.test\/map/i,
  );
  assert.throws(
    () => assertSuccessfulNavigation('https://example.test/map', null),
    /did not return an HTTP response/i,
  );
});

test('capture errors produce a nonzero CLI result', async () => {
  const stderr: string[] = [];
  const exitCode = await main(validArgs, {
    run: async () => {
      throw new Error('forced capture failure');
    },
    stdout: () => {},
    stderr: (message) => stderr.push(message),
  });
  assert.equal(exitCode, 1);
  assert.match(stderr.join('\n'), /forced capture failure/);
});

test('transient captures retry once and preserve the final failure', async () => {
  let attempts = 0;
  const recovered = await withCaptureRetries(async () => {
    attempts += 1;
    if (attempts === 1) throw new Error('transient Playground boot');
    return 'captured';
  }, 2);
  assert.equal(recovered, 'captured');
  assert.equal(attempts, 2);

  attempts = 0;
  await assert.rejects(
    withCaptureRetries(async () => {
      attempts += 1;
      throw new Error(`failure ${attempts}`);
    }, 2),
    /failure 2/,
  );
  assert.equal(attempts, 2);
});

test('the general visual report still excludes the dedicated map route', () => {
  assert.equal(
    routesFor(['ai-plugin']).some(({ path }) => path === '/living-block-map/'),
    false,
  );
});
