/* oxlint-disable no-await-in-loop -- Digest checks report the first mismatched file by name. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

interface VendoredFile {
  readonly path: string;
  readonly sha256: string;
}

interface VendorManifest {
  readonly sourceCommit: string;
  readonly sourceCommitted: boolean;
  readonly sourceVersion: string;
  readonly compiledCssSha256: string;
  readonly files: VendoredFile[];
}

const root = fileURLToPath(new URL('../', import.meta.url));
const vendorDirectory = join(root, 'public', 'living-block-map');
const manifestPath = join(vendorDirectory, 'manifest.json');

const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

const readManifest = async (): Promise<VendorManifest> =>
  JSON.parse(await readFile(manifestPath, 'utf8')) as VendorManifest;

test('the vendored kiosk records where it came from', async () => {
  assert.ok(existsSync(manifestPath), 'run scripts/vendor-living-block-map.ts to produce the page');

  const manifest = await readManifest();
  assert.match(manifest.sourceCommit, /^[0-9a-f]{40}$/);
  assert.match(manifest.sourceVersion, /^\d+\.\d+\.\d+$/);
  assert.match(manifest.compiledCssSha256, /^[0-9a-f]{64}$/);
  assert.equal(typeof manifest.sourceCommitted, 'boolean');
});

test('every vendored file matches the digest recorded for it', async () => {
  const manifest = await readManifest();
  assert.ok(manifest.files.length > 0, 'manifest lists no files');

  for (const file of manifest.files) {
    const absolutePath = join(vendorDirectory, file.path);
    assert.ok(existsSync(absolutePath), `${file.path} is listed but missing`);
    assert.equal(
      sha256(await readFile(absolutePath)),
      file.sha256,
      `${file.path} was edited by hand; re-run the vendor script instead`,
    );
  }
});

test('the page fetches nothing beyond its own directory', async () => {
  const page = await readFile(join(vendorDirectory, 'index.html'), 'utf8');

  // Anchors in the exhibit point at canonical WordPress documentation on
  // purpose; what must stay local is everything the page *fetches*.
  const fetched = [
    ...[...page.matchAll(/<(?:img|script)\b[^>]*\bsrc="([^"]+)"/g)].map((match) => match[1]),
    ...[...page.matchAll(/<link\b[^>]*\brel="(?!canonical)[^"]*"[^>]*\bhref="([^"]+)"/g)].map(
      (match) => match[1],
    ),
  ];

  assert.ok(fetched.length > 0, 'expected the page to reference its fonts and QR codes');
  for (const reference of fetched) {
    assert.ok(
      !/^(?:https?:)?\/\//.test(reference),
      `the kiosk must not fetch off-origin, found ${reference}`,
    );
    assert.ok(
      !reference.startsWith('/'),
      `use a relative path so any deployment base works, found ${reference}`,
    );
  }

  assert.ok(!page.includes('ASSET:'), 'an unresolved plugin asset URL survived vendoring');
});

test('the page declares its production canonical', async () => {
  const page = await readFile(join(vendorDirectory, 'index.html'), 'utf8');

  assert.ok(
    page.includes('<link rel="canonical" href="https://wcus-ai.github.io/living-block-map/" />'),
    'canonical must point at production, never at a preview base',
  );
});

test('the page carries the exhibit and its four flows', async () => {
  const page = await readFile(join(vendorDirectory, 'index.html'), 'utf8');

  assert.ok(page.includes('data-wp-interactive'), 'the Interactivity region is missing');
  for (const flow of ['uses-ai', 'uses-wp', 'learns', 'tests']) {
    assert.ok(page.includes(flow), `flow ${flow} is missing from the served markup`);
  }
});

test('QR codes stay standalone scan targets rather than inline payloads', async () => {
  const manifest = await readManifest();
  const codes = manifest.files.filter((file) => file.path.startsWith('qr/'));

  assert.equal(codes.length, 8, 'expected the eight canonical QR destinations');

  const page = await readFile(join(vendorDirectory, 'index.html'), 'utf8');
  assert.ok(!page.includes('data:image/svg+xml'), 'QR codes must not be inlined as data URIs');
});
