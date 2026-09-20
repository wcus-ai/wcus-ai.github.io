import { execFileSync } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type BrowserContextOptions, type Page } from 'playwright';
import { withAstroBuildLock } from '../helpers/astro-build-lock.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));
const astro = join(root, 'node_modules', 'astro', 'bin', 'astro.mjs');
const TEST_BASE = '/pr-preview/pr-999/';
const LOOPBACK_HOST = '127.0.0.2';
const mimeTypes: Readonly<Record<string, string>> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.woff2': 'font/woff2',
};

export interface PageDiagnostics {
  readonly consoleErrors: string[];
  readonly pageErrors: string[];
  readonly requestFailures: string[];
  readonly badResponses: string[];
}

export interface MapTestPage {
  readonly page: Page;
  readonly diagnostics: PageDiagnostics;
  close(): Promise<void>;
}

export interface MapTestSite {
  readonly origin: string;
  readonly browser: Browser;
  newPage(options?: BrowserContextOptions): Promise<MapTestPage>;
  close(): Promise<void>;
}

const listen = async (server: Server): Promise<number> =>
  new Promise((resolvePort, reject) => {
    server.once('error', reject);
    server.listen(0, LOOPBACK_HOST, () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Static test server did not expose a TCP port.'));
        return;
      }
      resolvePort(address.port);
    });
  });

const closeServer = async (server: Server): Promise<void> =>
  new Promise((resolveClose, reject) => {
    server.close((error) => (error ? reject(error) : resolveClose()));
    server.closeAllConnections();
  });

const safeFilePath = async (outDir: string, pathname: string): Promise<string | null> => {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const withoutBase = decoded.slice(TEST_BASE.length);
  const candidate = resolve(outDir, withoutBase || 'index.html');
  const traversal = relative(outDir, candidate);
  if (traversal.startsWith(`..${sep}`) || traversal === '..' || isAbsolute(traversal)) return null;

  try {
    const details = await stat(candidate);
    return details.isDirectory() ? join(candidate, 'index.html') : candidate;
  } catch {
    if (!extname(candidate)) return join(candidate, 'index.html');
    return candidate;
  }
};

const createStaticServer = (outDir: string): Server =>
  createServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
    if (requestUrl.pathname === TEST_BASE.slice(0, -1)) {
      response.writeHead(308, { location: TEST_BASE });
      response.end();
      return;
    }
    if (!requestUrl.pathname.startsWith(TEST_BASE)) {
      response.writeHead(404).end('Not found');
      return;
    }

    const file = await safeFilePath(outDir, requestUrl.pathname);
    if (!file) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    try {
      const body = await readFile(file);
      response.writeHead(200, {
        'cache-control': 'no-store',
        'content-type': mimeTypes[extname(file)] ?? 'application/octet-stream',
      });
      response.end(body);
    } catch {
      response.writeHead(404).end('Not found');
    }
  });

export async function startMapTestSite(): Promise<MapTestSite> {
  const outDir = await mkdtemp(join(tmpdir(), 'wcus-map-browser-'));
  let server: Server | null = null;
  let browser: Browser | null = null;
  try {
    await withAstroBuildLock(() =>
      execFileSync(process.execPath, [astro, 'build', '--outDir', outDir, '--base', TEST_BASE], {
        cwd: root,
        stdio: 'pipe',
        env: { ...process.env },
      }),
    );
    server = createStaticServer(outDir);
    const port = await listen(server);
    browser = await chromium.launch({ headless: true });
    const runningServer = server;
    const runningBrowser = browser;
    const openPages = new Set<MapTestPage>();
    let closed = false;

    const site: MapTestSite = {
      origin: `http://${LOOPBACK_HOST}:${port}${TEST_BASE.slice(0, -1)}`,
      browser: runningBrowser,
      async newPage(options = {}): Promise<MapTestPage> {
        if (closed) throw new Error('Map test site is already closed.');
        const context = await runningBrowser.newContext(options);
        const page = await context.newPage();
        const diagnostics: PageDiagnostics = {
          consoleErrors: [],
          pageErrors: [],
          requestFailures: [],
          badResponses: [],
        };
        page.on('console', (message) => {
          if (message.type() === 'error') diagnostics.consoleErrors.push(message.text());
        });
        page.on('pageerror', (error) => diagnostics.pageErrors.push(error.message));
        page.on('requestfailed', (request) => {
          diagnostics.requestFailures.push(
            `${request.method()} ${request.url()} — ${request.failure()?.errorText ?? 'failed'}`,
          );
        });
        page.on('response', (response) => {
          if (response.status() >= 400) {
            diagnostics.badResponses.push(`${response.status()} ${response.url()}`);
          }
        });
        const testPage: MapTestPage = {
          page,
          diagnostics,
          async close(): Promise<void> {
            if (!openPages.delete(testPage)) return;
            await context.close();
          },
        };
        openPages.add(testPage);
        return testPage;
      },
      async close(): Promise<void> {
        if (closed) return;
        closed = true;
        await Promise.all([...openPages].map((testPage) => testPage.close()));
        await runningBrowser.close();
        await closeServer(runningServer);
        await rm(outDir, { recursive: true, force: true });
      },
    };
    return site;
  } catch (error) {
    await browser?.close();
    if (server?.listening) await closeServer(server);
    await rm(outDir, { recursive: true, force: true });
    throw error;
  }
}
