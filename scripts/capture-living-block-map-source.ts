#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

interface Arguments {
  source: string;
  refresh: boolean;
}

interface AssetCopy {
  source: string;
  destination: string;
}

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));

const immutableAssets: AssetCopy[] = [
  ...[
    'inter-latin-wght-normal.woff2',
    'eb-garamond-latin-wght-normal.woff2',
    'ibm-plex-mono-latin-400-normal.woff2',
    'ibm-plex-mono-latin-500-normal.woff2',
    'ibm-plex-mono-latin-600-normal.woff2',
    'ibm-plex-mono-latin-700-normal.woff2',
  ].map((name) => ({
    source: `assets/fonts/${name}`,
    destination: `src/assets/living-block-map/fonts/${name}`,
  })),
  ...['LICENSE-INTER.txt', 'LICENSE-EB-GARAMOND.txt', 'LICENSE-IBM-PLEX-MONO.txt'].map((name) => ({
    source: `assets/fonts/${name}`,
    destination: `public/licenses/living-block-map/${name}`,
  })),
  ...[
    'abilities.svg',
    'bench.svg',
    'client.svg',
    'connectors.svg',
    'mcp.svg',
    'plugin.svg',
    'skills.svg',
  ].map((name) => ({
    source: `assets/qr/${name}`,
    destination: `src/assets/living-block-map/qr/${name}`,
  })),
  {
    source: 'assets/qr/manifest.json',
    destination: 'src/assets/living-block-map/qr/manifest.json',
  },
  { source: 'assets/icon.svg', destination: 'src/assets/living-block-map/icon.svg' },
];

const requiredInputs = [
  'src/core-ai-map/block.json',
  'src/core-ai-map/render.php',
  'src/core-ai-map/normalize.js',
  'src/core-ai-map/view.js',
  'build/core-ai-map/style-index.css',
  ...immutableAssets.map(({ source }) => source),
];

function parseArguments(argv: string[]): Arguments {
  let source = '';
  let refresh = false;

  for (let index = 2; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--refresh') {
      refresh = true;
      continue;
    }
    if (argument === '--source') {
      source = argv[index + 1] ?? '';
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }

  if (!source || !path.isAbsolute(source)) {
    throw new Error('--source must be an absolute path to core-ai-wcus');
  }

  return { source: path.resolve(source), refresh };
}

const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

async function assertInputs(sourceRoot: string): Promise<void> {
  for (const relativePath of requiredInputs) {
    try {
      await access(path.join(sourceRoot, relativePath));
    } catch {
      throw new Error(`Missing required source input: ${relativePath}`);
    }
  }
}

