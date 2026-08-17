import { MAP_MODEL } from './model.ts';
import {
  INITIAL_MAP_STATE,
  animationDuration,
  deriveView,
  inactivityDelay,
  transition,
} from './state.ts';
import type {
  AbilityTabId,
  AttractPreview,
  BenchStageId,
  BoundaryId,
  CardId,
  DerivedMapView,
  FlowId,
  FlowLayout,
  MapEvent,
  MapState,
  Screen,
} from './types.ts';

export interface LivingBlockMapController {
  dispose(): void;
}

export interface ControllerOptions {
  kiosk?: boolean;
  reducedMotion?: boolean;
}

interface AttributeSnapshot {
  readonly name: string;
  readonly value: string | null;
}

const FLOW_SETTLE_DELAY = 2_900;
const ATTRACT_TIMELINE = {
  drawing: 560,
  signalling: 1_000,
  settled: 2_900,
  releasing: 5_200,
  next: 6_500,
  restart: 8_000,
} as const;

const activeControllers = new WeakMap<HTMLElement, LivingBlockMapController>();
const lifecycleInstallations = new WeakMap<Document, () => void>();
const flowIds = new Set<FlowId>(MAP_MODEL.content.flows.map(({ id }) => id));
const cardIds = new Set<CardId>([
  ...MAP_MODEL.content.blocks.map(({ id }) => id),
  ...MAP_MODEL.content.actors.map(({ id }) => id),
  'provider-plugin',
]);
const orderedTabIds = MAP_MODEL.abilityTabs.map(({ id }) => id);
const orderedStageIds = Object.keys(MAP_MODEL.bench.stages) as BenchStageId[];
const tabIds = new Set<AbilityTabId>(orderedTabIds);
const stageIds = new Set<BenchStageId>(orderedStageIds);
const rovingKeys = new Set(['ArrowLeft', 'ArrowRight', 'Home', 'End']);

const captureAttributes = (element: Element, names: readonly string[]): AttributeSnapshot[] =>
  names.map((name) => ({ name, value: element.getAttribute(name) }));

const restoreAttributes = (element: Element, snapshots: readonly AttributeSnapshot[]): void => {
  for (const { name, value } of snapshots) {
    if (value === null) element.removeAttribute(name);
    else element.setAttribute(name, value);
  }
};

const toggleHidden = (element: HTMLElement, hidden: boolean): void => {
  element.hidden = hidden;
  element.inert = hidden;
};

const toggleSvgHidden = (element: Element, hidden: boolean): void => {
  element.toggleAttribute('data-map-hidden', hidden);
};

const asFlowId = (value: string | null): FlowId | null =>
  value && flowIds.has(value as FlowId) ? (value as FlowId) : null;

const asCardId = (value: string | null): CardId | null =>
  value && cardIds.has(value as CardId) ? (value as CardId) : null;

const asTabId = (value: string | null): AbilityTabId | null =>
  value && tabIds.has(value as AbilityTabId) ? (value as AbilityTabId) : null;

const asStageId = (value: string | null): BenchStageId | null =>
  value && stageIds.has(value as BenchStageId) ? (value as BenchStageId) : null;

const selectedLayout = (state: Readonly<MapState>): FlowLayout | undefined =>
  state.flow ? MAP_MODEL.layouts[state.flow] : undefined;

const renderScreens = (
  root: HTMLElement,
  state: Readonly<MapState>,
  view: DerivedMapView,
): void => {
  root.className = view.rootClasses.join(' ');
  root.dataset.mapState = state.screen;

  root.querySelectorAll<HTMLElement>('[data-map-screen]').forEach((screenElement) => {
    const screen = screenElement.getAttribute('data-map-screen') as Screen | null;
    if (!screen || !view.screens[screen]) return;
    toggleHidden(screenElement, view.screens[screen].hidden);
  });

  const persistentHeading = root.querySelector<HTMLElement>('[data-map-persistent-heading]');
  if (persistentHeading) persistentHeading.hidden = state.screen === 'attract';

  const canvas = root.querySelector<HTMLElement>('[data-map-surface="canvas"]');
  if (canvas) {
    const interactive = state.screen === 'map';
    canvas.inert = !interactive;
    canvas.setAttribute('aria-hidden', String(!interactive));
  }

  const guidance = root.querySelector<HTMLElement>('[data-map-guidance]');
  if (guidance) {
    guidance.textContent = view.guidance;
    guidance.hidden = state.screen !== 'map';
  }
  const browse = root.querySelector<HTMLElement>('.core-ai-map__topbar [data-action="browse"]');
  if (browse) browse.hidden = state.screen !== 'map' || !state.flow;
  const reset = root.querySelector<HTMLElement>('.core-ai-map__topbar [data-action="reset"]');
  if (reset) reset.hidden = state.screen !== 'map';
  const about = root.querySelector<HTMLElement>('[data-action="open-about"]');
  if (about) {
    about.hidden =
      state.screen === 'about' || state.screen === 'inspect' || state.screen === 'bench';
    about.setAttribute('aria-expanded', String(state.screen === 'about'));
  }
};

