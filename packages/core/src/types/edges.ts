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
 * HAS_CHARACTER: Scene → Character
 * LOCATED_AT: Scene → Location
 * FEATURES_OBJECT: Scene → Object
 * INVOLVES: Conflict → Character
 * MANIFESTS_IN: Conflict → Scene
 * HAS_ARC: Character → CharacterArc
 * EXPRESSED_IN: Theme → Scene | Beat
 * APPEARS_IN: Motif → Scene
 *
 * PlotPoint edges:
 * ALIGNS_WITH: PlotPoint → Beat (optional alignment to STC beat)
 * SATISFIED_BY: PlotPoint → Scene (with properties.order for sequencing)
 * PRECEDES: PlotPoint → PlotPoint (causal/temporal chain, DAG)
 * ADVANCES: PlotPoint → CharacterArc | Theme
 * SETS_UP: PlotPoint → Motif (setup relationship)
 * PAYS_OFF: PlotPoint → Motif (payoff relationship)
 *
 * Note: FULFILLS (Scene → Beat) was deprecated in favor of the PlotPoint model.
 * Scenes now connect to Beats via: Scene ← SATISFIED_BY ← PlotPoint → ALIGNS_WITH → Beat
 */
export type EdgeType =
  | 'HAS_CHARACTER'
  | 'LOCATED_AT'
  | 'FEATURES_OBJECT'
  | 'INVOLVES'
  | 'MANIFESTS_IN'
  | 'HAS_ARC'
  | 'EXPRESSED_IN'
  | 'APPEARS_IN'
  | 'ALIGNS_WITH'
  | 'SATISFIED_BY'
  | 'PRECEDES'
  | 'ADVANCES'
  | 'SETS_UP'
  | 'PAYS_OFF';

// =============================================================================
// Edge Properties and Metadata
// =============================================================================

/**
 * Optional properties that can be attached to an edge.
 */
export interface EdgeProperties {
  /** Ordering within a container (e.g., scene order in beat) */
  order?: number;
  /** Strength of relation (0-1) */
  weight?: number;
  /** AI confidence score (0-1) */
  confidence?: number;
  /** Human-readable annotation */
  notes?: string;
}

/**
 * Provenance tracking for edge creation.
 */
export interface EdgeProvenance {
  /** Who/what created this edge */
  source: 'human' | 'extractor' | 'import';
  /** ID of the patch that created this edge (for grouping) */
  patchId?: string;
  /** AI model that generated this (if source=extractor) */
  model?: string;
  /** Hash of prompt that generated this */
  promptHash?: string;
  /** User ID who created/approved this */
  createdBy?: string;
}

/**
 * Edge lifecycle status.
 */
export type EdgeStatus = 'proposed' | 'approved' | 'rejected';

/**
 * Edge object representing a relationship between two nodes.
 * First-class entity with ID, properties, provenance, and lifecycle status.
 */
export interface Edge {
  /** Unique identifier (UUID) */
  id: string;
  /** Edge type defining the relationship */
  type: EdgeType;
  /** Source node ID */
  from: string;
  /** Target node ID */
  to: string;
  /** Optional properties (order, weight, confidence, notes) */
  properties?: EdgeProperties | undefined;
  /** Provenance tracking (who/what created this) */
  provenance?: EdgeProvenance | undefined;
  /** Lifecycle status (proposed, approved, rejected) */
  status?: EdgeStatus | undefined;
  /** ISO timestamp of creation */
  createdAt?: string | undefined;
  /** ISO timestamp of last update */
  updatedAt?: string | undefined;
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

  // PlotPoint → Beat (optional alignment to STC beat)
  ALIGNS_WITH: {
    source: ['PlotPoint'],
    target: ['Beat'],
  },

  // PlotPoint → Scene (with properties.order for sequencing)
  SATISFIED_BY: {
    source: ['PlotPoint'],
    target: ['Scene'],
  },

  // PlotPoint → PlotPoint (causal/temporal chain, must be DAG)
  PRECEDES: {
    source: ['PlotPoint'],
    target: ['PlotPoint'],
  },

  // PlotPoint → CharacterArc | Theme
  ADVANCES: {
    source: ['PlotPoint'],
    target: ['CharacterArc', 'Theme'],
  },

  // PlotPoint → Motif (setup relationship)
  SETS_UP: {
    source: ['PlotPoint'],
    target: ['Motif'],
  },

  // PlotPoint → Motif (payoff relationship)
  PAYS_OFF: {
    source: ['PlotPoint'],
    target: ['Motif'],
  },
};

/**
 * List of all edge types for validation.
 */
export const EDGE_TYPES: EdgeType[] = [
  'HAS_CHARACTER',
  'LOCATED_AT',
  'FEATURES_OBJECT',
  'INVOLVES',
  'MANIFESTS_IN',
  'HAS_ARC',
  'EXPRESSED_IN',
  'APPEARS_IN',
  'ALIGNS_WITH',
  'SATISFIED_BY',
  'PRECEDES',
  'ADVANCES',
  'SETS_UP',
  'PAYS_OFF',
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
 * Two edges with the same type, from, and to are considered duplicates.
 */
export function edgeKey(edge: Pick<Edge, 'type' | 'from' | 'to'>): string {
  return `${edge.type}:${edge.from}:${edge.to}`;
}

/**
 * Alias for edgeKey - explicit name for deduplication contexts.
 */
export const edgeUniqueKey = edgeKey;

/**
 * Generate a unique edge ID (UUID v4).
 */
export function generateEdgeId(): string {
  // Use crypto.randomUUID if available, otherwise fallback
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `edge_${crypto.randomUUID()}`;
  }
  // Fallback for older environments
  return `edge_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Check if an edge has the new first-class format (with ID).
 */
export function isFirstClassEdge(edge: unknown): edge is Edge {
  return (
    typeof edge === 'object' &&
    edge !== null &&
    'id' in edge &&
    typeof (edge as Edge).id === 'string'
  );
}

/**
 * Generate a deterministic edge ID from the edge's unique key.
 * Used for migrating legacy edges without IDs - ensures the same
 * edge always gets the same ID across server restarts.
 */
function generateDeterministicEdgeId(type: string, from: string, to: string): string {
  // Simple hash based on the unique key components
  const key = `${type}:${from}:${to}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  // Convert to positive hex string
  const hexHash = Math.abs(hash).toString(16).padStart(8, '0');
  return `edge_legacy_${hexHash}`;
}

/**
 * Normalize a legacy edge (without ID) to first-class format.
 * Assigns a deterministic ID based on edge key (for stability) and default status/provenance.
 */
export function normalizeEdge(
  edge: Pick<Edge, 'type' | 'from' | 'to'> & Partial<Edge>
): Edge {
  return {
    // Use existing ID, or generate deterministic one for legacy edges
    id: edge.id ?? generateDeterministicEdgeId(edge.type, edge.from, edge.to),
    type: edge.type,
    from: edge.from,
    to: edge.to,
    properties: edge.properties,
    provenance: edge.provenance ?? { source: 'import' },
    status: edge.status ?? 'approved',
    createdAt: edge.createdAt ?? new Date().toISOString(),
    updatedAt: edge.updatedAt,
  };
}
