/**
 * Factory functions for creating test edges
 */

import type { Edge, EdgeType } from '../../src/types/edges.js';

/**
 * Create an edge
 */
export function createEdge(type: EdgeType, from: string, to: string): Edge {
  return { type, from, to };
}

/**
 * Common edge creators with semantic names
 */
export const edges = {
  /** Scene fulfills Beat */
  fulfills: (sceneId: string, beatId: string): Edge =>
    createEdge('FULFILLS', sceneId, beatId),

  /** Scene has Character */
  hasCharacter: (sceneId: string, characterId: string): Edge =>
    createEdge('HAS_CHARACTER', sceneId, characterId),

  /** Scene located at Location */
  locatedAt: (sceneId: string, locationId: string): Edge =>
    createEdge('LOCATED_AT', sceneId, locationId),

  /** Scene features Object */
  featuresObject: (sceneId: string, objectId: string): Edge =>
    createEdge('FEATURES_OBJECT', sceneId, objectId),

  /** Conflict involves Character */
  involves: (conflictId: string, characterId: string): Edge =>
    createEdge('INVOLVES', conflictId, characterId),

  /** Conflict manifests in Scene */
  manifestsIn: (conflictId: string, sceneId: string): Edge =>
    createEdge('MANIFESTS_IN', conflictId, sceneId),

  /** Character has CharacterArc */
  hasArc: (characterId: string, arcId: string): Edge =>
    createEdge('HAS_ARC', characterId, arcId),

  /** Theme expressed in Scene or Beat */
  expressedIn: (themeId: string, targetId: string): Edge =>
    createEdge('EXPRESSED_IN', themeId, targetId),

  /** Motif appears in Scene */
  appearsIn: (motifId: string, sceneId: string): Edge =>
    createEdge('APPEARS_IN', motifId, sceneId),
};
