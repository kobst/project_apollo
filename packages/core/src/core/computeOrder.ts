/**
 * Auto-compute order_index for PlotPoints and Scenes based on attachment relationships.
 *
 * PlotPoint ordering:
 * - When attached to Beat via ALIGNS_WITH edge → gets order_index
 * - Order determined by Beat's position_index (1-15 for STC beats)
 * - Multiple PlotPoints on same Beat: sort by edge createdAt, then PP createdAt, then ID
 *
 * Scene ordering:
 * - When attached to PlotPoint via SATISFIED_BY edge → gets order_index
 * - Global screenplay order: Beat position → PlotPoint order → Scene order within PP
 * - Unattached items have order_index = undefined
 */

import type { GraphState } from './graph.js';
import { getNodesByType, getEdgesByType, getNode } from './graph.js';
import type { Beat, PlotPoint, Scene } from '../types/nodes.js';
import type { Edge } from '../types/edges.js';
import type { UpdateNodeOp } from '../types/patch.js';

// =============================================================================
// Types
// =============================================================================

export interface ComputeOrderResult {
  /** Map of PlotPoint ID to computed order_index (undefined if unaligned) */
  plotPointOrders: Map<string, number | undefined>;
  /** Map of Scene ID to computed order_index (undefined if unattached) */
  sceneOrders: Map<string, number | undefined>;
  /** Update operations to apply the new orders (only includes changed values) */
  ops: UpdateNodeOp[];
}

// =============================================================================
// Main Function
// =============================================================================

/**
 * Compute order_index for all PlotPoints and Scenes based on their attachment relationships.
 *
 * @param graph - The current graph state
 * @returns Computed orders and update operations
 */
