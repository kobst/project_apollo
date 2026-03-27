/**
 * Soft Rules - Warnings that don't block commit.
 *
 * These rules identify quality issues and missing connections.
 */

import type { GraphState } from '../core/graph.js';
import { getNodesByType } from '../core/graph.js';
import type { PlotPoint } from '../types/nodes.js';
import type { Rule, RuleViolation, LintScope } from './types.js';
import { getScenesInScope, isNodeInScope, createViolation } from './utils.js';
import { registerRule } from './engine.js';

// =============================================================================
// SCENE_HAS_CHARACTER
// =============================================================================

/**
 * Scene should have at least one character (HAS_CHARACTER edge).
 * This is a soft rule because early drafts may not have characters assigned.
 */
export const SCENE_HAS_CHARACTER: Rule = {
  id: 'SCENE_HAS_CHARACTER',
  name: 'Scene Should Have At Least One Character',
  severity: 'soft',
  category: 'completeness',
  description: 'Scenes typically feature at least one character',

  evaluate: (graph: GraphState, scope: LintScope): RuleViolation[] => {
    const violations: RuleViolation[] = [];
    const scenes = getScenesInScope(graph, scope);

    for (const scene of scenes) {
      // Check for HAS_CHARACTER edges from this scene
      const characterEdges = graph.edges.filter(
        (e) => e.type === 'HAS_CHARACTER' && e.from === scene.id
      );

      if (characterEdges.length === 0) {
        violations.push(
          createViolation(
            'SCENE_HAS_CHARACTER',
            'soft',
            'completeness',
            `Scene "${scene.heading}" has no characters assigned`,
            {
              nodeId: scene.id,
              nodeType: 'Scene',
              context: {
                sceneHeading: scene.heading,
              },
            }
          )
        );
      }
    }

    return violations;
  },
};

// =============================================================================
// SCENE_HAS_LOCATION
// =============================================================================

/**
 * Scene should have a location (LOCATED_AT edge).
 * This is a soft rule because early drafts may not have locations assigned.
 */
export const SCENE_HAS_LOCATION: Rule = {
  id: 'SCENE_HAS_LOCATION',
  name: 'Scene Should Have a Location',
  severity: 'soft',
  category: 'completeness',
  description: 'Scenes should have a location assigned',

  evaluate: (graph: GraphState, scope: LintScope): RuleViolation[] => {
    const violations: RuleViolation[] = [];
    const scenes = getScenesInScope(graph, scope);

    for (const scene of scenes) {
      // Check for LOCATED_AT edges from this scene
      const locationEdges = graph.edges.filter(
        (e) => e.type === 'LOCATED_AT' && e.from === scene.id
      );

      if (locationEdges.length === 0) {
        violations.push(
          createViolation(
            'SCENE_HAS_LOCATION',
            'soft',
            'completeness',
            `Scene "${scene.heading}" has no location assigned`,
            {
              nodeId: scene.id,
              nodeType: 'Scene',
              context: {
                sceneHeading: scene.heading,
              },
            }
          )
        );
      }
    }

    return violations;
  },
};


// =============================================================================
// PP_EVENT_REALIZATION
// =============================================================================

/**
 * Approved PlotPoints should have at least one REALIZED_BY edge to a scene.
 * This ensures that approved plot points are realized in the narrative.
 */
export const PP_EVENT_REALIZATION: Rule = {
  id: 'PP_EVENT_REALIZATION',
  name: 'Approved PlotPoint Should Have Scene',
  severity: 'soft',
  category: 'completeness',
  description: 'Approved plot points should be realized by at least one scene',

  evaluate: (graph: GraphState, scope: LintScope): RuleViolation[] => {
    const violations: RuleViolation[] = [];
    const plotPoints = getNodesByType<PlotPoint>(graph, 'PlotPoint');

    for (const pp of plotPoints) {
      // Skip if not in scope
      if (!isNodeInScope(scope, pp.id)) continue;

      // Only check approved plot points
      if (pp.status !== 'approved') continue;

      // Check for REALIZED_BY edges from this plot point
      const realizedByEdges = graph.edges.filter(
        (e) => e.type === 'REALIZED_BY' && e.from === pp.id
      );

      if (realizedByEdges.length === 0) {
        violations.push(
          createViolation(
            'PP_EVENT_REALIZATION',
            'soft',
            'completeness',
            `Approved PlotPoint "${pp.title}" has no scenes realizing it`,
            {
              nodeId: pp.id,
              nodeType: 'PlotPoint',
              context: {
                plotPointTitle: pp.title,
                plotPointStatus: pp.status,
              },
            }
          )
        );
      }
    }

    return violations;
  },
};

