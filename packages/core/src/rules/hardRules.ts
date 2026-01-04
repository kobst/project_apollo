/**
 * Hard Rules - Block commit until fixed.
 *
 * These rules enforce structural integrity of the screenplay graph.
 */

import type { GraphState } from '../core/graph.js';
import type { Beat, Scene } from '../types/nodes.js';
import type { Rule, RuleViolation, Fix, LintScope } from './types.js';
import {
  getScenesByBeat,
  getBeatsInScope,
  getScenesInScope,
  getActForBeat,
  getPositionForBeat,
  createViolation,
  sortScenesForReindex,
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
// SCENE_ORDER_UNIQUE
// =============================================================================

/**
 * Scenes within a Beat must have unique order_index values.
 * Fix: Auto-reindex scenes (1, 2, 3...) maintaining relative order.
 */
export const SCENE_ORDER_UNIQUE: Rule = {
  id: 'SCENE_ORDER_UNIQUE',
  name: 'Scene Order Must Be Unique Within Beat',
  severity: 'hard',
  category: 'structure',
  description: 'Two scenes in the same beat cannot share the same order_index',

  evaluate: (graph: GraphState, scope: LintScope): RuleViolation[] => {
    const violations: RuleViolation[] = [];
    const beats = getBeatsInScope(graph, scope);

    for (const beat of beats) {
      const scenes = getScenesByBeat(graph, beat.id);
      if (scenes.length <= 1) continue;

      // Group scenes by order_index
      const orderMap = new Map<number, Scene[]>();
      for (const scene of scenes) {
        const order = scene.order_index;
        const existing = orderMap.get(order) ?? [];
        existing.push(scene);
        orderMap.set(order, existing);
      }

      // Find duplicates
      for (const [orderIndex, duplicates] of orderMap) {
        if (duplicates.length > 1) {
          violations.push(
            createViolation(
              'SCENE_ORDER_UNIQUE',
              'hard',
              'structure',
              `Beat "${beat.beat_type}" has ${duplicates.length} scenes with order_index ${orderIndex}`,
              {
                nodeId: beat.id,
                nodeType: 'Beat',
                field: 'order_index',
                relatedNodeIds: duplicates.map((s) => s.id),
                context: {
                  beatType: beat.beat_type,
                  orderIndex,
                  duplicateCount: duplicates.length,
                  sceneIds: duplicates.map((s) => s.id),
                },
              }
            )
          );
        }
      }
    }

    return violations;
  },

  suggestFix: (graph: GraphState, violation: RuleViolation): Fix | null => {
    const beatId = violation.nodeId;
    if (!beatId) return null;

    const beat = graph.nodes.get(beatId) as Beat | undefined;
    if (!beat || beat.type !== 'Beat') return null;

    // Get all scenes for this beat and sort them for reindexing
    const scenes = getScenesByBeat(graph, beatId);
    if (scenes.length === 0) return null;

    const sortedScenes = sortScenesForReindex(scenes);

    // Generate UPDATE_NODE ops to assign sequential order_index values
    const ops: UpdateNodeOp[] = sortedScenes.map((scene, idx) => ({
      op: 'UPDATE_NODE' as const,
      id: scene.id,
      set: { order_index: idx + 1 },
    }));

    // Create the fix patch
    const patch = createPatch('', ops, {
      source: 'fix',
      ruleId: 'SCENE_ORDER_UNIQUE',
    });

    // Generate inverse patch for undo
    const inversePatch = generateInversePatch(graph, patch);

    return {
      id: generateFixId(violation.id, 'reindex'),
      violationId: violation.id,
      violationRuleId: 'SCENE_ORDER_UNIQUE',
      label: `Re-index ${scenes.length} scenes in "${beat.beat_type}"`,
      description: `Assign sequential order_index values (1, 2, 3...) to scenes in this beat`,
      patch,
      inversePatch,
      affectedNodeIds: sortedScenes.map((s) => s.id),
      operationCount: ops.length,
    };
  },
};

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
// Exports
// =============================================================================

/**
 * All hard rules that block commit.
 */
export const HARD_RULES: Rule[] = [
  SCENE_ORDER_UNIQUE,
  SCENE_ACT_BOUNDARY,
  STC_BEAT_ORDERING,
  EDGE_ORDER_UNIQUE,
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
