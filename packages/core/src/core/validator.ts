/**
 * Patch validation logic.
 * Validates patches against the graph schema and constraints.
 */

import type { GraphState } from './graph.js';
import { getNode, getNodesByType } from './graph.js';
import { applyPatch } from './applyPatch.js';
import type { Patch } from '../types/patch.js';
import type {
  Beat,
  Scene,
  CharacterArc,
  Conflict,
  Location,
  StoryObject,
  Theme,
} from '../types/nodes.js';
import { EDGE_RULES } from '../types/edges.js';

// =============================================================================
// Validation Result Types
// =============================================================================

/**
 * Error codes for validation errors.
 */
export type ValidationErrorCode =
  | 'APPLY_FAILED'
  | 'FK_INTEGRITY'
  | 'MISSING_REQUIRED'
  | 'INVALID_ENUM'
  | 'DUPLICATE_ID'
  | 'DUPLICATE_EDGE'
  | 'CONSTRAINT_VIOLATION'
  | 'INVALID_TYPE'
  | 'OUT_OF_RANGE'
  | 'INVALID_EDGE_TYPE'
  | 'INVALID_EDGE_SOURCE'
  | 'INVALID_EDGE_TARGET'
  | 'INVALID_EDGE_ID'
  | 'INVALID_EDGE_PROPERTY'
  | 'INVALID_EDGE_STATUS';

/**
 * A single validation error.
 */
export interface ValidationError {
  code: ValidationErrorCode;
  message: string;
  node_id?: string;
  field?: string;
  op_index?: number;
}

/**
 * Result of patch validation.
 */
export interface ValidationResult {
  success: boolean;
  errors: ValidationError[];
}

// =============================================================================
// Main Validation Function
// =============================================================================

/**
 * Validate a patch against a graph.
 * Applies the patch to get the resulting state, then validates constraints.
 */
export function validatePatch(
  graph: GraphState,
  patch: Patch
): ValidationResult {
  const errors: ValidationError[] = [];

  // 1. Try to apply the patch
  let resultGraph: GraphState;
  try {
    resultGraph = applyPatch(graph, patch);
  } catch (e) {
    return {
      success: false,
      errors: [
        {
          code: 'APPLY_FAILED',
          message: e instanceof Error ? e.message : String(e),
        },
      ],
    };
  }

  // 2. Check FK integrity
  errors.push(...checkFKIntegrity(resultGraph));

  // 3. Check edge validity
  errors.push(...checkEdgeValidity(resultGraph));

  // 4. Check node-specific rules
  errors.push(...checkNodeRules(resultGraph));

  // 5. Check structural constraints
  errors.push(...checkStructuralConstraints(resultGraph));

  return {
    success: errors.length === 0,
    errors,
  };
}

// =============================================================================
// FK Integrity Checks
// =============================================================================

/**
 * Check foreign key integrity for all nodes and edges.
 */
