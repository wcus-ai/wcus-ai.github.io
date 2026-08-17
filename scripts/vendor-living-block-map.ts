#!/usr/bin/env node

/* oxlint-disable no-await-in-loop -- Vendoring writes a fixed, ordered file set; sequential IO keeps the manifest deterministic. */

/**
 * Vendor the Living Block Map kiosk into `public/living-block-map/`.
 *
 * The booth site serves the exhibit exactly as the WordPress plugin renders it,
 * rather than reimplementing it: this script runs the plugin's own server
 * renderer, bundles its Interactivity module, and emits one self-contained page
 * beside the fonts and QR codes it references.
 *
 * Usage: node scripts/vendor-living-block-map.ts --source ../core-ai-wcus
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

interface Arguments {
  source: string;
}

interface BlockMetadata {
  readonly version: string;
  readonly attributes: Record<string, { default?: unknown }>;
}

interface VendoredFile {
  readonly path: string;
  readonly sha256: string;
}

interface WebpackRunner {
  (
    config: unknown,
    callback: (
      error: Error | null,
      stats: { hasErrors(): boolean; toString(options: unknown): string },
    ) => void,
  ): void;
}

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const outputDirectory = path.join(repositoryRoot, 'public', 'living-block-map');

const fontFiles = [
  'inter-latin-wght-normal.woff2',
  'eb-garamond-latin-wght-normal.woff2',
  'ibm-plex-mono-latin-400-normal.woff2',
  'ibm-plex-mono-latin-500-normal.woff2',
  'ibm-plex-mono-latin-600-normal.woff2',
  'ibm-plex-mono-latin-700-normal.woff2',
];

const licenseFiles = ['LICENSE-INTER.txt', 'LICENSE-EB-GARAMOND.txt', 'LICENSE-IBM-PLEX-MONO.txt'];

const requiredInputs = [
  'src/core-ai-map/block.json',
  'src/core-ai-map/render.php',
  'src/core-ai-map/view.js',
  'build/core-ai-map/style-index.css',
  'node_modules/webpack',
];

const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

function parseArguments(argv: string[]): Arguments {
  let source = '';

  for (let index = 2; index < argv.length; index += 1) {
    if (argv[index] === '--source') {
      index += 1;
      source = argv[index] ?? '';
    }
  }

  if (!source) {
    throw new Error('Pass --source <path to the core-ai-wcus checkout>');
  }

  return { source: path.resolve(source) };
}

async function assertInputs(sourceRoot: string): Promise<void> {
  for (const relativePath of requiredInputs) {
    try {
      await access(path.join(sourceRoot, relativePath));
    } catch {
      throw new Error(`Missing required source input: ${relativePath}`);
    }
  }
}

/**
 * Render the block through its own PHP renderer. `CORE_AI_MAP_URL` is a
 * sentinel so every plugin asset URL can be rewritten to a path relative to the
 * served page, which keeps the page working under any deployment base.
 */
