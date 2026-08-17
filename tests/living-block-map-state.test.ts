import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { MAP_MODEL } from '../src/components/living-block-map/model.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const statePath = join(root, 'src', 'components', 'living-block-map', 'state.ts');

async function loadStateModule() {
  assert.ok(existsSync(statePath), 'pure Living Block Map state module must exist');
  return import(`${pathToFileURL(statePath).href}?test=${Date.now()}-${Math.random()}`);
}

test('entry actions are immutable and distinguish the first flow from browse mode', async () => {
  const { INITIAL_MAP_STATE, transition } = await loadStateModule();
  const initial = structuredClone(INITIAL_MAP_STATE);

  const started = transition(INITIAL_MAP_STATE, { type: 'start' });
  assert.deepEqual(INITIAL_MAP_STATE, initial, 'transition must not mutate its input');
  assert.equal(started.screen, 'map');
  assert.equal(started.flow, 'uses-ai');
  assert.equal(started.flowPhase, 'assembling');
  assert.equal(
    started.announcement,
    'WordPress uses AI. A feature inside WordPress needs an AI-generated result.',
  );

  const browsed = transition(INITIAL_MAP_STATE, { type: 'browse' });
  assert.equal(browsed.screen, 'map');
  assert.equal(browsed.flow, null);
  assert.equal(
    browsed.announcement,
    'Every component is on the canvas with no flow selected. Tap any component to learn what it is and where it belongs.',
  );
});

test('flow selection and settling expose the exact authored teaching state', async () => {
  const { INITIAL_MAP_STATE, transition } = await loadStateModule();

  for (const [flow, title, situation, takeaway] of [
    [
      'uses-ai',
      'WordPress uses AI',
      'A feature inside WordPress needs an AI-generated result.',
      'A WordPress feature uses a common AI interface instead of integrating directly with every provider. Provider configuration supports the request, while the AI service remains outside WordPress.',
    ],
    [
      'uses-wp',
      'AI uses WordPress',
      'An outside assistant asks WordPress to perform an allowed action.',
      'The assistant does not bypass WordPress. The MCP Adapter translates the request, and the selected ability still applies WordPress permissions.',
    ],
    [
      'learns',
      'An agent learns WordPress',
      'A coding agent receives WordPress-specific guidance before writing code.',
      'Agent Skills changes the information available to the coding agent. Nothing runs on the WordPress site during this flow.',
    ],
    [
      'tests',
      'WordPress tests the result',
      'Code written by an agent needs to be tested against real WordPress behavior.',
      "The generated code runs in a disposable WordPress environment and is judged by WordPress tests, not by another model's opinion.",
    ],
  ] as const) {
    const selected = transition(INITIAL_MAP_STATE, { type: 'select-flow', flow });
    assert.equal(selected.announcement, `${title}. ${situation}`);
    const settled = transition(selected, { type: 'settle-flow' });
    assert.equal(settled.flowPhase, 'settled');
    assert.equal(settled.announcement, `What this flow shows: ${takeaway}`);
  }
});

test('inspect and About close to their exact return state', async () => {
  const { INITIAL_MAP_STATE, transition } = await loadStateModule();
  const map = transition(INITIAL_MAP_STATE, { type: 'select-flow', flow: 'uses-wp' });
  const inspected = transition(map, { type: 'inspect', card: 'abilities' });
  assert.equal(inspected.screen, 'inspect');
  assert.equal(inspected.inspectedCard, 'abilities');
  assert.equal(inspected.abilityTab, 'overview');
  assert.equal(inspected.announcement, 'Abilities API details open in AI uses WordPress.');

  const closed = transition(inspected, { type: 'close-inspect' });
  assert.equal(closed.screen, 'map');
  assert.equal(closed.flow, 'uses-wp');
  assert.equal(closed.inspectedCard, null);
  assert.equal(closed.announcement, 'Details closed. Back in AI uses WordPress.');

  const aboutFromMap = transition(map, { type: 'open-about' });
  assert.equal(aboutFromMap.aboutReturnScreen, 'map');
  assert.equal(transition(aboutFromMap, { type: 'close-about' }).screen, 'map');

  const aboutFromAttract = transition(INITIAL_MAP_STATE, { type: 'open-about' });
  assert.equal(aboutFromAttract.aboutReturnScreen, 'attract');
  assert.equal(transition(aboutFromAttract, { type: 'close-about' }).screen, 'attract');
});

test('replay advances the AI suggestion and Apply changes it exactly once', async () => {
  const { INITIAL_MAP_STATE, transition } = await loadStateModule();
  const map = transition(INITIAL_MAP_STATE, { type: 'start' });
  const replayed = transition(map, { type: 'replay-flow' });
  assert.equal(replayed.suggestionIndex, 1);
  assert.equal(replayed.suggestionApplied, false);
  assert.equal(
    replayed.announcement,
    'WordPress uses AI replayed. A feature inside WordPress needs an AI-generated result. The AI Plugin shows the next suggestion.',
  );

  const applied = transition(replayed, { type: 'apply-suggestion' });
  assert.equal(applied.suggestionApplied, true);
  assert.equal(
    applied.announcement,
    'A person chose Apply. The AI Plugin suggestion is now applied.',
  );
  assert.deepEqual(transition(applied, { type: 'apply-suggestion' }), applied);
});

