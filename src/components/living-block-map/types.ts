export type Screen = 'attract' | 'map' | 'inspect' | 'about' | 'bench';
export type FlowId = 'uses-ai' | 'uses-wp' | 'learns' | 'tests';
export type BlockId = 'plugin' | 'client' | 'connectors' | 'mcp' | 'abilities' | 'bench';
export type ActorId = 'assistant' | 'skills' | 'agent' | 'provider' | 'task';
export type CardId = BlockId | ActorId | 'provider-plugin';
export type AbilityTabId = 'overview' | 'anatomy' | 'permissions';
export type BenchStageId = 'task' | 'model' | 'sandbox' | 'checks' | 'evidence';
export type BoundaryId = 'left' | 'right' | 'bottom';
export type Coordinate = readonly [number, number];
export type LoosePosition = readonly [number, number, number];

export interface CardSummary<Id extends BlockId | ActorId> {
  readonly id: Id;
  readonly name: string;
  readonly tagline: string;
  readonly badge: string;
}

export type BlockSummary = CardSummary<BlockId>;
export type ActorSummary = CardSummary<ActorId>;

export interface FlowContent {
  readonly id: FlowId;
  readonly title: string;
  readonly copy: string;
  readonly situation: string;
  readonly takeaway: string;
  readonly outcome: string;
}

export interface PanelRole {
  readonly receives: string;
  readonly does: string;
  readonly returns: string;
  readonly lesson: string;
}

export interface ConnectionStep {
  readonly label: string;
  readonly accent?: boolean;
  readonly tone?: 'warning';
}

export interface PanelNote {
  readonly heading: string;
  readonly text: string;
}

export interface MapPanel {
  readonly id: CardId;
  readonly badge: string;
  readonly title: string;
  readonly lede: string;
  readonly roles: Readonly<Partial<Record<FlowId, PanelRole>>>;
  readonly connectHeading?: string;
  readonly connectLayout?: 'chain' | 'grid';
  readonly connect?: readonly ConnectionStep[];
  readonly notes?: readonly PanelNote[];
  readonly href?: string;
  readonly linkLabel?: string;
  readonly qr?: `qr/${string}.svg`;
}

export interface MapLabels {
  readonly railEmptyLabel: string;
  readonly railActiveLabel: string;
  readonly browseLabel: string;
  readonly browseDescription: string;
  readonly takeawayHeading: string;
  readonly roleHeading: string;
  readonly lessonHeading: string;
  readonly definitionHeading: string;
  readonly technicalHeading: string;
  readonly exploreHeading: string;
  readonly tapCue: string;
  readonly receivesLabel: string;
  readonly doesLabel: string;
  readonly returnsLabel: string;
}

export interface MapGuidance {
  readonly attract: string;
  readonly flow: string;
  readonly inspect: string;
  readonly browse: string;
  readonly cardAction: string;
  readonly cardActionStep: string;
  readonly cardInactive: string;
  readonly cardActionBrowse: string;
}

export interface MapAnnouncements {
  readonly flowSelected: string;
  readonly flowReplayed: string;
  readonly takeaway: string;
  readonly browse: string;
  readonly nextSuggestion: string;
  readonly detailsInFlow: string;
  readonly detailsBrowse: string;
}

export interface MapSuggestion {
  readonly label: string;
  readonly text: string;
}

export interface MapContent {
  readonly title: string;
  readonly eyebrow: string;
  readonly reviewedDate: string;
  readonly intro: readonly string[];
  readonly labels: MapLabels;
  readonly guidance: MapGuidance;
  readonly announcements: MapAnnouncements;
  readonly blocks: readonly BlockSummary[];
  readonly actors: readonly ActorSummary[];
  readonly flows: readonly FlowContent[];
  readonly panels: readonly MapPanel[];
  readonly suggestions: readonly MapSuggestion[];
}

export interface ProviderPluginPlacement {
  readonly step: number;
  readonly position: Coordinate;
  readonly restPosition: Coordinate;
}

export interface FlowLayout {
  readonly members: Readonly<Partial<Record<CardId, number>>>;
  readonly place: Readonly<Partial<Record<CardId, Coordinate>>>;
  readonly park: readonly CardId[];
  readonly shelfY: number;
  readonly shelfStart?: number;
  readonly sidecars?: readonly CardId[];
  readonly noStrip?: readonly CardId[];
  readonly providerPlugin?: ProviderPluginPlacement;
  readonly strips?: Readonly<Partial<Record<CardId, Coordinate>>>;
  readonly edges: readonly string[];
  readonly rest: readonly string[];
  readonly sidecarEdges?: readonly string[];
  readonly sidecarRest?: readonly string[];
  readonly dur: readonly string[];
  readonly crosses: readonly BoundaryId[];
  readonly tokens?: boolean;
  readonly zone?: 'outside';
}

export interface AttractProviderPlugin {
  readonly step: number;
  readonly position: Coordinate;
  readonly scale: number;
}

export interface AttractPreview {
  readonly storyId: FlowId;
  readonly scale: number;
  readonly ids: readonly CardId[];
  readonly steps?: Readonly<Partial<Record<CardId, number>>>;
  readonly sidecars?: readonly CardId[];
  readonly providerPlugin?: AttractProviderPlugin;
  readonly at: Readonly<Partial<Record<CardId, Coordinate>>>;
  readonly paths: readonly string[];
  readonly sidecarPaths?: readonly string[];
}

export interface AboutDisclosure {
  readonly term: string;
  readonly description: string;
}

export interface AboutContent {
  readonly badge: string;
  readonly title: string;
  readonly backLabel: string;
  readonly disclosures: readonly AboutDisclosure[];
  readonly responsibility: string;
}

export interface BenchFlowStep {
  readonly label: string;
  readonly accent?: boolean;
}

export interface BenchStage {
  readonly number: string;
  readonly badge: string;
  readonly label: string;
  readonly summary: string;
  readonly kicker: string;
  readonly title: string;
  readonly body: string;
  readonly note?: string;
  readonly flow?: readonly BenchFlowStep[];
  readonly rows: readonly (readonly [string, string])[];
}

export interface BenchContent {
  readonly titles: Readonly<Record<BenchStageId, string>>;
  readonly paths: readonly string[];
  readonly stages: Readonly<Record<BenchStageId, BenchStage>>;
}

export interface AbilityTab {
  readonly id: AbilityTabId;
  readonly label: string;
}

export interface MapModel {
  readonly content: MapContent;
  readonly layouts: Readonly<Record<FlowId, FlowLayout>>;
  readonly previews: readonly AttractPreview[];
  readonly neutral: Readonly<Record<CardId, Coordinate>>;
  readonly loose: Readonly<Partial<Record<CardId, LoosePosition>>>;
  readonly shelfX: readonly number[];
  readonly about: AboutContent;
  readonly bench: BenchContent;
  readonly abilityTabs: readonly AbilityTab[];
}
