/**
 * AI configuration and defaults.
 *
 * Provides configurable parameters for:
 * - Model settings
 * - Depth budgets (narrow/medium/wide)
 * - Count limits (few/standard/many)
 * - Context limits and truncation
 */

import type { GenerationDepth, GenerationCount } from './types.js';

// =============================================================================
// Configuration Interface
// =============================================================================

/**
 * Configuration for AI generation.
 */
export interface AIConfig {
  // Model settings
  /** Model identifier */
  model: string;
  /** Maximum tokens for response */
  maxTokens: number;
  /** Temperature for generation (0.0 - 1.0) */
  temperature: number;

  // Depth budgets
  /** Budget limits for each depth setting */
  depthBudgets: {
    narrow: DepthBudget;
    medium: DepthBudget;
    wide: DepthBudget;
  };

  // Count limits
  /** Number of packages for each count setting */
  countLimits: {
    few: number;
    standard: number;
    many: number;
  };

  // Context limits
  /** Maximum nodes to include in context serialization */
  maxContextNodes: number;
  /** Maximum characters for Story Context in prompt */
  maxStoryContextLength: number;

  // Truncation patterns
  /** Patterns used when truncating content */
  truncationPatterns: {
    nodeList: string;
    edgeList: string;
    gapList: string;
  };
}

/**
 * Budget limits for a depth setting.
 */
export interface DepthBudget {
  /** Maximum new nodes per package */
  maxNodes: number;
  /** Maximum total operations per package */
  maxOps: number;
}

// =============================================================================
// Default Configuration
// =============================================================================

/**
 * Default AI configuration.
 */
export const defaultConfig: AIConfig = {
  model: 'claude-sonnet-4-20250514',
  maxTokens: 4096,
  temperature: 0.7,

  depthBudgets: {
    narrow: { maxNodes: 2, maxOps: 4 },
    medium: { maxNodes: 5, maxOps: 10 },
    wide: { maxNodes: 10, maxOps: 20 },
  },

  countLimits: {
    few: 3,
    standard: 5,
    many: 8,
  },

  maxContextNodes: 100,
  maxStoryContextLength: 4000,

  truncationPatterns: {
    nodeList: '[{count} more {type}...]',
    edgeList: '[{count} more edges...]',
    gapList: '[{count} more gaps...]',
  },
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get the number of packages for a count setting.
 *
 * @param count - The count setting
 * @param config - Optional config override
 * @returns Number of packages to generate
 */
export function getPackageCount(
  count: GenerationCount,
  config: AIConfig = defaultConfig
): number {
  return config.countLimits[count];
}

/**
 * Get the budget limits for a depth setting.
 *
 * @param depth - The depth setting
 * @param config - Optional config override
 * @returns Budget limits for the depth
 */
export function getDepthBudget(
  depth: GenerationDepth,
  config: AIConfig = defaultConfig
): DepthBudget {
  return config.depthBudgets[depth];
}

/**
 * Check if a package exceeds the budget for its depth.
 *
 * @param nodeCount - Number of nodes in the package
 * @param opCount - Number of operations in the package
 * @param depth - The depth setting
 * @param config - Optional config override
 * @returns Whether the package exceeds the budget
 */
export function exceedsBudget(
  nodeCount: number,
  opCount: number,
  depth: GenerationDepth,
  config: AIConfig = defaultConfig
): boolean {
  const budget = getDepthBudget(depth, config);
  return nodeCount > budget.maxNodes || opCount > budget.maxOps;
}

/**
 * Format a truncation message.
 *
 * @param pattern - The truncation pattern (e.g., '[{count} more {type}...]')
 * @param count - Number of truncated items
 * @param type - Type of truncated items
 * @returns Formatted truncation message
 */
export function formatTruncation(
  pattern: string,
  count: number,
  type: string
): string {
  return pattern.replace('{count}', String(count)).replace('{type}', type);
}

// =============================================================================
// Creativity Configuration
// =============================================================================

/**
 * Configuration derived from creativity level.
 * Affects temperature, entity invention threshold, and gap weighting.
 */
export interface CreativityConfig {
  /** Temperature range for this creativity level */
  temperatureScale: { min: number; max: number };
  /** Threshold for inventing new entities (higher = more conservative) */
  novelEntityThreshold: number;
  /** Weight for gap fulfillment vs. invention (higher = prioritize gaps) */
  gapWeight: number;
}

/**
 * Preset configurations for different creativity levels.
 */
export const CREATIVITY_PRESETS: Record<'conservative' | 'balanced' | 'inventive', CreativityConfig> = {
  conservative: {
    temperatureScale: { min: 0.2, max: 0.4 },
    novelEntityThreshold: 0.9,
    gapWeight: 0.8,
  },
  balanced: {
    temperatureScale: { min: 0.5, max: 0.7 },
    novelEntityThreshold: 0.6,
    gapWeight: 0.5,
  },
  inventive: {
    temperatureScale: { min: 0.7, max: 0.95 },
    novelEntityThreshold: 0.3,
    gapWeight: 0.2,
  },
};

/**
 * Get creativity configuration based on creativity level (0-1).
 *
 * @param creativity - Creativity level (0-1)
 * @returns Creativity configuration
 */
export function getCreativityConfig(creativity: number): CreativityConfig {
  if (creativity < 0.33) return CREATIVITY_PRESETS.conservative;
  if (creativity < 0.67) return CREATIVITY_PRESETS.balanced;
  return CREATIVITY_PRESETS.inventive;
}

/**
 * Get a human-readable label for creativity level.
 *
 * @param creativity - Creativity level (0-1)
 * @returns Human-readable label
 */
export function getCreativityLabel(creativity: number): string {
  if (creativity < 0.33) return 'conservative';
  if (creativity < 0.67) return 'balanced';
  return 'inventive';
}

/**
 * Calculate temperature for a given creativity level.
 * Interpolates within the preset's temperature range.
 *
 * @param creativity - Creativity level (0-1)
 * @returns Temperature value for LLM
 */
export function getTemperatureForCreativity(creativity: number): number {
  const config = getCreativityConfig(creativity);
  const { min, max } = config.temperatureScale;
  // Linear interpolation within the range
  const normalized = creativity < 0.33
    ? creativity / 0.33
    : creativity < 0.67
    ? (creativity - 0.33) / 0.34
    : (creativity - 0.67) / 0.33;
  return min + normalized * (max - min);
}

// =============================================================================
// Story Context
// =============================================================================

import type { StoryContext } from './storyContextTypes.js';
import { createDefaultStoryContext } from './storyContextTypes.js';

/**
 * Default Story Context for new stories.
 *
 * Provides an empty structured context that users can populate.
 * This replaces the previous markdown template.
 *
 * The structure separates:
 * - Constitution: stable creative direction (cached in system prompt)
 * - Operational: dynamic guidelines (filtered per-task)
 */
export const DEFAULT_STORY_CONTEXT: StoryContext = createDefaultStoryContext();
