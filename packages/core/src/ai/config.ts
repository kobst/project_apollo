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
// Story Context Template
// =============================================================================

/**
 * Default Story Context template for new stories.
 *
 * Provides expected sections that guide AI generation and help
 * users structure their creative direction.
 *
 * NOTE: Keep in sync with placeholder in StoryContextEditor.tsx
 */
export const DEFAULT_STORY_CONTEXT = `# Story Context

## Creative Direction
Overall vision, mood, what makes this story unique.
(For specific genre/tone, use the GenreTone node)

## Themes & Motifs
Thematic concerns, recurring symbols, what the story explores.
This is the designated home for themes since they are prose, not formal nodes.

## Working Notes
Fragments, unresolved ideas, things still being figured out.

## Reference & Inspiration
External sources, mood boards, "like X meets Y", visual references.

## Constraints & Rules
Story-specific rules that guide generation.
`.trim();
