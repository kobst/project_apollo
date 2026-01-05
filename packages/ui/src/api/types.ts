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

// Phases, severities, domains
export type OQPhase = 'OUTLINE' | 'DRAFT' | 'REVISION';
export type OQSeverity = 'BLOCKING' | 'IMPORTANT' | 'SOFT';
export type OQDomain = 'STRUCTURE' | 'SCENE' | 'CHARACTER' | 'CONFLICT' | 'THEME_MOTIF';

// Status (bootstrap endpoint)
export interface StoryStats {
  scenes: number;
  beats: number;
  characters: number;
  conflicts: number;
  locations: number;
  themes: number;
  motifs: number;
  objects: number;
  plotPoints: number;
  edges: number;
}

export interface OpenQuestionSummary {
  total: number;
  blocking: number;
  important: number;
  soft: number;
}

export interface StatusData {
  storyId: string;
  name?: string;
  logline?: string;
  phase: OQPhase;
  currentVersionId: string;
  currentBranch: string | null;
  updatedAt: string;
  stats: StoryStats;
  openQuestions: OpenQuestionSummary;
}

// Open Questions
export interface OpenQuestionData {
  id: string;
  message: string;
  phase: OQPhase;
  severity: OQSeverity;
  domain: OQDomain;
  target_node_id?: string;
}

export interface OpenQuestionsData {
  questions: OpenQuestionData[];
  phase: OQPhase;
}

// Clusters and Moves
export interface MoveData {
  id: string;
  title: string;
  rationale: string;
  confidence: number;
}

export interface ClusterData {
  clusterId: string;
  title: string;
  clusterType: string;
  scope: string;
  seed: number;
  moves: MoveData[];
}

// Preview
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

export interface PreviewData {
  move: MoveData;
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

export interface ClusterRequest {
  oqId?: string;
  scopeNodeId?: string;
  count?: number;
  seed?: number;
}

export interface AcceptRequest {
  moveIds: string[];
}

// Init response
export interface InitData {
  storyId: string;
  name?: string;
  logline: string;
  versionId: string;
  stats: StoryStats;
}

// Accept response
export interface AcceptData {
  accepted: Array<{
    moveId: string;
    title: string;
  }>;
  newVersionId: string;
  patchOpsApplied: number;
}

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

export interface OutlineBeat {
  id: string;
  beatType: string;
  act: number;
  positionIndex: number;
  guidance?: string;
  status?: string;
  notes?: string;
  scenes: OutlineScene[];
}

export interface OutlineAct {
  act: number;
  beats: OutlineBeat[];
}

export interface OutlineData {
  storyId: string;
  acts: OutlineAct[];
  summary: {
    totalBeats: number;
    totalScenes: number;
    emptyBeats: number;
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
// Edge Types (Phase D - First-Class Edges)
// =============================================================================

export type EdgeType =
  | 'HAS_CHARACTER'
  | 'LOCATED_AT'
  | 'FEATURES_OBJECT'
  | 'INVOLVES'
  | 'MANIFESTS_IN'
  | 'HAS_ARC'
  | 'EXPRESSED_IN'
  | 'APPEARS_IN'
  | 'ALIGNS_WITH'
  | 'SATISFIED_BY'
  | 'PRECEDES'
  | 'ADVANCES'
  | 'SETS_UP'
  | 'PAYS_OFF';

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
// PlotPoint Types
// =============================================================================

export type PlotPointIntent = 'plot' | 'character' | 'theme' | 'tone';
export type PlotPointPriority = 'low' | 'medium' | 'high';
export type PlotPointUrgency = 'low' | 'medium' | 'high';
export type PlotPointStakesChange = 'up' | 'down' | 'steady';
export type PlotPointStatus = 'proposed' | 'approved' | 'deprecated';

export interface PlotPointData extends NodeData {
  fulfillmentCount: number;
  alignedBeatId?: string;
}

export interface PlotPointsListData {
  plotPoints: PlotPointData[];
  totalCount: number;
  limit: number;
  offset: number;
}

export interface CreatePlotPointRequest {
  title: string;
  intent: PlotPointIntent;
  summary?: string;
  criteria_of_satisfaction?: string;
  priority?: PlotPointPriority;
  urgency?: PlotPointUrgency;
  stakes_change?: PlotPointStakesChange;
  act?: 1 | 2 | 3 | 4 | 5;
  alignToBeatId?: string;
}

export interface CreatePlotPointData {
  plotPoint: PlotPointData;
  newVersionId: string;
}

export interface UpdatePlotPointData {
  plotPoint: PlotPointData;
  newVersionId: string;
  fieldsUpdated: string[];
}

export interface DeletePlotPointData {
  deleted: true;
  newVersionId: string;
}

export interface PlotPointFilters {
  status?: PlotPointStatus;
  act?: 1 | 2 | 3 | 4 | 5;
  intent?: PlotPointIntent;
  unfulfilled?: boolean;
}
