/**
 * Soft Rules - Warnings that don't block commit.
 *
 * These rules identify quality issues and missing connections.
 */

import type { GraphState } from '../core/graph.js';
import { getNodesByType } from '../core/graph.js';
import type { PlotPoint, Logline, Location } from '../types/nodes.js';
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
                beatId: scene.beat_id,
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
                beatId: scene.beat_id,
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
 * Approved PlotPoints should have at least one SATISFIED_BY edge to a scene.
 * This ensures that approved plot points are realized in the narrative.
 */
export const PP_EVENT_REALIZATION: Rule = {
  id: 'PP_EVENT_REALIZATION',
  name: 'Approved PlotPoint Should Have Scene',
  severity: 'soft',
  category: 'completeness',
  description: 'Approved plot points should be satisfied by at least one scene',

  evaluate: (graph: GraphState, scope: LintScope): RuleViolation[] => {
    const violations: RuleViolation[] = [];
    const plotPoints = getNodesByType<PlotPoint>(graph, 'PlotPoint');

    for (const pp of plotPoints) {
      // Skip if not in scope
      if (!isNodeInScope(scope, pp.id)) continue;

      // Only check approved plot points
      if (pp.status !== 'approved') continue;

      // Check for SATISFIED_BY edges from this plot point
      const satisfiedByEdges = graph.edges.filter(
        (e) => e.type === 'SATISFIED_BY' && e.from === pp.id
      );

      if (satisfiedByEdges.length === 0) {
        violations.push(
          createViolation(
            'PP_EVENT_REALIZATION',
            'soft',
            'completeness',
            `Approved PlotPoint "${pp.title}" has no scenes satisfying it`,
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
// SCENE_HAS_PLOTPOINT
// =============================================================================

/**
 * Scene should be satisfied by at least one PlotPoint (via SATISFIED_BY edge).
 * This ensures scenes are connected to the story's causality chain.
 */
export const SCENE_HAS_PLOTPOINT: Rule = {
  id: 'SCENE_HAS_PLOTPOINT',
  name: 'Scene Should Have PlotPoint',
  severity: 'soft',
  category: 'completeness',
  description: 'Scenes should be satisfied by at least one PlotPoint',

  evaluate: (graph: GraphState, scope: LintScope): RuleViolation[] => {
    const violations: RuleViolation[] = [];
    const scenes = getScenesInScope(graph, scope);

    for (const scene of scenes) {
      // Check for incoming SATISFIED_BY edges (PlotPoint → Scene)
      const satisfiedByEdges = graph.edges.filter(
        (e) => e.type === 'SATISFIED_BY' && e.to === scene.id
      );

      if (satisfiedByEdges.length === 0) {
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
                beatId: scene.beat_id,
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
// STORY_HAS_LOGLINE
// =============================================================================

/**
 * Story should have a Logline node defined.
 * The logline provides the one-sentence summary of the story.
 */
export const STORY_HAS_LOGLINE: Rule = {
  id: 'STORY_HAS_LOGLINE',
  name: 'Story Should Have Logline',
  severity: 'soft',
  category: 'completeness',
  description: 'Stories should define a logline',

  evaluate: (graph: GraphState, _scope: LintScope): RuleViolation[] => {
    const loglines = getNodesByType<Logline>(graph, 'Logline');

    if (loglines.length === 0) {
      return [
        createViolation(
          'STORY_HAS_LOGLINE',
          'soft',
          'completeness',
          'Story has no logline defined. Consider adding a logline to establish the core concept.',
          {}
        ),
      ];
    }

    return [];
  },
};

// =============================================================================
// LOCATION_HAS_SETTING
// =============================================================================

/**
 * Location should be part of a Setting (PART_OF edge).
 * This is a soft rule because locations can exist without a broader setting.
 */
export const LOCATION_HAS_SETTING: Rule = {
  id: 'LOCATION_HAS_SETTING',
  name: 'Location Should Have Setting',
  severity: 'soft',
  category: 'completeness',
  description: 'Locations should be part of a Setting/World',

  evaluate: (graph: GraphState, scope: LintScope): RuleViolation[] => {
    const violations: RuleViolation[] = [];
    const locations = getNodesByType<Location>(graph, 'Location');

    // Get all locations that have a PART_OF edge to a Setting
    const locationsWithSetting = new Set(
      graph.edges
        .filter((e) => e.type === 'PART_OF')
        .map((e) => e.from)
    );

    for (const location of locations) {
      // Skip if not in scope
      if (!isNodeInScope(scope, location.id)) continue;

      if (!locationsWithSetting.has(location.id)) {
        violations.push(
          createViolation(
            'LOCATION_HAS_SETTING',
            'soft',
            'completeness',
            `Location "${location.name}" is not part of any Setting`,
            {
              nodeId: location.id,
              nodeType: 'Location',
              context: {
                locationName: location.name,
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
  STORY_HAS_LOGLINE,
  LOCATION_HAS_SETTING,
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