const rovingSelection = <Id extends string>(ids: readonly Id[], current: Id, key: string): Id => {
  const currentIndex = Math.max(ids.indexOf(current), 0);
  let nextIndex = currentIndex;
  if (key === 'Home') nextIndex = 0;
  else if (key === 'End') nextIndex = ids.length - 1;
  else if (key === 'ArrowLeft') nextIndex = (currentIndex - 1 + ids.length) % ids.length;
  else if (key === 'ArrowRight') nextIndex = (currentIndex + 1) % ids.length;
  return ids[nextIndex] ?? current;
};

const renderCards = (root: HTMLElement, state: Readonly<MapState>, view: DerivedMapView): void => {
  const canvas = root.querySelector<HTMLElement>('[data-map-surface="canvas"]');
  const preview: AttractPreview | undefined =
    MAP_MODEL.previews[state.previewIndex % MAP_MODEL.previews.length];
  if (!canvas || !preview) return;

  canvas.querySelectorAll<HTMLElement>(':scope > [data-card-id]').forEach((cardElement) => {
    const cardId = asCardId(cardElement.getAttribute('data-card-id'));
    if (!cardId) return;
    const card = view.cards[cardId];
    const previewSidecar =
      state.screen === 'attract' &&
      state.previewPhase !== 'releasing' &&
      Boolean(preview.sidecars?.includes(cardId));
    const isProviderPlugin = cardId === 'provider-plugin';

    cardElement.classList.toggle('is-active', card.active);
    cardElement.classList.toggle('is-dimmed', card.dimmed);
    cardElement.classList.toggle('is-parked', card.parked);
    cardElement.classList.toggle('is-sidecar', card.sidecar);
    cardElement.classList.toggle('is-preview-member', state.screen === 'attract' && card.active);
    cardElement.classList.toggle('is-preview-sidecar', previewSidecar);
    cardElement.style.transform = card.transform;
    cardElement.hidden = Boolean(
      isProviderPlugin &&
      state.screen === 'attract' &&
      (preview.storyId !== 'uses-ai' || state.previewPhase === 'releasing'),
    );

    const body = cardElement.querySelector<HTMLButtonElement>('button[data-action="inspect"]');
    const step = cardElement.querySelector<HTMLElement>('.core-ai-map__step');
    const tapCue = cardElement.querySelector<HTMLElement>('.core-ai-map__tap-cue');
    if (step) step.textContent = card.step;
    if (tapCue) tapCue.hidden = state.screen !== 'map' || !card.active;
    if (body) {
      body.disabled = state.screen !== 'attract' && card.disabled;
      body.setAttribute('aria-expanded', String(card.inspected));
      body.setAttribute('aria-label', card.accessibleName);
      body.style.opacity = cardElement.classList.contains('core-ai-map__block') ? card.opacity : '';
    }
    cardElement.style.opacity = cardElement.classList.contains('core-ai-map__block')
      ? ''
      : card.opacity;
  });
};

const renderAttractMotion = (
  root: HTMLElement,
  state: Readonly<MapState>,
  reducedMotion: boolean,
): void => {
  const phaseShowsPath =
    reducedMotion || ['drawing', 'signalling', 'settled'].includes(state.previewPhase);
  const phaseShowsText = reducedMotion || ['signalling', 'settled'].includes(state.previewPhase);

  root.querySelectorAll<SVGGElement>('.core-ai-map__preview-flow').forEach((preview) => {
    const previewId = Number(preview.getAttribute('data-preview-id'));
    const selected = state.screen === 'attract' && previewId === state.previewIndex;
    toggleSvgHidden(preview, !selected);
    preview.querySelectorAll<SVGPathElement>('path').forEach((path) => {
      path.classList.toggle('is-live', selected && phaseShowsPath);
    });
    preview.querySelectorAll<SVGCircleElement>('.core-ai-map__preview-signal').forEach((signal) => {
      signal.classList.toggle(
        'is-live',
        selected && state.previewPhase === 'signalling' && !reducedMotion,
      );
    });
  });

  root
    .querySelectorAll<HTMLElement>('.core-ai-map__attract-story [data-preview-id]')
    .forEach((story) => {
      const selected =
        state.screen === 'attract' &&
        Number(story.getAttribute('data-preview-id')) === state.previewIndex;
      story.hidden = !selected;
      story.classList.toggle('is-visible', selected && phaseShowsText);
    });
};

