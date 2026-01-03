/**
 * In-memory graph store for the screenplay knowledge graph.
 */

import type { KGNode } from '../types/patch.js';
import type { Edge, EdgeType, EdgeStatus } from '../types/edges.js';
import { edgeKey } from '../types/edges.js';

// =============================================================================
// Graph State
// =============================================================================

/**
 * Represents the state of the knowledge graph.
 */
export interface GraphState {
  nodes: Map<string, KGNode>;
  edges: Edge[];
  /** Optional index for O(1) edge lookups by ID. Call rebuildEdgeIndex() to populate. */
  edgeIndex?: Map<string, number> | undefined;
}

// =============================================================================
// Graph Creation
// =============================================================================

/**
 * Creates an empty graph state.
 */
export function createEmptyGraph(): GraphState {
  return {
    nodes: new Map(),
    edges: [],
  };
}

/**
 * Creates a deep clone of a graph state.
 * Node map is shallow-cloned (node objects are not deeply cloned).
 * Edge array is shallow-cloned.
 */
export function cloneGraph(graph: GraphState): GraphState {
  return {
    nodes: new Map(graph.nodes),
    edges: [...graph.edges],
  };
}

// =============================================================================
// Node Operations
// =============================================================================

/**
 * Get a node by ID.
 */
export function getNode(graph: GraphState, id: string): KGNode | undefined {
  return graph.nodes.get(id);
}

/**
 * Check if a node exists.
 */
export function hasNode(graph: GraphState, id: string): boolean {
  return graph.nodes.has(id);
}

/**
 * Get all nodes of a specific type.
 */
export function getNodesByType<T extends KGNode>(
  graph: GraphState,
  type: string
): T[] {
  const result: T[] = [];
  for (const node of graph.nodes.values()) {
    if (node.type === type) {
      result.push(node as T);
    }
  }
  return result;
}

/**
 * Get all nodes in the graph.
 */
export function getAllNodes(graph: GraphState): KGNode[] {
  return Array.from(graph.nodes.values());
}

/**
 * Get the count of nodes in the graph.
 */
export function getNodeCount(graph: GraphState): number {
  return graph.nodes.size;
}

/**
 * Get the count of nodes of a specific type.
 */
export function getNodeCountByType(graph: GraphState, type: string): number {
  let count = 0;
  for (const node of graph.nodes.values()) {
    if (node.type === type) {
      count++;
    }
  }
  return count;
}

// =============================================================================
// Edge Operations
// =============================================================================

/**
 * Get all edges originating from a node.
 */
export function getEdgesFrom(graph: GraphState, nodeId: string): Edge[] {
  return graph.edges.filter((e) => e.from === nodeId);
}

/**
 * Get all edges pointing to a node.
 */
export function getEdgesTo(graph: GraphState, nodeId: string): Edge[] {
  return graph.edges.filter((e) => e.to === nodeId);
}

/**
 * Get all edges of a specific type.
 */
export function getEdgesByType(graph: GraphState, type: EdgeType): Edge[] {
  return graph.edges.filter((e) => e.type === type);
}

/**
 * Get all edges originating from a node of a specific type.
 */
export function getEdgesFromByType(
  graph: GraphState,
  nodeId: string,
  type: EdgeType
): Edge[] {
  return graph.edges.filter((e) => e.from === nodeId && e.type === type);
}

/**
 * Get all edges pointing to a node of a specific type.
 */
export function getEdgesToByType(
  graph: GraphState,
  nodeId: string,
  type: EdgeType
): Edge[] {
  return graph.edges.filter((e) => e.to === nodeId && e.type === type);
}

/**
 * Check if a specific edge exists.
 */
export function hasEdge(
  graph: GraphState,
  type: EdgeType,
  from: string,
  to: string
): boolean {
  return graph.edges.some(
    (e) => e.type === type && e.from === from && e.to === to
  );
}

/**
 * Get all edges in the graph.
 */
export function getAllEdges(graph: GraphState): Edge[] {
  return graph.edges;
}

/**
 * Get the count of edges in the graph.
 */
export function getEdgeCount(graph: GraphState): number {
  return graph.edges.length;
}

// =============================================================================
// Edge ID Operations
// =============================================================================

/**
 * Get an edge by its ID.
 * Uses index if available for O(1) lookup, otherwise O(n) scan.
 */
export function getEdgeById(graph: GraphState, id: string): Edge | undefined {
  // Use index if available
  if (graph.edgeIndex) {
    const index = graph.edgeIndex.get(id);
    if (index !== undefined) {
      return graph.edges[index];
    }
    return undefined;
  }
  // Fallback to linear scan
  return graph.edges.find((e) => e.id === id);
}

/**
 * Get an edge by its unique key (type:from:to).
 */
export function getEdgeByKey(
  graph: GraphState,
  type: EdgeType,
  from: string,
  to: string
): Edge | undefined {
  const key = edgeKey({ type, from, to });
  return graph.edges.find((e) => edgeKey(e) === key);
}

/**
 * Check if an edge with the given ID exists.
 */
