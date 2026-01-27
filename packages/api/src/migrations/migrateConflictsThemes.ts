/**
 * Migration utility for Conflict, Theme, and Motif nodes.
 *
 * Converts these nodes to structured Story Context,
 * then returns IDs for deletion. These node types are no longer
 * supported as formal graph nodes - they are now stored in
 * Story Context.
 */

import type { GraphState, StoryContext, SoftGuideline, GuidelineTag } from '@apollo/core';
import { createDefaultStoryContext } from '@apollo/core';

// =============================================================================
// Legacy Node Types (for migration only)
// =============================================================================

interface LegacyConflict {
  type: 'Conflict';
  id: string;
  name: string;
  description?: string;
  conflict_type?: string;
  status?: string;
}

interface LegacyTheme {
  type: 'Theme';
  id: string;
  statement: string;
  priority?: string;
}

interface LegacyMotif {
  type: 'Motif';
  id: string;
  name: string;
  description?: string;
  motif_type?: string;
}

type LegacyNode = LegacyConflict | LegacyTheme | LegacyMotif;

// =============================================================================
// Migration Result
// =============================================================================

export interface MigrationResult {
  /** New Story Context (with migrated data) */
  newContext: StoryContext;
  /** Node IDs to delete */
  nodesToDelete: string[];
  /** Edge IDs to delete */
  edgesToDelete: string[];
  /** Whether any migration occurred */
  migrated: boolean;
  /** Summary of what was migrated */
  summary: {
    conflicts: number;
    themes: number;
    motifs: number;
  };
}

// =============================================================================
// Type Guards
// =============================================================================

function isLegacyConflict(node: unknown): node is LegacyConflict {
  return (
    typeof node === 'object' &&
    node !== null &&
    'type' in node &&
    (node as { type: unknown }).type === 'Conflict' &&
    'id' in node &&
    'name' in node
  );
}

function isLegacyTheme(node: unknown): node is LegacyTheme {
  return (
    typeof node === 'object' &&
    node !== null &&
    'type' in node &&
    (node as { type: unknown }).type === 'Theme' &&
    'id' in node &&
    'statement' in node
  );
}

function isLegacyMotif(node: unknown): node is LegacyMotif {
  return (
    typeof node === 'object' &&
    node !== null &&
    'type' in node &&
    (node as { type: unknown }).type === 'Motif' &&
    'id' in node &&
    'name' in node
  );
}

function isLegacyNode(node: unknown): node is LegacyNode {
  return isLegacyConflict(node) || isLegacyTheme(node) || isLegacyMotif(node);
}

/**
 * Generate a unique ID for migrated elements.
 */
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

// =============================================================================
// Migration Function
// =============================================================================

/**
 * Migrate Conflict, Theme, and Motif nodes to structured Story Context.
 *
 * @param graph - The current graph state
 * @param existingContext - Existing Story Context (if any)
 * @returns Migration result with new context and IDs to delete
 */
export function migrateConflictsThemesToContext(
  graph: GraphState,
  existingContext: StoryContext | undefined
): MigrationResult {
  // Find legacy nodes from the Map (cast to unknown for runtime checks)
  const allNodes = Array.from(graph.nodes.values()) as unknown[];
  const conflicts = allNodes.filter(isLegacyConflict);
  const themes = allNodes.filter(isLegacyTheme);
  const motifs = allNodes.filter(isLegacyMotif);

  // Start with existing context or create default
  const context: StoryContext = existingContext
    ? structuredClone(existingContext)
    : createDefaultStoryContext();

  // If no legacy nodes, return early
  if (conflicts.length === 0 && themes.length === 0 && motifs.length === 0) {
    return {
      newContext: context,
      nodesToDelete: [],
      edgesToDelete: [],
      migrated: false,
      summary: { conflicts: 0, themes: 0, motifs: 0 },
    };
  }

  // Collect node IDs to delete
  const nodesToDelete = [
    ...conflicts.map((c) => c.id),
    ...themes.map((t) => t.id),
    ...motifs.map((m) => m.id),
  ];

  // Find edges to delete (edges involving these nodes)
  const edgesToDelete = graph.edges
    .filter((e) => nodesToDelete.includes(e.from) || nodesToDelete.includes(e.to))
    .map((e) => e.id);

  // Convert themes to thematic pillars
  for (const theme of themes) {
    const pillar = theme.priority
      ? `${theme.statement} (${theme.priority})`
      : theme.statement;
    context.constitution.thematicPillars.push(pillar);
  }

  // Convert conflicts to soft guidelines
  for (const conflict of conflicts) {
    const text = conflict.description
      ? `${conflict.name}: ${conflict.description}`
      : conflict.name;
    const guideline: SoftGuideline = {
      id: generateId('sg'),
      tags: ['plot', 'character'] as GuidelineTag[],
      text: conflict.conflict_type
        ? `[${conflict.conflict_type}] ${text}`
        : text,
    };
    context.operational.softGuidelines.push(guideline);
  }

  // Convert motifs to soft guidelines
  for (const motif of motifs) {
    const text = motif.description
      ? `${motif.name}: ${motif.description}`
      : motif.name;
    const guideline: SoftGuideline = {
      id: generateId('sg'),
      tags: ['general'] as GuidelineTag[],
      text: motif.motif_type
        ? `[${motif.motif_type} motif] ${text}`
        : `[Motif] ${text}`,
    };
    context.operational.softGuidelines.push(guideline);
  }

  return {
    newContext: context,
    nodesToDelete,
    edgesToDelete,
    migrated: true,
    summary: {
      conflicts: conflicts.length,
      themes: themes.length,
      motifs: motifs.length,
    },
  };
}

/**
 * Check if a graph has any legacy nodes that need migration.
 *
 * @param graph - The graph state to check
 * @returns True if migration is needed
 */
export function hasLegacyNodes(graph: GraphState): boolean {
  const allNodes = Array.from(graph.nodes.values()) as unknown[];
  return allNodes.some(isLegacyNode);
}