const renderFlowGeometry = (
  root: HTMLElement,
  state: Readonly<MapState>,
  reducedMotion: boolean,
): void => {
  const layout = selectedLayout(state);
  const flowVisible = state.screen === 'map' || state.screen === 'inspect';
  const activeVariant = 'edges';

  root
    .querySelectorAll<SVGElement>(
      '.core-ai-map__flow [data-story-id][data-variant], .core-ai-map__config-path[data-story-id][data-variant]',
    )
    .forEach((path) => {
      const selected =
        flowVisible &&
        path.getAttribute('data-story-id') === state.flow &&
        path.getAttribute('data-variant') === activeVariant;
      toggleSvgHidden(path, !selected);
      path.classList.toggle('is-visible', selected);
      path.classList.toggle(
        'is-live',
        selected && state.flowPhase === 'assembling' && !reducedMotion,
      );
    });

  root.querySelectorAll<HTMLElement>('.core-ai-map__spark').forEach((spark) => {
    const selected =
      state.screen === 'map' &&
      spark.getAttribute('data-story-id') === state.flow &&
      spark.getAttribute('data-variant') === activeVariant &&
      !layout?.tokens &&
      state.flowPhase === 'assembling' &&
      !reducedMotion;
    spark.hidden = !selected;
    spark.classList.toggle('is-live', selected);
  });

  root.querySelectorAll<SVGPathElement>('[data-map-boundary]').forEach((boundary) => {
    boundary.classList.toggle(
      'is-lit',
      Boolean(layout?.crosses.includes(boundary.getAttribute('data-map-boundary') as BoundaryId)),
    );
  });
  root
    .querySelector<HTMLElement>('.core-ai-map__hairlines')
    ?.classList.toggle('is-hidden', state.screen === 'attract' || Boolean(layout));
  root
    .querySelector<HTMLElement>('.core-ai-map__zone--outside')
    ?.classList.toggle('is-lit', layout?.zone === 'outside');

  const shelf = root.querySelector<HTMLElement>('.core-ai-map__shelf-label');
  if (shelf) {
    shelf.hidden = !layout;
    shelf.style.top = `${layout ? layout.shelfY - 22 : 490}px`;
    shelf.style.left = `${layout ? (MAP_MODEL.shelfX[layout.shelfStart ?? 0] ?? 250) : 250}px`;
  }

  root.querySelectorAll<HTMLElement>('[data-strip-id]').forEach((anchor) => {
    const cardId = asCardId(anchor.getAttribute('data-strip-id'));
    if (!cardId || cardId === 'provider-plugin') return;
    const strip = anchor.querySelector<HTMLElement>('.core-ai-map__strip');
    if (!strip) return;
    anchor.style.transform = viewCardTransform(state, cardId);
    const step = layout?.members[cardId] ?? 0;
    const live =
      (state.screen === 'inspect' && state.inspectedCard === cardId) ||
      (state.screen === 'map' && step > 0 && !layout?.noStrip?.includes(cardId));
    strip.hidden = !live;
    strip.classList.toggle('is-live', live);
    strip.style.top = `${layout?.strips?.[cardId]?.[1] ?? 158}px`;
  });

  const tokens = root.querySelector<HTMLElement>('.core-ai-map__tokens');
  if (tokens) {
    const visible = Boolean(layout?.tokens && state.screen === 'map');
    tokens.classList.toggle(
      'is-live',
      visible && state.flowPhase === 'assembling' && !reducedMotion,
    );
    tokens.classList.toggle('is-visible', visible);
  }
  const learns = root.querySelector<HTMLElement>('.core-ai-map__learns-explanation');
  if (learns) learns.hidden = state.screen !== 'map' || state.flow !== 'learns';
};

const viewCardTransform = (state: Readonly<MapState>, cardId: CardId): string =>
  deriveView(state, MAP_MODEL).cards[cardId].transform;

