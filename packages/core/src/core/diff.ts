/**
 * Graph diff computation for comparing story versions.
 * Provides structured output for showing changes between graph states.
 */

import type { GraphState } from './graph.js';
import type { KGNode } from '../types/patch.js';
import type { Edge } from '../types/edges.js';

// =============================================================================
// Diff Types
// =============================================================================

/**
 * Represents a change to a specific field on a node.
 */
export interface FieldChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

/**
 * Represents a modified node with its field changes.
 */
export interface ModifiedNode {
  id: string;
  nodeType: string;
  changes: FieldChange[];
}

/**
 * Represents the differences between two graph states.
 */
export interface GraphDiff {
  nodes: {
    added: KGNode[];
    removed: KGNode[];
    modified: ModifiedNode[];
  };
  edges: {
    added: Edge[];
    removed: Edge[];
  };
  summary: DiffSummary;
}

/**
 * Summary statistics for a diff.
 */
export interface DiffSummary {
  nodesAdded: number;
  nodesRemoved: number;
  nodesModified: number;
  edgesAdded: number;
  edgesRemoved: number;
  hasChanges: boolean;
}

// =============================================================================
// Diff Computation
// =============================================================================

/**
 * Compute the differences between two graph states.
 *
 * @param before - The "before" graph state
 * @param after - The "after" graph state
 * @returns GraphDiff describing all changes
 */
export function computeGraphDiff(before: GraphState, after: GraphState): GraphDiff {
  const addedNodes: KGNode[] = [];
  const removedNodes: KGNode[] = [];
  const modifiedNodes: ModifiedNode[] = [];

  // Find added and modified nodes
  for (const [id, afterNode] of after.nodes) {
    const beforeNode = before.nodes.get(id);
    if (!beforeNode) {
      addedNodes.push(afterNode);
    } else {
      const changes = compareNodes(beforeNode, afterNode);
      if (changes.length > 0) {
        modifiedNodes.push({
          id,
          nodeType: afterNode.type,
          changes,
        });
      }
    }
  }

  // Find removed nodes
  for (const [id, beforeNode] of before.nodes) {
    if (!after.nodes.has(id)) {
      removedNodes.push(beforeNode);
    }
  }

  // Compare edges
  const { added: addedEdges, removed: removedEdges } = compareEdges(
    before.edges,
    after.edges
  );

  const summary: DiffSummary = {
    nodesAdded: addedNodes.length,
    nodesRemoved: removedNodes.length,
    nodesModified: modifiedNodes.length,
    edgesAdded: addedEdges.length,
    edgesRemoved: removedEdges.length,
    hasChanges:
      addedNodes.length > 0 ||
      removedNodes.length > 0 ||
      modifiedNodes.length > 0 ||
      addedEdges.length > 0 ||
      removedEdges.length > 0,
  };

  return {
    nodes: {
      added: addedNodes,
      removed: removedNodes,
      modified: modifiedNodes,
    },
    edges: {
      added: addedEdges,
      removed: removedEdges,
    },
    summary,
  };
}

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Compare two nodes and return the list of field changes.
 * Ignores fields that are identical.
 */
function compareNodes(before: KGNode, after: KGNode): FieldChange[] {
  const changes: FieldChange[] = [];

  // Get all keys from both nodes
  const beforeRecord = before as unknown as Record<string, unknown>;
  const afterRecord = after as unknown as Record<string, unknown>;
  const allKeys = new Set([
    ...Object.keys(beforeRecord),
    ...Object.keys(afterRecord),
  ]);

  for (const key of allKeys) {
    // Skip 'type' and 'id' fields - they define identity, not changes
    if (key === 'type' || key === 'id') continue;

    const oldValue = beforeRecord[key];
    const newValue = afterRecord[key];

    if (!deepEqual(oldValue, newValue)) {
      changes.push({ field: key, oldValue, newValue });
    }
  }

  return changes;
}

/**
 * Compare two edge arrays and return added/removed edges.
 */
function compareEdges(
  before: Edge[],
  after: Edge[]
): { added: Edge[]; removed: Edge[] } {
  const added: Edge[] = [];
  const removed: Edge[] = [];

  // Create edge keys for quick lookup
  const beforeSet = new Set(before.map(edgeKey));
  const afterSet = new Set(after.map(edgeKey));

  // Find added edges
  for (const edge of after) {
    if (!beforeSet.has(edgeKey(edge))) {
      added.push(edge);
    }
  }

  // Find removed edges
  for (const edge of before) {
    if (!afterSet.has(edgeKey(edge))) {
      removed.push(edge);
    }
  }

  return { added, removed };
}

/**
 * Create a unique key for an edge.
 */
function edgeKey(edge: Edge): string {
  return `${edge.type}:${edge.from}:${edge.to}`;
}

/**
 * Deep equality check for values.
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);

    if (aKeys.length !== bKeys.length) return false;

    for (const key of aKeys) {
      if (!bKeys.includes(key)) return false;
      if (!deepEqual(aObj[key], bObj[key])) return false;
    }
    return true;
  }

  return false;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Check if a diff has no changes.
 */
export function isDiffEmpty(diff: GraphDiff): boolean {
  return !diff.summary.hasChanges;
}

/**
 * Get a short description of the diff for logging.
 */
export function getDiffDescription(diff: GraphDiff): string {
  const parts: string[] = [];

  if (diff.summary.nodesAdded > 0) {
    parts.push(`+${diff.summary.nodesAdded} node${diff.summary.nodesAdded === 1 ? '' : 's'}`);
  }
  if (diff.summary.nodesRemoved > 0) {
    parts.push(`-${diff.summary.nodesRemoved} node${diff.summary.nodesRemoved === 1 ? '' : 's'}`);
  }
  if (diff.summary.nodesModified > 0) {
    parts.push(`~${diff.summary.nodesModified} node${diff.summary.nodesModified === 1 ? '' : 's'}`);
  }
  if (diff.summary.edgesAdded > 0) {
    parts.push(`+${diff.summary.edgesAdded} edge${diff.summary.edgesAdded === 1 ? '' : 's'}`);
  }
  if (diff.summary.edgesRemoved > 0) {
    parts.push(`-${diff.summary.edgesRemoved} edge${diff.summary.edgesRemoved === 1 ? '' : 's'}`);
  }

  if (parts.length === 0) {
    return 'No changes';
  }

  return parts.join(', ');
}