function checkFKIntegrity(graph: GraphState): ValidationError[] {
  const errors: ValidationError[] = [];

  // Scene.beat_id must exist
  for (const scene of getNodesByType<Scene>(graph, 'Scene')) {
    if (!getNode(graph, scene.beat_id)) {
      errors.push({
        code: 'FK_INTEGRITY',
        message: `Scene "${scene.id}" references non-existent Beat "${scene.beat_id}"`,
        node_id: scene.id,
        field: 'beat_id',
      });
    }
  }

  // CharacterArc.character_id must exist
  for (const arc of getNodesByType<CharacterArc>(graph, 'CharacterArc')) {
    if (!getNode(graph, arc.character_id)) {
      errors.push({
        code: 'FK_INTEGRITY',
        message: `CharacterArc "${arc.id}" references non-existent Character "${arc.character_id}"`,
        node_id: arc.id,
        field: 'character_id',
      });
    }

    // Check turn_refs
    if (arc.turn_refs) {
      for (const ref of arc.turn_refs) {
        if (ref.beat_id && !getNode(graph, ref.beat_id)) {
          errors.push({
            code: 'FK_INTEGRITY',
            message: `CharacterArc "${arc.id}" turn_ref references non-existent Beat "${ref.beat_id}"`,
            node_id: arc.id,
            field: 'turn_refs',
          });
        }
        if (ref.scene_id && !getNode(graph, ref.scene_id)) {
          errors.push({
            code: 'FK_INTEGRITY',
            message: `CharacterArc "${arc.id}" turn_ref references non-existent Scene "${ref.scene_id}"`,
            node_id: arc.id,
            field: 'turn_refs',
          });
        }
      }
    }
  }

  // Location.parent_location_id must exist if set
  for (const location of getNodesByType<Location>(graph, 'Location')) {
    if (location.parent_location_id && !getNode(graph, location.parent_location_id)) {
      errors.push({
        code: 'FK_INTEGRITY',
        message: `Location "${location.id}" references non-existent parent Location "${location.parent_location_id}"`,
        node_id: location.id,
        field: 'parent_location_id',
      });
    }
  }

  // StoryObject.introduced_in_scene_id must exist if set
  for (const obj of getNodesByType<StoryObject>(graph, 'Object')) {
    if (obj.introduced_in_scene_id && !getNode(graph, obj.introduced_in_scene_id)) {
      errors.push({
        code: 'FK_INTEGRITY',
        message: `Object "${obj.id}" references non-existent Scene "${obj.introduced_in_scene_id}"`,
        node_id: obj.id,
        field: 'introduced_in_scene_id',
      });
    }
  }

  // Conflict.start_beat_id and end_beat_id must exist if set
  for (const conflict of getNodesByType<Conflict>(graph, 'Conflict')) {
    if (conflict.start_beat_id && !getNode(graph, conflict.start_beat_id)) {
      errors.push({
        code: 'FK_INTEGRITY',
        message: `Conflict "${conflict.id}" references non-existent Beat "${conflict.start_beat_id}"`,
        node_id: conflict.id,
        field: 'start_beat_id',
      });
    }
    if (conflict.end_beat_id && !getNode(graph, conflict.end_beat_id)) {
      errors.push({
        code: 'FK_INTEGRITY',
        message: `Conflict "${conflict.id}" references non-existent Beat "${conflict.end_beat_id}"`,
        node_id: conflict.id,
        field: 'end_beat_id',
      });
    }
  }

  // Edge endpoints must exist
  for (const edge of graph.edges) {
    if (!getNode(graph, edge.from)) {
      errors.push({
        code: 'FK_INTEGRITY',
        message: `Edge "${edge.type}" references non-existent source node "${edge.from}"`,
      });
    }
    if (!getNode(graph, edge.to)) {
      errors.push({
        code: 'FK_INTEGRITY',
        message: `Edge "${edge.type}" references non-existent target node "${edge.to}"`,
      });
    }
  }

  return errors;
}

// =============================================================================
// Edge Validity Checks
// =============================================================================

/**
 * Valid edge status values.
 */
const VALID_EDGE_STATUSES = ['proposed', 'approved', 'rejected'] as const;

/**
 * Check that all edges have valid types, source/target node types, and properties.
 */
