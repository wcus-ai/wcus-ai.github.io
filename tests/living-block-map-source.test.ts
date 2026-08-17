import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

interface SourceAsset {
  source: string;
  destination: string;
  sha256: string;
}

interface SourceAssetManifest {
  sourceCommit: string;
  compiledCssSha256: string;
  files: SourceAsset[];
}

const root = fileURLToPath(new URL('../', import.meta.url));
const fixturePath = join(root, 'tests', 'fixtures', 'living-block-map-effective-render.json');
const manifestPath = join(root, 'tests', 'fixtures', 'living-block-map-source-assets.json');

const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

test('source fixture freezes the effective public render with offline disabled', async () => {
  assert.ok(existsSync(fixturePath), 'effective-render fixture must be captured before migration');

  const fixture = JSON.parse(await readFile(fixturePath, 'utf8'));
  assert.equal(fixture.sourceVersion, '3.2.3');
  assert.deepEqual(fixture.runtimeOverrides, { offlineEnabled: false });
  assert.equal(fixture.content.title, 'What is WordPress Core AI?');
  assert.equal(fixture.content.reviewedDate, 'Reviewed 14 Aug 2026');
  assert.deepEqual(
    fixture.content.flows.map(({ id }: { id: string }) => id),
    ['uses-ai', 'uses-wp', 'learns', 'tests'],
  );
});

test('source asset manifest protects every immutable copied artifact', async () => {
  assert.ok(existsSync(manifestPath), 'source asset manifest must be captured before migration');

  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as SourceAssetManifest;
  assert.match(manifest.sourceCommit, /^[0-9a-f]{40}$/);
  assert.match(manifest.compiledCssSha256, /^[0-9a-f]{64}$/);

  const destinations = manifest.files.map(({ destination }) => destination).toSorted();
  assert.equal(destinations.filter((path) => path.endsWith('.woff2')).length, 6);
  assert.equal(destinations.filter((path) => path.endsWith('.txt')).length, 3);
  assert.equal(destinations.filter((path) => /\/qr\/[^/]+\.svg$/.test(path)).length, 7);
  assert.ok(destinations.some((path) => path.endsWith('/qr/manifest.json')));
  assert.ok(destinations.some((path) => path.endsWith('/icon.svg')));
  assert.ok(
    existsSync(join(root, 'src', 'components', 'living-block-map', 'living-block-map.css')),
    'compiled release CSS must be promoted before migration',
  );

  for (const asset of manifest.files) {
    const bytes = await readFile(join(root, asset.destination));
    assert.equal(sha256(bytes), asset.sha256, `${asset.destination} must match its source hash`);
  }
});
