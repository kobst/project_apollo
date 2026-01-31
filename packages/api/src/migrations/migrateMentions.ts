/**
 * Migration utility for MENTIONS edges.
 *
 * Scans all stories and rebuilds MENTIONS edges from text content.
 * This is useful after:
 * - Initial deployment of the mentions system
 * - Bulk imports
 * - Schema changes
 *
 * Can be run as a one-time migration or scheduled periodically.
 */

import type { GraphState } from '@apollo/core';
import { mentions } from '@apollo/core';

// =============================================================================
// Migration Result
// =============================================================================

export interface MentionsMigrationResult {
  /** Number of MENTIONS edges created */
  edgesCreated: number;
  /** Number of MENTIONS edges removed */
  edgesRemoved: number;
  /** Node IDs that were processed */
  nodesProcessed: string[];
  /** Whether any migration occurred */
  migrated: boolean;
}

export interface BatchMigrationResult {
  /** Total stories processed */
  storiesProcessed: number;
  /** Stories that had changes */
  storiesModified: number;
  /** Total edges created across all stories */
  totalEdgesCreated: number;
  /** Total edges removed across all stories */
  totalEdgesRemoved: number;
  /** Per-story results */
  results: Map<string, MentionsMigrationResult>;
  /** Errors encountered */
  errors: Array<{ storyId: string; error: string }>;
}

// =============================================================================
// Single Story Migration
// =============================================================================

/**
 * Rebuild MENTIONS edges for a single story.
 *
 * @param graph - The graph state to migrate (will be mutated)
 * @returns Migration result
 */
export function migrateMentionsForStory(graph: GraphState): MentionsMigrationResult {
  const result = mentions.rebuildAllMentions(graph);
  
  return {
    edgesCreated: result.edgesCreated,
    edgesRemoved: result.edgesRemoved,
    nodesProcessed: result.nodesProcessed,
    migrated: result.edgesCreated > 0 || result.edgesRemoved > 0
  };
}

/**
 * Check if a story needs MENTIONS migration.
 * 
 * A story needs migration if:
 * - It has no MENTIONS edges but has content nodes
 * - It has entities (Characters, Locations, Objects) that could be mentioned
 *
 * @param graph - The graph state to check
 * @returns True if migration is recommended
 */
export function needsMentionsMigration(graph: GraphState): boolean {
  // Check if there are any MENTIONS edges
  const hasMentionsEdges = graph.edges.some(e => e.type === 'MENTIONS');
  
  // Check if there are mentionable entities
  const hasEntities = Array.from(graph.nodes.values()).some(
    n => n.type === 'Character' || n.type === 'Location' || n.type === 'Object'
  );
  
  // Check if there are content nodes
  const hasContentNodes = Array.from(graph.nodes.values()).some(
    n => n.type === 'StoryBeat' || n.type === 'Scene' || n.type === 'CharacterArc'
  );
  
  // Needs migration if we have entities and content but no mentions
  return hasEntities && hasContentNodes && !hasMentionsEdges;
}

/**
 * Get migration statistics for a story without actually migrating.
 *
 * @param graph - The graph state to analyze
 * @returns Statistics about what would be migrated
 */
export function getMigrationStats(graph: GraphState): {
  entityCount: number;
  contentNodeCount: number;
  existingMentionsCount: number;
  needsMigration: boolean;
} {
  const entities = Array.from(graph.nodes.values()).filter(
    n => n.type === 'Character' || n.type === 'Location' || n.type === 'Object'
  );
  
  const contentNodes = Array.from(graph.nodes.values()).filter(
    n => n.type === 'StoryBeat' || n.type === 'Scene' || n.type === 'CharacterArc'
  );
  
  const mentionsEdges = graph.edges.filter(e => e.type === 'MENTIONS');
  
  return {
    entityCount: entities.length,
    contentNodeCount: contentNodes.length,
    existingMentionsCount: mentionsEdges.length,
    needsMigration: needsMentionsMigration(graph)
  };
}

// =============================================================================
// CLI Support
// =============================================================================

/**
 * Format migration result for logging.
 */
export function formatMigrationResult(
  storyId: string,
  result: MentionsMigrationResult
): string {
  if (!result.migrated) {
    return `${storyId}: No changes (already up to date)`;
  }
  
  return `${storyId}: +${result.edgesCreated} / -${result.edgesRemoved} MENTIONS edges (${result.nodesProcessed.length} nodes scanned)`;
}

/**
 * Format batch migration result for logging.
 */
export function formatBatchResult(result: BatchMigrationResult): string {
  const lines: string[] = [
    `=== MENTIONS Migration Summary ===`,
    `Stories processed: ${result.storiesProcessed}`,
    `Stories modified: ${result.storiesModified}`,
    `Total edges created: ${result.totalEdgesCreated}`,
    `Total edges removed: ${result.totalEdgesRemoved}`,
  ];
  
  if (result.errors.length > 0) {
    lines.push(`Errors: ${result.errors.length}`);
    for (const err of result.errors) {
      lines.push(`  - ${err.storyId}: ${err.error}`);
    }
  }
  
  return lines.join('\n');
}
