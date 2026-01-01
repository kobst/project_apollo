/**
 * Edge type definitions for the screenplay knowledge graph.
 * Matches the schema in spec/projectSpec.md
 */

import type { NodeType } from './nodes.js';

// =============================================================================
// Edge Types
// =============================================================================

/**
 * All valid edge types in the knowledge graph.
 *
 * FULFILLS: Scene → Beat (implicit via Scene.beat_id, derived not created)
 * HAS_CHARACTER: Scene → Character
 * LOCATED_AT: Scene → Location
 * FEATURES_OBJECT: Scene → Object
 * INVOLVES: Conflict → Character
 * MANIFESTS_IN: Conflict → Scene
 * HAS_ARC: Character → CharacterArc
 * EXPRESSED_IN: Theme → Scene | Beat
 * APPEARS_IN: Motif → Scene
 */
export type EdgeType =
  | 'FULFILLS'
  | 'HAS_CHARACTER'
  | 'LOCATED_AT'
  | 'FEATURES_OBJECT'
  | 'INVOLVES'
  | 'MANIFESTS_IN'
  | 'HAS_ARC'
  | 'EXPRESSED_IN'
  | 'APPEARS_IN';

/**
 * Edge object representing a relationship between two nodes.
 */
export interface Edge {
  type: EdgeType;
  from: string;
  to: string;
}

// =============================================================================
// Edge Validation Rules
// =============================================================================

/**
 * Defines valid source and target node types for each edge type.
 */
export interface EdgeRule {
  source: NodeType[];
  target: NodeType[];
}

/**
 * Edge validation rules mapping edge types to allowed source/target node types.
 */
export const EDGE_RULES: Record<EdgeType, EdgeRule> = {
  // Scene → Beat (implicit via beat_id, but validated as edge)
  FULFILLS: {
    source: ['Scene'],
    target: ['Beat'],
  },

  // Scene → Character
  HAS_CHARACTER: {
    source: ['Scene'],
    target: ['Character'],
  },

  // Scene → Location
  LOCATED_AT: {
    source: ['Scene'],
    target: ['Location'],
  },

  // Scene → Object
  FEATURES_OBJECT: {
    source: ['Scene'],
    target: ['Object'],
  },

  // Conflict → Character
  INVOLVES: {
    source: ['Conflict'],
    target: ['Character'],
  },

  // Conflict → Scene
  MANIFESTS_IN: {
    source: ['Conflict'],
    target: ['Scene'],
  },

  // Character → CharacterArc
  HAS_ARC: {
    source: ['Character'],
    target: ['CharacterArc'],
  },

  // Theme → Scene | Beat
  EXPRESSED_IN: {
    source: ['Theme'],
    target: ['Scene', 'Beat'],
  },

  // Motif → Scene
  APPEARS_IN: {
    source: ['Motif'],
    target: ['Scene'],
  },
};

/**
 * List of all edge types for validation.
 */
export const EDGE_TYPES: EdgeType[] = [
  'FULFILLS',
  'HAS_CHARACTER',
  'LOCATED_AT',
  'FEATURES_OBJECT',
  'INVOLVES',
  'MANIFESTS_IN',
  'HAS_ARC',
  'EXPRESSED_IN',
  'APPEARS_IN',
];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if an edge type is valid.
 */
export function isValidEdgeType(type: string): type is EdgeType {
  return EDGE_TYPES.includes(type as EdgeType);
}

/**
 * Get the edge rule for a given edge type.
 */
export function getEdgeRule(type: EdgeType): EdgeRule {
  return EDGE_RULES[type];
}

/**
 * Create a unique key for an edge (used for deduplication).
 */
export function edgeKey(edge: Edge): string {
  return `${edge.type}:${edge.from}:${edge.to}`;
}