export function hasEdgeById(graph: GraphState, id: string): boolean {
  if (graph.edgeIndex) {
    return graph.edgeIndex.has(id);
  }
  return graph.edges.some((e) => e.id === id);
}

/**
 * Rebuild the edge index for O(1) ID lookups.
 * Call this after batch edge mutations for performance.
 */
export function rebuildEdgeIndex(graph: GraphState): void {
  const index = new Map<string, number>();
  for (let i = 0; i < graph.edges.length; i++) {
    const edge = graph.edges[i];
    if (edge) {
      index.set(edge.id, i);
    }
  }
  graph.edgeIndex = index;
}

/**
 * Invalidate the edge index.
 * Call this when edges are mutated to ensure consistency.
 */
export function invalidateEdgeIndex(graph: GraphState): void {
  graph.edgeIndex = undefined;
}

/**
 * Filter options for querying edges.
 */
export interface EdgeFilters {
  type?: EdgeType | undefined;
  from?: string | undefined;
  to?: string | undefined;
  status?: EdgeStatus | undefined;
  hasOrder?: boolean | undefined;
  minConfidence?: number | undefined;
}

/**
 * Get edges matching the given filters.
 */
export function getEdgesWithFilters(
  graph: GraphState,
  filters: EdgeFilters
): Edge[] {
  return graph.edges.filter((e) => {
    if (filters.type && e.type !== filters.type) return false;
    if (filters.from && e.from !== filters.from) return false;
    if (filters.to && e.to !== filters.to) return false;
    if (filters.status && e.status !== filters.status) return false;
    if (filters.hasOrder !== undefined) {
      const hasOrder = e.properties?.order !== undefined;
      if (filters.hasOrder !== hasOrder) return false;
    }
    if (filters.minConfidence !== undefined) {
      const confidence = e.properties?.confidence ?? 0;
      if (confidence < filters.minConfidence) return false;
    }
    return true;
  });
}

/**
 * Get edges sorted by order property (for ordered relations).
 */
export function getEdgesSortedByOrder(edges: Edge[]): Edge[] {
  return [...edges].sort((a, b) => {
    const orderA = a.properties?.order ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.properties?.order ?? Number.MAX_SAFE_INTEGER;
    return orderA - orderB;
  });
}

// =============================================================================
// Query Helpers
// =============================================================================

/**
 * Get all nodes connected to a node via outgoing edges.
 */
export function getConnectedNodesFrom(
  graph: GraphState,
  nodeId: string
): KGNode[] {
  const edges = getEdgesFrom(graph, nodeId);
  const nodes: KGNode[] = [];
  for (const edge of edges) {
    const node = getNode(graph, edge.to);
    if (node) {
      nodes.push(node);
    }
  }
  return nodes;
}

/**
 * Get all nodes connected to a node via incoming edges.
 */
export function getConnectedNodesTo(
  graph: GraphState,
  nodeId: string
): KGNode[] {
  const edges = getEdgesTo(graph, nodeId);
  const nodes: KGNode[] = [];
  for (const edge of edges) {
    const node = getNode(graph, edge.from);
    if (node) {
      nodes.push(node);
    }
  }
  return nodes;
}

/**
 * Get target nodes connected via a specific edge type.
 */
export function getTargetNodes<T extends KGNode>(
  graph: GraphState,
  nodeId: string,
  edgeType: EdgeType
): T[] {
  const edges = getEdgesFromByType(graph, nodeId, edgeType);
  const nodes: T[] = [];
  for (const edge of edges) {
    const node = getNode(graph, edge.to);
    if (node) {
      nodes.push(node as T);
    }
  }
  return nodes;
}

/**
 * Get source nodes connected via a specific edge type.
 */
export function getSourceNodes<T extends KGNode>(
  graph: GraphState,
  nodeId: string,
  edgeType: EdgeType
): T[] {
  const edges = getEdgesToByType(graph, nodeId, edgeType);
  const nodes: T[] = [];
  for (const edge of edges) {
    const node = getNode(graph, edge.from);
    if (node) {
      nodes.push(node as T);
    }
  }
  return nodes;
}

// =============================================================================
// Graph Statistics
// =============================================================================

/**
 * Get statistics about the graph.
 */
export interface GraphStats {
  nodeCount: number;
  edgeCount: number;
  nodeCountByType: Record<string, number>;
  edgeCountByType: Record<string, number>;
}

export function getGraphStats(graph: GraphState): GraphStats {
  const nodeCountByType: Record<string, number> = {};
  const edgeCountByType: Record<string, number> = {};

  for (const node of graph.nodes.values()) {
    nodeCountByType[node.type] = (nodeCountByType[node.type] ?? 0) + 1;
  }

  for (const edge of graph.edges) {
    edgeCountByType[edge.type] = (edgeCountByType[edge.type] ?? 0) + 1;
  }

  return {
    nodeCount: graph.nodes.size,
    edgeCount: graph.edges.length,
    nodeCountByType,
    edgeCountByType,
  };
}
