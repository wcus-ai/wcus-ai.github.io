import { MAP_MODEL } from './model.ts';
import type {
  AbilityTabId,
  BenchStageId,
  CardId,
  DerivedCardView,
  DerivedMapView,
  FlowId,
  FlowLayout,
  MapEvent,
  MapModel,
  MapState,
  Screen,
} from './types.ts';

export const INITIAL_MAP_STATE: Readonly<MapState> = Object.freeze({
  screen: 'attract',
  flow: null,
  inspectedCard: null,
  abilityTab: 'overview',
  benchStage: 'sandbox',
  aboutReturnScreen: null,
  flowPhase: 'settled',
  pendingTakeawayFlow: null,
  previewIndex: 0,
  previewPhase: 'assembling',
  suggestionIndex: 0,
  suggestionApplied: false,
  announcement: 'Core AI Living Block Map ready. Choose a flow to begin, or open the first flow.',
});

const format = (template: string, ...values: string[]): string =>
  template.replace(
    /%([1-9])\$s/g,
    (_match, position: string) => values[Number(position) - 1] ?? '',
  );

const flowById = (flowId: FlowId, model: MapModel = MAP_MODEL) =>
  model.content.flows.find(({ id }) => id === flowId);

const flowSelectionAnnouncement = (
  flowId: FlowId,
  replayed: boolean,
  model: MapModel = MAP_MODEL,
): string => {
  const flow = flowById(flowId, model);
  if (!flow) return '';
  const title = format(
    replayed ? model.content.announcements.flowReplayed : model.content.announcements.flowSelected,
    flow.title,
  );
  return [title, flow.situation].filter(Boolean).join(' ');
};

const takeawayAnnouncement = (flowId: FlowId, model: MapModel = MAP_MODEL): string => {
  const flow = flowById(flowId, model);
  return flow
    ? format(
        model.content.announcements.takeaway,
        model.content.labels.takeawayHeading,
        flow.takeaway,
      )
    : '';
};

const withPendingTakeaway = (
  state: Readonly<MapState>,
  prefix: string,
): Pick<MapState, 'announcement' | 'pendingTakeawayFlow'> => ({
  announcement: [
    prefix,
    state.pendingTakeawayFlow ? takeawayAnnouncement(state.pendingTakeawayFlow) : '',
  ]
    .filter(Boolean)
    .join(' '),
  pendingTakeawayFlow: null,
});

const selectFlow = (state: Readonly<MapState>, flow: FlowId): MapState => ({
  ...state,
  screen: 'map',
  flow,
  inspectedCard: null,
  aboutReturnScreen: null,
  flowPhase: 'assembling',
  pendingTakeawayFlow: null,
  suggestionApplied: false,
  announcement: flowSelectionAnnouncement(flow, false),
});

