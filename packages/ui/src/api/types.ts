/**
 * API response types (mirrored from @apollo/api)
 */

// Response wrapper
export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  suggestion?: string;
}

// Domains
export type OQDomain = 'STRUCTURE' | 'SCENE' | 'CHARACTER';

// Status (bootstrap endpoint)
export interface StoryStats {
  scenes: number;
  beats: number;
  characters: number;
  locations: number;
  objects: number;
  storyBeats: number;
  ideas: number;
  edges: number;
}

export interface OpenQuestionSummary {
  total: number;
}

export interface StatusData {
  storyId: string;
  name?: string;
  currentVersionId: string;
  currentBranch: string | null;
  updatedAt: string;
  hasStoryContext: boolean;
  stats: StoryStats;
  openQuestions: OpenQuestionSummary;
}

// Open Questions
export interface OpenQuestionData {
  id: string;
  message: string;
  domain: OQDomain;
  target_node_id?: string;
}

export interface OpenQuestionsData {
  questions: OpenQuestionData[];
}

// Patch operation (used by extraction preview)
export interface PatchOpData {
  op: string;
  type?: string;
  id?: string;
  data?: Record<string, unknown>;
  edge?: {
    type: string;
    source: string;
    target: string;
  };
}

export interface ValidationErrorDetail {
  code: string;
  node_id?: string;
  field?: string;
  suggested_fix?: string;
}

// (legacy move preview type removed)

// Diff
export interface NodeChange {
  id: string;
  type: string;
  label?: string;
}

export interface FieldChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface ModifiedNodeChange {
  id: string;
  nodeType: string;
  changes: FieldChange[];
}

export interface EdgeChange {
  type: string;
  source: string;
  target: string;
}

export interface DiffData {
  fromVersion: string;
  toVersion: string;
  nodes: {
    added: NodeChange[];
    removed: NodeChange[];
    modified: ModifiedNodeChange[];
  };
  edges: {
    added: EdgeChange[];
    removed: EdgeChange[];
  };
  summary: {
    nodesAdded: number;
    nodesRemoved: number;
    nodesModified: number;
    edgesAdded: number;
    edgesRemoved: number;
  };
}

// Version history
export interface VersionData {
  id: string;
  label: string;
  parentId: string | null;
  createdAt: string;
  isCurrent: boolean;
  branch?: string;
  enrichmentSummary?: string;
  packageTitle?: string;
}

export interface LogData {
  versions: VersionData[];
  currentBranch: string | null;
}

// Branches
export interface BranchData {
  name: string;
  headVersionId: string;
  createdAt: string;
  description?: string;
  isCurrent: boolean;
}

// Request types
export interface InitRequest {
  name?: string;
  logline: string;
}

// (legacy cluster request removed)

// (legacy move accept request removed)

export interface BranchRequest {
  name: string;
  description?: string;
}

export interface CheckoutRequest {
  target: string; // Version ID or branch name
}

// Branch responses
export interface BranchResponseData {
  name: string;
  headVersionId: string;
  createdAt: string;
  description?: string;
}

export interface BranchesListData {
  branches: BranchData[];
}

export interface CheckoutData {
  currentVersionId: string;
  currentBranch: string | null;
  detached: boolean;
}

// Init response
export interface InitData {
  storyId: string;
  name?: string;
  versionId: string;
  stats: StoryStats;
}

// Accept response
// (legacy move accept response removed)

// List stories response
export interface ListStoriesData {
  stories: string[];
}

// Node browsing
export interface NodeData {
  id: string;
  type: string;
  label: string;
  data: Record<string, unknown>;
}

export interface NodesListData {
  nodes: NodeData[];
  totalCount: number;
  limit: number;
  offset: number;
}

export interface RelationEdgeData {
  type: string;
  source: string;
  target: string;
}

export interface NodeRelationsData {
  node: NodeData;
  outgoing: RelationEdgeData[];
  incoming: RelationEdgeData[];
  relatedNodes: NodeData[];
}

// Outline
export interface OutlineScene {
  id: string;
  heading: string;
  overview: string;
  orderIndex: number;
  intExt?: string;
  timeOfDay?: string;
  mood?: string;
  status?: string;
}

export type IdeaSource = 'user' | 'ai';
export type IdeaSuggestedType = 'StoryBeat' | 'Scene' | 'Character' | 'Location' | 'Object';

export interface OutlineIdea {
  id: string;
  title: string;
  description: string;
  source: IdeaSource;
  suggestedType?: IdeaSuggestedType;
  createdAt: string;
}

export interface OutlineStoryBeat {
  id: string;
  title: string;
  intent: string;
  summary?: string;
  priority?: string;
  urgency?: string;
  stakesChange?: string;
  status?: string;
  scenes: OutlineScene[];
}

