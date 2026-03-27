/**
 * Converts a NarrativePackage into a Patch for speculative application.
 *
 * NarrativePackage uses a different format (NodeChange/EdgeChange with operation strings)
 * than Patch (ADD_NODE/ADD_EDGE ops with full node/edge objects).
 * This converter bridges the two so packages can be speculatively applied
 * to a graph copy for impact diffing.
 */

import type { NarrativePackage, NodeChange, EdgeChange } from '../ai/types.js';
import type { Patch, PatchOp, AddNodeOp, AddEdgeOp, DeleteEdgeOp, UpdateNodeOp } from '../types/patch.js';
import type { ContentNode } from '../types/nodes.js';
import type { Edge } from '../types/edges.js';
import { generateEdgeId } from '../types/edges.js';

/**
 * Convert a NarrativePackage into a Patch that can be applied via applyPatch().
 *
 * Handles:
 * - NodeChange with operation 'add' → ADD_NODE op
 * - NodeChange with operation 'modify' → UPDATE_NODE op
 * - EdgeChange with operation 'add' → ADD_EDGE op
 * - EdgeChange with operation 'delete' → DELETE_EDGE op
 *
 * @param pkg - The narrative package to convert
 * @param baseVersionId - The story version ID (defaults to empty for speculative use)
 */
export function packageToPatch(
  pkg: NarrativePackage,
  baseVersionId: string = ''
): Patch {
  const ops: PatchOp[] = [];

  // Convert node changes
  for (const nodeChange of pkg.changes.nodes) {
    const op = nodeChangeToOp(nodeChange);
    if (op) ops.push(op);
  }

  // Convert edge changes
  for (const edgeChange of pkg.changes.edges) {
    const op = edgeChangeToOp(edgeChange);
    if (op) ops.push(op);
  }

  return {
    type: 'Patch',
    id: `patch_from_${pkg.id}`,
    base_story_version_id: baseVersionId,
    created_at: new Date().toISOString(),
    ops,
    metadata: {
      source: 'package',
      packageId: pkg.id,
    },
  };
}

/**
 * Convert a NodeChange to a PatchOp.
 */
function nodeChangeToOp(change: NodeChange): PatchOp | null {
  switch (change.operation) {
    case 'add': {
      const node = buildNodeFromChange(change);
      if (!node) return null;
      return { op: 'ADD_NODE', node } as AddNodeOp;
    }
    case 'modify': {
      if (!change.data) return null;
      return {
        op: 'UPDATE_NODE',
        id: change.node_id,
        set: change.data,
      } as UpdateNodeOp;
    }
    case 'delete': {
      return { op: 'DELETE_NODE', id: change.node_id };
    }
    default:
      return null;
  }
}

/**
 * Build a full node object from a NodeChange.
 * Merges node_type, node_id, and data into a ContentNode.
 */
function buildNodeFromChange(change: NodeChange): ContentNode | null {
  if (!change.data) return null;

  // Spread data first, then override type/id to ensure they're correct
  const node: Record<string, unknown> = {
    ...change.data,
    type: change.node_type,
    id: change.node_id,
  };

  // Remove undefined values that could cause issues
  for (const key of Object.keys(node)) {
    if (node[key] === undefined) {
      delete node[key];
    }
  }

  return node as unknown as ContentNode;
}

/**
 * Convert an EdgeChange to a PatchOp.
 */
function edgeChangeToOp(change: EdgeChange): PatchOp | null {
  switch (change.operation) {
    case 'add': {
      const edge: Edge = {
        id: generateEdgeId(),
        type: change.edge_type as Edge['type'],
        from: change.from,
        to: change.to,
        properties: change.properties as Edge['properties'],
        status: 'approved',
        createdAt: new Date().toISOString(),
      };
      return { op: 'ADD_EDGE', edge } as AddEdgeOp;
    }
    case 'delete': {
      return {
        op: 'DELETE_EDGE',
        edge: {
          type: change.edge_type as Edge['type'],
          from: change.from,
          to: change.to,
        },
      } as DeleteEdgeOp;
    }
    default:
      return null;
  }
}
