/**
 * Hard Rules - Block commit until fixed.
 *
 * These rules enforce structural integrity of the screenplay graph.
 */

import type { GraphState } from '../core/graph.js';
import { getNodesByType } from '../core/graph.js';
import type { Beat, PlotPoint } from '../types/nodes.js';
import type { Rule, RuleViolation, Fix, LintScope } from './types.js';
import {
  getBeatsInScope,
  getScenesInScope,
  getActForBeat,
  getActForBeatId,
  getPositionForBeat,
  createViolation,
  generateFixId,
  getEdgesGroupedByParent,
  sortEdgesForReindex,
  isNodeInScope,
} from './utils.js';
import { createPatch, generateInversePatch, registerRule } from './engine.js';
import type { UpdateNodeOp, UpdateEdgeOp } from '../types/patch.js';
import type { Edge, EdgeType } from '../types/edges.js';
import { EDGE_TYPES } from '../types/edges.js';

// =============================================================================
// SCENE_ORDER_UNIQUE - REMOVED
// =============================================================================
// Scene ordering is now auto-computed via computeOrder() based on PlotPoint attachment.
// The order_index field is optional and automatically maintained.

// =============================================================================
// SCENE_ACT_BOUNDARY
// =============================================================================

/**
 * A Scene's beat_id must reference a Beat in the correct Act.
 * The expected act is determined by BEAT_ACT_MAP.
 */
export const SCENE_ACT_BOUNDARY: Rule = {
  id: 'SCENE_ACT_BOUNDARY',
  name: 'Scene Must Link to Beat in Correct Act',
  severity: 'hard',
  category: 'act_boundary',
  description: 'A scene cannot be linked to a beat with an incorrect act assignment',

  evaluate: (graph: GraphState, scope: LintScope): RuleViolation[] => {
    const violations: RuleViolation[] = [];
    const scenes = getScenesInScope(graph, scope);

    for (const scene of scenes) {
      // Skip scenes without beat_id (they use PlotPoint edges instead)
      if (!scene.beat_id) continue;
      const beat = graph.nodes.get(scene.beat_id) as Beat | undefined;
      if (!beat || beat.type !== 'Beat') continue;

      // Get expected act based on beat_type
      const expectedAct = getActForBeat(beat);

      if (beat.act !== expectedAct) {
        violations.push(
          createViolation(
            'SCENE_ACT_BOUNDARY',
            'hard',
            'act_boundary',
            `Scene "${scene.heading}" links to Beat "${beat.beat_type}" which is in Act ${beat.act} but should be in Act ${expectedAct}`,
            {
              nodeId: scene.id,
              nodeType: 'Scene',
              relatedNodeIds: [beat.id],
              context: {
                sceneHeading: scene.heading,
                beatType: beat.beat_type,
                actualAct: beat.act,
                expectedAct,
                beatId: beat.id,
              },
            }
          )
        );
      }
    }

    return violations;
  },

  suggestFix: (graph: GraphState, violation: RuleViolation): Fix | null => {
    // This violation is about the Beat's act being wrong, not the Scene's beat_id
    // The fix is to correct the Beat's act field
    const context = violation.context as {
      beatId?: string;
      expectedAct?: number;
    } | undefined;

    if (!context?.beatId || !context?.expectedAct) return null;

    const beat = graph.nodes.get(context.beatId) as Beat | undefined;
    if (!beat || beat.type !== 'Beat') return null;

    const ops: UpdateNodeOp[] = [
      {
        op: 'UPDATE_NODE' as const,
        id: beat.id,
        set: { act: context.expectedAct },
      },
    ];

    const patch = createPatch('', ops, {
      source: 'fix',
      ruleId: 'SCENE_ACT_BOUNDARY',
    });

    const inversePatch = generateInversePatch(graph, patch);

    return {
      id: generateFixId(violation.id, 'correct_act'),
      violationId: violation.id,
      violationRuleId: 'SCENE_ACT_BOUNDARY',
      label: `Set "${beat.beat_type}" to Act ${context.expectedAct}`,
      description: `Correct the beat's act assignment to match its beat_type`,
      patch,
      inversePatch,
      affectedNodeIds: [beat.id],
      operationCount: 1,
    };
  },
};

// =============================================================================
// STC_BEAT_ORDERING
// =============================================================================

/**
 * Beat position_index must follow Save The Cat order.
 * Each beat_type has a canonical position defined in BEAT_POSITION_MAP.
 */
