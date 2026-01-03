/**
 * Edge type templates for schema-aware forms.
 * Defines allowed properties and validation rules per edge type.
 */

import type { EdgeType } from '../api/types';

export interface PropertyConfig {
  required?: boolean;
  default?: number | string;
  min?: number;
  max?: number;
}

export interface EdgeTemplate {
  label: string;
  description: string;
  sourceTypes: string[];
  targetTypes: string[];
  properties: {
    order?: PropertyConfig;
    weight?: PropertyConfig;
    confidence?: PropertyConfig;
    notes?: PropertyConfig;
  };
}

export const EDGE_TEMPLATES: Record<EdgeType, EdgeTemplate> = {
  FULFILLS: {
    label: 'Fulfills Beat',
    description: 'Scene fulfills a story beat',
    sourceTypes: ['Scene'],
    targetTypes: ['Beat'],
    properties: {
      order: { required: true, default: 1, min: 1 },
      notes: {},
    },
  },
  HAS_CHARACTER: {
    label: 'Has Character',
    description: 'Scene features a character',
    sourceTypes: ['Scene'],
    targetTypes: ['Character'],
    properties: {
      order: { min: 1 },
      notes: {},
    },
  },
  LOCATED_AT: {
    label: 'Located At',
    description: 'Scene takes place at a location',
    sourceTypes: ['Scene'],
    targetTypes: ['Location'],
    properties: {
      notes: {},
    },
  },
  FEATURES_OBJECT: {
    label: 'Features Object',
    description: 'Scene features a significant object',
    sourceTypes: ['Scene'],
    targetTypes: ['Object'],
    properties: {
      notes: {},
    },
  },
  INVOLVES: {
    label: 'Involves',
    description: 'Conflict involves a character',
    sourceTypes: ['Conflict'],
    targetTypes: ['Character'],
    properties: {
      weight: { min: 0, max: 1 },
      notes: {},
    },
  },
  MANIFESTS_IN: {
    label: 'Manifests In',
    description: 'Conflict manifests in a scene',
    sourceTypes: ['Conflict'],
    targetTypes: ['Scene'],
    properties: {
      order: { min: 1 },
      weight: { min: 0, max: 1 },
      notes: {},
    },
  },
  HAS_ARC: {
    label: 'Has Arc',
    description: 'Character has a character arc',
    sourceTypes: ['Character'],
    targetTypes: ['CharacterArc'],
    properties: {
      notes: {},
    },
  },
  EXPRESSED_IN: {
    label: 'Expressed In',
    description: 'Theme is expressed in a scene or beat',
    sourceTypes: ['Theme'],
    targetTypes: ['Scene', 'Beat'],
    properties: {
      weight: { min: 0, max: 1 },
      confidence: { min: 0, max: 1 },
      notes: {},
    },
  },
  APPEARS_IN: {
    label: 'Appears In',
    description: 'Motif appears in a scene',
    sourceTypes: ['Motif'],
    targetTypes: ['Scene'],
    properties: {
      order: { min: 1 },
      notes: {},
    },
  },
};

/**
 * Get edge types valid for a given source node type.
 */
export function getEdgeTypesForSource(sourceType: string): EdgeType[] {
  return (Object.entries(EDGE_TEMPLATES) as [EdgeType, EdgeTemplate][])
    .filter(([, template]) => template.sourceTypes.includes(sourceType))
    .map(([type]) => type);
}

/**
 * Get edge types valid for a given target node type.
 */
export function getEdgeTypesForTarget(targetType: string): EdgeType[] {
  return (Object.entries(EDGE_TEMPLATES) as [EdgeType, EdgeTemplate][])
    .filter(([, template]) => template.targetTypes.includes(targetType))
    .map(([type]) => type);
}

/**
 * Check if an edge type is valid between source and target node types.
 */
export function isValidEdgeType(
  edgeType: EdgeType,
  sourceType: string,
  targetType: string
): boolean {
  const template = EDGE_TEMPLATES[edgeType];
  return (
    template.sourceTypes.includes(sourceType) &&
    template.targetTypes.includes(targetType)
  );
}

/**
 * Validate edge properties against template rules.
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateEdgeProperties(
  edgeType: EdgeType,
  properties: Record<string, unknown>
): ValidationResult {
  const template = EDGE_TEMPLATES[edgeType];
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required properties
  for (const [propName, config] of Object.entries(template.properties)) {
    if (config.required && (properties[propName] === undefined || properties[propName] === null)) {
      errors.push(`${propName} is required`);
    }
  }

  // Validate order
  if (properties.order !== undefined) {
    const order = Number(properties.order);
    const config = template.properties.order;
    if (isNaN(order) || !Number.isInteger(order)) {
      errors.push('order must be an integer');
    } else if (config?.min !== undefined && order < config.min) {
      errors.push(`order must be >= ${config.min}`);
    }
  }

  // Validate weight
  if (properties.weight !== undefined) {
    const weight = Number(properties.weight);
    const config = template.properties.weight;
    if (isNaN(weight)) {
      errors.push('weight must be a number');
    } else {
      if (config?.min !== undefined && weight < config.min) {
        errors.push(`weight must be >= ${config.min}`);
      }
      if (config?.max !== undefined && weight > config.max) {
        errors.push(`weight must be <= ${config.max}`);
      }
    }
  }

  // Validate confidence
  if (properties.confidence !== undefined) {
    const confidence = Number(properties.confidence);
    const config = template.properties.confidence;
    if (isNaN(confidence)) {
      errors.push('confidence must be a number');
    } else {
      if (config?.min !== undefined && confidence < config.min) {
        errors.push(`confidence must be >= ${config.min}`);
      }
      if (config?.max !== undefined && confidence > config.max) {
        errors.push(`confidence must be <= ${config.max}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
