/**
 * Utility functions for the Rule Engine.
 * Helpers for graph traversal, scope expansion, and ID generation.
 */

import type { GraphState } from '../core/graph.js';
import { getNode, getNodesByType, getEdgesFrom, getEdgesTo, getEdgesByType } from '../core/graph.js';
import type { Beat, Scene, PlotPoint } from '../types/nodes.js';
import { BEAT_ACT_MAP, BEAT_POSITION_MAP } from '../types/nodes.js';
import type { Edge, EdgeType } from '../types/edges.js';
import type { LintScope, RuleViolation } from './types.js';
import { SCOPE_EXPANSION_LIMIT } from './types.js';

// =============================================================================
// Edge Ordering Helpers
// =============================================================================

/**
 * Edge types where the parent (container) is the TARGET of the edge.
 * For these types, ordering is relative to the target node.
 *
 * Currently empty - all remaining edge types have the parent as source.
 */
export const PARENT_IS_TARGET_EDGE_TYPES: EdgeType[] = [];

/**
 * Get the parent node ID for an edge (the node that "contains" the ordered items).
 * For EXPRESSED_IN/APPEARS_IN: parent is `to` (target)
 * For all others: parent is `from` (source)
 */
export function getEdgeParentId(edge: Edge): string {
  if (PARENT_IS_TARGET_EDGE_TYPES.includes(edge.type)) {
    return edge.to;
  }
  return edge.from;
}

/**
 * Get the child node ID for an edge (the node being attached to the parent).
 */
export function getEdgeChildId(edge: Edge): string {
  if (PARENT_IS_TARGET_EDGE_TYPES.includes(edge.type)) {
    return edge.from;
  }
  return edge.to;
}

/**
 * Check if a parent node is the source or target for a given edge type.
 */
export function isParentSource(edgeType: EdgeType): boolean {
  return !PARENT_IS_TARGET_EDGE_TYPES.includes(edgeType);
}

/**
 * Get all edges of a given type grouped by parent node.
 * Returns Map<parentId, Edge[]> where edges are from the same parent.
 */
export function getEdgesGroupedByParent(
  graph: GraphState,
  edgeType: EdgeType
): Map<string, Edge[]> {
  const grouped = new Map<string, Edge[]>();

  for (const edge of graph.edges) {
    if (edge.type !== edgeType) continue;

    const parentId = getEdgeParentId(edge);
    const existing = grouped.get(parentId) ?? [];
    existing.push(edge);
    grouped.set(parentId, existing);
  }

  return grouped;
}

/**
 * Get all edges of a given type for a specific parent node.
 */
export function getEdgesForParent(
  graph: GraphState,
  edgeType: EdgeType,
  parentId: string
): Edge[] {
  const parentIsSource = isParentSource(edgeType);

  return graph.edges.filter((edge) => {
    if (edge.type !== edgeType) return false;
    const edgeParentId = parentIsSource ? edge.from : edge.to;
    return edgeParentId === parentId;
  });
}

/**
 * Sort edges for reindexing by (order ?? +∞, createdAt, id).
 * Same canonical order as sortScenesForReindex.
 */
export function sortEdgesForReindex(edges: Edge[]): Edge[] {
  return [...edges].sort((a, b) => {
    // Primary: order (undefined treated as +∞)
    const orderA = a.properties?.order ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.properties?.order ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) {
      return orderA - orderB;
    }

    // Secondary: createdAt (if available)
    if (a.createdAt && b.createdAt) {
      const timeCompare = a.createdAt.localeCompare(b.createdAt);
      if (timeCompare !== 0) return timeCompare;
    }

    // Tertiary: id as tiebreaker
    return a.id.localeCompare(b.id);
  });
}

// =============================================================================
// Stable ID Generation
// =============================================================================

/**
 * Generate a stable hash from a string.
 * Uses djb2 algorithm for deterministic hashing.
 */