function checkEdgeValidity(graph: GraphState): ValidationError[] {
  const errors: ValidationError[] = [];
  const seenKeys = new Set<string>();
  const seenIds = new Set<string>();

  for (const edge of graph.edges) {
    // Check for missing or invalid edge ID
    if (!edge.id || typeof edge.id !== 'string') {
      errors.push({
        code: 'INVALID_EDGE_ID',
        message: `Edge "${edge.type}" from "${edge.from}" to "${edge.to}" has missing or invalid ID`,
      });
    } else {
      // Check for duplicate edge IDs
      if (seenIds.has(edge.id)) {
        errors.push({
          code: 'INVALID_EDGE_ID',
          message: `Duplicate edge ID: "${edge.id}"`,
        });
      }
      seenIds.add(edge.id);
    }

    // Check for unknown edge types
    if (!(edge.type in EDGE_RULES)) {
      errors.push({
        code: 'INVALID_EDGE_TYPE',
        message: `Unknown edge type: "${edge.type}"`,
      });
      continue;
    }

    // Check source/target types
    const rule = EDGE_RULES[edge.type];
    const fromNode = getNode(graph, edge.from);
    const toNode = getNode(graph, edge.to);

    if (fromNode && !rule.source.includes(fromNode.type as any)) {
      errors.push({
        code: 'INVALID_EDGE_SOURCE',
        message: `Edge "${edge.type}" cannot have source type "${fromNode.type}"`,
      });
    }

    if (toNode && !rule.target.includes(toNode.type as any)) {
      errors.push({
        code: 'INVALID_EDGE_TARGET',
        message: `Edge "${edge.type}" cannot have target type "${toNode.type}"`,
      });
    }

    // Check for duplicate edges (by uniqueKey)
    const key = `${edge.type}:${edge.from}:${edge.to}`;
    if (seenKeys.has(key)) {
      errors.push({
        code: 'DUPLICATE_EDGE',
        message: `Duplicate edge: "${edge.type}" from "${edge.from}" to "${edge.to}"`,
      });
    }
    seenKeys.add(key);

    // Validate edge properties
    if (edge.properties) {
      // order must be >= 1
      if (edge.properties.order !== undefined) {
        if (typeof edge.properties.order !== 'number' || edge.properties.order < 1) {
          errors.push({
            code: 'INVALID_EDGE_PROPERTY',
            message: `Edge "${edge.id}" has invalid order: ${edge.properties.order} (must be >= 1)`,
          });
        }
      }

      // weight must be 0-1
      if (edge.properties.weight !== undefined) {
        if (
          typeof edge.properties.weight !== 'number' ||
          edge.properties.weight < 0 ||
          edge.properties.weight > 1
        ) {
          errors.push({
            code: 'INVALID_EDGE_PROPERTY',
            message: `Edge "${edge.id}" has invalid weight: ${edge.properties.weight} (must be 0-1)`,
          });
        }
      }

      // confidence must be 0-1
      if (edge.properties.confidence !== undefined) {
        if (
          typeof edge.properties.confidence !== 'number' ||
          edge.properties.confidence < 0 ||
          edge.properties.confidence > 1
        ) {
          errors.push({
            code: 'INVALID_EDGE_PROPERTY',
            message: `Edge "${edge.id}" has invalid confidence: ${edge.properties.confidence} (must be 0-1)`,
          });
        }
      }
    }

    // Validate edge status
    if (edge.status !== undefined) {
      if (!VALID_EDGE_STATUSES.includes(edge.status as any)) {
        errors.push({
          code: 'INVALID_EDGE_STATUS',
          message: `Edge "${edge.id}" has invalid status: "${edge.status}" (must be one of: ${VALID_EDGE_STATUSES.join(', ')})`,
        });
      }
    }
  }

  return errors;
}

// =============================================================================
// Node-Specific Rule Checks
// =============================================================================

/**
 * Check node-specific validation rules.
 */