export const STC_BEAT_ORDERING: Rule = {
  id: 'STC_BEAT_ORDERING',
  name: 'STC Beat Ordering',
  severity: 'hard',
  category: 'stc_ordering',
  description: 'Beats must follow Save The Cat structural positions',

  evaluate: (graph: GraphState, scope: LintScope): RuleViolation[] => {
    const violations: RuleViolation[] = [];
    const beats = getBeatsInScope(graph, scope);

    for (const beat of beats) {
      const expectedPosition = getPositionForBeat(beat);

      if (beat.position_index !== expectedPosition) {
        violations.push(
          createViolation(
            'STC_BEAT_ORDERING',
            'hard',
            'stc_ordering',
            `Beat "${beat.beat_type}" has position_index ${beat.position_index} but should be ${expectedPosition}`,
            {
              nodeId: beat.id,
              nodeType: 'Beat',
              field: 'position_index',
              context: {
                beatType: beat.beat_type,
                actualPosition: beat.position_index,
                expectedPosition,
              },
            }
          )
        );
      }
    }

    return violations;
  },

  suggestFix: (graph: GraphState, violation: RuleViolation): Fix | null => {
    const beatId = violation.nodeId;
    if (!beatId) return null;

    const beat = graph.nodes.get(beatId) as Beat | undefined;
    if (!beat || beat.type !== 'Beat') return null;

    const expectedPosition = getPositionForBeat(beat);

    const ops: UpdateNodeOp[] = [
      {
        op: 'UPDATE_NODE' as const,
        id: beat.id,
        set: { position_index: expectedPosition },
      },
    ];

    const patch = createPatch('', ops, {
      source: 'fix',
      ruleId: 'STC_BEAT_ORDERING',
    });

    const inversePatch = generateInversePatch(graph, patch);

    return {
      id: generateFixId(violation.id, 'correct_position'),
      violationId: violation.id,
      violationRuleId: 'STC_BEAT_ORDERING',
      label: `Set "${beat.beat_type}" to position ${expectedPosition}`,
      description: `Correct the beat's position_index to match STC structure`,
      patch,
      inversePatch,
      affectedNodeIds: [beat.id],
      operationCount: 1,
    };
  },
};

// =============================================================================
// EDGE_ORDER_UNIQUE
// =============================================================================

/**
 * Edges of the same type from the same parent must have unique order values.
 * Uniqueness key: (parentId, edgeType)
 * Fix: Auto-reindex edges (1, 2, 3...) maintaining relative order.
 */
export const EDGE_ORDER_UNIQUE: Rule = {
  id: 'EDGE_ORDER_UNIQUE',
  name: 'Edge Order Must Be Unique Per Parent',
  severity: 'hard',
  category: 'structure',
  description: 'Two edges of the same type from the same parent cannot share the same order',

  evaluate: (graph: GraphState, scope: LintScope): RuleViolation[] => {
    const violations: RuleViolation[] = [];

    // Check all edge types for order uniqueness
    for (const edgeType of EDGE_TYPES) {
      const grouped = getEdgesGroupedByParent(graph, edgeType);

      for (const [parentId, edges] of grouped) {
        // Skip if parent not in scope (for touched mode)
        if (scope.mode === 'touched' && !isNodeInScope(scope, parentId)) {
          continue;
        }

        // Only check edges that have an order property
        const orderedEdges = edges.filter((e) => e.properties?.order !== undefined);
        if (orderedEdges.length <= 1) continue;

        // Group edges by order value
        const orderMap = new Map<number, Edge[]>();
        for (const edge of orderedEdges) {
          const order = edge.properties!.order!;
          const existing = orderMap.get(order) ?? [];
          existing.push(edge);
          orderMap.set(order, existing);
        }

        // Find duplicates
        for (const [orderValue, duplicates] of orderMap) {
          if (duplicates.length > 1) {
            const parentNode = graph.nodes.get(parentId);
            const parentLabel = parentNode
              ? `${parentNode.type} "${(parentNode as Beat).beat_type || parentNode.id}"`
              : parentId;

            const violationOptions: {
              nodeId: string;
              nodeType?: string;
              field: string;
              relatedNodeIds: string[];
              context: Record<string, unknown>;
            } = {
              nodeId: parentId,
              field: 'properties.order',
              relatedNodeIds: duplicates.map((e) => e.id),
              context: {
                edgeType,
                parentId,
                orderValue,
                duplicateCount: duplicates.length,
                edgeIds: duplicates.map((e) => e.id),
              },
            };
            if (parentNode?.type) {
              violationOptions.nodeType = parentNode.type;
            }

            violations.push(
              createViolation(
                'EDGE_ORDER_UNIQUE',
                'hard',
                'structure',
                `${edgeType} edges on ${parentLabel} have ${duplicates.length} edges with order ${orderValue}`,
                violationOptions
              )
            );
          }
        }
      }
    }

    return violations;
  },

  suggestFix: (graph: GraphState, violation: RuleViolation): Fix | null => {
    const context = violation.context as {
      edgeType?: EdgeType;
      parentId?: string;
    } | undefined;

    if (!context?.edgeType || !context?.parentId) return null;

    const { edgeType, parentId } = context;

    // Get all edges of this type for this parent
    const grouped = getEdgesGroupedByParent(graph, edgeType);
    const edges = grouped.get(parentId);
    if (!edges || edges.length === 0) return null;

    // Only include edges that have order defined
    const orderedEdges = edges.filter((e) => e.properties?.order !== undefined);
    if (orderedEdges.length === 0) return null;

    // Sort edges for reindexing
    const sortedEdges = sortEdgesForReindex(orderedEdges);

    // Generate UPDATE_EDGE ops to assign sequential order values
    const ops: UpdateEdgeOp[] = sortedEdges.map((edge, idx) => ({
      op: 'UPDATE_EDGE' as const,
      id: edge.id,
      set: { order: idx + 1 },
    }));

    // Create the fix patch
    const patch = createPatch('', ops, {
      source: 'fix',
      ruleId: 'EDGE_ORDER_UNIQUE',
    });

    // Generate inverse patch for undo
    const inversePatch = generateInversePatch(graph, patch);

    const parentNode = graph.nodes.get(parentId);
    const parentLabel = parentNode
      ? `${parentNode.type} "${(parentNode as Beat).beat_type || parentNode.id}"`
      : parentId;

    return {
      id: generateFixId(violation.id, 'reindex'),
      violationId: violation.id,
      violationRuleId: 'EDGE_ORDER_UNIQUE',
      label: `Re-index ${sortedEdges.length} ${edgeType} edges on ${parentLabel}`,
      description: `Assign sequential order values (1, 2, 3...) to ${edgeType} edges`,
      patch,
      inversePatch,
      affectedNodeIds: sortedEdges.map((e) => e.id),
      operationCount: ops.length,
    };
  },
};