export function computeOrder(graph: GraphState): ComputeOrderResult {
  const plotPointOrders = new Map<string, number | undefined>();
  const sceneOrders = new Map<string, number | undefined>();
  const ops: UpdateNodeOp[] = [];

  // Step 1: Get all Beats sorted by position_index (1-15)
  const beats = getNodesByType<Beat>(graph, 'Beat').sort(
    (a, b) => a.position_index - b.position_index
  );

  // Step 2: Get ALIGNS_WITH edges (PlotPoint → Beat)
  const alignsWithEdges = getEdgesByType(graph, 'ALIGNS_WITH');

  // Build Beat → PlotPoint edges map
  const edgesByBeat = new Map<string, Edge[]>();
  for (const edge of alignsWithEdges) {
    const beatId = edge.to;
    const existing = edgesByBeat.get(beatId) || [];
    existing.push(edge);
    edgesByBeat.set(beatId, existing);
  }

  // Step 3: Get SATISFIED_BY edges (PlotPoint → Scene)
  const satisfiedByEdges = getEdgesByType(graph, 'SATISFIED_BY');

  // Build PlotPoint → Scene edges map
  const edgesByPlotPoint = new Map<string, Edge[]>();
  for (const edge of satisfiedByEdges) {
    const ppId = edge.from;
    const existing = edgesByPlotPoint.get(ppId) || [];
    existing.push(edge);
    edgesByPlotPoint.set(ppId, existing);
  }

  // Step 4: Compute PlotPoint orders
  let ppOrderCounter = 1;

  for (const beat of beats) {
    const edges = edgesByBeat.get(beat.id) || [];

    // Sort edges by: edge createdAt, then PlotPoint createdAt, then ID
    const sortedEdges = sortEdgesByCreation(graph, edges);

    for (const edge of sortedEdges) {
      const ppId = edge.from;
      plotPointOrders.set(ppId, ppOrderCounter++);
    }
  }

  // Mark unaligned PlotPoints as undefined
  const allPlotPoints = getNodesByType<PlotPoint>(graph, 'PlotPoint');
  for (const pp of allPlotPoints) {
    if (!plotPointOrders.has(pp.id)) {
      plotPointOrders.set(pp.id, undefined);
    }
  }

  // Step 5: Compute Scene orders
  let sceneOrderCounter = 1;

  // Get PlotPoints in order
  const orderedPPs = Array.from(plotPointOrders.entries())
    .filter(([_, order]) => order !== undefined)
    .sort((a, b) => a[1]! - b[1]!);

  // Track which scenes have been assigned an order (for multi-PP case)
  const assignedScenes = new Set<string>();

  for (const [ppId] of orderedPPs) {
    const edges = edgesByPlotPoint.get(ppId) || [];

    // Sort by: edge properties.order, then edge createdAt, then ID
    const sortedEdges = sortSatisfiedByEdges(edges);

    for (const edge of sortedEdges) {
      const sceneId = edge.to;
      // Only assign if not already assigned (handles multi-PP case)
      if (!assignedScenes.has(sceneId)) {
        sceneOrders.set(sceneId, sceneOrderCounter++);
        assignedScenes.add(sceneId);
      }
    }
  }

  // Mark unattached Scenes as undefined
  const allScenes = getNodesByType<Scene>(graph, 'Scene');
  for (const scene of allScenes) {
    if (!sceneOrders.has(scene.id)) {
      sceneOrders.set(scene.id, undefined);
    }
  }

  // Step 6: Generate update operations for changed values
  for (const [ppId, newOrder] of plotPointOrders) {
    const pp = getNode(graph, ppId) as PlotPoint | undefined;
    if (pp && pp.order_index !== newOrder) {
      ops.push({
        op: 'UPDATE_NODE',
        id: ppId,
        set: { order_index: newOrder },
      });
    }
  }

  for (const [sceneId, newOrder] of sceneOrders) {
    const scene = getNode(graph, sceneId) as Scene | undefined;
    if (scene && scene.order_index !== newOrder) {
      ops.push({
        op: 'UPDATE_NODE',
        id: sceneId,
        set: { order_index: newOrder },
      });
    }
  }

  return { plotPointOrders, sceneOrders, ops };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Sort ALIGNS_WITH edges by: edge createdAt, then PlotPoint createdAt, then ID.
 */
function sortEdgesByCreation(graph: GraphState, edges: Edge[]): Edge[] {
  return [...edges].sort((a, b) => {
    // Primary: edge createdAt
    if (a.createdAt && b.createdAt) {
      const cmp = a.createdAt.localeCompare(b.createdAt);
      if (cmp !== 0) return cmp;
    } else if (a.createdAt) {
      return -1;
    } else if (b.createdAt) {
      return 1;
    }

    // Secondary: PlotPoint createdAt
    const ppA = getNode(graph, a.from) as PlotPoint | undefined;
    const ppB = getNode(graph, b.from) as PlotPoint | undefined;
    if (ppA?.createdAt && ppB?.createdAt) {
      const cmp = ppA.createdAt.localeCompare(ppB.createdAt);
      if (cmp !== 0) return cmp;
    }

    // Tertiary: PlotPoint ID
    return a.from.localeCompare(b.from);
  });
}

/**
 * Sort SATISFIED_BY edges by: properties.order, then createdAt, then ID.
 */
function sortSatisfiedByEdges(edges: Edge[]): Edge[] {
  return [...edges].sort((a, b) => {
    // Primary: properties.order
    const orderA = a.properties?.order ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.properties?.order ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;

    // Secondary: edge createdAt
    if (a.createdAt && b.createdAt) {
      const cmp = a.createdAt.localeCompare(b.createdAt);
      if (cmp !== 0) return cmp;
    } else if (a.createdAt) {
      return -1;
    } else if (b.createdAt) {
      return 1;
    }

    // Tertiary: edge ID
    return a.id.localeCompare(b.id);
  });
}

/**
 * Apply computed order updates to a graph.
 * Returns a new graph with updated order_index values.
 */
export function applyOrderUpdates(
  graph: GraphState,
  result: ComputeOrderResult
): GraphState {
  if (result.ops.length === 0) {
    return graph;
  }

  // Clone the graph
  const newGraph: GraphState = {
    nodes: new Map(graph.nodes),
    edges: [...graph.edges],
  };

  // Apply updates
  for (const op of result.ops) {
    const node = newGraph.nodes.get(op.id);
    if (node) {
      const updated = { ...node, ...op.set };
      newGraph.nodes.set(op.id, updated);
    }
  }

  return newGraph;
}
