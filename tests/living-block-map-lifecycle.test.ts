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
const componentPath = join(root, 'src', 'components', 'living-block-map', 'LivingBlockMap.astro');
const cssPath = join(root, 'src', 'components', 'living-block-map', 'living-block-map.css');

type FakeListener = (event: Record<string, unknown>) => void;

class FakeStyle {
  readonly #values = new Map<string, string>();
  readonly #onChange: (value: string) => void;

  constructor(onChange: (value: string) => void) {
    this.#onChange = onChange;
  }

  getPropertyValue(name: string): string {
    return this.#values.get(name) ?? '';
  }

  setProperty(name: string, value: string): void {
    this.#values.set(name, value);
    this.#commit();
  }

  removeProperty(name: string): string {
    const previous = this.getPropertyValue(name);
    this.#values.delete(name);
    this.#commit();
    return previous;
  }

  replace(value: string): void {
    this.#values.clear();
    for (const declaration of value.split(';')) {
      const separator = declaration.indexOf(':');
      if (separator < 0) continue;
      const name = declaration.slice(0, separator).trim();
      const propertyValue = declaration.slice(separator + 1).trim();
      if (name) this.#values.set(name, propertyValue);
    }
    this.#commit();
  }

  #commit(): void {
    this.#onChange([...this.#values].map(([name, value]) => `${name}: ${value};`).join(' '));
  }
}

class FakeElement {
  readonly attributes = new Map<string, string>();
  readonly dataset: Record<string, string> = {};
  readonly listeners = new Map<string, FakeListener[]>();
  readonly style = new FakeStyle((value) => this.attributes.set('style', value));
  readonly classList = {
    add: (...tokens: string[]) => {
      const classes = new Set(this.className.split(/\s+/).filter(Boolean));
      tokens.forEach((token) => classes.add(token));
      this.className = [...classes].join(' ');
    },
    remove: (...tokens: string[]) => {
      const classes = new Set(this.className.split(/\s+/).filter(Boolean));
      tokens.forEach((token) => classes.delete(token));
      this.className = [...classes].join(' ');
    },
    contains: (token: string) => this.className.split(/\s+/).includes(token),
    toggle: (token: string, force?: boolean) => {
      const enabled = force ?? !this.classList.contains(token);
      if (enabled) this.classList.add(token);
      else this.classList.remove(token);
      return enabled;
    },
  };
  readonly queryOne = new Map<string, FakeElement>();
  readonly queryMany = new Map<string, FakeElement[]>();
  ownerDocument!: Document;
  hidden = false;
  inert = false;
  disabled = false;
  isConnected = true;
  clientWidth = 1_366;
  clientHeight = 1_024;
  failNextScreenQuery = false;

  get className(): string {
    return this.attributes.get('class') ?? '';
  }

  set className(value: string) {
    this.attributes.set('class', value);
  }

  get textContent(): string {
    return '';
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
    if (name === 'style') this.style.replace(value);
    if (name === 'data-map-state') this.dataset.mapState = value;
  }

  removeAttribute(name: string): void {
    if (name === 'style') this.style.replace('');
    this.attributes.delete(name);
    if (name === 'data-map-state') delete this.dataset.mapState;
  }

  toggleAttribute(name: string, force?: boolean): boolean {
    const enabled = force ?? !this.attributes.has(name);
    if (enabled) this.attributes.set(name, '');
    else this.attributes.delete(name);
    return enabled;
  }

  querySelector<T extends Element>(selector: string): T | null {
    return (this.queryOne.get(selector) as T | undefined) ?? null;
  }

  querySelectorAll<T extends Element>(selector: string): NodeListOf<T> {
    if (selector === '[data-map-screen]' && this.failNextScreenQuery) {
      this.failNextScreenQuery = false;
      throw new Error('forced render failure');
    }
    return (this.queryMany.get(selector) ?? []) as unknown as NodeListOf<T>;
  }