// =============================================================================
// PP_DAG_NO_CYCLES
// =============================================================================

/**
 * PRECEDES edges between PlotPoints must not create cycles.
 * The PRECEDES relationship forms a DAG (Directed Acyclic Graph).
 * No auto-fix available - user must decide which edge to remove.
 */
export const PP_DAG_NO_CYCLES: Rule = {
  id: 'PP_DAG_NO_CYCLES',
  name: 'PlotPoint PRECEDES Must Be Acyclic',
  severity: 'hard',
  category: 'structure',
  description: 'PRECEDES edges between plot points must not create cycles',

  evaluate: (graph: GraphState, scope: LintScope): RuleViolation[] => {
    const violations: RuleViolation[] = [];

    // Get all PRECEDES edges
    const precedesEdges = graph.edges.filter((e) => e.type === 'PRECEDES');
    if (precedesEdges.length === 0) return violations;

    // Build adjacency list
    const adjacency = new Map<string, string[]>();
    for (const edge of precedesEdges) {
      const existing = adjacency.get(edge.from) ?? [];
      existing.push(edge.to);
      adjacency.set(edge.from, existing);
    }

    // DFS cycle detection
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycleNodes = new Set<string>();

    function dfs(nodeId: string, path: string[]): boolean {
      if (recursionStack.has(nodeId)) {
        // Found a cycle - mark all nodes in the cycle
        const cycleStart = path.indexOf(nodeId);
        for (let i = cycleStart; i < path.length; i++) {
          const cycleNode = path[i];
          if (cycleNode !== undefined) {
            cycleNodes.add(cycleNode);
          }
        }
        cycleNodes.add(nodeId);
        return true;
      }

      if (visited.has(nodeId)) {
        return false;
      }

      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const neighbors = adjacency.get(nodeId) ?? [];
      for (const neighbor of neighbors) {
        if (dfs(neighbor, path)) {
          // Continue to find all cycle nodes
        }
      }

      path.pop();
      recursionStack.delete(nodeId);
      return false;
    }

    // Run DFS from all nodes with outgoing PRECEDES edges
    for (const nodeId of adjacency.keys()) {
      if (!visited.has(nodeId)) {
        dfs(nodeId, []);
      }
    }

    // Create violations for cycle nodes in scope
    for (const nodeId of cycleNodes) {
      if (!isNodeInScope(scope, nodeId)) continue;

      const plotPoint = graph.nodes.get(nodeId) as PlotPoint | undefined;
      if (!plotPoint || plotPoint.type !== 'PlotPoint') continue;

      violations.push(
        createViolation(
          'PP_DAG_NO_CYCLES',
          'hard',
          'structure',
          `PlotPoint "${plotPoint.title}" is part of a cycle in PRECEDES edges`,
          {
            nodeId: plotPoint.id,
            nodeType: 'PlotPoint',
            relatedNodeIds: [...cycleNodes].filter((id) => id !== nodeId),
            context: {
              plotPointTitle: plotPoint.title,
              cycleNodeIds: [...cycleNodes],
            },
          }
        )
      );
    }

    return violations;
  },

  // No auto-fix for cycle breaking - user must choose which edge to remove
  suggestFix: (): Fix | null => null,
};

