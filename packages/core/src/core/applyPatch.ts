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
  UpdateEdgeOp,
  UpsertEdgeOp,
  BatchEdgeOp,
} from '../types/patch.js';
import type { Edge, EdgeProperties } from '../types/edges.js';
import { edgeKey, normalizeEdge } from '../types/edges.js';

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
    case 'UPDATE_EDGE':
      applyUpdateEdge(graph, op);
      break;
    case 'UPSERT_EDGE':
      applyUpsertEdge(graph, op);
      break;
    case 'BATCH_EDGE':
      applyBatchEdge(graph, op);
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
 * Auto-generates ID if not provided.
 */
function applyAddEdge(graph: GraphState, op: AddEdgeOp): void {
  const { edge } = op;

  // Check for duplicate edge by uniqueKey
  const key = edgeKey(edge);
  const exists = graph.edges.some((e) => edgeKey(e) === key);
  if (exists) {
    throw new Error(
      `Edge "${edge.type}" from "${edge.from}" to "${edge.to}" already exists`
    );
  }

  // Normalize edge (add ID if missing, set defaults)
  const normalizedEdge = normalizeEdge(edge);

  // Check for duplicate ID
  if (graph.edges.some((e) => e.id === normalizedEdge.id)) {
    throw new Error(`Edge with ID "${normalizedEdge.id}" already exists`);
  }

  graph.edges.push(normalizedEdge);
}

/**
 * Apply DELETE_EDGE operation.
 * Supports deletion by ID or by (type, from, to) tuple.
 */
function applyDeleteEdge(graph: GraphState, op: DeleteEdgeOp): void {
  const { edge } = op;

  const initialLength = graph.edges.length;

  // Check if deleting by ID
  if ('id' in edge && edge.id && !('type' in edge)) {
    graph.edges = graph.edges.filter((e) => e.id !== edge.id);
    if (graph.edges.length === initialLength) {
      throw new Error(`Edge with ID "${edge.id}" not found`);
    }
  } else if ('type' in edge && 'from' in edge && 'to' in edge) {
    // Delete by (type, from, to) tuple
    const key = edgeKey(edge as Pick<Edge, 'type' | 'from' | 'to'>);
    graph.edges = graph.edges.filter((e) => edgeKey(e) !== key);
    if (graph.edges.length === initialLength) {
      throw new Error(
        `Edge "${(edge as Edge).type}" from "${(edge as Edge).from}" to "${(edge as Edge).to}" not found`
      );
    }
  } else {
    throw new Error('DELETE_EDGE requires either { id } or { type, from, to }');
  }
}

/**
 * Apply UPDATE_EDGE operation.
 * Updates properties on an existing edge by ID.
 */
function applyUpdateEdge(graph: GraphState, op: UpdateEdgeOp): void {
  const { id, set, unset, status } = op;

  const edgeIndex = graph.edges.findIndex((e) => e.id === id);
  if (edgeIndex === -1) {
    throw new Error(`Edge with ID "${id}" not found`);
  }

  const existing = graph.edges[edgeIndex];
  if (!existing) {
    throw new Error(`Edge with ID "${id}" not found`);
  }

  // Build updated properties
  let updatedProperties: EdgeProperties | undefined = existing.properties
    ? { ...existing.properties }
    : undefined;

  if (set) {
    updatedProperties = { ...updatedProperties, ...set };
  }

  if (unset && updatedProperties) {
    for (const key of unset) {
      delete updatedProperties[key];
    }
    // Remove properties object if empty
    if (Object.keys(updatedProperties).length === 0) {
      updatedProperties = undefined;
    }
  }

  // Build updated edge
  graph.edges[edgeIndex] = {
    ...existing,
    properties: updatedProperties,
    status: status ?? existing.status,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Apply UPSERT_EDGE operation.
 * Insert if not exists, update if exists (by uniqueKey).
 */
function applyUpsertEdge(graph: GraphState, op: UpsertEdgeOp): void {
  const { edge } = op;
  const key = edgeKey(edge);

  const existingIndex = graph.edges.findIndex((e) => edgeKey(e) === key);

  if (existingIndex === -1) {
    // Insert new edge
    const normalizedEdge = normalizeEdge(edge);
    graph.edges.push(normalizedEdge);
  } else {
    // Update existing edge - merge properties
    const existing = graph.edges[existingIndex];
    if (!existing) return;

    const mergedProperties: EdgeProperties | undefined =
      edge.properties || existing.properties
        ? { ...existing.properties, ...edge.properties }
        : undefined;

    graph.edges[existingIndex] = {
      ...existing,
      properties: mergedProperties,
      provenance: edge.provenance ?? existing.provenance,
      status: edge.status ?? existing.status,
      updatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Apply BATCH_EDGE operation.
 * Atomically process adds, updates, and deletes.
 */
function applyBatchEdge(graph: GraphState, op: BatchEdgeOp): void {
  const { adds, updates, deletes } = op;

  // Process deletes first (by ID)
  if (deletes && deletes.length > 0) {
    const deleteSet = new Set(deletes);
    graph.edges = graph.edges.filter((e) => !deleteSet.has(e.id));
    // Note: We don't throw if some IDs weren't found - they may already be deleted
  }

  // Process updates
  if (updates && updates.length > 0) {
    for (const update of updates) {
      const edgeIndex = graph.edges.findIndex((e) => e.id === update.id);
      if (edgeIndex === -1) {
        throw new Error(`BATCH_EDGE: Edge with ID "${update.id}" not found for update`);
      }

      const existing = graph.edges[edgeIndex];
      if (!existing) continue;

      let updatedProperties: EdgeProperties | undefined = existing.properties
        ? { ...existing.properties }
        : undefined;

      if (update.set) {
        updatedProperties = { ...updatedProperties, ...update.set };
      }

      if (update.unset && updatedProperties) {
        for (const key of update.unset) {
          delete updatedProperties[key];
        }
        if (Object.keys(updatedProperties).length === 0) {
          updatedProperties = undefined;
        }
      }

      graph.edges[edgeIndex] = {
        ...existing,
        properties: updatedProperties,
        status: update.status ?? existing.status,
        updatedAt: new Date().toISOString(),
      };
    }
  }

  // Process adds last
  if (adds && adds.length > 0) {
    for (const edge of adds) {
      const key = edgeKey(edge);
      const exists = graph.edges.some((e) => edgeKey(e) === key);
      if (exists) {
        throw new Error(
          `BATCH_EDGE: Edge "${edge.type}" from "${edge.from}" to "${edge.to}" already exists`
        );
      }

      const normalizedEdge = normalizeEdge(edge);
      if (graph.edges.some((e) => e.id === normalizedEdge.id)) {
        throw new Error(`BATCH_EDGE: Edge with ID "${normalizedEdge.id}" already exists`);
      }

      graph.edges.push(normalizedEdge);
    }
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