async function copyChecked(
  sourceRoot: string,
  asset: AssetCopy,
  refresh: boolean,
): Promise<{ source: string; destination: string; sha256: string }> {
  const sourcePath = path.join(sourceRoot, asset.source);
  const destinationPath = path.join(repositoryRoot, asset.destination);
  const sourceBytes = await readFile(sourcePath);

  try {
    const destinationBytes = await readFile(destinationPath);
    if (sha256(destinationBytes) !== sha256(sourceBytes) && !refresh) {
      throw new Error(
        `${asset.destination} differs from the source; pass --refresh to replace it explicitly`,
      );
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  await mkdir(path.dirname(destinationPath), { recursive: true });
  await copyFile(sourcePath, destinationPath);

  return {
    source: asset.source.replaceAll('\\', '/'),
    destination: asset.destination.replaceAll('\\', '/'),
    sha256: sha256(sourceBytes),
  };
}

async function renderFixture(sourceRoot: string): Promise<Record<string, unknown>> {
  const metadataPath = path.join(sourceRoot, 'src', 'core-ai-map', 'block.json');
  const renderPath = path.join(sourceRoot, 'src', 'core-ai-map', 'render.php');
  const metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
  const attributes = Object.fromEntries(
    Object.entries(metadata.attributes as Record<string, { default?: unknown }>).flatMap(
      ([key, value]) => (Object.hasOwn(value, 'default') ? [[key, value.default]] : []),
    ),
  );
  attributes.offlineEnabled = false;

  const harness = String.raw`
define( 'ABSPATH', __DIR__ );
define( 'CORE_AI_MAP_URL', 'https://example.test/plugin/' );
function __( $text ) { return $text; }
function sanitize_key( $key ) { return strtolower( $key ); }
function absint( $number ) { return abs( (int) $number ); }
function wp_unique_id( $prefix = '' ) { return $prefix . 'fixture'; }
function add_query_arg( $key, $value, $url ) { return $url; }
function home_url( $path = '/' ) { return 'https://example.test' . $path; }
function get_permalink() { return 'https://example.test/living-block-map/'; }
function core_ai_map_get_kiosk_scope( $url ) { return '/living-block-map/'; }
function core_ai_map_sign_kiosk_scope( $scope ) { return 'fixture-token'; }
function wp_json_encode( $value ) { return json_encode( $value ); }
function esc_attr( $value ) { return htmlspecialchars( (string) $value, ENT_QUOTES ); }
function esc_html( $value ) { return htmlspecialchars( (string) $value, ENT_QUOTES ); }
function esc_url( $value ) { return htmlspecialchars( (string) $value, ENT_QUOTES ); }
function esc_attr_e( $value ) { echo esc_attr( $value ); }
function esc_html_e( $value ) { echo esc_html( $value ); }
function get_block_wrapper_attributes( $attributes ) {
  return implode( ' ', array_map(
    static function ( $key, $value ) { return esc_attr( $key ) . '="' . esc_attr( $value ) . '"'; },
    array_keys( $attributes ),
    array_values( $attributes )
  ) );
}
function wp_interactivity_data_wp_context( $context ) {
  return 'data-test-context="' . esc_attr( json_encode( $context ) ) . '"';
}
class CoreAiMapFixtureModules { public function get_registered( $id ) { return null; } }
function wp_script_modules() { return new CoreAiMapFixtureModules(); }
$attributes = json_decode( base64_decode( getenv( 'CORE_AI_MAP_FIXTURE_ATTRIBUTES' ) ), true );
$schemas = json_decode( base64_decode( getenv( 'CORE_AI_MAP_FIXTURE_SCHEMAS' ) ), true );
$block = (object) array( 'block_type' => (object) array( 'attributes' => $schemas ) );
ob_start();
require ${JSON.stringify(renderPath)};
$rendered_html = ob_get_clean();
$fixture = array(
  'sourceVersion' => ${JSON.stringify(metadata.version)},
  'runtimeOverrides' => array( 'offlineEnabled' => false ),
  'content' => array(
    'title' => $map_title,
    'eyebrow' => $eyebrow,
    'reviewedDate' => $reviewed_date,
    'intro' => $intro_paragraphs,
    'labels' => $labels,
    'guidance' => $guidance,
    'announcements' => $announcement_defaults,
    'blocks' => array_values( $blocks ),
    'actors' => array_values( $actors ),
    'flows' => array_values( $stories ),
    'panels' => array_values( $panels ),
    'suggestions' => array_values( $suggestions ),
  ),
  'layouts' => $story_layout,
  'previews' => $attract_previews,
  'neutral' => $neutral,
  'loose' => $loose,
  'shelfX' => $shelf_x,
  'about' => array(
    'badge' => 'Transparency',
    'title' => 'About this exhibit',
    'backLabel' => 'Back to the exhibit',
    'disclosures' => array(
      array( 'term' => 'AI assistance:', 'description' => 'Yes' ),
      array( 'term' => 'Tool:', 'description' => 'OpenAI Codex' ),
      array( 'term' => 'Used for:', 'description' => 'implementation, tests, and deployment preparation.' ),
    ),
    'responsibility' => 'Final work was human-reviewed and tested; the human contributor remains responsible for it.',
  ),
  'bench' => array(
    'titles' => $context['benchTitles'],
    'paths' => $bench_paths,
    'stages' => $bench_stages,
  ),
  'renderedHtml' => $rendered_html,
);
echo json_encode( $fixture, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );
`;

  const result = spawnSync('php', ['-r', harness], {
    cwd: sourceRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      CORE_AI_MAP_FIXTURE_ATTRIBUTES: Buffer.from(JSON.stringify(attributes)).toString('base64'),
      CORE_AI_MAP_FIXTURE_SCHEMAS: Buffer.from(JSON.stringify(metadata.attributes)).toString(
        'base64',
      ),
    },
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.status !== 0 || result.stderr.trim()) {
    throw new Error(result.stderr.trim() || `PHP render exited ${result.status}`);
  }

  return JSON.parse(result.stdout);
}

async function main(): Promise<void> {
  const args = parseArguments(process.argv);
  await assertInputs(args.source);

  const fixture = await renderFixture(args.source);
  const files = [];
  for (const asset of immutableAssets) {
    files.push(await copyChecked(args.source, asset, args.refresh));
  }

  const cssSource = path.join(args.source, 'build', 'core-ai-map', 'style-index.css');
  const cssDestination = path.join(
    repositoryRoot,
    'src',
    'components',
    'living-block-map',
    'living-block-map.css',
  );
  const cssBytes = await readFile(cssSource);
  await mkdir(path.dirname(cssDestination), { recursive: true });
  try {
    const currentCss = await readFile(cssDestination);
    if (sha256(currentCss) !== sha256(cssBytes) && !args.refresh) {
      throw new Error(
        'living-block-map.css differs from the compiled source; pass --refresh to replace it explicitly',
      );
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  await copyFile(cssSource, cssDestination);

  const fixtureDirectory = path.join(repositoryRoot, 'tests', 'fixtures');
  await mkdir(fixtureDirectory, { recursive: true });
  await writeFile(
    path.join(fixtureDirectory, 'living-block-map-effective-render.json'),
    `${JSON.stringify(fixture, null, 2)}\n`,
  );

  const sourceCommit = execFileSync('git', ['-C', args.source, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim();
  await writeFile(
    path.join(fixtureDirectory, 'living-block-map-source-assets.json'),
    `${JSON.stringify(
      {
        sourceCommit,
        compiledCssSha256: sha256(cssBytes),
        files,
      },
      null,
      2,
    )}\n`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