function checkNodeRules(graph: GraphState): ValidationError[] {
  const errors: ValidationError[] = [];

  // Beat validation
  for (const beat of getNodesByType<Beat>(graph, 'Beat')) {
    if (beat.act < 1 || beat.act > 5) {
      errors.push({
        code: 'OUT_OF_RANGE',
        message: `Beat "${beat.id}" has invalid act: ${beat.act} (must be 1-5)`,
        node_id: beat.id,
        field: 'act',
      });
    }
    if (beat.position_index < 1 || beat.position_index > 15) {
      errors.push({
        code: 'OUT_OF_RANGE',
        message: `Beat "${beat.id}" has invalid position_index: ${beat.position_index} (must be 1-15)`,
        node_id: beat.id,
        field: 'position_index',
      });
    }
  }

  // Scene validation
  for (const scene of getNodesByType<Scene>(graph, 'Scene')) {
    if (!scene.scene_overview || scene.scene_overview.length < 20) {
      errors.push({
        code: 'CONSTRAINT_VIOLATION',
        message: `Scene "${scene.id}" has scene_overview shorter than 20 characters`,
        node_id: scene.id,
        field: 'scene_overview',
      });
    }
    if (scene.order_index < 1) {
      errors.push({
        code: 'OUT_OF_RANGE',
        message: `Scene "${scene.id}" has invalid order_index: ${scene.order_index} (must be >= 1)`,
        node_id: scene.id,
        field: 'order_index',
      });
    }
  }

  // Conflict validation
  for (const conflict of getNodesByType<Conflict>(graph, 'Conflict')) {
    if (conflict.intensity !== undefined && (conflict.intensity < 1 || conflict.intensity > 5)) {
      errors.push({
        code: 'OUT_OF_RANGE',
        message: `Conflict "${conflict.id}" has invalid intensity: ${conflict.intensity} (must be 1-5)`,
        node_id: conflict.id,
        field: 'intensity',
      });
    }
    if (!conflict.description || conflict.description.length < 20) {
      errors.push({
        code: 'CONSTRAINT_VIOLATION',
        message: `Conflict "${conflict.id}" has description shorter than 20 characters`,
        node_id: conflict.id,
        field: 'description',
      });
    }
  }

  // Theme validation
  for (const theme of getNodesByType<Theme>(graph, 'Theme')) {
    if (!theme.statement || theme.statement.length < 5 || theme.statement.length > 240) {
      errors.push({
        code: 'CONSTRAINT_VIOLATION',
        message: `Theme "${theme.id}" statement must be 5-240 characters`,
        node_id: theme.id,
        field: 'statement',
      });
    }
  }

  // CharacterArc validation - turn_refs must have at least one of beat_id or scene_id
  for (const arc of getNodesByType<CharacterArc>(graph, 'CharacterArc')) {
    if (arc.turn_refs) {
      for (let i = 0; i < arc.turn_refs.length; i++) {
        const ref = arc.turn_refs[i];
        if (ref && !ref.beat_id && !ref.scene_id) {
          errors.push({
            code: 'CONSTRAINT_VIOLATION',
            message: `CharacterArc "${arc.id}" turn_ref[${i}] must have at least one of beat_id or scene_id`,
            node_id: arc.id,
            field: 'turn_refs',
          });
        }
      }
    }
  }

  return errors;
}

// =============================================================================
// Structural Constraint Checks
// =============================================================================

/**
 * Check structural constraints (e.g., exactly 15 beats).
 */
function checkStructuralConstraints(graph: GraphState): ValidationError[] {
  const errors: ValidationError[] = [];

  const beats = getNodesByType<Beat>(graph, 'Beat');

  // Check exactly 15 beats per StoryVersion (if any beats exist)
  if (beats.length > 0 && beats.length !== 15) {
    errors.push({
      code: 'CONSTRAINT_VIOLATION',
      message: `Expected 15 beats, found ${beats.length}`,
    });
  }

  // Check unique position_index within beats
  const positionIndices = new Set<number>();
  for (const beat of beats) {
    if (positionIndices.has(beat.position_index)) {
      errors.push({
        code: 'CONSTRAINT_VIOLATION',
        message: `Duplicate beat position_index: ${beat.position_index}`,
        node_id: beat.id,
      });
    }
    positionIndices.add(beat.position_index);
  }

  // Check unique beat_type within beats
  const beatTypes = new Set<string>();
  for (const beat of beats) {
    if (beatTypes.has(beat.beat_type)) {
      errors.push({
        code: 'CONSTRAINT_VIOLATION',
        message: `Duplicate beat_type: ${beat.beat_type}`,
        node_id: beat.id,
      });
    }
    beatTypes.add(beat.beat_type);
  }

  return errors;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Validate a graph state directly (not via patch).
 */
export function validateGraph(graph: GraphState): ValidationResult {
  const errors: ValidationError[] = [];

  errors.push(...checkFKIntegrity(graph));
  errors.push(...checkEdgeValidity(graph));
  errors.push(...checkNodeRules(graph));
  errors.push(...checkStructuralConstraints(graph));

  return {
    success: errors.length === 0,
    errors,
  };
}

/**
 * Check if a patch is valid without returning detailed errors.
 */
export function isPatchValid(graph: GraphState, patch: Patch): boolean {
  return validatePatch(graph, patch).success;
}
