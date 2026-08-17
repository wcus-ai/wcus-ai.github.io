import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { withAstroBuildLock } from './helpers/astro-build-lock.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const astro = join(root, 'node_modules', 'astro', 'bin', 'astro.mjs');
const controllerPath = join(root, 'src', 'components', 'living-block-map', 'controller.ts');

test('controller exposes one delegated action surface and an idempotent disposer', async () => {
  assert.ok(existsSync(controllerPath), 'native controller module must exist');
  const source = await readFile(controllerPath, 'utf8');
  const controller = await import(
    `${pathToFileURL(controllerPath).href}?test=${Date.now()}-${Math.random()}`
  );

  assert.equal(typeof controller.initializeLivingBlockMap, 'function');
  assert.equal(typeof controller.installLivingBlockMapLifecycle, 'function');
  assert.equal((source.match(/root\.addEventListener\(\s*['"]click['"]/g) ?? []).length, 1);
  assert.match(source, /closest(?:<[^>]+>)?\(\s*['"]\[data-action\]['"]\s*\)/);
  for (const attribute of [
    'data-action',
    'data-story-id',
    'data-card-id',
    'data-tab-id',
    'data-stage-id',
  ]) {
    assert.ok(source.includes(attribute), `controller must consume ${attribute}`);
  }
  assert.match(source, /if \(disposed\) return;/);
  assert.match(source, /new Set<number>\(\)/);
  assert.match(source, /animationDuration\(2_900, reducedMotion\)/);
  assert.match(source, /root\.clientWidth\s*\/\s*1_366/);
  assert.match(source, /root\.clientHeight\s*\/\s*1_024/);
});

test('lifecycle installation is singleton-safe across Astro page navigation', async () => {
  assert.ok(existsSync(controllerPath), 'native controller module must exist');
  const controller = await import(
    `${pathToFileURL(controllerPath).href}?lifecycle=${Date.now()}-${Math.random()}`
  );
  const added: string[] = [];
  const removed: string[] = [];
  const fakeDocument = {
    readyState: 'loading',
    defaultView: null,
    addEventListener(type: string) {
      added.push(type);
    },
    removeEventListener(type: string) {
      removed.push(type);
    },
    querySelector() {
      return null;
    },
  } as unknown as Document;

  const uninstall = controller.installLivingBlockMapLifecycle(fakeDocument);
  assert.equal(controller.installLivingBlockMapLifecycle(fakeDocument), uninstall);
  assert.deepEqual(added, ['astro:page-load', 'astro:before-swap']);

  uninstall();
  uninstall();
  assert.deepEqual(removed, ['astro:page-load', 'astro:before-swap']);
});

test('one keyboard surface owns Escape, roving controls, and focus restoration', async () => {
  assert.ok(existsSync(controllerPath), 'native controller module must exist');
  const source = await readFile(controllerPath, 'utf8');

  assert.equal((source.match(/root\.addEventListener\(\s*['"]keydown['"]/g) ?? []).length, 1);
  for (const key of ['Escape', 'ArrowLeft', 'ArrowRight', 'Home', 'End']) {
    assert.ok(source.includes(`'${key}'`), `controller must handle ${key}`);
  }
  for (const opener of ['lastCardTrigger', 'lastAboutTrigger', 'lastBenchTrigger']) {
    assert.match(source, new RegExp(`let ${opener}: HTMLElement \\| null`));
  }
  assert.match(source, /focus\(\{ preventScroll: true \}\)/);
  assert.match(source, /focusFirstStep/);
  assert.match(source, /restoreFocus/);
});

test('built route installs only the standalone native controller', async () => {
  const outDir = await mkdtemp(join(tmpdir(), 'wcus-living-map-controller-'));
  try {
    await withAstroBuildLock(() =>
      execFileSync(process.execPath, [astro, 'build', '--outDir', outDir], {
        cwd: root,
        stdio: 'pipe',
        env: { ...process.env },
      }),
    );
    const html = await readFile(join(outDir, 'living-block-map', 'index.html'), 'utf8');
    assert.ok(html.includes('data-living-block-map'));

    const assetDir = join(outDir, '_astro');
    const scripts = (await readdir(assetDir)).filter((file) => file.endsWith('.js'));
    const builtSource = (
      await Promise.all(scripts.map((file) => readFile(join(assetDir, file), 'utf8')))
    ).join('\n');
    assert.match(builtSource, /astro:page-load/);
    assert.match(builtSource, /astro:before-swap/);

    for (const forbidden of [
      '@wordpress/interactivity',
      'data-wp-',
      'wcus.hperkins.com',
      'isolateKioskPage',
      'serviceWorker.register',
      'Offline mode',
    ]) {
      assert.ok(!builtSource.includes(forbidden), `controller bundle must omit ${forbidden}`);
    }
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
