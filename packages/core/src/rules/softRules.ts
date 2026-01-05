/**
 * Soft Rules - Warnings that don't block commit.
 *
 * These rules identify quality issues and missing connections.
 */

import type { GraphState } from '../core/graph.js';
import { getNodesByType } from '../core/graph.js';
import type { Theme, Motif, PlotPoint } from '../types/nodes.js';
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
// THEME_NOT_ORPHANED
// =============================================================================

/**
 * Theme should be expressed in at least one scene or beat (EXPRESSED_IN edge).
 * Orphaned themes are not grounded in the narrative.
 */
export const THEME_NOT_ORPHANED: Rule = {
  id: 'THEME_NOT_ORPHANED',
  name: 'Theme Should Be Expressed in Scenes',
  severity: 'soft',
  category: 'orphan',
  description: 'Themes should have at least one EXPRESSED_IN edge to ground them in the narrative',

  evaluate: (graph: GraphState, scope: LintScope): RuleViolation[] => {
    const violations: RuleViolation[] = [];
    const themes = getNodesByType<Theme>(graph, 'Theme');

    for (const theme of themes) {
      // Skip themes not in scope
      if (!isNodeInScope(scope, theme.id)) continue;

      // Check for EXPRESSED_IN edges from this theme
      const expressedEdges = graph.edges.filter(
        (e) => e.type === 'EXPRESSED_IN' && e.from === theme.id
      );

      if (expressedEdges.length === 0) {
        violations.push(
          createViolation(
            'THEME_NOT_ORPHANED',
            'soft',
            'orphan',
            `Theme "${theme.statement}" is not expressed in any scene or beat`,
            {
              nodeId: theme.id,
              nodeType: 'Theme',
              context: {
                themeStatement: theme.statement,
                themeStatus: theme.status,
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
// MOTIF_NOT_ORPHANED
// =============================================================================

/**
 * Motif should appear in at least one scene (APPEARS_IN edge).
 * Orphaned motifs are not grounded in the narrative.
 */
export const MOTIF_NOT_ORPHANED: Rule = {
  id: 'MOTIF_NOT_ORPHANED',
  name: 'Motif Should Appear in Scenes',
  severity: 'soft',
  category: 'orphan',
  description: 'Motifs should have at least one APPEARS_IN edge to ground them in the narrative',

  evaluate: (graph: GraphState, scope: LintScope): RuleViolation[] => {
    const violations: RuleViolation[] = [];
    const motifs = getNodesByType<Motif>(graph, 'Motif');

    for (const motif of motifs) {
      // Skip motifs not in scope
      if (!isNodeInScope(scope, motif.id)) continue;

      // Check for APPEARS_IN edges from this motif
      const appearsEdges = graph.edges.filter(
        (e) => e.type === 'APPEARS_IN' && e.from === motif.id
      );

      if (appearsEdges.length === 0) {
        violations.push(
          createViolation(
            'MOTIF_NOT_ORPHANED',
            'soft',
            'orphan',
            `Motif "${motif.name}" does not appear in any scene`,
            {
              nodeId: motif.id,
              nodeType: 'Motif',
              context: {
                motifName: motif.name,
                motifStatus: motif.status,
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
// PP_HAS_INTENT
// =============================================================================

/**
 * PlotPoint should have an intent set.
 * The intent field helps categorize the plot point's primary purpose.
 */
export const PP_HAS_INTENT: Rule = {
  id: 'PP_HAS_INTENT',
  name: 'PlotPoint Should Have Intent',
  severity: 'soft',
  category: 'completeness',
  description: 'Plot points should have their intent (plot/character/theme/tone) specified',

  evaluate: (graph: GraphState, scope: LintScope): RuleViolation[] => {
    const violations: RuleViolation[] = [];
    const plotPoints = getNodesByType<PlotPoint>(graph, 'PlotPoint');

    for (const pp of plotPoints) {
      // Skip if not in scope
      if (!isNodeInScope(scope, pp.id)) continue;

      // Check if intent is missing or empty
      if (!pp.intent) {
        violations.push(
          createViolation(
            'PP_HAS_INTENT',
            'soft',
            'completeness',
            `PlotPoint "${pp.title}" has no intent specified`,
            {
              nodeId: pp.id,
              nodeType: 'PlotPoint',
              field: 'intent',
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
// PP_HAS_CRITERIA
// =============================================================================

/**
 * PlotPoint should have criteria_of_satisfaction set.
 * Clear criteria help determine when a plot point is properly fulfilled.
 */
export const PP_HAS_CRITERIA: Rule = {
  id: 'PP_HAS_CRITERIA',
  name: 'PlotPoint Should Have Satisfaction Criteria',
  severity: 'soft',
  category: 'completeness',
  description: 'Plot points should define what must be true to count as fulfilled',

  evaluate: (graph: GraphState, scope: LintScope): RuleViolation[] => {
    const violations: RuleViolation[] = [];
    const plotPoints = getNodesByType<PlotPoint>(graph, 'PlotPoint');

    for (const pp of plotPoints) {
      // Skip if not in scope
      if (!isNodeInScope(scope, pp.id)) continue;

      // Check if criteria_of_satisfaction is missing or empty
      if (!pp.criteria_of_satisfaction || pp.criteria_of_satisfaction.trim() === '') {
        violations.push(
          createViolation(
            'PP_HAS_CRITERIA',
            'soft',
            'completeness',
            `PlotPoint "${pp.title}" has no satisfaction criteria defined`,
            {
              nodeId: pp.id,
              nodeType: 'PlotPoint',
              field: 'criteria_of_satisfaction',
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
// Exports
// =============================================================================

/**
 * All soft rules (warnings only).
 */
export const SOFT_RULES: Rule[] = [
  SCENE_HAS_CHARACTER,
  SCENE_HAS_LOCATION,
  THEME_NOT_ORPHANED,
  MOTIF_NOT_ORPHANED,
  PP_HAS_INTENT,
  PP_EVENT_REALIZATION,
  PP_HAS_CRITERIA,
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
