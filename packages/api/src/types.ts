/**
 * API request and response types
 */

import type { OQDomain } from '@apollo/core';

// =============================================================================
// Response Types
// =============================================================================

export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  suggestion?: string;
}

export interface ValidationErrorDetail {
  code: string;
  node_id?: string | undefined;
  field?: string | undefined;
  suggested_fix?: string | undefined;
}

export interface ValidationErrorResponse {
  success: false;
  error: string;
  validationErrors: ValidationErrorDetail[];
}

// =============================================================================
// Status Response (Bootstrap Endpoint)
// =============================================================================

export interface StoryStats {
  scenes: number;
  beats: number;
  characters: number;
  locations: number;
  objects: number;
  plotPoints: number;
  ideas: number;
  edges: number;
  loglines: number;
  settings: number;
  genreTones: number;
}

export interface OpenQuestionSummary {
  total: number;
}

export interface StatusData {
  storyId: string;
  name?: string | undefined;
  logline?: string | undefined;
  currentVersionId: string;
  currentBranch: string | null;
  updatedAt: string;
  hasStoryContext: boolean;
  stats: StoryStats;
  openQuestions: OpenQuestionSummary;
}

// =============================================================================
// Open Questions Response
// =============================================================================

export interface OpenQuestionData {
  id: string;
  message: string;
  domain: OQDomain;
  target_node_id?: string | undefined;
}

export interface OpenQuestionsData {
  questions: OpenQuestionData[];
}

// =============================================================================
// Cluster Response
// =============================================================================

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
  seed: number;
  moves: MoveData[];
}

// =============================================================================
// Preview Response
// =============================================================================

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

// =============================================================================
// Diff Response
// =============================================================================

export interface NodeChange {
  id: string;
  type: string;
  label?: string | undefined;
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

// =============================================================================
// Log Response
// =============================================================================

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

// =============================================================================
// Branch Response
// =============================================================================

export interface BranchData {
  name: string;
  headVersionId: string;
  createdAt: string;
  description?: string;
  isCurrent: boolean;
}

// =============================================================================
// Request Types
// =============================================================================

export interface InitRequest {
  name?: string;
  logline: string;
}

export interface InputRequest {
  type: 'character' | 'location' | 'scene';
  name: string;
  description?: string;
}

export interface ClusterRequest {
  /** Gap ID (new unified model) - preferred */
  gapId?: string;
  /** @deprecated Use gapId instead */
  oqId?: string;
  scopeNodeId?: string;
  count?: number;
  seed?: number;
}

export interface AcceptRequest {
  moveIds: string[];
}

export interface BranchRequest {
  name: string;
  description?: string;
}

export interface CheckoutRequest {
  target: string;  // Version ID or branch name
}

// =============================================================================
// Nodes Response (Node Browser)
// =============================================================================

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

// =============================================================================
// Outline Response
// =============================================================================

export interface OutlineScene {
  id: string;
  heading: string;
  overview: string;
  orderIndex: number;
  intExt: string | undefined;
  timeOfDay: string | undefined;
  mood: string | undefined;
  status: string | undefined;
}

export interface OutlineBeat {
  id: string;
  beatType: string;
  act: number;
  positionIndex: number;
  guidance: string | undefined;
  status: string | undefined;
  notes: string | undefined;
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

// =============================================================================
// Story Context Response
// =============================================================================

export interface StoryContextData {
  context: string | null;
  modifiedAt: string | null;
}

export interface UpdateContextData {
  context: string;
  modifiedAt: string;
  newVersionId: string;
}

export interface UpdateContextRequest {
  context: string;
}