function renderMarkup(sourceRoot: string, metadata: BlockMetadata): string {
  const renderPath = path.join(sourceRoot, 'src', 'core-ai-map', 'render.php');

  const attributes: Record<string, unknown> = Object.fromEntries(
    Object.entries(metadata.attributes).flatMap(([key, value]) =>
      Object.hasOwn(value, 'default') ? [[key, value.default]] : [],
    ),
  );
  // The booth serves the exhibit over static hosting; the kiosk service worker
  // belongs to the WordPress delivery form, not this one.
  attributes.offlineEnabled = false;

  const harness = String.raw`
define( 'ABSPATH', __DIR__ );
define( 'CORE_AI_MAP_URL', 'ASSET:' );
function __( $text ) { return $text; }
function sanitize_key( $key ) { return strtolower( $key ); }
function absint( $number ) { return abs( (int) $number ); }
$GLOBALS['uid'] = 0;
function wp_unique_id( $prefix = '' ) { $GLOBALS['uid']++; return $prefix . $GLOBALS['uid']; }
function add_query_arg( $key, $value, $url ) { return $url; }
function home_url( $path = '/' ) { return 'https://wcus-ai.github.io' . $path; }
function get_permalink() { return 'https://wcus-ai.github.io/living-block-map/'; }
function core_ai_map_get_kiosk_scope( $url ) { return '/living-block-map/'; }
function core_ai_map_sign_kiosk_scope( $scope ) { return ''; }
function wp_json_encode( $value ) { return json_encode( $value ); }
function esc_attr( $value ) { return htmlspecialchars( (string) $value, ENT_QUOTES ); }
function esc_html( $value ) { return htmlspecialchars( (string) $value, ENT_QUOTES ); }
function esc_url( $value ) { return htmlspecialchars( (string) $value, ENT_QUOTES ); }
function esc_attr_e( $value ) { echo esc_attr( $value ); }
function esc_html_e( $value ) { echo esc_html( $value ); }
function get_block_wrapper_attributes( $attributes = array() ) {
  $classes = trim( 'core-ai-map-kiosk ' . ( $attributes['class'] ?? '' ) );
  $out = 'class="' . esc_attr( $classes ) . '"';
  foreach ( (array) $attributes as $key => $value ) {
    if ( 'class' === $key ) { continue; }
    $out .= ' ' . $key . '="' . esc_attr( (string) $value ) . '"';
  }
  return $out;
}
function wp_interactivity_data_wp_context( $context ) {
  return 'data-wp-context="' . esc_attr( json_encode( $context ) ) . '"';
}
class CoreAiMapVendorModules { public function get_registered( $id ) { return null; } }
function wp_script_modules() { return new CoreAiMapVendorModules(); }
$attributes = json_decode( base64_decode( getenv( 'CORE_AI_MAP_VENDOR_ATTRIBUTES' ) ), true );
$schemas = json_decode( base64_decode( getenv( 'CORE_AI_MAP_VENDOR_SCHEMAS' ) ), true );
$block = (object) array( 'block_type' => (object) array( 'attributes' => $schemas ) );
ob_start();
require ${JSON.stringify(renderPath)};
echo ob_get_clean();
`;

  const rendered = execFileSync('php', ['-r', harness], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: {
      ...process.env,
      CORE_AI_MAP_VENDOR_ATTRIBUTES: Buffer.from(JSON.stringify(attributes)).toString('base64'),
      CORE_AI_MAP_VENDOR_SCHEMAS: Buffer.from(JSON.stringify(metadata.attributes)).toString(
        'base64',
      ),
    },
  });

  if (!rendered.includes('data-wp-interactive')) {
    throw new Error('Rendered markup is missing its Interactivity region.');
  }

  return rendered.trim();
}

/**
 * Bundle the plugin's view module together with the Interactivity runtime, so
 * the served page needs no import map and no second request.
 */
async function bundleViewModule(sourceRoot: string): Promise<string> {
  const requireFromSource = createRequire(path.join(sourceRoot, 'package.json'));
  const webpack = requireFromSource('webpack') as WebpackRunner & {
    optimize: { LimitChunkCountPlugin: new (options: { maxChunks: number }) => unknown };
  };
  const outputPath = path.join(tmpdir(), 'living-block-map-vendor');
  await mkdir(outputPath, { recursive: true });

  const config = {
    mode: 'production',
    devtool: false,
    target: ['web', 'es2020'],
    entry: path.join(sourceRoot, 'src', 'core-ai-map', 'view.js'),
    output: { path: outputPath, filename: 'view.bundle.js', iife: true },
    resolve: {
      modules: [path.join(sourceRoot, 'node_modules'), 'node_modules'],
      extensions: ['.mjs', '.js', '.json'],
    },
    performance: { hints: false },
    // One request, one file: the kiosk must never chase a lazy chunk at the booth.
    plugins: [new webpack.optimize.LimitChunkCountPlugin({ maxChunks: 1 })],
  };

  await new Promise<void>((resolve, reject) => {
    webpack(config, (error, stats) => {
      if (error) {
        reject(error);
        return;
      }
      if (stats.hasErrors()) {
        reject(new Error(stats.toString({ errors: true, all: false })));
        return;
      }
      resolve();
    });
  });

  const bundle = await readFile(path.join(outputPath, 'view.bundle.js'), 'utf8');
  await rm(outputPath, { recursive: true, force: true });

  if (bundle.includes('</script')) {
    throw new Error('Bundle contains a script terminator.');
  }

  return bundle;
}