// =============================================================================
// PLOTPOINT_TOO_CONCRETE
// =============================================================================

/**
 * Warn when a PlotPoint's summary appears to be scene-like rather than abstract intent.
 * Heuristics:
 * - Contains INT./EXT. tokens
 * - Contains quoted dialogue (20+ chars inside quotes)
 * - Summary length > 300 chars
 * - Includes common location indicators (shop, warehouse, club, marina, garage)
 */
export const PLOTPOINT_TOO_CONCRETE: Rule = {
  id: 'PLOTPOINT_TOO_CONCRETE',
  name: 'PlotPoint Summary Too Concrete',
  severity: 'soft',
  category: 'completeness',
  description: 'PlotPoint summaries should be abstract narrative intent, not scene synopses',

  evaluate: (graph: GraphState, scope: LintScope): RuleViolation[] => {
    const violations: RuleViolation[] = [];
    const plotPoints = getNodesByType<PlotPoint>(graph, 'PlotPoint');

    const locationIndicators = ['shop', 'warehouse', 'club', 'marina', 'garage'];
    const hasSceneHeading = (text: string) => /\bINT\.|\bEXT\./i.test(text);
    const hasLongDialogue = (text: string) => /"[^"]{20,}"/.test(text);

    for (const pp of plotPoints) {
      if (!isNodeInScope(scope, pp.id)) continue;
      const s = (pp.summary ?? '').trim();
      if (!s) continue;

      const warnings: string[] = [];
      if (hasSceneHeading(s)) warnings.push('contains scene heading (INT./EXT.)');
      if (hasLongDialogue(s)) warnings.push('contains quoted dialogue');
      if (s.length > 300) warnings.push('summary too long (>300 chars)');
      const lower = s.toLowerCase();
      if (locationIndicators.some((w) => lower.includes(w))) warnings.push('contains likely location details');

      if (warnings.length > 0) {
        violations.push(
          createViolation(
            'PLOTPOINT_TOO_CONCRETE',
            'soft',
            'completeness',
            `PlotPoint "${pp.title}" summary may be too concrete (${warnings.join(', ')})`,
            {
              nodeId: pp.id,
              nodeType: 'PlotPoint',
              context: { warnings },
            }
          )
        );
      }
    }

    return violations;
  },
};

// =============================================================================
// SCENE_HAS_PLOTPOINT
// =============================================================================

/**
 * Scene should be realized by at least one PlotPoint (via REALIZED_BY edge).
 * This ensures scenes are connected to the story's causality chain.
 */
export const SCENE_HAS_PLOTPOINT: Rule = {
  id: 'SCENE_HAS_PLOTPOINT',
  name: 'Scene Should Have PlotPoint',
  severity: 'soft',
  category: 'completeness',
  description: 'Scenes should be realized by at least one PlotPoint',

  evaluate: (graph: GraphState, scope: LintScope): RuleViolation[] => {
    const violations: RuleViolation[] = [];
    const scenes = getScenesInScope(graph, scope);

    for (const scene of scenes) {
      // Check for incoming REALIZED_BY edges (PlotPoint → Scene)
      const realizedByEdges = graph.edges.filter(
        (e) => e.type === 'REALIZED_BY' && e.to === scene.id
      );

      if (realizedByEdges.length === 0) {
        violations.push(
          createViolation(
            'SCENE_HAS_PLOTPOINT',
            'soft',
            'completeness',
            `Scene "${scene.heading}" is not connected to any PlotPoint`,
            {
              nodeId: scene.id,
              nodeType: 'Scene',
              context: {
                sceneHeading: scene.heading,
              },
            }
          )
        );
      }
    }

    return violations;
  },
};

// =============================================================================
// STORY_HAS_LOGLINE - REMOVED
// =============================================================================
// Logline is now stored in StoryContext.constitution.logline, not as a graph node.

// =============================================================================
// LOCATION_HAS_SETTING - REMOVED
// =============================================================================
// Setting nodes no longer exist. Setting is stored in StoryContext.constitution.setting.

// =============================================================================
// Exports
// =============================================================================

/**
 * All soft rules (warnings only).
 */
export const SOFT_RULES: Rule[] = [
  SCENE_HAS_CHARACTER,
  SCENE_HAS_LOCATION,
  SCENE_HAS_PLOTPOINT,
  PP_EVENT_REALIZATION,
  PLOTPOINT_TOO_CONCRETE,
];

/**
 * Register all soft rules with the engine.
 */
export function registerSoftRules(): void {
  for (const rule of SOFT_RULES) {
    try {
      registerRule(rule);
    } catch {
      // Rule already registered
    }
  }
}