export function transition(state: Readonly<MapState>, event: MapEvent): MapState {
  switch (event.type) {
    case 'start':
      return selectFlow(state, 'uses-ai');
    case 'browse':
      return {
        ...state,
        screen: 'map',
        flow: null,
        inspectedCard: null,
        aboutReturnScreen: null,
        flowPhase: 'settled',
        pendingTakeawayFlow: null,
        announcement: MAP_MODEL.content.announcements.browse,
      };
    case 'select-flow':
      return selectFlow(state, event.flow);
    case 'settle-flow':
      if (!state.flow) return { ...state, flowPhase: 'settled' };
      return {
        ...state,
        flowPhase: 'settled',
        announcement:
          state.screen === 'map' ? takeawayAnnouncement(state.flow) : state.announcement,
        pendingTakeawayFlow: state.screen === 'map' ? null : state.flow,
      };
    case 'inspect': {
      const name = cardTitle(event.card, MAP_MODEL);
      const flowTitle = state.flow ? flowById(state.flow)?.title : '';
      return {
        ...state,
        screen: 'inspect',
        inspectedCard: event.card,
        abilityTab: event.card === 'abilities' ? 'overview' : state.abilityTab,
        announcement: flowTitle
          ? format(MAP_MODEL.content.announcements.detailsInFlow, name, flowTitle)
          : format(MAP_MODEL.content.announcements.detailsBrowse, name),
      };
    }
    case 'close-inspect': {
      const flowTitle = state.flow ? flowById(state.flow)?.title : '';
      const prefix = flowTitle
        ? `Details closed. Back in ${flowTitle}.`
        : 'Details closed. Back on the map.';
      return {
        ...state,
        screen: 'map',
        inspectedCard: null,
        ...withPendingTakeaway(state, prefix),
      };
    }
    case 'replay-flow': {
      if (!state.flow) return { ...state };
      const advancesSuggestion = state.flow === 'uses-ai';
      const nextSuggestion = advancesSuggestion
        ? (state.suggestionIndex + 1) % MAP_MODEL.content.suggestions.length
        : state.suggestionIndex;
      return {
        ...state,
        screen: 'map',
        inspectedCard: null,
        flowPhase: 'assembling',
        pendingTakeawayFlow: null,
        suggestionIndex: nextSuggestion,
        suggestionApplied: false,
        announcement: [
          flowSelectionAnnouncement(state.flow, true),
          advancesSuggestion ? MAP_MODEL.content.announcements.nextSuggestion : '',
        ]
          .filter(Boolean)
          .join(' '),
      };
    }
    case 'open-about':
      return {
        ...state,
        screen: 'about',
        aboutReturnScreen: state.screen === 'map' ? 'map' : 'attract',
        announcement: 'About this exhibit open.',
      };
    case 'close-about': {
      const returnScreen = state.aboutReturnScreen === 'map' ? 'map' : 'attract';
      return {
        ...state,
        screen: returnScreen,
        aboutReturnScreen: null,
        ...withPendingTakeaway(state, 'About this exhibit closed.'),
      };
    }
    case 'select-ability-tab':
      return { ...state, abilityTab: event.tab };
    case 'open-bench':
      return {
        ...state,
        screen: 'bench',
        inspectedCard: null,
        benchStage: 'sandbox',
        flowPhase: 'assembling',
        pendingTakeawayFlow: null,
        announcement: 'WP-Bench run loop open. Sandbox selected.',
      };
    case 'close-bench':
      return {
        ...state,
        screen: 'map',
        flowPhase: 'settled',
        pendingTakeawayFlow: null,
        announcement: [
          'WP-Bench run loop closed. Back on the map.',
          state.flow ? takeawayAnnouncement(state.flow) : '',
        ]
          .filter(Boolean)
          .join(' '),
      };
    case 'select-bench-stage':
      return {
        ...state,
        benchStage: event.stage,
        announcement: `WP-Bench stage selected: ${MAP_MODEL.bench.titles[event.stage]}.`,
      };
    case 'apply-suggestion':
      return state.suggestionApplied
        ? (state as MapState)
        : {
            ...state,
            suggestionApplied: true,
            announcement: 'A person chose Apply. The AI Plugin suggestion is now applied.',
          };
    case 'advance-preview':
      return {
        ...state,
        previewIndex: (state.previewIndex + 1) % MAP_MODEL.previews.length,
        previewPhase: 'assembling',
      };
    case 'set-preview-phase':
      return { ...state, previewPhase: event.phase };
    case 'reset':
      return {
        ...INITIAL_MAP_STATE,
        suggestionIndex: state.suggestionIndex,
        announcement:
          event.reason === 'inactivity'
            ? 'The map reset after a period of inactivity.'
            : 'The Living Block Map returned to its welcome screen.',
      };
    default:
      return assertNever(event);
  }
}

const assertNever = (event: never): never => {
  throw new Error(`Unhandled map event: ${JSON.stringify(event)}`);
};

