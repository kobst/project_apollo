/**
 * Soft Rules - Warnings that don't block commit.
 *
 * These rules identify quality issues and missing connections.
 */

import type { GraphState } from '../core/graph.js';
import { getNodesByType } from '../core/graph.js';
import type { StoryBeat } from '../types/nodes.js';
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
// SB_EVENT_REALIZATION
// =============================================================================

/**
 * Approved StoryBeats should have at least one SATISFIED_BY edge to a scene.
 * This ensures that approved story beats are realized in the narrative.
 */
export const SB_EVENT_REALIZATION: Rule = {
  id: 'SB_EVENT_REALIZATION',
  name: 'Approved StoryBeat Should Have Scene',
  severity: 'soft',
  category: 'completeness',
  description: 'Approved story beats should be satisfied by at least one scene',

  evaluate: (graph: GraphState, scope: LintScope): RuleViolation[] => {
    const violations: RuleViolation[] = [];
    const storyBeats = getNodesByType<StoryBeat>(graph, 'StoryBeat');

    for (const sb of storyBeats) {
      // Skip if not in scope
      if (!isNodeInScope(scope, sb.id)) continue;

      // Only check approved story beats
      if (sb.status !== 'approved') continue;

      // Check for SATISFIED_BY edges from this story beat
      const satisfiedByEdges = graph.edges.filter(
        (e) => e.type === 'SATISFIED_BY' && e.from === sb.id
      );

      if (satisfiedByEdges.length === 0) {
        violations.push(
          createViolation(
            'SB_EVENT_REALIZATION',
            'soft',
            'completeness',
            `Approved StoryBeat "${sb.title}" has no scenes satisfying it`,
            {
              nodeId: sb.id,
              nodeType: 'StoryBeat',
              context: {
                storyBeatTitle: sb.title,
                storyBeatStatus: sb.status,
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
// SCENE_HAS_STORYBEAT
// =============================================================================

/**
 * Scene should be satisfied by at least one StoryBeat (via SATISFIED_BY edge).
 * This ensures scenes are connected to the story's causality chain.
 */
export const SCENE_HAS_STORYBEAT: Rule = {
  id: 'SCENE_HAS_STORYBEAT',
  name: 'Scene Should Have StoryBeat',
  severity: 'soft',
  category: 'completeness',
  description: 'Scenes should be satisfied by at least one StoryBeat',

  evaluate: (graph: GraphState, scope: LintScope): RuleViolation[] => {
    const violations: RuleViolation[] = [];
    const scenes = getScenesInScope(graph, scope);

    for (const scene of scenes) {
      // Check for incoming SATISFIED_BY edges (StoryBeat → Scene)
      const satisfiedByEdges = graph.edges.filter(
        (e) => e.type === 'SATISFIED_BY' && e.to === scene.id
      );

      if (satisfiedByEdges.length === 0) {
        violations.push(
          createViolation(
            'SCENE_HAS_STORYBEAT',
            'soft',
            'completeness',
            `Scene "${scene.heading}" is not connected to any StoryBeat`,
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
  SCENE_HAS_STORYBEAT,
  SB_EVENT_REALIZATION,
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