test('Abilities and WP-Bench selection stay typed and return to the map', async () => {
  const { INITIAL_MAP_STATE, transition } = await loadStateModule();
  const map = transition(INITIAL_MAP_STATE, { type: 'select-flow', flow: 'tests' });
  const inspected = transition(map, { type: 'inspect', card: 'abilities' });
  assert.equal(
    transition(inspected, { type: 'select-ability-tab', tab: 'permissions' }).abilityTab,
    'permissions',
  );

  const bench = transition(map, { type: 'open-bench' });
  assert.equal(bench.screen, 'bench');
  assert.equal(bench.benchStage, 'sandbox');
  assert.equal(bench.announcement, 'WP-Bench run loop open. Sandbox selected.');
  const evidence = transition(bench, { type: 'select-bench-stage', stage: 'evidence' });
  assert.equal(evidence.announcement, 'WP-Bench stage selected: Pass or fail. Never a percentage.');
  const closed = transition(evidence, { type: 'close-bench' });
  assert.equal(closed.screen, 'map');
  assert.equal(closed.flow, 'tests');
});

test('timing helpers enforce public and explicit kiosk contracts', async () => {
  const { INITIAL_MAP_STATE, animationDuration, inactivityDelay, transition } =
    await loadStateModule();
  const map = transition(INITIAL_MAP_STATE, { type: 'start' });
  const about = transition(map, { type: 'open-about' });
  const inspect = transition(map, { type: 'inspect', card: 'plugin' });
  const bench = transition(map, { type: 'open-bench' });

  assert.equal(inactivityDelay(INITIAL_MAP_STATE, true), null);
  assert.equal(inactivityDelay(map, false), null);
  assert.equal(inactivityDelay(map, true), 60_000);
  assert.equal(inactivityDelay(about, true), 60_000);
  assert.equal(inactivityDelay(inspect, true), 90_000);
  assert.equal(inactivityDelay(bench, true), 90_000);
  assert.equal(animationDuration(2_900, false), 2_900);
  assert.equal(animationDuration(2_900, true), 0);
});

test('derived view makes only flow participants operable and browse enables every card', async () => {
  const { INITIAL_MAP_STATE, deriveView, transition } = await loadStateModule();
  const flow = transition(INITIAL_MAP_STATE, { type: 'select-flow', flow: 'uses-ai' });
  const flowView = deriveView(flow, MAP_MODEL);

  assert.equal(flowView.cards.plugin.active, true);
  assert.equal(flowView.cards.client.active, true);
  assert.equal(flowView.cards['provider-plugin'].active, true);
  assert.equal(flowView.cards.connectors.active, true, 'sidecar remains a participant');
  assert.equal(flowView.cards.abilities.disabled, true);
  assert.equal(flowView.cards.abilities.dimmed, true);
  assert.equal(
    flowView.cards.plugin.accessibleName,
    'Step 1: AI Plugin — view its role in “WordPress uses AI.”',
  );

  const browseView = deriveView(transition(flow, { type: 'browse' }), MAP_MODEL);
  assert.ok(
    Object.values(browseView.cards as Record<string, { disabled: boolean }>).every(
      ({ disabled }) => !disabled,
    ),
  );
  assert.equal(browseView.cards.abilities.accessibleName, 'Abilities API — open its details.');
});

test('derived view owns screen inertness and roving tab order', async () => {
  const { INITIAL_MAP_STATE, deriveView, transition } = await loadStateModule();
  const inspected = transition(transition(INITIAL_MAP_STATE, { type: 'start' }), {
    type: 'inspect',
    card: 'abilities',
  });
  const selected = transition(inspected, { type: 'select-ability-tab', tab: 'anatomy' });
  const view = deriveView(selected, MAP_MODEL);

  assert.deepEqual(view.screens.inspect, { hidden: false, inert: false });
  assert.deepEqual(view.screens.map, { hidden: true, inert: true });
  assert.deepEqual(view.abilityTabs.anatomy, { selected: true, tabIndex: 0 });
  assert.deepEqual(view.abilityTabs.overview, { selected: false, tabIndex: -1 });
});

test('reset and preview events return to a deterministic attract state', async () => {
  const { INITIAL_MAP_STATE, transition } = await loadStateModule();
  const advanced = transition(INITIAL_MAP_STATE, { type: 'advance-preview' });
  assert.equal(advanced.previewIndex, 1);
  assert.equal(advanced.previewPhase, 'assembling');

  const reset = transition(transition(INITIAL_MAP_STATE, { type: 'start' }), {
    type: 'reset',
    reason: 'inactivity',
  });
  assert.equal(reset.screen, 'attract');
  assert.equal(reset.flow, null);
  assert.equal(reset.previewIndex, 0);
  assert.equal(reset.announcement, 'The map reset after a period of inactivity.');
});

test('attract release returns every card to its loose resting presentation', async () => {
  const { INITIAL_MAP_STATE, deriveView, transition } = await loadStateModule();
  const releasing = transition(INITIAL_MAP_STATE, {
    type: 'set-preview-phase',
    phase: 'releasing',
  });
  const view = deriveView(releasing, MAP_MODEL);

  const cards = Object.values(view.cards as Record<string, { active: boolean; opacity: string }>);
  assert.ok(cards.every((card) => !card.active));
  assert.ok(cards.every((card) => card.opacity === '0.62'));
  assert.match(view.cards.plugin.transform, /rotate\(/);
});
