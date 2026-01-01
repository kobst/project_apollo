/**
 * Patch application logic.
 * Applies patch operations to a graph state.
 */

import type { GraphState } from './graph.js';
import { cloneGraph } from './graph.js';
import type { KGNode } from '../types/patch.js';
import type {
  Patch,
  PatchOp,
  AddNodeOp,
  UpdateNodeOp,
  DeleteNodeOp,
  AddEdgeOp,
  DeleteEdgeOp,
} from '../types/patch.js';

// =============================================================================
// Patch Application Errors
// =============================================================================

/**
 * Error thrown when patch application fails.
 */
export class PatchApplicationError extends Error {
  constructor(
    message: string,
    public readonly opIndex: number,
    public readonly op: PatchOp
  ) {
    super(message);
    this.name = 'PatchApplicationError';
  }
}

// =============================================================================
// Patch Application
// =============================================================================

/**
 * Apply a patch to a graph state, returning a new graph state.
 * The original graph is not modified.
 *
 * @param graph - The current graph state
 * @param patch - The patch to apply
 * @returns A new graph state with the patch applied
 * @throws PatchApplicationError if an operation fails
 */
export function applyPatch(graph: GraphState, patch: Patch): GraphState {
  const newGraph = cloneGraph(graph);

  for (let i = 0; i < patch.ops.length; i++) {
    const op = patch.ops[i];
    if (op === undefined) continue;

    try {
      applyOp(newGraph, op);
    } catch (error) {
      throw new PatchApplicationError(
        error instanceof Error ? error.message : String(error),
        i,
        op
      );
    }
  }

  return newGraph;
}

/**
 * Apply a single operation to a graph state.
 * Modifies the graph in place.
 */
function applyOp(graph: GraphState, op: PatchOp): void {
  switch (op.op) {
    case 'ADD_NODE':
      applyAddNode(graph, op);
      break;
    case 'UPDATE_NODE':
      applyUpdateNode(graph, op);
      break;
    case 'DELETE_NODE':
      applyDeleteNode(graph, op);
      break;
    case 'ADD_EDGE':
      applyAddEdge(graph, op);
      break;
    case 'DELETE_EDGE':
      applyDeleteEdge(graph, op);
      break;
    default:
      // TypeScript exhaustiveness check
      const _exhaustive: never = op;
      throw new Error(`Unknown operation type: ${(_exhaustive as PatchOp).op}`);
  }
}

// =============================================================================
// Individual Operation Handlers
// =============================================================================

/**
 * Apply ADD_NODE operation.
 */
function applyAddNode(graph: GraphState, op: AddNodeOp): void {
  const { node } = op;

  // Check for duplicate ID
  if (graph.nodes.has(node.id)) {
    throw new Error(`Node with ID "${node.id}" already exists`);
  }

  graph.nodes.set(node.id, node);
}

/**
 * Apply UPDATE_NODE operation.
 */
function applyUpdateNode(graph: GraphState, op: UpdateNodeOp): void {
  const { id, set, unset } = op;

  const existing = graph.nodes.get(id);
  if (!existing) {
    throw new Error(`Node "${id}" not found`);
  }

  // Prevent updating id or type
  if ('id' in set) {
    throw new Error('Cannot update node ID');
  }
  if ('type' in set) {
    throw new Error('Cannot update node type');
  }

  // Create updated node
  const updated: Record<string, unknown> = { ...existing, ...set };

  // Remove unset fields
  if (unset) {
    for (const field of unset) {
      if (field === 'id' || field === 'type') {
        throw new Error(`Cannot unset required field "${field}"`);
      }
      delete updated[field];
    }
  }

  graph.nodes.set(id, updated as unknown as KGNode);
}

/**
 * Apply DELETE_NODE operation.
 * Also removes all incident edges.
 */
function applyDeleteNode(graph: GraphState, op: DeleteNodeOp): void {
  const { id } = op;

  if (!graph.nodes.has(id)) {
    throw new Error(`Node "${id}" not found`);
  }

  // Remove the node
  graph.nodes.delete(id);

  // Remove all incident edges (edges where this node is source or target)
  graph.edges = graph.edges.filter((e) => e.from !== id && e.to !== id);
}

/**
 * Apply ADD_EDGE operation.
 */
function applyAddEdge(graph: GraphState, op: AddEdgeOp): void {
  const { edge } = op;

  // Check for duplicate edge
  const exists = graph.edges.some(
    (e) => e.type === edge.type && e.from === edge.from && e.to === edge.to
  );
  if (exists) {
    throw new Error(
      `Edge "${edge.type}" from "${edge.from}" to "${edge.to}" already exists`
    );
  }

  graph.edges.push(edge);
}

/**
 * Apply DELETE_EDGE operation.
 */
function applyDeleteEdge(graph: GraphState, op: DeleteEdgeOp): void {
  const { edge } = op;

  const initialLength = graph.edges.length;
  graph.edges = graph.edges.filter(
    (e) =>
      !(e.type === edge.type && e.from === edge.from && e.to === edge.to)
  );

  if (graph.edges.length === initialLength) {
    throw new Error(
      `Edge "${edge.type}" from "${edge.from}" to "${edge.to}" not found`
    );
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Apply multiple patches in sequence.
 */
export function applyPatches(graph: GraphState, patches: Patch[]): GraphState {
  let result = graph;
  for (const patch of patches) {
    result = applyPatch(result, patch);
  }
  return result;
}

/**
 * Try to apply a patch, returning the result or null if it fails.
 */
export function tryApplyPatch(
  graph: GraphState,
  patch: Patch
): GraphState | null {
  try {
    return applyPatch(graph, patch);
  } catch {
    return null;
  }
}
