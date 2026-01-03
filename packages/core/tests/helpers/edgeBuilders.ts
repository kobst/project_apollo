/**
 * Factory functions for creating test edges
 */

import type { Edge, EdgeType, EdgeProperties, EdgeStatus } from '../../src/types/edges.js';
import { generateEdgeId } from '../../src/types/edges.js';

/**
 * Create an edge with optional overrides
 */
export function createEdge(
  type: EdgeType,
  from: string,
  to: string,
  options?: {
    id?: string;
    properties?: EdgeProperties;
    status?: EdgeStatus;
  }
): Edge {
  return {
    id: options?.id ?? generateEdgeId(),
    type,
    from,
    to,
    properties: options?.properties,
    status: options?.status ?? 'approved',
    createdAt: new Date().toISOString(),
  };
}

/**
 * Common edge creators with semantic names
 */
export const edges = {
  /** Scene fulfills Beat */
  fulfills: (sceneId: string, beatId: string, id?: string): Edge =>
    createEdge('FULFILLS', sceneId, beatId, { id }),

  /** Scene has Character */
  hasCharacter: (sceneId: string, characterId: string, id?: string): Edge =>
    createEdge('HAS_CHARACTER', sceneId, characterId, { id }),

  /** Scene located at Location */
  locatedAt: (sceneId: string, locationId: string, id?: string): Edge =>
    createEdge('LOCATED_AT', sceneId, locationId, { id }),

  /** Scene features Object */
  featuresObject: (sceneId: string, objectId: string, id?: string): Edge =>
    createEdge('FEATURES_OBJECT', sceneId, objectId, { id }),

  /** Conflict involves Character */
  involves: (conflictId: string, characterId: string, id?: string): Edge =>
    createEdge('INVOLVES', conflictId, characterId, { id }),

  /** Conflict manifests in Scene */
  manifestsIn: (conflictId: string, sceneId: string, id?: string): Edge =>
    createEdge('MANIFESTS_IN', conflictId, sceneId, { id }),

  /** Character has CharacterArc */
  hasArc: (characterId: string, arcId: string, id?: string): Edge =>
    createEdge('HAS_ARC', characterId, arcId, { id }),

  /** Theme expressed in Scene or Beat */
  expressedIn: (themeId: string, targetId: string, id?: string): Edge =>
    createEdge('EXPRESSED_IN', themeId, targetId, { id }),

  /** Motif appears in Scene */
  appearsIn: (motifId: string, sceneId: string, id?: string): Edge =>
    createEdge('APPEARS_IN', motifId, sceneId, { id }),
};
