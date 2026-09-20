/* oxlint-disable no-await-in-loop -- Browser journeys intentionally preserve UI state ordering. */
/* oxlint-disable unicorn/consistent-function-scoping -- page.evaluate helpers must stay inside the serialized browser callback. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import type { BrowserContextOptions, Page } from 'playwright';
import {
  startMapTestSite,
  type MapTestPage,
  type MapTestSite,
  type PageDiagnostics,
} from './harness.ts';

type FlowId = 'uses-ai' | 'uses-wp' | 'learns' | 'tests';

interface FixtureRole {
  readonly receives: string;
  readonly does: string;
  readonly returns: string;
  readonly lesson: string;
}

interface FixturePanel {
  readonly id: string;
  readonly badge: string;
  readonly title: string;
  readonly lede: string;
  readonly roles: Readonly<Record<string, FixtureRole>>;
  readonly notes?: readonly { readonly heading: string; readonly text: string }[];
  readonly href?: string;
  readonly linkLabel?: string;
  readonly qr?: string;
}

interface FixtureLayout {
  readonly members: Readonly<Record<string, number>>;
  readonly place: Readonly<Record<string, readonly [number, number]>>;
  readonly park: readonly string[];
  readonly sidecars?: readonly string[];
  readonly providerPlugin?: {
    readonly step: number;
    readonly position: readonly [number, number];
    readonly restPosition: readonly [number, number];
  };
  readonly edges: readonly string[];
  readonly sidecarEdges?: readonly string[];
  readonly rest: readonly string[];
  readonly sidecarRest?: readonly string[];
  readonly crosses: readonly string[];
}

interface MapFixture {
  readonly content: {
    readonly title: string;
    readonly eyebrow: string;
    readonly reviewedDate: string;
    readonly intro: readonly string[];
    readonly labels: Readonly<Record<string, string>>;
    readonly guidance: Readonly<Record<string, string>>;
    readonly announcements: Readonly<Record<string, string>>;
    readonly blocks: readonly {
      readonly id: string;
      readonly name: string;
      readonly tagline: string;
      readonly badge: string;
    }[];
    readonly actors: readonly {
      readonly id: string;
      readonly name: string;
      readonly tagline: string;
      readonly badge: string;
    }[];
    readonly flows: readonly {
      readonly id: FlowId;
      readonly title: string;
      readonly copy: string;
      readonly situation: string;
      readonly takeaway: string;
      readonly outcome: string;
    }[];
    readonly panels: readonly FixturePanel[];
    readonly suggestions: readonly { readonly label: string; readonly text: string }[];
  };
  readonly layouts: Readonly<Record<FlowId, FixtureLayout>>;
  readonly previews: readonly { readonly storyId: FlowId }[];
  readonly neutral: Readonly<Record<string, readonly [number, number]>>;
  readonly about: {
    readonly badge: string;
    readonly title: string;
    readonly backLabel: string;
    readonly disclosures: readonly { readonly term: string; readonly description: string }[];
    readonly responsibility: string;
  };
  readonly bench: {
    readonly titles: Readonly<Record<string, string>>;
    readonly stages: Readonly<
      Record<
        string,
        {
          readonly number: string;
          readonly badge: string;
          readonly label: string;
          readonly summary: string;
          readonly kicker: string;
          readonly title: string;
          readonly body: string;
          readonly note?: string;
          readonly flow?: readonly {
            readonly label: string;
            readonly accent?: boolean;
          }[];
          readonly rows: readonly (readonly [string, string])[];
        }
      >
    >;
  };
}

const fixture = JSON.parse(
  await readFile(
    new URL('../fixtures/living-block-map-effective-render.json', import.meta.url),
    'utf8',
  ),
) as MapFixture;

const contracts = [
  'MAP-01 — Route shell',
  'MAP-02 — Attract state',
  'MAP-03 — Entry actions',
  'MAP-04 — WordPress uses AI',
  'MAP-05 — AI uses WordPress',
  'MAP-06 — An agent learns WordPress',
  'MAP-07 — WordPress tests the result',
  'MAP-08 — Flow controls',
  'MAP-09 — Browse mode',
  'MAP-10 — Card inspection',
  'MAP-11 — Abilities tabs',
  'MAP-12 — About',
  'MAP-13 — WP-Bench',
  'MAP-14 — Suggestion demo',
  'MAP-15 — Focus and announcements',
  'MAP-16 — Reduced motion',
  'MAP-17 — Timing modes',
  'MAP-18 — Astro lifecycle',
  'MAP-19 — Failure fallback',
  'MAP-20 — Runtime independence',
  'MAP-21 — Responsive stage',
  'MAP-22 — Content identity',
  'MAP-23 — Site cache',
] as const;

let site: MapTestSite;

before(async () => {
  site = await startMapTestSite();
});

after(async () => {
  await site?.close();
});

const assertCleanDiagnostics = (diagnostics: PageDiagnostics): void => {
  assert.deepEqual(diagnostics.consoleErrors, [], 'console errors');
  assert.deepEqual(diagnostics.pageErrors, [], 'page errors');
  assert.deepEqual(diagnostics.requestFailures, [], 'failed requests');
  assert.deepEqual(diagnostics.badResponses, [], 'HTTP responses with status >= 400');
};

interface OpenMapOptions {
  readonly context?: BrowserContextOptions;
  readonly query?: string;
  readonly beforeGoto?: (testPage: MapTestPage) => Promise<void>;
}

const openMap = async (options: OpenMapOptions = {}): Promise<MapTestPage> => {
  const testPage = await site.newPage({ reducedMotion: 'reduce', ...options.context });
  await options.beforeGoto?.(testPage);
  const response = await testPage.page.goto(
    `${site.origin}/living-block-map/${options.query ?? ''}`,
    {
      waitUntil: 'networkidle',
    },
  );
  assert.equal(response?.status(), 200);
  return testPage;
};

const withMap = async (
  callback: (testPage: MapTestPage) => Promise<void>,
  options: OpenMapOptions = {},
  cleanDiagnostics = true,
): Promise<void> => {
  const testPage = await openMap(options);
  try {
    await callback(testPage);
    await testPage.page.waitForTimeout(25);
    if (cleanDiagnostics) assertCleanDiagnostics(testPage.diagnostics);
  } finally {
    await testPage.close();
  }
};

const normalizeText = (value: string | null | undefined): string =>
  value?.replace(/\s+/g, ' ').trim() ?? '';

const flowById = (flowId: FlowId) => {
  const flow = fixture.content.flows.find(({ id }) => id === flowId);
  assert.ok(flow, `fixture must contain ${flowId}`);
  return flow;
};

const panelById = (cardId: string): FixturePanel => {
  const panel = fixture.content.panels.find(({ id }) => id === cardId);
  assert.ok(panel, `fixture must contain the ${cardId} panel`);
  return panel;
};

const format = (template: string, ...values: string[]): string =>
  template.replace(
    /%([1-9])\$s/g,
    (_match, position: string) => values[Number(position) - 1] ?? '',
  );

const cardIds = [
  ...fixture.content.actors.map(({ id }) => id),
  ...fixture.content.blocks.map(({ id }) => id),
  'provider-plugin',
];

const cardButton = (page: Page, cardId: string) =>
  page.locator(
    `[data-map-surface="canvas"] [data-card-id="${cardId}"] button[data-action="inspect"]`,
  );

const waitForFocus = async (page: Page, selector: string): Promise<void> => {
  await page.waitForFunction(
    (expectedSelector) => document.activeElement?.matches(expectedSelector) === true,
    selector,
  );
};

interface WakeStats {
  readonly requests: number;
  readonly releases: number;
  readonly held: number;
}

const installClockAndWakeLock = async ({ page }: MapTestPage): Promise<void> => {
  await page.addInitScript(() => {
    const stats = { requests: 0, releases: 0, held: 0 };
    Reflect.set(window, '__mapWakeStats', stats);
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: {
        async request(): Promise<object> {
          stats.requests += 1;
          stats.held += 1;
          let released = false;
          const releaseListeners = new Set<EventListenerOrEventListenerObject>();
          return {
            addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
              if (type === 'release') releaseListeners.add(listener);
            },
            async release(): Promise<void> {
              if (released) return;
              released = true;
              stats.releases += 1;
              stats.held -= 1;
              const event = new Event('release');
              for (const listener of releaseListeners) {
                if (typeof listener === 'function') listener(event);
                else listener.handleEvent(event);
              }
              releaseListeners.clear();
            },
          };
        },
      },
    });
  });
  await page.clock.install();
};

const wakeStats = async (page: Page): Promise<WakeStats> =>
  page.evaluate(() => {
    const value = Reflect.get(window, '__mapWakeStats') as WakeStats | undefined;
    if (!value) throw new Error('Wake-lock test shim is missing.');
    return { ...value };
  });

const setMockVisibility = async (page: Page, visibility: 'hidden' | 'visible'): Promise<void> => {
  await page.evaluate((nextVisibility) => {
    Reflect.set(window, '__mapVisibility', nextVisibility);
    if (!Object.hasOwn(document, 'visibilityState')) {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => Reflect.get(window, '__mapVisibility'),
      });
    }
    document.dispatchEvent(new Event('visibilitychange'));
  }, visibility);
};

const bodyAttributes = async (
  page: Page,
): Promise<{ className: string | null; style: string | null }> =>
  page.locator('body').evaluate((body) => ({
    className: body.getAttribute('class'),
    style: body.getAttribute('style'),
  }));

const selectFlow = async (page: Page, flowId: FlowId): Promise<void> => {
  await page.locator('[data-map-screen="attract"] [data-action="start"]').click();
  if (flowId !== 'uses-ai') {
    await page.locator(`[data-action="select-flow"][data-story-id="${flowId}"]`).click();
  }
  await page.waitForFunction(
    (selectedFlow) =>
      document
        .querySelector(`[data-action="select-flow"][data-story-id="${selectedFlow}"]`)
        ?.getAttribute('aria-pressed') === 'true',
    flowId,
  );
};

const assertSelectedFlow = async (page: Page, flowId: FlowId): Promise<void> => {
  const flow = flowById(flowId);
  const layout = fixture.layouts[flowId];
  const participants = new Set([
    ...Object.keys(layout.members),
    ...(layout.sidecars ?? []),
    ...(layout.providerPlugin ? ['provider-plugin'] : []),
  ]);

  assert.equal(await page.locator('main[data-map-state="map"]').count(), 1);
  assert.equal(
    await page
      .locator(`[data-action="select-flow"][data-story-id="${flowId}"]`)
      .getAttribute('aria-pressed'),
    'true',
  );
  for (const cardId of cardIds) {
    const card = page.locator(`[data-map-surface="canvas"] > [data-card-id="${cardId}"]`);
    const button = card.locator('button[data-action="inspect"]');
    const participant = participants.has(cardId);
    assert.equal(await button.isDisabled(), !participant, `${flowId}/${cardId} operability`);
    assert.equal(
      (await card.getAttribute('class'))?.split(/\s+/).includes('is-active') ?? false,
      participant,
      `${flowId}/${cardId} active class`,
    );
    const expectedStep =
      cardId === 'provider-plugin' ? layout.providerPlugin?.step : layout.members[cardId];
    assert.equal(
      normalizeText(await button.locator('.core-ai-map__step').textContent()),
      expectedStep ? String(expectedStep) : '',
      `${flowId}/${cardId} step`,
    );
  }

  for (const [cardId, position] of Object.entries(layout.place)) {
    const neutral = fixture.neutral[cardId];
    assert.ok(neutral);
    assert.equal(
      await page
        .locator(`[data-map-surface="canvas"] > [data-card-id="${cardId}"]`)
        .evaluate((element) => (element as HTMLElement).style.transform),
      `translate(${position[0] - neutral[0]}px, ${position[1] - neutral[1]}px)`,
      `${flowId}/${cardId} placement`,
    );
  }
  if (layout.providerPlugin) {
    const neutral = fixture.neutral['provider-plugin'];
    const position = layout.providerPlugin.position;
    assert.equal(
      await page
        .locator('[data-map-surface="canvas"] > [data-card-id="provider-plugin"]')
        .evaluate((element) => (element as HTMLElement).style.transform),
      `translate(${position[0] - neutral[0]}px, ${position[1] - neutral[1]}px)`,
    );
  }

  assert.equal(
    await page
      .locator(
        `.core-ai-map__flow path[data-story-id="${flowId}"][data-variant="edges"]:not([data-map-hidden])`,
      )
      .count(),
    layout.edges.length,
  );
  assert.equal(
    await page
      .locator(
        `.core-ai-map__config-path[data-story-id="${flowId}"][data-variant="edges"]:not([data-map-hidden])`,
      )
      .count(),
    layout.sidecarEdges?.length ?? 0,
  );
  for (const boundary of ['left', 'right', 'bottom']) {
    assert.equal(
      (await page.locator(`[data-map-boundary="${boundary}"]`).getAttribute('class'))
        ?.split(/\s+/)
        .includes('is-lit') ?? false,
      layout.crosses.includes(boundary),
      `${flowId}/${boundary} boundary`,
    );
  }

  const story = page.locator(`.core-ai-map__story-flow[data-story-id="${flowId}"]`);
  assert.equal(await story.locator('.core-ai-map__situation span').textContent(), flow.situation);
  assert.equal(await story.locator('.core-ai-map__takeaway span').textContent(), flow.takeaway);
  assert.equal(await story.locator('.core-ai-map__takeaway').isVisible(), true);
  assert.equal(
    await page
      .locator(`[data-action="select-flow"][data-story-id="${flowId}"] .core-ai-map__rail-outcome`)
      .textContent(),
    flow.outcome,
  );
};

test(contracts[0], async () => {
  const testPage = await openMap();
  try {
    const { page } = testPage;
    assert.equal(await page.title(), 'Living Block Map — WordPress Core AI');
    assert.equal(await page.locator('main[data-living-block-map]').count(), 1);
    assert.equal(await page.locator('.site-header, .site-footer, iframe').count(), 0);
    assert.equal(
      await page.locator('link[rel="canonical"]').getAttribute('href'),
      'https://wcus-ai.github.io/living-block-map',
    );
    assert.equal(await page.locator('link[rel="preload"][type="font/woff2"]').count(), 6);
    await page.locator('[data-map-screen="attract"] [data-action="start"]').waitFor();
    assert.equal(await page.locator('[data-map-fallback]').isHidden(), true);
    assertCleanDiagnostics(testPage.diagnostics);
  } finally {
    await testPage.close();
  }
});

test(contracts[1], async () => {
  await withMap(
    async ({ page }) => {
      assert.equal(await page.locator('[data-map-screen="attract"]').isVisible(), true);
      assert.equal(
        await page.locator('.core-ai-map__eyebrow').textContent(),
        fixture.content.eyebrow,
      );
      assert.equal(
        await page.locator('[data-map-screen="attract"] h1').textContent(),
        fixture.content.title,
      );
      assert.deepEqual(
        await page.locator('.core-ai-map__intro').allTextContents(),
        fixture.content.intro,
      );
      assert.equal(await page.locator('.core-ai-map__legend--welcome li').count(), 3);
      assert.equal(await page.locator('[data-action="start"]').isVisible(), true);
      assert.equal(await page.locator('.core-ai-map__attract-browse').isVisible(), true);
      assert.equal(
        normalizeText(await page.locator('[data-map-live]').textContent()),
        'Core AI Living Block Map ready. Choose a flow to begin, or open the first flow.',
      );
      const initialPreview = page.locator(
        '.core-ai-map__attract-story [data-preview-id]:not([hidden])',
      );
      assert.equal(
        await initialPreview.getAttribute('data-story-id'),
        fixture.previews[0]?.storyId,
      );
      assert.equal(await initialPreview.locator('span').textContent(), flowById('uses-ai').title);

      await page.clock.runFor(6_501);
      const nextPreview = page.locator(
        '.core-ai-map__attract-story [data-preview-id]:not([hidden])',
      );
      assert.equal(await nextPreview.getAttribute('data-story-id'), fixture.previews[1]?.storyId);
    },
    {
      beforeGoto: async ({ page }) => page.clock.install({ time: Date.now() }),
    },
  );
});

test(contracts[2], async () => {
  await withMap(async ({ page }) => {
    await page.locator('[data-map-screen="attract"] [data-action="start"]').click();
    assert.equal(await page.locator('main').getAttribute('data-map-state'), 'map');
    assert.equal(
      await page
        .locator('[data-action="select-flow"][data-story-id="uses-ai"]')
        .getAttribute('aria-pressed'),
      'true',
    );
    await page.waitForFunction(() =>
      document.activeElement?.matches('[data-map-surface="canvas"] button[data-action="inspect"]'),
    );
    assert.equal(normalizeText(await page.locator(':focus .core-ai-map__step').textContent()), '1');

    await page.locator('[data-action="reset"]').click();
    assert.equal(await page.locator('main').getAttribute('data-map-state'), 'attract');
    await page.locator('[data-map-screen="attract"] [data-action="browse"]').click();
    assert.equal(await page.locator('main').getAttribute('data-map-state'), 'map');
    assert.equal(await page.locator('[data-action="select-flow"][aria-pressed="true"]').count(), 0);
    assert.equal(await page.locator('[data-map-browse-note]').isVisible(), true);
  });
});

test(contracts[3], async () => {
  await withMap(async ({ page }) => {
    await selectFlow(page, 'uses-ai');
    await assertSelectedFlow(page, 'uses-ai');
    assert.equal(
      (
        await page
          .locator('[data-map-surface="canvas"] > [data-card-id="connectors"]')
          .getAttribute('class')
      )
        ?.split(/\s+/)
        .includes('is-sidecar'),
      true,
    );
  });
});

test(contracts[4], async () => {
  await withMap(async ({ page }) => {
    await selectFlow(page, 'uses-wp');
    await assertSelectedFlow(page, 'uses-wp');
  });
});

test(contracts[5], async () => {
  await withMap(async ({ page }) => {
    await selectFlow(page, 'learns');
    await assertSelectedFlow(page, 'learns');
    assert.equal(
      await page
        .locator('.core-ai-map__learns-explanation')
        .evaluate((element) => (element as HTMLElement).hidden),
      false,
    );
    assert.equal(await page.locator('.core-ai-map__learns-site').isVisible(), true);
    for (const cardId of Object.keys(fixture.layouts.learns.members)) {
      assert.ok(['skills', 'agent', 'task'].includes(cardId));
    }
  });
});

test(contracts[6], async () => {
  await withMap(async ({ page }) => {
    await selectFlow(page, 'tests');
    await assertSelectedFlow(page, 'tests');
    assert.equal(
      await page
        .locator('.core-ai-map__story-flow[data-story-id="tests"] [data-action="open-bench"]')
        .isVisible(),
      true,
    );
  });
});

test(contracts[7], async () => {
  await withMap(async ({ page }) => {
    await selectFlow(page, 'uses-ai');
    await page.locator('[data-action="select-flow"][data-story-id="learns"]').click();
    assert.equal(
      await page
        .locator('[data-action="select-flow"][data-story-id="learns"]')
        .getAttribute('aria-pressed'),
      'true',
    );
    assert.equal(
      await page
        .locator('.core-ai-map__story-flow[data-story-id="learns"] .core-ai-map__takeaway')
        .isVisible(),
      true,
    );
    await page
      .locator('.core-ai-map__story-flow[data-story-id="learns"] [data-action="replay-flow"]')
      .click();
    assert.equal(await page.locator('main').getAttribute('data-map-state'), 'map');
    assert.equal(
      await page
        .locator('[data-action="select-flow"][data-story-id="learns"]')
        .getAttribute('aria-pressed'),
      'true',
    );
    await page.locator('[data-action="reset"]').click();
    assert.equal(await page.locator('main').getAttribute('data-map-state'), 'attract');
    assert.equal(await page.locator('[data-map-screen="attract"]').isVisible(), true);
  });
});

test(contracts[8], async () => {
  await withMap(async ({ page }) => {
    await page.locator('[data-map-screen="attract"] [data-action="browse"]').click();
    assert.equal(await page.locator('[data-map-browse-note]').isVisible(), true);
    assert.equal(await page.locator('[data-action="select-flow"][aria-pressed="true"]').count(), 0);
    assert.equal(
      normalizeText(await page.locator('[data-map-guidance]').textContent()),
      fixture.content.guidance.browse,
    );
    assert.equal(
      normalizeText(await page.locator('[data-map-live]').textContent()),
      fixture.content.announcements.browse,
    );
    for (const cardId of cardIds) {
      const card = page.locator(`[data-map-surface="canvas"] > [data-card-id="${cardId}"]`);
      assert.equal(await card.isVisible(), true, `${cardId} visible in browse`);
      assert.equal(await card.locator('button[data-action="inspect"]').isDisabled(), false);
      const classes = (await card.getAttribute('class'))?.split(/\s+/) ?? [];
      assert.equal(classes.includes('is-active'), false);
      assert.equal(classes.includes('is-dimmed'), false);
    }
  });
});

test(contracts[9], async () => {
  await withMap(async ({ page }) => {
    await page.locator('[data-map-screen="attract"] [data-action="browse"]').click();

    for (const cardId of cardIds) {
      const expected = panelById(cardId);
      const trigger = cardButton(page, cardId);
      await trigger.click();

      assert.equal(await page.locator('main').getAttribute('data-map-state'), 'inspect');
      const panel = page.locator(`[data-map-panel="${cardId}"]`);
      assert.equal(await panel.isVisible(), true, `${cardId} panel visible`);
      assert.equal(normalizeText(await panel.locator('h2').textContent()), expected.title);
      assert.equal(
        normalizeText(await panel.locator('.core-ai-map__details-badge').textContent()),
        expected.badge,
      );
      assert.equal(
        normalizeText(await panel.locator('.core-ai-map__details-lede').textContent()),
        expected.lede,
      );
      assert.equal(
        await panel.locator('.core-ai-map__details-context:not([hidden])').count(),
        0,
        `${cardId} must not invent a browse-mode role`,
      );

      const renderedNotes = new Set(
        (await panel.locator('.core-ai-map__details-note').allTextContents()).map(normalizeText),
      );
      for (const note of expected.notes ?? []) {
        assert.ok(renderedNotes.has(note.text), `${cardId} renders ${note.heading}`);
      }

      const qr = panel.locator(`[data-map-qr-container="${cardId}"]`);
      if (expected.href) {
        assert.equal(await qr.getAttribute('data-qr-url'), expected.href);
        assert.equal(
          await qr.locator('img[data-map-qr]').getAttribute('alt'),
          `QR code for ${expected.title}: ${expected.href}`,
        );
        const link = qr.locator('a.core-ai-map__qr-url');
        assert.equal(await link.getAttribute('href'), expected.href);
        assert.equal(normalizeText(await link.textContent()), expected.linkLabel);
      } else {
        assert.equal(await qr.count(), 0, `${cardId} must not invent QR content`);
      }

      await page.locator('[data-action="close-inspect"]').click();
      await waitForFocus(
        page,
        `[data-map-surface="canvas"] [data-card-id="${cardId}"] button[data-action="inspect"]`,
      );
      assert.equal(await page.locator('main').getAttribute('data-map-state'), 'map');
    }

    for (const expected of fixture.content.panels) {
      for (const [flowName, role] of Object.entries(expected.roles)) {
        const flowId = flowName as FlowId;
        await page.locator(`[data-action="select-flow"][data-story-id="${flowId}"]`).click();
        const trigger = cardButton(page, expected.id);
        assert.equal(await trigger.isDisabled(), false, `${expected.id} participates in ${flowId}`);
        await trigger.click();
        const context = page.locator(
          `[data-map-panel="${expected.id}"] .core-ai-map__details-context[data-story-id="${flowId}"]:not([hidden])`,
        );
        assert.equal(await context.count(), 1);
        assert.deepEqual(
          (await context.locator('.core-ai-map__role dd').allTextContents()).map(normalizeText),
          [role.receives, role.does, role.returns],
        );
        assert.equal(
          normalizeText(await context.locator('.core-ai-map__details-lesson').textContent()),
          role.lesson,
        );
        await page.locator('[data-action="close-inspect"]').click();
        await waitForFocus(
          page,
          `[data-map-surface="canvas"] [data-card-id="${expected.id}"] button[data-action="inspect"]`,
        );
      }
    }
  });
});

test(contracts[10], async () => {
  await withMap(async ({ page }) => {
    await page.locator('[data-map-screen="attract"] [data-action="browse"]').click();
    await cardButton(page, 'abilities').click();
    const tabs = ['overview', 'anatomy', 'permissions'] as const;

    const assertTab = async (selected: (typeof tabs)[number]): Promise<void> => {
      for (const tabId of tabs) {
        const tab = page.locator(`[data-action="select-ability-tab"][data-tab-id="${tabId}"]`);
        assert.equal(await tab.getAttribute('aria-selected'), String(tabId === selected));
        assert.equal(await tab.getAttribute('tabindex'), tabId === selected ? '0' : '-1');
        assert.equal(
          await page.locator(`[data-tab-panel="${tabId}"]`).isVisible(),
          tabId === selected,
        );
      }
    };

    await assertTab('overview');
    await page.locator('[data-tab-id="anatomy"]').click();
    await assertTab('anatomy');
    await page.keyboard.press('ArrowRight');
    await waitForFocus(page, '[data-tab-id="permissions"]');
    await assertTab('permissions');
    await page.keyboard.press('ArrowRight');
    await waitForFocus(page, '[data-tab-id="overview"]');
    await assertTab('overview');
    await page.keyboard.press('ArrowLeft');
    await waitForFocus(page, '[data-tab-id="permissions"]');
    await assertTab('permissions');
    await page.keyboard.press('Home');
    await waitForFocus(page, '[data-tab-id="overview"]');
    await assertTab('overview');
    await page.keyboard.press('End');
    await waitForFocus(page, '[data-tab-id="permissions"]');
    await assertTab('permissions');
  });
});

test(contracts[11], async () => {
  await withMap(async ({ page }) => {
    const trigger = page.locator('[data-action="open-about"]');
    await trigger.click();
    assert.equal(await page.locator('main').getAttribute('data-map-state'), 'about');
    await waitForFocus(page, '[data-action="close-about"]');
    assert.equal(
      normalizeText(await page.locator('[data-map-live]').textContent()),
      'About this exhibit open.',
    );
    await page.locator('[data-action="close-about"]').click();
    await waitForFocus(page, '[data-action="open-about"]');
    assert.equal(await page.locator('main').getAttribute('data-map-state'), 'attract');
    assert.equal(
      normalizeText(await page.locator('[data-map-live]').textContent()),
      'About this exhibit closed.',
    );

    await page.locator('[data-action="start"]').click();
    await trigger.click();
    await waitForFocus(page, '[data-action="close-about"]');
    await page.keyboard.press('Escape');
    await waitForFocus(page, '[data-action="open-about"]');
    assert.equal(await page.locator('main').getAttribute('data-map-state'), 'map');
    assert.match(
      normalizeText(await page.locator('[data-map-live]').textContent()),
      /^About this exhibit closed\./,
    );
  });
});

test(contracts[12], async () => {
  await withMap(async ({ page }) => {
    await selectFlow(page, 'tests');
    const opener = page.locator(
      '.core-ai-map__story-flow[data-story-id="tests"] [data-action="open-bench"]',
    );
    await opener.click();
    assert.equal(await page.locator('main').getAttribute('data-map-state'), 'bench');
    await waitForFocus(page, '[data-action="close-bench"]');

    const stageIds = Object.keys(fixture.bench.stages);
    const assertStage = async (selected: string): Promise<void> => {
      for (const stageId of stageIds) {
        const stage = page.locator(
          `[data-action="select-bench-stage"][data-stage-id="${stageId}"]`,
        );
        assert.equal(await stage.getAttribute('aria-pressed'), String(stageId === selected));
        assert.equal(await stage.getAttribute('tabindex'), stageId === selected ? '0' : '-1');
        const panel = page.locator(`[data-stage-panel="${stageId}"]`);
        assert.equal(await panel.isVisible(), stageId === selected);
        if (stageId === selected) {
          const expected = fixture.bench.stages[stageId];
          assert.equal(normalizeText(await panel.locator('h3').textContent()), expected.title);
          assert.ok(normalizeText(await panel.textContent()).includes(expected.body));
          assert.deepEqual(
            await panel
              .locator('.core-ai-map__bench-facts p')
              .evaluateAll((rows) =>
                rows.map((row) => [
                  row.querySelector('code')?.textContent?.trim() ?? '',
                  row.querySelector('span')?.textContent?.trim() ?? '',
                ]),
              ),
            expected.rows,
          );
        }
      }
    };

    await assertStage('sandbox');
    for (const stageId of stageIds) {
      await page.locator(`[data-stage-id="${stageId}"]`).click();
      await assertStage(stageId);
    }
    await page.locator('[data-stage-id="evidence"]').focus();
    await page.keyboard.press('ArrowRight');
    await waitForFocus(page, '[data-stage-id="task"]');
    await assertStage('task');
    await page.keyboard.press('ArrowLeft');
    await waitForFocus(page, '[data-stage-id="evidence"]');
    await assertStage('evidence');
    await page.keyboard.press('Home');
    await waitForFocus(page, '[data-stage-id="task"]');
    await assertStage('task');
    await page.keyboard.press('End');
    await waitForFocus(page, '[data-stage-id="evidence"]');
    await assertStage('evidence');
    await page.keyboard.press('Escape');
    await waitForFocus(
      page,
      '.core-ai-map__story-flow[data-story-id="tests"] [data-action="open-bench"]',
    );
    assert.equal(await page.locator('main').getAttribute('data-map-state'), 'map');
  });
});

test(contracts[13], async () => {
  await withMap(async ({ page }) => {
    await selectFlow(page, 'uses-ai');
    const workbench = page.locator('.core-ai-map__workbench');
    const suggestion = (index: number) => fixture.content.suggestions[index];
    const assertSuggestion = async (index: number, applied: boolean): Promise<void> => {
      assert.equal(
        normalizeText(await workbench.locator('[data-map-suggestion-label]').textContent()),
        suggestion(index).label,
      );
      assert.equal(
        normalizeText(await workbench.locator('[data-map-suggestion-text]').textContent()),
        suggestion(index).text,
      );
      assert.equal(
        normalizeText(await workbench.locator('[data-map-suggestion-phase]').textContent()),
        applied ? 'Applied' : 'Needs review',
      );
      assert.equal(await workbench.locator('[data-map-suggestion-note]').isVisible(), applied);
      assert.equal(
        (await workbench.getAttribute('class'))?.includes('is-applied') ?? false,
        applied,
      );
    };

    await assertSuggestion(0, false);
    await page
      .locator('.core-ai-map__story-flow[data-story-id="uses-ai"] [data-action="replay-flow"]')
      .click();
    await assertSuggestion(1, false);
    await workbench.locator('[data-action="apply-suggestion"]').click();
    await assertSuggestion(1, true);
    assert.equal(
      normalizeText(await page.locator('[data-map-live]').textContent()),
      'A person chose Apply. The AI Plugin suggestion is now applied.',
    );
    const appliedSnapshot = await workbench.evaluate((element) => ({
      classes: element.className,
      label: element.querySelector('[data-map-suggestion-label]')?.textContent,
      text: element.querySelector('[data-map-suggestion-text]')?.textContent,
      phase: element.querySelector('[data-map-suggestion-phase]')?.textContent,
      notes: element.querySelectorAll('[data-map-suggestion-note]:not([hidden])').length,
    }));
    await workbench.locator('[data-action="apply-suggestion"]').click();
    assert.deepEqual(
      await workbench.evaluate((element) => ({
        classes: element.className,
        label: element.querySelector('[data-map-suggestion-label]')?.textContent,
        text: element.querySelector('[data-map-suggestion-text]')?.textContent,
        phase: element.querySelector('[data-map-suggestion-phase]')?.textContent,
        notes: element.querySelectorAll('[data-map-suggestion-note]:not([hidden])').length,
      })),
      appliedSnapshot,
    );
  });
});

test(contracts[14], async () => {
  await withMap(
    async ({ page }) => {
      const live = page.locator('[data-map-live]');
      const announcement = async (): Promise<string> => normalizeText(await live.textContent());

      await page.locator('[data-action="start"]').click();
      await waitForFocus(
        page,
        '[data-map-surface="canvas"] [data-card-id="plugin"] button[data-action="inspect"]',
      );
      assert.equal(
        await announcement(),
        `${flowById('uses-ai').title}. ${flowById('uses-ai').situation}`,
      );

      await page.locator('[data-action="select-flow"][data-story-id="uses-wp"]').click();
      await waitForFocus(
        page,
        '[data-map-surface="canvas"] [data-card-id="assistant"] button[data-action="inspect"]',
      );
      assert.equal(
        await announcement(),
        `${flowById('uses-wp').title}. ${flowById('uses-wp').situation}`,
      );

      await cardButton(page, 'assistant').click();
      await waitForFocus(page, '[data-action="close-inspect"]');
      assert.equal(
        await announcement(),
        format(
          fixture.content.announcements.detailsInFlow,
          panelById('assistant').title,
          flowById('uses-wp').title,
        ),
      );
      await page.keyboard.press('Escape');
      await waitForFocus(
        page,
        '[data-map-surface="canvas"] [data-card-id="assistant"] button[data-action="inspect"]',
      );
      assert.match(await announcement(), /^Details closed\. Back in AI uses WordPress\./);

      await page
        .locator('.core-ai-map__story-flow[data-story-id="uses-wp"] [data-action="replay-flow"]')
        .click();
      await waitForFocus(
        page,
        '[data-map-surface="canvas"] [data-card-id="assistant"] button[data-action="inspect"]',
      );
      assert.equal(
        await announcement(),
        `${flowById('uses-wp').title} replayed. ${flowById('uses-wp').situation}`,
      );

      await page.locator('.core-ai-map__topbar [data-action="browse"]').click();
      await waitForFocus(
        page,
        '[data-map-surface="canvas"] [data-card-id="assistant"] button[data-action="inspect"]',
      );
      assert.equal(await announcement(), fixture.content.announcements.browse);

      const aboutTrigger = page.locator('[data-action="open-about"]');
      await aboutTrigger.click();
      await waitForFocus(page, '[data-action="close-about"]');
      assert.equal(await announcement(), 'About this exhibit open.');
      await page.locator('[data-action="close-about"]').click();
      await waitForFocus(page, '[data-action="open-about"]');
      assert.equal(await announcement(), 'About this exhibit closed.');

      await page.locator('[data-action="select-flow"][data-story-id="tests"]').click();
      await waitForFocus(
        page,
        '[data-map-surface="canvas"] [data-card-id="agent"] button[data-action="inspect"]',
      );
      const benchTrigger = page.locator(
        '.core-ai-map__story-flow[data-story-id="tests"] [data-action="open-bench"]',
      );
      await benchTrigger.click();
      await waitForFocus(page, '[data-action="close-bench"]');
      assert.equal(await announcement(), 'WP-Bench run loop open. Sandbox selected.');
      await page.locator('[data-action="close-bench"]').click();
      await waitForFocus(
        page,
        '.core-ai-map__story-flow[data-story-id="tests"] [data-action="open-bench"]',
      );
      assert.match(await announcement(), /^WP-Bench run loop closed\. Back on the map\./);

      await page.locator('[data-action="reset"]').click();
      await waitForFocus(page, '[data-map-screen="attract"] [data-action="start"]');
      assert.equal(await announcement(), 'The Living Block Map returned to its welcome screen.');
    },
    { context: { reducedMotion: 'no-preference' } },
  );
});

test(contracts[15], async () => {
  await withMap(async ({ page }) => {
    assert.equal(await page.locator('.core-ai-map__preview-signal.is-live').count(), 0);
    await page.locator('[data-action="start"]').click();
    assert.equal(await page.locator('main').getAttribute('data-map-state'), 'map');
    assert.equal(
      await page
        .locator('.core-ai-map__story-flow[data-story-id="uses-ai"] .core-ai-map__takeaway')
        .isVisible(),
      true,
    );
    assert.equal(await page.locator('.core-ai-map__flow path.is-live').count(), 0);
    assert.equal(await page.locator('.core-ai-map__spark.is-live').count(), 0);
    assert.equal(await page.locator('.core-ai-map__tokens.is-live').count(), 0);
    const motion = await page.evaluate(
      () =>
        document
          .querySelector('[data-living-block-map]')
          ?.getAnimations({ subtree: true })
          .filter((animation) => animation.playState === 'running')
          .map((animation) => ({
            duration: Number(animation.effect?.getComputedTiming().duration ?? 0),
            iterations: animation.effect?.getComputedTiming().iterations ?? 0,
          })) ?? [],
    );
    assert.ok(
      motion.every(({ duration, iterations }) => duration <= 1 && Number.isFinite(iterations)),
      `reduced-motion animations were not skipped: ${JSON.stringify(motion)}`,
    );
    const transitionMilliseconds = await cardButton(page, 'plugin').evaluate((element) => {
      const value = getComputedStyle(element).transitionDuration.split(',')[0] ?? '0s';
      return Number.parseFloat(value) * (value.includes('ms') ? 1 : 1_000);
    });
    assert.ok(transitionMilliseconds <= 1, `reduced transition was ${transitionMilliseconds}ms`);
    await cardButton(page, 'plugin').click();
    assert.equal(await page.locator('main').getAttribute('data-map-state'), 'inspect');
    await waitForFocus(page, '[data-action="close-inspect"]');
  });
});

test(contracts[16], async () => {
  await withMap(
    async ({ page }) => {
      await page.clock.pauseAt(Date.now() + 1_000);
      assert.deepEqual(await wakeStats(page), { requests: 0, releases: 0, held: 0 });
      await page.locator('[data-action="start"]').click();
      await page.clock.runFor(120_000);
      assert.equal(await page.locator('main').getAttribute('data-map-state'), 'map');
      assert.deepEqual(await wakeStats(page), { requests: 0, releases: 0, held: 0 });
    },
    { beforeGoto: installClockAndWakeLock },
  );

  await withMap(
    async ({ page }) => {
      await page.clock.pauseAt(Date.now() + 1_000);
      await page.clock.runFor(0);
      const initialWakeStats = await wakeStats(page);
      assert.equal(initialWakeStats.held, 1);
      assert.equal(initialWakeStats.releases, initialWakeStats.requests - 1);
      assert.equal(await page.locator('main').getAttribute('data-map-state'), 'attract');
      await page.clock.runFor(120_000);
      assert.equal(
        await page.locator('main').getAttribute('data-map-state'),
        'attract',
        'kiosk attract has no inactivity reset timer',
      );

      await page.locator('[data-action="start"]').click();
      await page.clock.runFor(59_999);
      assert.equal(await page.locator('main').getAttribute('data-map-state'), 'map');
      await page.locator('[data-living-block-map]').evaluate((root) => {
        root.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      });
      await page.clock.runFor(59_999);
      assert.equal(await page.locator('main').getAttribute('data-map-state'), 'map');
      await page.clock.runFor(1);
      assert.equal(await page.locator('main').getAttribute('data-map-state'), 'attract');

      await page.locator('[data-action="start"]').click();
      await page.clock.runFor(59_999);
      assert.equal(await page.locator('main').getAttribute('data-map-state'), 'map');
      await page.locator('[data-living-block-map]').evaluate((root) => {
        root.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Shift' }));
      });
      await page.clock.runFor(59_999);
      assert.equal(await page.locator('main').getAttribute('data-map-state'), 'map');
      await page.clock.runFor(1);
      assert.equal(await page.locator('main').getAttribute('data-map-state'), 'attract');

      await page.locator('[data-action="start"]').click();
      await page.locator('[data-action="open-about"]').click();
      await page.clock.runFor(59_999);
      assert.equal(await page.locator('main').getAttribute('data-map-state'), 'about');
      await page.clock.runFor(1);
      assert.equal(await page.locator('main').getAttribute('data-map-state'), 'attract');

      await page.locator('[data-action="start"]').click();
      await cardButton(page, 'plugin').click();
      await page.clock.runFor(89_999);
      assert.equal(await page.locator('main').getAttribute('data-map-state'), 'inspect');
      await page.clock.runFor(1);
      assert.equal(await page.locator('main').getAttribute('data-map-state'), 'attract');

      await page.locator('[data-action="start"]').click();
      await page.locator('[data-action="select-flow"][data-story-id="tests"]').click();
      await page
        .locator('.core-ai-map__story-flow[data-story-id="tests"] [data-action="open-bench"]')
        .click();
      await page.clock.runFor(89_999);
      assert.equal(await page.locator('main').getAttribute('data-map-state'), 'bench');
      await page.clock.runFor(1);
      assert.equal(await page.locator('main').getAttribute('data-map-state'), 'attract');

      await page.locator('[data-action="start"]').click();
      await setMockVisibility(page, 'hidden');
      await page.clock.runFor(120_000);
      assert.equal(
        await page.locator('main').getAttribute('data-map-state'),
        'map',
        'hidden documents do not expire',
      );
      assert.equal((await wakeStats(page)).held, 0);
      await setMockVisibility(page, 'visible');
      await page.clock.runFor(0);
      assert.equal((await wakeStats(page)).held, 1);
      await page.clock.runFor(59_999);
      assert.equal(await page.locator('main').getAttribute('data-map-state'), 'map');
      await page.clock.runFor(1);
      assert.equal(await page.locator('main').getAttribute('data-map-state'), 'attract');
      const finalWakeStats = await wakeStats(page);
      assert.ok(finalWakeStats.requests >= 2);
      assert.ok(finalWakeStats.releases >= 1);
    },
    { query: '?kiosk=1', beforeGoto: installClockAndWakeLock },
  );
});

test(contracts[17], async () => {
  const testPage = await site.newPage({ reducedMotion: 'reduce' });
  await installClockAndWakeLock(testPage);
  const { page } = testPage;
  try {
    const response = await page.goto(`${site.origin}/`, { waitUntil: 'networkidle' });
    assert.equal(response?.status(), 200);
    await page.clock.pauseAt(Date.now() + 1_000);
    await page.evaluate(() => Reflect.set(window, '__mapLifecycleMarker', 'preserved'));
    const homeBody = await bodyAttributes(page);

    for (let visit = 0; visit < 2; visit += 1) {
      const destination = `${site.origin}/living-block-map/?kiosk=1`;
      const teaser = page.locator('.living-map-teaser__link');
      await teaser.evaluate((link, href) => link.setAttribute('href', href), destination);
      await Promise.all([page.waitForURL(destination), teaser.click()]);
      await page.locator('[data-living-block-map]').waitFor();
      await page.clock.runFor(0);

      assert.equal(await page.locator('[data-living-block-map]').count(), 1);
      assert.equal(await page.locator('[data-map-live]').count(), 1);
      assert.equal(
        await page.evaluate(() => Reflect.get(window, '__mapLifecycleMarker')),
        'preserved',
        'Astro navigation preserves the document window',
      );
      assert.equal(
        (await bodyAttributes(page)).className?.split(/\s+/).includes('core-ai-kiosk-active'),
        true,
      );
      const mountedWakeStats = await wakeStats(page);
      assert.equal(mountedWakeStats.held, 1);
      assert.equal(mountedWakeStats.releases, mountedWakeStats.requests - 1);

      await page.locator('[data-action="start"]').click();
      await page
        .locator('.core-ai-map__story-flow[data-story-id="uses-ai"] [data-action="replay-flow"]')
        .click();
      assert.equal(
        normalizeText(await page.locator('[data-map-suggestion-label]').textContent()),
        fixture.content.suggestions[1].label,
        'one replay advances exactly one suggestion',
      );
      assert.equal(await page.locator('[data-action="apply-suggestion"]').count(), 1);

      await page.evaluate((href) => {
        const link = document.createElement('a');
        link.id = 'map-test-home-link';
        link.href = href;
        link.textContent = 'Return to project index';
        Object.assign(link.style, {
          background: 'white',
          left: '0',
          padding: '8px',
          position: 'fixed',
          top: '0',
          zIndex: '1000001',
        });
        document.body.append(link);
      }, `${site.origin}/`);
      await Promise.all([
        page.waitForURL(`${site.origin}/`),
        page.locator('#map-test-home-link').click(),
      ]);
      await page.locator('.living-map-teaser__link').waitFor();

      assert.equal(await page.locator('[data-living-block-map]').count(), 0);
      assert.deepEqual(await bodyAttributes(page), homeBody);
      assert.equal(await page.locator('body').getAttribute('inert'), null);
      assert.equal(await page.locator('body').getAttribute('aria-hidden'), null);
      assert.equal(
        await page.evaluate(() => Reflect.get(window, '__mapLifecycleMarker')),
        'preserved',
      );
      const releasedWakeStats = await wakeStats(page);
      assert.equal(releasedWakeStats.held, 0);
      assert.equal(releasedWakeStats.releases, releasedWakeStats.requests);

      const requestCount = releasedWakeStats.requests;
      await page.clock.runFor(100_000);
      assert.equal(page.url(), `${site.origin}/`);
      assert.deepEqual(await bodyAttributes(page), homeBody);
      assert.equal(
        (await wakeStats(page)).requests,
        requestCount,
        'disposed controller stays quiet',
      );
    }
    assertCleanDiagnostics(testPage.diagnostics);
  } finally {
    await testPage.close();
  }
});

test(contracts[18], async () => {
  const noScriptPage = await site.newPage({ javaScriptEnabled: false, reducedMotion: 'reduce' });
  try {
    const response = await noScriptPage.page.goto(`${site.origin}/living-block-map/`, {
      waitUntil: 'networkidle',
    });
    assert.equal(response?.status(), 200);
    assert.equal(await noScriptPage.page.locator('[data-map-introduction]').isVisible(), true);
    assert.equal(await noScriptPage.page.locator('noscript p').isVisible(), true);
    assert.equal(
      normalizeText(await noScriptPage.page.locator('noscript p').textContent()),
      'The Living Block Map requires JavaScript for its interactive flows.',
    );
    const noScriptHome = noScriptPage.page.locator('noscript a');
    assert.equal(await noScriptHome.isVisible(), true);
    assert.equal(
      new URL((await noScriptHome.getAttribute('href')) ?? '', noScriptPage.page.url()).href,
      `${site.origin}/`,
    );
    assertCleanDiagnostics(noScriptPage.diagnostics);
  } finally {
    await noScriptPage.close();
  }

  await withMap(
    async ({ page, diagnostics }) => {
      assert.equal(await page.locator('[data-map-fallback]').isVisible(), true);
      assert.equal(await page.locator('[data-map-introduction]').isVisible(), true);
      assert.equal(await page.locator('[data-map-introduction] button:not(:disabled)').count(), 0);
      const fallbackLinks = page.locator('[data-map-fallback] a');
      assert.equal(await fallbackLinks.count(), 8);
      assert.equal(await fallbackLinks.first().isVisible(), true);
      assert.equal(
        new URL((await fallbackLinks.first().getAttribute('href')) ?? '', page.url()).href,
        `${site.origin}/`,
      );
      assert.equal(diagnostics.consoleErrors.length, 1);
      assert.match(diagnostics.consoleErrors[0] ?? '', /Living Block Map failed to initialize/);
      assert.match(diagnostics.consoleErrors[0] ?? '', /forced initialization failure/);
      assert.deepEqual(diagnostics.pageErrors, []);
      assert.deepEqual(diagnostics.requestFailures, []);
      assert.deepEqual(diagnostics.badResponses, []);
    },
    {
      beforeGoto: async ({ page }) => {
        await page.addInitScript(() => {
          const original = HTMLElement.prototype.querySelectorAll;
          let forced = false;
          Reflect.set(
            HTMLElement.prototype,
            'querySelectorAll',
            function querySelectorAll(this: HTMLElement, selectors: string) {
              if (!forced && this.hasAttribute('data-living-block-map')) {
                forced = true;
                throw new Error('forced initialization failure');
              }
              return original.call(this, selectors);
            },
          );
        });
      },
    },
    false,
  );
});

test(contracts[19], async () => {
  const requests: string[] = [];
  await withMap(
    async ({ page }) => {
      await page.locator('[data-action="start"]').click();
      await cardButton(page, 'plugin').click();
      await page.locator('[data-action="close-inspect"]').click();
      await page.locator('[data-action="apply-suggestion"]').click();
      await page
        .locator('.core-ai-map__story-flow[data-story-id="uses-ai"] [data-action="replay-flow"]')
        .click();

      await page.locator('[data-action="select-flow"][data-story-id="uses-wp"]').click();
      await cardButton(page, 'abilities').click();
      await page.locator('[data-tab-id="anatomy"]').click();
      await page.locator('[data-action="close-inspect"]').click();

      await page.locator('[data-action="select-flow"][data-story-id="learns"]').click();
      await cardButton(page, 'skills').click();
      await page.locator('[data-action="close-inspect"]').click();

      await page.locator('[data-action="select-flow"][data-story-id="tests"]').click();
      await page
        .locator('.core-ai-map__story-flow[data-story-id="tests"] [data-action="open-bench"]')
        .click();
      for (const stageId of Object.keys(fixture.bench.stages)) {
        await page
          .locator(`[data-action="select-bench-stage"][data-stage-id="${stageId}"]`)
          .click();
      }
      await page.locator('[data-action="close-bench"]').click();

      await page.locator('.core-ai-map__topbar [data-action="browse"]').click();
      await cardButton(page, 'provider').click();
      await page.locator('[data-action="close-inspect"]').click();
      await page.locator('[data-action="open-about"]').click();
      await page.locator('[data-action="close-about"]').click();
      await page.locator('[data-action="reset"]').click();

      assert.ok(requests.length > 10, 'startup loads the native document and local assets');
      const expectedOrigin = new URL(site.origin).origin;
      const forbidden =
        /wcus\.hperkins|core-ai-wcus|wp-admin|wp-content|wp-includes|wp-json|playground|\.wasm(?:$|\?)|@wordpress/i;
      for (const requestUrl of requests) {
        assert.equal(
          new URL(requestUrl).origin,
          expectedOrigin,
          `external runtime request: ${requestUrl}`,
        );
        assert.doesNotMatch(requestUrl, forbidden);
      }
    },
    {
      beforeGoto: async ({ page }) => {
        page.on('request', (request) => requests.push(request.url()));
      },
    },
  );
});

test(contracts[20], async () => {
  const viewports = [
    { width: 1_366, height: 1_024 },
    { width: 1_024, height: 768 },
    { width: 390, height: 844 },
  ] as const;

  for (const viewport of viewports) {
    await withMap(
      async ({ page }) => {
        const geometry = await page.evaluate(() => {
          const root = document.querySelector<HTMLElement>('[data-map-root]');
          const stage = document.querySelector<HTMLElement>('[data-map-stage]');
          const heading = document.querySelector<HTMLElement>('[data-map-introduction] h1');
          if (!root || !stage || !heading) throw new Error('Responsive map shell is incomplete.');
          const stageRect = stage.getBoundingClientRect();
          const headingRect = heading.getBoundingClientRect();
          return {
            scale: Number.parseFloat(getComputedStyle(root).getPropertyValue('--cai-scale')),
            stage: {
              left: stageRect.left,
              top: stageRect.top,
              right: stageRect.right,
              bottom: stageRect.bottom,
              width: stageRect.width,
              height: stageRect.height,
            },
            heading: {
              text: heading.textContent?.replace(/\s+/g, ' ').trim() ?? '',
              width: headingRect.width,
              height: headingRect.height,
            },
            overflow: {
              document: document.documentElement.scrollWidth - window.innerWidth,
              body: document.body.scrollWidth - window.innerWidth,
              root: root.scrollWidth - root.clientWidth,
            },
          };
        });
        const expectedScale = Math.min(viewport.width / 1_366, viewport.height / 1_024);
        assert.ok(Math.abs(geometry.scale - expectedScale) < 0.000_01, 'uniform stage scale');
        assert.ok(Math.abs(geometry.stage.width - 1_366 * expectedScale) < 0.02);
        assert.ok(Math.abs(geometry.stage.height - 1_024 * expectedScale) < 0.02);
        assert.ok(
          Math.abs(geometry.stage.width / geometry.stage.height - 1_366 / 1_024) < 0.000_01,
          'authored aspect ratio',
        );
        assert.ok(geometry.stage.left >= -0.02 && geometry.stage.right <= viewport.width + 0.02);
        assert.ok(geometry.stage.top >= -0.02 && geometry.stage.bottom <= viewport.height + 0.02);
        assert.deepEqual(geometry.overflow, { document: 0, body: 0, root: 0 });
        assert.equal(geometry.heading.text, fixture.content.title);
        assert.ok(geometry.heading.width > 0 && geometry.heading.height >= 14, 'readable heading');

        await page.locator('[data-action="start"]').focus();
        await page.keyboard.press('Enter');
        const firstStep = cardButton(page, 'plugin');
        await waitForFocus(
          page,
          '[data-map-surface="canvas"] [data-card-id="plugin"] button[data-action="inspect"]',
        );
        const focusStyle = await firstStep.evaluate((button) => {
          const rect = button.getBoundingClientRect();
          const style = getComputedStyle(button);
          return {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height,
            outlineStyle: style.outlineStyle,
            outlineWidth: Number.parseFloat(style.outlineWidth),
          };
        });
        assert.ok(focusStyle.width > 0 && focusStyle.height > 0);
        assert.ok(focusStyle.left >= 0 && focusStyle.right <= viewport.width);
        assert.ok(focusStyle.top >= 0 && focusStyle.bottom <= viewport.height);
        assert.notEqual(focusStyle.outlineStyle, 'none');
        assert.ok(focusStyle.outlineWidth >= 3);

        await firstStep.click();
        await waitForFocus(page, '[data-action="close-inspect"]');
        const detail = page.locator('[data-map-panel="plugin"] .core-ai-map__details-lede');
        assert.equal(await detail.isVisible(), true);
        assert.equal(normalizeText(await detail.textContent()), panelById('plugin').lede);
        const closeRect = await page
          .locator('[data-action="close-inspect"]')
          .evaluate((button) => button.getBoundingClientRect().toJSON());
        assert.ok(closeRect.width > 0 && closeRect.height > 0);
        assert.ok(closeRect.left >= 0 && closeRect.right <= viewport.width);
        assert.ok(closeRect.top >= 0 && closeRect.bottom <= viewport.height);
      },
      { context: { viewport } },
    );
  }
});

test(contracts[21], async () => {
  await withMap(async ({ page }) => {
    const contentProjection = await page.evaluate(() => {
      const text = (element: Element | null | undefined): string =>
        element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
      const byId = <Value extends { id: string }>(values: Value[]): Value[] =>
        values.toSorted((left, right) => left.id.localeCompare(right.id));

      const blocks = byId(
        [
          ...document.querySelectorAll<HTMLElement>('.core-ai-map__canvas > .core-ai-map__block'),
        ].map((card) => ({
          id: card.dataset.cardId ?? '',
          name: text(card.querySelector('.core-ai-map__block-name strong')),
          tagline: text(card.querySelector('.core-ai-map__block-name small')),
          badge: text(card.querySelector('.core-ai-map__block-badge')),
        })),
      );
      const actors = byId(
        [
          ...document.querySelectorAll<HTMLElement>('.core-ai-map__canvas > .core-ai-map__actor'),
        ].map((card) => ({
          id: card.dataset.cardId ?? '',
          name: text(card.querySelector('.core-ai-map__actor-body > strong')),
          tagline: text(card.querySelector('.core-ai-map__actor-body > small')),
          badge: text(card.querySelector('.core-ai-map__actor-badge')),
        })),
      );
      const flows = [
        ...document.querySelectorAll<HTMLElement>('[data-action="select-flow"][data-story-id]'),
      ].map((rail) => {
        const id = rail.dataset.storyId ?? '';
        const preview = document.querySelector<HTMLElement>(
          `.core-ai-map__attract-story [data-story-id="${id}"]`,
        );
        const story = document.querySelector<HTMLElement>(
          `.core-ai-map__story-flow[data-story-id="${id}"]`,
        );
        return {
          id,
          title: text(rail.querySelector('.core-ai-map__rail-copy strong')),
          copy: text(preview?.querySelector('em')),
          situation: text(story?.querySelector('.core-ai-map__situation span')),
          takeaway: text(story?.querySelector('.core-ai-map__takeaway span')),
          outcome: text(rail.querySelector('.core-ai-map__rail-outcome')),
        };
      });
      const panels = byId(
        [...document.querySelectorAll<HTMLElement>('[data-map-panel]')].map((panel) => {
          const roles = [
            ...panel.querySelectorAll<HTMLElement>('[data-story-id].core-ai-map__details-context'),
          ]
            .map((context) => ({
              id: context.dataset.storyId ?? '',
              receives: text(context.querySelectorAll('.core-ai-map__role dd')[0]),
              does: text(context.querySelectorAll('.core-ai-map__role dd')[1]),
              returns: text(context.querySelectorAll('.core-ai-map__role dd')[2]),
              lesson: text(context.querySelector('.core-ai-map__details-lesson')),
            }))
            .toSorted((left, right) => left.id.localeCompare(right.id));
          const qr = panel.querySelector<HTMLElement>('[data-map-qr-container]');
          return {
            id: panel.dataset.mapPanel ?? '',
            badge: text(panel.querySelector('.core-ai-map__details-badge')),
            title: text(panel.querySelector('h2')),
            lede: text(panel.querySelector('.core-ai-map__details-lede')),
            roles,
            notes: [...panel.querySelectorAll<HTMLElement>('[data-map-panel-note]')]
              .toSorted(
                (left, right) =>
                  Number(left.dataset.mapPanelNote) - Number(right.dataset.mapPanelNote),
              )
              .map(text),
            headings: [...panel.querySelectorAll<HTMLElement>('.core-ai-map__details-heading')].map(
              text,
            ),
            href: qr?.dataset.qrUrl ?? null,
            linkHref: qr?.querySelector('a')?.getAttribute('href') ?? null,
            linkLabel: text(qr?.querySelector('a')) || null,
            qrAlt: qr?.querySelector('img')?.getAttribute('alt') ?? null,
            qrSrc: qr?.querySelector('img')?.getAttribute('src') ?? null,
          };
        }),
      );
      const roleHeadings = document.querySelectorAll(
        '.core-ai-map__details-context .core-ai-map__details-heading',
      );
      const roleTerms = document.querySelectorAll('.core-ai-map__role dt');
      const firstQr = document.querySelector('.core-ai-map__qr');
      return {
        eyebrow: text(document.querySelector('.core-ai-map__eyebrow')),
        title: text(document.querySelector('[data-map-introduction] h1')),
        intro: [...document.querySelectorAll('.core-ai-map__intro')].map(text),
        blocks,
        actors,
        flows,
        panels,
        labels: {
          railEmptyLabel: text(document.querySelector('.core-ai-map__rail-label')),
          browseLabel: text(document.querySelector('.core-ai-map__attract-browse')),
          browseDescription: text(document.querySelector('[data-map-browse-note] span')),
          takeawayHeading: text(document.querySelector('.core-ai-map__takeaway strong')),
          roleHeading: text(roleHeadings[0]),
          lessonHeading: text(roleHeadings[1]),
          definitionHeading: text(
            document.querySelector('[data-map-panel] > h3.core-ai-map__details-heading'),
          ),
          technicalHeading: text(document.querySelector('.core-ai-map__details-section')),
          exploreHeading: text(firstQr?.previousElementSibling),
          tapCue: text(document.querySelector('.core-ai-map__tap-cue')),
          receivesLabel: text(roleTerms[0]),
          doesLabel: text(roleTerms[1]),
          returnsLabel: text(roleTerms[2]),
        },
      };
    });

    assert.equal(contentProjection.eyebrow, fixture.content.eyebrow);
    assert.equal(contentProjection.title, fixture.content.title);
    assert.deepEqual(contentProjection.intro, fixture.content.intro);
    assert.deepEqual(
      contentProjection.blocks,
      fixture.content.blocks.toSorted((left, right) => left.id.localeCompare(right.id)),
    );
    assert.deepEqual(
      contentProjection.actors,
      fixture.content.actors.toSorted((left, right) => left.id.localeCompare(right.id)),
    );
    assert.deepEqual(contentProjection.flows, fixture.content.flows);
    const { railActiveLabel: _railActiveLabel, ...initialLabels } = fixture.content.labels;
    assert.deepEqual(contentProjection.labels, initialLabels);

    const expectedPanels = fixture.content.panels
      .map((panel) => ({
        id: panel.id,
        badge: panel.badge,
        title: panel.title,
        lede: panel.lede,
        roles: Object.entries(panel.roles)
          .map(([id, role]) => ({
            id,
            receives: role.receives,
            does: role.does,
            returns: role.returns,
            lesson: role.lesson,
          }))
          .toSorted((left, right) => left.id.localeCompare(right.id)),
        notes: (panel.notes ?? []).map(({ text }) => text),
        href: panel.href ?? null,
        linkHref: panel.href ?? null,
        linkLabel: panel.linkLabel ?? null,
        qrAlt: panel.href ? `QR code for ${panel.title}: ${panel.href}` : null,
      }))
      .toSorted((left, right) => left.id.localeCompare(right.id));
    assert.deepEqual(
      contentProjection.panels.map((panel) => ({
        id: panel.id,
        badge: panel.badge,
        title: panel.title,
        lede: panel.lede,
        roles: panel.roles,
        notes: panel.notes,
        href: panel.href,
        linkHref: panel.linkHref,
        linkLabel: panel.linkLabel,
        qrAlt: panel.qrAlt,
      })),
      expectedPanels,
    );
    for (const expected of fixture.content.panels) {
      const rendered = contentProjection.panels.find(({ id }) => id === expected.id);
      assert.ok(rendered);
      for (const note of expected.notes ?? []) {
        assert.ok(rendered.headings.includes(note.heading), `${expected.id}/${note.heading}`);
      }
      if (expected.qr) {
        assert.ok(rendered.qrSrc);
        const qrUrl = new URL(rendered.qrSrc, page.url());
        assert.equal(qrUrl.origin, new URL(site.origin).origin);
        const stem =
          expected.qr
            .split('/')
            .at(-1)
            ?.replace(/\.svg$/, '') ?? '';
        assert.match(qrUrl.pathname, new RegExp(`/${stem}(?:\\.[^/]+)?\\.svg$`));
      } else {
        assert.equal(rendered.qrSrc, null);
      }
    }

    const aboutProjection = await page.locator('[data-map-screen="about"]').evaluate((about) => {
      const text = (element: Element | null | undefined): string =>
        element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
      return {
        badge: text(about.querySelector('.core-ai-map__details-badge')),
        title: text(about.querySelector('h2')),
        backLabel: text(about.querySelector('[data-action="close-about"]')).replace(/^←\s*/, ''),
        disclosures: [...about.querySelectorAll('dl > div')].map((item) => ({
          term: text(item.querySelector('dt')),
          description: text(item.querySelector('dd')),
        })),
        responsibility: text(about.querySelector('.core-ai-map__about-disclosure + p')),
        reviewedDate: text(about.querySelector('.core-ai-map__about-reviewed')),
      };
    });
    assert.deepEqual(aboutProjection, {
      ...fixture.about,
      reviewedDate: fixture.content.reviewedDate,
    });

    const benchProjection = await page.locator('[data-map-screen="bench"]').evaluate((bench) => {
      const text = (element: Element | null | undefined): string =>
        element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
      return [...bench.querySelectorAll<HTMLElement>('[data-action="select-bench-stage"]')].map(
        (button) => {
          const id = button.dataset.stageId ?? '';
          const panel = bench.querySelector<HTMLElement>(`[data-stage-panel="${id}"]`);
          return {
            id,
            number: text(button.querySelector('.core-ai-map__bench-stage-number')),
            badge: text(button.querySelector('small')),
            label: text(button.querySelector('strong')),
            summary: text(button.querySelector('em')),
            flow:
              [...button.querySelectorAll<HTMLElement>('.core-ai-map__bench-stage-flow-step')].map(
                (step) => ({
                  label: text(step),
                  accent: step.classList.contains('is-accent'),
                }),
              ) || undefined,
            kicker: text(panel?.querySelector('.core-ai-map__bench-copy > p:first-child')),
            title: text(panel?.querySelector('h3')),
            body: text(panel?.querySelector('.core-ai-map__bench-copy > p:nth-of-type(2)')),
            note: text(panel?.querySelector('.core-ai-map__bench-copy aside')) || undefined,
            rows: [...(panel?.querySelectorAll('.core-ai-map__bench-facts p') ?? [])].map((row) => [
              text(row.querySelector('code')),
              text(row.querySelector('span')),
            ]),
          };
        },
      );
    });
    assert.deepEqual(
      benchProjection,
      Object.entries(fixture.bench.stages).map(([id, stage]) => ({
        id,
        number: stage.number,
        badge: stage.badge,
        label: stage.label,
        summary: stage.summary,
        flow: (stage.flow ?? []).map((step) => ({
          label: step.label,
          accent: step.accent ?? false,
        })),
        kicker: stage.kicker,
        title: stage.title,
        body: stage.body,
        note: stage.note || undefined,
        rows: stage.rows,
      })),
    );
    assert.deepEqual(
      Object.fromEntries(benchProjection.map(({ id, title }) => [id, title])),
      fixture.bench.titles,
    );

    for (const [index, flow] of fixture.content.flows.entries()) {
      if (index === 0) await selectFlow(page, flow.id);
      else await page.locator(`[data-action="select-flow"][data-story-id="${flow.id}"]`).click();
      await assertSelectedFlow(page, flow.id);
      const paths = await page.evaluate(
        (flowId) => ({
          edges: [
            ...document.querySelectorAll<SVGPathElement>(
              `.core-ai-map__flow [data-story-id="${flowId}"][data-variant="edges"]:not([data-map-hidden])`,
            ),
          ].map((path) => path.getAttribute('d')),
          sidecars: [
            ...document.querySelectorAll<SVGPathElement>(
              `.core-ai-map__config-path[data-story-id="${flowId}"][data-variant="edges"]:not([data-map-hidden])`,
            ),
          ].map((path) => path.getAttribute('d')),
        }),
        flow.id,
      );
      assert.deepEqual(paths.edges, fixture.layouts[flow.id].edges);
      assert.deepEqual(paths.sidecars, fixture.layouts[flow.id].sidecarEdges ?? []);
    }

    await page.locator('[data-action="select-flow"][data-story-id="uses-ai"]').click();
    const renderedSuggestions: { label: string; text: string }[] = [];
    for (let index = 0; index < fixture.content.suggestions.length; index += 1) {
      renderedSuggestions.push({
        label: normalizeText(await page.locator('[data-map-suggestion-label]').textContent()),
        text: normalizeText(await page.locator('[data-map-suggestion-text]').textContent()),
      });
      if (index < fixture.content.suggestions.length - 1) {
        await page
          .locator('.core-ai-map__story-flow[data-story-id="uses-ai"] [data-action="replay-flow"]')
          .click();
      }
    }
    assert.deepEqual(renderedSuggestions, fixture.content.suggestions);

    await page.locator('[data-action="select-flow"][data-story-id="uses-ai"]').click();
    assert.equal(
      normalizeText(await page.locator('.core-ai-map__rail-label').textContent()),
      fixture.content.labels.railActiveLabel,
    );
    assert.equal(
      normalizeText(await page.locator('[data-map-guidance]').textContent()),
      format(
        fixture.content.guidance.flow,
        [
          ...Object.values(fixture.layouts['uses-ai'].members),
          fixture.layouts['uses-ai'].providerPlugin?.step ?? 0,
        ]
          .filter((step) => step > 0)
          .toSorted((left, right) => left - right)
          .filter((step, index, steps) => step !== steps[index - 1])
          .join(' → '),
      ),
    );
    await cardButton(page, 'plugin').click();
    assert.equal(
      normalizeText(await page.locator('[data-map-details-guidance]').textContent()),
      format(fixture.content.guidance.inspect, flowById('uses-ai').title),
    );
    await page.locator('[data-action="close-inspect"]').click();
    await page.locator('.core-ai-map__topbar [data-action="browse"]').click();
    assert.equal(
      normalizeText(await page.locator('[data-map-guidance]').textContent()),
      fixture.content.guidance.browse,
    );
  });
});