export function inactivityDelay(state: Readonly<MapState>, kiosk: boolean): number | null {
  if (!kiosk || state.screen === 'attract') return null;
  return state.screen === 'inspect' || state.screen === 'bench' ? 90_000 : 60_000;
}

export const animationDuration = (milliseconds: number, reducedMotion: boolean): number =>
  reducedMotion ? 0 : milliseconds;

const allCardIds = (model: MapModel): CardId[] => [
  ...model.content.actors.map(({ id }) => id),
  ...model.content.blocks.map(({ id }) => id),
  'provider-plugin',
];

const cardTitle = (cardId: CardId, model: MapModel): string =>
  model.content.blocks.find(({ id }) => id === cardId)?.name ??
  model.content.actors.find(({ id }) => id === cardId)?.name ??
  model.content.panels.find(({ id }) => id === cardId)?.title ??
  cardId;

const isLayoutMember = (layout: FlowLayout | undefined, cardId: CardId): boolean =>
  Boolean(layout && Object.hasOwn(layout.members, cardId));

const isSidecar = (layout: FlowLayout | undefined, cardId: CardId): boolean =>
  Boolean(layout?.sidecars?.includes(cardId));

const isParticipant = (layout: FlowLayout | undefined, cardId: CardId): boolean =>
  isLayoutMember(layout, cardId) ||
  isSidecar(layout, cardId) ||
  Boolean(cardId === 'provider-plugin' && layout?.providerPlugin);

const stepFor = (layout: FlowLayout | undefined, cardId: CardId): number => {
  if (cardId === 'provider-plugin') return layout?.providerPlugin?.step ?? 0;
  return layout?.members[cardId] ?? 0;
};

const cardTransform = (
  state: Readonly<MapState>,
  model: MapModel,
  cardId: CardId,
  layout: FlowLayout | undefined,
): string => {
  const neutral = model.neutral[cardId];
  if (!neutral) return '';

  if (state.screen === 'attract') {
    const preview = model.previews[state.previewIndex % model.previews.length];
    const provider = cardId === 'provider-plugin' ? preview?.providerPlugin : undefined;
    const place = provider?.position ?? preview?.at[cardId];
    if (place && state.previewPhase !== 'releasing') {
      const scale = provider?.scale ?? preview.scale;
      return `translate(${place[0] - neutral[0]}px, ${place[1] - neutral[1]}px) scale(${scale})`;
    }
    const loose = model.loose[cardId];
    return loose ? `translate(${loose[0]}px, ${loose[1]}px) rotate(${loose[2]}deg)` : '';
  }

  if (!layout) return '';
  if (cardId === 'provider-plugin' && layout.providerPlugin) {
    const [x, y] = layout.providerPlugin.position;
    return `translate(${x - neutral[0]}px, ${y - neutral[1]}px)`;
  }
  const place = layout.place[cardId];
  if (place) return `translate(${place[0] - neutral[0]}px, ${place[1] - neutral[1]}px)`;
  const slot = layout.park.indexOf(cardId);
  if (slot < 0) return '';
  const shelfIndex = (layout.shelfStart ?? 0) + slot;
  const shelfX = model.shelfX[shelfIndex] ?? model.shelfX[0];
  return `translate(${shelfX - neutral[0]}px, ${layout.shelfY - neutral[1]}px)`;
};

const cardAccessibleName = (
  state: Readonly<MapState>,
  model: MapModel,
  cardId: CardId,
  layout: FlowLayout | undefined,
): string => {
  const name = cardTitle(cardId, model);
  if (!state.flow || !layout) return format(model.content.guidance.cardActionBrowse, name);
  const flowTitle = flowById(state.flow, model)?.title ?? '';
  if (!isParticipant(layout, cardId)) return format(model.content.guidance.cardInactive, name);
  const step = stepFor(layout, cardId);
  return step > 0
    ? format(model.content.guidance.cardActionStep, String(step), name, flowTitle)
    : format(model.content.guidance.cardAction, name, flowTitle);
};

