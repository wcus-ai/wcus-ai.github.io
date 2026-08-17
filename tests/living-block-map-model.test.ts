import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const modelPath = join(root, 'src', 'components', 'living-block-map', 'model.ts');
const fixturePath = join(root, 'tests', 'fixtures', 'living-block-map-effective-render.json');
const qrManifestPath = join(root, 'src', 'assets', 'living-block-map', 'qr', 'manifest.json');

async function loadModel() {
  assert.ok(existsSync(modelPath), 'typed MAP_MODEL must exist');
  return (await import(`${pathToFileURL(modelPath).href}?test=${Date.now()}`)).MAP_MODEL;
}

test('typed model is identical to the checked effective-render fixture', async () => {
  const model = await loadModel();
  const fixture = JSON.parse(await readFile(fixturePath, 'utf8'));

  assert.deepEqual(model.content, fixture.content);
  assert.deepEqual(model.layouts, fixture.layouts);
  assert.deepEqual(model.previews, fixture.previews);
  assert.deepEqual(model.neutral, fixture.neutral);
  assert.deepEqual(model.loose, fixture.loose);
  assert.deepEqual(model.shelfX, fixture.shelfX);
  assert.deepEqual(model.about, fixture.about);
  assert.deepEqual(model.bench, fixture.bench);
});

test('model references only stable, existing IDs', async () => {
  const model = await loadModel();
  const flowIds = new Set(model.content.flows.map(({ id }: { id: string }) => id));
  const cardIds = new Set([
    ...model.content.blocks.map(({ id }: { id: string }) => id),
    ...model.content.actors.map(({ id }: { id: string }) => id),
    'provider-plugin',
  ]);
  const panelIds = new Set(model.content.panels.map(({ id }: { id: string }) => id));

  assert.deepEqual([...flowIds], ['uses-ai', 'uses-wp', 'learns', 'tests']);
  assert.equal(cardIds.size, 12);
  assert.deepEqual(panelIds, cardIds);

  for (const [flowId, layout] of Object.entries(model.layouts) as Array<
    [
      string,
      {
        members: Record<string, number>;
        place: Record<string, [number, number]>;
        park?: string[];
        sidecars?: string[];
        noStrip?: string[];
      },
    ]
  >) {
    assert.ok(flowIds.has(flowId), `layout ${flowId} must reference an existing flow`);
    for (const id of [
      ...Object.keys(layout.members),
      ...Object.keys(layout.place),
      ...(layout.park ?? []),
      ...(layout.sidecars ?? []),
      ...(layout.noStrip ?? []),
    ]) {
      assert.ok(cardIds.has(id), `${flowId} must not reference missing card ${id}`);
    }
  }

  for (const panel of model.content.panels as Array<{
    id: string;
    roles?: Record<string, unknown>;
  }>) {
    for (const flowId of Object.keys(panel.roles ?? {})) {
      assert.ok(flowIds.has(flowId), `${panel.id} role must reference existing flow ${flowId}`);
    }
  }

  for (const preview of model.previews as Array<{
    storyId: string;
    ids: string[];
    sidecars?: string[];
  }>) {
    assert.ok(flowIds.has(preview.storyId));
    for (const id of [...preview.ids, ...(preview.sidecars ?? [])]) assert.ok(cardIds.has(id));
  }
});

test('model owns the Abilities tabs, WP-Bench stages, and canonical QR destinations', async () => {
  const model = await loadModel();
  const qrManifest = JSON.parse(await readFile(qrManifestPath, 'utf8'));

  assert.deepEqual(
    model.abilityTabs.map(({ id }: { id: string }) => id),
    ['overview', 'anatomy', 'permissions'],
  );
  assert.deepEqual(Object.keys(model.bench.stages), [
    'task',
    'model',
    'sandbox',
    'checks',
    'evidence',
  ]);

  for (const panel of model.content.panels as Array<{
    id: string;
    href?: string;
    qr?: string;
  }>) {
    if (!panel.qr) continue;
    const qrId = panel.qr.replace(/^qr\//, '').replace(/\.svg$/, '');
    assert.equal(panel.href, qrManifest[qrId], `${panel.id} QR must resolve to its canonical href`);
  }
});