test(contracts[22], async () => {
  await withMap(async ({ page }) => {
    await page.waitForFunction(() => 'serviceWorker' in navigator);
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (navigator.serviceWorker.controller) return;
      await new Promise<void>((resolveController) => {
        navigator.serviceWorker.addEventListener('controllerchange', () => resolveController(), {
          once: true,
        });
      });
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(async () => {
      const cache = await caches.open('wcus-core-ai-v4');
      const paths = (await cache.keys()).map(({ url }) => new URL(url).pathname);
      return ['.css', '.js', '.svg', '.woff2'].every((extension) =>
        paths.some((path) => path.endsWith(extension)),
      );
    });

    const cache = await page.evaluate(async () => {
      const names = await caches.keys();
      const entries = await (await caches.open('wcus-core-ai-v4')).keys();
      return {
        names,
        urls: entries.map(({ url }) => url),
        controller: navigator.serviceWorker.controller?.scriptURL ?? null,
      };
    });
    assert.deepEqual(cache.names, ['wcus-core-ai-v4']);
    assert.equal(cache.controller, `${site.origin}/sw.js`);
    for (const route of ['/', '/privacy/', '/living-block-map/']) {
      assert.ok(cache.urls.includes(`${site.origin}${route}`), `cached shell route ${route}`);
    }
    for (const extension of ['.css', '.js', '.svg', '.woff2']) {
      assert.ok(
        cache.urls.some((url) => new URL(url).pathname.endsWith(extension)),
        `cached warm-map ${extension} asset`,
      );
    }
    assert.equal(await page.locator('.core-ai-map__offline, [data-map-offline]').count(), 0);
    assert.doesNotMatch(
      normalizeText(await page.locator('[data-map-root]').textContent()),
      /offline (?:mode|status|ready|available)/i,
    );
    assert.equal(await page.locator('[data-map-screen="attract"]').isVisible(), true);
  });
});
