/**
 * In-memory graph store for the screenplay knowledge graph.
 */

import type { KGNode } from '../types/patch.js';
import type { Edge, EdgeType } from '../types/edges.js';

// =============================================================================
// Graph State
// =============================================================================

/**
 * Represents the state of the knowledge graph.
 */
export interface GraphState {
  nodes: Map<string, KGNode>;
  edges: Edge[];
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
