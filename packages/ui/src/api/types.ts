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

export interface EdgeData {
  type: string;
  source: string;
  target: string;
}

export interface NodeRelationsData {
  node: NodeData;
  outgoing: EdgeData[];
  incoming: EdgeData[];
  relatedNodes: NodeData[];
}