export function stableHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) + hash) ^ char;
  }
  // Convert to positive hex string
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Generate a stable violation ID from rule ID, node ID, and context.
 */
export function generateViolationId(
  ruleId: string,
  nodeId: string | undefined,
  context: Record<string, unknown> | undefined
): string {
  const contextStr = context ? JSON.stringify(context) : '';
  const input = `${ruleId}:${nodeId ?? ''}:${contextStr}`;
  return `viol_${stableHash(input)}`;
}

/**
 * Generate a stable fix ID from violation ID and fix type.
 */
export function generateFixId(violationId: string, fixType: string): string {
  const input = `${violationId}:${fixType}`;
  return `fix_${stableHash(input)}`;
}

// =============================================================================
// Beat/Scene Helpers
// =============================================================================

/**
 * Get the expected act for a beat based on its beat_type.
 * Single source of truth for act assignment.
 */
export function getActForBeat(beat: Beat): 1 | 2 | 3 | 4 | 5 {
  return BEAT_ACT_MAP[beat.beat_type];
}

/**
 * Get the expected act for a beat ID.
 */
export function getActForBeatId(graph: GraphState, beatId: string): (1 | 2 | 3 | 4 | 5) | undefined {
  const beat = getNode(graph, beatId) as Beat | undefined;
  if (!beat || beat.type !== 'Beat') return undefined;
  return getActForBeat(beat);
}

/**
 * Get the expected position_index for a beat based on its beat_type.
 */
export function getPositionForBeat(beat: Beat): number {
  return BEAT_POSITION_MAP[beat.beat_type];
}

/**
 * Get all scenes linked to a beat (includes both edge-based and beat_id-based).
 * Scenes can be linked via: PlotPoint → SATISFIED_BY → Scene, where PlotPoint → ALIGNS_WITH → Beat
 * Or via the deprecated beat_id field.
 */
export function getScenesByBeat(graph: GraphState, beatId: string): Scene[] {
  const sceneIds = new Set<string>();

  // 1. Get scenes via PlotPoint edge chain
  // Find PlotPoints aligned to this beat
  const alignsWithEdges = getEdgesByType(graph, 'ALIGNS_WITH');
  for (const edge of alignsWithEdges) {
    if (edge.to === beatId) {
      // This PlotPoint aligns with our beat
      const plotPointId = edge.from;
      // Find scenes satisfied by this PlotPoint
      const satisfiedByEdges = getEdgesByType(graph, 'SATISFIED_BY');
      for (const satEdge of satisfiedByEdges) {
        if (satEdge.from === plotPointId) {
          sceneIds.add(satEdge.to);
        }
      }
    }
  }

  // 2. Add scenes via beat_id (deprecated fallback)
  const allScenes = getNodesByType<Scene>(graph, 'Scene');
  for (const scene of allScenes) {
    if (scene.beat_id === beatId) {
      sceneIds.add(scene.id);
    }
  }

  // Return unique scenes
  return Array.from(sceneIds)
    .map((id) => getNode(graph, id) as Scene | undefined)
    .filter((s): s is Scene => s !== undefined);
}

/**
 * Get the beat for a scene.
 * Primary: Scene ← SATISFIED_BY ← PlotPoint → ALIGNS_WITH → Beat
 * Fallback: scene.beat_id (deprecated)
 */
export function getBeatForScene(graph: GraphState, scene: Scene): Beat | undefined {
  // 1. Try edge chain: find PlotPoints that satisfy this scene
  const satisfiedByEdges = getEdgesByType(graph, 'SATISFIED_BY');
  for (const edge of satisfiedByEdges) {
    if (edge.to === scene.id) {
      // Found a PlotPoint that satisfies this scene
      const plotPointId = edge.from;
      // Find the beat this PlotPoint aligns with
      const alignsWithEdges = getEdgesByType(graph, 'ALIGNS_WITH');
      for (const alignEdge of alignsWithEdges) {
        if (alignEdge.from === plotPointId) {
          const beat = getNode(graph, alignEdge.to);
          if (beat?.type === 'Beat') {
            return beat as Beat;
          }
        }
      }
    }
  }

  // 2. Fallback to beat_id (deprecated)
  if (scene.beat_id) {
    return getNode(graph, scene.beat_id) as Beat | undefined;
  }

  return undefined;
}