export interface OutlineBeat {
  id: string;
  beatType: string;
  act: number;
  positionIndex: number;
  guidance?: string;
  status?: string;
  notes?: string;
  storyBeats: OutlineStoryBeat[];
}

export interface OutlineAct {
  act: number;
  beats: OutlineBeat[];
}

export interface OutlineData {
  storyId: string;
  acts: OutlineAct[];
  /** StoryBeats not aligned to any Beat (no ALIGNS_WITH edge) */
  unassignedStoryBeats: OutlineStoryBeat[];
  /** Scenes not connected to any StoryBeat */
  unassignedScenes: OutlineScene[];
  /** Ideas - informal story ideas not yet promoted to formal nodes */
  unassignedIdeas: OutlineIdea[];
  summary: {
    totalBeats: number;
    totalScenes: number;
    totalStoryBeats: number;
    totalIdeas: number;
    unassignedStoryBeatCount: number;
    unassignedSceneCount: number;
    unassignedIdeaCount: number;
  };
}

// Extraction
export interface ExtractedEntity {
  type: string;
  name: string;
  id: string;
}

export interface ExtractProposalData {
  id: string;
  title: string;
  description: string;
  confidence: number;
  extractedEntities: ExtractedEntity[];
  patchId: string;
  opsCount: number;
}

export interface ExtractData {
  storyId: string;
  inputSummary: string;
  targetType: string | null;
  targetNodeId: string | null;
  proposals: ExtractProposalData[];
}

export interface ExtractRequest {
  input: string;
  targetType?: string | undefined;
  targetNodeId?: string | undefined;
}

export interface ExtractPreviewData {
  proposal: {
    id: string;
    title: string;
    description: string;
    confidence: number;
    extractedEntities: ExtractedEntity[];
  };
  patch: {
    id: string;
    baseVersionId: string;
    ops: PatchOpData[];
  };
  validation: {
    valid: boolean;
    errors?: ValidationErrorDetail[];
  };
}

export interface ExtractAcceptData {
  accepted: {
    proposalId: string;
    title: string;
  };
  newVersionId: string;
  opsApplied: number;
}

// Node update
export interface UpdateNodeData {
  node: NodeData;
  newVersionId: string;
  fieldsUpdated: string[];
}

// =============================================================================
// Unified Orchestration (Generate)
// =============================================================================

export interface OrchestrationIntent {
  mode?: 'storyBeats' | 'characters' | 'scenes' | 'expand';
  scope?: 'act1' | 'act2' | 'act3' | 'full';
  focus?: string[];
}

export interface ResolvedIntentData {
  mode: 'storyBeats' | 'characters' | 'scenes' | 'expand' | 'interpret';
  targets: string[];
  direction?: string;
  confidence: number;
  reasoning: string;
}

export interface StateAnalysisData {
  gaps: any[];
  coverage: any;
  suggestions: string[];
}

export interface GenerateRequestData {
  intent?: OrchestrationIntent;
  direction?: string;
  packageCount?: number;
  creativity?: number;
}

export interface GenerateResponseData {
  sessionId: string;
  packages: NarrativePackage[];
  orchestration?: {
    resolvedIntent: ResolvedIntentData;
    strategyUsed: string;
    stateAnalysis: StateAnalysisData;
  };
}

export interface DeleteNodeData {
  deletedNode: NodeData;
  deletedEdgeCount: number;
  newVersionId: string;
}

export interface ConnectedNodeInfo {
  node: NodeData;
  edgeType: string;
  direction: 'outgoing' | 'incoming';
  /** Total edges this connected node has (including to the node being deleted) */
  totalConnections: number;
  /** True if deleting the parent node will leave this node with 0 connections */
  willBeOrphaned: boolean;
}

export interface ConnectedNodesData {
  node: NodeData;
  connectedNodes: ConnectedNodeInfo[];
  edgeCount: number;
  /** Count of nodes that will become orphaned (0 connections after deletion) */
  orphanCount: number;
}

// =============================================================================
// Edge Types (Phase D - First-Class Edges)
// =============================================================================

export type EdgeType =
  | 'HAS_CHARACTER'
  | 'LOCATED_AT'
  | 'FEATURES_OBJECT'
  | 'HAS_ARC'
  | 'ALIGNS_WITH'
  | 'SATISFIED_BY'
  | 'PRECEDES'
  | 'ADVANCES';

export type EdgeStatus = 'proposed' | 'approved' | 'rejected';

export interface EdgeProperties {
  order?: number;
  weight?: number;
  confidence?: number;
  notes?: string;
}

export interface EdgeProvenance {
  source: 'human' | 'extractor' | 'import';
  patchId?: string;
  model?: string;
  promptHash?: string;
  createdBy?: string;
}