  closest<T extends Element>(selector: string): T | null {
    if (selector.includes('[data-action]') && this.attributes.has('data-action')) {
      return this as unknown as T;
    }
    if (selector === '[data-card-id]' && this.attributes.has('data-card-id')) {
      return this as unknown as T;
    }
    return null;
  }

  contains(): boolean {
    return true;
  }

  addEventListener(type: string, listener: EventListener): void {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener as unknown as FakeListener);
    this.listeners.set(type, listeners);
  }

  focus(): void {}
}

interface FakeTimer {
  readonly callback: () => void;
  readonly delay: number;
}

const createControllerEnvironment = (href: string) => {
  const timers = new Map<number, FakeTimer>();
  const documentListeners = new Map<string, FakeListener[]>();
  const windowListeners = new Map<string, FakeListener[]>();
  const errors: unknown[][] = [];
  let nextTimer = 1;
  let wakeRequests = 0;
  let wakeReleases = 0;
  let scrollX = 17;
  let scrollY = 83;
  const wakeLock = {
    async release() {
      wakeReleases += 1;
    },
    addEventListener() {},
  };
  const fakeWindow = {
    Element: FakeElement,
    location: { href },
    matchMedia: () => ({ matches: false }),
    navigator: {
      wakeLock: {
        async request() {
          wakeRequests += 1;
          return wakeLock;
        },
      },
    },
    console: { error: (...values: unknown[]) => errors.push(values) },
    get scrollX() {
      return scrollX;
    },
    get scrollY() {
      return scrollY;
    },
    scrollTo(x: number, y: number) {
      scrollX = x;
      scrollY = y;
    },
    setTimeout(callback: () => void, delay: number) {
      const timer = nextTimer++;
      timers.set(timer, { callback, delay });
      return timer;
    },
    clearTimeout(timer: number) {
      timers.delete(timer);
    },
    addEventListener(type: string, listener: EventListener) {
      const listeners = windowListeners.get(type) ?? [];
      listeners.push(listener as unknown as FakeListener);
      windowListeners.set(type, listeners);
    },
  };
  const body = new FakeElement();
  const mapRoot = new FakeElement();
  const fallback = new FakeElement();
  const introduction = new FakeElement();
  const canvas = new FakeElement();
  const brokenAction = new FakeElement();
  const fakeDocument = {
    readyState: 'loading',
    visibilityState: 'visible',
    body,
    defaultView: fakeWindow,
    addEventListener(type: string, listener: EventListener) {
      const listeners = documentListeners.get(type) ?? [];
      listeners.push(listener as unknown as FakeListener);
      documentListeners.set(type, listeners);
    },
    removeEventListener() {},
    querySelector(selector: string) {
      return selector === '[data-living-block-map]' ? mapRoot : null;
    },
  } as unknown as Document;
  for (const element of [body, mapRoot, fallback, introduction, canvas, brokenAction]) {
    element.ownerDocument = fakeDocument;
  }
  mapRoot.queryOne.set('[data-map-fallback]', fallback);
  mapRoot.queryOne.set('[data-map-introduction]', introduction);
  mapRoot.queryOne.set('[data-map-surface="canvas"]', canvas);
  mapRoot.queryMany.set('[data-action]', [brokenAction]);

  const fireRoot = (type: string, event: Record<string, unknown>): void => {
    for (const listener of mapRoot.listeners.get(type) ?? []) listener(event);
  };
  const fireDocument = (type: string): void => {
    for (const listener of documentListeners.get(type) ?? []) listener({ type });
  };
  const click = (action: string, attributes: Record<string, string> = {}): void => {
    const target = new FakeElement();
    target.ownerDocument = fakeDocument;
    target.setAttribute('data-action', action);
    for (const [name, value] of Object.entries(attributes)) target.setAttribute(name, value);
    fireRoot('click', { target });
  };
  const timerWithDelay = (delay: number): [number, FakeTimer] | undefined =>
    [...timers].find(([, timer]) => timer.delay === delay);

  return {
    body,
    brokenAction,
    canvas,
    click,
    errors,
    fallback,
    fakeDocument,
    fakeWindow,
    fireDocument,
    fireRoot,
    introduction,
    mapRoot,
    timerWithDelay,
    timers,
    wakeRequestCount: () => wakeRequests,
    wakeReleaseCount: () => wakeReleases,
  };
};

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