/**
 * Get all scenes that satisfy a PlotPoint via SATISFIED_BY edges.
 */
export function getScenesForPlotPoint(graph: GraphState, plotPointId: string): Scene[] {
  const satisfiedByEdges = getEdgesByType(graph, 'SATISFIED_BY');
  const scenes: Scene[] = [];
  for (const edge of satisfiedByEdges) {
    if (edge.from === plotPointId) {
      const scene = getNode(graph, edge.to);
      if (scene?.type === 'Scene') {
        scenes.push(scene as Scene);
      }
    }
  }
  return scenes;
}

/**
 * Get the PlotPoints that satisfy a scene via SATISFIED_BY edges.
 */
export function getPlotPointsForScene(graph: GraphState, sceneId: string): PlotPoint[] {
  const satisfiedByEdges = getEdgesByType(graph, 'SATISFIED_BY');
  const plotPoints: PlotPoint[] = [];
  for (const edge of satisfiedByEdges) {
    if (edge.to === sceneId) {
      const pp = getNode(graph, edge.from);
      if (pp?.type === 'PlotPoint') {
        plotPoints.push(pp as PlotPoint);
      }
    }
  }
  return plotPoints;
}

/**
 * Get all beats in a specific act.
 */
export function getBeatsByAct(graph: GraphState, act: 1 | 2 | 3 | 4 | 5): Beat[] {
  return getNodesByType<Beat>(graph, 'Beat').filter((beat) => beat.act === act);
}

/**
 * Get all scenes in a specific act (via their beats).
 * Uses getBeatForScene to handle both edge-based and beat_id-based lookups.
 */
export function getScenesByAct(graph: GraphState, act: 1 | 2 | 3 | 4 | 5): Scene[] {
  const scenes = getNodesByType<Scene>(graph, 'Scene');
  return scenes.filter((scene) => {
    const beat = getBeatForScene(graph, scene);
    return beat && beat.act === act;
  });
}

// =============================================================================
// Scope Expansion
// =============================================================================

/**
 * Expand a touched scope to include incident edges and enclosing beat.
 * Implements guardrail: caps at SCOPE_EXPANSION_LIMIT nodes/edges.
 */
export function expandScope(graph: GraphState, scope: LintScope): LintScope {
  // Full mode doesn't need expansion
  if (scope.mode === 'full') {
    return scope;
  }

  const touchedNodeIds = scope.touchedNodeIds ?? [];
  const touchedEdgeIds = scope.touchedEdgeIds ?? [];

  // If nothing touched, return as-is
  if (touchedNodeIds.length === 0 && touchedEdgeIds.length === 0) {
    return scope;
  }

  const expandedNodeIds = new Set<string>(touchedNodeIds);
  let truncated = false;

  // Add nodes from touched edges
  for (const edgeId of touchedEdgeIds) {
    const edge = graph.edges.find((e) => e.id === edgeId);
    if (edge) {
      expandedNodeIds.add(edge.from);
      expandedNodeIds.add(edge.to);
    }
  }

  // Expand to include incident edges and enclosing beats
  const nodesToExpand = [...expandedNodeIds];
  for (const nodeId of nodesToExpand) {
    // Check guardrail
    if (expandedNodeIds.size >= SCOPE_EXPANSION_LIMIT) {
      truncated = true;
      break;
    }

    const node = getNode(graph, nodeId);
    if (!node) continue;

    // For scenes, add the enclosing beat
    if (node.type === 'Scene') {
      const scene = node as Scene;
      const beat = getBeatForScene(graph, scene);
      if (beat) {
        expandedNodeIds.add(beat.id);

        // Also add other scenes in the same beat (for order uniqueness check)
        const siblingScenes = getScenesByBeat(graph, beat.id);
        for (const sibling of siblingScenes) {
          if (expandedNodeIds.size >= SCOPE_EXPANSION_LIMIT) {
            truncated = true;
            break;
          }
          expandedNodeIds.add(sibling.id);
        }
      }
    }

    // Add nodes connected via edges (limited fan-out)
    const outEdges = getEdgesFrom(graph, nodeId);
    const inEdges = getEdgesTo(graph, nodeId);

    for (const edge of [...outEdges, ...inEdges]) {
      if (expandedNodeIds.size >= SCOPE_EXPANSION_LIMIT) {
        truncated = true;
        break;
      }
      expandedNodeIds.add(edge.from);
      expandedNodeIds.add(edge.to);
    }
  }

  return {
    ...scope,
    expandedNodeIds: Array.from(expandedNodeIds),
    truncated,
  };
}

