import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import { withAstroBuildLock } from './helpers/astro-build-lock.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const astro = join(root, 'node_modules', 'astro', 'bin', 'astro.mjs');
const workerPath = join(root, 'public', 'sw.js');
const origin = 'https://wcus-ai.github.io/';

interface HarnessRequest {
  readonly url: string;
  readonly method: 'GET';
  readonly mode: 'navigate' | 'cors';
}

class HarnessResponse {
  readonly ok = true;
  readonly type = 'basic';
  readonly body: string;

  constructor(body: string) {
    this.body = body;
  }

  clone(): HarnessResponse {
    return new HarnessResponse(this.body);
  }
}

type RequestKey = string | HarnessRequest;
type WorkerListener = (event: Record<string, unknown>) => void;

const absoluteRequestUrl = (request: RequestKey): string =>
  new URL(typeof request === 'string' ? request : request.url, origin).href;

test('worker keeps the existing strategies and installs the exact v4 map shell atomically', async () => {
  const source = await readFile(workerPath, 'utf8');

  assert.match(source, /const SHELL = \['\.', 'privacy\/', 'living-block-map\/'\];/);
  assert.match(source, /const VERSION = 'v4';/);
  assert.equal((source.match(/cache\.addAll\(SHELL\)/g) ?? []).length, 1);
  assert.match(source, /keys\.filter\(\(k\) => k !== CACHE\).*caches\.delete\(k\)/s);
  assert.match(source, /request\.mode === 'navigate'/);
  assert.match(source, /caches\.match\(request\).*cached \|\| caches\.match\('\.\/'\)/s);
  assert.match(source, /return cached \|\| networkFetch;/);

  for (const forbidden of [
    "addEventListener('message'",
    'postMessage',
    'core-ai-map__offline',
    'data-map-',
  ]) {
    assert.ok(!source.includes(forbidden), `site worker must omit ${forbidden}`);
  }
});