test('public initialization never enables inactivity reset or screen wake lock', async () => {
  const controller = await import(
    `${pathToFileURL(controllerPath).href}?public=${Date.now()}-${Math.random()}`
  );
  const environment = createControllerEnvironment('https://example.test/living-block-map/');

  const instance = controller.initializeLivingBlockMap(
    environment.mapRoot as unknown as HTMLElement,
  );
  await Promise.resolve();

  assert.equal(environment.wakeRequestCount(), 0);
  assert.equal(environment.timerWithDelay(60_000), undefined);
  assert.equal(environment.timerWithDelay(90_000), undefined);

  environment.click('start');
  environment.fireRoot('pointerdown', { target: environment.mapRoot });
  environment.fireRoot('keydown', {
    key: 'Shift',
    target: environment.mapRoot,
    preventDefault() {},
  });
  assert.equal(environment.timerWithDelay(60_000), undefined);
  assert.equal(environment.timerWithDelay(90_000), undefined);
  instance.dispose();
});

test('kiosk initialization reschedules by screen and pauses while hidden', async () => {
  const controller = await import(
    `${pathToFileURL(controllerPath).href}?kiosk=${Date.now()}-${Math.random()}`
  );
  const environment = createControllerEnvironment('https://example.test/living-block-map/?kiosk=1');
  const instance = controller.initializeLivingBlockMap(
    environment.mapRoot as unknown as HTMLElement,
  );
  await Promise.resolve();

  assert.equal(environment.wakeRequestCount(), 1);
  assert.equal(environment.timerWithDelay(60_000), undefined, 'attract has no inactivity timer');
  assert.equal(environment.timerWithDelay(90_000), undefined, 'attract has no inactivity timer');

  environment.click('start');
  const firstMapTimer = environment.timerWithDelay(60_000);
  assert.ok(firstMapTimer, 'map schedules 60 seconds');

  environment.fireRoot('pointerdown', { target: environment.mapRoot });
  const pointerTimer = environment.timerWithDelay(60_000);
  assert.ok(pointerTimer);
  assert.notEqual(pointerTimer[0], firstMapTimer[0], 'pointer activity reschedules');

  environment.fireRoot('keydown', {
    key: 'Shift',
    target: environment.mapRoot,
    preventDefault() {},
  });
  const keyboardTimer = environment.timerWithDelay(60_000);
  assert.ok(keyboardTimer);
  assert.notEqual(keyboardTimer[0], pointerTimer[0], 'keyboard activity reschedules');

  environment.click('open-about');
  assert.ok(environment.timerWithDelay(60_000), 'About schedules 60 seconds');
  environment.click('close-about');
  environment.click('inspect', { 'data-card-id': 'plugin' });
  assert.ok(environment.timerWithDelay(90_000), 'inspect schedules 90 seconds');
  environment.click('close-inspect');
  environment.click('open-bench');
  assert.ok(environment.timerWithDelay(90_000), 'bench schedules 90 seconds');
  environment.click('close-bench');

  const expiringTimer = environment.timerWithDelay(60_000);
  assert.ok(expiringTimer);
  Object.defineProperty(environment.fakeDocument, 'visibilityState', {
    configurable: true,
    value: 'hidden',
  });
  environment.fireDocument('visibilitychange');
  await Promise.resolve();
  assert.equal(environment.wakeReleaseCount(), 1);
  expiringTimer[1].callback();
  assert.equal(environment.mapRoot.dataset.mapState, 'map', 'hidden expiry does not reset');

  Object.defineProperty(environment.fakeDocument, 'visibilityState', {
    configurable: true,
    value: 'visible',
  });
  environment.fireDocument('visibilitychange');
  await Promise.resolve();
  assert.equal(environment.wakeRequestCount(), 2);
  const visibleTimer = environment.timerWithDelay(60_000);
  assert.ok(visibleTimer, 'returning visible schedules from current state');
  visibleTimer[1].callback();
  assert.equal(environment.mapRoot.dataset.mapState, 'attract');

  instance.dispose();
  await Promise.resolve();
  assert.ok(environment.wakeReleaseCount() >= 2, 'dispose releases the reacquired wake lock');
});