// =============================================================================
// PP_ORDER_UNIQUE - REMOVED
// =============================================================================
// PlotPoint scene ordering is now auto-computed via computeOrder() based on SATISFIED_BY edges.
// The SATISFIED_BY edge properties.order is used for sorting within a PlotPoint.

// =============================================================================
// PP_ACT_ALIGNMENT
// =============================================================================

/**
 * If a PlotPoint has both an act field and an ALIGNS_WITH edge to a Beat,
 * the PlotPoint's act must match the Beat's act.
 * Fix: Update PlotPoint's act to match the aligned Beat.
 */
export const PP_ACT_ALIGNMENT: Rule = {
  id: 'PP_ACT_ALIGNMENT',
  name: 'PlotPoint Act Must Match Aligned Beat',
  severity: 'hard',
  category: 'act_boundary',
  description: 'If a plot point aligns with a beat, their act values must match',

  evaluate: (graph: GraphState, scope: LintScope): RuleViolation[] => {
    const violations: RuleViolation[] = [];
    const plotPoints = getNodesByType<PlotPoint>(graph, 'PlotPoint');

    for (const pp of plotPoints) {
      // Skip if not in scope
      if (!isNodeInScope(scope, pp.id)) continue;

      // Skip if no act is set on PlotPoint
      if (pp.act === undefined) continue;

      // Find ALIGNS_WITH edge from this PlotPoint
      const alignsWithEdge = graph.edges.find(
        (e) => e.type === 'ALIGNS_WITH' && e.from === pp.id
      );

      if (!alignsWithEdge) continue;

      // Get the aligned beat's act
      const beatAct = getActForBeatId(graph, alignsWithEdge.to);
      if (beatAct === undefined) continue;

      // Check if acts match
      if (pp.act !== beatAct) {
        const beat = graph.nodes.get(alignsWithEdge.to) as Beat | undefined;
        violations.push(
          createViolation(
            'PP_ACT_ALIGNMENT',
            'hard',
            'act_boundary',
            `PlotPoint "${pp.title}" is in Act ${pp.act} but aligns with Beat "${beat?.beat_type}" in Act ${beatAct}`,
            {
              nodeId: pp.id,
              nodeType: 'PlotPoint',
              field: 'act',
              relatedNodeIds: [alignsWithEdge.to],
              context: {
                plotPointId: pp.id,
                plotPointTitle: pp.title,
                plotPointAct: pp.act,
                beatId: alignsWithEdge.to,
                beatType: beat?.beat_type,
                beatAct,
              },
            }
          )
        );
      }
    }

    return violations;
  },

  suggestFix: (graph: GraphState, violation: RuleViolation): Fix | null => {
    const context = violation.context as {
      plotPointId?: string;
      plotPointTitle?: string;
      beatAct?: 1 | 2 | 3 | 4 | 5;
    } | undefined;

    if (!context?.plotPointId || !context?.beatAct) return null;

    const { plotPointId, beatAct } = context;

    const plotPoint = graph.nodes.get(plotPointId) as PlotPoint | undefined;
    if (!plotPoint || plotPoint.type !== 'PlotPoint') return null;

    const ops: UpdateNodeOp[] = [
      {
        op: 'UPDATE_NODE' as const,
        id: plotPointId,
        set: { act: beatAct },
      },
    ];

    const patch = createPatch('', ops, {
      source: 'fix',
      ruleId: 'PP_ACT_ALIGNMENT',
    });

    const inversePatch = generateInversePatch(graph, patch);

    return {
      id: generateFixId(violation.id, 'align_act'),
      violationId: violation.id,
      violationRuleId: 'PP_ACT_ALIGNMENT',
      label: `Set "${plotPoint.title}" to Act ${beatAct}`,
      description: `Update the plot point's act to match the aligned beat`,
      patch,
      inversePatch,
      affectedNodeIds: [plotPointId],
      operationCount: 1,
    };
  },
};

// =============================================================================
// Exports
// =============================================================================

/**
 * All hard rules that block commit.
 */
export const HARD_RULES: Rule[] = [
  // Note: SCENE_ORDER_UNIQUE and PP_ORDER_UNIQUE were removed
  // Scene and PlotPoint ordering is now auto-computed via computeOrder()
  SCENE_ACT_BOUNDARY,
  STC_BEAT_ORDERING,
  EDGE_ORDER_UNIQUE,
  PP_DAG_NO_CYCLES,
  PP_ACT_ALIGNMENT,
];

/**
 * Register all hard rules with the engine.
 */
export function registerHardRules(): void {
  for (const rule of HARD_RULES) {
    try {
      registerRule(rule);
    } catch {
      // Rule already registered
    }
  }
}