test('built map shell and its visited hashed assets are cacheable in the worker harness', async () => {
  const outDir = await mkdtemp(join(tmpdir(), 'wcus-living-map-worker-'));
  try {
    await withAstroBuildLock(() =>
      execFileSync(process.execPath, [astro, 'build', '--outDir', outDir], {
        cwd: root,
        stdio: 'pipe',
        env: { ...process.env },
      }),
    );

    const shellFiles = new Map([
      ['.', join(outDir, 'index.html')],
      ['privacy/', join(outDir, 'privacy', 'index.html')],
      ['living-block-map/', join(outDir, 'living-block-map', 'index.html')],
    ]);
    for (const [route, file] of shellFiles) {
      assert.ok(existsSync(file), `production build must contain ${route}`);
    }

    const mapFile = shellFiles.get('living-block-map/');
    assert.ok(mapFile);
    const mapHtml = await readFile(mapFile, 'utf8');
    const assetUrls = {
      css: /href="([^"]+\.css)"/.exec(mapHtml)?.[1],
      js: /src="([^"]+\.js)"/.exec(mapHtml)?.[1],
      image: /src="([^"]+\.svg)"/.exec(mapHtml)?.[1],
      font: /href="([^"]+\.woff2)"/.exec(mapHtml)?.[1],
    };
    const requiredAssetUrls = Object.entries(assetUrls).map(([kind, url]) => {
      assert.ok(url, `built map must expose a hashed ${kind} URL`);
      assert.match(url, /^\/_astro\/[A-Za-z0-9_.-]+$/);
      assert.ok(existsSync(join(outDir, url.slice(1))), `${kind} asset must exist in the build`);
      return url;
    });

    const source = await readFile(workerPath, 'utf8');
    const listeners = new Map<string, WorkerListener>();
    const cacheStores = new Map<string, Map<string, HarnessResponse>>();
    const addAllCalls: string[][] = [];
    let networkAvailable = true;
    let skipWaitingCalls = 0;
    let claimCalls = 0;

    const fetchFromBuild = async (request: RequestKey): Promise<HarnessResponse> => {
      if (!networkAvailable) throw new Error('network unavailable');
      const url = new URL(absoluteRequestUrl(request));
      const relative = url.pathname.replace(/^\//, '');
      const file = relative.endsWith('/')
        ? join(outDir, relative, 'index.html')
        : join(outDir, relative);
      assert.ok(existsSync(file), `mock network file must exist: ${relative}`);
      return new HarnessResponse(relative);
    };

    const cacheFor = (name: string) => {
      const entries = cacheStores.get(name) ?? new Map<string, HarnessResponse>();
      cacheStores.set(name, entries);
      return {
        async addAll(routes: string[]) {
          addAllCalls.push([...routes]);
          const warmed = await Promise.all(
            routes.map(
              async (route) => [absoluteRequestUrl(route), await fetchFromBuild(route)] as const,
            ),
          );
          for (const [url, response] of warmed) entries.set(url, response.clone());
        },
        async put(request: RequestKey, response: HarnessResponse) {
          entries.set(absoluteRequestUrl(request), response.clone());
        },
        async match(request: RequestKey) {
          return entries.get(absoluteRequestUrl(request));
        },
      };
    };

    const caches = {
      async open(name: string) {
        return cacheFor(name);
      },
      async keys() {
        return [...cacheStores.keys()];
      },
      async delete(name: string) {
        return cacheStores.delete(name);
      },
      async match(request: RequestKey) {
        for (const entries of cacheStores.values()) {
          const response = entries.get(absoluteRequestUrl(request));
          if (response) return response;
        }
        return undefined;
      },
    };
    const workerSelf = {
      location: { origin: new URL(origin).origin },
      clients: {
        async claim() {
          claimCalls += 1;
        },
      },
      async skipWaiting() {
        skipWaitingCalls += 1;
      },
      addEventListener(type: string, listener: WorkerListener) {
        listeners.set(type, listener);
      },
    };
    runInNewContext(source, {
      URL,
      Promise,
      caches,
      fetch: fetchFromBuild,
      self: workerSelf,
    });

    const waitForLifecycle = async (type: 'install' | 'activate'): Promise<void> => {
      let completion: Promise<unknown> | undefined;
      listeners.get(type)?.({
        waitUntil(value: Promise<unknown>) {
          completion = value;
        },
      });
      assert.ok(completion, `${type} must register waitUntil work`);
      await completion;
    };
    const requestThroughWorker = async (request: HarnessRequest): Promise<HarnessResponse> => {
      let response: Promise<HarnessResponse> | undefined;
      listeners.get('fetch')?.({
        request,
        respondWith(value: Promise<HarnessResponse>) {
          response = value;
        },
      });
      assert.ok(response, `worker must respond to ${request.url}`);
      return response;
    };

    cacheStores.set('wcus-core-ai-v3', new Map());
    await waitForLifecycle('install');
    assert.deepEqual(addAllCalls, [['.', 'privacy/', 'living-block-map/']]);
    assert.equal(skipWaitingCalls, 1);
    await waitForLifecycle('activate');
    assert.deepEqual([...cacheStores.keys()], ['wcus-core-ai-v4']);
    assert.equal(claimCalls, 1);

    networkAvailable = false;
    const cachedMap = await requestThroughWorker({
      url: new URL('living-block-map/', origin).href,
      method: 'GET',
      mode: 'navigate',
    });
    assert.equal(cachedMap.body, 'living-block-map/');

    networkAvailable = true;
    await Promise.all(
      requiredAssetUrls.map(async (url) => {
        const response = await requestThroughWorker({
          url: new URL(url, origin).href,
          method: 'GET',
          mode: 'cors',
        });
        assert.equal(response.type, 'basic');
      }),
    );
    await new Promise((resolve) => setImmediate(resolve));

    networkAvailable = false;
    await Promise.all(
      requiredAssetUrls.map(async (url) => {
        const cached = await requestThroughWorker({
          url: new URL(url, origin).href,
          method: 'GET',
          mode: 'cors',
        });
        assert.equal(cached.body, new URL(url, origin).pathname.slice(1));
      }),
    );
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
