/**
 * API request and response types
 */

import type { OQPhase, OQSeverity, OQDomain } from '@apollo/core';

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
  name?: string | undefined;
  logline?: string | undefined;
  phase: OQPhase;
  currentVersionId: string;
  currentBranch: string | null;
  updatedAt: string;
  stats: StoryStats;
  openQuestions: OpenQuestionSummary;
}

// =============================================================================
// Open Questions Response
// =============================================================================

export interface OpenQuestionData {
  id: string;
  message: string;
  phase: OQPhase;
  severity: OQSeverity;
  domain: OQDomain;
  target_node_id?: string | undefined;
}

export interface OpenQuestionsData {
  questions: OpenQuestionData[];
  phase: OQPhase;
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
  scope: string;
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
  type: 'character' | 'location' | 'conflict' | 'scene';
  name: string;
  description?: string;
}

export interface ClusterRequest {
  oqId: string;
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
