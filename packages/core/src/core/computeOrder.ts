/**
 * Auto-compute order_index for PlotPoints and Scenes based on attachment relationships.
 *
 * PlotPoint ordering:
 * - When aligned to Beat via alignedBeatId property → gets order_index
 * - Order determined by Beat's position_index (1-15 for STC beats)
 * - Multiple PlotPoints on same Beat: sort by PlotPoint createdAt, then ID
 *
 * Scene ordering:
 * - When attached to PlotPoint via REALIZED_BY edge → gets order_index
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

  // Step 2: Build Beat → PlotPoints map from alignedBeatId property
  const allPlotPoints = getNodesByType<PlotPoint>(graph, 'PlotPoint');
  const plotPointsByBeat = new Map<string, PlotPoint[]>();
  for (const pp of allPlotPoints) {
    if (pp.alignedBeatId) {
      const existing = plotPointsByBeat.get(pp.alignedBeatId) || [];
      existing.push(pp);
      plotPointsByBeat.set(pp.alignedBeatId, existing);
    }
  }

  // Step 3: Get REALIZED_BY edges (PlotPoint → Scene)
  const realizedByEdges = getEdgesByType(graph, 'REALIZED_BY');

  // Build PlotPoint → Scene edges map
  const edgesByPlotPoint = new Map<string, Edge[]>();
  for (const edge of realizedByEdges) {
    const ppId = edge.from;
    const existing = edgesByPlotPoint.get(ppId) || [];
    existing.push(edge);
    edgesByPlotPoint.set(ppId, existing);
  }

  // Step 4: Compute PlotPoint orders
  let ppOrderCounter = 1;

  for (const beat of beats) {
    const pps = plotPointsByBeat.get(beat.id) || [];

    // Sort PlotPoints by: createdAt, then ID
    const sortedPPs = sortPlotPointsByCreation(pps);

    for (const pp of sortedPPs) {
      plotPointOrders.set(pp.id, ppOrderCounter++);
    }
  }

  // Mark unaligned PlotPoints as undefined
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
    const sortedEdges = sortRealizedByEdges(edges);

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
 * Sort PlotPoints by: createdAt, then ID.
 */
function sortPlotPointsByCreation(plotPoints: PlotPoint[]): PlotPoint[] {
  return [...plotPoints].sort((a, b) => {
    // Primary: PlotPoint createdAt
    if (a.createdAt && b.createdAt) {
      const cmp = a.createdAt.localeCompare(b.createdAt);
      if (cmp !== 0) return cmp;
    } else if (a.createdAt) {
      return -1;
    } else if (b.createdAt) {
      return 1;
    }

    // Secondary: PlotPoint ID
    return a.id.localeCompare(b.id);
  });
}

/**
 * Sort REALIZED_BY edges by: properties.order, then createdAt, then ID.
 */
function sortRealizedByEdges(edges: Edge[]): Edge[] {
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