const renderStoryControls = (root: HTMLElement, state: Readonly<MapState>): void => {
  const layout = selectedLayout(state);
  const browseNote = root.querySelector<HTMLElement>('[data-map-browse-note]');
  if (browseNote) browseNote.hidden = Boolean(state.flow);

  root.querySelectorAll<HTMLElement>('.core-ai-map__story-flow[data-story-id]').forEach((story) => {
    const selected = state.flow === story.getAttribute('data-story-id');
    story.hidden = !selected;
    story.querySelectorAll<HTMLElement>('.core-ai-map__takeaway').forEach((takeaway) => {
      takeaway.hidden = !selected || state.flowPhase !== 'settled';
    });
  });
  const railLabel = root.querySelector<HTMLElement>('.core-ai-map__rail-label');
  if (railLabel) {
    railLabel.textContent = layout
      ? MAP_MODEL.content.labels.railActiveLabel
      : MAP_MODEL.content.labels.railEmptyLabel;
  }
  root.querySelectorAll<HTMLButtonElement>('[data-action="select-flow"]').forEach((button) => {
    const selected = state.flow === button.getAttribute('data-story-id');
    button.classList.toggle('is-active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
};

const renderDetails = (
  root: HTMLElement,
  state: Readonly<MapState>,
  view: DerivedMapView,
): void => {
  const activeFlow = state.flow
    ? MAP_MODEL.content.flows.find(({ id }) => id === state.flow)
    : undefined;
  const guidance = root.querySelector<HTMLElement>('[data-map-details-guidance]');
  if (guidance) {
    guidance.hidden = !activeFlow;
    guidance.textContent = activeFlow
      ? MAP_MODEL.content.guidance.inspect.replace('%1$s', activeFlow.title)
      : '';
  }
  const backLabel = root.querySelector<HTMLElement>('[data-map-details-back]');
  if (backLabel)
    backLabel.textContent = activeFlow ? `Back to ${activeFlow.title}` : 'Back to the map';

  root.querySelectorAll<HTMLElement>('[data-map-panel]').forEach((panel) => {
    const selected =
      state.screen === 'inspect' && panel.getAttribute('data-map-panel') === state.inspectedCard;
    toggleHidden(panel, !selected);
    panel
      .querySelectorAll<HTMLElement>('.core-ai-map__details-context[data-story-id]')
      .forEach((context) => {
        context.hidden = !activeFlow || context.getAttribute('data-story-id') !== activeFlow.id;
      });
  });

  root.querySelectorAll<HTMLButtonElement>('[data-action="select-ability-tab"]').forEach((tab) => {
    const tabId = asTabId(tab.getAttribute('data-tab-id'));
    if (!tabId) return;
    const tabView = view.abilityTabs[tabId];
    tab.classList.toggle('is-active', tabView.selected);
    tab.setAttribute('aria-selected', String(tabView.selected));
    tab.tabIndex = tabView.tabIndex;
  });
  root.querySelectorAll<HTMLElement>('[data-tab-panel]').forEach((panel) => {
    const selected = panel.getAttribute('data-tab-panel') === state.abilityTab;
    toggleHidden(panel, !selected);
  });
};

const renderBench = (
  root: HTMLElement,
  state: Readonly<MapState>,
  view: DerivedMapView,
  reducedMotion: boolean,
): void => {
  root
    .querySelectorAll<HTMLButtonElement>('[data-action="select-bench-stage"]')
    .forEach((stage) => {
      const stageId = asStageId(stage.getAttribute('data-stage-id'));
      if (!stageId) return;
      const stageView = view.benchStages[stageId];
      stage.classList.toggle('is-active', stageView.selected);
      stage.setAttribute('aria-pressed', String(stageView.selected));
      stage.tabIndex = stageView.tabIndex;
    });
  root.querySelectorAll<HTMLElement>('[data-stage-panel]').forEach((panel) => {
    toggleHidden(panel, panel.getAttribute('data-stage-panel') !== state.benchStage);
  });
  const flow = root.querySelector<SVGGElement>('[data-map-bench-flow]');
  if (flow) {
    flow.classList.toggle('is-visible', state.screen === 'bench');
    flow.classList.toggle(
      'is-live',
      state.screen === 'bench' && state.flowPhase === 'assembling' && !reducedMotion,
    );
  }
};

const renderSuggestion = (root: HTMLElement, state: Readonly<MapState>): void => {
  const suggestion =
    MAP_MODEL.content.suggestions[state.suggestionIndex % MAP_MODEL.content.suggestions.length];
  const workbench = root.querySelector<HTMLElement>('.core-ai-map__workbench');
  if (!workbench || !suggestion) return;
  workbench.classList.toggle('is-applied', state.suggestionApplied);
  const label = workbench.querySelector<HTMLElement>('[data-map-suggestion-label]');
  const text = workbench.querySelector<HTMLElement>('[data-map-suggestion-text]');
  const phase = workbench.querySelector<HTMLElement>('[data-map-suggestion-phase]');
  const note = workbench.querySelector<HTMLElement>('[data-map-suggestion-note]');
  if (label) label.textContent = suggestion.label;
  if (text) text.textContent = suggestion.text;
  if (phase) phase.textContent = state.suggestionApplied ? 'Applied' : 'Needs review';
  if (note) note.hidden = !state.suggestionApplied;
};

const render = (
  root: HTMLElement,
  state: Readonly<MapState>,
  view: DerivedMapView,
  reducedMotion: boolean,
): void => {
  renderScreens(root, state, view);
  renderCards(root, state, view);
  renderAttractMotion(root, state, reducedMotion);
  renderFlowGeometry(root, state, reducedMotion);
  renderStoryControls(root, state);
  renderDetails(root, state, view);
  renderBench(root, state, view, reducedMotion);
  renderSuggestion(root, state);
  const liveRegion = root.querySelector<HTMLElement>('[data-map-live]');
  if (liveRegion) liveRegion.textContent = view.announcement;
};

export function initializeLivingBlockMap(
  root: HTMLElement,
  options: ControllerOptions = {},
): LivingBlockMapController {
  activeControllers.get(root)?.dispose();

  const mapDocument = root.ownerDocument;
  const viewWindow = mapDocument.defaultView;
  if (!viewWindow) throw new Error('Living Block Map requires a browser window.');
  const kiosk =
    new URL(viewWindow.location.href).searchParams.get('kiosk') === '1' && options.kiosk !== false;
  const reducedMotion =
    options.reducedMotion ??
    viewWindow.matchMedia?.('(prefers-reduced-motion: reduce)').matches ??
    false;
  const abortController = new AbortController();
  const timers = new Set<number>();
  const rootAttributes = captureAttributes(root, ['class', 'style', 'data-map-state']);
  const bodyAttributes = captureAttributes(mapDocument.body, ['class', 'style']);
  const initialScroll = { x: viewWindow.scrollX, y: viewWindow.scrollY };
  let state: MapState = { ...INITIAL_MAP_STATE };
  let disposed = false;
  let documentStateRestored = false;
  let pendingFocusTimer: number | null = null;
  let inactivityTimer: number | null = null;
  let wakeLock: WakeLockSentinel | null = null;
  let wakeLockRequest: Promise<void> | null = null;
  let lastCardTrigger: HTMLElement | null = null;
  let lastAboutTrigger: HTMLElement | null = null;
  let lastBenchTrigger: HTMLElement | null = null;

  const clearTimers = (): void => {
    timers.forEach((timer) => viewWindow.clearTimeout(timer));
    timers.clear();
    pendingFocusTimer = null;
    inactivityTimer = null;
  };
  const cancelTimer = (timer: number | null): void => {
    if (timer === null) return;
    viewWindow.clearTimeout(timer);
    timers.delete(timer);
  };
  const setTimer = (callback: () => void, delay: number): number => {
    const timer = viewWindow.setTimeout(() => {
      timers.delete(timer);
      callback();
    }, delay);
    timers.add(timer);
    return timer;
  };
  const restoreDocumentState = (): void => {
    if (documentStateRestored) return;
    documentStateRestored = true;
    restoreAttributes(root, rootAttributes);
    if (!kiosk) return;
    restoreAttributes(mapDocument.body, bodyAttributes);
    viewWindow.scrollTo(initialScroll.x, initialScroll.y);
  };
  const applyDocumentState = (): void => {
    if (!kiosk) return;
    const body = mapDocument.body;
    body.classList.add('core-ai-kiosk-active');
    body.style.setProperty('overflow', 'hidden');
    body.style.setProperty('position', 'fixed');
    body.style.setProperty('width', '100%');
    body.style.setProperty('top', `${-initialScroll.y}px`);
  };
  const releaseWakeLock = (): void => {
    const heldLock = wakeLock;
    wakeLock = null;
    if (heldLock) void heldLock.release().catch(() => undefined);
  };
  const requestWakeLock = (): void => {
    if (
      !kiosk ||
      disposed ||
      mapDocument.visibilityState !== 'visible' ||
      wakeLock ||
      wakeLockRequest
    ) {
      return;
    }
    const manager = viewWindow.navigator.wakeLock;
    if (!manager) return;
    wakeLockRequest = manager
      .request('screen')
      .then(async (requestedLock) => {
        wakeLockRequest = null;
        if (disposed || mapDocument.visibilityState !== 'visible') {
          await requestedLock.release();
          return;
        }
        wakeLock = requestedLock;
        requestedLock.addEventListener?.(
          'release',
          () => {
            if (wakeLock === requestedLock) wakeLock = null;
          },
          { once: true },
        );
      })
      .catch(() => {
        wakeLockRequest = null;
      });
  };
  const performFocus = (element: HTMLElement | null): void => {
    if (!disposed && element?.isConnected) element.focus({ preventScroll: true });
  };
  const focusElement = (element: HTMLElement | null, delay = 80): void => {
    if (pendingFocusTimer !== null) {
      viewWindow.clearTimeout(pendingFocusTimer);
      timers.delete(pendingFocusTimer);
    }
    pendingFocusTimer = setTimer(
      () => {
        pendingFocusTimer = null;
        performFocus(element);
      },
      animationDuration(delay, reducedMotion),
    );
  };
  const focusFirstStep = (): void => {
    if (pendingFocusTimer !== null) {
      viewWindow.clearTimeout(pendingFocusTimer);
      timers.delete(pendingFocusTimer);
    }
    pendingFocusTimer = setTimer(
      () => {
        pendingFocusTimer = null;
        const cards = [
          ...root.querySelectorAll<HTMLButtonElement>(
            '[data-map-surface="canvas"] button[data-action="inspect"]:not(:disabled)',
          ),
        ];
        const firstStep = cards.find(
          (card) => card.querySelector('.core-ai-map__step')?.textContent?.trim() === '1',
        );
        performFocus(firstStep ?? cards[0] ?? null);
      },
      animationDuration(80, reducedMotion),
    );
  };
  const restoreFocus = (element: HTMLElement | null): void => focusElement(element);
  const dispatch = (event: MapEvent): void => {
    state = transition(state, event);
    render(root, state, deriveView(state, MAP_MODEL), reducedMotion);
    scheduleInactivity();
  };
  const scheduleInactivity = (): void => {
    cancelTimer(inactivityTimer);
    inactivityTimer = null;
    if (!kiosk || mapDocument.visibilityState !== 'visible') return;
    const delay = inactivityDelay(state, true);
    if (delay === null) return;
    inactivityTimer = setTimer(() => {
      inactivityTimer = null;
      if (disposed || mapDocument.visibilityState !== 'visible') return;
      dispatch({ type: 'reset', reason: 'inactivity' });
      scheduleAttract();
      focusElement(
        root.querySelector<HTMLElement>('[data-map-screen="attract"] [data-action="start"]'),
      );
    }, delay);
  };
  const settleFlow = (): void => {
    const delay = animationDuration(2_900, reducedMotion);
    if (delay === 0) {
      dispatch({ type: 'settle-flow' });
      return;
    }
    setTimer(() => dispatch({ type: 'settle-flow' }), FLOW_SETTLE_DELAY);
  };
  const scheduleAttract = (): void => {
    clearTimers();
    dispatch({
      type: 'set-preview-phase',
      phase: reducedMotion ? 'settled' : 'assembling',
    });
    if (!reducedMotion) {
      setTimer(
        () => dispatch({ type: 'set-preview-phase', phase: 'drawing' }),
        ATTRACT_TIMELINE.drawing,
      );
      setTimer(
        () => dispatch({ type: 'set-preview-phase', phase: 'signalling' }),
        ATTRACT_TIMELINE.signalling,
      );
      setTimer(
        () => dispatch({ type: 'set-preview-phase', phase: 'settled' }),
        ATTRACT_TIMELINE.settled,
      );
      setTimer(
        () => dispatch({ type: 'set-preview-phase', phase: 'releasing' }),
        ATTRACT_TIMELINE.releasing,
      );
    }
    setTimer(() => {
      if (state.screen !== 'attract') return;
      dispatch({ type: 'advance-preview' });
      if (reducedMotion) dispatch({ type: 'set-preview-phase', phase: 'settled' });
    }, ATTRACT_TIMELINE.next);
    setTimer(() => {
      if (state.screen === 'attract') scheduleAttract();
    }, ATTRACT_TIMELINE.restart);
  };
  const selectFlow = (event: MapEvent): void => {
    clearTimers();
    dispatch(event);
    settleFlow();
  };
  const openInspect = (trigger: HTMLElement, card: CardId): void => {
    lastCardTrigger = trigger;
    dispatch({ type: 'inspect', card });
    focusElement(root.querySelector<HTMLElement>('.core-ai-map__details-close'));
  };
  const closeInspect = (): void => {
    const trigger = lastCardTrigger;
    dispatch({ type: 'close-inspect' });
    lastCardTrigger = null;
    restoreFocus(trigger);
  };
  const openAbout = (trigger: HTMLElement): void => {
    lastAboutTrigger = trigger;
    dispatch({ type: 'open-about' });
    focusElement(root.querySelector<HTMLElement>('.core-ai-map__about-close'));
  };
  const closeAbout = (): void => {
    const trigger = lastAboutTrigger;
    dispatch({ type: 'close-about' });
    lastAboutTrigger = null;
    restoreFocus(trigger);
  };
  const openBench = (trigger: HTMLElement): void => {
    lastBenchTrigger = trigger;
    selectFlow({ type: 'open-bench' });
    focusElement(
      root.querySelector<HTMLElement>('.core-ai-map__bench-heading [data-action="close-bench"]'),
    );
  };
  const closeBench = (): void => {
    const trigger = lastBenchTrigger;
    clearTimers();
    dispatch({ type: 'close-bench' });
    lastBenchTrigger = null;
    restoreFocus(trigger);
  };
  const scaleStage = (): void => {
    const widthScale = root.clientWidth / 1_366;
    const heightScale = root.clientHeight / 1_024;
    const scale = Math.min(widthScale, heightScale);
    if (Number.isFinite(scale) && scale > 0) {
      root.style.setProperty('--cai-scale', String(scale));
    }
  };

  const handleClick = (event: MouseEvent): void => {
    if (!(event.target instanceof viewWindow.Element)) return;
    const actionElement = event.target.closest<HTMLElement>('[data-action]');
    if (!actionElement || !root.contains(actionElement)) return;

    switch (actionElement.getAttribute('data-action')) {
      case 'start':
        selectFlow({ type: 'start' });
        focusFirstStep();
        break;
      case 'browse':
        clearTimers();
        dispatch({ type: 'browse' });
        focusFirstStep();
        break;
      case 'select-flow': {
        const flow = asFlowId(actionElement.getAttribute('data-story-id'));
        if (flow) {
          selectFlow({ type: 'select-flow', flow });
          focusFirstStep();
        }
        break;
      }
      case 'inspect': {
        const card = asCardId(
          actionElement.closest('[data-card-id]')?.getAttribute('data-card-id') ?? null,
        );
        if (card && !deriveView(state, MAP_MODEL).cards[card].disabled) {
          openInspect(actionElement, card);
        }
        break;
      }
      case 'close-inspect':
        closeInspect();
        break;
      case 'replay-flow':
        if (state.flow) {
          selectFlow({ type: 'replay-flow' });
          focusFirstStep();
        }
        break;
      case 'reset':
        clearTimers();
        dispatch({ type: 'reset', reason: 'visitor' });
        scheduleAttract();
        focusElement(
          root.querySelector<HTMLElement>('[data-map-screen="attract"] [data-action="start"]'),
        );
        break;
      case 'open-about':
        openAbout(actionElement);
        break;
      case 'close-about':
        closeAbout();
        break;
      case 'select-ability-tab': {
        const tab = asTabId(actionElement.getAttribute('data-tab-id'));
        if (tab) dispatch({ type: 'select-ability-tab', tab });
        break;
      }
      case 'open-bench':
        openBench(actionElement);
        break;
      case 'close-bench':
        closeBench();
        break;
      case 'select-bench-stage': {
        const stage = asStageId(actionElement.getAttribute('data-stage-id'));
        if (stage) dispatch({ type: 'select-bench-stage', stage });
        break;
      }
      case 'apply-suggestion':
        dispatch({ type: 'apply-suggestion' });
        break;
    }
  };

  const handleKeydown = (event: KeyboardEvent): void => {
    scheduleInactivity();
    if (event.key === 'Escape') {
      if (state.screen === 'inspect') closeInspect();
      else if (state.screen === 'about') closeAbout();
      else if (state.screen === 'bench') closeBench();
      else return;
      event.preventDefault();
      return;
    }
    if (!rovingKeys.has(event.key) || !(event.target instanceof viewWindow.Element)) return;

    const abilityTab = event.target.closest<HTMLElement>('[data-action="select-ability-tab"]');
    if (abilityTab && root.contains(abilityTab)) {
      const current = asTabId(abilityTab.getAttribute('data-tab-id'));
      if (!current) return;
      const tab = rovingSelection(orderedTabIds, current, event.key);
      event.preventDefault();
      dispatch({ type: 'select-ability-tab', tab });
      focusElement(
        root.querySelector<HTMLElement>(`[data-action="select-ability-tab"][data-tab-id="${tab}"]`),
        0,
      );
      return;
    }

    const benchStage = event.target.closest<HTMLElement>('[data-action="select-bench-stage"]');
    if (!benchStage || !root.contains(benchStage)) return;
    const current = asStageId(benchStage.getAttribute('data-stage-id'));
    if (!current) return;
    const stage = rovingSelection(orderedStageIds, current, event.key);
    event.preventDefault();
    dispatch({ type: 'select-bench-stage', stage });
    focusElement(
      root.querySelector<HTMLElement>(
        `[data-action="select-bench-stage"][data-stage-id="${stage}"]`,
      ),
      0,
    );
  };

  const handleVisibilityChange = (): void => {
    if (mapDocument.visibilityState !== 'visible') {
      cancelTimer(inactivityTimer);
      inactivityTimer = null;
      releaseWakeLock();
      return;
    }
    scheduleInactivity();
    requestWakeLock();
  };

  const controller: LivingBlockMapController = {
    dispose(): void {
      if (disposed) return;
      disposed = true;
      abortController.abort();
      clearTimers();
      releaseWakeLock();
      restoreDocumentState();
      if (activeControllers.get(root) === controller) activeControllers.delete(root);
    },
  };
  try {
    applyDocumentState();
    root.addEventListener('click', handleClick, { signal: abortController.signal });
    root.addEventListener('keydown', handleKeydown, { signal: abortController.signal });
    root.addEventListener('pointerdown', scheduleInactivity, { signal: abortController.signal });
    viewWindow.addEventListener('resize', scaleStage, { signal: abortController.signal });
    viewWindow.addEventListener('orientationchange', scaleStage, {
      signal: abortController.signal,
    });
    mapDocument.addEventListener('visibilitychange', handleVisibilityChange, {
      signal: abortController.signal,
    });
    activeControllers.set(root, controller);
    scaleStage();
    render(root, state, deriveView(state, MAP_MODEL), reducedMotion);
    scheduleAttract();
    scheduleInactivity();
    requestWakeLock();
    return controller;
  } catch (error) {
    controller.dispose();
    throw error;
  }
}

const revealInitializationFallback = (root: HTMLElement, error: unknown): void => {
  const fallback = root.querySelector<HTMLElement>('[data-map-fallback]');
  if (fallback) toggleHidden(fallback, false);

  const introduction = root.querySelector<HTMLElement>('[data-map-introduction]');
  if (introduction) {
    toggleHidden(introduction, false);
    introduction.removeAttribute('aria-hidden');
  }
  const canvas = root.querySelector<HTMLElement>('[data-map-surface="canvas"]');
  if (canvas) {
    canvas.inert = true;
    canvas.setAttribute('aria-hidden', 'true');
  }
  root.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((control) => {
    control.disabled = true;
  });
  root.ownerDocument.defaultView?.console.error('Living Block Map failed to initialize.', error);
};

export function installLivingBlockMapLifecycle(doc: Document = document): () => void {
  const existing = lifecycleInstallations.get(doc);
  if (existing) return existing;

  let active: LivingBlockMapController | null = null;
  let uninstalled = false;
  const disposeActive = (): void => {
    active?.dispose();
    active = null;
  };
  const mount = (): void => {
    disposeActive();
    const root = doc.querySelector<HTMLElement>('[data-living-block-map]');
    if (!root) return;
    try {
      active = initializeLivingBlockMap(root);
    } catch (error) {
      active = null;
      revealInitializationFallback(root, error);
    }
  };
  const beforeSwap = (): void => disposeActive();
  const uninstall = (): void => {
    if (uninstalled) return;
    uninstalled = true;
    disposeActive();
    doc.removeEventListener('astro:page-load', mount);
    doc.removeEventListener('astro:before-swap', beforeSwap);
    lifecycleInstallations.delete(doc);
  };

  doc.addEventListener('astro:page-load', mount);
  doc.addEventListener('astro:before-swap', beforeSwap);
  lifecycleInstallations.set(doc, uninstall);
  if (doc.readyState !== 'loading') mount();
  return uninstall;
}