async function main(): Promise<void> {
  const args = parseArguments(process.argv);
  await assertInputs(args.source);

  const metadata = JSON.parse(
    await readFile(path.join(args.source, 'src', 'core-ai-map', 'block.json'), 'utf8'),
  ) as BlockMetadata;

  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(path.join(outputDirectory, 'fonts'), { recursive: true });
  await mkdir(path.join(outputDirectory, 'qr'), { recursive: true });

  const emitted: VendoredFile[] = [];
  const record = async (relativePath: string, bytes: Uint8Array): Promise<void> => {
    emitted.push({ path: relativePath, sha256: sha256(bytes) });
  };

  // Stylesheet, with the fingerprinted build copies mapped back to plain names.
  let css = await readFile(
    path.join(args.source, 'build', 'core-ai-map', 'style-index.css'),
    'utf8',
  );
  const compiledCssSha256 = sha256(Buffer.from(css));
  const fontSources = new Map<string, string>();
  css = css.replaceAll(/url\(\.\.\/fonts\/([^)]+)\)/g, (_match, hashed: string) => {
    const plain = hashed.replace(/\.[0-9a-f]{8}\.woff2$/, '.woff2');
    fontSources.set(plain, hashed);
    return `url(fonts/${plain})`;
  });
  if (/url\((?!fonts\/)/.test(css)) {
    throw new Error('Stylesheet references an unexpected URL.');
  }
  for (const name of fontFiles) {
    const hashed = fontSources.get(name);
    if (!hashed) {
      throw new Error(`Compiled stylesheet never references ${name}.`);
    }
    const bytes = await readFile(path.join(args.source, 'build', 'fonts', hashed));
    await writeFile(path.join(outputDirectory, 'fonts', name), bytes);
    await record(`fonts/${name}`, bytes);
  }

  // Markup, with every plugin asset URL rewritten to a sibling path.
  let markup = renderMarkup(args.source, metadata);
  markup = markup.replace(/data-asset-urls="[^"]*"/, 'data-asset-urls="[]"');
  const assetReferences = new Set(markup.match(/ASSET:[^"'&\\\s)]+/g) ?? []);
  for (const reference of assetReferences) {
    const relativePath = reference.slice('ASSET:'.length);
    const served = relativePath.startsWith('assets/qr/')
      ? `qr/${path.basename(relativePath)}`
      : path.basename(relativePath);
    const bytes = await readFile(path.join(args.source, relativePath));
    await writeFile(path.join(outputDirectory, served), bytes);
    await record(served, bytes);
    markup = markup.replaceAll(reference, served);
  }
  if (markup.includes('ASSET:')) {
    throw new Error('Markup still references an unresolved plugin asset.');
  }

  // Font licences travel with the fonts.
  for (const name of licenseFiles) {
    const bytes = await readFile(path.join(args.source, 'assets', 'fonts', name));
    await writeFile(path.join(outputDirectory, 'fonts', name), bytes);
    await record(`fonts/${name}`, bytes);
  }

  const script = await bundleViewModule(args.source);
  const preloads = fontFiles
    .map(
      (name) =>
        `    <link rel="preload" href="fonts/${name}" as="font" type="font/woff2" crossorigin />`,
    )
    .join('\n');

  const page = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>Living Block Map — WordPress Core AI</title>
    <meta
      name="description"
      content="Explore how WordPress Core AI building blocks connect across four interactive flows."
    />
    <meta name="theme-color" content="#3858e9" />
    <link rel="canonical" href="https://wcus-ai.github.io/living-block-map/" />
    <link rel="icon" href="icon.svg" type="image/svg+xml" />
${preloads}
    <style>
      html,
      body {
        height: 100%;
        margin: 0;
        background: #f6f7f7;
      }

${css}
    </style>
  </head>
  <body>
${markup}
    <script>
${script}
    </script>
  </body>
</html>
`;

  await writeFile(path.join(outputDirectory, 'index.html'), page);
  await record('index.html', Buffer.from(page));

  const sourceCommit = execFileSync('git', ['-C', args.source, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim();
  const sourceStatus = execFileSync('git', ['-C', args.source, 'status', '--porcelain'], {
    encoding: 'utf8',
  }).trim();
  const manifest = {
    sourceCommit,
    // Whether the checkout this page was built from carried uncommitted work.
    // A release build must record `false`; anything else is a preview.
    sourceCommitted: sourceStatus === '',
    sourceVersion: metadata.version,
    compiledCssSha256,
    files: emitted.toSorted((first, second) => first.path.localeCompare(second.path)),
  };

  await writeFile(
    path.join(outputDirectory, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  process.stdout.write(
    `Vendored Living Block Map ${manifest.sourceVersion} from ${sourceCommit.slice(0, 7)}` +
      `${manifest.sourceCommitted ? '' : ' (uncommitted source)'} — ${emitted.length} files\n`,
  );
}

await main();