export interface EdgeData {
  id: string;
  type: EdgeType;
  from: string;
  to: string;
  properties?: EdgeProperties;
  provenance?: EdgeProvenance;
  status?: EdgeStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface EdgesListData {
  edges: EdgeData[];
  totalCount: number;
  limit: number;
  offset: number;
}

export interface EdgeMutationData {
  edge: EdgeData;
  newVersionId: string;
}

export interface BatchEdgeResult {
  added: number;
  updated: number;
  deleted: number;
  newVersionId: string;
}

export interface UpsertEdgeResult extends EdgeMutationData {
  wasInsert: boolean;
}

export interface EdgeFilters {
  type?: EdgeType;
  from?: string;
  to?: string;
  status?: EdgeStatus;
}

export interface CreateEdgeRequest {
  type: EdgeType;
  from: string;
  to: string;
  properties?: EdgeProperties;
  status?: EdgeStatus;
}

export interface UpdateEdgeRequest {
  set?: Partial<EdgeProperties>;
  unset?: (keyof EdgeProperties)[];
  status?: EdgeStatus;
}

export interface BatchEdgeRequest {
  adds?: CreateEdgeRequest[];
  updates?: Array<{
    id: string;
    set?: Partial<EdgeProperties>;
    unset?: (keyof EdgeProperties)[];
    status?: EdgeStatus;
  }>;
  deletes?: string[];
}

// =============================================================================
// Lint Types (Rule Engine - Milestone 1)
// =============================================================================

export type RuleSeverity = 'hard' | 'soft';
export type RuleCategory = 'structure' | 'act_boundary' | 'stc_ordering' | 'completeness' | 'orphan';

export interface LintViolationData {
  id: string;
  ruleId: string;
  severity: RuleSeverity;
  category: string;
  message: string;
  nodeId?: string;
  nodeType?: string;
  relatedNodeIds?: string[];
}

export interface LintFixData {
  id: string;
  violationId: string;
  ruleId: string;
  label: string;
  description: string;
  affectedNodeIds: string[];
  operationCount: number;
}

export interface LintSummary {
  errorCount: number;
  warningCount: number;
  hasBlockingErrors: boolean;
  scopeTruncated?: boolean;
}

export interface LintData {
  violations: LintViolationData[];
  fixes: LintFixData[];
  summary: LintSummary;
  lastCheckedAt: string;
}

export interface LintRequest {
  scope?: 'full' | 'touched';
  touchedNodeIds?: string[];
  touchedEdgeIds?: string[];
}

export interface ApplyFixRequest {
  fixIds?: string[];
  applyAll?: boolean;
  categories?: RuleCategory[];
}

export interface ApplyFixData {
  applied: string[];
  skipped: string[];
  skipReasons: Record<string, string>;
  newVersionId: string;
  revalidation: {
    errorCount: number;
    warningCount: number;
    hasBlockingErrors: boolean;
  };
}

export interface PreCommitLintData {
  canCommit: boolean;
  violations: LintViolationData[];
  fixes: LintFixData[];
  errorCount: number;
  warningCount: number;
}

// =============================================================================
// Bulk Attach Types (Milestone 2)
// =============================================================================

export interface BulkAttachTarget {
  id: string;
  order?: number | undefined;
  properties?: Partial<EdgeProperties> | undefined;
}

export interface BulkAttachRequest {
  parentId: string;
  edgeType: EdgeType;
  /** Direction relative to parentId: 'outgoing' means parent is source, 'incoming' means parent is target */
  direction: 'outgoing' | 'incoming';
  targets: BulkAttachTarget[];
  detachOthers?: boolean | undefined;
  ordered?: boolean | undefined;
}

export interface BulkAttachData {
  added: number;
  updated: number;
  removed: number;
  edges: EdgeData[];
  newVersionId: string;
  lintResult?: {
    errorCount: number;
    warningCount: number;
    hasBlockingErrors: boolean;
  };
}

// =============================================================================
// StoryBeat Types
// =============================================================================

export type StoryBeatIntent = 'plot' | 'character' | 'tone';
export type StoryBeatPriority = 'low' | 'medium' | 'high';
export type StoryBeatUrgency = 'low' | 'medium' | 'high';
export type StoryBeatStakesChange = 'up' | 'down' | 'steady';
export type StoryBeatStatus = 'proposed' | 'approved' | 'deprecated';
export type StoryBeatNarrativeFunction =
  | 'theme_establishment'
  | 'character_introduction'
  | 'character_development'
  | 'plot_revelation'
  | 'reversal'
  | 'escalation'
  | 'resolution'
  | 'tone_setter';

export interface StoryBeatData extends NodeData {
  fulfillmentCount: number;
  alignedBeatId?: string;
}

export interface StoryBeatsListData {
  storyBeats: StoryBeatData[];
  totalCount: number;
  limit: number;
  offset: number;
}

export interface CreateStoryBeatRequest {
  title: string;
  intent: StoryBeatIntent;
  summary?: string;
  narrative_function?: StoryBeatNarrativeFunction;
  criteria_of_satisfaction?: string;
  priority?: StoryBeatPriority;
  urgency?: StoryBeatUrgency;
  stakes_change?: StoryBeatStakesChange;
  act?: 1 | 2 | 3 | 4 | 5;
  alignToBeatId?: string;
}

export interface CreateStoryBeatData {
  storyBeat: StoryBeatData;
  newVersionId: string;
}

export interface UpdateStoryBeatData {
  storyBeat: StoryBeatData;
  newVersionId: string;
  fieldsUpdated: string[];
}

export interface DeleteStoryBeatData {
  deleted: true;
  newVersionId: string;
}

export interface StoryBeatFilters {
  status?: StoryBeatStatus;
  act?: 1 | 2 | 3 | 4 | 5;
  intent?: StoryBeatIntent;
  unfulfilled?: boolean;
}

// =============================================================================
// Scene Types
// =============================================================================

export type IntExt = 'INT' | 'EXT' | 'OTHER';

export interface SceneData extends NodeData {
  connectedStoryBeatId?: string | undefined;
}

export interface ScenesListData {
  scenes: SceneData[];
  totalCount: number;
  limit: number;
  offset: number;
}

export interface CreateSceneRequest {
  heading: string;
  scene_overview?: string;
  int_ext?: IntExt;
  time_of_day?: string;
  mood?: string;
  /** Optional: immediately attach to a StoryBeat */
  attachToStoryBeatId?: string;
}

export interface CreateSceneData {
  scene: SceneData;
  newVersionId: string;
}

export interface UpdateSceneData {
  scene: SceneData;
  newVersionId: string;
  fieldsUpdated: string[];
}

export interface DeleteSceneData {
  deleted: true;
  newVersionId: string;
}

export interface SceneFilters {
  unassigned?: boolean;
}

// =============================================================================
// Idea Types
// =============================================================================

export interface IdeaData extends NodeData {
  source: IdeaSource;
  suggestedType?: IdeaSuggestedType;
}

export interface IdeasListData {
  ideas: IdeaData[];
  totalCount: number;
  limit: number;
  offset: number;
}

export interface CreateIdeaRequest {
  title: string;
  description: string;
  source?: IdeaSource;
  suggestedType?: IdeaSuggestedType;
  // Planning fields (optional)
  kind?: 'proposal' | 'question' | 'direction' | 'constraint' | 'note';
  resolutionStatus?: 'open' | 'discussed' | 'resolved' | 'archived';
  resolution?: string;
  parent_idea_id?: string;
  refinement_guidance?: string;
  targetBeat?: string;
  targetAct?: number;
  targetScene?: string;
  themes?: string[];
  moods?: string[];
}

export interface CreateIdeaData {
  idea: IdeaData;
  newVersionId: string;
}

export interface UpdateIdeaData {
  idea: IdeaData;
  newVersionId: string;
  fieldsUpdated: string[];
}

export interface DeleteIdeaData {
  deleted: true;
  newVersionId: string;
}

// =============================================================================
// Agent Runner & Staging Utilities
// =============================================================================

export interface RunAgentResponseData {
  jobId: string;
  eventsUrl: string;
}

export type AgentEvent =
  | { type: 'status'; data: { status: 'queued'|'running'|'succeeded'|'failed'|'canceled' } }
  | { type: 'progress'; data: { step: string; detail?: string } }
  | { type: 'packages'; data: { packages: NarrativePackage[]; sessionId?: string } }
  | { type: 'metrics'; data: Record<string, unknown> }
  | { type: 'error'; data: { message: string } };

export interface OverlayEdgeData { type: string; from: string; to: string }
export interface OverlayDiffData {
  nodes: { created: string[]; modified: string[]; deleted: string[] };
  edges: { created: OverlayEdgeData[]; modified?: OverlayEdgeData[]; deleted: OverlayEdgeData[] };
}

export interface IdeaFromPackageRequest {
  packageId: string;
  elementType: 'node'|'edge'|'storyContext';
  elementIndex?: number;
  elementId?: string;
  title?: string;
  description?: string;
  category?: 'character'|'plot'|'scene'|'worldbuilding'|'general';
}

// =============================================================================
// Idea Refinement Session Types
// =============================================================================

export interface IdeaRefinementVariant {
  id: string;
  kind?: 'proposal' | 'question' | 'direction' | 'constraint' | 'note';
  title: string;
  description: string;
  resolution?: string;
  confidence?: number;
  suggestedArtifacts?: Array<{
    type: 'StoryBeat' | 'Scene';
    title: string;
    summary?: string;
    rationale?: string;
  }>;
}

export interface IdeaRefinementSessionData {
  id: string;
  storyId: string;
  ideaId: string;
  guidance: string;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'committed' | 'abandoned';
  variants: IdeaRefinementVariant[];
  committedVariantIndex?: number;
}

// =============================================================================
// Coverage / Gap Types (Unified Model)
// =============================================================================

export type GapType = 'structural' | 'narrative';
export type GapTier = 'premise' | 'foundations' | 'structure' | 'storyBeats' | 'scenes';
export type GapSource = 'rule-engine' | 'derived' | 'user' | 'extractor' | 'import';
export type GapStatus = 'open' | 'in_progress' | 'resolved';
export type GapDomain = 'STRUCTURE' | 'SCENE' | 'CHARACTER';

export interface GapData {
  id: string;
  type: GapType;
  tier: GapTier;
  title: string;
  description: string;
  scopeRefs: { nodeIds?: string[]; edgeIds?: string[] };
  source: GapSource;
  status: GapStatus;
  // Optional fields for narrative gaps
  domain?: GapDomain;
  groupKey?: string;
  dependencies?: string[];
  resolvedBy?: {
    versionId: string;
    patchId?: string;
    timestamp: string;
  };
}

export interface TierSummaryData {
  tier: GapTier;
  label: string;
  covered: number;
  total: number;
  percent: number;
}

export interface CoverageData {
  summary: TierSummaryData[];
  gaps: GapData[];
}

export interface GapsData {
  summary: TierSummaryData[];
  gaps: GapData[];
}

// =============================================================================
// Story Context Types
// =============================================================================

/**
 * Tags for categorizing soft guidelines.
 */
export type GuidelineTag =
  | 'character'
  | 'dialogue'
  | 'scene'
  | 'action'
  | 'pacing'
  | 'plot'
  | 'worldbuilding'
  | 'general';

/**
 * A hard rule that the AI must not violate.
 */
export interface HardRule {
  id: string;
  text: string;
}

/**
 * A soft guideline that applies when relevant.
 */
export interface SoftGuideline {
  id: string;
  tags: GuidelineTag[];
  text: string;
}

/**
 * Story constitution - stable creative direction (cached in system prompt).
 */
export interface StoryContextConstitution {
  logline: string;
  premise: string;
  genre: string;
  setting: string;
  thematicPillars: string[];
  hardRules: HardRule[];
  toneEssence: string;
  banned: string[];
  version: string;
}

/**
 * Operational story context - dynamic content filtered per-task.
 */
export interface StoryContextOperational {
  softGuidelines: SoftGuideline[];
  workingNotes?: string;
}

/**
 * Complete structured Story Context.
 */
export interface StoryContext {
  constitution: StoryContextConstitution;
  operational: StoryContextOperational;
}

export interface StoryContextData {
  context: StoryContext | null;
  modifiedAt: string | null;
}

export interface UpdateContextData {
  context: StoryContext;
  modifiedAt: string;
  newVersionId: string;
}

// =============================================================================
// AI Generation Types
// =============================================================================

// Entry point types for generation
export type GenerationEntryPointType =
  | 'beat'
  | 'storyBeat'
  | 'character'
  | 'gap'
  | 'idea'
  | 'naked';

export interface GenerationEntryPoint {
  type: GenerationEntryPointType;
  targetId?: string;
}

// Generation depth and count
export type GenerationDepth = 'narrow' | 'medium' | 'wide';
export type GenerationCount = 'few' | 'standard' | 'many';

// Interpretation request/response
export interface InterpretRequest {
  userInput: string;
  targetType?: string;
}

export interface InterpretationProposal {
  type: 'node' | 'storyContext' | 'edge';
  operation: 'add' | 'modify';
  target_type?: string;
  data: Record<string, unknown>;
  rationale: string;
  relates_to?: string[];
}

export interface InterpretResponseData {
  interpretation: {
    summary: string;
    confidence: number;
  };
  proposals: InterpretationProposal[];
  /** Pre-computed validation for each proposal (by index) */
  validations: Record<number, ProposalValidation>;
  alternatives?: Array<{
    summary: string;
    confidence: number;
  }>;
}

// Generation request/response
export interface GenerateRequest {
  entryPoint: GenerationEntryPoint;
  depth?: GenerationDepth;
  count?: GenerationCount;
  direction?: string;
}

export interface NodeChangeAI {
  operation: 'add' | 'modify' | 'delete';
  node_type: string;
  node_id: string;
  data?: Record<string, unknown>;
  previous_data?: Record<string, unknown>;
}

export interface EdgeChangeAI {
  operation: 'add' | 'delete';
  edge_type: string;
  from: string;
  to: string;
  /** Human-readable name of the 'from' node (resolved from graph) */
  from_name?: string;
  /** Human-readable name of the 'to' node (resolved from graph) */
  to_name?: string;
  properties?: Record<string, unknown>;
}

/**
 * Operation types for structured StoryContext changes.
 */
export type StoryContextChangeOperation =
  // Constitution string fields
  | { type: 'setConstitutionField'; field: 'logline' | 'premise' | 'genre' | 'setting' | 'toneEssence' | 'version'; value: string }
  // Thematic pillars
  | { type: 'setThematicPillars'; pillars: string[] }
  | { type: 'addThematicPillar'; pillar: string }
  | { type: 'removeThematicPillar'; index: number }
  // Banned elements
  | { type: 'setBanned'; banned: string[] }
  | { type: 'addBanned'; item: string }
  | { type: 'removeBanned'; index: number }
  // Hard rules
  | { type: 'addHardRule'; rule: { id: string; text: string } }
  | { type: 'updateHardRule'; id: string; text: string }
  | { type: 'removeHardRule'; id: string }
  // Soft guidelines
  | { type: 'addGuideline'; guideline: { id: string; tags: string[]; text: string } }
  | { type: 'updateGuideline'; id: string; changes: { tags?: string[]; text?: string } }
  | { type: 'removeGuideline'; id: string }
  // Working notes
  | { type: 'setWorkingNotes'; content: string };

/**
 * A change to the structured StoryContext.
 */
export interface StoryContextChange {
  operation: StoryContextChangeOperation;
}

export interface ConflictInfo {
  type: 'contradicts' | 'duplicates' | 'interferes';
  existing_node_id: string;
  description: string;
  source: 'llm' | 'lint';
  resolution_included: boolean;
}

export interface PackageChanges {
  storyContext?: StoryContextChange[];
  nodes: NodeChangeAI[];
  edges: EdgeChangeAI[];
}

export interface PackageImpact {
  fulfills_gaps: string[];
  creates_gaps: string[];
  conflicts: ConflictInfo[];
}

export interface ImpactEnrichment {
  fulfills: Array<{ description: string; narrative: string }>;
  creates: Array<{ description: string; narrative: string }>;
  thematic_analysis: string;
}

export interface EnrichImpactResponseData {
  enrichment: ImpactEnrichment;
}

export interface NarrativePackage {
  id: string;
  title: string;
  rationale: string;
  confidence: number;
  parent_package_id?: string;
  refinement_prompt?: string;
  style_tags: string[];
  changes: PackageChanges;
  impact: PackageImpact;
  enrichment?: ImpactEnrichment;
}

export interface GenerateResponseData {
  sessionId: string;
  packages: NarrativePackage[];
}

// Refine request/response
export interface RefineRequest {
  basePackageId: string;
  keepElements?: string[];
  regenerateElements?: string[];
  guidance: string;
  depth?: GenerationDepth;
  count?: GenerationCount;
}

export interface RefineResponseData {
  variations: NarrativePackage[];
}

// Session types
export type SessionStatus = 'active' | 'accepted' | 'abandoned';

export interface RefinableElement {
  id: string;
  type: string;
  label: string;
}

export interface RefinableStoryContextChange {
  operationType: string;
  summary: string;
}

export interface RefinableElements {
  nodes: RefinableElement[];
  storyContextChanges: RefinableStoryContextChange[];
}

export interface GenerationSession {
  id: string;
  storyId: string;
  createdAt: string;
  updatedAt: string;
  entryPoint: GenerationEntryPoint;
  packages: NarrativePackage[];
  currentPackageId?: string;
  status: SessionStatus;
  acceptedPackageId?: string;
  refinableElements?: RefinableElements;
}

export interface SessionResponseData extends GenerationSession {}

// Accept package response
export interface AcceptPackageResponseData {
  packageId: string;
  title: string;
  newVersionId: string;
  patchOpsApplied: number;
  nodesAdded: number;
  nodesModified: number;
  nodesDeleted: number;
  edgesAdded: number;
  edgesDeleted: number;
  storyContextUpdated: boolean;
}

// Streaming event types (for SSE)
export type StreamEventType = 'token' | 'usage' | 'error' | 'result';

export interface StreamTokenEvent {
  type: 'token';
  content: string;
}

export interface StreamUsageEvent {
  type: 'usage';
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface StreamErrorEvent {
  type: 'error';
  message: string;
}

export interface StreamResultEvent<T> {
  type: 'result';
  data: T;
}

export type StreamEvent<T> =
  | StreamTokenEvent
  | StreamUsageEvent
  | StreamErrorEvent
  | StreamResultEvent<T>;

// =============================================================================
// Proposal Validation Types
// =============================================================================

export type SimilarityType = 'exact' | 'fuzzy' | 'partial';

export interface SimilarityMatch {
  existingNodeId: string;
  existingNodeType: string;
  existingNodeName: string;
  matchedField: string;
  similarity: number;
  type: SimilarityType;
}

export interface GapMatch {
  gapId: string;
  gapTitle: string;
  gapTier: GapTier;
  fulfillment: 'full' | 'partial';
  reason: string;
}

export interface ConnectionSuggestion {
  nodeId: string;
  nodeType: string;
  nodeName: string;
  edgeType: EdgeType;
  direction: 'from' | 'to';
  reason: string;
  confidence: number;
}

export interface ProposalWarning {
  code: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  suggestion?: string;
}

export interface ProposalValidation {
  similarities: SimilarityMatch[];
  fulfillsGaps: GapMatch[];
  suggestedConnections: ConnectionSuggestion[];
  warnings: ProposalWarning[];
  score: number;
}

export interface ConvertProposalResponseData {
  package: NarrativePackage;
  validation: ProposalValidation;
}

// =============================================================================
// Saved Packages Types
// =============================================================================

export type CompatibilityStatus = 'compatible' | 'outdated' | 'conflicting';

export interface CompatibilityConflict {
  type: 'node_deleted' | 'node_modified' | 'edge_deleted';
  nodeId?: string;
  edgeId?: string;
  description: string;
}

export interface PackageCompatibility {
  status: CompatibilityStatus;
  currentVersionId: string;
  currentVersionLabel: string;
  versionsBehind: number;
  conflicts: CompatibilityConflict[];
}

export interface SavedPackageData {
  id: string;
  storyId: string;
  package: NarrativePackage;
  sourceVersionId: string;
  sourceVersionLabel: string;
  savedAt: string;
  userNote?: string;
  compatibility: PackageCompatibility;
}

export interface SavedPackagesListData {
  packages: SavedPackageData[];
  totalCount: number;
}

export interface SavePackageRequest {
  packageId: string;
  userNote?: string;
}

export interface SavedPackageResponseData {
  savedPackage: SavedPackageData;
}

export interface ApplySavedPackageResponseData {
  success: boolean;
  newVersionId: string;
  patchOpsApplied: number;
}

// =============================================================================
// Package Editing Types
// =============================================================================

export type PackageElementType = 'node' | 'edge' | 'storyContext';

export interface RegenerateElementRequest {
  packageId: string;
  elementType: PackageElementType;
  elementIndex: number;
  guidance?: string;
  count?: GenerationCount;
}

export interface RegenerateElementResponseData {
  options: Array<NodeChangeAI | EdgeChangeAI | StoryContextChange>;
}

export interface ApplyElementOptionRequest {
  packageId: string;
  elementType: PackageElementType;
  elementIndex: number;
  newElement: NodeChangeAI | EdgeChangeAI | StoryContextChange;
}

export interface ApplyElementOptionResponseData {
  package: NarrativePackage;
}

export interface ValidatePackageRequest {
  package: NarrativePackage;
}

export interface PackageValidationError {
  type: PackageElementType;
  index: number;
  field?: string;
  message: string;
}

export interface ValidatePackageResponseData {
  valid: boolean;
  errors: PackageValidationError[];
}

export interface UpdatePackageElementRequest {
  packageId: string;
  elementType: PackageElementType;
  elementIndex: number;
  updatedElement: NodeChangeAI | EdgeChangeAI | StoryContextChange;
}

export interface UpdatePackageElementResponseData {
  package: NarrativePackage;
}

// =============================================================================
// Unified Propose Types
// =============================================================================

/**
 * Proposal mode - simplified user-facing selector.
 * - add: Create exactly what is described (low creativity, strict, 1 node)
 * - expand: Build out from a starting point (medium creativity, 4 nodes)
 * - explore: Generate creative options (high creativity, 6 nodes)
 */
export type ProposalMode = 'add' | 'expand' | 'explore';

/**
 * Intent for a propose request.
 */
export type ProposeIntent = 'add' | 'edit' | 'expand' | 'link';

/**
 * Entry point type for propose requests.
 */
export type ProposeEntryPointType =
  | 'freeText'
  | 'node'
  | 'beat'
  | 'gap'
  | 'document';

/**
 * Structure respect mode.
 */
export type StructureRespect = 'strict' | 'soft';

/**
 * Scope defines what the propose request is targeting.
 */
export interface ProposeScope {
  entryPoint: ProposeEntryPointType;
  targetType?: string;
  targetIds?: string[];
}

/**
 * Input data for a propose request.
 */
export interface ProposeInput {
  text?: string;
  structured?: Record<string, unknown>;
  documentId?: string;
}

/**
 * Constraints for package generation.
 * All fields are optional - defaults come from mode or system defaults.
 */
export interface ProposeConstraints {
  creativity?: number;
  inventNewEntities?: boolean;
  respectStructure?: StructureRespect;
}

/**
 * Options for propose request.
 * All fields are optional - defaults come from mode or system defaults.
 */
export interface ProposeOptions {
  packageCount?: number;
  maxNodesPerPackage?: number;
}

/**
 * Unified propose request.
 */
export interface ProposeRequest {
  intent: ProposeIntent;
  scope: ProposeScope;
  input?: ProposeInput;
  mode?: ProposalMode;
  constraints?: ProposeConstraints;
  options?: ProposeOptions;
}

/**
 * Response from a propose request.
 */
export interface ProposeResponseData {
  sessionId: string;
  packages: NarrativePackage[];
  interpretation?: {
    summary: string;
    confidence: number;
    alternatives?: Array<{ summary: string; confidence: number }>;
  };
}

/**
 * Request to refine a package in the active proposal.
 */
export interface ProposeRefineRequest {
  packageId: string;
  guidance: string;
  creativity?: number;
}

// =============================================================================
// New Generation API Types (Four-Mode System)
// =============================================================================

/**
 * Focus type for Story Beats generation.
 */
export type StoryBeatsFocusType = 'all' | 'act' | 'beats';

/**
 * Request for Story Beats generation.
 */
export interface ProposeStoryBeatsRequest {
  focus: StoryBeatsFocusType;
  targetAct?: 1 | 2 | 3 | 4 | 5 | undefined;
  priorityBeatIds?: string[] | undefined;
  direction?: string | undefined;
  creativity?: number | undefined;
  packageCount?: number | undefined;
  inventNewEntities?: boolean | undefined;
}

/**
 * Validated beat info in Story Beats response.
 */
export interface ValidatedBeatInfo {
  beatId: string;
  beatType: string;
  act: number;
  storyBeatCount: number;
  isNew: boolean;
}

/**
 * Rejected beat info in Story Beats response.
 */
export interface RejectedBeatInfo {
  beatId: string;
  beatType: string;
  reason: string;
}

/**
 * Response from Story Beats generation.
 */
export interface ProposeStoryBeatsResponse {
  sessionId: string;
  packages: NarrativePackage[];
  validatedBeats: ValidatedBeatInfo[];
  rejectedBeats: RejectedBeatInfo[];
}

/**
 * Focus type for Characters generation.
 */
export type CharacterFocusType =
  | 'develop-existing'
  | 'new-protagonist'
  | 'new-antagonist'
  | 'new-supporting'
  | 'fill-gaps';

/**
 * Request for Characters generation.
 */
export interface ProposeCharactersRequest {
  focus: CharacterFocusType;
  characterId?: string | undefined;
  includeArcs?: boolean | undefined;
  direction?: string | undefined;
  creativity?: number | undefined;
  packageCount?: number | undefined;
  inventNewEntities?: boolean | undefined;
}

/**
 * Character summary in Characters response.
 */
export interface CharacterSummary {
  id: string;
  name: string;
  role?: string;
  arcCount: number;
  isNew: boolean;
}

/**
 * Response from Characters generation.
 */
export interface ProposeCharactersResponse {
  sessionId: string;
  packages: NarrativePackage[];
  existingCharacters: CharacterSummary[];
  newCharacters: CharacterSummary[];
}

/**
 * Request for Scenes generation.
 */
export interface ProposeScenesRequest {
  storyBeatIds: string[];
  scenesPerBeat?: number | undefined;
  direction?: string | undefined;
  creativity?: number | undefined;
  packageCount?: number | undefined;
  inventNewEntities?: boolean | undefined;
}

/**
 * Scene summary in Scenes response.
 */
export interface SceneSummary {
  id: string;
  heading: string;
  storyBeatId: string;
  isNew: boolean;
}

/**
 * Response from Scenes generation.
 */
export interface ProposeScenesResponse {
  sessionId: string;
  packages: NarrativePackage[];
  generatedScenes: SceneSummary[];
}

/**
 * Target type for Expand generation.
 */
export type ExpandTargetType = 'story-context' | 'story-context-section' | 'node';

/**
 * Context section for Expand generation.
 */
export type ExpandContextSection =
  | 'genre-tone'
  | 'setting'
  | 'themes'
  | 'backstory'
  | 'worldbuilding'
  | 'rules';

/**
 * Depth for Expand generation.
 */
export type ExpandDepthType = 'surface' | 'deep';

/**
 * Request for Expand generation.
 */
export interface ProposeExpandRequest {
  targetType: ExpandTargetType;
  contextSection?: ExpandContextSection | undefined;
  nodeId?: string | undefined;
  depth?: ExpandDepthType | undefined;
  direction?: string | undefined;
  creativity?: number | undefined;
  packageCount?: number | undefined;
  inventNewEntities?: boolean | undefined;
}

/**
 * Response from Expand generation.
 */
export interface ProposeExpandResponse {
  sessionId: string;
  packages: NarrativePackage[];
  expandedSections?: string[];
  expandedNodeId?: string;
}