const deriveCard = (
  state: Readonly<MapState>,
  model: MapModel,
  cardId: CardId,
  layout: FlowLayout | undefined,
): DerivedCardView => {
  const participant = isParticipant(layout, cardId);
  const sidecar = isSidecar(layout, cardId);
  const parked = Boolean(layout?.park.includes(cardId) && !participant);
  const preview = model.previews[state.previewIndex % model.previews.length];
  const previewMember = Boolean(
    state.previewPhase !== 'releasing' &&
    (preview?.ids.includes(cardId) || (cardId === 'provider-plugin' && preview?.providerPlugin)),
  );
  const previewSidecar = Boolean(
    state.previewPhase !== 'releasing' && preview?.sidecars?.includes(cardId),
  );
  const opacity =
    state.screen === 'attract'
      ? previewMember
        ? '1'
        : previewSidecar
          ? '0.86'
          : state.previewPhase === 'releasing'
            ? '0.62'
            : '0.2'
      : !layout
        ? '1'
        : '';

  return {
    active: state.screen === 'attract' ? previewMember : participant,
    dimmed: Boolean(layout && !participant),
    disabled: Boolean(layout && !participant),
    inspected: state.inspectedCard === cardId,
    parked,
    sidecar,
    step: String(
      state.screen === 'attract'
        ? cardId === 'provider-plugin'
          ? (preview?.providerPlugin?.step ?? '')
          : (preview?.steps?.[cardId] ??
            (preview?.ids.includes(cardId) ? preview.ids.indexOf(cardId) + 1 : ''))
        : stepFor(layout, cardId) || '',
    ),
    transform: cardTransform(state, model, cardId, layout),
    opacity,
    accessibleName: cardAccessibleName(state, model, cardId, layout),
  };
};

const deriveGuidance = (
  state: Readonly<MapState>,
  model: MapModel,
  layout: FlowLayout | undefined,
): string => {
  if (state.screen === 'attract') return model.content.guidance.attract;
  if (!state.flow || !layout) return model.content.guidance.browse;
  const steps = [...Object.values(layout.members), layout.providerPlugin?.step ?? 0]
    .filter((step): step is number => typeof step === 'number' && step > 0)
    .toSorted((first, second) => first - second);
  return format(model.content.guidance.flow, [...new Set(steps)].join(' → '));
};

const deriveRoving = <Id extends AbilityTabId | BenchStageId>(
  ids: readonly Id[],
  selected: Id,
): Record<Id, { selected: boolean; tabIndex: 0 | -1 }> =>
  Object.fromEntries(
    ids.map((id) => [id, { selected: id === selected, tabIndex: id === selected ? 0 : -1 }]),
  ) as Record<Id, { selected: boolean; tabIndex: 0 | -1 }>;

export function deriveView(state: Readonly<MapState>, model: MapModel): DerivedMapView {
  const layout = state.flow ? model.layouts[state.flow] : undefined;
  const screens = Object.fromEntries(
    (['attract', 'map', 'inspect', 'about', 'bench'] satisfies Screen[]).map((screen) => [
      screen,
      { hidden: state.screen !== screen, inert: state.screen !== screen },
    ]),
  ) as Record<Screen, { hidden: boolean; inert: boolean }>;
  const cards = Object.fromEntries(
    allCardIds(model).map((cardId) => [cardId, deriveCard(state, model, cardId, layout)]),
  ) as Record<CardId, DerivedCardView>;

  return {
    rootClasses: ['core-ai-map', `is-${state.screen}`, ...(state.flow ? ['has-story'] : [])],
    screens,
    selectedFlow: state.flow,
    cards,
    abilityTabs: deriveRoving(
      model.abilityTabs.map(({ id }) => id),
      state.abilityTab,
    ),
    benchStages: deriveRoving(Object.keys(model.bench.stages) as BenchStageId[], state.benchStage),
    guidance: deriveGuidance(state, model, layout),
    announcement: state.announcement,
  };
}