test('kiosk disposal restores body, scroll, and root state exactly', async () => {
  const controller = await import(
    `${pathToFileURL(controllerPath).href}?restore=${Date.now()}-${Math.random()}`
  );
  const environment = createControllerEnvironment('https://example.test/living-block-map/?kiosk=1');
  environment.body.setAttribute('class', 'before-map custom');
  environment.body.setAttribute(
    'style',
    'overflow: auto; position: relative; width: 44px; top: 7px;',
  );
  environment.mapRoot.setAttribute('class', 'initial-map');
  environment.mapRoot.setAttribute('style', '--cai-scale: 0.5; color: red;');
  environment.mapRoot.setAttribute('data-map-state', 'initial');
  const initialBodyClass = environment.body.getAttribute('class');
  const initialBodyStyle = environment.body.getAttribute('style');
  const initialRootClass = environment.mapRoot.getAttribute('class');
  const initialRootStyle = environment.mapRoot.getAttribute('style');
  const initialRootState = environment.mapRoot.getAttribute('data-map-state');

  const instance = controller.initializeLivingBlockMap(
    environment.mapRoot as unknown as HTMLElement,
  );
  assert.ok(environment.body.classList.contains('core-ai-kiosk-active'));
  environment.fakeWindow.scrollTo(999, 777);
  instance.dispose();
  instance.dispose();

  assert.equal(environment.body.getAttribute('class'), initialBodyClass);
  assert.equal(environment.body.getAttribute('style'), initialBodyStyle);
  assert.equal(environment.mapRoot.getAttribute('class'), initialRootClass);
  assert.equal(environment.mapRoot.getAttribute('style'), initialRootStyle);
  assert.equal(environment.mapRoot.getAttribute('data-map-state'), initialRootState);
  assert.equal(environment.fakeWindow.scrollX, 17);
  assert.equal(environment.fakeWindow.scrollY, 83);
});

test('lifecycle contains initialization failure and reveals a readable fallback', async () => {
  const controller = await import(
    `${pathToFileURL(controllerPath).href}?fallback=${Date.now()}-${Math.random()}`
  );
  const componentSource = await readFile(componentPath, 'utf8');
  const cssSource = await readFile(cssPath, 'utf8');
  const environment = createControllerEnvironment('https://example.test/living-block-map/?kiosk=1');
  environment.body.setAttribute('class', 'before-failure');
  environment.body.setAttribute('style', 'position: relative; overflow: auto;');
  environment.mapRoot.setAttribute('class', 'before-root');
  environment.mapRoot.setAttribute('style', '--cai-scale: 0.75;');
  environment.mapRoot.failNextScreenQuery = true;

  controller.installLivingBlockMapLifecycle(environment.fakeDocument);
  assert.doesNotThrow(() => environment.fireDocument('astro:page-load'));

  assert.ok(componentSource.includes('data-map-introduction'));
  assert.match(cssSource, /\[data-map-fallback\][\s\S]{0,500}z-index:/);
  assert.equal(environment.fallback.hidden, false);
  assert.equal(environment.fallback.inert, false);
  assert.equal(environment.introduction.hidden, false);
  assert.equal(environment.introduction.inert, false);
  assert.equal(environment.canvas.inert, true);
  assert.equal(environment.brokenAction.disabled, true);
  assert.equal(environment.errors.length, 1);
  assert.match(String(environment.errors[0]?.[0]), /Living Block Map failed to initialize/);
  assert.equal(environment.body.getAttribute('class'), 'before-failure');
  assert.equal(environment.body.getAttribute('style'), 'position: relative; overflow: auto;');
  assert.equal(environment.mapRoot.getAttribute('class'), 'before-root');
  assert.equal(environment.mapRoot.getAttribute('style'), '--cai-scale: 0.75;');
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
