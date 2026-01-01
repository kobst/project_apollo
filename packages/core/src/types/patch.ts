/**
 * Patch operation type definitions.
 * Matches the schema in spec/projectSpec.md
 */

import type { ContentNode, BaseNode } from './nodes.js';
import type { Edge } from './edges.js';

// =============================================================================
// Patch Operations
// =============================================================================

/**
 * ADD_NODE operation - adds a new node to the graph.
 */
export interface AddNodeOp {
  op: 'ADD_NODE';
  node: ContentNode | Patch;
}

/**
 * UPDATE_NODE operation - updates fields on an existing node.
 * Cannot update 'id' or 'type' fields.
 */
export interface UpdateNodeOp {
  op: 'UPDATE_NODE';
  id: string;
  set: Record<string, unknown>;
  unset?: string[];
}

/**
 * DELETE_NODE operation - removes a node from the graph.
 * Also removes all incident edges.
 */
export interface DeleteNodeOp {
  op: 'DELETE_NODE';
  id: string;
}

/**
 * ADD_EDGE operation - adds a new edge to the graph.
 */
export interface AddEdgeOp {
  op: 'ADD_EDGE';
  edge: Edge;
}

/**
 * DELETE_EDGE operation - removes an edge from the graph.
 */
export interface DeleteEdgeOp {
  op: 'DELETE_EDGE';
  edge: Edge;
}

/**
 * Union of all patch operation types.
 */
export type PatchOp =
  | AddNodeOp
  | UpdateNodeOp
  | DeleteNodeOp
  | AddEdgeOp
  | DeleteEdgeOp;

/**
 * All valid operation type strings.
 */
export type PatchOpType =
  | 'ADD_NODE'
  | 'UPDATE_NODE'
  | 'DELETE_NODE'
  | 'ADD_EDGE'
  | 'DELETE_EDGE';

/**
 * List of all operation types for validation.
 */
export const PATCH_OP_TYPES: PatchOpType[] = [
  'ADD_NODE',
  'UPDATE_NODE',
  'DELETE_NODE',
  'ADD_EDGE',
  'DELETE_EDGE',
];

// =============================================================================
// Patch
// =============================================================================

/**
 * Patch represents a declarative diff applied to the knowledge graph.
 * Contains an ordered list of operations.
 */
export interface Patch extends BaseNode {
  type: 'Patch';
  base_story_version_id: string;
  created_at: string;
  ops: PatchOp[];
  metadata?: Record<string, unknown>;
  notes?: string;
}

// =============================================================================
// Combined Node Type (includes Patch)
// =============================================================================

/**
 * All node types including Patch.
 * This is the full union type for nodes in the knowledge graph.
 */
export type KGNode = ContentNode | Patch;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if an operation type is valid.
 */
export function isValidPatchOpType(type: string): type is PatchOpType {
  return PATCH_OP_TYPES.includes(type as PatchOpType);
}

/**
 * Type guard for ADD_NODE operation.
 */
export function isAddNodeOp(op: PatchOp): op is AddNodeOp {
  return op.op === 'ADD_NODE';
}

/**
 * Type guard for UPDATE_NODE operation.
 */
export function isUpdateNodeOp(op: PatchOp): op is UpdateNodeOp {
  return op.op === 'UPDATE_NODE';
}

/**
 * Type guard for DELETE_NODE operation.
 */
export function isDeleteNodeOp(op: PatchOp): op is DeleteNodeOp {
  return op.op === 'DELETE_NODE';
}

/**
 * Type guard for ADD_EDGE operation.
 */
export function isAddEdgeOp(op: PatchOp): op is AddEdgeOp {
  return op.op === 'ADD_EDGE';
}

/**
 * Type guard for DELETE_EDGE operation.
 */
export function isDeleteEdgeOp(op: PatchOp): op is DeleteEdgeOp {
  return op.op === 'DELETE_EDGE';
}