/**
 * Check if a node is in scope for linting.
 */
export function isNodeInScope(scope: LintScope, nodeId: string): boolean {
  if (scope.mode === 'full') {
    return true;
  }

  // Check expanded scope first, then touched
  if (scope.expandedNodeIds?.includes(nodeId)) {
    return true;
  }
  if (scope.touchedNodeIds?.includes(nodeId)) {
    return true;
  }

  return false;
}

/**
 * Get all beats in scope.
 */
export function getBeatsInScope(graph: GraphState, scope: LintScope): Beat[] {
  const allBeats = getNodesByType<Beat>(graph, 'Beat');
  if (scope.mode === 'full') {
    return allBeats;
  }
  return allBeats.filter((beat) => isNodeInScope(scope, beat.id));
}

/**
 * Get all scenes in scope.
 */
export function getScenesInScope(graph: GraphState, scope: LintScope): Scene[] {
  const allScenes = getNodesByType<Scene>(graph, 'Scene');
  if (scope.mode === 'full') {
    return allScenes;
  }
  return allScenes.filter((scene) => isNodeInScope(scope, scene.id));
}

// =============================================================================
// Reindex Helpers
// =============================================================================

/**
 * Sort scenes by (order ?? +∞, createdAt, id) for reindexing.
 * This is the canonical order for scene reindexing.
 */
export function sortScenesForReindex(scenes: Scene[]): Scene[] {
  return [...scenes].sort((a, b) => {
    // Primary: order_index (undefined treated as +∞)
    const orderA = a.order_index ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.order_index ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) {
      return orderA - orderB;
    }

    // Secondary: createdAt (if available - fall back to ID)
    // Note: Scene doesn't have createdAt, so we use ID as tiebreaker
    return a.id.localeCompare(b.id);
  });
}

// =============================================================================
// Violation Helpers
// =============================================================================

/**
 * Create a violation with generated ID.
 */
export function createViolation(
  ruleId: string,
  severity: 'hard' | 'soft',
  category: RuleViolation['category'],
  message: string,
  options?: {
    nodeId?: string;
    nodeType?: string;
    field?: string;
    relatedNodeIds?: string[];
    context?: Record<string, unknown>;
  }
): RuleViolation {
  const nodeId = options?.nodeId;
  const context = options?.context;

  const violation: RuleViolation = {
    id: generateViolationId(ruleId, nodeId, context),
    ruleId,
    severity,
    category,
    message,
  };

  // Only add optional properties if they have values
  if (nodeId !== undefined) {
    violation.nodeId = nodeId;
  }
  if (options?.nodeType !== undefined) {
    violation.nodeType = options.nodeType;
  }
  if (options?.field !== undefined) {
    violation.field = options.field;
  }
  if (options?.relatedNodeIds !== undefined) {
    violation.relatedNodeIds = options.relatedNodeIds;
  }
  if (context !== undefined) {
    violation.context = context;
  }

  return violation;
}
